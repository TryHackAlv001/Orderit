begin;

alter table public.orders
  drop column if exists delivery_phone,
  drop column if exists delivery_name;

commit;
