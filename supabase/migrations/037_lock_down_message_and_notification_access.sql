-- Apply this last, after the client uses only the definer functions.
drop trigger if exists messages_guard_update on public.messages;
create trigger messages_guard_update
before update on public.messages
for each row
execute function public.guard_message_update();

drop policy if exists "Message participants can view messages" on public.messages;
drop policy if exists "Participants can update own messages" on public.messages;
drop policy if exists "Sender can insert message" on public.messages;
drop policy if exists "Admins can manage messages" on public.messages;

create policy "Message participants can view messages"
  on public.messages
  for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can insert own notifications" on public.notifications;
drop policy if exists "Users can update own notifications" on public.notifications;
drop policy if exists "Admins can manage notifications" on public.notifications;
drop policy if exists "Users can update own notification read state" on public.notifications;

create policy "Users can update own notification read state"
  on public.notifications
  for update
  to authenticated
  using (auth.uid() = user_id and not is_read)
  with check (auth.uid() = user_id and is_read);

revoke all privileges on table public.messages from public, anon, authenticated;
revoke select (id, sender_id, receiver_id, order_id, content, is_read, read_at, created_at, product_id, product_snapshot),
insert (id, sender_id, receiver_id, order_id, content, is_read, read_at, created_at, product_id, product_snapshot),
update (id, sender_id, receiver_id, order_id, content, is_read, read_at, created_at, product_id, product_snapshot),
references (id, sender_id, receiver_id, order_id, content, is_read, read_at, created_at, product_id, product_snapshot)
  on table public.messages
  from public, anon, authenticated;
grant select on table public.messages to authenticated;

revoke all privileges on table public.notifications from public, anon, authenticated;
revoke select (id, user_id, title, body, type, is_read, link, created_at),
  insert (id, user_id, title, body, type, is_read, link, created_at),
  update (id, user_id, title, body, type, is_read, link, created_at),
  references (id, user_id, title, body, type, is_read, link, created_at)
  on table public.notifications
  from public, anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;
