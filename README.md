# WinterChat

A web app where an admin reads messages sent to a LINE Official Account and replies from one shared inbox — with LINE Login, an invite code, and a stats dashboard.

Hosted console: **[https://winterchat-service.asterclub.dev](https://winterchat-service.asterclub.dev)**

## Try it online

1. Open [https://winterchat-service.asterclub.dev](https://winterchat-service.asterclub.dev) (you are sent to `/login`).
2. Click **Continue with LINE** and approve LINE Login.
3. Enter the workspace invite code. On the live site, **Ask an admin** shows `CDj798`.
4. Click **Join workspace**. You land in the inbox.

From there: **Inbox** (`/inbox`) for threads, **Dashboard** (`/dashboard`) for today’s or last-7-days summary (Asia/Bangkok). Membership sticks after the first join; later visits still need LINE Login.

There is no public sign-up.

## What it does

- **Inbox** — one thread per LINE contact: history, optimistic send with retry, Open / Pending / Closed, search, text and image messages both ways. New inbound LINE messages show up live via an authenticated long-poll (`GET /sync`), not an 8-second timer.
- **Login** — two gates in order: LINE Login (who you are), then a shared invite code (`ACCESS_CODE`) to join the workspace.
- **Dashboard** — contacts, unread, inbound/outbound volume, a bar chart, a recent-activity list, and a day-by-day table. Ranges: Today and 7 days.

Facebook, WhatsApp, and web chat are labelled coming soon. Only LINE is live.

## Architecture

Two Next.js 16 apps, two Vercel projects:

```text
┌──────────────┐   /gateway/*     ┌──────────────┐
│  apps/web    │ ───────────────▶ │  apps/api    │
│  (console)   │  Bearer JWT 120s │  (resource   │
│  NextAuth    │◀───────────────  │   server)    │
│  LINE Login  │                  │  Prisma      │
└──────┬───────┘                  └──────┬───────┘
       │ browser                         │
       ▼                                 ▼
  admin's browser             Postgres (Supabase) + Storage
                                         ▲
                                         │ webhook (HMAC)
                                   LINE Messaging API
```

- **`apps/web`** — admin UI. Owns auth end to end (NextAuth v5 + LINE Login). The browser never calls `apps/api` directly. Every API call goes through `/gateway/*`, which mints a short-lived HS256 JWT (`SESSION_SECRET`, 120s) and forwards it as `Authorization: Bearer`.
- **`apps/api`** — stateless resource server. Sets no cookies. Verifies that same `SESSION_SECRET`. Owns Prisma → Postgres, the LINE webhook (signature + event-id dedupe), Messaging API (Reply, then Push), Supabase Storage for images, and `GET /api/sync` (long-poll watermark for the inbox).
- **Auth** — staff are real users keyed by LINE user id. LINE-authenticated is not yet a member; the invite code is the second gate. After a successful join, `apps/web` calls `GET /api/auth/membership` once via `useSession().update()` and stores `member` on the NextAuth JWT. It does **not** re-read membership on every page load (that callback must not trust a client `update()` payload).
- **Data** (`apps/api/prisma/schema.prisma`) — `User`, `Contact`, `Conversation`, `Message`, `ReplyToken`, `WebhookEvent`. `User` and `Contact` are separate tables with no foreign key: the same LINE id can appear in both.
- **No roles** — every member has full access.

Inbound live updates are **not** Supabase Realtime. Auth is LINE Login + NextAuth, so Postgres RLS cannot tell a member from anyone holding the public anon key. `/sync` reuses the same Bearer token as the rest of the API and returns only `{ changed, at }` — the console then refetches conversations and the open thread.

## Tech stack

| Piece | Where | Role |
| --- | --- | --- |
| Next.js 16, React 19, TypeScript | both apps | App Router UI and API route handlers |
| NextAuth v5 (LINE provider) | `apps/web` | LINE Login, session cookie |
| jose (HS256) | both | service token mint (web) / verify (api) |
| Prisma 7 + `pg` adapter | `apps/api` | Postgres access; URLs in `prisma.config.ts` |
| Zod | `apps/api` | env validation |
| Tailwind CSS 4, shadcn/ui, Lucide, Geist | `apps/web` | console UI |
| Jest | both | unit tests |
| Supabase Postgres + Storage | hosted data | DB and `chat-media` image bucket |
| Vercel + GitHub Actions | production | CI on call; deploy `apps/api` and `apps/web` from `production` |
| LINE Messaging API | `apps/api` | webhook, profile, content, Reply, Push |
| LINE Login | `apps/web` | a **different** channel from Messaging API |

Node **24** in CI. npm workspaces (`apps/*`). Root `dev` / `dev:web` / `dev:api` / `db:migrate` scripts still call **bun**; per-app `npm run dev` and CI use **npm**.

## Project structure

```text
apps/
  web/                         admin console
    src/app/(console)/         inbox + dashboard (members only)
    src/app/login/             two-gate sign-in
    src/app/api/auth/          NextAuth routes
    src/app/gateway/[...path]/ server-side proxy to apps/api
    src/components/auth/       sign-in, join, marketing panel
    src/components/inbox/      list, thread, composer, details
    src/components/dashboard/  stat cards, bar chart, day table
    src/components/shell/      top bar, bottom tabs, global search
    src/lib/hooks/use-inbox-live.ts   long-poll /gateway/sync
    src/auth.ts                NextAuth config
    src/proxy.ts               Next 16 request guard
  api/                         resource server
    src/app/api/auth/          join, membership
    src/app/api/conversations/ list, detail, read, messages
    src/app/api/messages/      retry
    src/app/api/dashboard/     summary
    src/app/api/line/webhook/  LINE inbound
    src/app/api/uploads/       outbound images
    src/app/api/sync/          inbox long-poll
    src/lib/db/                Prisma stores
    src/lib/line/              Messaging API client (fetch, no SDK)
    src/lib/storage/           Supabase Storage
    src/lib/services/          domain logic
    src/proxy.ts               Bearer + membership guard
    prisma/schema.prisma
    prisma/migrations/
.github/workflows/             ci.yml, deploy.yml
openapi.yaml                   HTTP contract both apps follow
.env.example                   required variables (no secrets)
```

## Getting started

**Need:** Node 24, npm, a Supabase project (Postgres + a public Storage bucket named `chat-media`), a LINE **Messaging API** channel, and a separate LINE **Login** channel (different credentials — do not reuse one for the other).

```bash
git clone <this-repo>
cd winter-chat-service
npm install
```

`apps/api` runs `prisma generate` on install.

### Environment

Copy [`.env.example`](./.env.example) into both apps, then fill in only the keys that app uses:

```bash
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
```

**`apps/api/.env`**

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres (port 6543, add `pgbouncer=true`) |
| `DIRECT_URL` | Direct/session URL (port 5432) for `prisma migrate` |
| `ACCESS_CODE` | Shared invite code (case-sensitive) |
| `SESSION_SECRET` | ≥32 chars, **not** equal to `ACCESS_CODE`, **byte-identical** to web |
| `LINE_CHANNEL_SECRET` | Messaging API channel secret (webhook HMAC) |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API token |
| `SUPABASE_URL` | Project URL for Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; never ship to `apps/web` |

**`apps/web/.env.local`**

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | NextAuth cookie signing |
| `AUTH_LINE_ID` / `AUTH_LINE_SECRET` | LINE **Login** channel |
| `SESSION_SECRET` | Same value as `apps/api/.env` |
| `API_ORIGIN` | `http://localhost:3001` locally. Do not use `NEXT_PUBLIC_` |

`.env.example` also lists `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Nothing in the code reads them (Realtime was not wired).

LINE Login callback to register:

```text
http://localhost:3000/api/auth/callback/line
```

Production: the same path on `https://winterchat-service.asterclub.dev`.

`SESSION_SECRET` mismatch 401s every proxied call with no other symptom.

### Database

`prisma.config.ts` reads `DATABASE_URL`. The transaction pooler does not support the advisory locks `migrate deploy` needs (it hangs rather than erroring). Point the CLI at the direct URL:

```bash
cd apps/api
set -a && source .env && set +a
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy
```

Create a public Storage bucket named **`chat-media`** if you want image send/receive.

### Run

Each app’s own `next dev` works with npm. Root `npm run dev:web` / `dev:api` call bun.

```bash
cd apps/api && npm run dev   # :3001
cd apps/web && npm run dev   # :3000
```

Sign in at http://localhost:3000/login with the `ACCESS_CODE` from `apps/api/.env`.

LINE cannot reach localhost. For real inbound messages, expose `apps/api` (ngrok or similar) and set the Official Account webhook to:

```text
https://<your-public-host>/api/line/webhook
```

## Testing

```bash
npm test                  # unit tests, both apps (Jest). No DB, no network.
npm run test:integration  # apps/api HTTP suite against a running API + real Postgres
npm run lint
npm run format:check
```

Typecheck each app with `npx tsc --noEmit` in `apps/api` and `apps/web`.

`.github/workflows/ci.yml` is format, lint, typecheck, unit test, build. It does **not** run integration tests.

Root `package.json` still has `test:e2e` pointing at `e2e/playwright.config.ts`. That folder is not in the repo; the command will fail until a Playwright suite is added.

## Deployment

Two Vercel projects, one per app, from `.github/workflows/deploy.yml` on push/PR to `production`. `apps/api`’s `vercel-build` runs `prisma generate`, `prisma migrate deploy` against `DIRECT_URL`, then `next build`.

## Troubleshooting

- **“There was a problem with the server configuration” on login** — missing `AUTH_SECRET` or `AUTH_LINE_*` in `apps/web/.env.local`.
- **Every inbox call is 401** — `SESSION_SECRET` differs between the two apps (including quotes/whitespace).
- **Join code always fails** — `ACCESS_CODE` does not match what you typed (case-sensitive).
- **Gateway 500** — `SESSION_SECRET` missing or shorter than 32 characters on web.
- **Gateway 502** — `apps/api` is not running, or `API_ORIGIN` is wrong.
- **Images show as unsupported** — Storage env or `chat-media` bucket missing on the API.
- **LINE Login works locally but not in production** — production callback URL not registered on the LINE Login channel.
- **`prisma migrate deploy` hangs** — still using the pooled `DATABASE_URL`; override with `DIRECT_URL` as above.
