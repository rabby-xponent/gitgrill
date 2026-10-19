/**
 * Entitlements client (M25A — MONETIZATION_ARCHITECTURE.md §6/§7).
 *
 * The browser never decides a limit: it asks `GET /api/entitlements`, which
 * answers with `can()` verdicts computed by the backend from the same tier
 * registry the enforcement code uses. `localEntitlements()` exists only so the UI
 * can render a sane, honest state before/without that response (offline, API
 * down) — it reads the same registry file, so the two can't disagree about
 * policy, only about *usage*.
 */

import { API_URL } from './config';
import { authHeaders } from './auth';
import { can, tierForSession, Capability, Tier, Verdict } from '@backend/config/tiers';

export interface EntitlementEntry extends Verdict {
  /** Rolling-window reset time for `audit.run`; null when unknown. */
  resetAt?: string | null;
}

export interface Entitlements {
  tier: Tier;
  capabilities: Partial<Record<Capability, EntitlementEntry>>;
  /** False when the values came from the local registry rather than the API. */
  live: boolean;
}

const DEMO_CAPS: Capability[] = [
  'audit.run',
  'audit.deep_code',
  'profile.read',
  'target_role.create',
  'resumes.vault',
  'resume.tailor',
  'practice.defense',
  'proof.publish',
  'practice.full',
  'data.export',
];

/** Verdicts from the shared registry, with zero usage assumed. */
export function localEntitlements(authenticated: boolean): Entitlements {
  const tier = tierForSession(authenticated);
  const capabilities: Partial<Record<Capability, EntitlementEntry>> = {};
  for (const capability of DEMO_CAPS) {
    capabilities[capability] = can(tier, capability);
  }
  return { tier, capabilities, live: false };
}

/** Live verdicts from the backend; falls back to the local registry on failure. */
export async function fetchEntitlements(authenticated = false): Promise<Entitlements> {
  try {
    const res = await fetch(`${API_URL}/api/entitlements`, {
      headers: await authHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`entitlements (${res.status})`);
    const data = await res.json();
    return { tier: data.tier, capabilities: data.capabilities || {}, live: true };
  } catch {
    return localEntitlements(authenticated);
  }
}

/** Verdict for one capability, or a locked placeholder if the API never answered. */
export function capabilityOf(
  entitlements: Entitlements | null,
  capability: Capability,
  used = 0
): EntitlementEntry {
  const tier = entitlements?.tier ?? 'anonymous';
  const known = entitlements?.capabilities?.[capability];
  if (!known) return can(tier, capability, { used });
  if (used === 0 || known.remaining === null) return known;
  // Local usage can be more precise than what the server last saw (proof pages
  // published from another tab), so the allowance is recomputed here — the
  // server verdict stays authoritative for everything else.
  const local = can(tier, capability, { used });
  return {
    ...known,
    allowed: local.allowed,
    remaining: local.remaining,
    reason: local.reason,
    upgradeTo: local.upgradeTo,
  };
}