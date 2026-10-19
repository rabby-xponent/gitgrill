/**
 * Entitlements (M25A — MONETIZATION_ARCHITECTURE.md §6/§7).
 *
 * One endpoint that answers "what may this visitor do right now, and what is
 * left?" so the frontend's quota meter and feature-lock chips are driven by the
 * same `can()` verdicts the backend enforces at its chokepoints. No limit is
 * duplicated client-side — the browser only formats what this returns.
 *
 * Anonymous visitors get the anonymous map (no user data to leak); signed-in
 * users get live audit usage from the ledger and, when the session carries a
 * GitHub handle, the count of their published proof pages.
 */

import { Router, Request, Response } from 'express';
import { ALL_CAPABILITIES, can, tierForSession, Capability, Verdict } from '../config/tiers';
import { getUsage } from './usage-ledger';
import { listProofs } from '../proofs/proof-store';
import { getPlanState } from '../billing/subscriptions';

import { limitsService } from './limits.service';

export interface EntitlementEntry extends Verdict {
  /** Rolling-window reset for `audit.run`; null when unknown. */
  resetAt?: string | null;
}

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const isSuperAdmin = limitsService.isSuperAdmin(req.auth);

  if (isSuperAdmin) {
    const capabilities: Record<Capability, EntitlementEntry> = {} as Record<
      Capability,
      EntitlementEntry
    >;
    for (const capability of ALL_CAPABILITIES) {
      capabilities[capability] = {
        tier: 'admin' as any,
        capability,
        allowed: true,
        remaining: 999999,
        limit: 'unlimited',
        branded: false,
        reason: null,
        upgradeTo: null,
        label: 'Super Admin — Uncapped',
        resetAt: null,
      };
    }
    res.json({
      tier: 'admin',
      capabilities,
      plan: { tier: 'admin', status: 'active', label: 'Super Admin' },
    });
    return;
  }

  // Tier comes from the local subscription mirror (M25B); the registry's
  // `tierForSession` is only the anonymous/free fallback.
  const plan = await getPlanState(req.auth?.userId ?? null, Boolean(req.auth));
  const tier = plan.tier || tierForSession(Boolean(req.auth));
  const capabilities: Record<Capability, EntitlementEntry> = {} as Record<
    Capability,
    EntitlementEntry
  >;

  let auditsUsed = 0;
  let auditResetAt: string | null = null;
  let auditLookupFailed = false;
  let proofsUsed: number | null = null;

  if (req.auth) {
    try {
      const usage = await getUsage(req.auth.userId);
      auditsUsed = usage.used;
      auditResetAt = usage.resetAt;
    } catch (err: any) {
      auditLookupFailed = true;
      console.error('[entitlements] usage lookup failed:', err?.message);
    }
    if (req.auth.handle) {
      try {
        proofsUsed = (await listProofs(req.auth.handle)).length;
      } catch (err: any) {
        console.error('[entitlements] proof count failed:', err?.message);
      }
    }
  }

  for (const capability of ALL_CAPABILITIES) {
    const used = capability === 'audit.run' ? auditsUsed : capability === 'proof.publish' ? proofsUsed : 0;
    const baseVerdict = can(tier, capability, { used: used ?? 0 });

    // Overlay dynamic limits and custom user overrides from limitsService
    const dynamicLimit = limitsService.getEffectiveLimit(req.auth || null, tier, capability as any);
    let effectiveVerdict = baseVerdict;

    if (dynamicLimit === 'unlimited') {
      effectiveVerdict = {
        ...baseVerdict,
        allowed: true,
        remaining: null,
        limit: 'unlimited',
        reason: null,
        upgradeTo: null,
      };
    } else if (typeof dynamicLimit === 'number' && dynamicLimit > 0) {
      const rem = Math.max(0, dynamicLimit - (used ?? 0));
      effectiveVerdict = {
        ...baseVerdict,
        limit: dynamicLimit,
        remaining: rem,
        allowed: rem > 0,
        reason: rem > 0 ? null : baseVerdict.reason,
      };
    }

    capabilities[capability] =
      capability === 'audit.run' ? { ...effectiveVerdict, resetAt: auditResetAt } : effectiveVerdict;
  }

  if (auditLookupFailed && capabilities['audit.run'].allowed) {
    capabilities['audit.run'] = {
      ...capabilities['audit.run'],
      allowed: false,
      reason: 'Usage lookup is temporarily unavailable — try again in a moment.',
    };
  }

  res.json({ tier, capabilities, plan: req.auth ? plan : null });
});

export const entitlementsRouter = router;
export default router;