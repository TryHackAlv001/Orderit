create index if not exists idx_messages_sender_receiver_created_at
  on public.messages (sender_id, receiver_id, created_at);

create index if not exists idx_messages_receiver_sender_created_at
  on public.messages (receiver_id, sender_id, created_at);

create index if not exists idx_messages_unread_by_receiver_created_at
  on public.messages (receiver_id, created_at)
  where is_read = false;

create index if not exists idx_notifications_unread_by_user_created_at
  on public.notifications (user_id, created_at)
  where is_read = false;
