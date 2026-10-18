begin;

create or replace function public.advance_order_status(
  order_id uuid,
  to_status text,
  details jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $advance_order_status_rollback$
declare
  previous_write_context text := current_setting('app.order_write_context', true);
begin
  perform set_config('app.order_write_context', 'advance_order_status', true);
  perform public._advance_order_status_impl(order_id, to_status, details);
  perform set_config(
    'app.order_write_context',
    coalesce(previous_write_context, ''),
    true
  );
end;
$advance_order_status_rollback$;

revoke all on function public.advance_order_status(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.advance_order_status(uuid, text, jsonb)
  to authenticated;

commit;
