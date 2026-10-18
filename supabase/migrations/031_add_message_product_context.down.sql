drop index if exists public.idx_messages_product_id;

alter table public.messages
  drop constraint if exists messages_product_snapshot_shape_check,
  drop constraint if exists messages_product_id_fkey,
  drop column if exists product_snapshot,
  drop column if exists product_id;
