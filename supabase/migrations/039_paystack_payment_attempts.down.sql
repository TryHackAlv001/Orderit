begin;

drop function if exists public.begin_paystack_attempt(uuid, text);
drop policy if exists payment_attempts_deny_client_access on public.payment_attempts;
drop table if exists public.payment_attempts;

commit;