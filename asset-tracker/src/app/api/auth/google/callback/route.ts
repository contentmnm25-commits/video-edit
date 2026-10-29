import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { decodeIdToken } from "arctic";
import { createSession, findOrCreateUserForLogin } from "@/lib/auth";
import { env } from "@/lib/env";
import { googleClient } from "@/lib/google";

type GoogleClaims = { email?: string; email_verified?: boolean; name?: string; picture?: string };

export async function GET(request: NextRequest) {
  const fail = (reason: string) => NextResponse.redirect(`${env.appUrl}/login?error=${reason}`);
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const jar = await cookies();
  const expectedState = jar.get("ct_oauth_state")?.value;
  const verifier = jar.get("ct_oauth_verifier")?.value;
  jar.delete("ct_oauth_state");
  jar.delete("ct_oauth_verifier");
  if (!code || !state || !expectedState || !verifier || state !== expectedState) return fail("oauth_state");

  let claims: GoogleClaims;
  try {
    const tokens = await googleClient().validateAuthorizationCode(code, verifier);
    claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
  } catch (err) {
    console.error("[auth] Google code exchange failed", err);
    return fail("oauth_failed");
  }
  if (!claims.email || claims.email_verified !== true) return fail("unverified");

  const user = await findOrCreateUserForLogin({
    email: claims.email,
    name: claims.name ?? "",
    avatarUrl: claims.picture ?? null,
  });
  if (!user) return fail("not_allowed");
  await createSession(user.id);
  return NextResponse.redirect(`${env.appUrl}/`);
}
