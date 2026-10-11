begin;

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
      and public.product_matches_catalog_query(p.name, p.description, p_query)
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

create or replace function public.suggest_product_names(p_query text)
returns table (name text)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (lower(btrim(p.name))) btrim(p.name) as name
  from public.products p
  where p.is_active
    and nullif(btrim(p_query), '') is not null
  and public.product_matches_catalog_query(p.name, null, p_query)
  order by lower(btrim(p.name)), p.name
  limit 8;
$$;

revoke all on function public.suggest_product_names(text) from public;
grant execute on function public.suggest_product_names(text) to anon, authenticated;

commit;
