# Deploying Docket on Netlify

Plan for moving the app from the Render layout (one long-running Express process +
Render Postgres) to Netlify (static client on the CDN + the API as a Netlify Function +
a hosted Postgres). Written 2026-10-07, before any code was changed.

## Where the project is today

- **Code:** React/Vite client (`src/client`), Express API (`src/server`), Prisma schema
  with one committed migration (`prisma/migrations/20260810203913_init`).
- **Runtime model:** one Node process. Express serves `/api/*` and, in production, the
  built client from `dist/public`. On boot it runs `prisma migrate deploy` and creates
  the first user. Auth is a JWT in an httpOnly cookie, same origin, no CORS.
- **Database:** local Postgres 18 on :5432 for dev. No hosted database yet.
- **Files:** uploads are stored as `bytea` in Postgres, max 25 MB each, via multer.
- **Deploy target so far:** Render (`render.yaml`). Never deployed.
- **Repo:** github.com/developerdesignny/eviction-progrem, branch `main`, clean.

## What Netlify changes

| Concern | Today | On Netlify |
|---|---|---|
| Client | Express static | Netlify CDN serves `dist/public`, SPA fallback rewrite |
| API | Express on a port | One Netlify Function at `/api/*` wrapping the Express app |
| Database | Local / Render Postgres | Hosted Postgres (see Decision 1) |
| Migrations | On app boot | During the Netlify build, before publish |
| First user | On app boot | Idempotent check on first API call, or seed migration |
| File uploads | 25 MB through Express | Function payload cap is 6 MB (about 4.5 MB binary) — see Decision 2 |
| Cookie `secure` flag | `NODE_ENV === 'production'` | Based on Netlify `CONTEXT` |
| Env vars | `.env` / Render | Netlify UI or `netlify env:set`, Functions scope |

Hard limits on Netlify Functions that affect this app:

| Limit | Value |
|---|---|
| Sync execution | 60 s |
| Buffered request/response | 6 MB (binary is base64, so about 4.5 MB) |
| Streamed response | 20 MB |
| Total env var size | about 4 KB across all functions |

## Target layout

```
netlify.toml                      build, publish dir, /api/* → function, SPA fallback
netlify/functions/api.mts         wraps the Express app (serverless-http), path "/api/*"
src/server/app.ts                 Express app without listen() / static / bootstrap
src/server/index.ts               local dev only: bootstrap + listen (unchanged behaviour)
prisma/                           unchanged; `prisma migrate deploy` runs in the build
dist/public                       Vite output, published to the CDN
```

The Express routes, services, Prisma schema and React client do not change. The work is
plumbing: split `app` from `listen`, add the function wrapper, move migrations to the
build, adjust the cookie flag and the upload cap, add `netlify.toml`.

## Decisions to confirm

### 1. Which hosted Postgres

| Option | Pros | Cons |
|---|---|---|
| **A. Netlify Database** (managed Neon Postgres, `@netlify/database`) | Zero-config, provisioned on deploy, env var injected automatically, deploy previews get a DB branch | Needs a credit-based plan; Netlify prefers its own migrations folder (we can still run Prisma in the build) |
| **B. External Postgres** (Neon, Supabase, Render) | Keep Prisma exactly as is, any plan works | One more account; paste `DATABASE_URL` into Netlify by hand |

Recommendation: **A** if the chosen team's plan allows it, otherwise **B (Neon)**.
Either way Prisma stays; only `DATABASE_URL` resolution changes.

### 2. File uploads above about 4.5 MB

The function cap is hard. Options:

| Option | Effect |
|---|---|
| **A. Cap uploads at 4 MB** and keep `bytea` in Postgres | Smallest change. Scanned leases over 4 MB are rejected with a clear message |
| **B. External object storage** (S3 / Cloudflare R2) with direct browser upload | No size cap, but a new service, credentials, and a schema change (`FileAttachment.data` becomes a key) |

Recommendation: **A** now, **B** later if real documents turn out larger.

### 3. Which Netlify team

| Team | Plan |
|---|---|
| Sellrixos (`sales-00u5skk`) | Pro |
| developerdesignny's team | Free |

### 4. Express wrapper vs. rewrite

| Option | Effect |
|---|---|
| **A. Keep Express**, wrap it with `serverless-http` in one function | Routes untouched, lowest risk |
| **B. Port routes to native `Request`/`Response` handlers** (e.g. Hono) | Cleaner on Netlify, but every route file is rewritten |

Recommendation: **A**.

### 5. Remove Render files

`render.yaml` and the Render sections in `README.md` / `.env.example` become dead.
Recommendation: remove them so there is one deploy story.

## Work plan (once decisions are confirmed)

1. Split `src/server/index.ts` into `app.ts` (routes + error handler) and `index.ts` (dev listen).
2. Add `netlify/functions/api.mts` wrapping the app; add `serverless-http` and `@netlify/functions`.
3. Add `netlify.toml`: build `npm run build:client && prisma generate && prisma migrate deploy`, publish `dist/public`, functions bundler esbuild with Prisma engine included, SPA fallback.
4. Database URL: accept `NETLIFY_DB_URL` (Netlify Database) or `DATABASE_URL` (external) in `env.ts` and `scripts/db-url.mjs`.
5. First user: keep `ensureFirstUser`, run it lazily once per function instance.
6. Cookie `secure` flag from Netlify `CONTEXT`; upload cap per Decision 2.
7. Update README, `.env.example`; remove Render files per Decision 5.
8. You: install Netlify CLI (`npm i -g netlify-cli`), link the GitHub repo to a new Netlify project, set `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (Functions scope), and run the first deploy.
9. Verify: health check, login, create a project, upload a file, migrations applied.

## What you need to run yourself

- `npm install` after the dependency changes.
- `npm i -g netlify-cli`, then `netlify login` and `netlify link` (or create the site in the UI).
- Setting the secret env vars in the Netlify UI.

## Status (2026-10-07)

Decisions confirmed: **1A** Netlify Database, **2A** 4 MB upload cap, **3** developerdesignny's
team (Free), **4A** keep Express, **5** Render files removed.

Code changes are done and uncommitted:

| File | Change |
|---|---|
| `src/server/app.ts` | New. The Express app without `listen()`, static files or startup work |
| `src/server/index.ts` | Now only the long-running host: static files, bootstrap, listen |
| `src/server/firstUser.ts` | New. `ensureFirstUser()` moved out of `bootstrap.ts` so the function can call it alone |
| `src/server/middleware/auth.ts` | Cookie `Secure` flag follows `req.secure` (trust proxy on) |
| `src/server/env.ts`, `scripts/db-url.mjs` | Fall back to `NETLIFY_DB_URL` after `DATABASE_URL` |
| `src/shared/types.ts` | `MAX_UPLOAD_BYTES` 25 MB to 4 MB |
| `prisma/schema.prisma` | `binaryTargets` adds `rhel-openssl-3.0.x` (Lambda runtime) |
| `netlify/functions/api.mts` | New. Wraps the app with `serverless-http`, path `/api/*` |
| `netlify.toml` | New. Build, publish dir, esbuild + Prisma files, SPA fallback, `netlify dev` |
| `scripts/netlify-build.mjs` | New. Vite build, `prisma generate`, `prisma migrate deploy` |
| `package.json` | Adds `@netlify/database`, `@netlify/functions`, `serverless-http`; `build:netlify` script |
| `render.yaml` | Deleted. README, `.env.example`, `docs/requirements.md` updated |

### Your steps, in order

1. `npm install`, then `npm run typecheck` and `npm run dev` to confirm nothing local broke.
   The function file is not type-checked by `npm run typecheck`; Netlify's esbuild compiles it.
2. Commit everything, including `prisma/migrations/`.
3. `npm i -g netlify-cli`, `netlify login`, then in the repo `netlify init` (choose the
   developerdesignny team, link the GitHub repo). Build settings are read from `netlify.toml`.
4. In the Netlify UI, set env vars with scopes **Builds** and **Functions**:
   `JWT_SECRET` (long random string, mark as secret), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.
5. Deploy. If the build log shows the "no database connection string found" warning, the
   database was being provisioned during that first build: click **Deploy again**.
6. Verify: open `/api/health`, sign in, create a project, upload a small PDF, open it back.

### Known risks and fallbacks

- **Netlify Database on the Free team.** Docs say it needs a credit-based plan. If the first
  deploy logs `database feature not available for this account`, either move the site to the
  Sellrixos (Pro) team or create a free Neon database and set `DATABASE_URL` in the site env
  vars. No code change either way.
- **`/api/*` routing.** The function declares its own path, which should win over the
  non-forced SPA rewrite. If `/api/health` returns the React page instead of JSON, replace
  `path` in `api.mts` with nothing and add a forced redirect in `netlify.toml`:
  `from = "/api/*"`, `to = "/.netlify/functions/api/:splat"`, `status = 200`, `force = true`,
  placed above the SPA rule.
- **Prisma engine in the function.** If the function logs that it cannot find a query engine,
  the `included_files` glob in `netlify.toml` did not ship `node_modules/.prisma/client`.
  Check the build log's function bundling section.
- **Cold starts.** The first request after idle pays for Prisma connecting; a second or two.
