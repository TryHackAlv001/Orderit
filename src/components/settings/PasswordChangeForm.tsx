"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 10 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError("Use at least 10 characters, including an uppercase letter, a lowercase letter, and a number.");
      toast.error("Choose a stronger password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      toast.error("The new passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) throw userError ?? new Error("Sign in again before changing your password.");

      const { error: verificationError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verificationError) throw new Error("Your current password is incorrect.");

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Your password could not be changed.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const passwordInput = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    visible: boolean,
    setVisible: (visible: boolean) => void,
  ) => (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-text">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={id === "current-password" ? "current-password" : "new-password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          className="min-h-11 w-full rounded-lg border border-border bg-bg px-3 pr-12 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:w-10"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="font-semibold text-text">Change password</h2>
        <p className="mt-1 text-sm text-muted">Confirm your current password before choosing a new one.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-danger bg-danger/10 p-3 text-sm text-danger-text">{error}</p>}
      {passwordInput("current-password", "Current password", currentPassword, setCurrentPassword, showCurrentPassword, setShowCurrentPassword)}
      {passwordInput("new-password", "New password", newPassword, setNewPassword, showNewPassword, setShowNewPassword)}
      {passwordInput("confirm-password", "Confirm new password", confirmPassword, setConfirmPassword, showConfirmPassword, setShowConfirmPassword)}
      <button
        type="submit"
        disabled={saving}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-on hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Updating…" : "Change password"}
      </button>
    </form>
  );
}
