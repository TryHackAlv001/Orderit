import { NextRequest, NextResponse } from "next/server";
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
    const deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";
    const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!items || !Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: "Cart items are required" }, { status: 400 });
    if (!deliveryAddress)
      return NextResponse.json({ error: "Delivery address is required" }, { status: 400 });
    if (!customerName)
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    if (!email)
      return NextResponse.json({ error: "Email is required" }, { status: 400 });

    const supabase = createSupabaseServerClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId)
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { data: user, error: userError } = await supabase
      .from("users").select("role").eq("id", userId).single();
    if (userError || !user || (user.role !== "buyer" && user.role !== "vendor"))
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

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
        status: "pending",
        delivery_code: deliveryCode,
        subtotal,
        delivery_fee: deliveryFee,
        total: subtotal + deliveryFee,
        payment_method: "pending",
        payment_status: "pending",
        delivery_address: { address: deliveryAddress, customerName, email },
      })
      .select("id")
      .single();

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

    return NextResponse.json({ status: true, orderId: order.id }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Order create error:", JSON.stringify(error));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
