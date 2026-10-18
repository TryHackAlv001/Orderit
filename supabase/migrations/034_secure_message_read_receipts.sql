create or replace function public.mark_messages_read(
  other_user_id uuid,
  order_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $fn_mark_messages_read$
declare
  marked_count integer;
  previous_flag text;
  marked_at timestamptz;
  v_other_user_id uuid;
  v_order_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  v_other_user_id := other_user_id;
  v_order_id := order_id;
  previous_flag := pg_catalog.current_setting('app.mark_messages_read', true);
  marked_at := pg_catalog.now();
  perform pg_catalog.set_config('app.mark_messages_read', 'on', true);

  update public.messages as m
  set is_read = true,
      read_at = coalesce(m.read_at, marked_at)
  where m.sender_id = v_other_user_id
    and m.receiver_id = auth.uid()
    and not m.is_read
    and m.read_at is null
    and (v_order_id is null or m.order_id = v_order_id);

  get diagnostics marked_count = row_count;
  update public.notifications as n
  set is_read = true
  where n.user_id = auth.uid()
    and n.type = 'message'
    and not n.is_read
    and n.link in (
      '/messages?to=' || v_other_user_id::text,
      '/messages?with=' || v_other_user_id::text,
      '/messages?conversation=' || v_other_user_id::text
    );
  perform pg_catalog.set_config(
    'app.mark_messages_read',
    coalesce(previous_flag, ''),
    true
  );
  return marked_count;
end
$fn_mark_messages_read$;

create or replace function public.guard_message_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $fn_guard_message_update$
declare
  mark_function_owner text;
begin
  if row(
    new.id,
    new.sender_id,
    new.receiver_id,
    new.content,
    new.order_id,
    new.product_snapshot,
    new.created_at
  ) is distinct from row(
    old.id,
    old.sender_id,
    old.receiver_id,
    old.content,
    old.order_id,
    old.product_snapshot,
    old.created_at
  ) then
    raise exception using errcode = '42501', message = 'Message content and context are immutable';
  end if;

  if new.product_id is distinct from old.product_id
    and not (
      old.product_id is not null
      and new.product_id is null
      and pg_catalog.pg_trigger_depth() > 1
    ) then
    raise exception using errcode = '42501', message = 'Product context is immutable';
  end if;

  select pg_catalog.pg_get_userbyid(p.proowner)
  into mark_function_owner
  from pg_catalog.pg_proc as p
  where p.oid = pg_catalog.to_regprocedure('public.mark_messages_read(uuid,uuid)');

  if new.read_at is distinct from old.read_at
    and not (
      old.read_at is null
      and new.read_at is not null
      and new.is_read
      and pg_catalog.current_setting('app.mark_messages_read', true) = 'on'
      and current_user = mark_function_owner
    ) then
    raise exception using errcode = '42501', message = 'Read time can only be set by the recipient read function';
  end if;

  if new.read_at is not null and not new.is_read then
    raise exception using errcode = '23514', message = 'A read time requires a read message';
  end if;

  if new.is_read is distinct from old.is_read then
    if old.is_read
      or not new.is_read
      or new.read_at is null
      or pg_catalog.current_setting('app.mark_messages_read', true) is distinct from 'on'
      or current_user is distinct from mark_function_owner then
      raise exception using errcode = '42501', message = 'Read status can only be changed by the recipient read function';
    end if;
  end if;

  return new;
end
$fn_guard_message_update$;

-- Activate this guard only with migration 037, after the client cutover.
comment on column public.messages.read_at is
  'Set by mark_messages_read; preserve legacy nulls. Future receipt privacy must be enforced in the database, not only the UI.';

revoke all on function public.mark_messages_read(uuid, uuid) from public, anon;
grant execute on function public.mark_messages_read(uuid, uuid) to authenticated;
