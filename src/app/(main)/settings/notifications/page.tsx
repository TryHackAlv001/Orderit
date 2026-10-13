import NotificationSettingsPage from "@/components/settings/NotificationSettingsPage";
import { SettingsShell } from "@/components/settings/SettingsShell";

export default function NotificationSettingsRoute() {
  return (
    <SettingsShell title="Notifications">
      <NotificationSettingsPage />
    </SettingsShell>
  );
}
