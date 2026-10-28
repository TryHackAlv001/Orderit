create or replace function public.add_cart_item(
  p_product_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_price_at_add numeric
)
returns public.cart_items
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  saved_item public.cart_items%rowtype;
  product_vendor_profile_id uuid;
  current_price numeric;
  variant_size text;
  available_quantity integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_quantity < 1 then
    raise exception 'Quantity must be a positive integer.';
  end if;

  select vp.id, p.price
    into product_vendor_profile_id, current_price
  from public.products p
  join public.vendor_profiles vp on vp.user_id = p.vendor_id
  where p.id = p_product_id and p.is_active;
  if not found then
    raise exception 'Active product not found.';
  end if;

  if p_variant_id is not null then
    select pv.size, pv.stock_quantity
      into variant_size, available_quantity
    from public.product_variants pv
    where pv.id = p_variant_id
      and pv.product_id = p_product_id
      and pv.stock_quantity > 0;
    if not found then
      raise exception 'The selected product option is no longer available.';
    end if;
  end if;

  if p_variant_id is null then
    insert into public.cart_items (
      user_id, product_id, vendor_id, variant_id,
      quantity, selected_size, price_at_add
    )
    values (
      auth.uid(), p_product_id, product_vendor_profile_id, null,
      p_quantity, null, p_price_at_add
    )
    on conflict (user_id, product_id) where variant_id is null
    do update set quantity = public.cart_items.quantity + excluded.quantity
    returning * into saved_item;
  else
    insert into public.cart_items (
      user_id, product_id, vendor_id, variant_id,
      quantity, selected_size, price_at_add
    )
    values (
      auth.uid(), p_product_id, product_vendor_profile_id, p_variant_id,
      least(p_quantity, available_quantity), variant_size, current_price
    )
    on conflict (user_id, product_id, variant_id) where variant_id is not null
    do update set quantity = least(
      available_quantity,
      public.cart_items.quantity + excluded.quantity
    ),
    price_at_add = current_price
    returning * into saved_item;
  end if;

  return saved_item;
end;
$$;

revoke all on function public.add_cart_item(uuid, uuid, integer, numeric) from public;
grant execute on function public.add_cart_item(uuid, uuid, integer, numeric) to authenticated;

create or replace function public.resolve_cart_item_variant(
  p_cart_item_id uuid,
  p_variant_id uuid
)
returns public.cart_items
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  source_item public.cart_items%rowtype;
  target_item public.cart_items%rowtype;
  variant_size text;
  available_quantity integer;
  current_price numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into source_item
  from public.cart_items
  where id = p_cart_item_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'Cart item not found.';
  end if;

  select pv.size, pv.stock_quantity, p.price
    into variant_size, available_quantity, current_price
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  where pv.id = p_variant_id
    and pv.product_id = source_item.product_id
    and pv.stock_quantity > 0
    and p.is_active
  for update of pv;
  if not found then
    raise exception 'The selected product option is no longer available.';
  end if;

  select * into target_item
  from public.cart_items
  where user_id = auth.uid()
    and product_id = source_item.product_id
    and variant_id = p_variant_id
    and id <> source_item.id
  for update;

  if found then
    update public.cart_items
    set quantity = least(available_quantity, quantity + source_item.quantity),
        price_at_add = current_price
    where id = target_item.id
    returning * into target_item;
    delete from public.cart_items where id = source_item.id;
    return target_item;
  end if;

  update public.cart_items
  set variant_id = p_variant_id,
      selected_size = variant_size,
      quantity = least(available_quantity, source_item.quantity),
      price_at_add = current_price
  where id = source_item.id
  returning * into target_item;
  return target_item;
end;
$$;

revoke all on function public.resolve_cart_item_variant(uuid, uuid) from public;
grant execute on function public.resolve_cart_item_variant(uuid, uuid) to authenticated;
