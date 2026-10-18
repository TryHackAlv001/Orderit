begin;

do $rename_order_functions$
begin
  if to_regprocedure('public._advance_order_status_impl(uuid,text,jsonb)') is null then
    if to_regprocedure('public.advance_order_status(uuid,text,jsonb)') is null then
      raise exception 'public.advance_order_status(uuid,text,jsonb) is missing';
    end if;

    execute
      'alter function public.advance_order_status(uuid, text, jsonb) '
      || 'rename to _advance_order_status_impl';
  end if;

  if to_regprocedure('public._buyer_confirm_delivery_impl(uuid)') is null then
    if to_regprocedure('public.buyer_confirm_delivery(uuid)') is null then
      raise exception 'public.buyer_confirm_delivery(uuid) is missing';
    end if;

    execute
      'alter function public.buyer_confirm_delivery(uuid) '
      || 'rename to _buyer_confirm_delivery_impl';
  end if;
end
$rename_order_functions$;

create or replace function public.guard_order_payment_state()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $guard_order_payment_state$
declare
  jwt_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  request_role text := coalesce(
    nullif(auth.role(), ''),
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(jwt_claims ->> 'role', ''),
    ''
  );
  write_context text := nullif(current_setting('app.order_write_context', true), '');
  advance_context boolean := false;
  buyer_context boolean := false;
begin
  if request_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Orders must be created by trusted server-side code'
      using errcode = '42501';
  end if;

  advance_context := coalesce(
    write_context = 'advance_order_status'
    and current_user = pg_get_userbyid((
      select p.proowner
      from pg_proc as p
      where p.oid =
        'public._advance_order_status_impl(uuid,text,jsonb)'::regprocedure
    )),
    false
  );
  buyer_context := coalesce(
    write_context = 'buyer_confirm_delivery'
    and current_user = pg_get_userbyid((
      select p.proowner
      from pg_proc as p
      where p.oid =
        'public.buyer_confirm_delivery(uuid)'::regprocedure
    )),
    false
  );

  if new.payment_status is distinct from old.payment_status
     or new.payment_reference is distinct from old.payment_reference
     or new.payment_method is distinct from old.payment_method
     or new.total is distinct from old.total
     or new.paid_at is distinct from old.paid_at then
    raise exception 'Payment and order-total fields may only be changed by the service role'
      using errcode = '42501';
  end if;

  if new.status is distinct from old.status
     and not advance_context
     and not buyer_context then
    raise exception 'Order status may only be changed by a trusted order workflow'
      using errcode = '42501';
  end if;

  if new.courier_name is distinct from old.courier_name
     or new.tracking_number is distinct from old.tracking_number
     or new.tracking_url is distinct from old.tracking_url
     or new.rider_name is distinct from old.rider_name
     or new.rider_phone is distinct from old.rider_phone
     or new.estimated_delivery_at is distinct from old.estimated_delivery_at
     or new.shipped_at is distinct from old.shipped_at
     or new.cancellation_reason is distinct from old.cancellation_reason
     or new.tracking_note is distinct from old.tracking_note then
    if not advance_context then
      raise exception 'Order tracking fields may only be changed by a trusted fulfillment workflow'
        using errcode = '42501';
    end if;
  end if;

  if new.delivered_at is distinct from old.delivered_at
     and not advance_context
     and not buyer_context then
    raise exception 'Delivery timestamps may only be changed by a trusted order workflow'
      using errcode = '42501';
  end if;

  if (new.delivery_confirmed_by is distinct from old.delivery_confirmed_by
      or new.delivery_confirmed_at is distinct from old.delivery_confirmed_at)
     and not buyer_context then
    raise exception 'Delivery confirmation fields may only be changed by the buyer confirmation workflow'
      using errcode = '42501';
  end if;

  return new;
end;
$guard_order_payment_state$;

create or replace function public.advance_order_status(
  order_id uuid,
  to_status text,
  details jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $advance_order_status$
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
$advance_order_status$;

create or replace function public.buyer_confirm_delivery(order_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $buyer_confirm_delivery$
declare
  order_row public.orders%rowtype;
  confirmed_at timestamptz := now();
  previous_write_context text := current_setting('app.order_write_context', true);
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

  perform set_config('app.order_write_context', 'buyer_confirm_delivery', true);

  update public.orders as o
  set status = 'delivered',
      delivered_at = coalesce(o.delivered_at, confirmed_at),
      delivery_confirmed_by = auth.uid(),
      delivery_confirmed_at = confirmed_at
  where o.id = order_id;

  perform set_config(
    'app.order_write_context',
    coalesce(previous_write_context, ''),
    true
  );
end;
$buyer_confirm_delivery$;

revoke all on function public._advance_order_status_impl(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public._buyer_confirm_delivery_impl(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.advance_order_status(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.buyer_confirm_delivery(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.advance_order_status(uuid, text, jsonb)
  to authenticated;
grant execute on function public.buyer_confirm_delivery(uuid)
  to authenticated;

revoke update (status, tracking_note) on public.orders from authenticated;

drop policy if exists "Buyer can update own orders" on public.orders;
drop policy if exists "Admins can manage orders" on public.orders;
drop policy if exists "Admins can insert orders" on public.orders;
drop policy if exists "Admins can delete orders" on public.orders;

create policy "Admins can insert orders"
  on public.orders for insert
  with check (public.is_admin());
create policy "Admins can delete orders"
  on public.orders for delete
  using (public.is_admin());

do $ensure_payment_lockdown_trigger$
begin
  if not exists (
    select 1
    from pg_trigger as t
    where t.tgrelid = 'public.orders'::regclass
      and t.tgname = 'orders_guard_payment_state'
      and not t.tgisinternal
  ) then
    create trigger orders_guard_payment_state
      before insert or update on public.orders
      for each row execute function public.guard_order_payment_state();
  end if;
end
$ensure_payment_lockdown_trigger$;

commit;
