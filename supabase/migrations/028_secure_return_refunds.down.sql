begin;

create or replace function public.process_return_refund(
  p_return_request_id uuid,
  p_note text
)
returns numeric
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $fn$
begin
  raise exception 'Refund processing is disabled by rollback; restore a reviewed implementation before re-enabling it'
    using errcode = '55000';
end;
$fn$;

revoke all on function public.process_return_refund(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.process_return_refund(uuid, text)
  to service_role;

revoke all on function public.ensure_order_fulfillment_for_vendor(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.link_order_items_to_fulfillment(uuid)
  from public, anon, authenticated;
revoke all on function public.order_overall_status(uuid)
  from public, anon, authenticated;

commit;