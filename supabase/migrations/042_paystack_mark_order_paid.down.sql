begin;

drop function if exists public.mark_order_paid(text, bigint, text, text);
drop policy if exists payment_events_deny_client_access on public.payment_events;
drop table if exists public.payment_events;

notify pgrst, 'reload schema';

commit;
