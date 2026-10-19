/**
 * JWT verification middleware (M24B — MONETIZATION_BUILD_TRACKER.md).
 *
 * Verifies Supabase access tokens (HS256, project JWT secret) and sets
 * `req.auth = { userId, email, handle }`. No DB hit on the hot path —
 * identity comes from the token; plan/tier data is looked up lazily by the
 * routes that need it (M24C+).
 *
 * When Supabase is not configured the backend stays in local dev mode:
 * - `attachAuth` no-ops (every request anonymous).
 * - `requireAuth` answers 503 (not configured) rather than pretending.
 * - `POST /api/dev-auth` lets a developer mint a real signed session token
 *   locally (SUPABASE_JWT_SECRET falls back to a dev secret) so every
 *   authenticated path is exercised before the project exists. NEVER enable
 *   DEV_AUTH_MODE in a deployment that trusts its SUPABASE_JWT_SECRET.
 */

import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { isDbConfigured } from '../db/supabase';

export interface AuthContext {
  userId: string;
  email: string | null;
  handle: string | null;
  role?: string | null;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

const DEV_SECRET = process.env.DEV_AUTH_SECRET || 'gitgrill-dev-auth-secret-do-not-use-in-prod';

function getSessionSecret(): string {
  return process.env.SUPABASE_JWT_SECRET || DEV_SECRET;
}

function isDevAuthEnabled(): boolean {
  return process.env.DEV_AUTH_MODE === 'on' && !isDbConfigured();
}

/**
 * Session token minted by dev-auth or Supabase itself. `handle` is our
 * convention: the authenticated user's GitHub handle when present (set by
 * dev-auth or by user row provisioning at M24D import time).
 */
interface SessionClaims {
  sub: string;
  email?: string;
  handle?: string;
  role?: string;
}

function verifySessionToken(token: string): AuthContext | null {
  try {
    const claims = jwt.verify(token, getSessionSecret()) as SessionClaims;
    if (!claims || typeof claims.sub !== 'string') return null;
    return {
      userId: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
      handle: typeof claims.handle === 'string' ? claims.handle : null,
      role: typeof claims.role === 'string' ? claims.role : null,
    };
  } catch {
    return null;
  }
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const alt = req.headers['x-gitgrill-session'] || req.headers['x-devscope-session'];
  if (typeof alt === 'string' && alt.trim()) return alt.trim();
  // EventSource cannot set headers, so the SSE stream also accepts the token
  // as a query parameter (documented tradeoff for M24B; short-lived tokens).
  const qp = req.query.access_token;
  if (typeof qp === 'string' && qp.trim()) return qp.trim();
  return null;
}

/** Attaches req.auth when a valid session token is present; never rejects. */
export function attachAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (token) {
    const auth = verifySessionToken(token);
    if (auth) req.auth = auth;
  }
  next();
}

/** Auth middleware. 401 without a valid session; 503 when Supabase is unset. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isDbConfigured() && !isDevAuthEnabled()) {
    res.status(503).json({ error: 'Accounts are not configured on this deployment yet.' });
    return;
  }
  const token = readToken(req);
  const auth = token ? verifySessionToken(token) : null;
  if (!auth) {
    res.status(401).json({ error: 'Sign in required.' });
    return;
  }
  req.auth = auth;
  next();
}
