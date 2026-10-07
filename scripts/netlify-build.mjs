#!/usr/bin/env node
// Netlify build: client bundle, Prisma client, then migrations against the deploy's
// database. Runs on every deploy (production and deploy previews, each against its own
// database branch), so a deploy never goes live ahead of its schema.
//
// On the very first deploy Netlify may provision the database after this build has
// started, in which case no connection string is present yet. Rather than fail a build
// the user can't fix, we skip migrations with a loud warning; a second deploy
// ("Deploy again" in the Netlify UI) applies them.

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { describe, loadDotEnv, resolveDatabase } from './db-url.mjs';

loadDotEnv();

const require = createRequire(import.meta.url);

function run(label, command, args, extraEnv = {}) {
  console.log(`\n  > ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: process.platform === 'win32',
  });
  if (result.error) throw new Error(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} failed (exit ${result.status}).`);
}

try {
  const prismaCli = require.resolve('prisma/build/index.js');

  run('vite build', 'npm', ['run', 'build:client']);
  run('prisma generate', process.execPath, [prismaCli, 'generate']);

  let database = null;
  try {
    database = resolveDatabase();
  } catch {
    database = null;
  }

  if (!database) {
    console.warn(
      '\n  WARNING: no database connection string found (NETLIFY_DB_URL / DATABASE_URL).\n' +
        '  Skipping `prisma migrate deploy`. If this is the first deploy, the database is\n' +
        '  being provisioned now: trigger one more deploy and the schema will be applied.\n' +
        '  Until then the API will answer 500.\n',
    );
  } else {
    console.log(`\n  Database: ${database.target} -> ${describe(database.url)}`);
    run('prisma migrate deploy', process.execPath, [prismaCli, 'migrate', 'deploy'], {
      DATABASE_URL: database.url,
    });
  }

  console.log('\n  Netlify build complete.\n');
} catch (error) {
  console.error(`\n  Netlify build failed: ${error.message}\n`);
  process.exit(1);
}
