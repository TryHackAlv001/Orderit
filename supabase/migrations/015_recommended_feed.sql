begin;

alter table public.users
  add column if not exists personalization_enabled boolean not null default true;

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  anon_id uuid,
  session_id uuid,
  event_type text not null check (event_type in ('impression', 'view', 'add_to_cart', 'purchase', 'search')),
  category_id uuid references public.categories(id) on delete set null,
  brand text,
  query_text text,
  personalization_allowed boolean not null default true,
  impression_dedupe_key text generated always as (
    case when event_type = 'impression' and session_id is not null
      then session_id::text || ':' || product_id::text end
  ) stored,
  created_at timestamptz not null default now(),
  check (user_id is not null or anon_id is not null),
  check (
    (event_type = 'search' and product_id is null and query_text is not null)
    or (event_type <> 'search' and product_id is not null and query_text is null)
  ),
  unique (impression_dedupe_key)
);

create index if not exists product_events_created_at_idx
  on public.product_events(created_at);
create index if not exists product_events_product_type_created_idx
  on public.product_events(product_id, event_type, created_at);
create index if not exists product_events_user_created_idx
  on public.product_events(user_id, created_at) where user_id is not null;
create index if not exists product_events_anon_created_idx
  on public.product_events(anon_id, created_at) where anon_id is not null;

create table if not exists public.user_interests (
  user_id uuid references public.users(id) on delete cascade,
  anon_id uuid,
  category_id uuid references public.categories(id) on delete cascade,
  brand_normalized text,
  identity_key text generated always as (
    case when user_id is not null then 'u:' || user_id::text else 'a:' || anon_id::text end
  ) stored,
  dimension_key text generated always as (
    coalesce('c:' || category_id::text, 'b:' || brand_normalized)
  ) stored,
  weight numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (identity_key, dimension_key),
  check ((user_id is not null) <> (anon_id is not null)),
  check (
    (category_id is not null and brand_normalized is null)
    or (category_id is null and brand_normalized is not null)
  )
);

create table if not exists public.product_stats (
  product_id uuid primary key references public.products(id) on delete cascade,
  impressions numeric not null default 0,
  views numeric not null default 0,
  add_to_carts numeric not null default 0,
  purchases numeric not null default 0,
  refreshed_at timestamptz not null default now()
);

create table if not exists public.recommendation_feed_sessions (
  session_seed uuid not null,
  user_id uuid references public.users(id) on delete cascade,
  anon_id uuid,
  identity_key text generated always as (
    case when user_id is not null then 'u:' || user_id::text else 'a:' || anon_id::text end
  ) stored,
  built boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (identity_key, session_seed),
  check ((user_id is not null) <> (anon_id is not null))
);

create table if not exists public.recommendation_feed_items (
  identity_key text not null,
  session_seed uuid not null,
  position integer not null,
  product_id uuid not null references public.products(id) on delete cascade,
  personalized_score numeric not null,
  popularity_score numeric not null,
  freshness_score numeric not null,
  source_bucket text not null check (source_bucket in ('personalized', 'popular', 'exploratory')),
  primary key (identity_key, session_seed, position),
  unique (identity_key, session_seed, product_id),
  foreign key (identity_key, session_seed)
    references public.recommendation_feed_sessions(identity_key, session_seed) on delete cascade
);

alter table public.product_events enable row level security;
alter table public.user_interests enable row level security;
alter table public.product_stats enable row level security;
alter table public.recommendation_feed_sessions enable row level security;
alter table public.recommendation_feed_items enable row level security;

drop policy if exists "Users can read only their own product events" on public.product_events;
drop policy if exists "Users can read only their own interests" on public.user_interests;
drop policy if exists "Vendors can read aggregate stats for own products" on public.product_stats;

create policy "Users can read only their own product events"
  on public.product_events for select to authenticated
  using (user_id = auth.uid());
create policy "Users can read only their own interests"
  on public.user_interests for select to authenticated
  using (user_id = auth.uid());
create policy "Vendors can read aggregate stats for own products"
  on public.product_stats for select to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.vendor_id = auth.uid()
  ));

revoke all on public.product_events, public.user_interests,
  public.recommendation_feed_sessions, public.recommendation_feed_items
  from anon, authenticated;
grant select on public.product_events, public.user_interests to authenticated;
revoke all on public.product_stats from anon, authenticated;
grant select on public.product_stats to authenticated;

create or replace function public.add_recommendation_interest(
  p_user_id uuid,
  p_anon_id uuid,
  p_category_id uuid,
  p_brand text,
  p_weight numeric
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_brand text := nullif(lower(btrim(p_brand)), '');
begin
  if (p_user_id is not null) = (p_anon_id is not null) then
    raise exception 'Exactly one recommendation identity is required';
  end if;

  if p_category_id is not null then
    insert into public.user_interests(user_id, anon_id, category_id, weight)
    values (p_user_id, p_anon_id, p_category_id, p_weight)
    on conflict (identity_key, dimension_key) do update
      set weight = public.user_interests.weight
        * power(0.5, greatest(extract(epoch from (now() - public.user_interests.updated_at)) / 86400, 0) / 30)
        + excluded.weight,
          updated_at = now();
  end if;

  if v_brand is not null then
    insert into public.user_interests(user_id, anon_id, brand_normalized, weight)
    values (p_user_id, p_anon_id, v_brand, p_weight)
    on conflict (identity_key, dimension_key) do update
      set weight = public.user_interests.weight
        * power(0.5, greatest(extract(epoch from (now() - public.user_interests.updated_at)) / 86400, 0) / 30)
        + excluded.weight,
          updated_at = now();
  end if;
end;
$$;
revoke all on function public.add_recommendation_interest(uuid, uuid, uuid, text, numeric)
  from public, anon, authenticated;

create or replace function public.capture_recommendation_interest()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_weight numeric := case new.event_type
    when 'purchase' then 20
    when 'add_to_cart' then 10
    when 'view' then 3
    when 'search' then 2
    else 0.2
  end;
  v_category uuid := new.category_id;
  v_brand text := new.brand;
begin
  if not new.personalization_allowed then return new; end if;

  if new.product_id is not null then
    select coalesce(v_category, p.category_id), coalesce(v_brand, p.brand)
      into v_category, v_brand
    from public.products p
    where p.id = new.product_id;
    perform public.add_recommendation_interest(
      new.user_id, new.anon_id, v_category, v_brand, v_weight
    );
  elsif new.event_type = 'search' then
    perform public.add_recommendation_interest(
      new.user_id, new.anon_id, matched.category_id, matched.brand, v_weight
    )
    from (
      select distinct p.category_id, p.brand
      from public.products p
      left join public.categories c on c.id = p.category_id
      where p.is_active and p.is_complete and p.category_id is not null
        and (
          p.name ilike '%' || new.query_text || '%'
          or coalesce(p.brand, '') ilike '%' || new.query_text || '%'
          or coalesce(c.name, '') ilike '%' || new.query_text || '%'
          or exists (
            select 1 from unnest(p.tags) tag
            where tag ilike '%' || new.query_text || '%'
          )
        )
    ) matched;
  end if;
  return new;
end;
$$;

drop trigger if exists product_events_capture_interest on public.product_events;

create trigger product_events_capture_interest
  after insert on public.product_events
  for each row execute function public.capture_recommendation_interest();

create or replace function public.refresh_product_stats()
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  insert into public.product_stats(product_id, impressions, views, add_to_carts, purchases, refreshed_at)
  select p.id,
    coalesce(sum(w.decay) filter (where e.event_type = 'impression'), 0),
    coalesce(sum(w.decay) filter (where e.event_type = 'view'), 0),
    coalesce(sum(w.decay) filter (where e.event_type = 'add_to_cart'), 0),
    coalesce(sum(w.decay) filter (where e.event_type = 'purchase'), 0),
    now()
  from public.products p
  left join public.product_events e
    on e.product_id = p.id and e.created_at >= now() - interval '30 days'
  left join lateral (
    select power(0.5, greatest(extract(epoch from (now() - e.created_at)) / 86400, 0) / 14) as decay
  ) w on e.id is not null
  group by p.id
  on conflict (product_id) do update set
    impressions = excluded.impressions,
    views = excluded.views,
    add_to_carts = excluded.add_to_carts,
    purchases = excluded.purchases,
    refreshed_at = excluded.refreshed_at;
$$;

create or replace function public.record_paid_order_purchases()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_personalization_enabled boolean;
begin
  if new.payment_status <> 'paid' then return new; end if;
  if tg_op = 'UPDATE' and old.payment_status = 'paid' then return new; end if;

  select coalesce(u.personalization_enabled, true)
    into v_personalization_enabled
  from public.users u
  where u.id = new.buyer_id;

  insert into public.product_events(
    product_id, user_id, anon_id, event_type, category_id, brand, personalization_allowed
  )
  select p.id,
    case when v_personalization_enabled then new.buyer_id else null end,
    case when v_personalization_enabled then null else gen_random_uuid() end,
    'purchase', p.category_id, p.brand, coalesce(v_personalization_enabled, true)
  from public.order_items oi
  join public.products p on p.id = oi.product_id
  where oi.order_id = new.id;
  return new;
end;
$$;

drop trigger if exists orders_record_recommendation_purchases on public.orders;

create trigger orders_record_recommendation_purchases
  after insert or update of payment_status on public.orders
  for each row execute function public.record_paid_order_purchases();

create or replace function public.cleanup_recommendation_data()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.product_events where created_at < now() - interval '90 days';
  delete from public.user_interests where updated_at < now() - interval '90 days';
  delete from public.recommendation_feed_sessions where created_at < now() - interval '2 hours';
end;
$$;

create or replace function public.recommended_products(
  p_user_id uuid,
  p_anon_id uuid,
  p_limit integer,
  p_offset integer,
  p_session_seed uuid
) returns table (
  product_id uuid,
  personalized_score numeric,
  popularity_score numeric,
  freshness_score numeric,
  source_bucket text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_enabled boolean := true;
  v_has_history boolean := false;
  v_identity_key text;
begin
  if (p_user_id is not null) = (p_anon_id is not null) then
    raise exception 'Exactly one recommendation identity is required';
  end if;
  if p_user_id is not null
    and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
    and p_user_id is distinct from auth.uid() then
    raise exception 'Cannot request recommendations for another user';
  end if;
  if p_session_seed is null then raise exception 'Session seed is required'; end if;
  v_identity_key := case
    when p_user_id is not null then 'u:' || p_user_id::text
    else 'a:' || p_anon_id::text
  end;
  if p_user_id is not null then
    select coalesce(u.personalization_enabled, true)
      into v_enabled
    from public.users u
    where u.id = p_user_id;
  end if;
  if v_enabled then
    select exists (
      select 1 from public.product_events e
      where e.personalization_allowed
        and ((p_user_id is not null and e.user_id = p_user_id)
          or (p_user_id is null and p_anon_id is not null and e.anon_id = p_anon_id))
    ) into v_has_history;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_identity_key || p_session_seed::text, 0));
  insert into public.recommendation_feed_sessions(session_seed, user_id, anon_id)
  values (p_session_seed, p_user_id, p_anon_id)
  on conflict (identity_key, session_seed) do nothing;

  if not exists (
    select 1 from public.recommendation_feed_sessions s
    where s.identity_key = v_identity_key and s.session_seed = p_session_seed
      and s.user_id is not distinct from p_user_id
      and s.anon_id is not distinct from p_anon_id
  ) then
    raise exception 'Session seed belongs to another viewer';
  end if;

  if not (select s.built from public.recommendation_feed_sessions s
          where s.identity_key = v_identity_key and s.session_seed = p_session_seed) then
    with candidates as (
      select p.id, p.category_id, p.brand_normalized,
        coalesce((
          select sum(i.weight * power(0.5,
            greatest(extract(epoch from (now() - i.updated_at)) / 86400, 0) / 30))
          from public.user_interests i
          where v_enabled and (
            (p_user_id is not null and i.user_id = p_user_id)
            or (p_user_id is null and p_anon_id is not null and i.anon_id = p_anon_id)
          ) and (i.category_id = p.category_id or i.brand_normalized = p.brand_normalized)
        ), 0) as personalized_score,
        (coalesce(st.purchases, 0) * 8 + coalesce(st.add_to_carts, 0) * 4
          + coalesce(st.views, 0) + 0.5) / (coalesce(st.impressions, 0) + 4) as popularity_score,
        (case when p.created_at >= now() - interval '14 days'
            then 0.1 * greatest(0, 1 - extract(epoch from (now() - p.created_at)) / 1209600)
            else 0 end
          + case when vp.created_at >= now() - interval '14 days'
            then 0.1 * greatest(0, 1 - extract(epoch from (now() - vp.created_at)) / 1209600)
            else 0 end) as freshness_score,
        not exists (
          select 1 from public.user_interests i
          where i.category_id = p.category_id
            and ((p_user_id is not null and i.user_id = p_user_id)
              or (p_user_id is null and p_anon_id is not null and i.anon_id = p_anon_id))
        ) as unseen_category
      from public.products p
      left join public.vendor_profiles vp on vp.user_id = p.vendor_id
      left join public.product_stats st on st.product_id = p.id
      where p.is_active and p.is_complete and p.stock_quantity > 0
        and (p_user_id is null or p.vendor_id <> p_user_id)
        and not exists (
          select 1 from public.order_items oi
          join public.orders o on o.id = oi.order_id
          where p_user_id is not null and o.buyer_id = p_user_id
            and o.payment_status = 'paid' and o.status <> 'cancelled'
            and oi.product_id = p.id
        )
    ), bucketed as (
      select c.*,
        case
          when v_enabled and v_has_history and c.personalized_score > 0 then 'personalized'
          when v_enabled and v_has_history and (c.unseen_category or c.freshness_score > 0) then 'exploratory'
          else 'popular'
        end as source_bucket
      from candidates c
    ), ranked as (
      select b.*,
        row_number() over (
          partition by b.source_bucket
          order by
            case b.source_bucket
              when 'personalized' then b.personalized_score
              when 'exploratory' then b.freshness_score + b.popularity_score
              else b.popularity_score + b.freshness_score
            end desc,
            md5(p_session_seed::text || b.id::text)
        ) as bucket_rank
      from bucketed b
    ), slotted as (
      select r.*,
        case r.source_bucket
          when 'personalized' then ((r.bucket_rank - 1) / 6) * 10 + ((r.bucket_rank - 1) % 6) + 1
          when 'popular' then ((r.bucket_rank - 1) / 3) * 10 + 7 + ((r.bucket_rank - 1) % 3)
          else (r.bucket_rank - 1) * 10 + 10
        end as feed_slot
      from ranked r
    ), ordered as (
      select s.*,
        row_number() over (order by s.feed_slot, md5(p_session_seed::text || s.id::text)) as feed_position
      from slotted s
    )
    insert into public.recommendation_feed_items(
      identity_key, session_seed, position, product_id, personalized_score,
      popularity_score, freshness_score, source_bucket
    )
    select v_identity_key, p_session_seed, ordered.feed_position::integer, ordered.id,
      ordered.personalized_score, ordered.popularity_score, ordered.freshness_score,
      ordered.source_bucket
    from ordered
    on conflict (identity_key, session_seed, position) do nothing;

    update public.recommendation_feed_sessions set built = true
    where identity_key = v_identity_key and session_seed = p_session_seed;
  end if;

  return query
  select i.product_id, i.personalized_score, i.popularity_score, i.freshness_score, i.source_bucket
  from public.recommendation_feed_items i
  join public.products p on p.id = i.product_id
  where i.identity_key = v_identity_key and i.session_seed = p_session_seed
    and p.is_active and p.is_complete and p.stock_quantity > 0
    and (p_user_id is null or p.vendor_id <> p_user_id)
    and not exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where p_user_id is not null and o.buyer_id = p_user_id
        and o.payment_status = 'paid' and o.status <> 'cancelled'
        and oi.product_id = p.id
    )
  order by i.position
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 12), 1), 48);
end;
$$;

revoke all on function public.recommended_products(uuid, uuid, integer, integer, uuid)
  from public, anon, authenticated;
grant execute on function public.recommended_products(uuid, uuid, integer, integer, uuid)
  to service_role;
revoke all on function public.refresh_product_stats() from public, anon, authenticated;
revoke all on function public.cleanup_recommendation_data() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job
  where jobname in ('orderit-refresh-recommendation-stats', 'orderit-clean-recommendation-data');
select cron.schedule('orderit-refresh-recommendation-stats', '*/15 * * * *',
  'select public.refresh_product_stats()');
select cron.schedule('orderit-clean-recommendation-data', '17 3 * * *',
  'select public.cleanup_recommendation_data()');

commit;
