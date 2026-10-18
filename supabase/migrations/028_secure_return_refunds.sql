begin;

alter table public.wallet_transactions
  add column if not exists return_request_id uuid;

do $body$
begin
  if exists (
    select 1
    from public.wallet_transactions
    where return_request_id is not null
    group by return_request_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate wallet_transactions return_request_id values must be resolved first';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.wallet_transactions'::regclass
      and conname = 'wallet_transactions_return_request_id_fkey'
  ) then
    alter table public.wallet_transactions
      add constraint wallet_transactions_return_request_id_fkey
      foreign key (return_request_id)
      references public.return_requests(id)
      on delete restrict;
  end if;
end;
$body$;

create unique index if not exists wallet_transactions_return_request_id_uidx
  on public.wallet_transactions(return_request_id);

create or replace function public.process_return_refund(
  p_return_request_id uuid,
  p_note text
)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $fn$
declare
  caller_role text := coalesce(
    nullif(auth.role(), ''),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    ''
  );
  return_row public.return_requests%rowtype;
  order_row public.orders%rowtype;
  vendor_profile_id uuid;
  transaction_id uuid;
  refund_amount numeric(12,2);
  buyer_balance numeric(12,2);
begin
  if caller_role <> 'service_role' then
    raise exception 'Refund processing must be called by trusted server-side code'
      using errcode = '42501';
  end if;

  select r.* into return_row
  from public.return_requests as r
  where r.id = p_return_request_id
  for update;
  if not found then
    raise exception 'Return request not found';
  end if;

  if return_row.status <> 'received_by_vendor' then
    raise exception 'The return must be received by the vendor and not already refunded'
      using errcode = '42501';
  end if;

  select o.* into order_row
  from public.orders as o
  where o.id = return_row.order_id
    and o.buyer_id = return_row.buyer_id
    and o.vendor_id = return_row.vendor_id
  for update;
  if not found then
    raise exception 'The return does not match its order';
  end if;
  if order_row.status <> 'delivered' then
    raise exception 'Only a delivered order can be refunded';
  end if;

  refund_amount := return_row.refund_amount;
  if refund_amount <= 0 or refund_amount > order_row.total then
    raise exception 'The return refund amount is invalid for its order';
  end if;

  select vp.id into vendor_profile_id
  from public.vendor_profiles as vp
  where vp.user_id = return_row.vendor_id
  for update;
  if not found then
    raise exception 'Vendor profile not found';
  end if;

  insert into public.wallet_accounts(user_id)
  values (return_row.buyer_id)
  on conflict (user_id) do nothing;

  insert into public.wallet_transactions(
    vendor_id, order_id, type, amount, reason, return_request_id
  ) values (
    vendor_profile_id,
    order_row.id,
    'debit',
    refund_amount,
    'Refund for return ' || left(return_row.id::text, 8),
    return_row.id
  )
  on conflict (return_request_id) do nothing
  returning id into transaction_id;

  if transaction_id is null then
    raise exception 'A refund transaction already exists for this return'
      using errcode = '23505';
  end if;

  update public.vendor_profiles
  set available_balance = available_balance - refund_amount
  where id = vendor_profile_id;

  update public.wallet_accounts
  set balance = balance + refund_amount,
      updated_at = now()
  where user_id = return_row.buyer_id
  returning balance into buyer_balance;

  update public.return_requests
  set status = 'refunded',
      tracking_note = nullif(btrim(p_note), ''),
      updated_at = now()
  where id = return_row.id;

  return buyer_balance;
end;
$fn$;

revoke all on function public.process_return_refund(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.process_return_refund(uuid, text)
  to service_role;

revoke all on function public.ensure_order_fulfillment_for_vendor(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.link_order_items_to_fulfillment(uuid)
  from public, anon, authenticated;
revoke all on function public.order_overall_status(uuid)
  from public, anon, authenticated;

commit;