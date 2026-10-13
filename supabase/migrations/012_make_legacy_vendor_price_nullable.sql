begin;

alter table public.products
  alter column vendor_price drop not null;

commit;
