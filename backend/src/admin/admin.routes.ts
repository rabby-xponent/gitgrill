/**
 * Super Admin Management API Routes.
 *
 * Controls dynamic capability limits, user quota overrides, and user invitations.
 * Gated to Super Admins (via JWT role/email) or ADMIN_SECRET_KEY header.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { limitsService } from '../security/limits.service';

const router = Router();

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const isSuperAdmin = limitsService.isSuperAdmin(req.auth);
  const expectedKey = process.env.ADMIN_SECRET_KEY;
  const providedKey = req.headers['x-admin-key'] || (req.query.adminKey as string);

  if (isSuperAdmin || (expectedKey && providedKey === expectedKey)) {
    next();
    return;
  }

  res.status(403).json({
    error: 'unauthorized',
    message: 'Super Admin authorization required to access this endpoint.',
  });
}

// All routes below require admin authorization
router.use(requireAdminAuth);

// --- 1. Tier Capability Limits ----------------------------------------------

/** GET /api/admin/limits — Fetch platform tier limits */
router.get('/limits', (_req: Request, res: Response) => {
  try {
    const limits = limitsService.getTierLimits();
    res.json({ success: true, limits });
  } catch (err: any) {
    res.status(500).json({ error: 'fetch_failed', message: err.message });
  }
});

/** POST /api/admin/limits — Update platform tier limits */
router.post('/limits', (req: Request, res: Response) => {
  const { free, pro } = req.body || {};
  if (!free && !pro) {
    res.status(400).json({ error: 'missing_payload', message: 'free or pro limits required.' });
    return;
  }

  try {
    const updated = limitsService.updateTierLimits({
      free,
      pro,
      updatedBy: req.auth?.email || 'admin',
    });
    res.json({ success: true, message: 'Tier capability limits updated successfully.', limits: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'update_failed', message: err.message });
  }
});

// --- 2. User Quota Overrides ------------------------------------------------

/** GET /api/admin/users/overrides — List all user quota overrides */
router.get('/users/overrides', (_req: Request, res: Response) => {
  try {
    const overrides = limitsService.listUserOverrides();
    res.json({ success: true, count: overrides.length, overrides });
  } catch (err: any) {
    res.status(500).json({ error: 'fetch_failed', message: err.message });
  }
});

/** POST /api/admin/users/override — Set or update a user's custom limits */
router.post('/users/override', (req: Request, res: Response) => {
  const { userId, userEmail, userHandle, tier, customLimits, notes } = req.body || {};
  if (!userId) {
    res.status(400).json({ error: 'missing_userId', message: 'userId is required.' });
    return;
  }

  try {
    const record = limitsService.setUserOverride({
      userId,
      userEmail,
      userHandle,
      tier,
      customLimits,
      notes,
    });
    res.json({ success: true, message: 'User quota override saved.', record });
  } catch (err: any) {
    res.status(500).json({ error: 'save_failed', message: err.message });
  }
});

/** DELETE /api/admin/users/override/:userId — Remove a user's custom override */
router.delete('/users/override/:userId', (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const removed = limitsService.removeUserOverride(userId);
    res.json({ success: true, removed });
  } catch (err: any) {
    res.status(500).json({ error: 'delete_failed', message: err.message });
  }
});

// --- 3. User Invitations ----------------------------------------------------

/** GET /api/admin/users/invites — List all user invitations */
router.get('/users/invites', (_req: Request, res: Response) => {
  try {
    const invites = limitsService.listInvitations();
    res.json({ success: true, count: invites.length, invites });
  } catch (err: any) {
    res.status(500).json({ error: 'fetch_failed', message: err.message });
  }
});

/** POST /api/admin/users/invite — Invite a user with tier or custom quota */
router.post('/users/invite', (req: Request, res: Response) => {
  const { email, handle, assignedTier, customLimits, notes } = req.body || {};
  if (!email || !assignedTier) {
    res.status(400).json({ error: 'missing_fields', message: 'email and assignedTier are required.' });
    return;
  }

  try {
    const invite = limitsService.createInvitation({
      email,
      handle,
      assignedTier,
      customLimits,
      invitedBy: req.auth?.email || 'admin',
      notes,
    });
    res.json({ success: true, message: `Invitation created for ${email}.`, invite });
  } catch (err: any) {
    res.status(500).json({ error: 'invite_failed', message: err.message });
  }
});

/** DELETE /api/admin/users/invite/:id — Revoke an invitation */
router.delete('/users/invite/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const revoked = limitsService.revokeInvitation(id);
    res.json({ success: true, revoked });
  } catch (err: any) {
    res.status(500).json({ error: 'revoke_failed', message: err.message });
  }
});

export const adminRouter = router;
export default router;
