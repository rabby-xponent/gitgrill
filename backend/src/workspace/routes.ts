/**
 * Workspace sync routes (M24D — MONETIZATION_BUILD_TRACKER.md). The user's
 * account becomes the source of truth; localStorage stays as the offline
 * cache. Everything is jsonb-first: `target_roles`/`defense_cards` rows store
 * the existing TS interfaces verbatim in `data`, so import/export is a
 * lossless round-trip and ids are preserved exactly.
 *
 * POST /api/workspace/import — idempotent first-login import. Re-running with
 * identical payloads touches nothing; changed payloads upsert by id.
 * GET  /api/workspace/export — complete JSON of the user's data (GDPR).
 * DELETE /api/workspace/delete — removes the user's data rows (GDPR).
 */

import { Router, Request, Response } from 'express';
import { getAdmin, isDbConfigured } from '../db/supabase';
import { requireAuth } from '../auth/middleware';

const router = Router();

function serviceUnavailable(res: Response): void {
  res.status(503).json({ error: 'Workspace storage is not configured on this deployment yet.' });
}

/** POST /api/workspace/import — body: { roles, defenseCards }. */
router.post('/import', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const roles: Array<Record<string, unknown>> = Array.isArray(req.body?.roles)
    ? req.body.roles
    : [];
  const cards: Array<Record<string, unknown>> = Array.isArray(req.body?.defenseCards)
    ? req.body.defenseCards
    : [];

  try {
    // Target roles: upsert by id to handle both fresh roles and updated audit history/status
    const payloadIds = roles.map((r) => String(r.id)).filter(Boolean);
    let insertedRoles = 0;
    if (payloadIds.length > 0) {
      const { error } = await admin.from('target_roles').upsert(
        roles.map((r) => ({
          user_id: userId,
          id: String(r.id),
          data: r,
          updated_at: new Date().toISOString(),
        }))
      );
      if (error) throw new Error(`target_roles import: ${error.message}`);
      insertedRoles = roles.length;
    }

    let insertedCards = 0;
    if (cards.length > 0) {
      const { error } = await admin.from('defense_cards').upsert(
        cards.map((c) => ({
          user_id: userId,
          id: String(c.id),
          data: c,
          updated_at: new Date().toISOString(),
        }))
      );
      if (error) throw new Error(`defense_cards import: ${error.message}`);
      insertedCards = cards.length;
    }

    res.json({ ok: true, imported: { roles: insertedRoles, defenseCards: insertedCards } });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Workspace import failed.' });
  }
});

/** DELETE /api/workspace/roles/:id — remove a single target role row. */
router.delete('/roles/:id', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const roleId = req.params.id;
  const { error } = await admin
    .from('target_roles')
    .delete()
    .eq('user_id', userId)
    .eq('id', roleId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true, deleted: roleId });
});

/** DELETE /api/workspace/cards/:id — remove a single defense card row. */
router.delete('/cards/:id', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const cardId = req.params.id;
  const { error } = await admin
    .from('defense_cards')
    .delete()
    .eq('user_id', userId)
    .eq('id', cardId);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }
  res.json({ ok: true, deleted: cardId });
});

/** GET /api/workspace/export — everything the user owns, as JSON. */
router.get('/export', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const [roles, cards] = await Promise.all([
    admin.from('target_roles').select('*').eq('user_id', userId),
    admin.from('defense_cards').select('*').eq('user_id', userId),
  ]);
  res.json({
    exportedAt: new Date().toISOString(),
    targetRoles: (roles.data ?? []).map((row: any) => row.data),
    defenseCards: (cards.data ?? []).map((row: any) => row.data),
  });
});

/** DELETE /api/workspace/delete — remove all the user's data (GDPR baseline). */
router.delete('/delete', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const [roles, cards] = await Promise.all([
    admin.from('target_roles').delete().eq('user_id', userId),
    admin.from('defense_cards').delete().eq('user_id', userId),
  ]);
  res.json({
    ok: true,
    removed: { targetRoles: (roles as any).error ? 0 : null, defenseCards: (cards as any).error ? 0 : null },
  });
});

export default router;
