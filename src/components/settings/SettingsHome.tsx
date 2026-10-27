"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Globe2,
  LockKeyhole,
  LogOut,
  MapPin,
  ShieldCheck,
  Share2,
  Store,
  UserRound,
  WalletCards,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { SettingsLoadError, SettingsShell, SettingsSkeleton, SignOutDialog } from "./SettingsShell";
import ThemePreferenceControl from "./ThemePreferenceControl";

type SettingsData = {
  emailVerified: boolean;
  mfaRequired: boolean;
  securityChecksComplete: boolean;
  vendorProfile: { id: string; shop_name: string } | null;
};

function SettingsRow({
  href,
  label,
  value,
  icon: Icon,
}: {
  href: string;
  label: string;
  value?: string;
  icon?: typeof UserRound;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-14 min-w-0 items-center gap-3 border-b border-border px-4 text-text transition-colors hover:bg-surface-raised focus-visible:z-sticky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {Icon && <Icon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      {value && <span className="min-w-0 max-w-[42%] shrink-0 truncate text-right text-sm text-muted">{value}</span>}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
    </Link>
  );
}

function SecurityCard({ href, label, icon: Icon }: { href: string; label: string; icon: typeof LockKeyhole }) {
  return (
    <Link
      href={href}
      className="flex min-h-24 flex-col justify-between rounded-xl border border-border bg-surface p-3 text-text transition-colors hover:border-accent hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <Icon className="h-5 w-5 text-accent-text" aria-hidden="true" />
        <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
      </div>
      <span className="line-clamp-2 text-sm font-medium">{label}</span>
    </Link>
  );
}

export default function SettingsHome() {
  const { user, isLoading, signOut } = useAuth();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [insideVendorDashboard, setInsideVendorDashboard] = useState(false);

  useEffect(() => {
    setInsideVendorDashboard(new URLSearchParams(window.location.search).get("from") === "vendor");
  }, []);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    const supabase = createClient();
    const [{ data: authData, error: authError }, { data: vendorProfile, error: vendorError }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("vendor_profiles").select("id,shop_name").eq("user_id", user.id).maybeSingle(),
    ]);
    if (authError || vendorError) {
      const error = authError ?? vendorError;
      console.error("Unable to load settings:", error?.message);
      setLoadError("Settings could not be loaded.");
      return;
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setData({
      emailVerified: !!authData.user?.email_confirmed_at,
      mfaRequired: !factorsError && !assuranceError && (factors?.totp ?? []).some((factor) => factor.status === "verified")
        ? assurance.currentLevel !== "aal2"
        : false,
      securityChecksComplete: !factorsError && !assuranceError,
      vendorProfile,
    });
  }, [user]);

  useEffect(() => {
    if (user) void loadSettings();
  }, [loadSettings, retry, user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSignOutOpen(false);
    setSigningOut(false);
  };

  const shareTradeloft = async () => {
    const shareData = { title: "Tradeloft", url: window.location.origin };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast.success("Link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(shareData.url);
        toast.success("Link copied");
      } catch (copyError) {
        console.error("Unable to share or copy Tradeloft link:", copyError);
        toast.error("The link could not be copied. Please try again.");
      }
    }
  };

  if (isLoading || !user || (!data && !loadError)) {
    return <SettingsShell title="Settings"><SettingsSkeleton rows={6} /></SettingsShell>;
  }

  if (loadError) {
    return (
      <SettingsShell title="Settings">
        <SettingsLoadError message={loadError} onRetry={() => setRetry((version) => version + 1)} />
      </SettingsShell>
    );
  }

  const protectedAccount = !!data?.emailVerified && !!data.securityChecksComplete && !data.mfaRequired;
  const switchLabel = insideVendorDashboard ? "Switch to shopping" : "Switch to vendor dashboard";

  return (
    <SettingsShell title="Settings" backHref={data?.vendorProfile ? "/vendor/profile" : "/buyer/profile"}>
      <div className="space-y-3">
        <section className="border-b-[6px] border-bg bg-surface py-2" aria-label="Profile">
          <SettingsRow href="/buyer/profile" label="Profile" value={user.full_name || "Add your name"} icon={UserRound} />
        </section>

        <section className="border-b-[6px] border-bg bg-surface p-4 sm:p-5">
          <h2 className="text-base font-semibold text-text">
            {protectedAccount ? "Your account is protected" : "Keep your account secure"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {protectedAccount
              ? "Your email is verified and your account security checks are up to date."
              : !data?.emailVerified
                ? "Verify your email to help secure your account."
                : "We could not confirm all security checks. Review your account security."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <SecurityCard href="/settings/security" label="Account security" icon={LockKeyhole} />
            <SecurityCard href="/settings/privacy" label="Privacy" icon={ShieldCheck} />
            <SecurityCard href="/settings/safety-center" label="Safety center" icon={CircleHelp} />
          </div>
        </section>

        <section className="border-b-[6px] border-bg bg-surface py-2" aria-labelledby="settings-account-title">
          <h2 id="settings-account-title" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Account</h2>
          {data?.vendorProfile && <SettingsRow href="/vendor/settings" label="Shop settings" value={data.vendorProfile.shop_name} icon={Store} />}
          <SettingsRow href="/settings/notifications" label="Notifications" icon={Bell} />
          <SettingsRow href="/settings/addresses" label="Addresses" icon={MapPin} />
          <div className="flex min-h-14 items-center gap-3 border-b border-border px-4">
            <Globe2 className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm font-medium text-text">Language</span>
            <span className="text-sm text-muted">English</span>
          </div>
          <div className="flex min-h-14 items-center gap-3 px-4">
            <WalletCards className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm font-medium text-text">Currency</span>
            <span className="text-sm text-muted">NGN</span>
          </div>
        </section>

        <ThemePreferenceControl />

        <section className="border-b-[6px] border-bg bg-surface py-2" aria-labelledby="settings-info-title">
          <h2 id="settings-info-title" className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Information</h2>
          <SettingsRow href="/about" label="About Tradeloft" />
          <SettingsRow href="/terms" label="Legal terms & policies" />
          <button
            type="button"
            onClick={shareTradeloft}
            className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-medium text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <Share2 className="h-5 w-5 text-muted" aria-hidden="true" />
            <span className="flex-1">Share Tradeloft</span>
            <ChevronRight className="h-4 w-4 text-muted" aria-hidden="true" />
          </button>
        </section>

        {data?.vendorProfile && (
          <section className="border-b-[6px] border-bg bg-surface py-2" aria-label="Vendor account">
            <SettingsRow href={insideVendorDashboard ? "/marketplace" : "/vendor/dashboard"} label={switchLabel} icon={Store} />
          </section>
        )}

        <button
          type="button"
          onClick={() => setSignOutOpen(true)}
          className="flex min-h-14 w-full items-center gap-3 border-y border-border bg-surface px-4 text-left text-sm font-semibold text-danger-text hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          Sign out
          <ChevronRight className="ml-auto h-4 w-4" aria-hidden="true" />
        </button>

        {signOutOpen && (
          <SignOutDialog
            onClose={() => setSignOutOpen(false)}
            onConfirm={() => void handleSignOut()}
            busy={signingOut}
          />
        )}
      </div>
    </SettingsShell>
  );
}
