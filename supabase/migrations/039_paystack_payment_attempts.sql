begin;

create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  reference text not null unique,
  status text not null check (status in ('initializing', 'initialized', 'failed', 'paid')),
  created_at timestamptz not null default now()
);

create index if not exists payment_attempts_order_created_idx
  on public.payment_attempts (order_id, created_at desc);

alter table public.payment_attempts enable row level security;
revoke all on public.payment_attempts from public, anon, authenticated;
grant all on public.payment_attempts to service_role;

drop policy if exists payment_attempts_deny_client_access on public.payment_attempts;
create policy payment_attempts_deny_client_access
  on public.payment_attempts for all to anon, authenticated
  using (false) with check (false);

create or replace function public.begin_paystack_attempt(p_order_id uuid, p_reference text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $fn$
declare
  order_row public.orders%rowtype;
  caller_role text := coalesce(
    nullif(auth.role(), ''),
    nullif(current_setting('request.jwt.claim.role', true), '')
  );
begin
  if caller_role <> 'service_role' then
    raise exception 'Payment attempts require trusted server-side code'
      using errcode = '42501';
  end if;

  select * into order_row
  from public.orders
  where id = p_order_id
  for update;

  if not found
     or order_row.status <> 'pending'
     or order_row.payment_status <> 'pending'
     or order_row.payment_reference is not null then
    return false;
  end if;

  update public.orders
  set payment_reference = p_reference,
      payment_method = 'paystack',
      payment_authorization_url = null
  where id = p_order_id;

  insert into public.payment_attempts(order_id, reference, status)
  values (p_order_id, p_reference, 'initializing');

  return true;
end;
$fn$;

revoke all on function public.begin_paystack_attempt(uuid, text) from public, anon, authenticated;
grant execute on function public.begin_paystack_attempt(uuid, text) to service_role;

commit;