begin;

alter table public.cart_items
  add column variant_id uuid,
  add column active_variant_count_at_add integer not null default 0,
  add column price_at_add numeric(12, 2);

alter table public.order_items
  add column variant_id uuid;

with variant_counts as (
  select
    p.id as product_id,
    (count(pv.id) filter (where pv.stock_quantity > 0))::integer as active_count
  from public.products p
  left join public.product_variants pv on pv.product_id = p.id
  group by p.id
),
legacy_lines as (
  select
    ci.id,
    ci.product_id,
    coalesce(vc.active_count, 0) as active_count,
    case
      when vc.active_count = 1 then (
        select pv.id
        from public.product_variants pv
        where pv.product_id = ci.product_id and pv.stock_quantity > 0
        order by pv.id
        limit 1
      )
      when ci.selected_size is not null then (
        select (array_agg(pv.id order by pv.id))[1]
        from public.product_variants pv
        where pv.product_id = ci.product_id
          and pv.stock_quantity > 0
          and pv.size = ci.selected_size
        having count(*) = 1
      )
      else null
    end as resolved_variant_id
  from public.cart_items ci
  left join variant_counts vc on vc.product_id = ci.product_id
)
update public.cart_items ci
set variant_id = legacy_lines.resolved_variant_id,
    active_variant_count_at_add = legacy_lines.active_count,
    price_at_add = p.price
from legacy_lines
join public.products p on p.id = legacy_lines.product_id
where legacy_lines.id = ci.id;

update public.cart_items ci
set selected_size = pv.size
from public.product_variants pv
where ci.variant_id = pv.id;

update public.cart_items
set selected_size = null
where variant_id is null;

alter table public.cart_items
  alter column price_at_add set not null,
  add constraint cart_items_variant_count_check
    check (
      active_variant_count_at_add >= 0
      and (variant_id is not null or active_variant_count_at_add <> 1)
    );

with duplicate_lines as (
  select
    user_id,
    product_id,
    variant_id,
    (array_agg(id order by id))[1] as keep_id,
    sum(quantity)::integer as total_quantity
  from public.cart_items
  group by user_id, product_id, variant_id
  having count(*) > 1
)
update public.cart_items ci
set quantity = duplicate_lines.total_quantity
from duplicate_lines
where ci.id = duplicate_lines.keep_id;

with duplicate_lines as (
  select
    id,
    first_value(id) over (
      partition by user_id, product_id, variant_id
      order by created_at, id
    ) as keep_id
  from public.cart_items
)
delete from public.cart_items ci
using duplicate_lines
where ci.id = duplicate_lines.id
  and duplicate_lines.id <> duplicate_lines.keep_id;

drop index if exists public.cart_items_user_product_size_key;

create unique index cart_items_user_product_unresolved_key
  on public.cart_items(user_id, product_id)
  where variant_id is null;

create unique index cart_items_user_product_variant_key
  on public.cart_items(user_id, product_id, variant_id)
  where variant_id is not null;

create or replace function public.validate_cart_item_variant()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  active_count integer;
  total_count integer;
begin
  if tg_op = 'UPDATE'
     and new.product_id = old.product_id
     and new.variant_id is not distinct from old.variant_id
     and new.active_variant_count_at_add = old.active_variant_count_at_add then
    return new;
  end if;

  select count(*)::integer,
         (count(*) filter (where pv.stock_quantity > 0))::integer
    into total_count, active_count
  from public.product_variants pv
  where pv.product_id = new.product_id;

  if new.variant_id is null then
    if total_count > 0 and active_count = 0 then
      raise exception 'No variants are currently in stock.';
    elsif active_count = 1 then
      raise exception 'Select the available product option.';
    end if;
  else
    perform 1
    from public.product_variants pv
    where pv.id = new.variant_id
      and pv.product_id = new.product_id
      and pv.stock_quantity > 0;
    if not found then
      raise exception 'The selected product option is no longer available.';
    end if;
  end if;

  new.active_variant_count_at_add := active_count;
  return new;
end;
$$;

create trigger cart_items_validate_variant
before insert or update of product_id, variant_id, active_variant_count_at_add on public.cart_items
for each row
execute function public.validate_cart_item_variant();

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
  variant_size text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_quantity < 1 then
    raise exception 'Quantity must be a positive integer.';
  end if;

  select vp.id, pv.size
    into product_vendor_profile_id, variant_size
  from public.products p
  join public.vendor_profiles vp on vp.user_id = p.vendor_id
  left join public.product_variants pv
    on pv.id = p_variant_id and pv.product_id = p.id
  where p.id = p_product_id;
  if not found then
    raise exception 'Product not found.';
  end if;
  if p_variant_id is not null and variant_size is null
     and not exists (
       select 1
       from public.product_variants pv
       where pv.id = p_variant_id and pv.product_id = p_product_id
     ) then
    raise exception 'The selected product option is no longer available.';
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
      p_quantity, variant_size, p_price_at_add
    )
    on conflict (user_id, product_id, variant_id) where variant_id is not null
    do update set quantity = public.cart_items.quantity + excluded.quantity
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

  select pv.size, pv.stock_quantity
    into variant_size, available_quantity
  from public.product_variants pv
  where pv.id = p_variant_id
    and pv.product_id = source_item.product_id;
  if not found or available_quantity < source_item.quantity then
    raise exception 'The selected product option no longer has enough stock.';
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
    set quantity = quantity + source_item.quantity
    where id = target_item.id
    returning * into target_item;
    delete from public.cart_items where id = source_item.id;
    return target_item;
  end if;

  update public.cart_items
  set variant_id = p_variant_id,
      selected_size = variant_size
  where id = source_item.id
  returning * into target_item;
  return target_item;
end;
$$;

revoke all on function public.resolve_cart_item_variant(uuid, uuid) from public;
grant execute on function public.resolve_cart_item_variant(uuid, uuid) to authenticated;

create or replace function public.reserve_order_variant_sizes(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  requested record;
  available_quantity integer;
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
    select oi.variant_id, oi.product_id, sum(oi.quantity)::integer as quantity
    from public.order_items oi
    where oi.order_id = p_order_id and oi.variant_id is not null
    group by oi.variant_id, oi.product_id
    order by oi.variant_id
  loop
    perform 1
    from public.product_variants pv
    where pv.id = requested.variant_id
      and pv.product_id = requested.product_id
    for update;

    select coalesce(pv.stock_quantity, 0)::integer
      into available_quantity
    from public.product_variants pv
    where pv.id = requested.variant_id
      and pv.product_id = requested.product_id;

    if not found or available_quantity < requested.quantity then
      update public.orders set status = 'cancelled' where id = p_order_id;
      return false;
    end if;
  end loop;

  for requested in
    select oi.variant_id, sum(oi.quantity)::integer as quantity
    from public.order_items oi
    where oi.order_id = p_order_id and oi.variant_id is not null
    group by oi.variant_id
    order by oi.variant_id
  loop
    update public.product_variants
    set stock_quantity = stock_quantity - requested.quantity
    where id = requested.variant_id;
  end loop;

  update public.orders
  set size_stock_reserved = true
  where id = p_order_id;
  return true;
end;
$$;

revoke all on function public.reserve_order_variant_sizes(uuid) from public;
grant execute on function public.reserve_order_variant_sizes(uuid) to authenticated;

commit;
