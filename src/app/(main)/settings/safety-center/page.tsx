import Link from "next/link";
import { SettingsShell } from "@/components/settings/SettingsShell";

const tips = [
  {
    title: "Keep orders on Tradeloft",
    body: "Place orders and make payments through the checkout flow. Avoid requests to pay a seller outside the platform.",
  },
  {
    title: "Check your delivery",
    body: "Review your order when it arrives and only confirm delivery after you have received it.",
  },
  {
    title: "Contact the seller through Messages",
    body: "Use the order conversation to discuss a problem and keep the details together.",
  },
  {
    title: "Review return options",
    body: "Eligible return requests can be submitted from your order. Approved refunds are credited to your Tradeloft wallet.",
  },
];

export default function SafetyCenterPage() {
  return (
    <SettingsShell title="Safety center">
      <div className="space-y-3">
        <section className="divide-y divide-border bg-surface">
          {tips.map((tip) => (
            <article key={tip.title} className="p-4 sm:p-5">
              <h2 className="font-semibold text-text">{tip.title}</h2>
              <p className="mt-1 text-sm leading-6 text-muted">{tip.body}</p>
            </article>
          ))}
        </section>
        <Link
          href="/messages"
          className="flex min-h-14 items-center justify-between bg-surface px-4 text-sm font-semibold text-text hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          Report a problem <span aria-hidden="true" className="text-muted">›</span>
        </Link>
      </div>
    </SettingsShell>
  );
}
