"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { PasswordChangeForm } from "./PasswordChangeForm";
import { SettingsLoadError, SettingsSkeleton, SettingsShell } from "./SettingsShell";

function AccountDeletion() {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const clearCart = useCartStore((state) => state.clearCart);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteAccount = async () => {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The account could not be deleted.");
      await createClient().auth.signOut();
      clearCart();
      clearAuth();
      window.localStorage.removeItem("auth-storage");
      window.localStorage.removeItem("cart-storage");
      router.replace("/");
      toast.success("Your account was deleted.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The account could not be deleted.";
      setError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="border-t-[6px] border-bg bg-surface p-4 sm:p-5">
      <h2 className="font-semibold text-danger-text">Delete my account</h2>
      <p className="mt-2 text-sm text-muted">
        Deletion is blocked while you have open orders or a non-zero wallet balance. Completed order records are retained with your profile details removed. Vendor listings are deactivated and the vendor profile is removed.
      </p>
      <label htmlFor="delete-confirmation" className="mt-4 block text-sm font-medium text-text">
        Type DELETE MY ACCOUNT to confirm
      </label>
      <input
        id="delete-confirmation"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        autoComplete="off"
        className="mt-2 min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {error && <p role="alert" className="mt-3 text-sm text-danger-text">{error}</p>}
      <button
        type="button"
        disabled={deleting || confirmation !== "DELETE MY ACCOUNT"}
        onClick={() => void deleteAccount()}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-danger px-4 text-sm font-semibold text-accent-on hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deleting ? "Deleting account…" : "Delete account"}
      </button>
    </section>
  );
}

export default function AccountSecurityPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [signingOutOthers, setSigningOutOthers] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    const { data, error } = await createClient().auth.getUser();
    if (error) {
      console.error("Unable to load email verification status:", error.message);
      setLoadError("Account security details could not be loaded.");
    } else {
      setEmailVerified(!!data.user?.email_confirmed_at);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus, retry]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resendVerification = async () => {
    if (!user?.email || cooldown > 0) return;
    setResending(true);
    const { error } = await createClient().auth.resend({ type: "signup", email: user.email });
    setResending(false);
    if (error) {
      toast.error(`Verification email could not be sent: ${error.message}`);
      return;
    }
    setCooldown(60);
    toast.success("Verification email sent.");
  };

  const signOutOtherSessions = async () => {
    setSigningOutOthers(true);
    const { error } = await createClient().auth.signOut({ scope: "others" });
    setSigningOutOthers(false);
    if (error) {
      toast.error(`Other sessions could not be signed out: ${error.message}`);
      return;
    }
    toast.success("Other sessions have been signed out.");
  };

  if (authLoading || loading) {
    return <SettingsShell title="Account security"><SettingsSkeleton rows={5} /></SettingsShell>;
  }

  return (
    <SettingsShell title="Account security">
      {loadError ? (
        <SettingsLoadError message={loadError} onRetry={() => setRetry((version) => version + 1)} />
      ) : (
        <div className="space-y-3">
          <section className="bg-surface p-4 sm:p-5">
            <h2 className="font-semibold text-text">Email verification</h2>
            <p className="mt-1 break-all text-sm text-muted">{user?.email}</p>
            <p className={`mt-3 text-sm font-medium ${emailVerified ? "text-accent-text" : "text-muted"}`}>
              {emailVerified ? "Verified" : "Not verified"}
            </p>
            {!emailVerified && (
              <button
                type="button"
                onClick={() => void resendVerification()}
                disabled={resending || cooldown > 0}
                className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification"}
              </button>
            )}
          </section>

          <section className="space-y-4 bg-surface p-4 sm:p-5">
            <PasswordChangeForm />
          </section>

          <section className="bg-surface p-4 sm:p-5">
            <h2 className="font-semibold text-text">Sessions</h2>
            <p className="mt-1 text-sm text-muted">Supabase does not expose a simple session list here, but you can end other sessions.</p>
            <button
              type="button"
              onClick={() => void signOutOtherSessions()}
              disabled={signingOutOthers}
              className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            >
              {signingOutOthers ? "Signing out…" : "Sign out of other sessions"}
            </button>
          </section>

          <AccountDeletion />
        </div>
      )}
    </SettingsShell>
  );
}
