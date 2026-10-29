/** Apply database migrations (the app also does this on startup). */
import { config } from "dotenv";
import { runMigrations } from "../src/db/client";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

runMigrations().then(
  () => {
    console.log("Migrations applied.");
    process.exit(0);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
