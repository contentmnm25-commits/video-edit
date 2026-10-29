/**
 * Loads a realistic demo workspace: channels, people from every team, products,
 * creatives with version history, and every publishing state (live, outdated,
 * to publish, needs correction), so you can click through the whole workflow.
 *
 *   npm run db:seed            # only if the database is empty
 *   npm run db:seed -- --reset # wipe everything first
 *
 * Stop `npm run dev` first when using the embedded database: only one process
 * can open it at a time.
 */
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { sql } from "drizzle-orm";
import { getDb, PGLITE_DIR, runMigrations } from "../src/db/client";
import * as s from "../src/db/schema";

// Same precedence as Next.js: .env.local wins over .env.
config({ path: ".env.local", quiet: true });
config({ quiet: true });

const reset = process.argv.includes("--reset");
const ROOT = process.cwd();
const UPLOADS = path.join(ROOT, ".data", "uploads");
const PORTFOLIO = path.join(ROOT, "..", "portfolio", "assets");
const DAY = 86400_000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600_000);

async function main() {
  if ((process.env.STORAGE_DRIVER ?? "local") !== "local") {
    throw new Error("The demo seed writes files to local storage. Run it with STORAGE_DRIVER=local.");
  }
  if (reset) {
    if (!process.env.DATABASE_URL) fs.rmSync(PGLITE_DIR, { recursive: true, force: true });
    fs.rmSync(UPLOADS, { recursive: true, force: true });
  }
  const db = getDb();
  await runMigrations();
  if (reset && process.env.DATABASE_URL) {
    await db.execute(
      sql`truncate table activity, notifications, comments, requests, asset_channels, versions, assets, product_channels, products, user_channels, channels, sessions, users, settings cascade`,
    );
  }
  const existing = await db.select({ id: s.users.id }).from(s.users).limit(1);
  if (existing.length) {
    console.log("Database already has data. Use `npm run db:seed -- --reset` to start over.");
    return;
  }

  // ─── Channels ────────────────────────────────────────────────────────
  const channelDefs = [
    ["Amazon", "amazon", "ASIN"],
    ["Flipkart", "flipkart", "FSN"],
    ["Blinkit", "blinkit", "Item ID"],
    ["Zepto", "zepto", "Item ID"],
    ["Instamart", "instamart", "Item ID"],
    ["Website", "website", "Handle"],
  ] as const;
  const channels = await db
    .insert(s.channels)
    .values(channelDefs.map(([name, slug, idLabel], i) => ({ name, slug, idLabel, sortOrder: (i + 1) * 10 })))
    .returning();
  const ch = Object.fromEntries(channels.map((c) => [c.slug, c])) as Record<(typeof channelDefs)[number][1], s.Channel>;

  // ─── People ──────────────────────────────────────────────────────────
  const people = await db
    .insert(s.users)
    .values([
      { name: "Riya Sharma", email: "riya@example.com", role: "admin", team: "marketing" },
      { name: "Arjun Mehta", email: "arjun@example.com", role: "designer", team: "design" },
      { name: "Neha Kapoor", email: "neha@example.com", role: "designer", team: "design" },
      { name: "Kabir Singh", email: "kabir@example.com", role: "reviewer", team: "content" },
      { name: "Priya Nair", email: "priya@example.com", role: "member", team: "listing" },
      { name: "Rohan Das", email: "rohan@example.com", role: "member", team: "qcom" },
      { name: "Sana Iqbal", email: "sana@example.com", role: "member", team: "ecom" },
      { name: "Vikram Rao", email: "vikram@example.com", role: "viewer", team: "marketing" },
    ])
    .returning();
  const u = Object.fromEntries(people.map((p) => [p.name.split(" ")[0].toLowerCase(), p])) as Record<string, s.User>;
  await db.insert(s.userChannels).values([
    { userId: u.priya.id, channelId: ch.amazon.id },
    { userId: u.priya.id, channelId: ch.flipkart.id },
    { userId: u.rohan.id, channelId: ch.blinkit.id },
    { userId: u.rohan.id, channelId: ch.zepto.id },
    { userId: u.rohan.id, channelId: ch.instamart.id },
    { userId: u.sana.id, channelId: ch.website.id },
  ]);

  // ─── Helpers ─────────────────────────────────────────────────────────
  async function product(name: string, sku: string, category: string, ids: Partial<Record<keyof typeof ch, string>>) {
    const [p] = await db
      .insert(s.products)
      .values({ name, sku, brand: "LittleNest", category, createdById: u.riya.id, createdAt: ago(40), updatedAt: ago(2) })
      .returning();
    const rows = Object.entries(ids).map(([slug, externalId]) => ({
      productId: p.id,
      channelId: ch[slug as keyof typeof ch].id,
      externalId: externalId!,
    }));
    if (rows.length) await db.insert(s.productChannels).values(rows);
    await db.insert(s.activity).values({ actorId: u.riya.id, action: "product.created", productId: p.id, createdAt: ago(40) });
    return p;
  }

  async function asset(
    p: s.Product,
    name: string,
    type: s.AssetType,
    slugs: (keyof typeof ch)[],
    assignee: s.User,
  ) {
    const [a] = await db
      .insert(s.assets)
      .values({ productId: p.id, name, type, assigneeId: assignee.id, createdById: u.riya.id, createdAt: ago(35), updatedAt: ago(35) })
      .returning();
    if (slugs.length) await db.insert(s.assetChannels).values(slugs.map((slug) => ({ assetId: a.id, channelId: ch[slug].id })));
    return a;
  }

  type VersionSpec = { note: string; daysAgo: number; by: s.User; file: { data: Buffer; name: string; mime: string; width?: number; height?: number; duration?: number; thumb?: Buffer } };

  async function versions(a: s.Asset, p: s.Product, specs: VersionSpec[]) {
    const out: s.Version[] = [];
    for (const [i, spec] of specs.entries()) {
      const folder = `assets/${a.id}/${randomUUID()}`;
      const fileKey = `${folder}/${spec.file.name}`;
      write(fileKey, spec.file.data);
      let thumbKey: string | null = null;
      if (spec.file.thumb) {
        thumbKey = `${folder}/thumb.jpg`;
        write(thumbKey, spec.file.thumb);
      }
      const at = ago(spec.daysAgo);
      const [v] = await db
        .insert(s.versions)
        .values({
          assetId: a.id,
          number: i + 1,
          fileKey,
          fileName: spec.file.name,
          mimeType: spec.file.mime,
          sizeBytes: spec.file.data.length,
          width: spec.file.width ?? null,
          height: spec.file.height ?? null,
          durationSec: spec.file.duration ?? null,
          thumbKey,
          note: spec.note,
          review: "approved",
          reviewedById: u.kabir.id,
          reviewedAt: at,
          uploadedById: spec.by.id,
          createdAt: at,
        })
        .returning();
      await db.insert(s.activity).values({
        actorId: spec.by.id,
        action: "version.published",
        productId: p.id,
        assetId: a.id,
        versionId: v.id,
        meta: { number: v.number, note: spec.note },
        createdAt: at,
      });
      out.push(v);
    }
    const last = out[out.length - 1];
    await db
      .update(s.assets)
      .set({ currentVersionId: last.id, status: "ready", updatedAt: last.createdAt })
      .where(sql`${s.assets.id} = ${a.id}`);
    return out;
  }

  /** Record that `channel` shows version `v`, marked by `by`. */
  async function live(a: s.Asset, p: s.Product, slug: keyof typeof ch, v: s.Version, by: s.User, hoursAfter = 5) {
    const at = new Date(v.createdAt.getTime() + hoursAfter * 3600_000);
    await db
      .update(s.assetChannels)
      .set({ liveVersionId: v.id, liveAt: at, liveById: by.id })
      .where(sql`${s.assetChannels.assetId} = ${a.id} and ${s.assetChannels.channelId} = ${ch[slug].id}`);
    await db.insert(s.activity).values({
      actorId: by.id,
      action: "channel.marked_live",
      productId: p.id,
      assetId: a.id,
      versionId: v.id,
      channelId: ch[slug].id,
      meta: { number: v.number },
      createdAt: at,
    });
  }

  const all: (keyof typeof ch)[] = ["amazon", "flipkart", "blinkit", "zepto", "instamart", "website"];

  // ─── 1. Sipper: the full story of a corrected creative ───────────────
  const sipper = await product("Steel Sipper Bottle 300ml", "SIP-300-BLU", "Feeding", {
    amazon: "B0CSIP3001",
    flipkart: "BTLSIP300BLU",
    blinkit: "482913",
    zepto: "ZP-77120",
    instamart: "IM-55031",
    website: "steel-sipper-300",
  });
  const sipMain = await asset(sipper, "Main image", "image", all, u.arjun);
  const sipMainV = await versions(sipMain, sipper, [
    { note: "First version for launch", daysAgo: 30, by: u.arjun, file: await productShot("sippy-macro", "300 ml", "#0f766e", "Spill-proof sipper") },
    { note: "Pack size badge said 250ml, corrected to 300ml", daysAgo: 12, by: u.arjun, file: await productShot("sippy-macro", "300 ml", "#0f766e", "Spill-proof sipper", { badge: true }) },
    { note: "Brighter background and new BPA-free claim", daysAgo: 1, by: u.arjun, file: await productShot("sippy-macro", "300 ml", "#0f766e", "BPA-free · Spill-proof", { badge: true, bright: true }) },
  ]);
  await live(sipMain, sipper, "amazon", sipMainV[2], u.priya, 3);
  await live(sipMain, sipper, "zepto", sipMainV[2], u.rohan, 6);
  await live(sipMain, sipper, "website", sipMainV[2], u.sana, 2);
  await live(sipMain, sipper, "flipkart", sipMainV[1], u.priya); // outdated
  await live(sipMain, sipper, "blinkit", sipMainV[0], u.rohan); // outdated, two versions behind
  // instamart: never published -> "to publish"

  const sipImg2 = await asset(sipper, "Image 2", "image", ["amazon", "flipkart", "website"], u.arjun);
  const sipImg2V = await versions(sipImg2, sipper, [
    { note: "Feature callouts: leak-proof lid, soft spout, handles", daysAgo: 28, by: u.arjun, file: await productShot("first-sips", "Features", "#7c3aed", "Soft spout · Easy grip") },
  ]);
  for (const slug of ["amazon", "flipkart", "website"] as const) await live(sipImg2, sipper, slug, sipImg2V[0], slug === "website" ? u.sana : u.priya);

  const sipVideo = await asset(sipper, "Product video", "video", ["amazon", "flipkart", "website"], u.neha);
  const sipVideoV = await versions(sipVideo, sipper, [
    { note: "15s macro cut", daysAgo: 20, by: u.neha, file: await reel("sippy-macro") },
    { note: "Re-cut to 9s with first-sips shot and end card", daysAgo: 2, by: u.neha, file: await reel("first-sips") },
  ]);
  await live(sipVideo, sipper, "amazon", sipVideoV[0], u.priya); // outdated
  await live(sipVideo, sipper, "website", sipVideoV[1], u.sana);

  // ─── 2. Walker: a correction raised by the listing team ──────────────
  const walker = await product("Foldable Baby Walker", "WLK-200", "Gear", {
    amazon: "B0CWLK2002",
    flipkart: "WLKFOLD200",
    website: "foldable-walker",
  });
  const walkMain = await asset(walker, "Main image", "image", ["amazon", "flipkart", "website"], u.neha);
  const walkMainV = await versions(walkMain, walker, [
    { note: "Launch main image", daysAgo: 18, by: u.neha, file: await productShot("walker-livingroom", "3-in-1", "#b45309", "Foldable walker") },
  ]);
  for (const slug of ["amazon", "flipkart", "website"] as const) await live(walkMain, walker, slug, walkMainV[0], slug === "website" ? u.sana : u.priya);
  await db.update(s.assets).set({ status: "needs_correction", updatedAt: ago(0, 5) }).where(sql`${s.assets.id} = ${walkMain.id}`);
  const [walkReq] = await db
    .insert(s.requests)
    .values({
      type: "correction",
      priority: "high",
      title: "Correction: Main image",
      description: "Amazon suppressed the listing: main image background isn't pure white and there's text on the image. Need a clean white-background packshot.",
      productId: walker.id,
      assetId: walkMain.id,
      requestedById: u.priya.id,
      assigneeId: u.neha.id,
      createdAt: ago(0, 5),
      updatedAt: ago(0, 5),
    })
    .returning();
  await db.insert(s.comments).values({
    assetId: walkMain.id,
    versionId: walkMainV[0].id,
    requestId: walkReq.id,
    authorId: u.priya.id,
    body: walkReq.description!,
    createdAt: ago(0, 5),
  });
  await db.insert(s.activity).values({
    actorId: u.priya.id,
    action: "asset.correction_flagged",
    productId: walker.id,
    assetId: walkMain.id,
    requestId: walkReq.id,
    meta: { note: walkReq.description, priority: "high" },
    createdAt: ago(0, 5),
  });
  const walkVideo = await asset(walker, "Product video", "video", ["amazon", "website"], u.neha);
  const walkVideoV = await versions(walkVideo, walker, [
    { note: "Lifestyle cut with mum", daysAgo: 9, by: u.neha, file: await reel("walker-with-mum") },
  ]);
  await live(walkVideo, walker, "amazon", walkVideoV[0], u.priya);
  // website pending

  // ─── 3. Stroller: quick commerce only, half published ────────────────
  const stroller = await product("Travel Stroller Lite", "STR-LITE", "Gear", {
    amazon: "B0CSTRLT01",
    blinkit: "501266",
    zepto: "ZP-80412",
  });
  const strMain = await asset(stroller, "Main image", "image", ["amazon", "blinkit", "zepto"], u.arjun);
  const strMainV = await versions(strMain, stroller, [
    { note: "Studio packshot", daysAgo: 14, by: u.arjun, file: await productShot("stroller-studio", "5.8 kg", "#1d4ed8", "One-hand fold") },
    { note: "Weight claim updated after QA: 5.8kg → 6.1kg", daysAgo: 0.2, by: u.arjun, file: await productShot("stroller-studio", "6.1 kg", "#1d4ed8", "One-hand fold", { badge: true }) },
  ]);
  await live(strMain, stroller, "amazon", strMainV[0], u.priya);
  await live(strMain, stroller, "blinkit", strMainV[0], u.rohan);
  const strVideo = await asset(stroller, "Product video", "video", ["amazon"], u.neha);
  const strVideoV = await versions(strVideo, stroller, [
    { note: "Reveal video", daysAgo: 6, by: u.neha, file: await reel("stroller-reveal") },
  ]);
  await live(strVideo, stroller, "amazon", strVideoV[0], u.priya);
  const strBanner = await asset(stroller, "Blinkit banner", "banner", ["blinkit"], u.arjun);
  void strBanner; // nothing uploaded yet

  // ─── 4. Bath tub: brand-new product, standard slots, open request ────
  const tub = await product("Baby Bath Tub with Stand", "BTH-01", "Bath", { amazon: "B0CBTH0101" });
  for (const name of ["Main image", "Image 2", "Image 3", "A+ content", "Product video"]) {
    await asset(tub, name, name.includes("video") ? "video" : name.startsWith("A+") ? "a_plus" : "image", ["amazon", "website"], u.neha);
  }
  const tubVideo = await db.query.assets.findFirst({ where: sql`${s.assets.productId} = ${tub.id} and ${s.assets.name} = 'Product video'` });
  await versions(tubVideo!, tub, [{ note: "Bath-time hero video", daysAgo: 0.1, by: u.neha, file: await reel("bathtub-fill") }]);
  const [tubReq] = await db
    .insert(s.requests)
    .values({
      type: "new_creative",
      priority: "normal",
      title: "Diwali offer banner for quick commerce",
      description: "1080×1080 and 1200×628. 'Flat 20% off' till 3 Nov. Use the bath-time lifestyle shot.",
      productId: tub.id,
      requestedById: u.rohan.id,
      assigneeId: u.neha.id,
      dueDate: ago(-3).toISOString().slice(0, 10),
      createdAt: ago(1),
      updatedAt: ago(1),
    })
    .returning();
  await db.insert(s.activity).values({
    actorId: u.rohan.id,
    action: "request.created",
    productId: tub.id,
    requestId: tubReq.id,
    meta: { title: tubReq.title, type: tubReq.type },
    createdAt: ago(1),
  });

  // ─── Notifications so the bell isn't empty ───────────────────────────
  await db.insert(s.notifications).values([
    { userId: u.priya.id, title: "Steel Sipper Bottle 300ml — Main image → v3 ready to publish", body: "What changed: Brighter background and new BPA-free claim.", href: `/assets/${sipMain.id}`, createdAt: ago(1) },
    { userId: u.rohan.id, title: "Steel Sipper Bottle 300ml — Main image → v3 ready to publish", body: "What changed: Brighter background and new BPA-free claim.", href: `/assets/${sipMain.id}`, createdAt: ago(1) },
    { userId: u.priya.id, title: "Travel Stroller Lite — Main image → v2 ready to publish", body: "What changed: Weight claim updated after QA: 5.8kg → 6.1kg.", href: `/assets/${strMain.id}`, createdAt: ago(0.2) },
    { userId: u.rohan.id, title: "Travel Stroller Lite — Main image → v2 ready to publish", body: "What changed: Weight claim updated after QA: 5.8kg → 6.1kg.", href: `/assets/${strMain.id}`, createdAt: ago(0.2) },
    { userId: u.neha.id, title: "Correction needed: Foldable Baby Walker — Main image", body: walkReq.description, href: `/assets/${walkMain.id}`, createdAt: ago(0, 5) },
    { userId: u.neha.id, title: "New request: Diwali offer banner for quick commerce", body: tubReq.description, href: `/requests?open=${tubReq.id}`, createdAt: ago(1) },
  ]);

  // ─── A healthy product for contrast ──────────────────────────────────
  const feed = await product("Silicone Feeding Set", "FDS-05", "Feeding", { amazon: "B0CFDS0505", flipkart: "FDSSIL05" });
  const feedMain = await asset(feed, "Main image", "image", ["amazon", "flipkart"], u.arjun);
  const feedMainV = await versions(feedMain, feed, [
    { note: "Launch packshot", daysAgo: 25, by: u.arjun, file: await productShot("first-sips", "5 pc", "#be185d", "Silicone feeding set") },
  ]);
  await live(feedMain, feed, "amazon", feedMainV[0], u.priya);
  await live(feedMain, feed, "flipkart", feedMainV[0], u.priya);

  console.log(`Seeded ${channels.length} channels, ${people.length} people and 5 products with creatives.`);
  console.log("Start the app with `npm run dev` and sign in as anyone on the login page.");
}

function write(key: string, data: Buffer) {
  const full = path.join(UPLOADS, key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, data);
}

/** A 1500×1500 marketplace-style image built from a portfolio frame, with a label so versions look different. */
async function productShot(
  poster: string,
  badgeText: string,
  color: string,
  headline: string,
  opts: { badge?: boolean; bright?: boolean } = {},
) {
  const size = 1500;
  const source = path.join(PORTFOLIO, "posters", `${poster}.webp`);
  const base = fs.existsSync(source)
    ? sharp(source).resize(size, size, { fit: "cover" })
    : sharp({ create: { width: size, height: size, channels: 3, background: "#f3f4f6" } });
  const overlay = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="${size - 260}" width="${size}" height="260" fill="white" fill-opacity="0.92"/>
    <text x="80" y="${size - 120}" font-family="Helvetica, Arial, sans-serif" font-size="78" font-weight="700" fill="#111827">${escapeXml(headline)}</text>
    ${opts.badge ? `<circle cx="${size - 210}" cy="210" r="140" fill="${color}"/><text x="${size - 210}" y="235" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="70" font-weight="800" fill="white">${escapeXml(badgeText)}</text>` : ""}
  </svg>`);
  const data = await base
    .modulate({ brightness: opts.bright ? 1.15 : 1 })
    .composite([{ input: overlay }])
    .jpeg({ quality: 85 })
    .toBuffer();
  const thumb = await sharp(data).resize(640, 640).jpeg({ quality: 80 }).toBuffer();
  return { data, name: `${poster}-main.jpg`, mime: "image/jpeg", width: size, height: size, thumb };
}

async function reel(name: string) {
  const file = path.join(PORTFOLIO, "reels", `${name}.mp4`);
  const poster = path.join(PORTFOLIO, "posters", `${name}.webp`);
  const data = fs.existsSync(file) ? fs.readFileSync(file) : Buffer.from("");
  const thumb = fs.existsSync(poster) ? await sharp(poster).resize(640).jpeg({ quality: 80 }).toBuffer() : undefined;
  return { data, name: `${name}.mp4`, mime: "video/mp4", width: 1080, height: 1920, duration: 12, thumb };
}

function escapeXml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
