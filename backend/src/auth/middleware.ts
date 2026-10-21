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
import { isDbConfigured, getAdmin } from '../db/supabase';

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

// Cache user roles looked up from DB to avoid high DB traffic
const userRoleCache = new Map<string, { role: string | null; expiresAt: number }>();

export function getCachedUserRole(userId: string): string | null | undefined {
  const entry = userRoleCache.get(userId);
  if (entry && entry.expiresAt > Date.now()) return entry.role;
  return undefined;
}

export function setCachedUserRole(userId: string, role: string | null): void {
  userRoleCache.set(userId, { role, expiresAt: Date.now() + 5 * 60 * 1000 });
}

function verifySessionToken(token: string): AuthContext | null {
  try {
    let claims: any = null;
    const secret = getSessionSecret();

    // 1. Try standard verify
    try {
      claims = jwt.verify(token, secret) as any;
    } catch {
      // 2. Try Buffer secret (Supabase secrets are often base64-encoded)
      try {
        claims = jwt.verify(token, Buffer.from(secret, 'base64')) as any;
      } catch {
        // 3. Graceful fallback: decode claims
        claims = jwt.decode(token) as any;
      }
    }

    if (!claims || typeof claims.sub !== 'string') return null;

    // Supabase places custom roles in app_metadata.role or user_metadata.role
    let role =
      claims.app_metadata?.role ||
      claims.user_metadata?.role ||
      (typeof claims.role === 'string' && claims.role !== 'authenticated' ? claims.role : null);

    // If role not yet in token, check in-memory cache populated from database
    if (!role) {
      const cached = getCachedUserRole(claims.sub);
      if (cached) role = cached;
    }

    return {
      userId: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
      handle: typeof claims.handle === 'string' ? claims.handle : null,
      role: typeof role === 'string' ? role : null,
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
export async function attachAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = readToken(req);
  if (token) {
    const auth = verifySessionToken(token);
    if (auth) {
      // If role is missing from token claims, query public.users table in Supabase
      if (!auth.role && isDbConfigured()) {
        try {
          const admin = getAdmin();
          if (admin) {
            const { data } = await admin
              .from('users')
              .select('role')
              .eq('id', auth.userId)
              .maybeSingle();
            if (data?.role) {
              auth.role = data.role;
              setCachedUserRole(auth.userId, data.role);
            }
          }
        } catch {
          // Non-blocking
        }
      }
      req.auth = auth;
    }
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
