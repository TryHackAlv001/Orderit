import { SettingsShell } from "@/components/settings/SettingsShell";

export default function AboutPage() {
  return (
    <SettingsShell title="About Tradeloft">
      <article className="space-y-4 bg-surface p-4 text-sm leading-6 text-muted sm:p-5">
        <h2 className="text-base font-semibold text-text">A marketplace for local vendors</h2>
        <p>Tradeloft connects shoppers with independent vendors and their products.</p>
        <p>Orders, delivery updates, messages, and eligible return requests are available through your account.</p>
      </article>
    </SettingsShell>
  );
}
