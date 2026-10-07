import cookieParser from 'cookie-parser';
import express, { type NextFunction, type Request, type Response } from 'express';
import { MulterError } from 'multer';
import { authRouter } from './routes/auth';
import { configRouter } from './routes/config';
import { contactsRouter } from './routes/contacts';
import { filesRouter } from './routes/files';
import { projectsRouter } from './routes/projects';
import { usersRouter } from './routes/users';
import { MAX_UPLOAD_BYTES } from '../shared/types';

/**
 * The Express app on its own: routes and error handling, no listen(), no static
 * files, no startup work. Two hosts share it:
 *   - src/server/index.ts          runs it as a long-lived process (local dev, `npm start`)
 *   - netlify/functions/api.mts    wraps it as a Netlify Function at /api/*
 */
export const app = express();

// Behind Netlify (and any proxy) the original scheme arrives in X-Forwarded-Proto;
// trusting it makes req.secure correct, which decides the cookie's Secure flag.
app.set('trust proxy', true);

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
