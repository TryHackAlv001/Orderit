alter table public.messages
  add column if not exists read_at timestamptz;

do $message_read_at$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_read_at_requires_read_check'
  ) then
    alter table public.messages
      add constraint messages_read_at_requires_read_check
      check (read_at is null or is_read);
  end if;
end
$message_read_at$;

comment on column public.messages.read_at is
  'Set only by mark_messages_read; do not backfill legacy read rows with guessed timestamps.';
