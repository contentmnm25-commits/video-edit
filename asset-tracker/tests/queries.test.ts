import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, runMigrations } from "@/db/client";
import * as s from "@/db/schema";
import { importProductsCsv } from "@/lib/catalog";
import { channelSummary, listAssets } from "@/lib/queries";

// Runs the real SQL against an in-memory Postgres (PGlite).
const db = getDb();
let amazon: s.Channel, blinkit: s.Channel;
let user: s.User;

async function makeAsset(name: string, versionsCount: number, live: Record<string, number | null>) {
  const [product] = await db.insert(s.products).values({ name: `Product ${name}`, sku: `SKU-${name}` }).returning();
  const [asset] = await db.insert(s.assets).values({ productId: product.id, name }).returning();
  const versions: s.Version[] = [];
  for (let n = 1; n <= versionsCount; n++) {
    const [v] = await db
      .insert(s.versions)
      .values({ assetId: asset.id, number: n, fileKey: "k", fileName: "f.jpg", mimeType: "image/jpeg", sizeBytes: 1, note: "x", uploadedById: user.id })
      .returning();
    versions.push(v);
  }
  if (versions.length) await db.update(s.assets).set({ currentVersionId: versions.at(-1)!.id, status: "ready" }).where(eq(s.assets.id, asset.id));
  for (const [slug, n] of Object.entries(live)) {
    const channel = slug === "amazon" ? amazon : blinkit;
    await db.insert(s.assetChannels).values({ assetId: asset.id, channelId: channel.id, liveVersionId: n ? versions[n - 1].id : null });
  }
  return asset;
}

beforeAll(async () => {
  await runMigrations();
  [amazon, blinkit] = await db
    .insert(s.channels)
    .values([
      { name: "Amazon", slug: "amazon", idLabel: "ASIN", sortOrder: 1 },
      { name: "Blinkit", slug: "blinkit", sortOrder: 2 },
    ])
    .returning();
  [user] = await db.insert(s.users).values({ email: "t@example.com", name: "Tester", role: "admin" }).returning();
  await makeAsset("uptodate", 2, { amazon: 2, blinkit: 2 });
  await makeAsset("stale", 3, { amazon: 1, blinkit: 3 });
  await makeAsset("fresh", 1, { amazon: null, blinkit: null });
  await makeAsset("empty", 0, { amazon: null });
});

describe("channel queries", () => {
  it("summarises each channel", async () => {
    const rows = await channelSummary();
    const a = rows.find((r) => r.slug === "amazon")!;
    const b = rows.find((r) => r.slug === "blinkit")!;
    expect(a).toMatchObject({ live: 1, outdated: 1, pending: 1, notReady: 1 });
    expect(b).toMatchObject({ live: 2, outdated: 0, pending: 1, notReady: 0 });
  });

  it("filters assets by channel state", async () => {
    const names = async (f: Parameters<typeof listAssets>[0]) => (await listAssets(f)).rows.map((r) => r.name).sort();
    expect(await names({ channelId: amazon.id, state: "outdated" })).toEqual(["stale"]);
    expect(await names({ channelId: amazon.id, state: "to_publish" })).toEqual(["fresh", "stale"]);
    expect(await names({ channelId: blinkit.id, state: "live" })).toEqual(["stale", "uptodate"]);
    expect(await names({ state: "not_ready" })).toEqual(["empty"]);
    expect(await names({ channelIds: [blinkit.id], state: "to_publish" })).toEqual(["fresh"]);
    expect(await names({ channelIds: [] })).toEqual([]);
  });

  it("computes per-row channel chips", async () => {
    const { rows } = await listAssets({ q: "stale" });
    expect(rows[0].channels.map((c) => [c.channel.slug, c.state, c.liveVersionNumber])).toEqual([
      ["amazon", "outdated", 1],
      ["blinkit", "live", 3],
    ]);
  });

  it("searches by SKU", async () => {
    const { rows } = await listAssets({ q: "sku-fresh" });
    expect(rows.map((r) => r.name)).toEqual(["fresh"]);
  });
});

describe("CSV import", () => {
  it("creates, updates by SKU, stores listing ids and slots", async () => {
    const csv = "name,sku,Amazon,assets\nLamp,LMP-1,B0LAMP,Main image|Product video\nRenamed fresh,SKU-fresh,,\n,NO-NAME,,";
    const report = await importProductsCsv(csv, user.id, ["Main image"]);
    expect(report).toMatchObject({ created: 1, updated: 1, slots: 2 });
    expect(report.errors).toEqual(["Row 4: name and sku are required."]);
    const lamp = await db.query.products.findFirst({
      where: eq(s.products.sku, "LMP-1"),
      with: { channelIds: true, assets: { with: { channels: true } } },
    });
    expect(lamp?.channelIds[0]?.externalId).toBe("B0LAMP");
    expect(lamp?.assets.map((a) => [a.name, a.type]).sort()).toEqual([
      ["Main image", "image"],
      ["Product video", "video"],
    ]);
    // Slots go to channels the product is listed on (only Amazon here).
    expect(lamp?.assets[0].channels.map((c) => c.channelId)).toEqual([amazon.id]);
  });
});
