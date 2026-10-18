begin;

drop function if exists public.advance_order_status(uuid, text, jsonb);
drop function if exists public.buyer_confirm_delivery(uuid);

do $restore_order_function_names$
begin
  if to_regprocedure('public.advance_order_status(uuid,text,jsonb)') is null
     and to_regprocedure('public._advance_order_status_impl(uuid,text,jsonb)') is not null then
    execute
      'alter function public._advance_order_status_impl(uuid, text, jsonb) '
      || 'rename to advance_order_status';
  end if;

  if to_regprocedure('public.buyer_confirm_delivery(uuid)') is null
     and to_regprocedure('public._buyer_confirm_delivery_impl(uuid)') is not null then
    execute
      'alter function public._buyer_confirm_delivery_impl(uuid) '
      || 'rename to buyer_confirm_delivery';
  end if;
end
$restore_order_function_names$;

create or replace function public.guard_order_payment_state()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $guard_order_payment_state_rollback$
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
  from public.users as u
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
$guard_order_payment_state_rollback$;

grant update (status, tracking_note) on public.orders to authenticated;

drop policy if exists "Admins can insert orders" on public.orders;
drop policy if exists "Admins can delete orders" on public.orders;
drop policy if exists "Buyer can update own orders" on public.orders;
drop policy if exists "Admins can manage orders" on public.orders;

create policy "Buyer can update own orders"
  on public.orders for update
  using (auth.uid() = buyer_id or auth.uid() = vendor_id or public.is_admin())
  with check (auth.uid() = buyer_id or auth.uid() = vendor_id or public.is_admin());
create policy "Admins can manage orders"
  on public.orders for all
  using (public.is_admin());

commit;
