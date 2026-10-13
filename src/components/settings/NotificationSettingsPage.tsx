"use client";

import { useState } from "react";
import { useUserPreferences, PreferencesLoading, PreferenceSwitch } from "./PreferencesPage";

export default function NotificationSettingsPage() {
  const { preferences, loading, saving, error, retry, save } = useUserPreferences();
  const [pending, setPending] = useState(false);

  const update = async (key: "notify_delivery" | "notify_promotions" | "notify_messages", enabled: boolean) => {
    setPending(true);
    await save({ ...preferences, [key]: enabled, notify_orders: true });
    setPending(false);
  };

  return (
    <PreferencesLoading loading={loading} error={error} retry={retry}>
      <section className="bg-surface">
        <p className="px-4 pt-4 text-sm text-muted">
          Order and security alerts stay on. Preferences are stored for your account; delivery and promotional alerts are not currently sent separately.
        </p>
        <PreferenceSwitch
          label="Order updates"
          description="Required order and security alerts cannot be turned off."
          checked={true}
        />
        <div className="flex min-h-[68px] items-center border-b border-border px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-text">Delivery updates</span>
            <span className="mt-0.5 block text-xs text-muted">Delivery details are currently included with order alerts.</span>
          </span>
          <span className="ml-auto shrink-0 text-xs font-semibold text-muted">Included</span>
        </div>
        <div className="flex min-h-[68px] items-center border-b border-border px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-text">Promotions</span>
            <span className="mt-0.5 block text-xs text-muted">Promotional messages are not currently sent.</span>
          </span>
          <span className="ml-auto shrink-0 text-xs font-semibold text-muted">Unavailable</span>
        </div>
        <PreferenceSwitch
          label="Messages"
          description="Message alerts are shown in the site."
          checked={preferences.notify_messages}
          disabled={saving || pending}
          onChange={(enabled) => void update("notify_messages", enabled)}
        />
        <p className="px-4 py-4 text-xs text-muted">Email, push, and SMS notification controls are not available.</p>
      </section>
    </PreferencesLoading>
  );
}
