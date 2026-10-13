begin;

alter table public.orders
  add column if not exists paid_at timestamptz,
  add column if not exists tracking_note text;

create or replace function public.guard_order_payment_state()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  jwt_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  request_role text := coalesce(
    nullif(auth.role(), ''),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(jwt_claims ->> 'role', ''),
    ''
  );
  actor_role text;
  transition_allowed boolean := false;
begin
  if request_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Orders must be created by trusted server-side code'
      using errcode = '42501';
  end if;

  if new.payment_status is distinct from old.payment_status
     or new.payment_reference is distinct from old.payment_reference
     or new.payment_method is distinct from old.payment_method
     or new.total is distinct from old.total
     or new.paid_at is distinct from old.paid_at then
    raise exception 'Payment and order-total fields may only be changed by the service role'
      using errcode = '42501';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  select u.role into actor_role
  from public.users u
  where u.id = auth.uid();

  if actor_role = 'buyer' then
    if old.status = 'pending'
       and new.status = 'cancelled'
       and old.payment_status = 'pending' then
      return new;
    end if;
    raise exception 'Buyers may only cancel unpaid pending orders'
      using errcode = '42501';
  elsif actor_role = 'vendor' then
    if new.status = 'cancelled' then
      return new;
    end if;

    if old.payment_status <> 'paid' or new.payment_status <> 'paid' then
      raise exception 'An order must be paid before fulfillment'
        using errcode = '42501';
    end if;

    transition_allowed := case old.status
      when 'pending' then new.status = 'confirmed'
      when 'confirmed' then new.status = 'preparing'
      when 'preparing' then new.status in ('shipped', 'out_for_delivery')
      when 'shipped' then new.status = 'out_for_delivery'
      when 'out_for_delivery' then new.status = 'delivered'
      else false
    end;
    if not transition_allowed then
      raise exception 'Invalid vendor order status transition from % to %', old.status, new.status
        using errcode = '42501';
    end if;
  elsif actor_role = 'admin' then
    if old.payment_status <> 'paid' and new.status <> 'cancelled' then
      raise exception 'An order must be paid before fulfillment'
        using errcode = '42501';
    end if;
  else
    raise exception 'Not authorized to change order status'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_guard_payment_state on public.orders;
create trigger orders_guard_payment_state
  before insert or update on public.orders
  for each row execute function public.guard_order_payment_state();

revoke insert, update, delete on public.orders from public, anon, authenticated;
grant update (status, tracking_note) on public.orders to authenticated;
grant insert, update, delete on public.orders to service_role;

do $migration$
declare
  table_name text;
begin
  foreach table_name in array array[
    'wallet_accounts',
    'wallet_transactions',
    'return_requests',
    'return_request_items',
    'return_status_history'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'revoke all on table public.%I from public, anon, authenticated',
        table_name
      );
      execute format(
        'grant select on table public.%I to authenticated',
        table_name
      );
      execute format(
        'grant all on table public.%I to service_role',
        table_name
      );
    end if;
  end loop;
end
$migration$;

do $migration$
begin
  if to_regclass('public.return_requests') is not null
     and to_regclass('public.wallet_accounts') is not null
     and to_regclass('public.wallet_transactions') is not null then
    execute $function$
create or replace function public.process_return_refund(p_return_request_id uuid, p_note text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  return_row public.return_requests%rowtype;
  inserted_transaction uuid;
  current_balance numeric(12,2);
  caller_role text := coalesce(
    nullif(auth.role(), ''),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  );
begin
  if caller_role <> 'service_role' then
    raise exception 'Refund processing must be called by trusted server-side code';
  end if;

  select * into return_row
  from public.return_requests r
  where r.id = p_return_request_id
  for update;
  if not found then
    raise exception 'Return request not found';
  end if;

  if return_row.status = 'refunded' then
    select balance into current_balance
    from public.wallet_accounts where user_id = return_row.buyer_id;
    return coalesce(current_balance, 0);
  end if;
  if return_row.status <> 'received_by_vendor' then
    raise exception 'The return must be received by the vendor before refund';
  end if;
  if return_row.refund_amount <= 0 then
    raise exception 'Refund amount must be positive';
  end if;

  insert into public.wallet_accounts(user_id) values (return_row.buyer_id)
  on conflict (user_id) do nothing;

  insert into public.wallet_transactions(user_id, return_request_id, amount, description)
  values (
    return_row.buyer_id,
    return_row.id,
    return_row.refund_amount,
    'Refund for order ' || left(return_row.order_id::text, 8)
  )
  on conflict (return_request_id) do nothing
  returning id into inserted_transaction;

  if inserted_transaction is not null then
    update public.wallet_accounts
    set balance = balance + return_row.refund_amount, updated_at = now()
    where user_id = return_row.buyer_id;
  end if;

  update public.return_requests
  set status = 'refunded', tracking_note = nullif(btrim(p_note), ''), updated_at = now()
  where id = return_row.id;

  select balance into current_balance
  from public.wallet_accounts where user_id = return_row.buyer_id;
  return current_balance;
end;
    $function$;
  end if;

  if to_regprocedure('public.process_return_refund(uuid,text)') is not null then
    revoke all on function public.process_return_refund(uuid, text)
      from public, anon, authenticated;
    grant execute on function public.process_return_refund(uuid, text)
      to service_role;
  end if;
end
$migration$;

notify pgrst, 'reload schema';

commit;
