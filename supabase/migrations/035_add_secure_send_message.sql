-- Clients call this function with their authenticated Supabase session.
create or replace function public.send_message(
  receiver_id uuid,
  content text,
  order_id uuid default null,
  product_id uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $fn_send_message$
declare
  sender_user_id uuid;
  sender_role text;
  target_user_id uuid;
  supplied_order_id uuid;
  supplied_product_id uuid;
  raw_content text;
  clean_content text;
  recent_message_count integer;
  new_conversation_count integer;
  sender_name text;
  product_row public.products%rowtype;
  product_context jsonb;
  new_message public.messages%rowtype;
begin
  target_user_id := receiver_id;
  supplied_order_id := order_id;
  supplied_product_id := product_id;
  raw_content := content;
  sender_user_id := auth.uid();
  if sender_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if target_user_id is null or target_user_id = sender_user_id then
    raise exception using errcode = '22023', message = 'A different recipient is required';
  end if;

  clean_content := pg_catalog.btrim(raw_content);
  if clean_content is null or clean_content = '' then
    raise exception using errcode = '22023', message = 'Message cannot be empty';
  end if;
  if pg_catalog.char_length(clean_content) > 2000 then
    raise exception using errcode = '22023', message = 'Message exceeds 2000 characters';
  end if;

  select u.role
  into sender_role
  from public.users as u
  where u.id = sender_user_id;
  if sender_role is null then
    raise exception using errcode = '28000', message = 'Sender profile not found';
  end if;

  if supplied_order_id is not null then
    if not exists (
      select 1
      from public.orders as o
      where o.id = supplied_order_id
        and (
          (o.buyer_id = sender_user_id and o.vendor_id = target_user_id)
          or (o.vendor_id = sender_user_id and o.buyer_id = target_user_id)
        )
    ) then
      raise exception using errcode = '42501', message = 'You are not a participant in this order';
    end if;
  end if;

  if supplied_product_id is not null then
    select p.*
    into product_row
    from public.products as p
    where p.id = supplied_product_id;

    if not found then
      raise exception using errcode = '22023', message = 'Product is unavailable';
    end if;

    if supplied_order_id is not null then
      if not exists (
        select 1
        from public.order_items as oi
        where oi.order_id = supplied_order_id
          and oi.product_id = supplied_product_id
      ) then
        raise exception using errcode = '22023', message = 'Product is not part of this order';
      end if;
    else
      if product_row.vendor_id = sender_user_id
        or product_row.vendor_id <> target_user_id
        or not product_row.is_active
        or not exists (
          select 1
          from public.vendor_profiles as vp
          join public.users as vendor_user on vendor_user.id = vp.user_id
          where vp.user_id = product_row.vendor_id
            and vendor_user.id = target_user_id
            and vendor_user.role = 'vendor'
        ) then
        raise exception using errcode = '42501', message = 'Product inquiries must be sent to its active vendor by someone other than that vendor';
      end if;
    end if;

    if product_row.price is null or product_row.price <= 0 then
      raise exception using errcode = '22023', message = 'Product price is unavailable';
    end if;

    product_context := pg_catalog.jsonb_build_object(
      'product_id', product_row.id::text,
      'name', pg_catalog.left(pg_catalog.btrim(product_row.name), 120),
      'image_url', product_row.images[1],
      'price_kobo', pg_catalog.round(product_row.price * 100)::bigint,
      'captured_at', pg_catalog.clock_timestamp()
    );
    if pg_catalog.octet_length(product_context::text) > 1024 then
      raise exception using errcode = '22023', message = 'Product context is too large';
    end if;
  elsif supplied_order_id is null then
    if not exists (
      select 1
      from public.messages as prior_message
      where prior_message.sender_id = target_user_id
        and prior_message.receiver_id = sender_user_id
    )
      and not exists (
        select 1
        from public.orders as o
        where (o.buyer_id = sender_user_id and o.vendor_id = target_user_id)
           or (o.vendor_id = sender_user_id and o.buyer_id = target_user_id)
      ) then
      raise exception using errcode = '42501', message = 'You can only reply to an existing conversation or message about a shared order';
    end if;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(sender_user_id::text, 0)
  );

  select pg_catalog.count(*)::integer
  into recent_message_count
  from public.messages as m
  where m.sender_id = sender_user_id
    and m.created_at >= pg_catalog.now() - interval '1 minute';
  if recent_message_count >= 20 then
    raise exception using errcode = 'P0001', message = 'Message rate limit exceeded; try again shortly';
  end if;

  if not exists (
    select 1
    from public.messages as m
    where m.sender_id = sender_user_id
      and m.receiver_id = target_user_id
  ) then
    select pg_catalog.count(*)::integer
    into new_conversation_count
    from public.messages as m
    where m.sender_id = sender_user_id
      and m.created_at >= pg_catalog.now() - interval '24 hours'
      and not exists (
        select 1
        from public.messages as earlier
        where earlier.sender_id = sender_user_id
          and earlier.receiver_id = m.receiver_id
          and row(earlier.created_at, earlier.id) < row(m.created_at, m.id)
      );
    if new_conversation_count >= 10 then
      raise exception using errcode = 'P0001', message = 'New conversation limit exceeded; try again tomorrow';
    end if;
  end if;

  insert into public.messages (
    sender_id, receiver_id, content, order_id, product_id, product_snapshot
  ) values (
    sender_user_id,
    target_user_id,
    clean_content,
    supplied_order_id,
    supplied_product_id,
    product_context
  )
  returning * into new_message;

  select pg_catalog.left(
    coalesce(nullif(pg_catalog.btrim(u.full_name), ''), 'A user'),
    80
  )
  into sender_name
  from public.users as u
  where u.id = sender_user_id;

  insert into public.notifications (
    user_id, title, body, type, is_read, link
  ) values (
    target_user_id,
    'New message from ' || sender_name,
    pg_catalog.left(clean_content, 80),
    'message',
    false,
    '/messages?to=' || sender_user_id::text
  );

  return new_message;
end
$fn_send_message$;

revoke all on function public.send_message(uuid, text, uuid, uuid) from public, anon;
grant execute on function public.send_message(uuid, text, uuid, uuid) to authenticated;
