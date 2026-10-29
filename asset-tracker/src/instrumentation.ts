export async function register() {
  // The embedded dev database migrates itself on startup. A real Postgres is
  // migrated once per deploy with `npm run db:migrate` (see netlify.toml), so
  // serverless instances never race each other or need the SQL files at runtime.
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.DATABASE_URL) {
    const { runMigrations } = await import("./db/client");
    await runMigrations();
  }
}
