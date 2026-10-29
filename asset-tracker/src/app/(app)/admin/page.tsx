import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ChannelForm, EditUserButton, InviteUserButton, StandardChannelsButton, WorkspaceForm } from "@/components/settings-forms";
import { Avatar, cx, PageHeader, Pill } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth";
import { ROLE_LABEL, TEAM_LABEL, timeAgo } from "@/lib/domain";
import { env } from "@/lib/env";
import { param } from "@/lib/params";
import { allChannels } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Admin" };

const TABS = [
  { key: "people", label: "People" },
  { key: "channels", label: "Channels" },
  { key: "workspace", label: "Workflow" },
  { key: "integrations", label: "Integrations" },
] as const;

export default async function AdminPage(props: PageProps<"/admin">) {
  await requireAdminPage();
  const sp = await props.searchParams;
  const tab = TABS.find((t) => t.key === param(sp, "tab"))?.key ?? "people";
  const [people, channels, settings] = await Promise.all([
    db.query.users.findMany({ orderBy: [asc(users.name)], with: { channels: true } }),
    allChannels(),
    getSettings(),
  ]);
  const activeChannelOpts = channels.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader title="Admin" description="People, channels and how the review workflow runs." />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin?tab=${t.key}`}
            className={cx(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap",
              tab === t.key ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "people" && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-sm text-muted">
              {env.allowedDomains.length
                ? `Anyone with a verified Google account on ${env.allowedDomains.join(", ")} can sign in and starts as a Team member. Add others here.`
                : "Only people listed here can sign in. Set ALLOWED_EMAIL_DOMAINS to let your whole company in."}
            </p>
            <InviteUserButton channels={activeChannelOpts} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Person</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-3 py-2 font-medium">Channels</th>
                  <th className="px-3 py-2 font-medium">Last seen</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {people.map((u) => (
                  <tr key={u.id} className={cx(!u.active && "opacity-50")}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} src={u.avatarUrl} size={28} />
                        <div>
                          <p className="font-medium">
                            {u.name} {!u.active && <Pill>Inactive</Pill>}
                          </p>
                          <p className="text-xs text-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">{ROLE_LABEL[u.role]}</td>
                    <td className="px-3 py-2.5">{u.team ? TEAM_LABEL[u.team] : <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {u.channels.map((uc) => channels.find((c) => c.id === uc.channelId)?.name).filter(Boolean).join(", ") || (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">{u.lastSeenAt ? timeAgo(u.lastSeenAt) : "Never"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <EditUserButton
                        user={{
                          id: u.id,
                          name: u.name,
                          email: u.email,
                          role: u.role,
                          team: u.team,
                          active: u.active,
                          channelIds: u.channels.map((c) => c.channelId),
                        }}
                        channels={activeChannelOpts}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "channels" && (
        <div className="space-y-6">
          {channels.length === 0 && (
            <section className="card p-5">
              <h2 className="mb-1 text-sm font-semibold">Start with the usual channels</h2>
              <p className="mb-4 text-sm text-muted">You can rename, reorder or switch any of them off afterwards.</p>
              <StandardChannelsButton />
            </section>
          )}
          <section className="card p-5">
            <h2 className="mb-1 text-sm font-semibold">Add a channel</h2>
            <p className="mb-4 text-sm text-muted">Any place creatives go live: marketplaces, quick commerce apps, your website, social.</p>
            <ChannelForm />
          </section>
          <section className="card divide-y divide-line">
            {channels.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <ChannelForm channel={c} />
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === "workspace" && (
        <section className="card p-5">
          <WorkspaceForm
            requireApproval={settings.requireApproval}
            workspaceName={settings.workspaceName}
            assetTemplate={settings.assetTemplate}
          />
        </section>
      )}

      {tab === "integrations" && (
        <section className="card divide-y divide-line text-sm">
          <Integration
            name="Google sign-in"
            on={env.googleEnabled}
            detail="GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Redirect URI: {APP_URL}/api/auth/google/callback"
          />
          <Integration
            name="File storage"
            on
            detail={env.storageDriver === "s3" ? `S3-compatible bucket ${process.env.S3_BUCKET ?? ""}` : "Local disk (.data/uploads). Use S3/R2 in production."}
          />
          <Integration name="Database" on detail={process.env.DATABASE_URL ? "Postgres (DATABASE_URL)" : "Embedded Postgres in .data/pglite. Use real Postgres in production."} />
          <Integration name="Slack" on={Boolean(env.slackWebhookUrl)} detail="SLACK_WEBHOOK_URL: posts new versions and urgent corrections to one channel." />
          <Integration name="Email" on={Boolean(env.smtp.host)} detail="SMTP_HOST etc.: emails each person their alerts (they can opt out)." />
          <Integration name="Demo sign-in" on={env.devLogin} warn detail="ALLOW_DEV_LOGIN: lets anyone pick a user without a password. Turn off for real use." />
        </section>
      )}
    </>
  );
}

function Integration({ name, on, detail, warn }: { name: string; on: boolean; detail: string; warn?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className={cx(
          "mt-1.5 size-2 shrink-0 rounded-full",
          on ? (warn ? "bg-amber-500" : "bg-emerald-500") : "bg-gray-300",
        )}
      />
      <div>
        <p className="font-medium">
          {name} <span className="text-xs font-normal text-muted">{on ? "on" : "off"}</span>
        </p>
        <p className="text-muted">{detail}</p>
      </div>
    </div>
  );
}
