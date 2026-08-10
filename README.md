# Docket — Eviction Case Management

Single project: an Express + Prisma API and a React (Vite) client in one repo, one build,
one deploy. In production Express serves the built client and the `/api/*` routes itself,
so there is no CORS setup and no second service.

Design decisions live in [`docs/requirements.md`](docs/requirements.md),
[`docs/db-schema.md`](docs/db-schema.md) and [`docs/field-mapping.md`](docs/field-mapping.md).

## Where we are up to

| | Status |
|---|---|
| Design docs, schema, decisions | Done — `docs/` |
| Code scaffolded (API, client, rules) | Done — never compiled or run yet |
| `npm install` | Done |
| Local Postgres reachable on :5432 | Yes, listening |
| **Database credentials** | **Blocked — `.env` has the wrong password (Prisma P1000)** |
| Initial migration (`prisma/migrations/`) | Not created yet — blocked by the above |
| First run of the app | Not yet |
| Stage lists built in Configuration | Not yet — the app ships with none |
| Deployed to Render | Not yet |

**Next action:** set `DB_USER` / `DB_PASSWORD` in `.env` to your real Postgres credentials
(see Troubleshooting below), then `npm run prisma:migrate -- --name init`, then `npm run dev`.

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

DATABASE_URL_HOSTED=""    # Render → Postgres → Connect → External Database URL
```

The local side is assembled from parts because the password is escaped for you — paste it
exactly as it is, symbols and all. If you'd rather give the whole string yourself, set
`DATABASE_URL_LOCAL` instead; it's used only when `DB_USER` is unset, and then you *do* have
to percent-encode. The hosted side is always a full URL, since that's what Render hands out.

Every database command prints its target before doing anything, so a migration can't land
on the wrong database unnoticed:

```
  Database: HOSTED (live) → dpg-xxxx.oregon-postgres.render.com/docket
```

`npm run db:which` prints it without running anything. On Render neither variable is set —
`DATABASE_URL` is injected there, and the app falls back to it automatically.

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

## Deploying to Render

`render.yaml` describes one Web Service + one Postgres instance. Point Render at the repo
as a Blueprint, then set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (the rest is wired up):

- **Build:** `npm install --include=dev && npm run build`
- **Start:** `npm start` — migrates, creates the first user if needed, then serves

`--include=dev` matters: Render sets `NODE_ENV=production`, which otherwise makes npm skip
the build tooling. (This project keeps build tools in `dependencies` too, so either way works.)

Nothing else to run by hand — but **commit `prisma/migrations/`**, since the deploy replays
those files rather than reading your schema.

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
