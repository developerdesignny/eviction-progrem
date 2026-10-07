# Docket — Eviction Case Management

Single project: an Express + Prisma API and a React (Vite) client in one repo, one build,
one deploy. Hosted on Netlify: the built client on the CDN and the same Express app as one
function at `/api/*`, so there is no CORS setup and no second service.

Design decisions live in [`docs/requirements.md`](docs/requirements.md),
[`docs/db-schema.md`](docs/db-schema.md) and [`docs/field-mapping.md`](docs/field-mapping.md).

## Where we are up to

| | Status |
|---|---|
| Design docs, schema, decisions | Done — `docs/` |
| Code scaffolded (API, client, rules) | Done — never compiled or run yet |
| `npm install` | Done |
| Local Postgres reachable on :5432 | Yes, listening |
| Database credentials | Done |
| Initial migration (`prisma/migrations/`) | Done: `20260810203913_init` |
| First run of the app | Not yet |
| Stage lists built in Configuration | Not yet — the app ships with none |
| Netlify setup (function, build, config) | Done: `netlify.toml`, `netlify/functions/api.mts` |
| Deployed to Netlify | Not yet: see `docs/netlify-deployment.md` |

**Next action:** `npm install` (new Netlify dependencies), `npm run typecheck`, then follow
`docs/netlify-deployment.md` to create the Netlify site and deploy.

## Getting started (local)

1. **Postgres** — have a database running locally and create an empty `docket` database.
2. **Install.** `.env` already exists with local defaults and a generated `JWT_SECRET`; set
   `DB_USER` and `DB_PASSWORD` to your Postgres credentials.
   ```bash
   npm install
   ```
3. **Create the first migration** (once, and commit it — deploys replay it):
   ```bash
   npm run prisma:migrate      # name it "init"
   ```
4. **Run it**
   ```bash
   npm run dev                 # API on :3000, client on :5173
   ```
   Open http://localhost:5173 and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Startup applies any pending migrations and creates the first user if there are none, so
step 4 is normally all you need after pulling changes.

There are no stages out of the box — that is deliberate. Build the real stage list for NP
and Holdover under **Configuration**, and it appears on every open project of that type.

## Local or hosted database

One switch in `.env` decides what everything — the app, migrations, Prisma Studio — talks to:

```ini
DB_TARGET=local           # or: hosted

DB_USER="postgres"        # local credentials, as parts
DB_PASSWORD="postgres"
# DB_HOST / DB_PORT / DB_NAME / DB_SCHEMA default to localhost / 5432 / docket / public

DATABASE_URL_HOSTED=""    # a hosted Postgres URL, e.g. from `netlify database status --show-credentials`
```

The local side is assembled from parts because the password is escaped for you — paste it
exactly as it is, symbols and all. If you'd rather give the whole string yourself, set
`DATABASE_URL_LOCAL` instead; it's used only when `DB_USER` is unset, and then you *do* have
to percent-encode. The hosted side is always a full URL, since that is what hosts hand out.

Every database command prints its target before doing anything, so a migration can't land
on the wrong database unnoticed:

```
  Database: HOSTED (live) -> ep-xxxx.us-east-2.aws.neon.tech/neondb
```

`npm run db:which` prints it without running anything. On Netlify neither variable is set:
the platform injects `NETLIFY_DB_URL` (Netlify Database) or you set `DATABASE_URL`, and
the app falls back to whichever is present.

## Migrations run themselves

The app applies pending migrations on startup (`AUTO_MIGRATE=true`, the default) and then
creates the first user if the database has none. A fresh deploy therefore comes up ready to
sign in, with no shell step.

It runs `prisma migrate deploy`, which only *applies* migration files that already exist — it
never generates one from a changed schema and never drops data. Authoring a migration stays a
deliberate local act: change `prisma/schema.prisma`, run `npm run prisma:migrate`, commit the
generated folder. Set `AUTO_MIGRATE=false` to skip the startup check entirely.

If a migration fails, the server refuses to start rather than serving against a schema it
doesn't match.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Vite (5173) + Express (3000) together, `/api` proxied |
| `npm run build` | `vite build` → `dist/public`, `tsc` → `dist/server` |
| `npm start` | Production: migrate, then serve API + client bundle from one port |
| `npm run typecheck` | Type-checks client and server |
| `npm run prisma:migrate` | Author + apply a migration against the selected database |
| `npm run prisma:deploy` | Apply existing migrations only |
| `npm run prisma:studio` | Browse the selected database |
| `npm run db:which` | Print which database is selected |
| `npm run db:setup` | Migrate + create first user, without starting the app |

## Deploying to Netlify

The client is published to the Netlify CDN from `dist/public`; the Express API runs as one
Netlify Function at `/api/*` (`netlify/functions/api.mts` wraps the same `app`). Same origin,
so the auth cookie works unchanged. Full plan and decisions: `docs/netlify-deployment.md`.

- **Build:** `npm run build:netlify` (Vite build, `prisma generate`, `prisma migrate deploy`)
- **Publish:** `dist/public`
- **Database:** Netlify Database (managed Postgres), provisioned on the first deploy because
  `@netlify/database` is installed; its `NETLIFY_DB_URL` is picked up automatically. An
  external Postgres works too: set `DATABASE_URL` in the site env vars instead.
- **Env vars to set in the Netlify UI** (scopes: Builds and Functions): `JWT_SECRET`,
  `ADMIN_EMAIL`, `ADMIN_PASSWORD`, optionally `ADMIN_NAME`.
- **File uploads** are capped at 4 MB (Netlify Functions cap request bodies at about
  4.5 MB of binary). Larger documents need object storage; see the plan doc.

First deploy: link the GitHub repo as a new Netlify project, set the env vars, deploy. If the
build log shows the "no database connection string found" warning, the database was still
being provisioned; click **Deploy again** and the migrations apply.

Local: `npm run dev` is unchanged. `netlify dev` (after `npm i -g netlify-cli`) runs the
client plus the real function at http://localhost:8888 against the database in `.env`.

## Troubleshooting the first run

**`P1000: Authentication failed ... credentials for "postgres" are not valid`**
The password in `.env` doesn't match your Postgres install. Edit the two credential lines:

```ini
DB_USER="postgres"
DB_PASSWORD="YOUR_REAL_PASSWORD"
```

Paste the password verbatim — it's URL-escaped for you, so `@`, `#`, `/`, `:` and `%` are
fine as-is. (Only the older `DATABASE_URL_LOCAL` form needs manual percent-encoding.)

Check it with `npm run db:which`, then `node scripts/prisma.mjs migrate status` to confirm
the connection before migrating.

**`P1003: Database "docket" does not exist`**
Create it once:
```bash
psql -U postgres -c "CREATE DATABASE docket;"
```
(or right-click → Create → Database in pgAdmin).

**`P1001: Can't reach database server`**
Postgres isn't running, or is on another port. Check the "postgresql-x64-*" Windows service.

**Command prints the database banner then exits silently**
Fixed — it was the Prisma CLI being spawned through `npx.cmd`, which Node blocks on Windows.
If you see it again, run `node scripts/prisma.mjs migrate status` directly for the real error.

**`prisma migrate dev` seems to hang**
It's waiting for a migration name. Pass one: `npm run prisma:migrate -- --name init`.

## Rules worth knowing before changing code

These are behaviors, not accidents — see `docs/requirements.md` for the reasoning.

- **Nothing is ever deleted.** Projects close, stages/fields/contacts hide, users deactivate.
  No relation uses `onDelete: Cascade`, on purpose.
- **Intake is not a stage.** It's a fixed panel plus a computed `intakeDone`, and it never
  appears in the stage grid, progress bar, or Configuration.
- **`intakeDone` is computed** from a core subset of the 29 intake fields — intake checkboxes
  are excluded, because an unchecked box there ("no ledger") is a real answer.
- **Stage completion is derived**, never a button: all required fields filled, or all fields
  if none are required. A stage with no fields falls back to a manual toggle.
- **Hidden is only hidden where empty.** A hidden field still renders (read-only) on projects
  that already hold a value for it.
- **Stages mirror the config for open projects only.** Closed cases keep the stage set they
  had at close; reopening resumes reconciliation.
- **Files are `bytea` in Postgres** — no object storage to host or back up separately.
