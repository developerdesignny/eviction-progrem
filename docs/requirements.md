# EvictionProgrem — Requirements

## Overview
Web app to manage eviction cases: projects (cases) move through configurable stages, each stage with configurable fields to fill out. Stack: FE + BE + DB, clean/neat structure.

## Core Features

1. **Login & users** — JWT auth (httpOnly cookie, 7-day expiry, bcrypt password hashes). Basic user management: list / create / edit / **deactivate** users and change password, on a Users tab in Configuration. Single role for now (every user is an admin); users are deactivated rather than deleted, and the last active user cannot be deactivated.
2. **Projects** — top-level entity (an eviction case). Project type: **NP** (Non-Payment) or **Holdover**.
   - **Case number** — auto-generated, sequential, resets per year: `EV-2026-0001`. Permanent internal identifier, shown in the project list, searchable.
   - **Docket number** — separate, editable, optional. The real court-assigned number, filled in once the court issues it. Also searchable.
3. **Project intake form & info** — 29-field intake form (see `field-mapping.md`), editable after creation, collapsible on the project detail view. **Intake is not a stage** — it is a fixed panel on the project with its own `intakeDone` marker, and it does not appear in the stage grid, the segmented progress bar, or the stage Configuration screen.
   - **Nothing is required to create a project** except the project type (NP/Holdover), which is needed to decide the stage set. Everything else is filled in over time. The case number is generated automatically.
   - **`intakeDone` is computed automatically**, from a *core subset* of the 29 fields — not all of them, since several are legitimately blank on a normal case (see "Intake Done — core fields" below).
4. **Stage configuration** — admin defines stages per project type (project type + its stage list are configurable, not hardcoded). Stages run as **independent, parallel checklists** (not a locked sequential pipeline) — see `field-mapping.md`.
   - **Stages always mirror the configuration.** Every open project of a type carries exactly the stages configured for that type; missing `ProjectStage` rows are reconciled whenever a project is loaded or saved. Adding a stage in Config makes it appear on all existing **open** projects of that type. **Closed projects are never reconciled** — a closed case keeps the stage set it had when it closed (reopening it resumes reconciliation).
   - **Stages and fields are hidden, never deleted.** Once configured, a stage or field can only be hidden (`hidden` flag), so saved values on live and closed cases are never destroyed. **Hidden = hidden only where empty:** a hidden field still renders (read-only) on any project that already has a value for it, so case history stays intact; it disappears entirely from projects where it was never filled in, and is never added to new projects.
   - **Stage completion is automatic**, computed from field values rather than a manual button:
     - a stage is complete when every **required** field has a value (for a Checkbox field, "has a value" means *checked*);
     - if a stage has no required fields, the bar is **all** of its visible fields filled;
     - a stage with no visible fields at all cannot auto-complete — it exposes a manual done toggle instead;
     - clearing a value flips the stage back to incomplete and clears `completedAt`. Completion is never sticky.
     - hidden-but-empty fields are excluded from the count, so hiding a field can complete a stage.
5. **Changing a project's type** (NP ↔ Holdover) is allowed after creation. The stage set switches to the new type's; stages and values belonging to the old type are retained in the database but hidden from the project.
6. **Field configuration per stage** — each stage can have custom fields added, with types:
   - Text
   - Date
   - Checkbox
   - Currency
   - Select / Dropdown
   - **File / Attachment upload** — used for document fields like "Lease Agreement Attached" and "Property Management Agreement Attached" (an actual uploaded file, not just a confirmation checkbox)
7. **Project dashboard view** — clear/clean way to see project info and which stages are done. Segmented progress bar per project shows stage-by-stage status at a glance.
8. **Close / reopen project** — closing requires a reason (preset dropdown + optional free-text detail). **Projects are never deleted** — closing moves a project out of the active list into a separate **Archive** screen. Nothing reopens a project automatically, but a closed project **can be reopened manually** from the Archive; on reopen it rejoins the active list and resumes stage reconciliation. Every close and reopen is recorded as a `ProjectStatusEvent`, so a case closed → reopened → closed again keeps the full history of why.
9. **Contacts** — a shared Contacts table. Projects link to a Landlord/Owner (full contact: name, phone, email, address, notes) and to Tenant(s)/Occupants 18+ (linked, name-only). A dedicated **Contacts screen** (list, search, create, edit, and the projects each contact is attached to) is where a contact's own details are maintained — editing a contact there updates it everywhere it's linked. **Contacts cannot be deleted** — a mistaken or obsolete record is hidden instead: it drops out of search and can't be linked to anything new, but every project already pointing at it still displays it normally.

## Nothing is ever deleted

A single rule across the whole app — no record has a delete path. Data only ever becomes *less visible*:

| Record | Instead of delete |
|---|---|
| Project | Close (with a reason) → Archive; manually reopenable |
| Stage definition | Hide — still shown where a project holds values for it |
| Field definition | Hide — still shown where a project holds a value for it |
| Contact | Hide — unsearchable and unlinkable, still shown on existing projects |
| User | Deactivate — can no longer log in; their name stays on the records they touched |
| File attachment | Replaced, not removed (superseded file kept) |

## Intake Done — core fields (proposed, needs sign-off)

`intakeDone` ticks automatically once these are filled. The rest of the 29 stay optional and never block it.

**Counts:** Landlord/Owner · Tenant(s) on Lease · Tenancy Start Date · Monthly Rent Amount · Lease Agreement (file) · Property Street Address · Property City · Property State · Property Zip · Property Management Agreement (file) · Entry Point · Submitted By Name / Phone / Email / Date · Total Rent Balance Owed *(NP only)*.

**Doesn't count:** Occupants 18+ (often none) · Length of Tenancy · Apartment/Unit # · Floor Number · Additional Access Instructions · Submitted By Title / Company · and **all checkboxes** (Ledger Attached, Property Access Straightforward, Active Rental Permit, Marked Personal & Confidential).

**Why checkboxes don't count here:** on the intake form an unchecked box is a real answer — "no ledger", "access isn't straightforward" — so waiting for it to be ticked would mean intake never completes. This is the opposite of stage checkboxes, where a required box like "5-Day Done" *is* the task marker and must be checked. Same field type, deliberately different rule per context.

## Out of scope
- **The app does not send email.** Legacy task names like "Email landlord 14 Day notice was served" are checklist items the user ticks after sending mail themselves — no outbound mail integration.
- **One file per File field** for now; multiple attachments per field may come later.

## Status

- Mockup built and approved: `docs/mockup.html` (Login, Projects dashboard, Project Detail, Configuration).
- Full field inventory extracted from `AllEVICTIONS.csv` and mapped in `docs/field-mapping.md`.
- Tech stack decided (below).
- Full DB schema confirmed: `docs/db-schema.md`.
- **Scaffolded** — Prisma schema, Express API and React client are in place. See `README.md` for setup.
- **Dependencies installed**; local Postgres is running and listening on :5432.
- **Currently blocked on database credentials.** `DB_PASSWORD` in `.env` still carries the
  placeholder password, so Prisma returns `P1000: Authentication failed`. Nothing has been migrated
  or run yet — no `prisma/migrations/` folder exists, and the app has never been started.
  Set `DB_USER`/`DB_PASSWORD` in `.env`, then `npm run prisma:migrate -- --name init` and
  `npm run dev`. Troubleshooting for the common failures is in `README.md`.
- The code has never been compiled — expect to fix a few type or runtime errors on the first run.

## Tech Stack (decided)
- **DB:** PostgreSQL
- **BE:** Node.js + Express + TypeScript, Prisma ORM
- **FE:** React + TypeScript (Vite)
- Chosen for easy hosting (originally Render, now Netlify; no Dockerfile required) over ASP.NET Core, which the user found harder to host.
- **Single deployable project** — frontend and backend live in one repo with one `package.json`, build, and start command. In production Express serves the built React bundle as static files and handles `/api/*` itself; there is no second service. **Hosted on Netlify: the built client on the CDN, the same Express app wrapped as one Netlify Function at `/api/*`, and Netlify Database (managed Postgres). See `docs/netlify-deployment.md`.**
  - Same-origin in production means **no CORS setup at all**, and the httpOnly JWT cookie works without `credentials`/domain juggling. In dev, the Vite server proxies `/api` to Express, so it's same-origin there too.
  - `src/shared/` holds types used by both sides (field types, API payloads) — one definition, no drift between client and server.
  - Hosting gotcha: production hosts often set `NODE_ENV=production`, which makes `npm install` skip `devDependencies`, so build tooling (vite, typescript, prisma) lives in `dependencies`.
- **File storage:** uploaded files (Lease Agreement, Property Mgmt Agreement, etc.) are stored as `bytea` blobs directly in Postgres — no separate object storage service, simplest to host, fine at this app's document volume.
- **Multi-tenant:** not for now — single org/firm. May be added later (an `Organization` table + `orgId` scoping); schema is not designed to block that addition, but it isn't built in yet.
- **Environments:** local Postgres for testing, hosted Postgres for live — same Prisma migrations against both. A single `DB_TARGET=local|hosted` switch in `.env` selects which, and the app, migrations and Prisma Studio all follow it (resolved in `src/server/env.ts`, mirrored in `scripts/db-url.mjs` for the CLI). Local credentials are given as parts (`DB_USER`, `DB_PASSWORD`, optional `DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_SCHEMA`) and assembled into the URL with the password percent-encoded, so symbols can't break it; `DATABASE_URL_LOCAL` still works as a whole-string fallback when `DB_USER` is unset. Hosted stays a full URL, since that is what hosts provide. Every database command prints its target first, so a migration can't hit the wrong database unnoticed. On Netlify neither is set and the injected `NETLIFY_DB_URL` (or a `DATABASE_URL` site variable) is used.
- **Migrations apply themselves on startup** (`AUTO_MIGRATE`, default on) via `prisma migrate deploy` — applies existing migration files only, never generates or drops. Authoring stays a deliberate local step (`npm run prisma:migrate`, commit the result). Startup aborts if a migration fails rather than serving against a mismatched schema.
- **First user:** created at startup from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, and only when no users exist yet — so a fresh deploy is signable-in with no shell access. There is no public signup; further users are added from Configuration → Users.
- **Not seeded:** no stages, no fields. Sections B–H of `field-mapping.md` stay reference-only; the real stage list gets built in the Config screen.

## Reference
- `C:\Users\LipaGuttman\Downloads\AllEVICTIONS.csv` — real export of the old Airtable base; fully parsed, see `docs/field-mapping.md`.
- `C:\Users\LipaGuttman\Downloads\air tale site\` — an earlier Airtable page export; turned out to be JS-shell only (no usable data), superseded by the CSV.

## Open Questions

1. **Merge duplicate contacts** — when the same landlord gets entered twice, a merge tool would
   repoint every project link to the survivor and hide the duplicate (compatible with the
   no-delete rule, since merging hides rather than removes). Not built. Build now or later?
2. **Sign-off on the Intake Done core-field list** above — it decides when a case stops showing
   as unfinished. Implemented in `src/shared/types.ts` → `CORE_INTAKE_FIELDS`; changing it is a
   one-line edit.

Everything else is resolved — see `docs/field-mapping.md` and `docs/db-schema.md`.

## Structure — one project, one deploy
```
EvictionProgrem/
  package.json          # single manifest: client + server deps, build & start scripts
  index.html            # Vite entry, loads src/client/main.tsx
  tsconfig.json         # client (Vite/React) + shared
  tsconfig.server.json  # server (Node/Express) + shared → emits dist/server
  vite.config.ts        # dev proxy /api → :3000; build → dist/public
  netlify.toml          # Netlify build, publish dir, SPA fallback
  netlify/functions/    # api.mts: the Express app as one function at /api/*
  .env / .env.example   # DB_TARGET switch, JWT_SECRET, ADMIN_*, AUTO_MIGRATE (.env gitignored)
  README.md             # setup, scripts, deploy
  scripts/
    db-url.mjs          # resolves DB_TARGET → connection string (CLI side)
    prisma.mjs          # Prisma CLI wrapper: announces the target, then runs
  prisma/
    schema.prisma       # authoritative schema (docs/db-schema.md mirrors it)
    migrations/
  docs/                 # requirements & design docs
  src/
    client/             # React + TS
      pages/            # Login, Projects, ProjectDetail, Archive, Contacts, Config
      components/       # Layout, IntakePanel, StageCard, ProjectList, ContactPicker,
                        #   FileField, Modal
      api.ts            # typed fetch wrapper   auth.tsx   styles.css (mockup tokens)
    server/             # Express + TS — serves /api/* and, in prod, dist/public
      routes/           # auth, users, contacts, config, projects, files
      services/         # caseNumber, completion, reconcile, projectView — the rule engines
      middleware/       # auth (JWT cookie)
      env.ts  prisma.ts  seed.ts  index.ts
    shared/             # types.ts — used by both sides
  dist/                 # build output (gitignored): public/ + server/
```

**Scripts**
| Script | Does |
|---|---|
| `npm run dev` | Vite (5173) + `tsx watch` Express (3000) together, `/api` proxied |
| `npm run build` | `vite build` → `dist/public`, `tsc -p tsconfig.server.json` → `dist/server` |
| `npm start` | `node dist/server/index.js` — serves API + static bundle + SPA fallback |

**Netlify config:** Build `npm run build:netlify` (Vite, `prisma generate`, `prisma migrate deploy`) · Publish `dist/public` · database URL injected by Netlify Database, `JWT_SECRET` / `ADMIN_*` set in the site env vars.

## Mockup status
The app has been scaffolded and now implements all of the below — `docs/mockup.html` is
kept as the visual reference only (its design tokens are ported into `src/client/styles.css`)
and is **stale** on these points, which the real app already gets right:
- remove the "Intake 6/6" stage card from the stage grid (`mockup.html:782`)
- drop the leading Intake segment from every progress bar (`:485` and siblings)
- remove "1. Intake" and its fields from the stage Configuration screen (`:895`, `:939`)
- surface case number + docket number in the project list and detail header
- add a **Contacts screen** (list/search/create/edit + linked projects) — currently only a contact modal exists
- add a **Users tab** to Configuration (list/create/edit/delete, change password)
- add a **Reopen** action on closed projects
