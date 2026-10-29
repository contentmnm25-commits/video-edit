import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateCodeVerifier, generateState } from "arctic";
import { env } from "@/lib/env";
import { googleClient } from "@/lib/google";

export async function GET() {
  if (!env.googleEnabled) return NextResponse.redirect(`${env.appUrl}/login?error=google_disabled`);
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = googleClient().createAuthorizationURL(state, verifier, ["openid", "profile", "email"]);
  url.searchParams.set("prompt", "select_account");
  const jar = await cookies();
  const opts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.appUrl.startsWith("https://"),
    path: "/",
    maxAge: 600,
  };
  jar.set("ct_oauth_state", state, opts);
  jar.set("ct_oauth_verifier", verifier, opts);
  return NextResponse.redirect(url);
}
