begin;

alter table public.orders
  add column delivered_at timestamptz,
  add column tracking_note text;

update public.orders
set delivered_at = created_at
where status = 'delivered' and delivered_at is null;

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check check (
    status in ('pending', 'confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled')
  );

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null check (status in (
    'placed', 'pending', 'confirmed', 'preparing', 'shipped',
    'out_for_delivery', 'delivered', 'cancelled'
  )),
  note text,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_order_status_history_order_created
  on public.order_status_history(order_id, created_at);
alter table public.order_status_history enable row level security;

create policy "Order participants can view status history"
  on public.order_status_history for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.buyer_id = auth.uid()
          or o.vendor_id = auth.uid()
          or public.is_admin()
          or exists (
            select 1
            from public.order_items oi
            join public.products p on p.id = oi.product_id
            where oi.order_id = o.id and p.vendor_id = auth.uid()
          )
        )
    )
  );

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
begin
  if tg_op = 'INSERT' then
    history_status := case when new.status = 'pending' then 'placed' else new.status end;
    insert into public.order_status_history(order_id, status, note, changed_by, created_at)
    values (new.id, history_status, null, auth.uid(), new.created_at);
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'delivered' and new.delivered_at is null then
      new.delivered_at := now();
    end if;

    insert into public.order_status_history(order_id, status, note, changed_by)
    values (new.id, new.status, nullif(btrim(new.tracking_note), ''), auth.uid());

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
      '%s.%s',
      case new.status
        when 'confirmed' then 'Your order is confirmed'
        when 'preparing' then 'Your seller is packing your order'
        when 'shipped' then 'Your order has shipped'
        when 'out_for_delivery' then 'Your order is out for delivery'
        when 'delivered' then 'Your order was delivered'
        when 'cancelled' then 'Your order was cancelled'
        else 'Your order status has been updated'
      end,
      case when nullif(btrim(new.tracking_note), '') is null
        then '' else ' Note: ' || btrim(new.tracking_note) end
    );

    insert into public.notifications(user_id, title, body, type, is_read, link)
    values (
      new.buyer_id,
      notification_title,
      notification_body,
      'order',
      false,
      '/buyer/orders/' || new.id::text
    );
  end if;
  return new;
end;
$$;

create trigger orders_capture_initial_status
  after insert on public.orders
  for each row execute function public.capture_order_status_change();
create trigger orders_capture_status_updates
  before update of status on public.orders
  for each row execute function public.capture_order_status_change();

insert into public.order_status_history(order_id, status, note, changed_by, created_at)
select o.id,
       case when o.status = 'pending' then 'placed' else o.status end,
       null,
       null,
       o.created_at
from public.orders o
where not exists (
  select 1 from public.order_status_history h where h.order_id = o.id
);

create table public.return_policy_settings (
  singleton boolean primary key default true check (singleton),
  return_window_days integer not null default 14 check (return_window_days between 0 and 365),
  updated_at timestamptz not null default now()
);

insert into public.return_policy_settings(singleton, return_window_days)
values (true, 14);

alter table public.return_policy_settings enable row level security;
create policy "Anyone can read return policy"
  on public.return_policy_settings for select using (true);
create policy "Admins can configure return policy"
  on public.return_policy_settings for all using (public.is_admin())
  with check (public.is_admin());

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  buyer_id uuid not null references public.users(id) on delete cascade,
  vendor_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'requested' check (status in (
    'requested', 'approved', 'rejected', 'pickup_scheduled',
    'picked_up', 'received_by_vendor', 'refunded'
  )),
  reason text not null check (reason in (
    'damaged', 'not_as_described', 'wrong_item', 'missing_parts', 'changed_mind', 'other'
  )),
  note text check (note is null or length(note) <= 2000),
  tracking_note text check (tracking_note is null or length(tracking_note) <= 2000),
  photo_url text,
  refund_amount numeric(12,2) not null default 0 check (refund_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.return_request_items (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unique (return_request_id, order_item_id)
);

create table public.return_status_history (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  status text not null check (status in (
    'requested', 'approved', 'rejected', 'pickup_scheduled',
    'picked_up', 'received_by_vendor', 'refunded'
  )),
  note text,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_return_requests_buyer_created on public.return_requests(buyer_id, created_at desc);
create index idx_return_requests_vendor_status on public.return_requests(vendor_id, status);
create index idx_return_requests_order on public.return_requests(order_id);
create index idx_return_request_items_request on public.return_request_items(return_request_id);
create index idx_return_status_history_request_created
  on public.return_status_history(return_request_id, created_at);

alter table public.return_requests enable row level security;
alter table public.return_request_items enable row level security;
alter table public.return_status_history enable row level security;

create policy "Buyers and vendors can view related returns"
  on public.return_requests for select using (
    buyer_id = auth.uid()
    or vendor_id = auth.uid()
    or public.is_admin()
  );
create policy "Vendors and admins can update related returns"
  on public.return_requests for update using (
    vendor_id = auth.uid()
    or public.is_admin()
  ) with check (
    vendor_id = auth.uid()
    or public.is_admin()
  );

create policy "Participants can view return items"
  on public.return_request_items for select using (
    exists (
      select 1 from public.return_requests r
      where r.id = return_request_id
        and (r.buyer_id = auth.uid() or r.vendor_id = auth.uid() or public.is_admin())
    )
    or exists (
      select 1
      from public.order_items oi
      join public.products p on p.id = oi.product_id
      where oi.id = order_item_id and p.vendor_id = auth.uid()
    )
  );
create policy "Participants can view return status history"
  on public.return_status_history for select using (
    exists (
      select 1 from public.return_requests r
      where r.id = return_request_id
        and (r.buyer_id = auth.uid() or r.vendor_id = auth.uid() or public.is_admin())
    )
  );

create or replace function public.capture_return_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  buyer_id uuid;
  vendor_id uuid;
  order_id uuid;
  notification_title text;
  recipient uuid;
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.return_status_history(return_request_id, status, note, changed_by)
    values (new.id, new.status, nullif(btrim(new.tracking_note), ''), auth.uid());

    update public.return_requests set updated_at = now() where id = new.id;
    select r.buyer_id, r.vendor_id, r.order_id
      into buyer_id, vendor_id, order_id
      from public.return_requests r where r.id = new.id;

    notification_title := case new.status
      when 'requested' then 'Return requested'
      when 'approved' then 'Return approved'
      when 'rejected' then 'Return rejected'
      when 'pickup_scheduled' then 'Return pickup scheduled'
      when 'picked_up' then 'Return picked up'
      when 'received_by_vendor' then 'Return received'
      when 'refunded' then 'Return refunded'
      else 'Return updated'
    end;
    recipient := case when new.status = 'requested' then vendor_id else buyer_id end;
    insert into public.notifications(user_id, title, body, type, is_read, link)
    values (
      recipient,
      notification_title,
      format('Return request %s is now %s.', left(new.id::text, 8), replace(new.status, '_', ' ')),
      'return',
      false,
      case when new.status = 'requested'
        then '/vendor/returns'
        else '/buyer/orders/' || order_id::text
      end
    );
  end if;
  return new;
end;
$$;

create or replace function public.enforce_return_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  transition_allowed boolean := false;
begin
  if new.order_id is distinct from old.order_id
      or new.buyer_id is distinct from old.buyer_id
      or new.vendor_id is distinct from old.vendor_id
      or new.reason is distinct from old.reason
      or new.refund_amount is distinct from old.refund_amount
      or new.note is distinct from old.note
      or new.photo_url is distinct from old.photo_url then
    raise exception 'Return request details cannot be changed after submission';
  end if;

  if new.status is distinct from old.status then
    transition_allowed := case old.status
      when 'requested' then new.status in ('approved', 'rejected')
      when 'approved' then new.status = 'pickup_scheduled'
      when 'pickup_scheduled' then new.status = 'picked_up'
      when 'picked_up' then new.status = 'received_by_vendor'
      when 'received_by_vendor' then new.status = 'refunded'
      else false
    end;
    if not transition_allowed then
      raise exception 'Invalid return status transition from % to %', old.status, new.status;
    end if;
    if new.status = 'refunded' and not exists (
      select 1 from public.wallet_transactions wt where wt.return_request_id = new.id
    ) then
      raise exception 'A wallet refund must be recorded before closing the return';
    end if;
  end if;
  return new;
end;
$$;

create trigger return_requests_enforce_lifecycle
  before update on public.return_requests
  for each row execute function public.enforce_return_lifecycle();

create trigger return_requests_capture_status
  after insert or update of status on public.return_requests
  for each row execute function public.capture_return_status_change();

create or replace function public.create_return_request(
  p_order_id uuid,
  p_order_item_ids uuid[],
  p_reason text,
  p_note text,
  p_photo_url text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  allowed_window integer;
  new_return_id uuid;
  amount numeric(12,2);
  matched_items integer;
begin
  if auth.uid() is null or not public.is_buyer() then
    raise exception 'Only buyers can request returns';
  end if;
  if p_order_item_ids is null or cardinality(p_order_item_ids) = 0 then
    raise exception 'Select at least one item';
  end if;
  if p_reason not in ('damaged', 'not_as_described', 'wrong_item', 'missing_parts', 'changed_mind', 'other') then
    raise exception 'Choose a valid return reason';
  end if;

  select * into order_row
  from public.orders
  where id = p_order_id and buyer_id = auth.uid();
  if not found or order_row.status <> 'delivered' then
    raise exception 'Only delivered orders can be returned';
  end if;

  select return_window_days into allowed_window
  from public.return_policy_settings where singleton = true;
  if now() > coalesce(order_row.delivered_at, order_row.created_at)
      + make_interval(days => coalesce(allowed_window, 14)) then
    raise exception 'The return window has expired';
  end if;

  perform 1
  from public.order_items oi
  where oi.order_id = p_order_id and oi.id = any(p_order_item_ids)
  order by oi.id
  for update;

  select count(*), coalesce(sum(oi.quantity * oi.price_at_purchase), 0)
    into matched_items, amount
  from public.order_items oi
  where oi.order_id = p_order_id and oi.id = any(p_order_item_ids);
  if matched_items <> cardinality(p_order_item_ids) then
    raise exception 'One or more selected items do not belong to this order';
  end if;

  if exists (
    select 1
    from public.return_request_items ri
    join public.return_requests r on r.id = ri.return_request_id
    where ri.order_item_id = any(p_order_item_ids)
      and r.status <> 'rejected'
  ) then
    raise exception 'An item already has an active return request';
  end if;

  insert into public.return_requests(
    order_id, buyer_id, vendor_id, status, reason, note, photo_url, refund_amount
  ) values (
    p_order_id, auth.uid(), order_row.vendor_id, 'requested',
    p_reason, nullif(btrim(p_note), ''), p_photo_url, amount
  ) returning id into new_return_id;

  insert into public.return_request_items(return_request_id, order_item_id, quantity)
  select new_return_id, oi.id, oi.quantity
  from public.order_items oi
  where oi.order_id = p_order_id and oi.id = any(p_order_item_ids);

  return new_return_id;
end;
$$;

revoke all on function public.create_return_request(uuid, uuid[], text, text, text) from public;
grant execute on function public.create_return_request(uuid, uuid[], text, text, text) to authenticated;

create table public.wallet_accounts (
  user_id uuid primary key references public.users(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  return_request_id uuid not null unique references public.return_requests(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  created_at timestamptz not null default now()
);

create index idx_wallet_transactions_user_created
  on public.wallet_transactions(user_id, created_at desc);
alter table public.wallet_accounts enable row level security;
alter table public.wallet_transactions enable row level security;
create policy "Users can view own wallet account"
  on public.wallet_accounts for select using (user_id = auth.uid() or public.is_admin());
create policy "Users can view own wallet transactions"
  on public.wallet_transactions for select using (user_id = auth.uid() or public.is_admin());

create or replace function public.process_return_refund(p_return_request_id uuid, p_note text)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  return_row public.return_requests%rowtype;
  inserted_transaction uuid;
  current_balance numeric(12,2);
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into return_row
  from public.return_requests r
  where r.id = p_return_request_id
    and (
      public.is_admin()
      or r.vendor_id = auth.uid()
      or exists (
        select 1
        from public.return_request_items ri
        join public.order_items oi on oi.id = ri.order_item_id
        join public.products p on p.id = oi.product_id
        where ri.return_request_id = r.id and p.vendor_id = auth.uid()
      )
    )
  for update;
  if not found then
    raise exception 'Return request not found or access denied';
  end if;

  if return_row.status = 'refunded' then
    select balance into current_balance
    from public.wallet_accounts where user_id = return_row.buyer_id;
    return coalesce(current_balance, 0);
  end if;
  if return_row.status <> 'received_by_vendor' then
    raise exception 'The return must be received by the vendor before refund';
  end if;
  if return_row.refund_amount <= 0 then
    raise exception 'Refund amount must be positive';
  end if;

  insert into public.wallet_accounts(user_id) values (return_row.buyer_id)
  on conflict (user_id) do nothing;

  insert into public.wallet_transactions(user_id, return_request_id, amount, description)
  values (
    return_row.buyer_id,
    return_row.id,
    return_row.refund_amount,
    'Refund for order ' || left(return_row.order_id::text, 8)
  )
  on conflict (return_request_id) do nothing
  returning id into inserted_transaction;

  if inserted_transaction is not null then
    update public.wallet_accounts
    set balance = balance + return_row.refund_amount, updated_at = now()
    where user_id = return_row.buyer_id;
  end if;

  update public.return_requests
  set status = 'refunded', tracking_note = nullif(btrim(p_note), ''), updated_at = now()
  where id = return_row.id;

  select balance into current_balance
  from public.wallet_accounts where user_id = return_row.buyer_id;
  return current_balance;
end;
$$;

revoke all on function public.process_return_refund(uuid, text) from public;
grant execute on function public.process_return_refund(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_status_history'
  ) then
    alter publication supabase_realtime add table public.order_status_history;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'return_status_history'
  ) then
    alter publication supabase_realtime add table public.return_status_history;
  end if;
end
$$;

commit;
