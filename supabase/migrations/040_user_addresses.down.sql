begin;

drop table if exists public.user_addresses;
drop function if exists public.promote_oldest_user_address();
drop function if exists public.enforce_user_address_rules();

commit;
