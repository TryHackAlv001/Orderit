begin;

create or replace function public.prevent_vendor_self_purchase_cart_item()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is not null and exists (
    select 1
    from public.products p
    where p.id = new.product_id
      and p.vendor_id = auth.uid()
  ) then
    raise exception using
      errcode = 'check_violation',
      message = 'You can''t purchase your own products.';
  end if;

  return new;
end;
$$;

drop trigger if exists cart_items_prevent_vendor_self_purchase
  on public.cart_items;

create trigger cart_items_prevent_vendor_self_purchase
before insert or update on public.cart_items
for each row
execute function public.prevent_vendor_self_purchase_cart_item();

do $$
declare
  removed_count bigint;
begin
  delete from public.cart_items ci
  using public.products p
  where ci.product_id = p.id
    and ci.user_id = p.vendor_id;

  get diagnostics removed_count = row_count;
  raise notice 'Removed % existing own-product cart item(s).', removed_count;
end;
$$;

commit;
