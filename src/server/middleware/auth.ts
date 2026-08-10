import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env';
import { prisma } from '../prisma';

export const AUTH_COOKIE = 'docket_token';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AuthedRequest extends Request {
  user?: { id: string; name: string; email: string };
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: TOKEN_TTL_SECONDS });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
}

/** Rejects the request unless a valid cookie maps to an *active* user. */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return res.status(401).json({ error: 'Not signed in' });

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    // A deactivated user's existing cookie must stop working immediately.
    if (!user || !user.active) {
      clearAuthCookie(res);
      return res.status(401).json({ error: 'Not signed in' });
    }
    req.user = { id: user.id, name: user.name, email: user.email };
    next();
  } catch {
    clearAuthCookie(res);
    return res.status(401).json({ error: 'Not signed in' });
  }
}
