import { NextRequest, NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdminClient } from "@/lib/supabase-admin";
import { getSizeConfig, isValidSize } from "@/constants/sizes";
import { isOwnProduct } from "@/lib/is-own-product";

interface OrderItemPayload {
  productId: string;
  quantity: number;
  variantId?: string | null;
  expectedPrice?: number;
  selectedSize?: string | null;
  selectedColor?: string | null;
}

interface ProductVariantRow {
  id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  stock_quantity: number;
}

class OrderValidationError extends Error {}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const items = body.items as OrderItemPayload[];
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
    const addressId = typeof body.addressId === "string" ? body.addressId.trim() : "";
    const addressConfirmed = body.addressConfirmed === true;
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!items || !Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: "Cart items are required" }, { status: 400 });
    if (!addressConfirmed || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(addressId))
      return NextResponse.json({ error: "Confirm a delivery address before continuing to payment." }, { status: 400 });
    if (!email)
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey))
      return NextResponse.json({ error: "A valid checkout idempotency key is required" }, { status: 400 });

    const supabase = createSupabaseServerClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId)
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { data: user, error: userError } = await supabase
      .from("users").select("role").eq("id", userId).single();
    if (userError || !user || (user.role !== "buyer" && user.role !== "vendor"))
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const { data: selectedAddress, error: addressError } = await supabaseAdminClient
      .from("user_addresses")
      .select("id,user_id,full_name,phone,address_line,city,state,landmark,is_checkout_only")
      .eq("id", addressId)
      .eq("user_id", userId)
      .maybeSingle();
    if (addressError) {
      console.error("Unable to load confirmed checkout address:", addressError.message);
      return NextResponse.json({ error: "Unable to verify the delivery address. Please retry checkout." }, { status: 500 });
    }
    if (!selectedAddress) {
      return NextResponse.json({ error: "The confirmed delivery address is unavailable. Choose an address again." }, { status: 403 });
    }

    const deliveryAddressText = [
      selectedAddress.address_line,
      selectedAddress.landmark,
      selectedAddress.city,
      selectedAddress.state,
    ].filter((part) => typeof part === "string" && part.trim()).join(", ");
    const deliveryAddressSnapshot = {
      address: deliveryAddressText,
      customerName: selectedAddress.full_name,
      full_name: selectedAddress.full_name,
      phone: selectedAddress.phone,
      address_line: selectedAddress.address_line,
      city: selectedAddress.city,
      state: selectedAddress.state,
      landmark: selectedAddress.landmark,
      email: sessionData.session?.user?.email ?? email,
    };
    const removeCheckoutOnlyAddress = async () => {
      if (!selectedAddress.is_checkout_only) return;
      const { error: deleteError } = await supabaseAdminClient
        .from("user_addresses")
        .delete()
        .eq("id", selectedAddress.id)
        .eq("user_id", userId)
        .eq("is_checkout_only", true);
      if (deleteError) {
        console.error("Unable to remove one-time checkout address:", deleteError.message);
      }
    };

    if (items.some((item) => !item || typeof item.productId !== "string" ||
        !Number.isInteger(item.quantity) || item.quantity <= 0 ||
        (item.variantId !== undefined && item.variantId !== null && typeof item.variantId !== "string") ||
        (item.expectedPrice !== undefined && (!Number.isFinite(item.expectedPrice) || item.expectedPrice < 0)) ||
        (item.selectedSize !== undefined && item.selectedSize !== null && typeof item.selectedSize !== "string") ||
        (item.selectedColor !== undefined && item.selectedColor !== null && typeof item.selectedColor !== "string"))) {
      return NextResponse.json({ error: "Each cart item must include a valid product, quantity, and optional product option." }, { status: 400 });
    }

    const productIds = Array.from(new Set(items.map((item) => item.productId)));
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id,name,price,images,vendor_id,stock_quantity,size_type,available_sizes,category:categories(slug,name)")
      .in("id", productIds);

    if (productsError || !products || products.length !== productIds.length)
      return NextResponse.json({ error: "One or more cart items are invalid" }, { status: 400 });

    const normalizedProducts = products as Array<any>;
    const hasOwnProduct = normalizedProducts.some((product) =>
      isOwnProduct(product.vendor_id, userId)
    );
    if (hasOwnProduct) {
      return NextResponse.json(
        { error: "You can't purchase your own products." },
        { status: 403 }
      );
    }

    const vendorIds = Array.from(new Set(normalizedProducts.map((p) => p.vendor_id)));
    if (vendorIds.length !== 1)
      return NextResponse.json(
        { error: "Each order must contain items from exactly one seller." }, { status: 400 }
      );

    const { data: variants, error: variantsError } = await supabase
      .from("product_variants")
      .select("id,product_id,size,color,stock_quantity")
      .in("product_id", productIds);
    if (variantsError) {
      console.error("Unable to validate order option inventory:", variantsError.message);
      return NextResponse.json({ error: "Unable to validate product options. Please retry checkout." }, { status: 500 });
    }

    const variantsByProduct = new Map<string, ProductVariantRow[]>();
    ((variants ?? []) as ProductVariantRow[]).forEach((variant) => {
      variantsByProduct.set(variant.product_id, [
        ...(variantsByProduct.get(variant.product_id) ?? []),
        variant,
      ]);
    });

    const requestedVariantQuantities = new Map<string, number>();
    const requestedSizeQuantities = new Map<string, number>();
    for (const item of items) {
      const selectedSize = typeof item.selectedSize === "string" ? item.selectedSize.trim() : null;
      const key = `${item.productId}::${selectedSize ?? "default"}`;
      requestedSizeQuantities.set(key, (requestedSizeQuantities.get(key) ?? 0) + item.quantity);
      if (item.variantId) {
        requestedVariantQuantities.set(
          item.variantId,
          (requestedVariantQuantities.get(item.variantId) ?? 0) + item.quantity,
        );
      }
    }

    const orderItems = items.map((item) => {
      const product = normalizedProducts.find((p) => p.id === item.productId);
      if (!product)       throw new OrderValidationError("Invalid product in cart");
      if (!Number.isInteger(item.quantity) || item.quantity <= 0)
      throw new OrderValidationError("Quantity must be a positive integer");
      const sizeSlug = product.category?.slug ?? product.category?.name ?? "";
      const sizeConfig = getSizeConfig(sizeSlug);
      const requiresSize = product.size_type
        ? product.size_type !== "none"
        : sizeConfig.type !== "none";
      const requestedSize = typeof item.selectedSize === "string" ? item.selectedSize.trim() : null;
      const requestedColor = typeof item.selectedColor === "string" ? item.selectedColor.trim() : null;
      const productVariants = variantsByProduct.get(product.id) ?? [];
      const activeVariants = productVariants.filter((variant) => variant.stock_quantity > 0);
      if (activeVariants.length === 0 && productVariants.length > 0) {
        throw new OrderValidationError(`${product.name} is out of stock.`);
      }
      if (activeVariants.length > 1 && !item.variantId) {
        throw new OrderValidationError(`Choose size/color options for ${product.name} before checkout.`);
      }
      if (item.expectedPrice !== undefined &&
          Number(item.expectedPrice) !== Number(product.price)) {
        throw new OrderValidationError(`The price for ${product.name} has changed. Review your cart and retry.`);
      }

      const selectedVariant = item.variantId
        ? productVariants.find((variant) => variant.id === item.variantId)
        : activeVariants.length === 1 ? activeVariants[0] : undefined;
      if (item.variantId && !selectedVariant) {
        throw new OrderValidationError(`The selected option is no longer available for ${product.name}.`);
      }
      if (selectedVariant && selectedVariant.stock_quantity <= 0) {
        throw new OrderValidationError(`The selected option for ${product.name} is out of stock.`);
      }
      if (selectedVariant &&
          ((requestedSize !== null && selectedVariant.size !== requestedSize) ||
           (requestedColor !== null && selectedVariant.color !== requestedColor))) {
        throw new OrderValidationError(`The selected options do not match ${product.name}. Refresh your cart and try again.`);
      }
      if (selectedVariant &&
          (requestedVariantQuantities.get(selectedVariant.id) ?? item.quantity) > selectedVariant.stock_quantity) {
        throw new OrderValidationError(`The selected option for ${product.name} no longer has enough stock.`);
      }

      const selectedSize = selectedVariant?.size ?? requestedSize;
      if (requiresSize && !selectedSize) {
        throw new OrderValidationError(`Select a ${sizeConfig.label.toLowerCase()} for ${product.name}.`);
      }
      if (!requiresSize && selectedSize) {
        throw new OrderValidationError(`${product.name} does not have selectable sizes.`);
      }
      if (selectedSize && !isValidSize(sizeSlug, selectedSize)) {
        throw new OrderValidationError(`The selected size is not valid for ${product.name}.`);
      }

      const sizesFromVariants = productVariants.map((variant) => variant.size).filter((size): size is string => Boolean(size));
      const availableSizes = Array.isArray(product.available_sizes) && product.available_sizes.length
        ? product.available_sizes
        : Array.from(new Set(sizesFromVariants));
      const requestedSizeQuantity = requestedSizeQuantities.get(
        `${product.id}::${selectedSize ?? "default"}`
      ) ?? item.quantity;
      const sizeStock = productVariants
        .filter((variant) => variant.size === selectedSize)
        .reduce((total, variant) => total + variant.stock_quantity, 0);
      const productQuantity = items
        .filter((cartItem) => cartItem.productId === product.id)
        .reduce((total, cartItem) => total + cartItem.quantity, 0);
      if (productQuantity > product.stock_quantity) {
        throw new OrderValidationError(`${product.name} does not have enough stock.`);
      }
      if (!selectedVariant && selectedSize && (!availableSizes.includes(selectedSize) ||
          sizeStock < requestedSizeQuantity)) {
        throw new OrderValidationError(`${product.name} is out of stock in size ${selectedSize}.`);
      }
      return {
        product_id: product.id,
        quantity: item.quantity,
        price_at_purchase: product.price,
        product_name: product.name,
        product_image: product.images?.[0] ?? null,
        selected_size: selectedSize,
        selected_color: selectedVariant?.color ?? requestedColor,
        variant_id: selectedVariant?.id ?? null,
      };
    });

    const fingerprintLines = orderItems
      .map((item) => ({
        productId: item.product_id,
        variantId: item.variant_id,
        quantity: item.quantity,
        unitPrice: Number(item.price_at_purchase).toFixed(2),
      }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    const cartFingerprint = createHash("sha256")
      .update(JSON.stringify({ items: fingerprintLines, deliveryAddress: deliveryAddressSnapshot }))
      .digest("hex");

    const { data: existingOrder, error: existingOrderError } = await supabaseAdminClient
      .from("orders")
      .select("id,status,payment_status,cart_fingerprint")
      .eq("buyer_id", userId)
      .eq("checkout_idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingOrderError) {
      console.error("Unable to check checkout idempotency key:", existingOrderError.message);
      return NextResponse.json({ error: "Unable to resume checkout. Please retry." }, { status: 500 });
    }
    if (existingOrder) {
      if (existingOrder.status !== "pending" || existingOrder.payment_status !== "pending") {
        return NextResponse.json({ error: "This checkout has already been completed or cancelled." }, { status: 409 });
      }
      if (existingOrder.cart_fingerprint === cartFingerprint) {
        await removeCheckoutOnlyAddress();
        return NextResponse.json({ status: true, orderId: existingOrder.id }, { status: 200 });
      }

      const { error: rekeyError } = await supabaseAdminClient
        .from("orders")
        .update({ checkout_idempotency_key: randomUUID() })
        .eq("id", existingOrder.id)
        .eq("buyer_id", userId)
        .eq("status", "pending")
        .eq("payment_status", "pending")
        .eq("checkout_idempotency_key", idempotencyKey);
      if (rekeyError) {
        console.error("Unable to retain previous pending checkout:", rekeyError.message);
        return NextResponse.json({ error: "Unable to start the changed checkout. Please retry." }, { status: 500 });
      }
    }

    const { data: existingCartOrder, error: existingCartError } = await supabaseAdminClient
      .from("orders")
      .select("id,status,payment_status")
      .eq("buyer_id", userId)
      .eq("cart_fingerprint", cartFingerprint)
      .eq("status", "pending")
      .eq("payment_status", "pending")
      .maybeSingle();
    if (existingCartError) {
      console.error("Unable to check open cart order:", existingCartError.message);
      return NextResponse.json({ error: "Unable to resume checkout. Please retry." }, { status: 500 });
    }
    if (existingCartOrder) {
      await removeCheckoutOnlyAddress();
      return NextResponse.json({ status: true, orderId: existingCartOrder.id }, { status: 200 });
    }

    const subtotal = orderItems.reduce(
      (sum, item) => sum + Number(item.price_at_purchase) * item.quantity, 0
    );
    const deliveryFee = 1000;

    // generate a random 6-digit delivery code for buyer verification
    const deliveryCode = Math.floor(100000 + Math.random() * 900000).toString();

    const { data: order, error: orderError } = await supabaseAdminClient
      .from("orders")
      .insert({
        buyer_id: userId,
        vendor_id: vendorIds[0],
        checkout_idempotency_key: idempotencyKey,
        cart_fingerprint: cartFingerprint,
        status: "pending",
        delivery_code: deliveryCode,
        subtotal,
        delivery_fee: deliveryFee,
        total: subtotal + deliveryFee,
        payment_method: "pending",
        payment_status: "pending",
        delivery_name: selectedAddress.full_name,
        delivery_phone: selectedAddress.phone,
        delivery_address: deliveryAddressSnapshot,
      })
      .select("id")
      .single();

    if (orderError?.code === "23505") {
      let racedOrder = (await supabaseAdminClient
        .from("orders")
        .select("id,status,payment_status")
        .eq("buyer_id", userId)
        .eq("checkout_idempotency_key", idempotencyKey)
        .maybeSingle()).data;
      if (!racedOrder) {
        racedOrder = (await supabaseAdminClient
          .from("orders")
          .select("id,status,payment_status")
          .eq("buyer_id", userId)
          .eq("cart_fingerprint", cartFingerprint)
          .eq("status", "pending")
          .eq("payment_status", "pending")
          .maybeSingle()).data;
      }
      if (racedOrder?.status === "pending" && racedOrder.payment_status === "pending") {
        await removeCheckoutOnlyAddress();
        return NextResponse.json({ status: true, orderId: racedOrder.id }, { status: 200 });
      }
    }
    if (orderError || !order)
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });

    const { error: itemsError } = await supabaseAdminClient
      .from("order_items")
      .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

    if (itemsError)
      return NextResponse.json({ error: "Failed to save order items" }, { status: 500 });

    if (orderItems.some((item) => item.variant_id)) {
      const { data: stockReserved, error: reserveError } = await supabase.rpc(
        "reserve_order_variant_sizes",
        { p_order_id: order.id }
      );
      if (reserveError || !stockReserved) {
        if (reserveError) console.error("Unable to reserve selected product options:", reserveError.message);
        const { data: cancelled, error: cancelError } = reserveError
          ? await supabase.rpc("cancel_unpaid_order", { p_order_id: order.id })
          : { data: true, error: null };
        if (cancelError || !cancelled) {
          console.error("Unable to cancel order after size reservation failure:", cancelError?.message ?? "Unknown error");
          return NextResponse.json({ error: "Unable to reserve product sizes or safely cancel the order." }, { status: 500 });
        }
        return NextResponse.json({
          error: reserveError
            ? "Unable to reserve the selected options. The unpaid order was cancelled."
            : "A selected option just sold out. The unpaid order was cancelled; refresh your cart and retry.",
        }, { status: reserveError ? 500 : 409 });
      }
    }

    // Deduct stock for each product.
    try {
      const quantitiesByProduct = new Map<string, number>();
      orderItems.forEach((item) => quantitiesByProduct.set(
        item.product_id,
        (quantitiesByProduct.get(item.product_id) ?? 0) + item.quantity
      ));
      for (const [productId, quantity] of quantitiesByProduct) {
        const product = products.find((p) => p.id === productId);
        if (product) {
          const newStock = Math.max(0, product.stock_quantity - quantity);
          await supabaseAdminClient
            .from("products")
            .update({ stock_quantity: newStock })
            .eq("id", productId);
        }
      }
    } catch (stockErr) {
      console.error("Failed to deduct stock:", stockErr);
    }

    await removeCheckoutOnlyAddress();
    return NextResponse.json({ status: true, orderId: order.id }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Order create error:", JSON.stringify(error));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
