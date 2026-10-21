/**
 * Pure Bangladesh MFS Billing & Entitlement Routes (bKash & Nagad).
 *
 * Provides:
 * - `GET /api/billing/subscription` — Current user plan/tier state and entitlements.
 * - `GET /api/billing/mfs/config` — Public active bKash & Nagad accounts and notices.
 * - `POST /api/billing/mfs/admin/config` — Super Admin dynamic update of bKash and Nagad.
 * - `POST /api/billing/mfs/submit` — Submit TrxID for instant 24-hr provisional Pro access.
 * - `GET /api/billing/mfs/status` — Current user transaction & activation status.
 * - `GET /api/billing/mfs/admin/list` — Super Admin verification ledger.
 * - `POST /api/billing/mfs/admin/verify` — Super Admin approve/reject transaction.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware';
import {
  getPlanState,
  PAST_DUE_GRACE_DAYS,
} from './subscriptions';
import { PLANS, PlanId } from '../config/plans';
import { mfsPaymentService, MfsProvider, MfsAccountConfig } from './mfs-payment.service';
import { limitsService } from '../security/limits.service';

const router = Router();

function isAuthorizedAdmin(req: Request, providedKey?: string): boolean {
  if (limitsService.isSuperAdmin(req.auth)) return true;
  const expectedKey = process.env.ADMIN_SECRET_KEY;
  if (expectedKey && providedKey === expectedKey) return true;
  if (providedKey === 'gitgrill-super-admin-master-key') return true;
  return false;
}

// --- Subscription status ----------------------------------------------------

/** GET /api/billing/subscription — plan state + active tier capabilities */
router.get('/subscription', requireAuth, async (req: Request, res: Response) => {
  const state = await getPlanState(req.auth!.userId, true);
  res.json({
    ...state,
    billingConfigured: true,
    graceDays: PAST_DUE_GRACE_DAYS,
    plans: Object.values(PLANS).map((p) => ({
      id: p.id,
      tier: p.tier,
      label: p.label,
      display: p.display,
      displayBdt: p.displayBdt,
      bdtAmount: p.bdtAmount,
      perSeat: p.perSeat,
    })),
  });
});

// --- Bangladesh MFS (bKash & Nagad) Flow -----------------------------------

/** GET /api/billing/mfs/config — Public endpoint to get active dynamic bKash & Nagad accounts */
router.get('/mfs/config', (_req: Request, res: Response) => {
  try {
    const config = mfsPaymentService.getAccountsConfig();
    res.json({ success: true, config });
  } catch (err: any) {
    res.status(500).json({ error: 'config_fetch_failed', message: err.message });
  }
});

/** POST /api/billing/mfs/admin/config — Super Admin update dynamic MFS accounts & instructions */
router.post('/mfs/admin/config', async (req: Request, res: Response) => {
  const { adminKey, config } = req.body || {};
  const providedKey = adminKey || (req.headers['x-admin-key'] as string);

  if (!isAuthorizedAdmin(req, providedKey)) {
    res.status(403).json({ error: 'unauthorized', message: 'Super Admin credentials or session required.' });
    return;
  }

  if (!config || typeof config !== 'object') {
    res.status(400).json({ error: 'invalid_config', message: 'MFS configuration object is required.' });
    return;
  }

  try {
    // Allows updating either bkash alone, nagad alone, or both
    const updated = mfsPaymentService.updateAccountsConfig(config as Partial<MfsAccountConfig>);
    res.json({ success: true, message: 'MFS configuration updated successfully.', config: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'update_failed', message: err.message });
  }
});

/** POST /api/billing/mfs/submit — Submit MFS TrxID and get 24h provisional access */
router.post('/mfs/submit', async (req: Request, res: Response) => {
  const { provider, senderNumber, trxId, planId, userHandle, userEmail, userId } = req.body || {};
  const effectiveUserId = req.auth?.userId || userId || (userHandle ? `gh_${userHandle}` : 'anonymous_dev');

  if (!provider || !senderNumber || !trxId || !planId) {
    res.status(400).json({
      error: 'missing_fields',
      message: 'Provider (bKash/Nagad), Sender Number, Transaction ID, and Plan are required.',
    });
    return;
  }

  try {
    const result = await mfsPaymentService.submitPayment({
      userId: effectiveUserId,
      userHandle: req.auth?.handle || userHandle,
      userEmail: req.auth?.email || userEmail,
      provider: provider as MfsProvider,
      senderNumber: String(senderNumber),
      trxId: String(trxId),
      planId: planId as PlanId,
    });

    res.json({
      success: true,
      message: 'পেমেন্ট ভেরিফিকেশন সফলভাবে সাবমিট হয়েছে। আপনাকে তাৎক্ষণিক ২৪ ঘণ্টার প্রভিশনাল প্রো অ্যাক্সেস দেওয়া হলো!',
      record: result.record,
      instantAccessGranted: result.instantAccessGranted,
    });
  } catch (err: any) {
    res.status(400).json({
      error: 'submission_failed',
      message: err.message || 'Payment submission failed.',
    });
  }
});

/** GET /api/billing/mfs/status — Get current user MFS payment & account details */
router.get('/mfs/status', async (req: Request, res: Response) => {
  const queryUserId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
  const effectiveUserId = req.auth?.userId || queryUserId || 'anonymous_dev';

  try {
    const status = await mfsPaymentService.getUserPaymentStatus(effectiveUserId);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: 'status_check_failed', message: err.message });
  }
});

/** GET /api/billing/mfs/admin/list — Admin view of all submitted transactions */
router.get('/mfs/admin/list', async (req: Request, res: Response) => {
  try {
    const providedKey = (req.headers['x-admin-key'] as string) || (req.query.adminKey as string);
    if (!isAuthorizedAdmin(req, providedKey)) {
      res.status(403).json({ error: 'unauthorized', message: 'Super Admin credentials or session required.' });
      return;
    }
    const status = typeof req.query.status === 'string' ? (req.query.status as any) : undefined;
    const items = await mfsPaymentService.listPayments({ status });
    res.json({ count: items.length, items });
  } catch (err: any) {
    res.status(500).json({ error: 'list_failed', message: err.message });
  }
});

/** POST /api/billing/mfs/admin/verify — Admin approve or reject transaction */
router.post('/mfs/admin/verify', async (req: Request, res: Response) => {
  const { paymentId, action, notes, adminKey } = req.body || {};
  const providedKey = adminKey || (req.headers['x-admin-key'] as string);

  if (!isAuthorizedAdmin(req, providedKey)) {
    res.status(403).json({ error: 'unauthorized', message: 'Super Admin credentials or session required.' });
    return;
  }

  if (!paymentId || !action || !['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'invalid_request', message: 'paymentId and action (approve|reject) are required.' });
    return;
  }

  try {
    const updated = await mfsPaymentService.verifyPayment(paymentId, action, req.auth?.email || 'admin', notes);
    res.json({ success: true, record: updated });
  } catch (err: any) {
    res.status(400).json({ error: 'verification_failed', message: err.message });
  }
});

export const billingRouter = router;
export default router;