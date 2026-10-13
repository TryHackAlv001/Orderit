begin;

select cron.unschedule(jobid)
from cron.job
where jobname = 'orderit-clean-recommendation-data';

drop function if exists public.cleanup_recommendation_data();
drop table if exists public.product_events;
drop table if exists public.user_interests;

commit;
