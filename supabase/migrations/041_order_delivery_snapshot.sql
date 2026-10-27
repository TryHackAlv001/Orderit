begin;

alter table public.orders
  add column if not exists delivery_name text,
  add column if not exists delivery_phone text;

commit;
