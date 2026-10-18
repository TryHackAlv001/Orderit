alter table public.messages
  add column if not exists product_id uuid,
  add column if not exists product_snapshot jsonb;

do $message_context$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_product_id_fkey'
  ) then
    alter table public.messages
      add constraint messages_product_id_fkey
      foreign key (product_id)
      references public.products(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_product_snapshot_shape_check'
  ) then
    alter table public.messages
      add constraint messages_product_snapshot_shape_check
      check (
        product_snapshot is null
        or (
          pg_catalog.jsonb_typeof(product_snapshot) = 'object'
          and product_snapshot ?& array[
            'product_id', 'name', 'image_url', 'price_kobo', 'captured_at'
          ]
          and product_snapshot - array[
            'product_id', 'name', 'image_url', 'price_kobo', 'captured_at'
          ] = '{}'::jsonb
          and product_snapshot->>'product_id' ~
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          and pg_catalog.jsonb_typeof(product_snapshot->'name') = 'string'
          and product_snapshot->>'name' = pg_catalog.btrim(product_snapshot->>'name')
          and pg_catalog.char_length(product_snapshot->>'name') <= 120
          and pg_catalog.jsonb_typeof(product_snapshot->'image_url') in ('string', 'null')
          and pg_catalog.char_length(coalesce(product_snapshot->>'image_url', '')) <= 900
          and pg_catalog.jsonb_typeof(product_snapshot->'price_kobo') = 'number'
          and product_snapshot->>'price_kobo' ~ '^[0-9]+$'
          and pg_catalog.jsonb_typeof(product_snapshot->'captured_at') = 'string'
          and pg_catalog.octet_length(product_snapshot::text) <= 1024
          and (
            product_id is null
            or product_snapshot->>'product_id' = product_id::text
          )
        )
      );
  end if;
end
$message_context$;

create index if not exists idx_messages_product_id
  on public.messages (product_id);
