'use client';

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast, Toaster } from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }

    try {
      await signIn(email, password);
      toast.success("Welcome back to Tradeloft!");
      router.refresh();
      router.push("/marketplace");
    } catch (error: any) {
      toast.error(error.message ?? "Unable to sign in. Please try again.");
    }
  };

  return (
    <main className="min-h-svh bg-bg">
      <Toaster position="top-right" toastOptions={{ style: { background: "var(--surface-raised)", color: "var(--foreground)", border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)" }, success: { iconTheme: { primary: "var(--primary)", secondary: "var(--primary-foreground)" } }, error: { iconTheme: { primary: "var(--primary)", secondary: "var(--primary-foreground)" } } }} />
      <div className="page-container min-h-svh justify-center py-12">
        <div className="mb-10 max-w-2xl rounded-lg border border-border bg-surface p-10 shadow-sm sm:p-12">
          <div className="mb-10 flex flex-col gap-3 text-center">
            <p className="inline-flex rounded-md bg-accent/10 px-4 py-1 text-sm font-semibold uppercase tracking-[0.3em] text-text">
              Tradeloft
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-text sm:text-5xl">
              Welcome back
            </h1>
            <p className="mx-auto max-w-xl text-sm text-muted sm:text-base">
              Sign in to shop or manage your store.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-lg border border-border bg-bg p-5">
              <label className="mb-2 block text-sm font-semibold text-text">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="rounded-lg border border-border bg-bg p-5">
              <label className="mb-2 block text-sm font-semibold text-text">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <a href="/forgot-password" className="text-sm font-medium text-accent-text transition-colors duration-200 hover:text-accent-text">
                Forgot password?
              </a>
              <Button type="submit" className="min-w-[150px]">
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </div>
          </form>

          <div className="mt-8 border-t border-border pt-6 text-center text-sm text-muted">
            New to Tradeloft? <a href="/register" className="font-semibold text-accent-text transition-colors duration-200 hover:text-accent-text">Create an account</a>
          </div>
        </div>
      </div>
    </main>
  );
}
