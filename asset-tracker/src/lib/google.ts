import "server-only";
import { Google } from "arctic";
import { env } from "@/lib/env";

export function googleClient() {
  return new Google(env.googleClientId, env.googleClientSecret, `${env.appUrl}/api/auth/google/callback`);
}
