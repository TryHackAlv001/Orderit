begin;

select cron.unschedule(jobid)
from cron.job
where jobname = 'orderit-refresh-recommendation-stats';

drop trigger if exists orders_record_recommendation_purchases on public.orders;
drop trigger if exists product_events_capture_interest on public.product_events;

drop function if exists public.recommended_products(uuid, uuid, integer, integer, uuid);
drop function if exists public.record_paid_order_purchases();
drop function if exists public.capture_recommendation_interest();
drop function if exists public.add_recommendation_interest(uuid, uuid, uuid, text, numeric);
drop function if exists public.refresh_product_stats();

create or replace function public.cleanup_recommendation_data()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  delete from public.product_events where created_at < now() - interval '90 days';
  delete from public.user_interests where updated_at < now() - interval '90 days';
end;
$$;

drop table if exists public.recommendation_feed_items;
drop table if exists public.recommendation_feed_sessions;
drop table if exists public.product_stats;

alter table public.users drop column if exists personalization_enabled;

commit;
