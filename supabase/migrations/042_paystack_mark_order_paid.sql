begin;

create table public.payment_events (
  event_key text primary key,
  reference text not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null check (status in ('paid', 'already_paid', 'needs_review')),
  created_at timestamptz not null default now()
);

alter table public.payment_events enable row level security;
revoke all on public.payment_events from public, anon, authenticated;
grant all on public.payment_events to service_role;

create policy payment_events_deny_client_access
  on public.payment_events for all to anon, authenticated
  using (false) with check (false);

create or replace function public.mark_order_paid(
  p_reference text,
  p_amount_kobo bigint,
  p_currency text,
  p_event_key text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $fn$
declare
  order_row public.orders%rowtype;
  inserted_event_key text;
  caller_role text := coalesce(
    nullif(auth.role(), ''),
    nullif(current_setting('request.jwt.claim.role', true), '')
  );
begin
  if caller_role <> 'service_role' then
    raise exception 'Order payment confirmation requires trusted server-side code'
      using errcode = '42501';
  end if;

  if p_reference is null or p_reference = ''
     or p_amount_kobo is null or p_amount_kobo <= 0
     or p_currency is null or p_event_key is null or p_event_key = '' then
    raise exception 'Payment reference, positive amount, currency, and event key are required'
      using errcode = '22023';
  end if;

  select * into order_row
  from public.orders
  where payment_reference = p_reference
  for update;

  if not found then
    raise exception 'Order not found for payment reference'
      using errcode = 'P0002';
  end if;

  if p_currency <> 'NGN'
     or round(order_row.total * 100)::bigint <> p_amount_kobo then
    raise exception 'Payment amount or currency does not match the order'
      using errcode = '22023';
  end if;

  insert into public.payment_events (event_key, reference, order_id, status)
  values (p_event_key, p_reference, order_row.id, 'paid')
  on conflict (event_key) do nothing
  returning event_key into inserted_event_key;

  if inserted_event_key is null then
    return 'duplicate';
  end if;

  if order_row.payment_status = 'paid' then
    update public.payment_events
    set status = 'already_paid'
    where event_key = p_event_key;
    return 'already_paid';
  end if;

  if order_row.status <> 'pending' or order_row.payment_status <> 'pending' then
    update public.payment_events
    set status = 'needs_review'
    where event_key = p_event_key;
    return 'needs_review';
  end if;

  update public.orders
  set payment_status = 'paid',
      paid_at = now(),
      status = 'confirmed'
  where id = order_row.id
    and status = 'pending'
    and payment_status = 'pending';

  return 'paid';
end;
$fn$;

revoke all on function public.mark_order_paid(text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.mark_order_paid(text, bigint, text, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
