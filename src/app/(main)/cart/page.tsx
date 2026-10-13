'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react';
import { usePurchasableCart } from '@/hooks/usePurchasableCart';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import type { ProductVariant } from '@/types';

function optionLabel(variant: ProductVariant) {
  return [variant.color, variant.size].filter(Boolean).join(' · ') || 'Default option';
}

export default function CartPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const items = usePurchasableCart();
  const user = useAuthStore((state) => state.user);
  const { acceptPrice, resolveItem, updateQuantity } = useCartStore();
  const [variantsByProduct, setVariantsByProduct] = useState<Record<string, ProductVariant[]>>({});
  const [variantsLoaded, setVariantsLoaded] = useState(false);

  useEffect(() => {
    const productIds = Array.from(new Set(items.map((item) => item.product.id)));
    if (!productIds.length) {
      setVariantsByProduct({});
      setVariantsLoaded(true);
      return;
    }
    setVariantsLoaded(false);
    setVariantsByProduct(Object.fromEntries(productIds.map((productId) => [productId, []])));
    let cancelled = false;
    void supabase
      .from('product_variants')
      .select('id,product_id,size,color,stock_quantity')
      .in('product_id', productIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('Unable to refresh cart product options:', error.message);
          toast.error('Product options could not be refreshed.');
          setVariantsLoaded(true);
          return;
        }
        const grouped: Record<string, ProductVariant[]> = {};
        productIds.forEach((productId) => { grouped[productId] = []; });
        (data ?? []).forEach((variant) => {
          if (!variant.product_id) return;
          (grouped[variant.product_id] ??= []).push(variant);
        });
        setVariantsByProduct(grouped);
        setVariantsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [items, supabase]);

  const itemNeedsSelection = (item: (typeof items)[number]) => {
    const variants = variantsByProduct[item.product.id];
    if (item.variant_id) {
      return item.needs_selection || (variantsLoaded &&
        !variants.some((variant) => variant.id === item.variant_id && variant.stock_quantity > 0));
    }
    const activeCount = variants?.filter((variant) => variant.stock_quantity > 0).length ?? 0;
    return Boolean(item.needs_selection) || (variantsLoaded &&
      (activeCount > 1 || (Boolean(variants?.length) && activeCount === 0)));
  };
  const unresolvedItems = items.filter(itemNeedsSelection);
  const unresolvedQuantity = unresolvedItems.reduce((total, item) => total + item.quantity, 0);
  const firstPriceChangedItem = items.find((item) =>
    Number(item.price_at_add ?? item.product.price) !== Number(item.product.price)
  );
  const priceChangedCount = items.filter((item) =>
    Number(item.price_at_add ?? item.product.price) !== Number(item.product.price)
  ).length;
  const firstUnresolvedId = unresolvedItems[0]?.id;
  const scrollToFirstUnresolved = () => {
    if (firstUnresolvedId) {
      document.getElementById(`cart-item-${firstUnresolvedId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  const groupedByVendor = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    items.forEach((item) => {
      const vendorId = item.product.vendor_id;
      (groups[vendorId] ??= []).push(item);
    });
    return groups;
  }, [items]);

  const totals = useMemo(() => {
    const vendorTotals: Record<string, number> = {};
    let resolvedSubtotal = 0;
    items.filter((item) => !itemNeedsSelection(item)).forEach((item) => {
      const lineTotal = Number(item.price_at_add ?? item.product.price) * item.quantity;
      vendorTotals[item.product.vendor_id] = (vendorTotals[item.product.vendor_id] || 0) + lineTotal;
      resolvedSubtotal += lineTotal;
    });
    return { vendorTotals, resolvedSubtotal };
  }, [items, variantsByProduct, variantsLoaded]);

  const updateLineQuantity = async (itemId: string, quantity: number) => {
    const item = items.find((current) => current.id === itemId);
    if (!item) return;
    const previousQuantity = item.quantity;
    updateQuantity(itemId, quantity);
    if (user && item.database_id) {
      const { error } = quantity > 0
        ? await supabase.from('cart_items').update({ quantity }).eq('id', item.database_id)
        : await supabase.from('cart_items').delete().eq('id', item.database_id);
      if (error) {
        updateQuantity(itemId, previousQuantity);
        toast.error(error.message);
      }
    }
  };

  const selectVariant = async (itemId: string, variantId: string) => {
    const item = items.find((current) => current.id === itemId);
    const variant = variantsByProduct[item?.product.id ?? '']?.find((current) => current.id === variantId);
    if (!item || !variant || variant.stock_quantity < item.quantity) return;

    if (user) {
      let databaseId = item.database_id;
      if (!databaseId) {
        let query = supabase
          .from('cart_items')
          .select('id')
          .eq('user_id', user.id)
          .eq('product_id', item.product.id);
        query = item.variant_id ? query.eq('variant_id', item.variant_id) : query.is('variant_id', null);
        const { data, error } = await query.maybeSingle();
        if (error) {
          toast.error(error.message);
          return;
        }
        databaseId = data?.id;
      }
      if (databaseId) {
        const { data, error } = await supabase.rpc('resolve_cart_item_variant', {
          p_cart_item_id: databaseId,
          p_variant_id: variant.id,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        resolveItem(itemId, variant);
        if (row?.id) {
          useCartStore.getState().markSynced(
            `${item.product.id}::variant:${variant.id}`,
            row.id,
            user.id,
          );
        }
        return;
      }
    }

    resolveItem(itemId, variant);
  };

  const confirmCurrentPrice = async (itemId: string) => {
    const item = items.find((current) => current.id === itemId);
    if (!item) return;
    if (user && item.database_id) {
      const { error } = await supabase
        .from('cart_items')
        .update({ price_at_add: Number(item.product.price) })
        .eq('id', item.database_id);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    acceptPrice(itemId);
    toast.success('Cart price updated.');
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[60svh] min-w-0 items-center justify-center bg-bg">
        <div className="mx-auto max-w-md px-0 text-center md:px-6">
          <ShoppingBag className="mx-auto mb-4 h-16 w-16 text-muted" />
          <h1 className="mb-2 text-3xl font-bold text-text">Your cart is empty</h1>
          <p className="mb-8 text-muted">Looks like you haven&apos;t added any items yet. Browse our marketplace to find something you like.</p>
          <Button onClick={() => router.push('/marketplace')} className="w-full">Browse Marketplace</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 bg-bg">
      <div className="mx-auto w-full max-w-6xl min-w-0 py-8 md:py-12">
        <h1 className="mb-8 break-words text-3xl font-bold text-text md:text-4xl">Shopping Cart</h1>

        {unresolvedQuantity > 0 && (
          <div className="mb-8 flex flex-col gap-4 rounded-lg border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-medium text-text">
              {unresolvedQuantity} {unresolvedQuantity === 1 ? 'item needs' : 'items need'} size/color before checkout
            </p>
            <Button type="button" variant="outline" onClick={scrollToFirstUnresolved}>
              Choose options
            </Button>
          </div>
        )}
        {firstPriceChangedItem && (
          <div className="mb-8 rounded-lg border border-warning/40 bg-warning/10 p-4 text-text">
            <p className="font-medium">
              The price for {firstPriceChangedItem.product.name} changed from ₦{Number(firstPriceChangedItem.price_at_add ?? firstPriceChangedItem.product.price).toLocaleString()} to ₦{Number(firstPriceChangedItem.product.price).toLocaleString()}.
            </p>
            <p className="mt-1 text-sm text-muted">Review and accept the updated price before checkout.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="space-y-8">
              {Object.entries(groupedByVendor).map(([vendorId, vendorItems]) => (
                <div key={vendorId} className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                  <div className="border-b border-border bg-surface-raised px-6 py-4">
                    <h2 className="min-w-0 break-words text-lg font-semibold text-text">
                      {vendorItems[0]?.vendor?.shop_name || 'Vendor Store'}
                    </h2>
                  </div>
                  <div className="divide-y divide-border">
                    {vendorItems.map((item) => {
                      const variants = variantsByProduct[item.product.id] ?? [];
                      const unresolved = itemNeedsSelection(item);
                      const selectedVariantIsAvailable = variants.some((variant) =>
                        variant.id === item.variant_id && variant.stock_quantity > 0
                      );
                      const lineNeedsChoice = unresolved || (Boolean(item.variant_id) && !selectedVariantIsAvailable);
                      return (
                        <div
                          id={`cart-item-${item.id}`}
                          key={item.id}
                          className="min-w-0 p-4 transition-colors duration-200 hover:bg-surface-raised md:p-6"
                        >
                          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:gap-6">
                            <div className="flex min-w-0 gap-4 sm:flex-1">
                            <div className="h-24 w-24 shrink-0 sm:h-[120px] sm:w-[120px]">
                              {item.product.images?.[0] ? (
                                <Image src={item.product.images[0]} alt={item.product.name} width={120} height={120} className="h-full w-full rounded-lg object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center rounded-md bg-surface-raised">
                                  <ShoppingBag className="h-8 w-8 text-muted" />
                                </div>
                              )}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                              <h3 className="mb-1 line-clamp-2 break-words text-lg font-semibold text-text">{item.product.name}</h3>
                              <p className="mb-2 truncate text-sm text-muted" title={item.vendor?.shop_name || 'Vendor Store'}>Sold by {item.vendor?.shop_name || 'Vendor Store'}</p>
                              {item.selected_color && <p className="text-sm text-muted">Color: {item.selected_color}</p>}
                              {item.selected_size && <p className="text-sm text-muted">Size: {item.selected_size}</p>}
                              {lineNeedsChoice && (
                                <div className="mt-2 max-w-sm">
                                  <label htmlFor={`variant-${item.id}`} className="mb-1 block text-sm font-semibold text-text">
                                    Select options
                                  </label>
                                  <select
                                    id={`variant-${item.id}`}
                                    value={selectedVariantIsAvailable ? item.variant_id ?? '' : ''}
                                    onChange={(event) => void selectVariant(item.id, event.target.value)}
                                    className="min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    <option value="">Choose size/color</option>
                                    {variants.map((variant) => (
                                      <option
                                        key={variant.id}
                                        value={variant.id}
                                        disabled={variant.stock_quantity <= 0 || variant.stock_quantity < item.quantity}
                                      >
                                        {optionLabel(variant)}{variant.stock_quantity <= 0 ? ' — Out of stock' : variant.stock_quantity < item.quantity ? ` — Only ${variant.stock_quantity} available` : ''}
                                      </option>
                                    ))}
                                  </select>
                                  {variants.length === 0 && (
                                    <p className="mt-2 text-sm text-danger-text">Product options are no longer available. Remove this item and choose another product.</p>
                                  )}
                                </div>
                              )}
                              <p className="mb-4 mt-2 font-display text-xl font-bold text-accent-text">
                                {lineNeedsChoice
                                  ? `From ₦${Number(item.product.price).toLocaleString()}`
                                  : `₦${Number(item.product.price).toLocaleString()}`}
                              </p>
                              {Number(item.price_at_add ?? item.product.price) !== Number(item.product.price) && (
                                <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-text">
                                  Price changed from ₦{Number(item.price_at_add).toLocaleString()} to ₦{Number(item.product.price).toLocaleString()}.
                                  <button type="button" onClick={() => void confirmCurrentPrice(item.id)} className="ml-2 font-semibold text-accent-text underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    Use new price
                                  </button>
                                </div>
                              )}
                              <div className="mt-auto flex items-center gap-2">
                                <button type="button" onClick={() => void updateLineQuantity(item.id, item.quantity - 1)} className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface-raised text-text hover:border-accent hover:bg-accent/10 hover:text-accent-text" aria-label="Decrease quantity">
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-12 text-center font-semibold text-text" aria-label={`Quantity ${item.quantity}`}>{item.quantity}</span>
                                <button type="button" onClick={() => void updateLineQuantity(item.id, item.quantity + 1)} className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-border bg-surface-raised text-text hover:border-accent hover:bg-accent/10 hover:text-accent-text" aria-label="Increase quantity">
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            </div>
                            <div className="flex min-w-0 items-center justify-between sm:flex-col sm:items-end">
                              <button type="button" onClick={() => void updateLineQuantity(item.id, 0)} className="inline-flex h-11 w-11 items-center justify-center rounded-md text-danger-text hover:bg-danger/10" aria-label="Remove item">
                                <Trash2 className="h-5 w-5" />
                              </button>
                              <div className="min-w-0 text-right">
                                <p className="mb-1 text-sm text-muted">Subtotal</p>
                                <p className="break-words font-display text-lg font-bold text-text sm:text-xl">
                                  {lineNeedsChoice ? '—' : `₦${(Number(item.price_at_add ?? item.product.price) * item.quantity).toLocaleString()}`}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-bg px-4 py-4 sm:px-6">
                    <span className="min-w-0 font-semibold text-text">Resolved vendor subtotal</span>
                    <span className="min-w-0 break-words text-right font-display text-xl font-bold text-accent-text">
                      ₦{totals.vendorTotals[vendorId]?.toLocaleString() ?? '0'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="rounded-lg border border-border bg-surface p-4 shadow-sm lg:sticky lg:top-4 lg:p-8">
              <h2 className="mb-6 text-2xl font-bold text-text">Order Summary</h2>
              <div className="mb-8 space-y-4">
                <div className="flex justify-between text-muted">
                  <span>{unresolvedQuantity ? 'Resolved subtotal' : 'Subtotal'}</span>
                  <span className="font-display">₦{totals.resolvedSubtotal.toLocaleString()}</span>
                </div>
                {unresolvedQuantity > 0 && (
                  <p className="text-sm text-muted">Unresolved items are excluded until you choose options.</p>
                )}
              </div>
              <div className="border-t border-border pt-6">
                <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <span className="text-lg font-semibold text-text">{unresolvedQuantity ? 'Current total' : 'Total'}</span>
                  <span className="min-w-0 truncate text-right font-display text-2xl font-bold text-accent-text lg:text-3xl">₦{totals.resolvedSubtotal.toLocaleString()}</span>
                </div>
                <Button
                  type="button"
                  aria-disabled={unresolvedQuantity > 0 || priceChangedCount > 0}
                  onClick={() => {
                    if (unresolvedQuantity) scrollToFirstUnresolved();
                    else if (firstPriceChangedItem) {
                      document.getElementById(`cart-item-${firstPriceChangedItem.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else router.push('/checkout');
                  }}
                  className={`w-full py-3 font-semibold ${unresolvedQuantity || priceChangedCount ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  {unresolvedQuantity
                    ? `Choose options for ${unresolvedQuantity} items to continue`
                    : priceChangedCount
                      ? 'Review changed prices to continue'
                      : 'Proceed to Checkout'}
                </Button>
              </div>
              <p className="mt-6 text-center text-xs text-muted">You can review and modify your order before paying.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
