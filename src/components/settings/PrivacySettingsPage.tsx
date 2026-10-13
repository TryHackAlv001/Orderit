"use client";

import Link from "next/link";
import { useState } from "react";
import { useUserPreferences, PreferencesLoading, PreferenceSwitch } from "./PreferencesPage";

export default function PrivacySettingsPage() {
  const { preferences, loading, saving, error, retry, save } = useUserPreferences();
  const [pending, setPending] = useState(false);

  const setPersonalization = async (enabled: boolean) => {
    setPending(true);
    await save({ ...preferences, personalization_enabled: enabled });
    setPending(false);
  };

  return (
    <PreferencesLoading loading={loading} error={error} retry={retry}>
      <div className="space-y-3">
        <section className="bg-surface p-4 sm:p-5">
          <h2 className="font-semibold text-text">Personalized recommendations</h2>
          <p className="mt-1 text-sm text-muted">
            No personalized recommendation feed is currently active. This preference is saved for future personalization features.
          </p>
          <div className="mt-3 -mx-4 sm:-mx-5">
            <PreferenceSwitch
              label="Allow personalization"
              description="Save your choice for future recommendation features."
              checked={preferences.personalization_enabled}
              disabled={saving || pending}
              onChange={(enabled) => void setPersonalization(enabled)}
            />
          </div>
        </section>
        <Link
          href="/privacy"
          className="flex min-h-14 items-center justify-between bg-surface px-4 text-sm font-medium text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          Privacy Policy <span className="text-muted">›</span>
        </Link>
      </div>
    </PreferencesLoading>
  );
}
