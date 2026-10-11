begin;

create table public.product_color_options (
  value text primary key
);

insert into public.product_color_options (value) values
  ('Black'), ('White'), ('Gray'), ('Red'), ('Orange'), ('Yellow'),
  ('Green'), ('Blue'), ('Navy'), ('Purple'), ('Pink'), ('Brown'),
  ('Gold'), ('Silver'), ('Multi-color');

create table public.product_size_options (
  value text primary key
);

insert into public.product_size_options (value) values
  ('XS'), ('S'), ('M'), ('L'), ('XL'), ('XXL'), ('XXXL'),
  ('EU 35'), ('EU 36'), ('EU 37'), ('EU 38'), ('EU 39'), ('EU 40'),
  ('EU 41'), ('EU 42'), ('EU 43'), ('EU 44'), ('EU 45'), ('EU 46'),
  ('Ring 4'), ('Ring 5'), ('Ring 6'), ('Ring 7'), ('Ring 8'),
  ('Ring 9'), ('Ring 10'), ('Ring 11'), ('Ring 12'), ('Ring 13'),
  ('One size');

create table public.category_attribute_rules (
  category_id uuid primary key references public.categories(id) on delete cascade,
  requires_color boolean not null default false,
  requires_size boolean not null default false
);

insert into public.category_attribute_rules (category_id, requires_color, requires_size)
select id,
       lower(name) ~ '(clothing|apparel|fashion|shoe|footwear|jewel|jewellery|accessor)',
       lower(name) ~ '(clothing|apparel|fashion|shoe|footwear|jewel|jewellery|accessor)'
from public.categories
on conflict (category_id) do nothing;

create or replace function public.seed_category_attribute_rule()
returns trigger
language plpgsql
as $$
declare
  needs_variants boolean;
begin
  needs_variants := lower(new.name) ~ '(clothing|apparel|fashion|shoe|footwear|jewel|jewellery|accessor)';
  insert into public.category_attribute_rules(category_id, requires_color, requires_size)
  values (new.id, needs_variants, needs_variants)
  on conflict (category_id) do nothing;
  return new;
end;
$$;

create trigger categories_seed_product_attribute_rule
  after insert on public.categories
  for each row execute function public.seed_category_attribute_rule();

alter table public.products
  add column brand text not null default 'Unspecified',
  add column brand_normalized text generated always as (lower(btrim(brand))) stored,
  add column is_complete boolean not null default false;

alter table public.products
  add constraint products_brand_nonblank check (length(btrim(brand)) > 0),
  add constraint products_complete_fields check (
    not is_complete
    or (
      lower(btrim(brand)) <> 'unspecified'
      and length(brand) <= 100
      and cardinality(images) > 0
      and category_id is not null
    )
  );
alter table public.products
  add constraint products_price_positive check (price > 0) not valid;

create index idx_products_price on public.products(price);
create index idx_products_rating on public.products(rating desc);
create index idx_products_brand_normalized on public.products(brand_normalized);
create index idx_products_complete_active on public.products(is_complete, is_active);
create index idx_category_attribute_rules_category on public.category_attribute_rules(category_id);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  color text references public.product_color_options(value),
  size text references public.product_size_options(value),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  created_at timestamptz not null default now(),
  check (color is not null or size is not null)
);

create unique index idx_product_variants_unique_values
  on public.product_variants(product_id, coalesce(color, ''), coalesce(size, ''));
create index idx_product_variants_color_size on public.product_variants(color, size);
create index idx_product_variants_product_id on public.product_variants(product_id);

create or replace function public.search_catalog_product_ids(
  p_query text,
  p_category_ids uuid[],
  p_min_price numeric,
  p_max_price numeric,
  p_brand text,
  p_state text,
  p_color text,
  p_size text,
  p_rating numeric,
  p_in_stock boolean,
  p_sort text,
  p_offset integer,
  p_page_size integer
)
returns table (product_id uuid, total_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with filtered as materialized (
    select p.id, p.price, p.rating, p.created_at
    from public.products p
    where p.is_active
      and p.is_complete
      and (nullif(btrim(p_query), '') is null
        or p.name ilike '%' || btrim(p_query) || '%'
        or coalesce(p.description, '') ilike '%' || btrim(p_query) || '%')
      and (coalesce(cardinality(p_category_ids), 0) = 0
        or p.category_id = any(p_category_ids))
      and (p_min_price is null or p.price >= p_min_price)
      and (p_max_price is null or p.price <= p_max_price)
      and (nullif(btrim(p_brand), '') is null
        or p.brand_normalized = lower(btrim(p_brand)))
      and (nullif(btrim(p_state), '') is null
        or exists (
          select 1 from public.vendor_profiles vp
          where vp.user_id = p.vendor_id
            and lower(btrim(vp.location)) = lower(btrim(p_state))
        ))
      and (p_rating is null or p.rating >= p_rating)
      and (not coalesce(p_in_stock, false) or p.stock_quantity > 0)
      and (
        (p_color is null and p_size is null)
        or exists (
          select 1 from public.product_variants v
          where v.product_id = p.id
            and (p_color is null or v.color = p_color)
            and (p_size is null or v.size = p_size)
        )
      )
  ),
  page as (
    select f.id
    from filtered f
    order by
      case when p_sort = 'price_asc' then f.price end asc nulls last,
      case when p_sort = 'price_desc' then f.price end desc nulls last,
      case when p_sort = 'rating' then f.rating end desc nulls last,
      case when p_sort = 'newest' then f.created_at end desc nulls last,
      case when p_sort not in ('price_asc', 'price_desc', 'rating', 'newest') then f.rating end desc nulls last,
      case when p_sort not in ('price_asc', 'price_desc', 'rating', 'newest') then f.created_at end desc nulls last,
      f.id
    offset greatest(coalesce(p_offset, 0), 0)
    limit least(greatest(coalesce(p_page_size, 12), 1), 48)
  )
  select page.id, (select count(*) from filtered)
  from (values (1)) as anchor(dummy)
  left join page on true;
$$;

revoke all on function public.search_catalog_product_ids(
  text, uuid[], numeric, numeric, text, text, text, text, numeric, boolean, text, integer, integer
) from public;
grant execute on function public.search_catalog_product_ids(
  text, uuid[], numeric, numeric, text, text, text, text, numeric, boolean, text, integer, integer
) to anon, authenticated;

alter table public.product_color_options enable row level security;
alter table public.product_size_options enable row level security;
alter table public.category_attribute_rules enable row level security;
alter table public.product_variants enable row level security;

create policy "Public can view product color options"
  on public.product_color_options for select using (true);
create policy "Admins can manage product color options"
  on public.product_color_options for all using (public.is_admin())
  with check (public.is_admin());

create policy "Public can view product size options"
  on public.product_size_options for select using (true);
create policy "Admins can manage product size options"
  on public.product_size_options for all using (public.is_admin())
  with check (public.is_admin());

create policy "Public can view category attribute rules"
  on public.category_attribute_rules for select using (true);
create policy "Admins can manage category attribute rules"
  on public.category_attribute_rules for all using (public.is_admin())
  with check (public.is_admin());

create policy "Users can view variants for visible products"
  on public.product_variants for select using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and (p.is_active or p.vendor_id = auth.uid() or public.is_admin())
    )
  );
create policy "Vendors can manage own product variants"
  on public.product_variants for all using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and (p.vendor_id = auth.uid() or public.is_admin())
    )
  ) with check (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and (p.vendor_id = auth.uid() or public.is_admin())
    )
  );

create or replace function public.enforce_complete_active_product()
returns trigger
language plpgsql
as $$
declare
  required_color boolean := false;
  required_size boolean := false;
begin
  if not new.is_active then
    return new;
  end if;

  if not new.is_complete
      or lower(btrim(new.brand)) = 'unspecified'
      or length(new.brand) > 100
      or cardinality(new.images) = 0 then
    raise exception 'Complete all required product details before publishing';
  end if;

  select coalesce(r.requires_color, false), coalesce(r.requires_size, false)
    into required_color, required_size
  from public.category_attribute_rules r
  where r.category_id = new.category_id;

  if (required_color or required_size) and not exists (
    select 1 from public.product_variants v
    where v.product_id = new.id
      and (not required_color or v.color is not null)
      and (not required_size or v.size is not null)
  ) then
    raise exception 'Add valid color and size variants before publishing';
  end if;

  return new;
end;
$$;

create trigger products_require_complete_before_publish
  before insert or update on public.products
  for each row execute function public.enforce_complete_active_product();

create or replace function public.save_vendor_product(
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
  saved_id uuid;
  total_stock integer;
  active_after_save boolean;
begin
  if auth.uid() is null or not public.is_vendor() then
    raise exception 'Only vendors can save products';
  end if;
  if jsonb_typeof(p_variants) <> 'array' then
    raise exception 'Variants must be an array';
  end if;

  active_after_save := coalesce((p_product->>'is_active')::boolean, false);

  if p_product_id is null then
    insert into public.products (
      vendor_id, name, description, category_id, price, compare_price,
      minimum_order, tags, stock_quantity, sku, is_active, images,
      brand, is_complete
    ) values (
      auth.uid(),
      btrim(p_product->>'name'),
      nullif(btrim(p_product->>'description'), ''),
      (p_product->>'category_id')::uuid,
      (p_product->>'price')::numeric,
      nullif(p_product->>'compare_price', '')::numeric,
      coalesce((p_product->>'minimum_order')::integer, 1),
      coalesce(array(select jsonb_array_elements_text(p_product->'tags')), '{}'),
      0,
      nullif(btrim(p_product->>'sku'), ''),
      false,
      array(select jsonb_array_elements_text(p_product->'images')),
      btrim(p_product->>'brand'),
      false
    ) returning id into saved_id;
  else
    update public.products set
      is_active = false,
      is_complete = false,
      name = btrim(p_product->>'name'),
      description = nullif(btrim(p_product->>'description'), ''),
      category_id = (p_product->>'category_id')::uuid,
      price = (p_product->>'price')::numeric,
      compare_price = nullif(p_product->>'compare_price', '')::numeric,
      minimum_order = coalesce((p_product->>'minimum_order')::integer, 1),
      tags = coalesce(array(select jsonb_array_elements_text(p_product->'tags')), '{}'),
      sku = nullif(btrim(p_product->>'sku'), ''),
      images = array(select jsonb_array_elements_text(p_product->'images')),
      brand = btrim(p_product->>'brand')
    where id = p_product_id and vendor_id = auth.uid()
    returning id into saved_id;

    if saved_id is null then
      raise exception 'Product not found or access denied';
    end if;

    delete from public.product_variants where product_id = saved_id;
  end if;

  insert into public.product_variants (product_id, color, size, stock_quantity)
  select saved_id,
         nullif(v.value->>'color', ''),
         nullif(v.value->>'size', ''),
         (v.value->>'stock_quantity')::integer
  from jsonb_array_elements(p_variants) as v(value);

  if jsonb_array_length(p_variants) > 0 then
    select coalesce(sum(stock_quantity), 0)::integer into total_stock
    from public.product_variants
    where product_id = saved_id;
  else
    total_stock := coalesce((p_product->>'stock_quantity')::integer, 0);
  end if;

  update public.products
  set stock_quantity = total_stock,
      is_complete = true,
      is_active = active_after_save
  where id = saved_id;

  return query select * from public.products where id = saved_id;
end;
$$;

revoke all on function public.save_vendor_product(uuid, jsonb, jsonb) from public;
grant execute on function public.save_vendor_product(uuid, jsonb, jsonb) to authenticated;

commit;
