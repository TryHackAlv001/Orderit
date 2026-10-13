import { SettingsShell } from "@/components/settings/SettingsShell";

export default function PrivacyPage() {
  return (
    <SettingsShell title="Privacy Policy">
      <article className="space-y-4 bg-surface p-4 text-sm leading-6 text-muted sm:p-5">
        <p>This privacy policy page is a placeholder and needs reviewed, approved company and legal content.</p>
        <p>
          You can edit profile information and manage saved privacy preferences from{" "}
          <a href="/settings/privacy" className="font-semibold text-accent-text underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Privacy settings</a>.
        </p>
      </article>
    </SettingsShell>
  );
}
