import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSizeConfig, isValidSize } from "@/constants/sizes";

interface OrderItemPayload {
  productId: string;
  quantity: number;
  selectedSize?: string | null;
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
    if (userError || !user || user.role !== "buyer")
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    if (items.some((item) => !item || typeof item.productId !== "string" ||
        !Number.isInteger(item.quantity) || item.quantity <= 0 ||
        (item.selectedSize !== undefined && item.selectedSize !== null && typeof item.selectedSize !== "string"))) {
      return NextResponse.json({ error: "Each cart item must include a valid product, quantity, and optional size." }, { status: 400 });
    }

    const productIds = Array.from(new Set(items.map((item) => item.productId)));
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id,name,price,images,vendor_id,stock_quantity,size_type,available_sizes,category:categories(slug,name)")
      .in("id", productIds);

    if (productsError || !products || products.length !== productIds.length)
      return NextResponse.json({ error: "One or more cart items are invalid" }, { status: 400 });

    const normalizedProducts = products as Array<any>;
    const vendorIds = Array.from(new Set(normalizedProducts.map((p) => p.vendor_id)));
    if (vendorIds.length !== 1)
      return NextResponse.json(
        { error: "All items must be from the same vendor" }, { status: 400 }
      );

    const { data: variants, error: variantsError } = await supabase
      .from("product_variants")
      .select("product_id,size,stock_quantity")
      .in("product_id", productIds);
    if (variantsError) {
      console.error("Unable to validate order size inventory:", variantsError.message);
      return NextResponse.json({ error: "Unable to validate product sizes. Please retry checkout." }, { status: 500 });
    }

    const variantsByProduct = new Map<string, { size: string | null; stock_quantity: number }[]>();
    (variants ?? []).forEach((variant) => {
      variantsByProduct.set(variant.product_id, [
        ...(variantsByProduct.get(variant.product_id) ?? []),
        { size: variant.size, stock_quantity: variant.stock_quantity },
      ]);
    });

    const requestedSizeQuantities = new Map<string, number>();
    for (const item of items) {
      const selectedSize = typeof item.selectedSize === "string" ? item.selectedSize.trim() : null;
      const key = `${item.productId}::${selectedSize ?? "default"}`;
      requestedSizeQuantities.set(key, (requestedSizeQuantities.get(key) ?? 0) + item.quantity);
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
      const selectedSize = typeof item.selectedSize === "string" ? item.selectedSize.trim() : null;
      if (requiresSize && !selectedSize) {
        throw new OrderValidationError(`Select a ${sizeConfig.label.toLowerCase()} for ${product.name}.`);
      }
      if (!requiresSize && selectedSize) {
        throw new OrderValidationError(`${product.name} does not have selectable sizes.`);
      }
      if (selectedSize && !isValidSize(sizeSlug, selectedSize)) {
        throw new OrderValidationError(`The selected size is not valid for ${product.name}.`);
      }
      const productVariants = variantsByProduct.get(product.id) ?? [];
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
      if (selectedSize && (!availableSizes.includes(selectedSize) ||
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
      };
    });

    const subtotal = orderItems.reduce(
      (sum, item) => sum + Number(item.price_at_purchase) * item.quantity, 0
    );
    const deliveryFee = 1000;

    // generate a random 6-digit delivery code for buyer verification
    const deliveryCode = Math.floor(100000 + Math.random() * 900000).toString();

    const { data: order, error: orderError } = await supabase
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

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

    if (itemsError)
      return NextResponse.json({ error: "Failed to save order items" }, { status: 500 });

    if (orderItems.some((item) => item.selected_size)) {
      const { data: stockReserved, error: reserveError } = await supabase.rpc(
        "reserve_order_variant_sizes",
        { p_order_id: order.id }
      );
      if (reserveError || !stockReserved) {
        if (reserveError) console.error("Unable to reserve selected size stock:", reserveError.message);
        const { data: cancelled, error: cancelError } = reserveError
          ? await supabase.rpc("cancel_unpaid_order", { p_order_id: order.id })
          : { data: true, error: null };
        if (cancelError || !cancelled) {
          console.error("Unable to cancel order after size reservation failure:", cancelError?.message ?? "Unknown error");
          return NextResponse.json({ error: "Unable to reserve product sizes or safely cancel the order." }, { status: 500 });
        }
        return NextResponse.json({
          error: reserveError
            ? "Unable to reserve the selected sizes. The unpaid order was cancelled."
            : "A selected size just sold out. The unpaid order was cancelled; refresh your cart and retry.",
        }, { status: reserveError ? 500 : 409 });
      }
    }



    // Deduct stock for each product
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
          await supabase
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
