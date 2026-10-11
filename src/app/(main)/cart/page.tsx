'use client';

import { useCartStore } from '@/store/cartStore';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { ShoppingBag, Minus, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);

  // Group items by vendor
  const groupedByVendor = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    items.forEach((item) => {
      const vendorId = item.product.vendor_id;
      if (!groups[vendorId]) {
        groups[vendorId] = [];
      }
      groups[vendorId].push(item);
    });
    return groups;
  }, [items]);

  // Calculate totals
  const totals = useMemo(() => {
    const vendorTotals: Record<string, number> = {};
    let grandTotal = 0;

    items.forEach((item) => {
      const vendorId = item.product.vendor_id;
      const itemTotal = item.product.price * item.quantity;
      vendorTotals[vendorId] = (vendorTotals[vendorId] || 0) + itemTotal;
      grandTotal += itemTotal;
    });

    return { vendorTotals, grandTotal };
  }, [items]);

  // Handle quantity update (increment)
  const handleIncrement = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      removeItem(itemId);
      useCartStore.getState().addItem({
        ...item,
        quantity: item.quantity + 1,
      });
    }
  };

  // Handle quantity update (decrement)
  const handleDecrement = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (item) {
      if (item.quantity <= 1) {
        removeItem(itemId);
      } else {
        removeItem(itemId);
        useCartStore.getState().addItem({
          ...item,
          quantity: item.quantity - 1,
        });
      }
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <ShoppingBag className="w-16 h-16 text-muted mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-text mb-2">Your cart is empty</h1>
          <p className="text-muted mb-8">
            Looks like you haven&apos;t added any items yet. Browse our marketplace to find delicious options!
          </p>
          <Button
            onClick={() => router.push('/marketplace')}
            className="w-full"
          >
            Browse Marketplace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-text mb-12">Shopping Cart</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="space-y-8">
              {Object.entries(groupedByVendor).map(([vendorId, vendorItems]) => (
                <div key={vendorId} className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                  {/* Vendor Group Header */}
                  <div className="border-b border-border bg-surface-raised px-6 py-4">
                    <h2 className="text-lg font-semibold text-text">
                      {vendorItems[0]?.vendor?.shop_name || 'Vendor Store'}
                    </h2>
                  </div>

                  {/* Items in vendor group */}
                  <div className="divide-y divide-border">
                    {vendorItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-6 transition-colors duration-200 hover:bg-surface-raised"
                      >
                        <div className="flex gap-6">
                          {/* Product Image */}
                          <div className="flex-shrink-0">
                            {item.product.images && item.product.images[0] ? (
                              <Image
                                src={item.product.images[0]}
                                alt={item.product.name}
                                width={120}
                                height={120}
                                className="object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-[120px] h-[120px] rounded-md bg-surface-raised flex items-center justify-center">
                                <ShoppingBag className="w-8 h-8 text-muted" />
                              </div>
                            )}
                          </div>

                          {/* Product Details */}
                          <div className="flex-1 flex flex-col">
                            <h3 className="text-lg font-semibold text-text mb-2">
                              {item.product.name}
                            </h3>
                            <p className="text-sm text-muted mb-2">
                              Sold by {item.vendor?.shop_name || 'Vendor Store'}
                            </p>
                            {item.selected_size && (
                              <p className="mb-2 text-sm font-medium text-muted">Size: {item.selected_size}</p>
                            )}
                            <p className="font-display text-2xl font-bold text-accent-text mb-4">
                              ₦{item.product.price.toLocaleString()}
                            </p>

                            {/* Quantity Stepper */}
                            <div className="flex items-center gap-3 mt-auto">
                              <button
                                onClick={() => handleDecrement(item.id)}
                                className="rounded-md border border-border bg-surface-raised p-2 text-text transition-colors duration-200 hover:border-accent hover:bg-accent/10 hover:text-accent-text"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-12 text-center font-semibold text-text">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleIncrement(item.id)}
                                className="rounded-md border border-border bg-surface-raised p-2 text-text transition-colors duration-200 hover:border-accent hover:bg-accent/10 hover:text-accent-text"
                                aria-label="Increase quantity"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Item Total and Remove */}
                          <div className="flex flex-col items-end justify-between">
                            <button
                              onClick={() => removeItem(item.id)}
                              className="rounded-md p-2 text-danger-text transition-colors duration-200 hover:bg-danger/10"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                            <div className="text-right">
                              <p className="text-sm text-muted mb-1">Subtotal</p>
                              <p className="font-display text-2xl font-bold text-text">
                                ₦{(item.product.price * item.quantity).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Vendor Subtotal */}
                  <div className="bg-bg px-6 py-4 flex justify-between items-center">
                    <span className="text-text font-semibold">Vendor Subtotal</span>
                    <span className="font-display text-xl font-bold text-accent-text">
                      ₦{totals.vendorTotals[vendorId]?.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 rounded-lg border border-border bg-surface p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-text mb-6">Order Summary</h2>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span className="font-display">₦{totals.grandTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-lg font-semibold text-text">Total</span>
                  <span className="font-display text-3xl font-bold text-accent-text">
                    ₦{totals.grandTotal.toLocaleString()}
                  </span>
                </div>

                <Button
                  onClick={() => router.push('/checkout')}
                  className="w-full font-semibold py-3"
                >
                  Proceed to Checkout
                </Button>
              </div>

              <p className="text-xs text-muted text-center mt-6">
                You can review and modify your order in the next step
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
