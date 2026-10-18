begin;

do $test_vendor_product_inquiry$
declare
  inquiry_product record;
  sent_message public.messages%rowtype;
begin
  select
    sender.id as sender_id,
    product.vendor_id as receiver_id,
    product.id as product_id
  into inquiry_product
  from public.products as product
  join public.users as vendor on vendor.id = product.vendor_id
  join public.users as sender
    on sender.role = 'vendor'
   and sender.id <> product.vendor_id
  where product.is_active
    and product.price > 0
    and vendor.role = 'vendor'
  limit 1;

  if not found then
    raise exception 'Test requires an active priced product and two vendor users';
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claim.sub',
    inquiry_product.sender_id::text,
    true
  );

  select *
  into sent_message
  from public.send_message(
    inquiry_product.receiver_id,
    '  Vendor-to-vendor product inquiry test  ',
    null,
    inquiry_product.product_id
  );

  if sent_message.sender_id <> inquiry_product.sender_id
    or sent_message.receiver_id <> inquiry_product.receiver_id
    or sent_message.product_id <> inquiry_product.product_id
    or sent_message.order_id is not null
    or sent_message.content <> 'Vendor-to-vendor product inquiry test'
    or sent_message.product_snapshot->>'product_id' <> inquiry_product.product_id::text then
    raise exception 'Vendor-to-vendor product inquiry did not return the expected message';
  end if;
end
$test_vendor_product_inquiry$;

rollback;
