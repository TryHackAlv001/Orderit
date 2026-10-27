"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PaymentButtons } from "./PaymentButtons";
import type { CartItem } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import {
  formatUserAddress,
  normalizeUserAddressDraft,
  validateUserAddressDraft,
  type UserAddress,
  type UserAddressDraft,
} from "@/lib/user-addresses";

interface CheckoutFormProps {
  items: CartItem[];
}

interface VendorCartGroup {
  vendorId: string;
  items: CartItem[];
}

export function CheckoutForm({ items }: CheckoutFormProps) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [checkoutOnlyAddress, setCheckoutOnlyAddress] = useState<UserAddress | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<UserAddress | null>(null);
  const [draft, setDraft] = useState<UserAddressDraft>({
    full_name: "",
    phone: "",
    address_line: "",
    city: "",
    state: "",
    landmark: "",
  });
  const [saveForNextTime, setSaveForNextTime] = useState(true);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressLoadError, setAddressLoadError] = useState<string | null>(null);
  const [addressRetry, setAddressRetry] = useState(0);
  const [addressFormOpen, setAddressFormOpen] = useState(false);
  const [addressChoicesOpen, setAddressChoicesOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReadyForPayment, setIsReadyForPayment] = useState(false);
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const returnToDetails = () => {
      setIsReadyForPayment(false);
      setAddressConfirmed(false);
    };
    window.addEventListener("checkout-back-to-details", returnToDetails);
    return () => window.removeEventListener("checkout-back-to-details", returnToDetails);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setAddressLoading(false);
      return;
    }
    let active = true;
    const loadAddresses = async () => {
      setAddressLoading(true);
      setAddressLoadError(null);
      const supabase = createClient();
      const staleCheckoutAddressBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { error: cleanupError } = await supabase
        .from("user_addresses")
        .delete()
        .eq("user_id", user.id)
        .eq("is_checkout_only", true)
        .lt("created_at", staleCheckoutAddressBefore);
      if (!active) return;
      if (cleanupError) {
        console.error("Unable to clear expired checkout address:", cleanupError.message);
        setAddressLoadError("An expired checkout address could not be cleared. Please retry.");
        setAddressLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from("user_addresses")
        .select("id,user_id,full_name,phone,address_line,city,state,landmark,is_default,is_checkout_only,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (!active) return;
      if (loadError) {
        console.error("Unable to load checkout addresses:", loadError.message);
        setAddressLoadError("Saved addresses could not be loaded. Please retry.");
        setAddressLoading(false);
        return;
      }

      const loaded = (data ?? []) as UserAddress[];
      const saved = loaded.filter((address) => !address.is_checkout_only);
      const temporary = loaded.find((address) => address.is_checkout_only) ?? null;
      const preferred = saved.find((address) => address.is_default) ?? saved[0] ?? null;
      setAddresses(saved);
      setCheckoutOnlyAddress(temporary);
      setSelectedAddress(preferred);
      setAddressFormOpen(!preferred);
      if (!preferred && temporary) {
        setSaveForNextTime(false);
        setDraft({
          full_name: temporary.full_name,
          phone: temporary.phone,
          address_line: temporary.address_line,
          city: temporary.city,
          state: temporary.state,
          landmark: temporary.landmark ?? "",
        });
      } else if (!preferred) {
        setSaveForNextTime(true);
        setDraft({
          full_name: user.full_name ?? "",
          phone: user.phone ?? "",
          address_line: "",
          city: "",
          state: "",
          landmark: "",
        });
      }
      setAddressLoading(false);
    };

    void loadAddresses();
    return () => {
      active = false;
    };
  }, [addressRetry, user?.id, user?.full_name, user?.phone]);

  const unresolvedQuantity = items
    .filter((item) => item.needs_selection)
    .reduce((sum, item) => sum + item.quantity, 0);
  const hasPriceChange = items.some((item) =>
    Number(item.price_at_add ?? item.product.price) !== Number(item.product.price)
  );
  const subtotal = items.reduce(
    (sum, item) => sum + (item.needs_selection ? 0 : Number(item.price_at_add ?? item.product.price) * item.quantity),
    0
  );
  const vendorGroups = items.reduce<VendorCartGroup[]>((groups, item) => {
    const group = groups.find((current) => current.vendorId === item.product.vendor_id);
    if (group) group.items.push(item);
    else groups.push({ vendorId: item.product.vendor_id, items: [item] });
    return groups;
  }, []);
  const deliveryFee = vendorGroups.length * 1000;
  const total = subtotal + deliveryFee;

  const handleCheckoutSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!user?.email) {
      setError("Please sign in to complete checkout.");
      return;
    }

    if (items.length === 0) {
      setError("Cart is empty.");
      return;
    }
    if (unresolvedQuantity > 0) {
      setError(`Choose options for ${unresolvedQuantity} items to continue.`);
      return;
    }
    if (hasPriceChange) {
      setError("A product price changed. Return to your cart to review and accept the updated price.");
      return;
    }

    if (addressFormOpen) {
      const normalizedDraft = normalizeUserAddressDraft(draft);
      const validationError = validateUserAddressDraft(normalizedDraft);
      if (validationError) {
        setError(validationError);
        return;
      }
      if (!user?.id) {
        setError("Please sign in again to save your delivery address.");
        return;
      }

      void (async () => {
        const supabase = createClient();
        const fields = {
          ...normalizedDraft,
          landmark: normalizedDraft.landmark || null,
        };
        let address: UserAddress | null = null;
        const reusableTemporary = selectedAddress?.is_checkout_only
          ? selectedAddress
          : checkoutOnlyAddress;

        if (reusableTemporary && !saveForNextTime) {
          const { data, error: updateError } = await supabase
            .from("user_addresses")
            .update(fields)
            .eq("id", reusableTemporary.id)
            .eq("user_id", user.id)
            .eq("is_checkout_only", true)
            .select("id,user_id,full_name,phone,address_line,city,state,landmark,is_default,is_checkout_only,created_at")
            .single();
          if (updateError) {
            console.error("Unable to update temporary checkout address:", updateError.message);
            setError("The delivery address could not be saved. Please try again.");
            return;
          }
          address = data as UserAddress;
        } else {
          if (reusableTemporary) {
            const { error: deleteError } = await supabase
              .from("user_addresses")
              .delete()
              .eq("id", reusableTemporary.id)
              .eq("user_id", user.id)
              .eq("is_checkout_only", true);
            if (deleteError) {
              console.error("Unable to replace temporary checkout address:", deleteError.message);
              setError("The delivery address could not be prepared. Please try again.");
              return;
            }
          }

          const { data, error: insertError } = await supabase
            .from("user_addresses")
            .insert({
              user_id: user.id,
              ...fields,
              is_default: saveForNextTime && addresses.length === 0,
              is_checkout_only: !saveForNextTime,
            })
            .select("id,user_id,full_name,phone,address_line,city,state,landmark,is_default,is_checkout_only,created_at")
            .single();
          if (insertError) {
            console.error("Unable to save checkout address:", insertError.message);
            setError(insertError.message.includes("five addresses")
              ? "You already have five saved addresses. Remove one in Settings or uncheck “Save this address for next time”."
              : "The delivery address could not be saved. Please try again.");
            return;
          }
          address = data as UserAddress;
        }

        if (!address) {
          setError("The delivery address could not be confirmed. Please try again.");
          return;
        }

        setSelectedAddress(address);
        setCheckoutOnlyAddress(address.is_checkout_only ? address : null);
        if (!address.is_checkout_only) {
          setAddresses((current) => [
            ...current.filter((saved) => saved.id !== address!.id),
            address!,
          ].sort((left, right) => left.created_at.localeCompare(right.created_at)));
        }
        setAddressFormOpen(false);
        setAddressChoicesOpen(false);
        setAddressConfirmed(false);
        setIsReadyForPayment(false);
        setIsDirty(false);
      })();
      return;
    }

    if (!selectedAddress) {
      setError("Choose or add a delivery address before continuing.");
      return;
    }
    setAddressConfirmed(true);
    setIsReadyForPayment(true);
  };

  const startAddingAddress = () => {
    setError(null);
    setAddressConfirmed(false);
    setIsReadyForPayment(false);
    setAddressChoicesOpen(false);
    setAddressFormOpen(true);
    setSaveForNextTime(true);
    setDraft({
      full_name: user?.full_name ?? "",
      phone: user?.phone ?? "",
      address_line: "",
      city: "",
      state: "",
      landmark: "",
    });
  };

  if (addressLoading) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-sm text-muted" role="status">
        Loading delivery addresses…
      </div>
    );
  }

  if (isReadyForPayment && selectedAddress) {
    return (
      <div className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-sm" data-checkout-step="payment-options">
        <div className="space-y-2">
          <h3 className="font-semibold text-text">Order Summary</h3>
          <div className="space-y-1 text-sm text-muted">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span>Subtotal:</span>
              <span className="break-words text-right font-display">₦{subtotal.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span>Delivery Fee:</span>
              <span className="break-words text-right font-display">₦{deliveryFee.toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-1 font-semibold text-text">
              <span>Total:</span>
              <span className="break-words text-right font-display">₦{total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-text">Deliver to</h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setIsReadyForPayment(false);
                setAddressConfirmed(false);
              }}
            >
              Change address
            </Button>
          </div>
          <p className="break-words text-sm text-muted">
            {selectedAddress.full_name}, {selectedAddress.phone}, {formatUserAddress(selectedAddress)}
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-text">Seller orders</h3>
          <p className="text-sm text-muted">
            Each seller order is created when you choose a payment option. Pay sellers one at a time.
          </p>
          {vendorGroups.map((group) => {
            const vendorName = group.items[0]?.vendor?.shop_name ?? "Vendor Store";
            const vendorSubtotal = group.items.reduce(
              (sum, item) => sum + Number(item.price_at_add ?? item.product.price) * item.quantity,
              0
            );
            const orderItems = group.items.map((item) => ({
              productId: item.product.id,
              quantity: item.quantity,
              variantId: item.variant_id ?? null,
              expectedPrice: Number(item.price_at_add ?? item.product.price),
              selectedSize: item.selected_size ?? null,
              selectedColor: item.selected_color ?? null,
            }));
            return (
              <section key={group.vendorId} className="min-w-0 space-y-3 rounded-md border border-border p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <h4 className="min-w-0 break-words font-semibold text-text">{vendorName}</h4>
                  <span className="min-w-0 break-words text-right text-sm text-muted">₦{(vendorSubtotal + 1000).toLocaleString()}</span>
                </div>
                {group.items.map((item) => (
                  <p key={item.id} className="break-words text-sm text-muted">
                    {item.product.name}{item.selected_size ? ` · Size: ${item.selected_size}` : ""} · Qty {item.quantity}
                  </p>
                ))}
                <PaymentButtons
                  items={orderItems}
                  addressId={selectedAddress.id}
                  addressConfirmed={addressConfirmed}
                  customerName={selectedAddress.full_name}
                  email={user?.email ?? ""}
                  customerPhone={selectedAddress.phone}
                />
              </section>
            );
          })}
        </div>

      </div>
    );
  }

  return (
    <form
      onSubmit={handleCheckoutSubmit}
      data-unsaved-form={isDirty ? "true" : undefined}
      className="space-y-4 rounded-lg border border-border bg-surface p-6 shadow-sm"
    >
      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger-text">
          {error}
        </div>
      )}

      {unresolvedQuantity > 0 && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm font-medium text-text">
          Choose options for {unresolvedQuantity} items to continue.
        </div>
      )}
      {hasPriceChange && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm font-medium text-text">
          A product price changed. Return to your cart to review and accept the updated price.
        </div>
      )}

      {!user?.email && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-text">
          You must be signed in to place an order.
        </div>
      )}

      {addressLoadError && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger-text" role="alert">
          <p>{addressLoadError}</p>
          <Button type="button" className="mt-3" variant="outline" onClick={() => setAddressRetry((count) => count + 1)}>
            Retry
          </Button>
        </div>
      )}

      {addressFormOpen ? (
        <section className="space-y-4" aria-labelledby="checkout-address-title">
          <h3 id="checkout-address-title" className="font-semibold text-text">
            {addresses.length === 0 ? "Delivery address" : "Add a delivery address"}
          </h3>
          <div>
            <label htmlFor="checkout-full-name" className="block text-sm font-medium text-text">Full name</label>
            <Input
              id="checkout-full-name"
              autoComplete="name"
              maxLength={100}
              required
              value={draft.full_name}
              onChange={(event) => {
                setDraft((current) => ({ ...current, full_name: event.target.value }));
                setIsDirty(true);
              }}
            />
          </div>
          <div>
            <label htmlFor="checkout-phone" className="block text-sm font-medium text-text">Nigerian phone number</label>
            <Input
              id="checkout-phone"
              type="tel"
              autoComplete="tel"
              maxLength={13}
              required
              value={draft.phone}
              onChange={(event) => {
                setDraft((current) => ({ ...current, phone: event.target.value }));
                setIsDirty(true);
              }}
            />
          </div>
          <div>
            <label htmlFor="checkout-address-line" className="block text-sm font-medium text-text">Address</label>
            <Input
              id="checkout-address-line"
              autoComplete="street-address"
              maxLength={250}
              required
              value={draft.address_line}
              onChange={(event) => {
                setDraft((current) => ({ ...current, address_line: event.target.value }));
                setIsDirty(true);
              }}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="checkout-city" className="block text-sm font-medium text-text">City</label>
              <Input
                id="checkout-city"
                autoComplete="address-level2"
                maxLength={100}
                required
                value={draft.city}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, city: event.target.value }));
                  setIsDirty(true);
                }}
              />
            </div>
            <div>
              <label htmlFor="checkout-state" className="block text-sm font-medium text-text">State</label>
              <Input
                id="checkout-state"
                autoComplete="address-level1"
                maxLength={100}
                required
                value={draft.state}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, state: event.target.value }));
                  setIsDirty(true);
                }}
              />
            </div>
          </div>
          <div>
            <label htmlFor="checkout-landmark" className="block text-sm font-medium text-text">Landmark (optional)</label>
            <Input
              id="checkout-landmark"
              maxLength={150}
              value={draft.landmark}
              onChange={(event) => {
                setDraft((current) => ({ ...current, landmark: event.target.value }));
                setIsDirty(true);
              }}
            />
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm text-text">
            <input
              type="checkbox"
              checked={saveForNextTime}
              onChange={(event) => setSaveForNextTime(event.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            Save this address for next time
          </label>
          <div className="space-y-2 rounded-md bg-bg p-4">
            <h4 className="font-semibold text-text">Order summary</h4>
            <ul className="space-y-1 text-sm text-muted">
              {items.map((item) => (
                <li key={item.id} className="break-words">
                  {item.product.name} · Qty {item.quantity}
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold text-text">
              <span>Total</span>
              <span>₦{total.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {addresses.length > 0 && (
              <Button type="button" variant="outline" className="w-full" onClick={() => {
                setAddressFormOpen(false);
                setAddressChoicesOpen(true);
              }}>
                Back to saved addresses
              </Button>
            )}
            <Button
              type="submit"
              disabled={items.length === 0 || !user?.email || unresolvedQuantity > 0 || hasPriceChange || !!addressLoadError}
              className="w-full"
            >
              Review delivery address
            </Button>
          </div>
        </section>
      ) : addressChoicesOpen ? (
        <section className="space-y-3" aria-labelledby="checkout-addresses-title">
          <h3 id="checkout-addresses-title" className="font-semibold text-text">Choose a delivery address</h3>
          {addresses.map((address) => (
            <button
              key={address.id}
              type="button"
              onClick={() => {
                setSelectedAddress(address);
                setAddressChoicesOpen(false);
                setAddressConfirmed(false);
                setError(null);
              }}
              className="block min-h-14 w-full rounded-lg border border-border p-3 text-left text-sm text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block font-medium">{address.full_name} · {address.phone}{address.is_default ? " · Default" : ""}</span>
              <span className="mt-1 block break-words text-muted">{formatUserAddress(address)}</span>
            </button>
          ))}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" className="w-full" onClick={startAddingAddress}>Add a new address</Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setAddressChoicesOpen(false)}>Back</Button>
          </div>
        </section>
      ) : selectedAddress ? (
        <section className="space-y-4" aria-labelledby="checkout-confirm-title">
          <div className="rounded-lg border border-border bg-bg p-4">
            <h3 id="checkout-confirm-title" className="font-semibold text-text">Confirm delivery address</h3>
            <p className="mt-2 break-words text-sm text-text">
              Deliver to: {selectedAddress.full_name}, {selectedAddress.phone}, {formatUserAddress(selectedAddress)}
            </p>
          </div>
          <div className="space-y-2 rounded-md bg-bg p-4">
            <h3 className="font-semibold text-text">Order summary</h3>
            <ul className="space-y-1 text-sm text-muted">
              {items.map((item) => (
                <li key={item.id} className="break-words">
                  {item.product.name} · Qty {item.quantity}
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold text-text">
              <span>Total</span>
              <span>₦{total.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="submit"
              disabled={items.length === 0 || !user?.email || unresolvedQuantity > 0 || hasPriceChange || !!addressLoadError}
              className="w-full"
            >
              Yes, this is correct
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setAddressChoicesOpen(true)}>
              Change address
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={startAddingAddress}>
              Add a new address
            </Button>
          </div>
        </section>
      ) : (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger-text">
          No delivery address is available. Add an address to continue.
          <Button type="button" className="mt-3" onClick={startAddingAddress}>Add address</Button>
        </div>
      )}
    </form>
  );
}
