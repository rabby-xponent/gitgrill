/**
 * Platform Admin Access Control (RBAC).
 *
 * Gating utility to ensure only authorized platform super-admins can view
 * or access internal consoles like `/admin/billing` and MFS payment verification.
 */

import { AuthUser } from './auth';

export function isAdmin(user: AuthUser | null | undefined): boolean {
  if (!user) return false;

  // 1. Primary: Check Supabase-assigned role (user.role, app_metadata, or user_metadata)
  const appRole = (user as any).app_metadata?.role;
  const userRole = (user as any).user_metadata?.role || (user as any).role || user.role;
  if (appRole === 'admin' || userRole === 'admin') {
    return true;
  }

  // 2. Optional: Check dynamic env var if provided
  const email = (user.email || '').trim().toLowerCase();
  const envAdmins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (email && envAdmins.includes(email)) {
    return true;
  }

  return false;
}

// --- Platform Capability Limits & Invitations Client -----------------------

import { API_URL } from './config';
import { getAccessToken } from './auth';

export interface TierCapabilityLimits {
  'audit.run': number;
  'audit.deep_code': number;
  'target_role.create': number;
  'resumes.vault': number;
  'resume.tailor': number;
  'practice.defense': number;
  'proof.publish': number;
}

export interface PlatformTierLimits {
  free: TierCapabilityLimits;
  pro: TierCapabilityLimits;
  updatedAt?: string;
  updatedBy?: string;
}

export interface UserQuotaOverride {
  userId: string;
  userEmail?: string;
  userHandle?: string;
  tier?: 'free' | 'pro' | 'admin';
  customLimits?: Partial<TierCapabilityLimits>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserInvitation {
  id: string;
  email: string;
  handle?: string;
  assignedTier: 'free' | 'pro' | 'admin';
  customLimits?: Partial<TierCapabilityLimits>;
  invitedBy: string;
  invitedAt: string;
  status: 'pending' | 'accepted' | 'revoked';
  notes?: string;
}

async function getAdminHeaders(adminKey?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = await getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (adminKey) {
    headers['x-admin-key'] = adminKey;
  }
  return headers;
}

export async function fetchPlatformLimits(adminKey?: string): Promise<PlatformTierLimits | null> {
  try {
    const headers = await getAdminHeaders(adminKey);
    const res = await fetch(`${API_URL}/api/admin/limits`, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.limits || null;
  } catch {
    return null;
  }
}

export async function updatePlatformLimits(
  payload: { free?: Partial<TierCapabilityLimits>; pro?: Partial<TierCapabilityLimits> },
  adminKey?: string
): Promise<{ success: boolean; message: string; limits?: PlatformTierLimits }> {
  try {
    const headers = await getAdminHeaders(adminKey);
    const res = await fetch(`${API_URL}/api/admin/limits`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || 'Failed to update limits.' };
    }
    return { success: true, message: data.message, limits: data.limits };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error updating limits.' };
  }
}

export async function fetchUserOverrides(adminKey?: string): Promise<UserQuotaOverride[]> {
  try {
    const headers = await getAdminHeaders(adminKey);
    const res = await fetch(`${API_URL}/api/admin/users/overrides`, { headers, cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.overrides || [];
  } catch {
    return [];
  }
}

export async function saveUserOverride(
  payload: {
    userId: string;
    userEmail?: string;
    userHandle?: string;
    tier?: 'free' | 'pro' | 'admin';
    customLimits?: Partial<TierCapabilityLimits>;
    notes?: string;
  },
  adminKey?: string
): Promise<{ success: boolean; message: string; record?: UserQuotaOverride }> {
  try {
    const headers = await getAdminHeaders(adminKey);
    const res = await fetch(`${API_URL}/api/admin/users/override`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || 'Failed to save override.' };
    }
    return { success: true, message: data.message, record: data.record };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error saving override.' };
  }
}

export async function deleteUserOverride(
  userId: string,
  adminKey?: string
): Promise<{ success: boolean }> {
  try {
    const headers = await getAdminHeaders(adminKey);
    const res = await fetch(`${API_URL}/api/admin/users/override/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    return { success: res.ok && data.success };
  } catch {
    return { success: false };
  }
}

export async function fetchInvitations(adminKey?: string): Promise<UserInvitation[]> {
  try {
    const headers = await getAdminHeaders(adminKey);
    const res = await fetch(`${API_URL}/api/admin/users/invites`, { headers, cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.invites || [];
  } catch {
    return [];
  }
}

export async function createInvitation(
  payload: {
    email: string;
    handle?: string;
    assignedTier: 'free' | 'pro' | 'admin';
    customLimits?: Partial<TierCapabilityLimits>;
    notes?: string;
  },
  adminKey?: string
): Promise<{ success: boolean; message: string; invite?: UserInvitation }> {
  try {
    const headers = await getAdminHeaders(adminKey);
    const res = await fetch(`${API_URL}/api/admin/users/invite`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, message: data.message || 'Failed to create invitation.' };
    }
    return { success: true, message: data.message, invite: data.invite };
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error creating invitation.' };
  }
}

export async function revokeInvitation(
  id: string,
  adminKey?: string
): Promise<{ success: boolean }> {
  try {
    const headers = await getAdminHeaders(adminKey);
    const res = await fetch(`${API_URL}/api/admin/users/invite/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    const data = await res.json();
    return { success: res.ok && data.success };
  } catch {
    return { success: false };
  }
}
