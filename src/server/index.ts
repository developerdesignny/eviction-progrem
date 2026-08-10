import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { MulterError } from 'multer';
import { bootstrap } from './bootstrap';
import { env } from './env';
import { prisma } from './prisma';
import { authRouter } from './routes/auth';
import { configRouter } from './routes/config';
import { contactsRouter } from './routes/contacts';
import { filesRouter } from './routes/files';
import { projectsRouter } from './routes/projects';
import { usersRouter } from './routes/users';
import { MAX_UPLOAD_BYTES } from '../shared/types';

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/config', configRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/files', filesRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// In production Express also serves the built React bundle — one service, one origin,
// so no CORS and the auth cookie just works. In dev, Vite serves the client instead.
if (env.isProduction) {
  const clientDir = path.resolve(__dirname, '../public');
  app.use(express.static(clientDir));
  // SPA fallback: any non-/api path is a client route.
  app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res
      .status(413)
      .json({ error: `File is too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)` });
  }
  if (error instanceof Error && error.message.startsWith('Unsupported file type')) {
    return res.status(415).json({ error: error.message });
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong' });
});

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
