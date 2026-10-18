drop function if exists public.mark_messages_read(uuid, uuid);
drop function if exists public.guard_message_update();
-- The read_at column is managed separately by migration 033.
