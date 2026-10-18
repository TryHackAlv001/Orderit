begin;

create or replace function public.capture_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_title text;
  notification_body text;
  history_status text;
  first_item_id uuid;
  first_product_name text;
  history_note text;
  history_status_column text;
begin
  select column_name
    into history_status_column
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'order_status_history'
    and column_name in ('status', 'to_status')
    and is_generated = 'NEVER'
  order by case when column_name = 'status' then 0 else 1 end
  limit 1;

  if history_status_column is null then
    raise exception 'order_status_history must contain a writable status or to_status column';
  end if;

  if tg_op = 'INSERT' then
    history_status := case when new.status = 'pending' then 'placed' else new.status end;
    execute format(
      'insert into public.order_status_history(order_id, %I, note, changed_by, created_at) '
      || 'values ($1, $2, $3, $4, $5)',
      history_status_column
    ) using new.id, history_status, null, auth.uid(), new.created_at;
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'delivered' and new.delivered_at is null then
      new.delivered_at := now();
    end if;

    history_note := case
      when new.status = 'cancelled' then nullif(btrim(new.cancellation_reason), '')
      else nullif(btrim(new.tracking_note), '')
    end;

    execute format(
      'insert into public.order_status_history(order_id, %I, note, changed_by) '
      || 'values ($1, $2, $3, $4)',
      history_status_column
    ) using new.id, new.status, history_note, auth.uid();

    select oi.id, oi.product_name
      into first_item_id, first_product_name
    from public.order_items oi
    where oi.order_id = new.id
    order by oi.id
    limit 1;

    notification_title := case new.status
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
      case new.status
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
$$;

commit;
