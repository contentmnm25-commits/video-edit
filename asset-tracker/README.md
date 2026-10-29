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

With no `DATABASE_URL`, the app uses an embedded Postgres stored in `.data/pglite` (migrated automatically on startup), and files go to `.data/uploads`. Nothing else needs installing. With `ALLOW_DEV_LOGIN=true` the login page lets you sign in as any user without a password, which is handy for trying each role. Stop `npm run dev` before running `npm run db:seed`, because only one process can open the embedded database at a time.

```bash
npm test            # unit + database query tests (in-memory Postgres)
npm run typecheck
npm run lint
```

## Deploy for the team

### Netlify (step by step)

The repo root has a `netlify.toml` that builds `asset-tracker/` and applies database migrations on every deploy. Netlify's servers have no lasting disk, so you need three outside services. All have free tiers.

**1. Database: Neon**
- Create a project at neon.tech and copy the **pooled** connection string (the host contains `-pooler`).
- Or, in Netlify, add the Neon database extension, which sets `DATABASE_URL` for you.

**2. File storage: Cloudflare R2**
- Create a bucket, e.g. `creatives`.
- Create an R2 API token with *Object Read & Write* on that bucket. Note the Access Key ID, the Secret, and your account's S3 endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
- In the bucket's **Settings → CORS policy**, allow the browser to upload:
  ```json
  [{ "AllowedOrigins": ["https://YOUR-SITE.netlify.app"], "AllowedMethods": ["PUT", "GET", "HEAD"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
  ```

**3. Google sign-in**
- In Google Cloud Console: create a project, configure the **OAuth consent screen** (User type *Internal* if you have Google Workspace, otherwise *External* and set it to *In production*), then **Credentials → Create OAuth client ID → Web application**.
- Authorised redirect URI: `https://YOUR-SITE.netlify.app/api/auth/google/callback`.

**4. Netlify**
- *Add new site → Import from Git*, pick this repo and the branch to deploy. `netlify.toml` fills in the build settings.
- Under *Site configuration → Environment variables*, add:

  | Variable | Value |
  |---|---|
  | `APP_URL` | `https://YOUR-SITE.netlify.app` (no trailing slash) |
  | `APP_SECRET` | output of `openssl rand -hex 32` |
  | `DATABASE_URL` | Neon pooled connection string |
  | `STORAGE_DRIVER` | `s3` |
  | `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
  | `S3_REGION` | `auto` |
  | `S3_BUCKET` | `creatives` |
  | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | from the R2 token |
  | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google |
  | `ADMIN_EMAILS` | your email: you become admin on first sign-in |
  | `ALLOWED_EMAIL_DOMAINS` | your company domain if staff use Google Workspace. **Leave empty if people use @gmail.com**, otherwise anyone with Gmail could sign in. Add people under Admin → People instead. |
  | `ALLOW_DEV_LOGIN` | `false` |
  | `SLACK_WEBHOOK_URL`, `SMTP_*` | optional |

- Deploy. If you only learn the site URL after the first deploy, set `APP_URL`, the Google redirect URI and the R2 CORS origin to it, then redeploy.

**5. First sign-in**
- Sign in with the email in `ADMIN_EMAILS`.
- Go to **Admin → Channels → Add Amazon, Flipkart, Blinkit…**.
- Add colleagues under **Admin → People** (role, team, and the channels they publish to).
- Import products under **Products → Import CSV**.

### Any other host

Any Node host works (Render, Railway, a VM): set the same variables, run `npm run db:migrate` on each deploy, then `npm run build && npm start`. With no `DATABASE_URL` the app falls back to the embedded database and local files, which is fine on a single server with a persistent disk.

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
