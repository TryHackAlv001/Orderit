'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Eye, EyeOff, Save, Loader2 } from 'lucide-react';
import type { User } from '@/types';

interface UserProfile extends User {
  avatar_url?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const supabase = createClient();

  // Profile edit state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Fetch current user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!authUser) return;

      const supabase = createClient();

      try {
        setProfileLoading(true);
        const { data, error } = await supabase
          .from('users')
          .select('id, email, full_name, phone, avatar_url, role')
          .eq('id', authUser.id)
          .single();

        if (error) throw error;

        if (data) {
          setProfile(data as UserProfile);
          setFullName(data.full_name || '');
          setPhone(data.phone || '');
          if (data.avatar_url) {
            setAvatarUrl([data.avatar_url]);
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
        setProfileError('Failed to load profile');
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [authUser]);

  // Save profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);

    if (!authUser || !profile) return;

    try {
      setProfileSaving(true);

      // Update public.users table
      const { error: updateError } = await supabase
        .from('users')
        .update({
          full_name: fullName || null,
          phone: phone || null,
          avatar_url: avatarUrl[0] || null,
        })
        .eq('id', authUser.id);

      if (updateError) throw updateError;

      setProfileSuccess(true);
      toast.success('Profile updated successfully!');
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save profile';
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setProfileSaving(false);
    }
  };

  // Change password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!authUser) return;

    // Validate form
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    try {
      setPasswordLoading(true);

      // Update password in Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Clear form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess(true);
      toast.success('Password changed successfully!');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      console.error('Error changing password:', err);
      const msg = err instanceof Error ? err.message : 'Failed to change password';
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!authUser || !profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">Please log in to view your profile</p>
          <Button onClick={() => router.push('/login')}>Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-8">
      <Toaster position="top-right" toastOptions={{ style: { background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)" }, success: { iconTheme: { primary: "var(--primary)", secondary: "var(--primary-foreground)" } }, error: { iconTheme: { primary: "var(--primary)", secondary: "var(--primary-foreground)" } } }} />
      <div className="mx-auto max-w-2xl px-4">
        <h1 className="mb-8 text-3xl font-bold text-text">My Profile</h1>

        {/* Profile Information */}
        <form onSubmit={handleSaveProfile} className="space-y-8">
          <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-text">Personal Information</h2>
            </div>

            {profileError && (
              <div className="mb-4 rounded-lg bg-danger/10 p-4 text-sm text-danger-text border border-danger">
                {profileError}
              </div>
            )}

            {profileSuccess && (
              <div className="mb-4 rounded-lg bg-accent/10 p-4 text-sm text-accent-text border border-accent">
                Profile updated successfully!
              </div>
            )}

            <div className="space-y-6">
              {/* Avatar Upload */}
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Profile Picture
                </label>
                <ImageUpload
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                  maxImages={1}
                  pathPrefix="avatars/"
                />
              </div>

              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-text mb-2">
                  Full Name
                </label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full"
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-text mb-2">
                  Phone Number
                </label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter your phone number"
                  className="w-full"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text mb-2">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={profile.email}
                  disabled
                  className="w-full bg-bg"
                />
                <p className="mt-1 text-xs text-muted">Email cannot be changed here</p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={profileSaving}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-hover"
                >
                  {profileSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>

        {/* Change Password */}
        <form onSubmit={handleChangePassword} className="space-y-8">
          <div id="account-security" className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <h2 className="mb-6 text-xl font-semibold text-text">Change Password</h2>

            {passwordError && (
              <div className="mb-4 rounded-lg bg-danger/10 p-4 text-sm text-danger-text border border-danger">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 rounded-lg bg-accent/10 p-4 text-sm text-accent-text border border-accent">
                Password changed successfully!
              </div>
            )}

            <div className="space-y-6">
              {/* Current Password */}
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-text mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-text mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Update Button */}
              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex items-center gap-2 bg-accent hover:bg-accent-hover"
                >
                  {passwordLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Change Password
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}