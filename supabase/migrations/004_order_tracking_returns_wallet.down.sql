begin;

drop trigger if exists return_requests_capture_status on public.return_requests;
drop trigger if exists return_requests_enforce_lifecycle on public.return_requests;
drop trigger if exists orders_capture_status_updates on public.orders;
drop trigger if exists orders_capture_initial_status on public.orders;
drop function if exists public.capture_return_status_change();
drop function if exists public.enforce_return_lifecycle();
drop function if exists public.capture_order_status_change();
drop function if exists public.create_return_request(uuid, uuid[], text, text, text);
drop function if exists public.process_return_refund(uuid, text);

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'return_status_history'
  ) then
    alter publication supabase_realtime drop table public.return_status_history;
  end if;
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_status_history'
  ) then
    alter publication supabase_realtime drop table public.order_status_history;
  end if;
end
$$;

drop table if exists public.wallet_transactions;
drop table if exists public.wallet_accounts;
drop table if exists public.return_status_history;
drop table if exists public.return_request_items;
drop table if exists public.return_requests;
drop table if exists public.return_policy_settings;
drop table if exists public.order_status_history;

alter table public.orders
  drop constraint if exists orders_status_check,
  drop column if exists tracking_note,
  drop column if exists delivered_at;

alter table public.orders
  add constraint orders_status_check check (
    status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')
  );

commit;
