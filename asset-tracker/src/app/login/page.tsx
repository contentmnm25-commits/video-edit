import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { Layers } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { devLogin } from "@/app/actions/me";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABEL, TEAM_LABEL } from "@/lib/domain";
import { env } from "@/lib/env";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_allowed: "This Google account isn't allowed in. Ask an admin to add you under Admin → People.",
  unverified: "Your Google email isn't verified.",
  oauth_state: "Sign-in expired. Please try again.",
  oauth_failed: "Google sign-in failed. Please try again.",
  google_disabled: "Google sign-in isn't configured yet.",
  inactive: "That account has been deactivated.",
};

export default async function LoginPage(props: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await props.searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;
  const people = env.devLogin
    ? await db.query.users.findMany({ where: eq(users.active, true), orderBy: [asc(users.name)] })
    : [];

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
            <Layers className="size-6" />
          </span>
          <h1 className="text-xl font-semibold">Creative Tracker</h1>
          <p className="mt-1 text-sm text-muted">Latest approved creatives, and where each one is live.</p>
        </div>
        <div className="card space-y-4 p-6">
          {message && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
          {env.googleEnabled ? (
            <a href="/api/auth/google" className="btn-secondary w-full py-2.5">
              <GoogleMark /> Continue with Google
            </a>
          ) : (
            !env.devLogin && (
              <p className="text-sm text-muted">
                Sign-in isn&apos;t configured. Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code>.
              </p>
            )
          )}
          {env.devLogin && (
            <form action={devLogin} className="space-y-3 border-t border-line pt-4 first:border-0 first:pt-0">
              <div>
                <label className="label" htmlFor="userId">
                  Demo sign-in (no password)
                </label>
                {people.length ? (
                  <select id="userId" name="userId" className="input" required>
                    {people.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {ROLE_LABEL[u.role]}
                        {u.team ? ` · ${TEAM_LABEL[u.team]}` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted">
                    No users yet. Run <code>npm run db:seed</code> to load demo data.
                  </p>
                )}
              </div>
              {people.length > 0 && <button className="btn-primary w-full">Sign in</button>}
              <p className="text-xs text-amber-700">For local testing only. Turn off with ALLOW_DEV_LOGIN=false.</p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}
