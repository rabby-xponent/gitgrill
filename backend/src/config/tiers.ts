/**
 * Capability & tier registry (M25A — MONETIZATION_BUILD_TRACKER.md,
 * architecture §6). THE single source of limits in GitGrill.
 *
 * Backend enforcement (usage ledger, proof publish, entitlements) and frontend
 * meters (QuotaMeter, FeatureLock chips) both import this file. Nothing else may
 * hardcode a number: change a limit here and behavior changes everywhere with no
 * other code edit — the whole point of "limits as data" (decision §11 #5).
 *
 * It lives under backend/ because the backend build has `rootDir: ./src`, and the
 * frontend imports it through the `@backend/config/tiers` path alias. Keep it
 * dependency-free — no express, no supabase, no node builtins — or the browser
 * bundle breaks.
 *
 * Enforcement rules that are not in this file:
 * - Dark patterns (§6): paywalls cap *quantity* and *power*, never hide a user's
 *   own existing data. `can()` answers "may I do this now", never "may I see it".
 * - The rolling window is implemented by the ledger (M24C), not here.
 */

export type Tier = 'anonymous' | 'free' | 'pro' | 'team';

export type Capability =
  | 'audit.run'
  | 'audit.deep_code'
  | 'profile.read'
  | 'target_role.create'
  | 'resumes.vault'
  | 'resume.tailor'
  | 'practice.defense'
  | 'proof.publish'
  | 'practice.full'
  | 'screen.simulated'
  | 'screen.batch'
  | 'export.ats'
  | 'data.export';

/** `'unlimited'` = no meter; `'view_only'` = usable read-only, not actionable. */
export type Limit = number | 'unlimited' | 'view_only';

export interface CapabilityRule {
  limit: Limit;
  /** Meter window for numeric limits. */
  per?: '30d' | 'profile' | 'workspace';
  /** Free-tier artifacts carry footer attribution (§11 decision 12). */
  branded?: boolean;
  /** Marketing-safe summary, shown in the upgrade modal. */
  label: string;
  /** Rendered verbatim when the verdict is locked. Must never promise data access. */
  lockedReason?: string;
}

export type TierRules = Partial<Record<Capability, CapabilityRule>>;

/** Tier ordering — used to resolve which tier unlocks a capability. */
export const TIER_ORDER: Tier[] = ['anonymous', 'free', 'pro', 'team'];

const PRO_RULES = {
  'audit.run': { limit: 100, label: '100 comprehensive profile & repo audits' },
  'audit.deep_code': { limit: 25, label: '25 deep AST code quality & architecture audits' },
  'profile.read': { limit: 'unlimited', label: 'Unlimited re-reads of analyzed profiles' },
  'target_role.create': { limit: 50, label: '50 target roles & job description profiles' },
  'resumes.vault': { limit: 20, label: '20 resumes & customized role variants in vault' },
  'resume.tailor': { limit: 150, label: '150 AI resume tailorings against job descriptions' },
  'practice.defense': { limit: 50, label: '50 deep behavioral & system defense drills' },
  'proof.publish': {
    limit: 10,
    branded: false,
    label: '10 unbranded verifiable proof pages',
  },
  'practice.full': { limit: 'unlimited', label: 'Full spaced-repetition practice with grading' },
  'screen.simulated': { limit: 'unlimited', label: 'Simulated phone screens' },
  'data.export': { limit: 'unlimited', label: 'Export and delete your data, any time' },
} satisfies TierRules;

export const TIERS = {
  // Anonymous demo (M24A): bounded by the demo gate — 1 fresh audit per profile,
  // plus an IP backstop. Publishing stays available so a demo run can still be
  // shared, bounded to a single branded page.
  anonymous: {
    'audit.run': {
      limit: 1,
      per: 'profile',
      label: '1 demo audit per profile',
      lockedReason: 'Demo limit: one fresh audit per profile. Create a free account for 3 audits per rolling 30 days.',
    },
    'profile.read': { limit: 'unlimited', label: 'Unlimited re-reads of analyzed profiles' },
    'proof.publish': {
      limit: 1,
      branded: true,
      label: '1 active proof page, branded',
      lockedReason: 'Demo workspaces keep 1 active proof page. A free account gives you 3 audits and the same page; Pro removes the limit and the branding.',
    },
    'data.export': { limit: 'unlimited', label: 'Export and delete your data' },
  },
  // Signed-in, unpaid (architecture §6 matrix + §11 decision 10).
  free: {
    'audit.run': {
      limit: 10,
      per: '30d',
      label: '10 profile & repository audits per rolling 30 days',
      lockedReason: 'Your 10 free audits are used. The meter refills when your oldest audit leaves the rolling 30-day window.',
    },
    'audit.deep_code': {
      limit: 3,
      per: '30d',
      label: '3 deep AST code quality & architecture audits',
      lockedReason: 'Your 3 free deep code audits are used for this 30-day cycle.',
    },
    'profile.read': { limit: 'unlimited', label: 'Unlimited re-reads of analyzed profiles' },
    'target_role.create': {
      limit: 5,
      label: '5 active target roles & JD benchmarks',
      lockedReason: 'Free workspaces track up to 5 active target roles. Upgrade to Pro for 50 roles.',
    },
    'resumes.vault': {
      limit: 3,
      label: '3 resumes and variants in vault',
      lockedReason: 'Free tier includes 3 stored resumes and role variants. Upgrade to Pro for 20.',
    },
    'resume.tailor': {
      limit: 10,
      per: '30d',
      label: '10 AI resume tailoring runs per 30 days',
      lockedReason: 'You have utilized your 10 free AI resume tailoring runs for this period.',
    },
    'practice.defense': {
      limit: 5,
      per: '30d',
      label: '5 defense & behavioral drills per 30 days',
      lockedReason: 'Free tier includes 5 practice defense drills per month. Upgrade to Pro for 50.',
    },
    'proof.publish': {
      limit: 1,
      branded: true,
      label: '1 active proof page, branded',
      lockedReason: 'Free workspaces keep 1 active proof page. Pro publishes 10 unbranded pages.',
    },
    'practice.full': {
      limit: 'view_only',
      label: 'Practice deck, view-only',
      lockedReason: 'Practice with grading is a Pro feature. Your deck and every past review stay visible on Free.',
    },
    'data.export': { limit: 'unlimited', label: 'Export and delete your data' },
  },
  pro: PRO_RULES,
  team: {
    ...PRO_RULES,
    'screen.batch': { limit: 'unlimited', label: 'Batch screening across a pipeline' },
    'export.ats': { limit: 'unlimited', label: 'ATS export' },
  },
} satisfies Record<Tier, TierRules>;

export interface Verdict {
  tier: Tier;
  capability: Capability;
  allowed: boolean;
  /** Remaining allowance; `null` when the capability is not numerically metered. */
  remaining: number | null;
  limit: Limit;
  /** True when artifacts this capability creates carry GitGrill attribution. */
  branded: boolean;
  /** Verbatim, renderable explanation when `allowed` is false. */
  reason: string | null;
  /** The cheapest tier that unlocks it, or null if no tier does. */
  upgradeTo: Tier | null;
  label: string;
}

/** The registry rule for a tier/capability pair, or null when the tier lacks it. */
export function ruleFor(tier: Tier, capability: Capability): CapabilityRule | null {
  const rules = TIERS[tier] as TierRules | undefined;
  return rules?.[capability] ?? null;
}

function tierUnlocking(capability: Capability): Tier | null {
  for (const tier of TIER_ORDER) {
    const rule = ruleFor(tier, capability);
    if (rule && (rule.limit === 'unlimited' || rule.limit === 'view_only')) return tier;
  }
  return null;
}

/**
 * The one question the whole app asks: may this tier do this now?
 *
 * `usage.used` is the caller's live count for metered capabilities (the ledger
 * for `audit.run`, published pages for `proof.publish`). A verdict of
 * `allowed: false` never implies the user's existing data becomes invisible.
 */
export function can(
  tier: Tier,
  capability: Capability,
  usage: { used?: number } = {}
): Verdict {
  const rule = ruleFor(tier, capability);
  if (!rule) {
    return {
      tier,
      capability,
      allowed: false,
      remaining: null,
      limit: 0,
      branded: false,
      label: '',
      reason: 'Not available on this plan.',
      upgradeTo: tierUnlocking(capability),
    };
  }

  const base = {
    tier,
    capability,
    branded: rule.branded === true,
    label: rule.label,
    upgradeTo: null as Tier | null,
  };

  if (rule.limit === 'unlimited') {
    return { ...base, allowed: true, remaining: null, limit: 'unlimited', reason: null };
  }

  if (rule.limit === 'view_only') {
    return {
      ...base,
      allowed: false,
      remaining: null,
      limit: 'view_only',
      reason: rule.lockedReason || `${rule.label}.`,
      upgradeTo: tierUnlocking(capability),
    };
  }

  const used = Math.max(0, usage.used ?? 0);
  const remaining = Math.max(0, rule.limit - used);
  const allowed = remaining > 0;
  return {
    ...base,
    allowed,
    remaining,
    limit: rule.limit,
    reason: allowed ? null : rule.lockedReason || `${rule.label}.`,
    upgradeTo: allowed ? null : tierUnlocking(capability),
  };
}

/**
 * Tier for a request. Signed-in users are Free until Stripe lands (M25B), which
 * replaces this with the subscription lookup + its 60s-TTL cache.
 */
export function tierForSession(authenticated: boolean): Tier {
  return authenticated ? 'free' : 'anonymous';
}

/** Numeric allowance for a metered capability, or null when not numerically metered. */
export function numericLimit(tier: Tier, capability: Capability): number | null {
  const limit = ruleFor(tier, capability)?.limit;
  return typeof limit === 'number' ? limit : null;
}

/** Every capability the v1 matrix knows about, in display order. */
export const ALL_CAPABILITIES: Capability[] = [
  'audit.run',
  'audit.deep_code',
  'profile.read',
  'target_role.create',
  'resumes.vault',
  'resume.tailor',
  'practice.defense',
  'proof.publish',
  'practice.full',
  'screen.simulated',
  'screen.batch',
  'export.ats',
  'data.export',
];