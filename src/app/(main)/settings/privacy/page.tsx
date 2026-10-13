import PrivacySettingsPage from "@/components/settings/PrivacySettingsPage";
import { SettingsShell } from "@/components/settings/SettingsShell";

export default function PrivacySettingsRoute() {
  return (
    <SettingsShell title="Privacy">
      <PrivacySettingsPage />
    </SettingsShell>
  );
}
