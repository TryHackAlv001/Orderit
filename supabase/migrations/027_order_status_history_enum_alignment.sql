begin;

alter type public.fulfillment_status
  add value if not exists 'placed' before 'pending';
alter type public.fulfillment_status
  add value if not exists 'shipped' after 'preparing';

create or replace function public.capture_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  notification_title text;
  notification_body text;
  history_status public.fulfillment_status;
  first_item_id uuid;
  first_product_name text;
  history_note text;
begin
  if tg_op = 'INSERT' then
    history_status := case
      when new.status::text = 'pending' then 'placed'::public.fulfillment_status
      else new.status::text::public.fulfillment_status
    end;

    insert into public.order_status_history(
      order_id, from_status, to_status, note, changed_by, created_at
    ) values (
      new.id, null, history_status, null, auth.uid(), new.created_at
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status::text = 'delivered' and new.delivered_at is null then
      new.delivered_at := now();
    end if;

    history_note := case
      when new.status::text = 'cancelled' then nullif(btrim(new.cancellation_reason), '')
      else nullif(btrim(new.tracking_note), '')
    end;

    insert into public.order_status_history(
      order_id, from_status, to_status, note, changed_by
    ) values (
      new.id,
      old.status::text::public.fulfillment_status,
      new.status::text::public.fulfillment_status,
      history_note,
      auth.uid()
    );

    select oi.id, oi.product_name
      into first_item_id, first_product_name
    from public.order_items oi
    where oi.order_id = new.id
    order by oi.id
    limit 1;

    notification_title := case new.status::text
      when 'confirmed' then 'Confirmed'
      when 'preparing' then 'Packing'
      when 'shipped' then 'Shipped'
      when 'out_for_delivery' then 'Out for delivery'
      when 'delivered' then 'Delivered'
      when 'cancelled' then 'Cancelled'
      else 'Order status updated'
    end;
    notification_body := format(
      '%s%s%s',
      case new.status::text
        when 'confirmed' then 'Your order was confirmed'
        when 'preparing' then 'Your seller is preparing'
        when 'shipped' then 'Your order has shipped'
        when 'out_for_delivery' then 'Your order is out for delivery'
        when 'delivered' then 'Your order was delivered'
        when 'cancelled' then 'Your order was cancelled'
        else 'Your order status has been updated'
      end,
      case
        when first_product_name is null then ' for your order'
        else format(' for %s', first_product_name)
      end,
      case when history_note is null then '.' else format('. Note: %s', history_note) end
    );

    insert into public.notifications(user_id, title, body, type, is_read, link)
    values (
      new.buyer_id,
      notification_title,
      notification_body,
      'order',
      false,
      '/buyer/orders/' || new.id::text || '/track'
        || case when first_item_id is null then '' else '?item=' || first_item_id::text end
    );
  end if;
  return new;
end;
$fn$;

commit;