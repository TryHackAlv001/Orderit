begin;

alter table public.products
  add column size_type text check (size_type is null or size_type in ('none', 'single', 'multi')),
  add column available_sizes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(available_sizes) = 'array');

alter table public.cart_items
  add column selected_size text;

alter table public.order_items
  add column selected_size text;

alter table public.orders
  add column size_stock_reserved boolean not null default false;

alter table public.products disable trigger products_require_complete_before_publish;

update public.products p
set available_sizes = coalesce((
  select jsonb_agg(distinct to_jsonb(v.size) order by to_jsonb(v.size))
  from public.product_variants v
  where v.product_id = p.id and v.size is not null
), '[]'::jsonb);

alter table public.products enable trigger products_require_complete_before_publish;

alter table public.product_variants
  drop constraint if exists product_variants_size_fkey;

alter table public.cart_items
  drop constraint if exists cart_items_user_id_product_id_key;

create unique index cart_items_user_product_size_key
  on public.cart_items(user_id, product_id, coalesce(selected_size, ''));

create or replace function public.save_vendor_product_with_sizes(
  p_product_id uuid,
  p_product jsonb,
  p_variants jsonb
)
returns setof public.products
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_product public.products%rowtype;
  requested_size_type text;
  requested_sizes jsonb;
begin
  requested_size_type := p_product->>'size_type';
  requested_sizes := coalesce(p_product->'available_sizes', '[]'::jsonb);

  if requested_size_type is null or requested_size_type not in ('none', 'single', 'multi') then
    raise exception 'A valid category size type is required';
  end if;
  if jsonb_typeof(requested_sizes) <> 'array' then
    raise exception 'Available sizes must be an array';
  end if;
  if exists (
    select 1 from jsonb_array_elements(requested_sizes) as size(value)
    where jsonb_typeof(size.value) <> 'string'
      or length(btrim(size.value #>> '{}')) = 0
  ) then
    raise exception 'Available sizes must contain non-empty strings';
  end if;
  if requested_size_type = 'none' and jsonb_array_length(requested_sizes) > 0 then
    raise exception 'Categories without sizing cannot have available sizes';
  end if;

  select * into saved_product
  from public.save_vendor_product(p_product_id, p_product, p_variants);

  update public.products
  set size_type = requested_size_type,
      available_sizes = requested_sizes
  where id = saved_product.id
  returning * into saved_product;

  return next saved_product;
end;
$$;

revoke all on function public.save_vendor_product_with_sizes(uuid, jsonb, jsonb) from public;
grant execute on function public.save_vendor_product_with_sizes(uuid, jsonb, jsonb) to authenticated;

create or replace function public.reserve_order_variant_sizes(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  requested record;
  stock_row record;
  available_quantity integer;
  remaining_quantity integer;
  reserved_quantity integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into order_row
  from public.orders
  where id = p_order_id and buyer_id = auth.uid()
  for update;
  if not found then
    raise exception 'Order not found or access denied';
  end if;
  if order_row.size_stock_reserved then
    return true;
  end if;

  for requested in
    select oi.product_id, oi.selected_size, sum(oi.quantity)::integer as quantity
    from public.order_items oi
    where oi.order_id = p_order_id and oi.selected_size is not null
    group by oi.product_id, oi.selected_size
    order by oi.product_id, oi.selected_size
  loop
    perform 1
    from public.product_variants pv
    where pv.product_id = requested.product_id and pv.size = requested.selected_size
    order by pv.id
    for update;

    select coalesce(sum(pv.stock_quantity), 0)::integer
      into available_quantity
    from public.product_variants pv
    where pv.product_id = requested.product_id and pv.size = requested.selected_size;
    if available_quantity < requested.quantity then
      update public.orders
      set status = 'cancelled'
      where id = p_order_id;
      return false;
    end if;
  end loop;

  for requested in
    select oi.product_id, oi.selected_size, sum(oi.quantity)::integer as quantity
    from public.order_items oi
    where oi.order_id = p_order_id and oi.selected_size is not null
    group by oi.product_id, oi.selected_size
    order by oi.product_id, oi.selected_size
  loop
    remaining_quantity := requested.quantity;
    for stock_row in
      select pv.id, pv.stock_quantity
      from public.product_variants pv
      where pv.product_id = requested.product_id and pv.size = requested.selected_size
      order by pv.stock_quantity desc, pv.id
      for update
    loop
      exit when remaining_quantity = 0;
      reserved_quantity := least(remaining_quantity, stock_row.stock_quantity);
      update public.product_variants
      set stock_quantity = stock_quantity - reserved_quantity
      where id = stock_row.id;
      remaining_quantity := remaining_quantity - reserved_quantity;
    end loop;
  end loop;

  update public.orders
  set size_stock_reserved = true
  where id = p_order_id;
  return true;
end;
$$;

revoke all on function public.reserve_order_variant_sizes(uuid) from public;
grant execute on function public.reserve_order_variant_sizes(uuid) to authenticated;

create or replace function public.cancel_unpaid_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  select * into order_row
  from public.orders
  where id = p_order_id and buyer_id = auth.uid()
  for update;
  if not found or order_row.payment_status <> 'pending' or order_row.status <> 'pending' then
    return false;
  end if;
  update public.orders set status = 'cancelled' where id = p_order_id;
  return true;
end;
$$;

revoke all on function public.cancel_unpaid_order(uuid) from public;
grant execute on function public.cancel_unpaid_order(uuid) to authenticated;

commit;
