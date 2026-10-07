import path from 'node:path';
import express from 'express';
import { app } from './app';
import { bootstrap } from './bootstrap';
import { env } from './env';
import { prisma } from './prisma';

// Long-running process entry point: local dev (`npm run dev`) and `npm start`.
// On Netlify this file is not used; netlify/functions/api.mts hosts the same app.

// When run as a single process in production, Express also serves the built React
// bundle so one port answers everything. In dev, Vite serves the client instead.
if (env.isProduction) {
  const clientDir = path.resolve(__dirname, '../public');
  app.use(express.static(clientDir));
  // SPA fallback: any non-/api path is a client route.
  app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
}

// Migrations run before the first request is served, so the app never answers
// against a schema it doesn't match.
bootstrap()
  .then(() => {
    const server = app.listen(env.port, () => {
      console.log(`\n  Docket API listening on http://localhost:${env.port}`);
      if (!env.isProduction) console.log('  Client dev server: http://localhost:5173\n');
    });

    for (const signal of ['SIGTERM', 'SIGINT'] as const) {
      process.on(signal, () => {
        server.close(() => {
          void prisma.$disconnect().then(() => process.exit(0));
        });
      });
    }
  })
  .catch((error) => {
    console.error(`\n  Startup failed: ${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  });
