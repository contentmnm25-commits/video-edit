"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { savePreferences } from "@/app/actions/me";
import { inviteUser, saveChannel, saveWorkspaceSettings, updateUser } from "@/app/actions/admin";
import { FormError, Modal, useCloseModal } from "@/components/modal";
import type { Role, Team } from "@/db/schema";
import { ROLE_HELP, ROLE_LABEL, TEAM_LABEL } from "@/lib/domain";
import type { ActionResult } from "@/lib/errors";
import { useEffect } from "react";

type Result = ActionResult<unknown> | undefined;

function Saved({ state }: { state: Result }) {
  if (!state) return null;
  return state.ok ? <span className="text-sm text-emerald-700">Saved</span> : <FormError error={state.error} />;
}

function ChannelChecks({ channels, selected }: { channels: { id: string; name: string }[]; selected: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {channels.map((c) => (
        <label
          key={c.id}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm has-checked:border-accent has-checked:bg-accent-soft"
        >
          <input type="checkbox" name="channelIds" value={c.id} defaultChecked={selected.includes(c.id)} className="accent-accent" />
          {c.name}
        </label>
      ))}
    </div>
  );
}

export function PreferencesForm({
  channels,
  selected,
  emailNotifications,
  emailConfigured,
}: {
  channels: { id: string; name: string }[];
  selected: string[];
  emailNotifications: boolean;
  emailConfigured: boolean;
}) {
  const [state, action, pending] = useActionState<Result, FormData>(savePreferences, undefined);
  return (
    <form action={action} className="card space-y-6 p-5">
      <fieldset>
        <legend className="text-sm font-semibold">Channels I publish to</legend>
        <p className="mb-3 text-sm text-muted">
          You&apos;ll be alerted when a creative on these channels has a new version, and your dashboard shows their to-do list.
        </p>
        <ChannelChecks channels={channels} selected={selected} />
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="emailNotifications" defaultChecked={emailNotifications} className="mt-0.5 accent-accent" />
        <span>
          Email me as well as showing alerts in the app
          {!emailConfigured && <span className="block text-xs text-muted">Email isn&apos;t set up on this server yet.</span>}
        </span>
      </label>
      <div className="flex items-center justify-end gap-3">
        <Saved state={state} />
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Save
        </button>
      </div>
    </form>
  );
}

function RoleTeamFields({ role, team }: { role?: Role; team?: Team | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label">Role</label>
        <select name="role" defaultValue={role ?? "member"} className="input">
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]} — {ROLE_HELP[r]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Team</label>
        <select name="team" defaultValue={team ?? ""} className="input">
          <option value="">—</option>
          {(Object.keys(TEAM_LABEL) as Team[]).map((t) => (
            <option key={t} value={t}>
              {TEAM_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function useCloseOnOk(state: Result) {
  const close = useCloseModal();
  useEffect(() => {
    if (state?.ok) close();
  }, [state, close]);
}

export function InviteUserButton({ channels }: { channels: { id: string; name: string }[] }) {
  return (
    <Modal trigger="Add person" triggerClassName="btn-primary" title="Add a person" description="They can sign in with Google using this email.">
      <InviteForm channels={channels} />
    </Modal>
  );
}

function InviteForm({ channels }: { channels: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(inviteUser, undefined);
  useCloseOnOk(state);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input name="name" required className="input" />
        </div>
        <div>
          <label className="label">Work email</label>
          <input name="email" type="email" required className="input" />
        </div>
      </div>
      <RoleTeamFields />
      <fieldset>
        <legend className="label">Channels they publish to</legend>
        <ChannelChecks channels={channels} selected={[]} />
      </fieldset>
      {state && !state.ok && <FormError error={state.error} />}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Add
        </button>
      </div>
    </form>
  );
}

export function EditUserButton({
  user,
  channels,
}: {
  user: { id: string; name: string; email: string; role: Role; team: Team | null; active: boolean; channelIds: string[] };
  channels: { id: string; name: string }[];
}) {
  return (
    <Modal trigger="Edit" triggerClassName="btn-ghost btn-sm" title={`Edit ${user.name}`} description={user.email}>
      <EditUserForm user={user} channels={channels} />
    </Modal>
  );
}

function EditUserForm({
  user,
  channels,
}: {
  user: { id: string; name: string; email: string; role: Role; team: Team | null; active: boolean; channelIds: string[] };
  channels: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<Result, FormData>(updateUser, undefined);
  useCloseOnOk(state);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="userId" value={user.id} />
      <div>
        <label className="label">Name</label>
        <input name="name" required defaultValue={user.name} className="input" />
      </div>
      <RoleTeamFields role={user.role} team={user.team} />
      <fieldset>
        <legend className="label">Channels they publish to</legend>
        <ChannelChecks channels={channels} selected={user.channelIds} />
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={user.active} className="accent-accent" /> Active (can sign in)
      </label>
      {state && !state.ok && <FormError error={state.error} />}
      <div className="flex justify-end">
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Save
        </button>
      </div>
    </form>
  );
}

export function ChannelForm({
  channel,
}: {
  channel?: { id: string; name: string; idLabel: string | null; sortOrder: number; active: boolean };
}) {
  const [state, action, pending] = useActionState<Result, FormData>(saveChannel, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {channel && <input type="hidden" name="channelId" value={channel.id} />}
      <div className="min-w-32 flex-1">
        {!channel && <label className="label">Name</label>}
        <input name="name" required defaultValue={channel?.name} className="input py-1.5" placeholder="e.g. Myntra" aria-label="Channel name" />
      </div>
      <div className="w-32">
        {!channel && <label className="label">Listing ID label</label>}
        <input name="idLabel" defaultValue={channel?.idLabel ?? ""} className="input py-1.5" placeholder="ASIN, FSN…" aria-label="ID label" />
      </div>
      <div className="w-20">
        {!channel && <label className="label">Order</label>}
        <input name="sortOrder" type="number" min={0} defaultValue={channel?.sortOrder ?? 50} className="input py-1.5" aria-label="Sort order" />
      </div>
      {channel && (
        <label className="flex items-center gap-1.5 pb-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={channel.active} className="accent-accent" /> Active
        </label>
      )}
      <button className={channel ? "btn-secondary btn-sm mb-0.5" : "btn-primary"} disabled={pending}>
        {pending && <Loader2 className="size-3.5 animate-spin" />} {channel ? "Save" : "Add channel"}
      </button>
      {state && !state.ok && <span className="w-full text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function WorkspaceForm({
  requireApproval,
  workspaceName,
  assetTemplate,
}: {
  requireApproval: boolean;
  workspaceName: string;
  assetTemplate: string[];
}) {
  const [state, action, pending] = useActionState<Result, FormData>(saveWorkspaceSettings, undefined);
  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="label">Workspace name</label>
        <input name="workspaceName" defaultValue={workspaceName} className="input max-w-sm" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="requireApproval" defaultChecked={requireApproval} className="mt-0.5 accent-accent" />
        <span>
          <span className="font-medium">Require review before a new version goes out</span>
          <span className="block text-muted">
            On: uploads wait for a reviewer, and channel teams are only notified after approval. Off: the latest upload is
            immediately the version to publish.
          </span>
        </span>
      </label>
      <div>
        <label className="label">Standard asset slots for new products (one per line)</label>
        <textarea name="assetTemplate" rows={8} defaultValue={assetTemplate.join("\n")} className="input max-w-sm font-mono text-xs" />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />} Save settings
        </button>
        <Saved state={state} />
      </div>
    </form>
  );
}
