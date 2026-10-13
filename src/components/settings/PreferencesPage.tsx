"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { SettingsLoadError, SettingsSkeleton } from "./SettingsShell";
import {
  isMissingUserPreferencesTable,
  isUserPreferencesTableUnavailable,
  retryUserPreferencesTable,
} from "@/lib/user-preferences";

export type UserPreferences = {
  personalization_enabled: boolean;
  notify_orders: boolean;
  notify_delivery: boolean;
  notify_promotions: boolean;
  notify_messages: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  personalization_enabled: true,
  notify_orders: true,
  notify_delivery: true,
  notify_promotions: false,
  notify_messages: true,
};

const fields = [
  "personalization_enabled",
  "notify_orders",
  "notify_delivery",
  "notify_promotions",
  "notify_messages",
] as const;

export function useUserPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    if (isUserPreferencesTableUnavailable()) {
      setError("Settings are not available yet because the user_preferences database migration has not been applied to this Supabase project.");
      setLoading(false);
      return;
    }
    const { data, error: loadError } = await createClient()
      .from("user_preferences")
      .select(fields.join(","))
      .eq("user_id", user.id)
      .maybeSingle();

    if (loadError) {
      const tableMissing = isMissingUserPreferencesTable(loadError);
      if (!tableMissing) console.error("Unable to load user preferences:", loadError.message);
      setError(tableMissing
        ? "Settings are not available yet because the user_preferences database migration has not been applied to this Supabase project."
        : "Your preferences could not be loaded.");
      setLoading(false);
      return;
    }

    const saved = (data ?? null) as Partial<UserPreferences> | null;
    if (saved) {
      setPreferences({
        personalization_enabled: saved.personalization_enabled ?? DEFAULT_PREFERENCES.personalization_enabled,
        notify_orders: saved.notify_orders ?? DEFAULT_PREFERENCES.notify_orders,
        notify_delivery: saved.notify_delivery ?? DEFAULT_PREFERENCES.notify_delivery,
        notify_promotions: saved.notify_promotions ?? DEFAULT_PREFERENCES.notify_promotions,
        notify_messages: saved.notify_messages ?? DEFAULT_PREFERENCES.notify_messages,
      });
    } else {
      setPreferences(DEFAULT_PREFERENCES);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load, retry]);

  const save = async (next: UserPreferences) => {
    if (!user) return false;
    setSaving(true);
    setError(null);
    const { error: saveError } = await createClient()
      .from("user_preferences")
      .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (saveError) {
      const tableMissing = isMissingUserPreferencesTable(saveError);
      if (!tableMissing) console.error("Unable to save user preferences:", saveError.message);
      const message = tableMissing
        ? "Settings are not available yet because the user_preferences database migration has not been applied to this Supabase project."
        : "Your preferences could not be saved. Please try again.";
      setError(message);
      toast.error(message);
      setSaving(false);
      return false;
    }
    setPreferences(next);
    window.dispatchEvent(new CustomEvent("user-preferences-changed", {
      detail: { notify_messages: next.notify_messages },
    }));
    toast.success("Preferences saved.");
    setSaving(false);
    return true;
  };

  return {
    preferences,
    loading,
    saving,
    error,
    retry: () => {
      retryUserPreferencesTable();
      setRetry((version) => version + 1);
    },
    save,
  };
}

export function PreferencesLoading({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: string | null;
  retry: () => void;
  children: ReactNode;
}) {
  if (loading) return <SettingsSkeleton rows={4} />;
  if (error) return <SettingsLoadError message={error} onRetry={retry} />;
  return children;
}

export function PreferenceSwitch({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex min-h-[68px] items-center gap-4 border-b border-border px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text">{label}</span>
        <span className="mt-0.5 block text-xs text-muted">{description}</span>
      </span>
      {onChange ? (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-11 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "bg-accent" : "bg-surface-raised"}`}
        >
          <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      ) : (
        <span className="shrink-0 text-xs font-semibold text-muted">Always on</span>
      )}
    </div>
  );
}
