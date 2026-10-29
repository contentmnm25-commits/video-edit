import { unstable_rethrow } from "next/navigation";

/** An error whose message is safe and useful to show to the person who triggered it. */
export class UserError extends Error {}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Runs a server action body and turns failures into a result the form can show.
 * Framework control flow (redirect, notFound) is re-thrown untouched.
 */
export async function attempt<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof UserError) return { ok: false, error: err.message };
    console.error(err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
