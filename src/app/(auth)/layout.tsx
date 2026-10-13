import type { ReactNode } from "react";

export const metadata = {
  title: "Tradeloft - Sign In or Register",
};

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-svh bg-bg text-text">{children}</div>;
}
