import { PreferencesForm } from "@/components/settings-forms";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL, TEAM_LABEL } from "@/lib/domain";
import { env } from "@/lib/env";
import { activeChannels, userChannelIds } from "@/lib/queries";

export const metadata = { title: "My channels & alerts" };

export default async function SettingsPage() {
  const user = await requireUser();
  const [channels, mine] = await Promise.all([activeChannels(), userChannelIds(user.id)]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="My channels & alerts"
        description={`${user.email} · ${ROLE_LABEL[user.role]}${user.team ? ` · ${TEAM_LABEL[user.team]}` : ""}`}
      />
      <PreferencesForm
        channels={channels}
        selected={mine}
        emailNotifications={user.emailNotifications}
        emailConfigured={Boolean(env.smtp.host)}
      />
    </div>
  );
}
