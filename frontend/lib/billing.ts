/**
 * Billing client (MFS & BDT Payments).
 *
 * Handles subscription status checks and Bangladesh MFS (bKash & Nagad)
 * payment submissions with instant 24-hr provisional activation.
 */

import { API_URL } from './config';
import { authHeaders } from './auth';
import { PLANS, DEFAULT_PLAN, PlanId, PlanDefinition } from '@backend/config/plans';

export type { PlanId, PlanDefinition };
export { PLANS, DEFAULT_PLAN };

export interface SubscriptionStatus {
  tier: string;
  plan: PlanId | null;
  status: string;
  seats: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  inGrace: boolean;
  billingConfigured: boolean;
  graceDays: number;
  plans: Array<Pick<PlanDefinition, 'id' | 'tier' | 'label' | 'display' | 'perSeat'>>;
}

export class BillingError extends Error {
  code: string;
  notConfigured: boolean;
  constructor(code: string, message: string, notConfigured: boolean = false) {
    super(message);
    this.code = code;
    this.notConfigured = notConfigured;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const code = data?.error || 'billing_failed';
    throw new BillingError(
      code,
      data?.message || 'Action is unavailable right now.',
      res.status === 503
    );
  }
  return data as T;
}

/** Current plan state. Anonymous/unavailable billing is not an error here. */
export async function fetchSubscription(): Promise<SubscriptionStatus | null> {
  try {
    const res = await fetch(`${API_URL}/api/billing/subscription`, {
      headers: await authHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as SubscriptionStatus;
  } catch {
    return null;
  }
}

/** True when this plan is an individual plan (no seat count to pick). */
export function isPerSeat(plan: PlanId): boolean {
  return PLANS[plan].perSeat;
}

// --- Bangladesh MFS (bKash & Nagad) ---------------------------------------

export type MfsProvider = 'bkash' | 'nagad';

export interface MfsSubmitPayload {
  provider: MfsProvider;
  senderNumber: string;
  trxId: string;
  planId: PlanId;
  userHandle?: string;
  userEmail?: string;
}

export interface MfsSubmitResponse {
  success: boolean;
  message: string;
  record: any;
  instantAccessGranted: boolean;
}

export interface MfsAccountDetail {
  number: string;
  type: 'personal' | 'merchant';
  note: string;
  isActive: boolean;
}

export interface MfsAccountConfig {
  bkash: MfsAccountDetail;
  nagad: MfsAccountDetail;
  noticeMessage?: string;
}

export interface MfsStatusResponse {
  hasPending: boolean;
  latestRecord: any | null;
  accounts: MfsAccountConfig;
}

/** Submit a manual bKash/Nagad TrxID for instant provisional activation */
export async function submitMfsPayment(payload: MfsSubmitPayload): Promise<MfsSubmitResponse> {
  return post<MfsSubmitResponse>('/api/billing/mfs/submit', payload);
}

/** Fetch public dynamic MFS accounts & payment notices */
export async function fetchMfsConfig(): Promise<MfsAccountConfig | null> {
  try {
    const res = await fetch(`${API_URL}/api/billing/mfs/config`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.config as MfsAccountConfig;
  } catch {
    return null;
  }
}

/** Super Admin: Update dynamic MFS accounts & instructions */
export async function updateAdminMfsConfig(
  config: MfsAccountConfig,
  adminKey?: string
): Promise<{ success: boolean; config: MfsAccountConfig }> {
  const headers = await authHeaders();
  if (adminKey) {
    (headers as any)['x-admin-key'] = adminKey;
  }
  const res = await fetch(`${API_URL}/api/billing/mfs/admin/config`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ config, adminKey }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Failed to update MFS config (${res.status})`);
  }
  return res.json();
}

/** Fetch current user MFS payment status and account numbers */
export async function fetchMfsStatus(userId?: string): Promise<MfsStatusResponse | null> {
  try {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`${API_URL}/api/billing/mfs/status${query}`, {
      headers: await authHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as MfsStatusResponse;
  } catch {
    return null;
  }
}

export interface AdminMfsRecord {
  id: string;
  userId: string;
  userHandle?: string;
  userEmail?: string;
  provider: MfsProvider;
  senderNumber: string;
  trxId: string;
  planId: PlanId;
  amountBdt: number;
  status: 'pending_verification' | 'verified' | 'rejected';
  instantAccessGranted: boolean;
  provisionalAccessUntil: string;
  submittedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  adminNotes?: string;
  createdAt: string;
}

/** Admin: Fetch list of all submitted MFS payments with optional status filter */
export async function fetchAdminMfsPayments(
  statusFilter?: string,
  adminKey?: string
): Promise<{ count: number; items: AdminMfsRecord[] }> {
  const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
  const headers = await authHeaders();
  if (adminKey) {
    (headers as any)['x-admin-key'] = adminKey;
  }
  const res = await fetch(`${API_URL}/api/billing/mfs/admin/list${query}`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Failed to fetch payments (${res.status})`);
  }
  return res.json();
}

/** Admin: Approve or reject an MFS transaction */
export async function verifyAdminMfsPayment(
  paymentId: string,
  action: 'approve' | 'reject',
  notes?: string,
  adminKey?: string
): Promise<{ success: boolean; record: AdminMfsRecord }> {
  const headers = await authHeaders();
  if (adminKey) {
    (headers as any)['x-admin-key'] = adminKey;
  }
  const res = await fetch(`${API_URL}/api/billing/mfs/admin/verify`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ paymentId, action, notes, adminKey }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Verification action failed (${res.status})`);
  }
  return res.json();
}