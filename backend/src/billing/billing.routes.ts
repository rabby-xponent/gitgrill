/**
 * Billing routes (M25B — MONETIZATION_ARCHITECTURE.md §8).
 *
 * Three surfaces:
 * - `POST /api/billing/checkout` — Stripe Checkout (subscription mode). The
 *   only place a session is created; it never writes plan state.
 * - `POST /api/billing/portal` — Customer Portal for upgrade/cancel/payment
 *   method, so self-serve never needs our UI.
 * - `GET /api/billing/subscription` — what the user is on right now, for the
 *   "manage billing" affordance in the upgrade modal.
 * - `POST /api/billing/webhook` — signature-verified, idempotent, and the only
 *   writer of plan state. Mounted on the RAW body (see index.ts) because Stripe
 *   signs the exact bytes.
 *
 * When Stripe is unconfigured these answer an honest 503 instead of pretending;
 * every M25A wall keeps working on Free.
 */

import { Router, Request, Response } from 'express';
import type Stripe from 'stripe';
import { requireAuth } from '../auth/middleware';
import {
  claimEvent,
  getPlanState,
  graceWindowDeadline,
  readSubscription,
  readUserByCustomer,
  releaseEvent,
  writeSubscription,
  PAST_DUE_GRACE_DAYS,
} from './subscriptions';
import {
  cancelUrl,
  configuredPlans,
  getStripe,
  getWebhookSecret,
  isBillingConfigured,
  PLANS,
  PlanId,
  planForPriceLoose,
  priceIdFor,
  successUrl,
} from './stripe';

import { mfsPaymentService, MfsProvider } from './mfs-payment.service';
import { limitsService } from '../security/limits.service';

const router = Router();

const BILLING_OFF = {
  error: 'billing_not_configured',
  message:
    'Checkout is not configured on this deployment. Set STRIPE_SECRET_KEY and the plan price IDs to enable paid upgrades.',
};

function isPlanId(value: unknown): value is PlanId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(PLANS, value);
}

/**
 * Find or create the Stripe customer for a user. The mirror stores the id, so
 * repeat checkouts reuse the customer and the Customer Portal keeps working.
 */
async function resolveCustomer(
  stripe: Stripe,
  userId: string,
  email: string | null,
  handle: string | null
): Promise<string> {
  const existing = await readSubscription(userId);
  if (existing?.customer_id) return existing.customer_id;
  const created = await stripe.customers.create({
    email: email ?? undefined,
    name: handle ?? undefined,
    metadata: {
      gitgrill_user_id: userId,
      devscope_user_id: userId,
      gitgrill_handle: handle ?? '',
      devscope_handle: handle ?? '',
    },
  });
  return created.id;
}

// --- Checkout ---------------------------------------------------------------

/** POST /api/billing/checkout — { plan, seats? } → { url }. */
router.post('/checkout', requireAuth, async (req: Request, res: Response) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json(BILLING_OFF);
    return;
  }

  const plan = (req.body || {}).plan;
  if (!isPlanId(plan)) {
    res.status(400).json({ error: 'invalid_plan', message: 'Unknown plan.' });
    return;
  }
  const price = priceIdFor(plan);
  if (!price) {
    res.status(503).json({
      error: 'plan_not_configured',
      message: `${plan} has no price ID configured (${PLANS[plan].priceEnv}).`,
    });
    return;
  }

  const definition = PLANS[plan];
  const requestedSeats = Math.floor(Number((req.body || {}).seats) || 1);
  const seats = definition.perSeat ? Math.min(25, Math.max(1, requestedSeats)) : 1;

  try {
    const auth = req.auth!;
    const customer = await resolveCustomer(stripe, auth.userId, auth.email, auth.handle);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      client_reference_id: auth.userId,
      line_items: [{ price, quantity: seats }],
      metadata: {
        gitgrill_user_id: auth.userId,
        devscope_user_id: auth.userId,
        plan,
        seats: String(seats),
      },
      subscription_data: {
        metadata: {
          gitgrill_user_id: auth.userId,
          devscope_user_id: auth.userId,
          plan,
        },
      },
      allow_promotion_codes: true,
      success_url: successUrl(),
      cancel_url: cancelUrl(),
    });
    res.json({
      id: session.id,
      url: session.url,
      plan,
      seats,
      amount: `${definition.display}${definition.perSeat && seats > 1 ? ` × ${seats}` : ''}`,
    });
  } catch (err: any) {
    console.error('[billing] checkout failed:', err?.message);
    res.status(502).json({ error: 'checkout_failed', message: err?.message || 'Checkout failed.' });
  }
});

// --- Customer portal --------------------------------------------------------

/** POST /api/billing/portal — self-serve upgrade/cancel/payment method. */
router.post('/portal', requireAuth, async (req: Request, res: Response) => {
  const stripe = getStripe();
  if (!stripe) {
    res.status(503).json(BILLING_OFF);
    return;
  }
  const record = await readSubscription(req.auth!.userId);
  if (!record?.customer_id) {
    res.status(400).json({
      error: 'no_billing_account',
      message: 'No billing account yet — start with checkout.',
    });
    return;
  }
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: record.customer_id,
      return_url: successUrl(),
    });
    res.json({ url: session.url });
  } catch (err: any) {
    console.error('[billing] portal failed:', err?.message);
    res.status(502).json({ error: 'portal_failed', message: err?.message || 'Portal failed.' });
  }
});

// --- Subscription status ----------------------------------------------------

/** GET /api/billing/subscription — plan state + what is purchasable. */
router.get('/subscription', requireAuth, async (req: Request, res: Response) => {
  const state = await getPlanState(req.auth!.userId, true);
  res.json({
    ...state,
    billingConfigured: isBillingConfigured(),
    graceDays: PAST_DUE_GRACE_DAYS,
    plans: configuredPlans().map((p) => ({
      id: p.id,
      tier: p.tier,
      label: p.label,
      display: p.display,
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
  const providedKey = adminKey || req.headers['x-admin-key'];

  const expectedKey = process.env.ADMIN_SECRET_KEY;
  const isAdminUser = limitsService.isSuperAdmin(req.auth);

  if (!isAdminUser && expectedKey && providedKey !== expectedKey) {
    res.status(403).json({ error: 'unauthorized', message: 'Invalid admin credentials.' });
    return;
  }

  if (!config || typeof config !== 'object') {
    res.status(400).json({ error: 'invalid_config', message: 'MFS configuration object is required.' });
    return;
  }

  try {
    const updated = mfsPaymentService.updateAccountsConfig(config);
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
    const expectedKey = process.env.ADMIN_SECRET_KEY;
    const providedKey = req.headers['x-admin-key'] || req.query.adminKey;
    const isAdminUser = limitsService.isSuperAdmin(req.auth);

    if (!isAdminUser && expectedKey && providedKey !== expectedKey) {
      res.status(403).json({ error: 'unauthorized', message: 'Invalid admin credentials.' });
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
  const providedKey = adminKey || req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_SECRET_KEY;
  const isAdminUser = limitsService.isSuperAdmin(req.auth);

  if (!isAdminUser && expectedKey && providedKey !== expectedKey) {
    res.status(403).json({ error: 'unauthorized', message: 'Invalid admin credentials.' });
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

// --- Webhook ----------------------------------------------------------------

function idOf(value: string | Stripe.Customer | Stripe.Subscription | Stripe.DeletedCustomer | null) {
  return typeof value === 'string' ? value : value?.id ?? null;
}

function isoOf(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000).toISOString() : null;
}

/**
 * Apply one verified event. Returns true when plan state was written.
 * `session` events may arrive before the subscription object exists, so a
 * checkout completion writes the customer id and an active status; the later
 * `customer.subscription.updated` carries the authoritative status.
 */
async function applyEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.gitgrill_user_id || session.metadata?.devscope_user_id;
      if (!userId) {
        console.warn('[billing] checkout.session.completed without a user id');
        return false;
      }
      await writeSubscription({
        userId,
        customerId: idOf(session.customer),
        subscriptionId: idOf(session.subscription),
        plan: isPlanId(session.metadata?.plan) ? session.metadata.plan : null,
        status: 'active',
        seats: Math.max(1, Number(session.metadata?.seats) || 1),
      });
      return true;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.gitgrill_user_id || sub.metadata?.devscope_user_id;
      if (!userId) {
        console.warn(`[billing] ${event.type} without gitgrill_user_id / devscope_user_id metadata`);
        return false;
      }
      const item = sub.items?.data?.[0];
      const seats = sub.items?.data?.reduce((sum: number, i: any) => sum + (i.quantity ?? 1), 0) ?? 1;
      await writeSubscription({
        userId,
        customerId: idOf(sub.customer),
        subscriptionId: sub.id,
        plan: planForPriceLoose(item?.price?.id ?? null),
        status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status,
        seats,
        currentPeriodEnd: isoOf(sub.current_period_end),
        cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      });
      return true;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = idOf(invoice.customer);
      if (!customerId) return false;
      const record = await readUserByCustomer(customerId);
      if (!record) {
        console.warn('[billing] payment_failed for an unknown customer');
        return false;
      }
      // past_due keeps the paid tier for the grace window; the downgrade is
      // decided on read, so nothing is scheduled and nothing is deleted.
      await writeSubscription({
        userId: record.user_id,
        status: 'past_due',
        graceUntil: graceWindowDeadline(),
      });
      return true;
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = idOf(invoice.customer);
      if (!customerId) return false;
      const record = await readUserByCustomer(customerId);
      if (!record) return false;
      await writeSubscription({
        userId: record.user_id,
        status: 'active',
        graceUntil: null,
      });
      return true;
    }
    default:
      return false;
  }
}

/**
 * Stripe webhook. Mounted on the raw body: `constructEvent` verifies
 * `t-stripe-signature` against the exact bytes Stripe signed, so a JSON
 * re-serialization or a forged body both fail here.
 */
export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  const stripe = getStripe();
  const secret = getWebhookSecret();
  if (!stripe || !secret) {
    res.status(503).json(BILLING_OFF);
    return;
  }

  const signature = req.headers['stripe-signature'];
  if (typeof signature !== 'string' || !signature) {
    res.status(400).json({ error: 'missing_signature' });
    return;
  }

  let event: Stripe.Event;
  try {
    // req.body is a Buffer here because index.ts mounts this route before
    // express.json().
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, secret);
  } catch (err: any) {
    console.warn('[billing] rejected webhook:', err?.message);
    res.status(400).json({ error: 'invalid_signature' });
    return;
  }

  // Claim first so a redelivery is a no-op; release if the write fails so
  // Stripe's retry still gets a chance to apply it.
  if (!(await claimEvent(event.id, event.type))) {
    res.json({ received: true, handled: false, duplicate: true });
    return;
  }

  try {
    const handled = await applyEvent(event);
    res.json({ received: true, handled });
  } catch (err: any) {
    console.error('[billing] webhook apply failed:', err?.message);
    await releaseEvent(event.id);
    res.status(500).json({ error: 'webhook_failed' });
  }
}

export const billingRouter = router;
export default router;