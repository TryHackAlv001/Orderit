"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/authStore";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { SettingsLoadError, SettingsShell, SettingsSkeleton } from "@/components/settings/SettingsShell";

type ProfileRecord = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
};

export default function ProfilePage() {
  const { user: authUser, isLoading: authLoading } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string[]>([]);
  const [emailVerified, setEmailVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  const loadProfile = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const [{ data, error: profileError }, { data: authData, error: authError }] = await Promise.all([
      supabase.from("users").select("id,email,full_name,phone,avatar_url").eq("id", authUser.id).single(),
      supabase.auth.getUser(),
    ]);
    if (profileError || authError || !data) {
      const cause = profileError ?? authError;
      console.error("Unable to load account profile:", cause?.message);
      setError("Your profile could not be loaded.");
    } else {
      const record = data as ProfileRecord;
      setProfile(record);
      setFullName(record.full_name ?? "");
      setPhone(record.phone ?? "");
      setAvatarUrl(record.avatar_url ? [record.avatar_url] : []);
      setEmailVerified(!!authData.user?.email_confirmed_at);
    }
    setLoading(false);
  }, [authUser]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile, retry]);

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authUser || !profile) return;
    const trimmedName = fullName.trim();
    const normalizedPhone = phone.trim();
    if (!trimmedName || trimmedName.length > 100) {
      const message = "Enter a name between 1 and 100 characters.";
      setError(message);
      toast.error(message);
      return;
    }
    if (normalizedPhone && !/^[+()\d\s.-]{7,24}$/.test(normalizedPhone)) {
      const message = "Enter a valid phone number.";
      setError(message);
      toast.error(message);
      return;
    }

    setSaving(true);
    setError(null);
    const { data: savedRecord, error: saveError } = await createClient()
      .from("users")
      .update({
        full_name: trimmedName,
        phone: normalizedPhone || null,
        avatar_url: avatarUrl[0] ?? null,
      })
      .eq("id", authUser.id)
      .select("id")
      .maybeSingle();
    if (saveError || !savedRecord) {
      console.error("Unable to save account profile:", saveError?.message ?? "The profile row was not updated.");
      setError("Your profile could not be saved. Please try again.");
      toast.error("Your profile could not be saved.");
      setSaving(false);
      return;
    }

    const updatedProfile = {
      ...profile,
      full_name: trimmedName,
      phone: normalizedPhone || null,
      avatar_url: avatarUrl[0] ?? null,
    };
    setProfile(updatedProfile);
    setUser({ ...authUser, full_name: trimmedName, phone: normalizedPhone || undefined, avatar_url: avatarUrl[0] || undefined });
    toast.success("Profile saved.");
    setSaving(false);
  };

  if (authLoading || loading) {
    return <SettingsShell title="Profile"><SettingsSkeleton rows={4} /></SettingsShell>;
  }
  if (error) {
    return <SettingsShell title="Profile"><SettingsLoadError message={error} onRetry={() => setRetry((version) => version + 1)} /></SettingsShell>;
  }
  if (!profile) return null;

  return (
    <SettingsShell title="Profile">
      <form onSubmit={(event) => void saveProfile(event)} className="space-y-3">
        <section className="space-y-5 bg-surface p-4 sm:p-5">
          <div>
            <h2 className="font-semibold text-text">Personal details</h2>
            <p className="mt-1 text-sm text-muted">Keep your account contact details up to date.</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-text" htmlFor="profile-photo">Profile photo</label>
            <div id="profile-photo" className="max-w-fit">
              <ImageUpload
                value={avatarUrl}
                onChange={setAvatarUrl}
                maxImages={1}
                pathPrefix={`avatars/${authUser?.id ?? "user"}/`}
              />
            </div>
            <p className="mt-2 text-xs text-muted">JPG, PNG, or WEBP, up to 5 MB. The image is center-cropped to fit.</p>
          </div>
          <div>
            <label htmlFor="profile-name" className="mb-1 block text-sm font-medium text-text">Display name</label>
            <input
              id="profile-name"
              type="text"
              autoComplete="name"
              maxLength={100}
              required
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="profile-phone" className="mb-1 block text-sm font-medium text-text">Phone number</label>
            <input
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="mb-1 block text-sm font-medium text-text">Email</label>
            <input
              id="profile-email"
              type="email"
              readOnly
              value={profile.email}
              className="min-h-11 w-full rounded-lg border border-border bg-surface-raised px-3 text-text"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className={emailVerified ? "font-medium text-accent-text" : "font-medium text-muted"}>
                {emailVerified ? "Verified" : "Not verified"}
              </span>
              {!emailVerified && (
                <a href="/settings/security" className="inline-flex min-h-11 items-center font-semibold text-accent-text underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Verify email
                </a>
              )}
            </div>
          </div>
          {error && <p role="alert" className="rounded-lg border border-danger bg-danger/10 p-3 text-sm text-danger-text">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-accent-on hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </section>
      </form>
    </SettingsShell>
  );
}
