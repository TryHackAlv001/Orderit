"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import {
  formatUserAddress,
  normalizeUserAddressDraft,
  USER_ADDRESS_LIMITS,
  validateUserAddressDraft,
  type UserAddress,
  type UserAddressDraft,
} from "@/lib/user-addresses";
import { SettingsLoadError, SettingsShell, SettingsSkeleton } from "@/components/settings/SettingsShell";

const EMPTY_DRAFT: UserAddressDraft = {
  full_name: "",
  phone: "",
  address_line: "",
  city: "",
  state: "",
  landmark: "",
};

const ADDRESS_COLUMNS = "id,user_id,full_name,phone,address_line,city,state,landmark,is_default,is_checkout_only,created_at";

export default function AddressesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState<UserAddressDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyAddressId, setBusyAddressId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadAddresses = useCallback(async () => {
    if (!user?.id) return;
    setLoadError(null);
    const { data, error } = await createClient()
      .from("user_addresses")
      .select(ADDRESS_COLUMNS)
      .eq("user_id", user.id)
      .eq("is_checkout_only", false)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Unable to load saved addresses:", error.message);
      setLoadError("Saved addresses could not be loaded.");
      return;
    }
    setAddresses((data ?? []) as UserAddress[]);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) void loadAddresses();
  }, [loadAddresses, retry, user?.id]);

  const openNewAddressForm = () => {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT });
    setFormError(null);
    setNotice(null);
    setFormOpen(true);
  };

  const openEditAddressForm = (address: UserAddress) => {
    setEditingId(address.id);
    setDraft({
      full_name: address.full_name,
      phone: address.phone,
      address_line: address.address_line,
      city: address.city,
      state: address.state,
      landmark: address.landmark ?? "",
    });
    setFormError(null);
    setNotice(null);
    setFormOpen(true);
  };

  const saveAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    const validationError = validateUserAddressDraft(draft);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (!user?.id) {
      setFormError("Please sign in again to manage saved addresses.");
      return;
    }
    if (!editingId && addresses.length >= 5) {
      setFormError("You can save up to five addresses. Delete one before adding another.");
      return;
    }

    setBusy(true);
    const supabase = createClient();
    const normalized = normalizeUserAddressDraft(draft);
    const values = {
      ...normalized,
      landmark: normalized.landmark || null,
    };
    const result = editingId
      ? await supabase
          .from("user_addresses")
          .update(values)
          .eq("id", editingId)
          .eq("user_id", user.id)
          .eq("is_checkout_only", false)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("user_addresses")
          .insert({ user_id: user.id, ...values, is_default: addresses.length === 0 })
          .select("id")
          .maybeSingle();

    if (result.error || !result.data) {
      console.error("Unable to save address:", result.error?.message ?? "No address row was updated");
      setFormError(result.error?.message.includes("five addresses")
        ? "You can save up to five addresses. Delete one before adding another."
        : "The address could not be saved. Please try again.");
      setBusy(false);
      return;
    }

    setBusy(false);
    setFormOpen(false);
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT });
    setNotice(editingId ? "Address updated." : "Address saved.");
    await loadAddresses();
  };

  const setDefaultAddress = async (addressId: string) => {
    if (!user?.id) return;
    setBusyAddressId(addressId);
    setFormError(null);
    const { data, error } = await createClient()
      .from("user_addresses")
      .update({ is_default: true })
      .eq("id", addressId)
      .eq("user_id", user.id)
      .eq("is_checkout_only", false)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      console.error("Unable to set default address:", error?.message ?? "No address row was updated");
      setFormError("The default address could not be changed. Please try again.");
    } else {
      setNotice("Default address updated.");
      await loadAddresses();
    }
    setBusyAddressId(null);
  };

  const deleteAddress = async (address: UserAddress) => {
    if (!user?.id || !window.confirm(`Delete the address for ${address.full_name}?`)) return;
    setBusyAddressId(address.id);
    setFormError(null);
    setNotice(null);
    const { data, error } = await createClient()
      .from("user_addresses")
      .delete()
      .eq("id", address.id)
      .eq("user_id", user.id)
      .eq("is_checkout_only", false)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      console.error("Unable to delete address:", error?.message ?? "No address row was deleted");
      setFormError("The address could not be deleted. Please try again.");
    } else {
      setNotice(address.is_default && addresses.length > 1
        ? "Address deleted. The oldest remaining address is now the default."
        : "Address deleted.");
      await loadAddresses();
    }
    setBusyAddressId(null);
  };

  if (authLoading || !user) {
    return <SettingsShell title="Addresses"><SettingsSkeleton rows={3} /></SettingsShell>;
  }

  if (loadError) {
    return (
      <SettingsShell title="Addresses">
        <SettingsLoadError message={loadError} onRetry={() => setRetry((count) => count + 1)} />
      </SettingsShell>
    );
  }

  return (
    <SettingsShell title="Addresses">
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Manage the delivery addresses saved to your account.</p>
            <p className="mt-1 text-xs text-muted">{addresses.length} of 5 saved addresses</p>
          </div>
          {!formOpen && addresses.length < 5 && (
            <Button type="button" onClick={openNewAddressForm}>Add address</Button>
          )}
        </div>

        {(formError || notice) && (
          <p
            role={formError ? "alert" : "status"}
            className={`rounded-md border p-3 text-sm ${formError
              ? "border-danger/30 bg-danger/10 text-danger-text"
              : "border-border bg-bg text-text"}`}
          >
            {formError || notice}
          </p>
        )}

        {formOpen && (
          <form onSubmit={saveAddress} className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <h2 className="font-semibold text-text">{editingId ? "Edit address" : "Add address"}</h2>
            <div>
              <label htmlFor="saved-address-name" className="block text-sm font-medium text-text">Full name</label>
              <Input
                id="saved-address-name"
                maxLength={USER_ADDRESS_LIMITS.full_name}
                autoComplete="name"
                required
                value={draft.full_name}
                onChange={(event) => setDraft((current) => ({ ...current, full_name: event.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="saved-address-phone" className="block text-sm font-medium text-text">Nigerian phone number</label>
              <Input
                id="saved-address-phone"
                type="tel"
                maxLength={USER_ADDRESS_LIMITS.phone}
                autoComplete="tel"
                required
                value={draft.phone}
                onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="saved-address-line" className="block text-sm font-medium text-text">Address</label>
              <Input
                id="saved-address-line"
                maxLength={USER_ADDRESS_LIMITS.address_line}
                autoComplete="street-address"
                required
                value={draft.address_line}
                onChange={(event) => setDraft((current) => ({ ...current, address_line: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="saved-address-city" className="block text-sm font-medium text-text">City</label>
                <Input
                  id="saved-address-city"
                  maxLength={USER_ADDRESS_LIMITS.city}
                  autoComplete="address-level2"
                  required
                  value={draft.city}
                  onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="saved-address-state" className="block text-sm font-medium text-text">State</label>
                <Input
                  id="saved-address-state"
                  maxLength={USER_ADDRESS_LIMITS.state}
                  autoComplete="address-level1"
                  required
                  value={draft.state}
                  onChange={(event) => setDraft((current) => ({ ...current, state: event.target.value }))}
                />
              </div>
            </div>
            <div>
              <label htmlFor="saved-address-landmark" className="block text-sm font-medium text-text">Landmark (optional)</label>
              <Input
                id="saved-address-landmark"
                maxLength={USER_ADDRESS_LIMITS.landmark}
                value={draft.landmark}
                onChange={(event) => setDraft((current) => ({ ...current, landmark: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Save address"}</Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                className="w-full"
                onClick={() => {
                  setFormOpen(false);
                  setEditingId(null);
                  setFormError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {addresses.length === 0 && !formOpen && (
          <div className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
            No saved addresses yet.
          </div>
        )}

        <div className="space-y-3">
          {addresses.map((address) => (
            <article key={address.id} className="space-y-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="break-words font-semibold text-text">
                    {address.full_name}{address.is_default && (
                      <span className="ml-2 inline-flex rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent-text">
                        Default
                      </span>
                    )}
                  </h2>
                  <p className="mt-1 text-sm text-text">{address.phone}</p>
                  <p className="mt-1 break-words text-sm text-muted">{formatUserAddress(address)}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!address.is_default && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyAddressId === address.id}
                    className="w-full"
                    onClick={() => void setDefaultAddress(address.id)}
                  >
                    Set as default
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyAddressId === address.id}
                  className="w-full"
                  onClick={() => openEditAddressForm(address)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyAddressId === address.id}
                  className="w-full"
                  onClick={() => void deleteAddress(address)}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </SettingsShell>
  );
}
