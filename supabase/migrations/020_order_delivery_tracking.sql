begin;

alter table public.orders
  add column if not exists courier_name text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists rider_name text,
  add column if not exists rider_phone text,
  add column if not exists estimated_delivery_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_confirmed_by uuid,
  add column if not exists delivery_confirmed_at timestamptz,
  add column if not exists cancellation_reason text;

create or replace function public.advance_order_status(
  order_id uuid,
  to_status text,
  details jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $fn$
declare
  order_row public.orders%rowtype;
  detail_values jsonb := coalesce(details, '{}'::jsonb);
  next_courier_name text;
  next_tracking_number text;
  next_tracking_url text;
  next_rider_name text;
  next_rider_phone text;
  next_estimated_delivery_at timestamptz;
  next_cancellation_reason text;
begin
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
       'cancellation_reason'
     ] <> '{}'::jsonb then
    raise exception 'Unsupported order status detail'
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

  if not (
    (order_row.status = 'confirmed' and to_status = 'preparing')
    or (order_row.status = 'preparing' and to_status = 'out_for_delivery')
    or (order_row.status = 'out_for_delivery' and to_status = 'delivered')
    or (
      order_row.status in ('confirmed', 'preparing')
      and to_status = 'cancelled'
    )
  ) then
    raise exception 'Invalid vendor order status transition from % to %',
      order_row.status, to_status
      using errcode = '42501';
  end if;

  if to_status <> 'cancelled' and detail_values ? 'cancellation_reason' then
    raise exception 'Cancellation reason is only accepted when cancelling'
      using errcode = '22023';
  end if;

  next_courier_name := case
    when detail_values ? 'courier_name'
      then nullif(btrim(detail_values ->> 'courier_name'), '')
    else order_row.courier_name
  end;
  next_tracking_number := case
    when detail_values ? 'tracking_number'
      then nullif(btrim(detail_values ->> 'tracking_number'), '')
    else order_row.tracking_number
  end;
  next_tracking_url := case
    when detail_values ? 'tracking_url'
      then nullif(btrim(detail_values ->> 'tracking_url'), '')
    else order_row.tracking_url
  end;
  next_rider_name := case
    when detail_values ? 'rider_name'
      then nullif(btrim(detail_values ->> 'rider_name'), '')
    else order_row.rider_name
  end;
  next_rider_phone := case
    when detail_values ? 'rider_phone'
      then nullif(btrim(detail_values ->> 'rider_phone'), '')
    else order_row.rider_phone
  end;
  next_estimated_delivery_at := case
    when detail_values ? 'estimated_delivery_at'
      then (detail_values ->> 'estimated_delivery_at')::timestamptz
    else order_row.estimated_delivery_at
  end;

  if to_status = 'out_for_delivery'
     and next_courier_name is null
     and (next_rider_name is null or next_rider_phone is null) then
    raise exception 'Out for delivery requires a courier name or both rider name and phone'
      using errcode = '22023';
  end if;

  if to_status = 'cancelled' then
    next_cancellation_reason :=
      nullif(btrim(detail_values ->> 'cancellation_reason'), '');
    if next_cancellation_reason is null then
      raise exception 'A cancellation reason is required'
        using errcode = '22023';
    end if;
  end if;

  update public.orders as o
  set status = to_status,
      courier_name = next_courier_name,
      tracking_number = next_tracking_number,
      tracking_url = next_tracking_url,
      rider_name = next_rider_name,
      rider_phone = next_rider_phone,
      estimated_delivery_at = next_estimated_delivery_at,
      shipped_at = case
        when to_status = 'out_for_delivery' then coalesce(o.shipped_at, now())
        else o.shipped_at
      end,
      delivered_at = case
        when to_status = 'delivered' then coalesce(o.delivered_at, now())
        else o.delivered_at
      end,
      cancellation_reason = case
        when to_status = 'cancelled' then next_cancellation_reason
        else o.cancellation_reason
      end
  where o.id = order_id;
end;
$fn$;

create or replace function public.buyer_confirm_delivery(order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  order_row public.orders%rowtype;
  confirmed_at timestamptz := now();
  previous_jwt_claims text := current_setting('request.jwt.claims', true);
  previous_jwt_role text := current_setting('request.jwt.claim.role', true);
begin
  if auth.uid() is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  select o.* into order_row
  from public.orders as o
  where o.id = order_id
  for update;

  if not found then
    raise exception 'Order not found'
      using errcode = 'P0002';
  end if;

  if order_row.buyer_id is distinct from auth.uid() then
    raise exception 'Only the order buyer may confirm delivery'
      using errcode = '42501';
  end if;

  if order_row.status <> 'out_for_delivery' then
    raise exception 'Only an order out for delivery can be confirmed'
      using errcode = '42501';
  end if;

  perform set_config(
    'request.jwt.claims',
    (
      coalesce(nullif(previous_jwt_claims, ''), '{}')::jsonb
        || '{"role":"service_role"}'::jsonb
    )::text,
    true
  );
  perform set_config('request.jwt.claim.role', 'service_role', true);

  update public.orders as o
  set status = 'delivered',
      delivered_at = coalesce(o.delivered_at, confirmed_at),
      delivery_confirmed_by = auth.uid(),
      delivery_confirmed_at = confirmed_at
  where o.id = order_id;

  perform set_config('request.jwt.claims', coalesce(previous_jwt_claims, ''), true);
  perform set_config('request.jwt.claim.role', coalesce(previous_jwt_role, ''), true);
end;
$body$;

revoke all on function public.advance_order_status(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.advance_order_status(uuid, text, jsonb)
  to authenticated;

revoke all on function public.buyer_confirm_delivery(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.buyer_confirm_delivery(uuid)
  to authenticated;

commit;
