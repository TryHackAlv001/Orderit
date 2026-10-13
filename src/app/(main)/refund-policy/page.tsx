import { SettingsShell } from "@/components/settings/SettingsShell";

export default function RefundPolicyPage() {
  return (
    <SettingsShell title="Refund & Return Policy">
      <article className="space-y-4 bg-surface p-4 text-sm leading-6 text-muted sm:p-5">
        <p>
          Return requests are available for eligible orders through the order details page. Requests are reviewed under the return flow and approved wallet refunds are recorded to the buyer&apos;s Tradeloft wallet.
        </p>
        <p>
          This summary is not a complete policy. Eligibility, timelines, and exceptions need reviewed, approved policy content.
        </p>
      </article>
    </SettingsShell>
  );
}
