import { spawnSync } from 'node:child_process';
import { describeDatabase, env } from './env';
import { ensureFirstUser } from './firstUser';

/**
 * Applies any pending migrations before the server accepts traffic.
 *
 * `migrate deploy` only *applies* migration files that already exist: it never
 * generates one from a changed schema and never drops data, which is why it is safe
 * to run unattended on every boot. Authoring a migration is still a deliberate local
 * step: `npm run prisma:migrate`.
 *
 * Prisma takes a database advisory lock while migrating, so two instances starting at
 * once can't apply the same migration twice.
 *
 * Not used on Netlify: there the build runs the same `migrate deploy` before the
 * deploy is published (scripts/netlify-build.mjs), and the function only calls
 * ensureFirstUser().
 */
function migrate(): void {
  // Invoke Prisma's entry point with this same Node binary rather than via npx:
  // on Windows, Node refuses to spawn the npx.cmd shim unless shell:true, and the
  // failure surfaces silently on result.error instead of throwing.
  let cli: string;
  try {
    cli = require.resolve('prisma/build/index.js');
  } catch {
    throw new Error('Prisma CLI not found. Run `npm install` before starting the app.');
  }

  // Capture Prisma's output rather than inheriting our own handles: under `npm run dev`
  // concurrently gives this process pipes instead of a console, and a spawnSync that
  // inherits those pipes deadlocks on Windows (the server would hang before listening).
  const result = spawnSync(process.execPath, [cli, 'migrate', 'deploy'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: env.databaseUrl },
  });

  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
  if (output) console.log(output.replace(/^/gm, '  '));

  if (result.error) {
    throw new Error(`Could not run migrations: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      'Database migration failed. Refusing to start against an out-of-date schema.',
    );
  }
}

export async function bootstrap(): Promise<void> {
  const label = env.databaseTarget === 'hosted' ? 'HOSTED (live)' : env.databaseTarget.toUpperCase();
  console.log(`\n  Database: ${label} -> ${describeDatabase(env.databaseUrl)}`);

  if (env.autoMigrate) migrate();
  else console.log('  AUTO_MIGRATE=false: skipping migrations.');

  await ensureFirstUser();
}
