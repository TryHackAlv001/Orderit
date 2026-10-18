alter table public.messages
  drop constraint if exists messages_read_at_requires_read_check,
  drop column if exists read_at;
