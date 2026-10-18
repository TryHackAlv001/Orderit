begin;

do $assert_order_workflow_helpers$
begin
  if to_regprocedure('public._advance_order_status_impl(uuid,text,jsonb)') is null then
    raise exception 'Apply 021_enforce_order_state_updates.sql before this migration';
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
as $fn$
declare
  order_row public.orders%rowtype;
  detail_values jsonb := coalesce(details, '{}'::jsonb);
  previous_write_context text := current_setting('app.order_write_context', true);
  pickup_note text;
  pickup_estimate timestamptz;
begin
  if to_status = 'out_for_delivery' and detail_values ? 'tracking_note' then
    if auth.uid() is null then
      raise exception 'Authentication is required'
        using errcode = '42501';
    end if;

    if jsonb_typeof(detail_values) <> 'object' then
      raise exception 'Order status details must be a JSON object'
        using errcode = '22023';
    end if;

    if detail_values - array[
         'courier_name',
         'tracking_number',
         'tracking_url',
         'rider_name',
         'rider_phone',
         'estimated_delivery_at',
         'tracking_note'
       ] <> '{}'::jsonb then
      raise exception 'Unsupported order status detail'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_each(detail_values) as entry(key, value)
      where jsonb_typeof(entry.value) <> 'string'
    ) then
      raise exception 'Order status details must be text values'
        using errcode = '22023';
    end if;

    pickup_note := btrim(detail_values ->> 'tracking_note');
    if pickup_note is null or pickup_note = '' then
      raise exception 'Pickup address or instructions are required'
        using errcode = '22023';
    end if;
    if char_length(pickup_note) > 500 then
      raise exception 'Pickup instructions must be 500 characters or fewer'
        using errcode = '22023';
    end if;

    if nullif(btrim(detail_values ->> 'courier_name'), '') is not null
       or nullif(btrim(detail_values ->> 'tracking_number'), '') is not null
       or nullif(btrim(detail_values ->> 'tracking_url'), '') is not null
       or nullif(btrim(detail_values ->> 'rider_name'), '') is not null
       or nullif(btrim(detail_values ->> 'rider_phone'), '') is not null then
      raise exception 'Pickup orders cannot include courier, rider, or tracking details'
        using errcode = '22023';
    end if;

    pickup_estimate := nullif(btrim(detail_values ->> 'estimated_delivery_at'), '')::timestamptz;
    if pickup_estimate is not null and pickup_estimate < now() then
      raise exception 'Enter a valid estimated delivery date and time in the future'
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

    if order_row.payment_status is distinct from 'paid' then
      raise exception 'An order must be paid before fulfillment'
        using errcode = '42501';
    end if;

    if order_row.status <> 'preparing' then
      raise exception 'Invalid vendor order status transition from % to %',
        order_row.status, to_status
        using errcode = '42501';
    end if;

    perform set_config('app.order_write_context', 'advance_order_status', true);
    update public.orders as o
    set status = 'out_for_delivery',
        courier_name = null,
        tracking_number = null,
        tracking_url = null,
        rider_name = null,
        rider_phone = null,
        estimated_delivery_at = pickup_estimate,
        tracking_note = pickup_note,
        shipped_at = coalesce(o.shipped_at, now())
    where o.id = order_id;

    perform set_config(
      'app.order_write_context',
      coalesce(previous_write_context, ''),
      true
    );
    return;
  end if;

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
$fn$;

commit;
