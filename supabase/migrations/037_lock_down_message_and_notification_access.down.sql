drop trigger if exists messages_guard_update on public.messages;

drop policy if exists "Message participants can view messages" on public.messages;
create policy "Message participants can view messages"
  on public.messages
  for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id or public.is_admin());

create policy "Participants can update own messages"
  on public.messages
  for update
  using (auth.uid() = sender_id or public.is_admin())
  with check (auth.uid() = sender_id or public.is_admin());
create policy "Sender can insert message"
  on public.messages
  for insert
  with check (auth.uid() = sender_id or public.is_admin());
create policy "Admins can manage messages"
  on public.messages
  for delete
  using (public.is_admin());

drop policy if exists "Users can update own notification read state" on public.notifications;
create policy "Users can insert own notifications"
  on public.notifications
  for insert
  with check (auth.uid() = user_id or public.is_admin());
create policy "Users can update own notifications"
  on public.notifications
  for update
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());
create policy "Admins can manage notifications"
  on public.notifications
  for all
  using (public.is_admin());

grant all privileges on table public.messages to anon, authenticated;
grant select (id, sender_id, receiver_id, order_id, content, is_read, created_at),
  insert (id, sender_id, receiver_id, order_id, content, is_read, created_at),
  update (id, sender_id, receiver_id, order_id, content, is_read, created_at),
  references (id, sender_id, receiver_id, order_id, content, is_read, created_at)
  on table public.messages
  to anon, authenticated;

grant all privileges on table public.notifications to anon, authenticated;
grant select (id, user_id, title, body, type, is_read, link, created_at),
  insert (id, user_id, title, body, type, is_read, link, created_at),
  update (id, user_id, title, body, type, is_read, link, created_at),
  references (id, user_id, title, body, type, is_read, link, created_at)
  on table public.notifications
  to anon, authenticated;
