# Vendor self-purchase manual test

Run against a disposable/staging project after applying
`013_prevent_vendor_self_purchase.sql`. Prepare:

- Vendor A and an active, non-sized product owned by Vendor A.
- Vendor B and an active, non-sized product owned by Vendor B.
- A buyer account.
- The `vendor_profiles.id` for each product owner (the cart table's `vendor_id`).

## Database cart trigger

Run each case in a separate transaction. Replace the UUID placeholders. The
authenticated role and claim simulate the corresponding Supabase user.

1. Vendor A inserts Vendor A's product:

   ```sql
   begin;
   set local role authenticated;
   select set_config('request.jwt.claim.sub', '<VENDOR_A_USER_ID>', true);
   insert into public.cart_items (user_id, product_id, vendor_id, quantity)
   values ('<VENDOR_A_USER_ID>', '<VENDOR_A_PRODUCT_ID>', '<VENDOR_A_PROFILE_ID>', 1);
   rollback;
   ```

   Expected: rejected with `You can't purchase your own products.`

2. Vendor A inserts Vendor B's product, and then the buyer inserts either
   product, using the appropriate `user_id`, product ID, and vendor profile ID.
   Expected: both inserts succeed. Roll each transaction back.

## UI and local cart

1. Sign in as Vendor A and open cards for Vendor A's product on home, search,
   marketplace, and category listings. Each card must show the pencil edit
   action instead of the cart button, with the “Edit your product” tooltip.
   The product must remain visible in search and the marketplace.
2. Open Vendor A's product page. Add to cart and any Buy now action must be
   absent; “This is your listing” and the “Edit product” action must be
   visible. Wishlist and share remain available.
3. If Vendor A has a stale own-product entry in persisted local cart storage,
   open Cart or Checkout. The own listing should be removed from the displayed
   and persisted cart.
4. Add Vendor B's product as Vendor A, then add either vendor's product as the
   buyer. Expected: both are allowed.

## Direct order API

While signed in as Vendor A, run this in the browser console on the app origin
(replace the product ID and valid delivery details). This bypasses the UI but
uses the signed-in session cookie:

```js
await fetch("/api/orders", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    items: [{ productId: "<VENDOR_A_PRODUCT_ID>", quantity: 1 }],
    deliveryAddress: "Test address",
    customerName: "Test Vendor",
    email: "vendor-a@example.test"
  })
}).then(async (response) => ({ status: response.status, body: await response.json() }));
```

Expected: HTTP 403 and `{ error: "You can't purchase your own products." }`,
with no order created. Repeat with Vendor B's product as Vendor A and with
either product as the buyer; those requests should pass validation and return
HTTP 201. Use disposable products/accounts because successful requests create
orders and reserve/decrement inventory.
