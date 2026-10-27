begin;

drop index if exists public.orders_open_cart_buyer_uidx;
drop index if exists public.orders_checkout_idempotency_buyer_uidx;
drop index if exists public.orders_checkout_idempotency_key_uidx;
drop index if exists public.orders_payment_reference_uidx;

alter table public.orders
  drop column if exists payment_authorization_url,
  drop column if exists cart_fingerprint,
  drop column if exists checkout_idempotency_key;

commit;