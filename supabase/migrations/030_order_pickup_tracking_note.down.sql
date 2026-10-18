begin;

do $assert_order_workflow_helpers$
begin
  if to_regprocedure('public._advance_order_status_impl(uuid,text,jsonb)') is null then
    raise exception 'Apply 021_enforce_order_state_updates.sql before this rollback';
  end if;
end
$assert_order_workflow_helpers$;

create or replace function public.advance_order_status(
  order_id uuid,
  to_status text,
  details jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $body$
declare
  order_row public.orders%rowtype;
  detail_values jsonb := coalesce(details, '{}'::jsonb);
  previous_write_context text := current_setting('app.order_write_context', true);
begin
  if to_status not in ('confirmed', 'cancelled') then
    perform set_config('app.order_write_context', 'advance_order_status', true);
    perform public._advance_order_status_impl(order_id, to_status, details);
    perform set_config(
      'app.order_write_context',
      coalesce(previous_write_context, ''),
      true
    );
    return;
  end if;

  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if jsonb_typeof(detail_values) <> 'object' then
    raise exception 'Order status details must be a JSON object'
      using errcode = '22023';
  end if;

  select o.* into order_row
  from public.orders as o
  where o.id = order_id
  for update;

  if not found then
    raise exception 'Order not found'
      using errcode = 'P0002';
  end if;

  if order_row.vendor_id is distinct from auth.uid() then
    raise exception 'Only the order vendor may advance its status'
      using errcode = '42501';
  end if;

  if order_row.status = 'pending' and to_status = 'confirmed' then
    if detail_values <> '{}'::jsonb then
      raise exception 'Order confirmation does not accept details'
        using errcode = '22023';
    end if;

    if order_row.payment_status is distinct from 'paid' then
      raise exception 'An order must be paid before it can be confirmed'
        using errcode = '42501';
    end if;

    perform set_config('app.order_write_context', 'advance_order_status', true);
    update public.orders as o
    set status = 'confirmed'
    where o.id = order_id;
  elsif to_status = 'cancelled'
        and order_row.status in ('pending', 'confirmed', 'preparing') then
    if detail_values - array['cancellation_reason'] <> '{}'::jsonb then
      raise exception 'Unsupported order status detail'
        using errcode = '22023';
    end if;

    if nullif(btrim(detail_values ->> 'cancellation_reason'), '') is null then
      raise exception 'A cancellation reason is required'
        using errcode = '22023';
    end if;

    perform set_config('app.order_write_context', 'advance_order_status', true);
    update public.orders as o
    set status = 'cancelled',
        cancellation_reason = nullif(btrim(detail_values ->> 'cancellation_reason'), '')
    where o.id = order_id;
  else
    raise exception 'Invalid vendor order status transition from % to %',
      order_row.status, to_status
      using errcode = '42501';
  end if;

  perform set_config(
    'app.order_write_context',
    coalesce(previous_write_context, ''),
    true
  );
end;
$body$;

revoke all on function public.advance_order_status(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.advance_order_status(uuid, text, jsonb)
  to authenticated;

commit;
