import Link from "next/link";
import { SettingsShell } from "@/components/settings/SettingsShell";

export default function TermsPage() {
  return (
    <SettingsShell title="Legal terms & policies">
      <div className="space-y-3">
        <section className="bg-surface p-4 sm:p-5">
          <h2 className="font-semibold text-text">Terms of service</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            This page is a placeholder. Tradeloft&apos;s terms need to be reviewed and replaced with approved legal content before they are relied on.
          </p>
        </section>
        <Link href="/privacy" className="flex min-h-14 items-center justify-between bg-surface px-4 text-sm font-medium text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          Privacy Policy <span className="text-muted">›</span>
        </Link>
        <Link href="/refund-policy" className="flex min-h-14 items-center justify-between bg-surface px-4 text-sm font-medium text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          Refund & Return Policy <span className="text-muted">›</span>
        </Link>
      </div>
    </SettingsShell>
  );
}
