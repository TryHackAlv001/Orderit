begin;

alter table public.orders
  add column if not exists checkout_idempotency_key text,
  add column if not exists cart_fingerprint text,
  add column if not exists payment_authorization_url text;

drop index if exists public.orders_checkout_idempotency_key_uidx;

create unique index if not exists orders_payment_reference_uidx
  on public.orders (payment_reference)
  where payment_reference is not null;

create unique index if not exists orders_checkout_idempotency_buyer_uidx
  on public.orders (buyer_id, checkout_idempotency_key)
  where checkout_idempotency_key is not null;

create unique index if not exists orders_open_cart_buyer_uidx
  on public.orders (buyer_id, cart_fingerprint)
  where cart_fingerprint is not null
    and status = 'pending'
    and payment_status = 'pending';

revoke insert, update, delete on public.orders from public, anon, authenticated;
grant update (status, tracking_note) on public.orders to authenticated;

commit;