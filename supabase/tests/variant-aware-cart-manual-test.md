# Variant-aware cart manual test

Run against a disposable/staging project after applying
`014_variant_aware_cart.sql` and the preceding migrations. Prepare:

- A customer account and a vendor account.
- Five in-stock products with no options.
- A product with exactly one in-stock variant.
- A product with at least two in-stock variants, plus one out-of-stock variant.
- Products owned by the signed-in vendor and by a second vendor.

## Card adds and feedback

1. From home, search, marketplace, and a category listing, add five different
   products within ten seconds. Expected: every line appears in the cart
   without a popup; each add responds immediately; the cart badges pulse and
   the replaceable toast offers “View cart”.
2. Tap the same product card three times, waiting at least 300 ms between
   taps. Expected: one cart line with quantity 3.
3. Tap a card for a product with one active variant. Expected: its only
   variant is added as a resolved line.
4. Tap a card for a product with multiple active variants. Expected: one
   unresolved line, quantity 1, with no silently selected variant. Tapping it
   again increments that same line.
5. Repeat as a signed-out user, then sign in. Expected: local lines, including
   unresolved lines, merge into the account cart without losing quantities.

## Cart selection and checkout

1. Open the cart with unresolved items. Expected: the highlighted notice
   reports the unresolved quantity and scrolls to the first affected line;
   unresolved rows show “Select options”, a “From ₦…” price, and disable
   out-of-stock or insufficient-stock options.
2. Select an available option. Expected: the line becomes resolved with the
   selected size/color; if that product/variant is already present, quantities
   merge into one line. Try changing a resolved line's option as well.
3. While any line is unresolved, use the cart checkout action and visit
   `/checkout` directly. Expected: the cart action scrolls to the first
   unresolved line, and checkout cannot be submitted.
4. Bypass the UI and POST an unresolved multi-variant line to `/api/orders`
   while signed in (use valid delivery fields and a real product ID):

   ```js
   await fetch("/api/orders", {
     method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
       items: [{ productId: "<MULTI_VARIANT_PRODUCT_ID>", quantity: 1 }],
       deliveryAddress: "Test address",
       customerName: "Test Customer",
       email: "customer@example.test"
     })
   }).then(async (response) => ({
     status: response.status,
     body: await response.json()
   }));
   ```

   Expected: HTTP 400 with a message to choose size/color options; no order
   or order item is created.
5. Select options, accept any changed product price, and place an order.
   Expected: checkout revalidates current price and stock; each order item has
   its exact `variant_id`, and reservation failure cancels the unpaid order
   using the existing cancellation flow.
6. Change a product price or deplete/delete a chosen variant after adding it.
   Expected: the cart reports the price change or requires re-selection; the
   order API rejects stale price/stock rather than creating an order.
7. Add resolved products from two vendors and continue to payment options.
   Expected: each seller is shown separately with its own total and payment
   actions. Choosing a payment action creates an order for that seller only.
   After payment, only that seller's products are removed from the local and
   account carts; other seller items remain available for checkout.

## Vendor self-purchase

1. As a signed-in vendor, add your own product from a card. Expected: the
   card shows the edit action instead of a cart button. A direct call to the
   `add_cart_item` RPC for your product must fail with
   `You can't purchase your own products.`
2. POST your own product to `/api/orders` directly. Expected: HTTP 403 with
   `You can't purchase your own products.` and no order created.
3. Add another vendor's product as that vendor, and add any product as a
   customer. Expected: both are allowed. Signed-out users can add products
   locally.
