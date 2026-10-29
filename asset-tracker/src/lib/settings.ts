import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export type Settings = {
  /** New uploads wait for a reviewer before they become the current version. */
  requireApproval: boolean;
  workspaceName: string;
  /** Asset slots created automatically for every new product. */
  assetTemplate: string[];
};

const DEFAULTS: Settings = {
  requireApproval: false,
  workspaceName: "Creative Tracker",
  assetTemplate: [
    "Main image",
    "Image 2",
    "Image 3",
    "Image 4",
    "Image 5",
    "Image 6",
    "Image 7",
    "A+ content",
    "Product video",
  ],
};

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULTS, ...stored } as Settings;
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return (row?.value as Settings[K] | undefined) ?? DEFAULTS[key];
}
