#!/usr/bin/env node
// Runs the Prisma CLI against whichever database DB_TARGET selects, and says which
// one that is before doing anything — so a migration never lands on the wrong database
// by accident.
//
//   node scripts/prisma.mjs migrate dev
//   node scripts/prisma.mjs studio
//   node scripts/prisma.mjs --which        (just print the target)

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { describe, loadDotEnv, resolveDatabase } from './db-url.mjs';

loadDotEnv();

let database;
try {
  database = resolveDatabase();
} catch (error) {
  console.error(`\n  ${error.message}\n`);
  process.exit(1);
}

const label = database.target === 'hosted' ? 'HOSTED (live)' : database.target.toUpperCase();
console.log(`\n  Database: ${label} → ${describe(database.url)}\n`);

const args = process.argv.slice(2);
if (args[0] === '--which') process.exit(0);

// Run Prisma's entry point with this same Node binary rather than going through npx:
// on Windows, Node refuses to spawn the npx.cmd shim without shell:true, and the
// failure comes back silently on `result.error`.
const require = createRequire(import.meta.url);
let cli;
try {
  cli = require.resolve('prisma/build/index.js');
} catch {
  console.error('\n  Prisma CLI not found. Run `npm install` first.\n');
  process.exit(1);
}

const result = spawnSync(process.execPath, [cli, ...args], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: database.url },
});

if (result.error) {
  console.error(`\n  Could not start Prisma: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 1);
