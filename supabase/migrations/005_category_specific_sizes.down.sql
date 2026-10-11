begin;

do $$
begin
  if exists (
    select 1
    from public.cart_items
    group by user_id, product_id
    having count(*) > 1
  ) then
    raise exception 'Cannot roll back category sizes while a cart has multiple sizes of the same product. Merge or remove those cart lines first.';
  end if;
end
$$;

drop function if exists public.save_vendor_product_with_sizes(uuid, jsonb, jsonb);
drop function if exists public.reserve_order_variant_sizes(uuid);
drop function if exists public.cancel_unpaid_order(uuid);

drop index if exists public.cart_items_user_product_size_key;

alter table public.cart_items
  drop column selected_size,
  add constraint cart_items_user_id_product_id_key unique (user_id, product_id);

alter table public.order_items
  drop column selected_size;

alter table public.orders
  drop column size_stock_reserved;

alter table public.products
  drop column available_sizes,
  drop column size_type;

insert into public.product_size_options(value)
select distinct size
from public.product_variants
where size is not null
on conflict (value) do nothing;

alter table public.product_variants
  add constraint product_variants_size_fkey
  foreign key (size) references public.product_size_options(value);

commit;
