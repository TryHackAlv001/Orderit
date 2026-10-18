-- Removes the send_message overload introduced by migration 035, including its product inquiry rule.
drop function if exists public.send_message(uuid, text, uuid, uuid);
