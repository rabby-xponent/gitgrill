import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/api';
import proofRoutes from './proofs/proof.routes';
import authRoutes from './auth/routes';
import { attachAuth } from './auth/middleware';
import { usageRouter } from './security/usage-ledger';
import { entitlementsRouter } from './security/entitlements';
import workspaceRoutes from './workspace/routes';
import billingRoutes from './billing/billing.routes';
import adminRoutes from './admin/admin.routes';
import portfolioRoutes from './portfolio/portfolio.routes';

const app = express();
const PORT = process.env.PORT || 4000;

/**
 * Normalize an origin for comparison: lowercase host, strip trailing slash and
 * default ports. Prevents exact-string CORS mismatches like
 * `https://foo.vercel.app/` vs `https://foo.vercel.app`.
 */
const normalizeOrigin = (origin: string): string => {
  try {
    const u = new URL(origin.trim());
    const port = u.port && u.port !== '80' && u.port !== '443' ? `:${u.port}` : '';
    return `${u.protocol}//${u.hostname.toLowerCase()}${port}`;
  } catch {
    return origin.trim().toLowerCase().replace(/\/$/, '');
  }
};

const defaultAllowedOrigins = [
  'https://gitgrill-gr.vercel.app',
  'https://gitgrill.vercel.app',
  'https://devscope.vercel.app',
];

// FRONTEND_URL (single value, legacy) + ALLOWED_ORIGINS (comma-separated) both
// feed the allowlist. Production frontends move around (apex vs www, Vercel
// project domains, preview URLs), so being too strict here silently kills the
// entire product with a dataless EventSource error.
const allowedOrigins = [
  ...defaultAllowedOrigins,
  ...(process.env.FRONTEND_URL || '').split(','),
  ...(process.env.ALLOWED_ORIGINS || '').split(','),
]
  .map((o) => o.trim())
  .filter(Boolean)
  .map(normalizeOrigin);

// Allow Vercel preview/production deployments (*.vercel.app) by default unless explicitly disabled.
const allowVercelPreviews = process.env.ALLOW_VERCEL_PREVIEWS !== 'false';
const isVercelDeployment = (origin: string): boolean => {
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'vercel.app' || hostname.endsWith('.vercel.app');
  } catch {
    return /^https?:\/\/[a-z0-9-.]+\.vercel\.app(:\d+)?$/i.test(origin);
  }
};
const isLocalhost = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.warn(
    '[cors] No FRONTEND_URL / ALLOWED_ORIGINS configured — all cross-origin requests will be blocked.'
  );
}

app.use(
  cors({
    origin: (origin, cb) => {
      const clean = origin ? normalizeOrigin(origin) : '';
      if (
        !clean ||
        allowedOrigins.includes(clean) ||
        (allowVercelPreviews && isVercelDeployment(clean)) ||
        isLocalhost(clean)
      ) {
        cb(null, origin || true);
      } else {
        console.warn(`[cors] Blocked request from unlisted origin: ${origin}`);
        // Reflecting nothing = browser blocks it. Still call cb so the request
        // proceeds server-side (route-level auth can decide more).
        cb(null, false);
      }
    },
    credentials: true, // EventSource/fetch from the frontend must be able to carry the demo cookie
  })
);
app.use(express.json());
app.use(attachAuth); // resolve req.auth from Bearer/x-gitgrill-session (or x-devscope-session) when present

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', apiRoutes);
app.use('/api/proofs', proofRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usage', usageRouter);
app.use('/api/entitlements', entitlementsRouter);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/portfolio', portfolioRoutes);

app.listen(PORT, () => {
  console.log(`GitGrill backend running on port ${PORT}`);
});
