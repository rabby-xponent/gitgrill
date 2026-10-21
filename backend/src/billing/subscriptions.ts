/**
 * Subscription mirror + plan cache (M25B — MONETIZATION_ARCHITECTURE.md §8).
 *
 * The webhook is the ONLY writer of plan state (a checkout redirect is not a
 * purchase receipt). It writes here; everything else reads here. The hot path
 * reads a local row behind a 60s TTL cache, so an SSE audit never calls Stripe
 * and a Stripe outage cannot block an audit.
 *
 * Two modes, like the usage ledger:
 * - Supabase (`subscriptions` + `billing_events`): durable, with event-id
 *   uniqueness giving replay safety for free.
 * - In-memory fallback: same API, same semantics, so the whole billing path is
 *   verifiable locally without a provisioned project (dev-auth mode).
 *
 * Dunning lives here, not in a cron: `past_due` keeps the paid tier until
 * `grace_until`, after which resolution falls back to Free on its own. The
 * downgrade is therefore a property of the read, and it can never delete data.
 */

import { getAdmin, isDbConfigured } from '../db/supabase';
import { Tier } from '../config/tiers';
import { PlanId, PLANS } from '../config/plans';

/**
 * Grace window after a failed payment, per architecture §8. Configurable
 * (BILLING_GRACE_DAYS) so an operator can be more generous with a known
 * customer — and so dunning can be exercised without waiting seven days.
 */
export const PAST_DUE_GRACE_DAYS = (() => {
  const raw = Number(process.env.BILLING_GRACE_DAYS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 7;
})();

/** Plan-read cache TTL on the hot path (architecture §8). */
export const PLAN_CACHE_TTL_MS = 60_000;

/** Stripe statuses that entitle a user to their paid tier right now. */
const ENTITLING_STATUSES = new Set(['active', 'trialing']);

export interface SubscriptionRecord {
  user_id: string;
  customer_id: string | null;
  subscription_id: string | null;
  plan: PlanId | null;
  status: string;
  seats: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  /** ISO time after which `past_due` no longer entitles the paid tier. */
  grace_until: string | null;
  updated_at: string;
}

export interface PlanState {
  tier: Tier;
  plan: PlanId | null;
  status: string;
  seats: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** True when the tier is only held by the dunning grace window. */
  inGrace: boolean;
  /** True when the value came from the local mirror/cache, not Stripe. */
  source: 'mirror';
}

// --- In-memory fallback store ---------------------------------------------

const memSubscriptions = new Map<string, SubscriptionRecord>();
const memEvents = new Set<string>();

function nowIso(): string {
  return new Date().toISOString();
}

/** Default record for a user we have never seen: signed-in, unpaid. */
function freeRecord(userId: string): SubscriptionRecord {
  return {
    user_id: userId,
    customer_id: null,
    subscription_id: null,
    plan: null,
    status: 'none',
    seats: 1,
    current_period_end: null,
    cancel_at_period_end: false,
    grace_until: null,
    updated_at: nowIso(),
  };
}

// --- Plan cache -------------------------------------------------------------

interface CacheEntry {
  state: PlanState;
  at: number;
}

const planCache = new Map<string, CacheEntry>();

function cacheGet(userId: string): PlanState | null {
  const hit = planCache.get(userId);
  if (!hit) return null;
  if (Date.now() - hit.at > PLAN_CACHE_TTL_MS) {
    planCache.delete(userId);
    return null;
  }
  return hit.state;
}

function cacheSet(userId: string, state: PlanState): void {
  planCache.set(userId, { state, at: Date.now() });
}

/** Drop a user's cached plan — called by every plan-state write. */
export function invalidatePlan(userId: string): void {
  planCache.delete(userId);
}

// --- Tier resolution --------------------------------------------------------

/**
 * The dunning rule, as a pure function: does this status entitle the plan right
 * now? `past_due` is entitled only while the grace window is open.
 */
export function entitlesPlan(record: SubscriptionRecord | null, at = Date.now()): boolean {
  if (!record || !record.plan) return false;
  if (ENTITLING_STATUSES.has(record.status)) return true;
  if (record.status === 'past_due') {
    if (!record.grace_until) return true; // no window recorded yet: err toward access
    return new Date(record.grace_until).getTime() > at;
  }
  return false;
}

/** Turn a mirror row into the plan state every route reads. */
export function planStateFromRecord(record: SubscriptionRecord | null, authed: boolean): PlanState {
  if (!record || !record.plan) {
    return {
      tier: authed ? 'free' : 'anonymous',
      plan: null,
      status: record?.status || 'none',
      seats: record?.seats || 1,
      currentPeriodEnd: record?.current_period_end || null,
      cancelAtPeriodEnd: record?.cancel_at_period_end || false,
      inGrace: false,
      source: 'mirror',
    };
  }
  const entitled = entitlesPlan(record);
  const plan = PLANS[record.plan];
  return {
    tier: entitled ? plan.tier : 'free',
    plan: record.plan,
    status: record.status,
    seats: record.seats || 1,
    currentPeriodEnd: record.current_period_end,
    cancelAtPeriodEnd: record.cancel_at_period_end,
    inGrace: entitled && record.status === 'past_due',
    source: 'mirror',
  };
}

// --- Reads ------------------------------------------------------------------

async function dbRead(userId: string): Promise<SubscriptionRecord | null> {
  const admin = getAdmin()!;
  const { data, error } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`subscription read failed: ${error.message}`);
  return (data as SubscriptionRecord | null) ?? null;
}

/**
 * Tier for a user, from the local mirror behind a 60s TTL cache. Never calls
 * Stripe. `authenticated: false` short-circuits to the anonymous demo tier, so
 * anonymous traffic never touches the database.
 */
export async function getPlanState(
  userId: string | null,
  authenticated: boolean
): Promise<PlanState> {
  if (!authenticated || !userId) {
    return planStateFromRecord(null, false);
  }
  const cached = cacheGet(userId);
  if (cached) return cached;
  let record: SubscriptionRecord | null;
  try {
    record = isDbConfigured() ? await dbRead(userId) : memSubscriptions.get(userId) ?? null;
  } catch (err: any) {
    // Fail closed to the free tier rather than throwing: a billing read error
    // must never turn a paid audit into an error page.
    console.error('[billing] plan read failed:', err?.message);
    return planStateFromRecord(null, true);
  }
  const state = planStateFromRecord(record, true);
  cacheSet(userId, state);
  return state;
}

/** Tier for a user, for callers that only need the tier string. */
export async function resolveTier(userId: string | null, authenticated: boolean): Promise<Tier> {
  return (await getPlanState(userId, authenticated)).tier;
}

/** Raw mirror row, for the billing status endpoint. */
export async function readSubscription(userId: string): Promise<SubscriptionRecord | null> {
  if (isDbConfigured()) return dbRead(userId);
  return memSubscriptions.get(userId) ?? null;
}

/**
 * Which user a Stripe customer belongs to. Invoice events carry only a customer
 * id, so dunning has to resolve the user through the mirror — never by calling
 * Stripe from the hot path.
 */
export async function readUserByCustomer(customerId: string): Promise<SubscriptionRecord | null> {
  if (isDbConfigured()) {
    const admin = getAdmin()!;
    const { data, error } = await admin
      .from('subscriptions')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();
    if (error) throw new Error(`customer lookup failed: ${error.message}`);
    return (data as SubscriptionRecord | null) ?? null;
  }
  for (const record of memSubscriptions.values()) {
    if (record.customer_id === customerId) return record;
  }
  return null;
}

// --- Writes (webhook only) --------------------------------------------------

export interface SubscriptionWrite {
  userId: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  plan?: PlanId | null;
  status: string;
  seats?: number;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  /** Defaults to now + grace window for `past_due`. */
  graceUntil?: string | null;
}

function graceDeadline(): string {
  return new Date(Date.now() + PAST_DUE_GRACE_DAYS * 24 * 3600 * 1000).toISOString();
}

/** Exposed for the webhook, which needs the same deadline arithmetic. */
export function graceWindowDeadline(): string {
  return graceDeadline();
}

function normalize(write: SubscriptionWrite): SubscriptionRecord {
  const existing = isDbConfigured() ? null : memSubscriptions.get(write.userId) ?? null;
  const grace =
    write.graceUntil !== undefined && write.graceUntil !== null
      ? write.graceUntil
      : write.status === 'past_due'
        ? graceDeadline()
        : existing?.grace_until ?? null;
  return {
    user_id: write.userId,
    customer_id: write.customerId ?? existing?.customer_id ?? null,
    subscription_id: write.subscriptionId ?? existing?.subscription_id ?? null,
    plan: write.plan !== undefined ? write.plan : existing?.plan ?? null,
    status: write.status,
    seats: Math.max(1, Math.floor(write.seats ?? existing?.seats ?? 1)),
    current_period_end:
      write.currentPeriodEnd !== undefined
        ? write.currentPeriodEnd
        : existing?.current_period_end ?? null,
    cancel_at_period_end: write.cancelAtPeriodEnd ?? existing?.cancel_at_period_end ?? false,
    grace_until: write.status === 'active' || write.status === 'trialing' ? null : grace,
    updated_at: nowIso(),
  };
}

/**
 * Write plan state. This is the only function that may change a plan, and it is
 * called exclusively from the verified webhook handler.
 */
export async function writeSubscription(write: SubscriptionWrite): Promise<SubscriptionRecord> {
  const record = normalize(write);
  if (isDbConfigured()) {
    const admin = getAdmin()!;
    const { error } = await admin
      .from('subscriptions')
      .upsert(record, { onConflict: 'user_id' });
    if (error) throw new Error(`subscription write failed: ${error.message}`);
  } else {
    memSubscriptions.set(record.user_id, record);
  }
  invalidatePlan(record.user_id);
  return record;
}

/**
 * Claim a webhook event id. Returns false when the event was already handled —
 * Stripe retries deliveries, so replay must be a no-op, not a double write.
 */
export async function claimEvent(eventId: string, type: string): Promise<boolean> {
  if (isDbConfigured()) {
    const admin = getAdmin()!;
    const { error } = await admin.from('billing_events').insert({ event_id: eventId, type });
    if (error) {
      // 23505 = unique violation = already claimed.
      if (error.code === '23505') return false;
      console.error('[billing] event claim failed:', error.message);
      return false;
    }
    return true;
  }
  if (memEvents.has(eventId)) return false;
  memEvents.add(eventId);
  return true;
}

/**
 * Release a claimed event after a failed apply, so retry is allowed to
 * do the work. Without this a transient DB error would silently lose a payment.
 */
export async function releaseEvent(eventId: string): Promise<void> {
  if (isDbConfigured()) {
    const admin = getAdmin()!;
    const { error } = await admin.from('billing_events').delete().eq('event_id', eventId);
    if (error) console.error('[billing] event release failed:', error.message);
    return;
  }
  memEvents.delete(eventId);
}

/** Test seam: forget a user's plan (dev only, used by local verification). */
export function resetPlanForUser(userId: string): void {
  memSubscriptions.delete(userId);
  memEvents.clear();
  invalidatePlan(userId);
}