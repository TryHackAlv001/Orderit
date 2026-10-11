begin;

drop function if exists public.save_vendor_product(uuid, jsonb, jsonb);
drop function if exists public.search_catalog_product_ids(
  text, uuid[], numeric, numeric, text, text, text, text, numeric, boolean, text, integer, integer
);
drop trigger if exists categories_seed_product_attribute_rule on public.categories;
drop function if exists public.seed_category_attribute_rule();
drop trigger if exists products_require_complete_before_publish on public.products;
drop function if exists public.enforce_complete_active_product();

drop table if exists public.product_variants;
drop table if exists public.category_attribute_rules;
drop table if exists public.product_size_options;
drop table if exists public.product_color_options;

drop index if exists public.idx_products_price;
drop index if exists public.idx_products_rating;
drop index if exists public.idx_products_brand_normalized;
drop index if exists public.idx_products_complete_active;

alter table public.products
  drop constraint if exists products_complete_fields,
  drop constraint if exists products_price_positive,
  drop constraint if exists products_brand_nonblank,
  drop column if exists is_complete,
  drop column if exists brand_normalized,
  drop column if exists brand;

commit;
