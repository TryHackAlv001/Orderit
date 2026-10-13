begin;

alter table public.products
  alter column price drop identity if exists;

alter table public.products
  alter column price drop expression if exists;

alter table public.products
  alter column price type numeric(12,2) using price::numeric(12,2);

commit;