# Creative Tracker

One place for every team to find the **latest approved creative** for each product, and to see **which version is live on each channel**.

Designers upload new versions into fixed slots (Main image, Image 2, Product video, A+…). Listing, quick-commerce, e-com and marketing teams download the current version, upload it on their channel, and mark it live with one click. When a designer uploads a correction, every channel showing the old version is flagged **Outdated** and the people responsible for those channels are notified.

## How it works

```
Product (SKU, listing IDs per channel)
  └─ Asset slot  e.g. "Main image", used on Amazon, Flipkart, Blinkit…
       ├─ v1, v2, v3 …  each with a required "what changed" note
       └─ per channel:  which version is live, who marked it, when
```

For every asset, each channel is in one of four states, worked out automatically:

| State | Meaning |
|---|---|
| **Not ready** | No approved version yet |
| **To publish** | A version is approved but this channel has never had it marked live |
| **Outdated** | The channel shows an older version than the current one |
| **Live** | The channel shows the current version |

### What happens automatically

- **New version uploaded:** it becomes current, every channel showing an older version turns *Outdated*, and the people who look after those channels get an alert (in-app, plus email and Slack if configured).
- **Correction requests close themselves** when the fixed version is uploaded (or approved, if review is on), and whoever raised them is told.
- **Downloads are renamed** to `SKU_Asset-name_v3.jpg`, whatever the designer called the file.
- **New products get standard slots** (Main image, Image 2–7, A+ content, Product video). The list is configurable.
- **Thumbnails, dimensions and video duration** are captured in the browser on upload.
- **Everything is logged:** uploads, approvals, downloads, mark-live and corrections, with who and when.

### Who does what

| Role | Can |
|---|---|
| Admin | Everything, including people, channels and workflow settings |
| Designer | Upload versions, work on requests, roll back to an older version |
| Reviewer | Approve or reject versions (when review is on), mark live |
| Team member | Download, mark live, flag corrections, raise requests (listing, qcom, ecom, marketing, content) |
| Viewer | Read-only and download |

Each person picks the channels they publish to (**My channels & alerts**). Their dashboard then becomes their to-do list, and they only get alerts that concern them.

### Main screens

- **Dashboard:** counts of creatives to publish, outdated, in review and needing correction; health per channel; your personal queue; recent activity.
- **Channel queue** (e.g. *Blinkit*): everything to upload on that channel, outdated items first, with download and bulk "mark live".
- **Asset page:** preview, version history, side-by-side and slider comparison, per-channel status, comments, corrections, review.
- **Requests:** board for new creatives and corrections, with priority, due dates and assignees.
- **Products:** catalogue with listing IDs per channel, plus CSV import.
- **Admin:** people and roles, channels, approval on/off, standard slots, integration status.

## Run it locally

Requires Node 20.9+.

```bash
cd asset-tracker
npm install
cp .env.example .env.local      # then set APP_SECRET (openssl rand -hex 32)
npm run db:seed                 # optional demo data: 6 channels, 8 people, 5 products
npm run dev                     # http://localhost:3000
```

With no `DATABASE_URL`, the app uses an embedded Postgres stored in `.data/pglite`, and files go to `.data/uploads`. Nothing else needs installing. With `ALLOW_DEV_LOGIN=true` the login page lets you sign in as any user without a password, which is handy for trying each role. Stop `npm run dev` before running `npm run db:seed`, because only one process can open the embedded database at a time.

```bash
npm test            # unit + database query tests (in-memory Postgres)
npm run typecheck
npm run lint
```

## Deploy for the team

1. **Database:** any Postgres (Supabase, Neon, RDS…). Set `DATABASE_URL`. Migrations run automatically on startup (or `npm run db:migrate`).
2. **Files:** create a Cloudflare R2 or S3 bucket and set `STORAGE_DRIVER=s3` and the `S3_*` variables. Browsers upload directly to the bucket, so large videos never pass through the app server. The bucket needs a CORS rule allowing `PUT` from your `APP_URL` with the `Content-Type` header.
3. **Sign-in:** create a Google OAuth client with redirect URI `{APP_URL}/api/auth/google/callback`. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and set `ALLOWED_EMAIL_DOMAINS=yourcompany.com` so colleagues can sign in. Set `ADMIN_EMAILS` for the first admins. **Set `ALLOW_DEV_LOGIN=false`.**
4. **Alerts (optional):** `SLACK_WEBHOOK_URL` posts new versions and urgent corrections to one channel. `SMTP_*` emails each person their alerts.
5. Host it on anything that runs Node (Vercel, Render, Railway, a VM with `npm run build && npm start`). All settings are documented in `.env.example`.

## Built with

Next.js 16 (App Router, server actions), React 19, Tailwind CSS 4, Drizzle ORM on Postgres (PGlite locally), S3-compatible storage, Google OAuth via Arctic.

```
src/
  app/(app)/        pages behind sign-in (dashboard, assets, channels, products, requests, admin)
  app/actions/      server actions: every write goes through these, each permission-checked
  app/api/          OAuth, local upload endpoint, authenticated file download/stream
  db/schema.ts      tables and relations
  lib/domain.ts     pure business rules: channel states, permissions, workflow, naming
  lib/queries.ts    read models for lists, dashboard and channel queues
  lib/storage.ts    local disk / S3 driver, signed upload URLs
  lib/notify.ts     in-app, email and Slack notifications + audit log
scripts/seed.ts     demo workspace
tests/              vitest
```

## Not built yet (ideas for later)

- Check images against each channel's rules on upload (Amazon's white-background main image, minimum resolution, video length).
- Amazon SP-API: push approved images and detect when the live listing doesn't match the current version.
- Bulk "download all current creatives for this channel" as a ZIP.
- @mentions in comments, and a daily email digest instead of one email per event.
