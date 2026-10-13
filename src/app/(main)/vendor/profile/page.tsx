'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/store/authStore';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { User, VendorProfile } from '@/types';

export default function VendorProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrls, setAvatarUrls] = useState<string[]>([]);

  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [location, setLocation] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id ?? user?.id;

        if (!userId) {
          router.push('/login');
          return;
        }

        const { data: userRecord, error: userError } = await supabase
          .from('users')
          .select('id, email, full_name, phone, avatar_url, role, created_at')
          .eq('id', userId)
          .single();

        if (userError || !userRecord) {
          throw userError ?? new Error('Unable to load user');
        }

        if (userRecord.role !== 'vendor') {
          router.push('/marketplace');
          return;
        }

        setCurrentUser(userRecord as User);
        setFullName(userRecord.full_name ?? '');
        setPhone(userRecord.phone ?? '');
        setAvatarUrls(userRecord.avatar_url ? [userRecord.avatar_url] : []);

        const { data: profileRecord, error: profileError } = await supabase
          .from('vendor_profiles')
          .select('id, user_id, shop_name, shop_description, location')
          .eq('user_id', userId)
          .single();

        if (profileError || !profileRecord) {
          throw profileError ?? new Error('Unable to load vendor profile');
        }

        setVendorProfile(profileRecord as VendorProfile);
        setShopName(profileRecord.shop_name ?? '');
        setShopDescription(profileRecord.shop_description ?? '');
        setLocation(profileRecord.location ?? '');
      } catch (error) {
        console.error('Vendor profile load error', error);
        setErrorMessage('Unable to load account information.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router, supabase, user]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentUser || !vendorProfile) {
      setErrorMessage('Unable to save account: missing profile.');
      return;
    }

    setSaving(true);

    try {
      const avatarUrl = avatarUrls[0] ?? null;

      const { error: userError } = await supabase
        .from('users')
        .update({
          full_name: fullName || null,
          phone: phone || null,
          avatar_url: avatarUrl,
        })
        .eq('id', currentUser.id);

      if (userError) throw userError;

      const { error: vendorError } = await supabase
        .from('vendor_profiles')
        .update({
          shop_name: shopName || null,
          shop_description: shopDescription || null,
          location: location || null,
        })
        .eq('id', vendorProfile.id);

      if (vendorError) throw vendorError;

      const updatedUser = {
        ...currentUser,
        full_name: fullName || undefined,
        phone: phone || undefined,
        avatar_url: avatarUrl || undefined,
      };

      setUser(updatedUser as User);
      setCurrentUser(updatedUser as User);
      setSuccessMessage('Profile updated successfully!');
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      console.error('Save vendor profile error', error);
      const message = error?.message ?? 'Unable to save changes.';
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordSuccessMessage(null);

    if (!newPassword || !confirmPassword || !currentPassword) {
      setPasswordMessage('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters.');
      return;
    }

    setPasswordSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccessMessage('Password changed successfully!');
      toast.success('Password updated successfully!');
    } catch (error: any) {
      console.error('Password update error', error);
      const message = error?.message ?? 'Unable to update password.';
      setPasswordMessage(message);
      toast.error(message);
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bg px-0 py-12 md:px-4">
        <div className="rounded-lg border border-border bg-surface p-10 text-center shadow-sm">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent-text" />
          <p className="mt-4 text-sm font-medium text-text">Loading your profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-svh bg-bg py-10">
      <Toaster position="top-right" toastOptions={{ style: { background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)" }, success: { iconTheme: { primary: "var(--primary)", secondary: "var(--primary-foreground)" } }, error: { iconTheme: { primary: "var(--primary)", secondary: "var(--primary-foreground)" } } }} />
      <div className="mx-auto w-full max-w-6xl px-0 md:px-4">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-accent-text">Vendor Account</p>
            <h1 className="mt-2 text-3xl font-bold text-text">My Profile</h1>
          </div>
          <Link href="/vendor/settings" className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-on transition hover:bg-accent-hover">
            Full Store Settings
          </Link>
        </div>

        {errorMessage ? (
          <div className="mb-6 rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger-text">
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSave} className="space-y-8">
          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text">Personal Info</h2>
                <p className="text-sm text-muted">Update your account details and avatar.</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">Profile Avatar</label>
                  <ImageUpload value={avatarUrls} onChange={setAvatarUrls} maxImages={1} pathPrefix="avatars/" />
                </div>

                <div>
                  <label htmlFor="fullName" className="block text-sm font-medium text-text mb-2">Full Name</label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-text mb-2">Phone Number</label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-text mb-2">Email Address</label>
                  <Input
                    id="email"
                    type="email"
                    value={currentUser?.email ?? ''}
                    disabled
                    className="cursor-not-allowed bg-surface-raised text-muted"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-text">Store Info</h2>
                <p className="text-sm text-muted">Quick shop details. Manage the full store profile in settings.</p>
              </div>
              <Link href="/vendor/settings" className="text-sm font-semibold text-accent-text hover:text-accent-text">
                Full Store Settings
              </Link>
            </div>

            <div className="space-y-6">
              <div>
                <label htmlFor="shopName" className="block text-sm font-medium text-text mb-2">Shop Name</label>
                <Input
                  id="shopName"
                  type="text"
                  value={shopName}
                  onChange={(event) => setShopName(event.target.value)}
                  placeholder="Enter your shop name"
                />
              </div>

              <div>
                <label htmlFor="shopDescription" className="block text-sm font-medium text-text mb-2">Shop Description</label>
                <textarea
                  id="shopDescription"
                  value={shopDescription}
                  onChange={(event) => setShopDescription(event.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text shadow-sm outline-none transition-colors duration-200 focus:border-accent focus:ring-2 focus:ring-ring"
                  placeholder="Short summary of your shop"
                />
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-text mb-2">Location</label>
                <Input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="Enter your shop location"
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-text">Change Password</h2>
              <p className="text-sm text-muted">Update your account password securely.</p>
            </div>

            {passwordMessage ? (
              <div className="mb-4 rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger-text">
                {passwordMessage}
              </div>
            ) : null}
            {passwordSuccessMessage ? (
              <div className="mb-4 rounded-lg border border-accent bg-accent/10 p-4 text-sm text-accent-text">
                {passwordSuccessMessage}
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-3">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-text mb-2">Current Password</label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Current password"
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-text mb-2">New Password</label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="New password"
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text mb-2">Confirm Password</label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted">Updates will be saved to your account and quick vendor profile.</div>
            <Button type="submit" className="bg-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-muted">
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
