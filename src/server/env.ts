import fs from 'node:fs';
import path from 'node:path';

// Minimal .env loader (avoids a dotenv dependency). Netlify injects real env vars,
// so the file is only expected locally. Mirrors scripts/db-url.mjs, which the
// Prisma CLI wrapper uses, so the app and its migrations always agree on the target.
function loadDotEnv() {
  const file = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    // Real environment variables (Netlify, CI, the shell) always win over the file.
    if (process.env[key] !== undefined) continue;

    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * Builds the local connection string from its parts, so a password with symbols in
 * it can be pasted as-is — encodeURIComponent escapes what a URL would otherwise
 * misread (@ # / : ? %). Returns null when DB_USER isn't set, meaning "not configured
 * this way"; everything but the user has a working local default.
 */
function buildUrlFromParts(): string | null {
  const user = process.env.DB_USER?.trim();
  if (!user) return null;

  const password = process.env.DB_PASSWORD ?? '';
  const host = process.env.DB_HOST?.trim() || 'localhost';
  const port = process.env.DB_PORT?.trim() || '5432';
  const name = process.env.DB_NAME?.trim() || 'docket';
  const schema = process.env.DB_SCHEMA?.trim() || 'public';

  // An empty password is legitimate (Postgres "trust" auth), and is not the same
  // as a password of "" — omit the colon entirely rather than sending a blank one.
  const credentials = password
    ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}`
    : encodeURIComponent(user);

  return `postgresql://${credentials}@${host}:${port}/${encodeURIComponent(name)}?schema=${encodeURIComponent(schema)}`;
}

/**
 * One switch decides which database everything talks to:
 *   1. DB_TARGET=local   → DB_USER/DB_PASSWORD/... parts, else DATABASE_URL_LOCAL
 *   2. DB_TARGET=hosted  -> DATABASE_URL_HOSTED (a hosted database, as one URL)
 *   3. DATABASE_URL or NETLIFY_DB_URL as-is -> the Netlify path, injected for us
 */
function resolveDatabase(): { url: string; target: string } {
  const target = (process.env.DB_TARGET ?? '').trim().toLowerCase();

  if (target === 'local') {
    // Parts win over the whole-URL form: setting DB_USER is the more deliberate act,
    // and a stale DATABASE_URL_LOCAL left in .env shouldn't quietly override it.
    const url = buildUrlFromParts() ?? process.env.DATABASE_URL_LOCAL;
    if (!url) {
      throw new Error(
        'DB_TARGET is "local" but no local database is configured in .env. ' +
          'Set DB_USER and DB_PASSWORD (DB_HOST/DB_PORT/DB_NAME are optional), ' +
          'or fill in DATABASE_URL_LOCAL.',
      );
    }
    return { url, target };
  }

  if (target === 'hosted') {
    const url = process.env.DATABASE_URL_HOSTED;
    if (!url) {
      throw new Error(
        'DB_TARGET is "hosted" but DATABASE_URL_HOSTED is empty in .env. ' +
          'Fill it in, or switch DB_TARGET to the other one.',
      );
    }
    return { url, target };
  }

  if (target) throw new Error(`DB_TARGET must be "local" or "hosted" (got "${target}").`);

  // Netlify Database injects NETLIFY_DB_URL (the right branch for this deploy); an external
  // Postgres pasted into the Netlify UI arrives as DATABASE_URL. Either works unchanged.
  if (process.env.DATABASE_URL) return { url: process.env.DATABASE_URL, target: 'DATABASE_URL' };
  if (process.env.NETLIFY_DB_URL) return { url: process.env.NETLIFY_DB_URL, target: 'NETLIFY_DB_URL' };
  throw new Error(
    'No database configured. Set DB_TARGET=local (with DB_USER and DB_PASSWORD) in .env, ' +
      'or provide DATABASE_URL (or NETLIFY_DB_URL on Netlify).',
  );
}

/** host/database only — never log a connection string with its password. */
export function describeDatabase(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
  } catch {
    return '(unparseable connection string)';
  }
}

const database = resolveDatabase();

export const env = {
  databaseUrl: database.url,
  databaseTarget: database.target,
  jwtSecret: required('JWT_SECRET'),
  port: Number(process.env.PORT ?? 3000),
  isProduction: process.env.NODE_ENV === 'production',
  // Pending migrations are applied on startup unless explicitly turned off.
  autoMigrate: (process.env.AUTO_MIGRATE ?? 'true').toLowerCase() !== 'false',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@example.com',
  adminPassword: process.env.ADMIN_PASSWORD ?? 'changeme123',
  adminName: process.env.ADMIN_NAME ?? 'Admin',
};
