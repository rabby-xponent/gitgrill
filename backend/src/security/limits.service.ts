/**
 * Dynamic Capability Limits & User Overrides Engine (Phase 2).
 *
 * Super Admins can adjust platform-wide tier capability limits dynamically
 * (saved in cache/tier-limits.json) without code changes or redeployments.
 * Also supports per-user custom quota overrides and user invitations.
 *
 * Super Admin rule: Super Admin users have absolute, unconstrained access
 * across every tool, agent, and route with zero quota consumption.
 */

import fs from 'fs';
import path from 'path';
import { AuthContext } from '../auth/middleware';

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

const CACHE_DIR = path.resolve(__dirname, '../../cache');
const LIMITS_FILE = path.join(CACHE_DIR, 'tier-limits.json');
const OVERRIDES_FILE = path.join(CACHE_DIR, 'user-overrides.json');
const INVITES_FILE = path.join(CACHE_DIR, 'user-invitations.json');

const HARDCODED_ADMIN_EMAILS = [
  'admin@gitgrill.com',
  'rabby.xponent@gmail.com',
  'alter_ego@gitgrill.com',
];

export class LimitsService {
  private tierLimits: PlatformTierLimits = {
    free: {
      'audit.run': 10,
      'audit.deep_code': 1,
      'target_role.create': 5,
      'resumes.vault': 3,
      'resume.tailor': 10,
      'practice.defense': 25,
      'proof.publish': 3,
    },
    pro: {
      'audit.run': 100,
      'audit.deep_code': 30,
      'target_role.create': 50,
      'resumes.vault': 20,
      'resume.tailor': 150,
      'practice.defense': 999999, // practically unlimited
      'proof.publish': 999999,
    },
  };

  private userOverrides: Map<string, UserQuotaOverride> = new Map();
  private invitations: Map<string, UserInvitation> = new Map();
  private loaded: boolean = false;

  constructor() {
    this.ensureLoaded();
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }

      // Load Tier Limits
      if (fs.existsSync(LIMITS_FILE)) {
        const raw = fs.readFileSync(LIMITS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.free) this.tierLimits.free = { ...this.tierLimits.free, ...parsed.free };
        if (parsed.pro) this.tierLimits.pro = { ...this.tierLimits.pro, ...parsed.pro };
        if (parsed.updatedAt) this.tierLimits.updatedAt = parsed.updatedAt;
        if (parsed.updatedBy) this.tierLimits.updatedBy = parsed.updatedBy;
      }

      // Load User Overrides
      if (fs.existsSync(OVERRIDES_FILE)) {
        const raw = fs.readFileSync(OVERRIDES_FILE, 'utf8');
        const list: UserQuotaOverride[] = JSON.parse(raw);
        for (const item of list) {
          this.userOverrides.set(item.userId, item);
        }
      }

      // Load Invitations
      if (fs.existsSync(INVITES_FILE)) {
        const raw = fs.readFileSync(INVITES_FILE, 'utf8');
        const list: UserInvitation[] = JSON.parse(raw);
        for (const item of list) {
          this.invitations.set(item.id, item);
        }
      }
    } catch (err) {
      console.error('[limits-service] Failed to load data from disk:', err);
    }
    this.loaded = true;
  }

  private saveLimitsToDisk(): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(LIMITS_FILE, JSON.stringify(this.tierLimits, null, 2), 'utf8');
    } catch (err) {
      console.error('[limits-service] Failed to save tier limits:', err);
    }
  }

  private saveOverridesToDisk(): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
      const list = Array.from(this.userOverrides.values());
      fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.error('[limits-service] Failed to save user overrides:', err);
    }
  }

  private saveInvitesToDisk(): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
      const list = Array.from(this.invitations.values());
      fs.writeFileSync(INVITES_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
      console.error('[limits-service] Failed to save invitations:', err);
    }
  }

  /**
   * Check if user is Super Admin with absolute authority.
   */
  public isSuperAdmin(auth?: AuthContext | null): boolean {
    if (!auth) return false;
    if (auth.role === 'admin') return true;
    if (auth.email) {
      const email = auth.email.trim().toLowerCase();
      if (HARDCODED_ADMIN_EMAILS.includes(email)) return true;
      const envAdmins = (process.env.ADMIN_EMAILS || process.env.PLATFORM_ADMIN_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      if (envAdmins.includes(email)) return true;
    }
    return false;
  }

  /**
   * Get dynamic tier limits for platform.
   */
  public getTierLimits(): PlatformTierLimits {
    this.ensureLoaded();
    return this.tierLimits;
  }

  /**
   * Super Admin update dynamic tier limits.
   */
  public updateTierLimits(update: {
    free?: Partial<TierCapabilityLimits>;
    pro?: Partial<TierCapabilityLimits>;
    updatedBy?: string;
  }): PlatformTierLimits {
    this.ensureLoaded();
    if (update.free) {
      this.tierLimits.free = { ...this.tierLimits.free, ...update.free };
    }
    if (update.pro) {
      this.tierLimits.pro = { ...this.tierLimits.pro, ...update.pro };
    }
    this.tierLimits.updatedAt = new Date().toISOString();
    this.tierLimits.updatedBy = update.updatedBy || 'admin';
    this.saveLimitsToDisk();
    return this.tierLimits;
  }

  /**
   * Get effective limit for a user and capability.
   */
  public getEffectiveLimit(
    auth: AuthContext | null,
    tier: string,
    capability: keyof TierCapabilityLimits
  ): number | 'unlimited' {
    if (this.isSuperAdmin(auth)) {
      return 'unlimited';
    }

    this.ensureLoaded();

    // Check user custom override
    if (auth?.userId && this.userOverrides.has(auth.userId)) {
      const override = this.userOverrides.get(auth.userId)!;
      if (override.tier === 'admin') return 'unlimited';
      if (override.customLimits && override.customLimits[capability] !== undefined) {
        return override.customLimits[capability]!;
      }
    }

    if (tier === 'anonymous') {
      return capability === 'audit.run' ? 1 : 0;
    }

    const limits = (tier === 'pro' || tier === 'team') ? this.tierLimits.pro : this.tierLimits.free;
    const limit = limits[capability] ?? 0;
    return limit >= 99999 ? 'unlimited' : limit;
  }

  /**
   * List all user overrides.
   */
  public listUserOverrides(): UserQuotaOverride[] {
    this.ensureLoaded();
    return Array.from(this.userOverrides.values());
  }

  /**
   * Set user quota override.
   */
  public setUserOverride(input: {
    userId: string;
    userEmail?: string;
    userHandle?: string;
    tier?: 'free' | 'pro' | 'admin';
    customLimits?: Partial<TierCapabilityLimits>;
    notes?: string;
  }): UserQuotaOverride {
    this.ensureLoaded();
    const now = new Date().toISOString();
    const existing = this.userOverrides.get(input.userId);

    const record: UserQuotaOverride = {
      userId: input.userId,
      userEmail: input.userEmail || existing?.userEmail,
      userHandle: input.userHandle || existing?.userHandle,
      tier: input.tier || existing?.tier || 'free',
      customLimits: input.customLimits || existing?.customLimits || {},
      notes: input.notes !== undefined ? input.notes : existing?.notes,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.userOverrides.set(input.userId, record);
    this.saveOverridesToDisk();
    return record;
  }

  /**
   * Remove user quota override.
   */
  public removeUserOverride(userId: string): boolean {
    this.ensureLoaded();
    const existed = this.userOverrides.delete(userId);
    if (existed) this.saveOverridesToDisk();
    return existed;
  }

  /**
   * List all invitations.
   */
  public listInvitations(): UserInvitation[] {
    this.ensureLoaded();
    return Array.from(this.invitations.values()).sort(
      (a, b) => new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime()
    );
  }

  /**
   * Create a user invitation with assigned tier or custom limits.
   */
  public createInvitation(input: {
    email: string;
    handle?: string;
    assignedTier: 'free' | 'pro' | 'admin';
    customLimits?: Partial<TierCapabilityLimits>;
    invitedBy: string;
    notes?: string;
  }): UserInvitation {
    this.ensureLoaded();
    const cleanEmail = input.email.trim().toLowerCase();
    const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const invite: UserInvitation = {
      id,
      email: cleanEmail,
      handle: input.handle?.trim(),
      assignedTier: input.assignedTier,
      customLimits: input.customLimits,
      invitedBy: input.invitedBy,
      invitedAt: new Date().toISOString(),
      status: 'pending',
      notes: input.notes,
    };

    this.invitations.set(id, invite);
    this.saveInvitesToDisk();

    // Also pre-create a user override keyed by email or handle so that as soon as they sign in,
    // their assigned tier and custom limits apply immediately!
    const syntheticId = `invited_${cleanEmail}`;
    this.setUserOverride({
      userId: syntheticId,
      userEmail: cleanEmail,
      userHandle: input.handle?.trim(),
      tier: input.assignedTier,
      customLimits: input.customLimits,
      notes: `Pre-provisioned invite: ${input.notes || ''}`,
    });

    return invite;
  }

  /**
   * Revoke invitation.
   */
  public revokeInvitation(id: string): boolean {
    this.ensureLoaded();
    const invite = this.invitations.get(id);
    if (!invite) return false;
    invite.status = 'revoked';
    this.saveInvitesToDisk();
    return true;
  }
}

export const limitsService = new LimitsService();
