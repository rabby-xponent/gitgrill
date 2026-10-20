'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { ConfirmModal, AlertModal, TextArea } from '@/components/ui';
import { useSession } from '@/components/SessionProvider';
import {
  isAdmin,
  fetchPlatformLimits,
  updatePlatformLimits,
  fetchUserOverrides,
  saveUserOverride,
  deleteUserOverride,
  fetchInvitations,
  createInvitation,
  revokeInvitation,
  PlatformTierLimits,
  UserQuotaOverride,
  UserInvitation,
  TierCapabilityLimits,
} from '@/lib/admin';
import {
  AdminMfsRecord,
  fetchAdminMfsPayments,
  verifyAdminMfsPayment,
  fetchMfsConfig,
  updateAdminMfsConfig,
  MfsAccountConfig,
  PLANS,
} from '@/lib/billing';

export default function AdminBillingPage() {
  const { user, loading: sessionLoading } = useSession();
  const [activeTab, setActiveTab] = useState<'ledger' | 'accounts' | 'limits' | 'users'>('ledger');

  // Ledger state
  const [payments, setPayments] = useState<AdminMfsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_verification' | 'verified' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [copiedTrxId, setCopiedTrxId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [rejectModalRecord, setRejectModalRecord] = useState<AdminMfsRecord | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [paymentToApprove, setPaymentToApprove] = useState<AdminMfsRecord | null>(null);
  const [alertInfo, setAlertInfo] = useState<{ title: string; description: string; variant?: 'error' | 'info' | 'warning' } | null>(null);

  // Dynamic MFS accounts configuration state
  const [mfsConfig, setMfsConfig] = useState<MfsAccountConfig>({
    bkash: { number: '', type: 'personal', note: '', isActive: true },
    nagad: { number: '', type: 'personal', note: '', isActive: true },
    noticeMessage: '',
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  // Dynamic Tier Limits state
  const [tierLimits, setTierLimits] = useState<PlatformTierLimits>({
    free: {
      'audit.run': 10,
      'audit.deep_code': 3,
      'target_role.create': 5,
      'resumes.vault': 3,
      'resume.tailor': 10,
      'practice.defense': 5,
      'proof.publish': 1,
    },
    pro: {
      'audit.run': 100,
      'audit.deep_code': 25,
      'target_role.create': 50,
      'resumes.vault': 20,
      'resume.tailor': 150,
      'practice.defense': 50,
      'proof.publish': 10,
    },
  });
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitsSaving, setLimitsSaving] = useState(false);
  const [limitsSuccess, setLimitsSuccess] = useState(false);

  // User management state
  const [overrides, setOverrides] = useState<UserQuotaOverride[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteHandle, setInviteHandle] = useState('');
  const [inviteTier, setInviteTier] = useState<'free' | 'pro' | 'admin'>('pro');
  const [inviteNotes, setInviteNotes] = useState('');
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideUserId, setOverrideUserId] = useState('');
  const [overrideUserEmail, setOverrideUserEmail] = useState('');
  const [overrideUserHandle, setOverrideUserHandle] = useState('');
  const [overrideTier, setOverrideTier] = useState<'free' | 'pro' | 'admin'>('pro');
  const [overrideNotes, setOverrideNotes] = useState('');
  const [overrideLimits, setOverrideLimits] = useState<Partial<TierCapabilityLimits>>({});

  // Load saved admin key from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gitgrill_admin_key') || localStorage.getItem('devscope_admin_key');
    if (saved) setAdminKey(saved);
  }, []);

  const isSuperAdmin = isAdmin(user);
  const isAuthorized = isSuperAdmin || Boolean(adminKey);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminMfsPayments(
        statusFilter === 'all' ? undefined : statusFilter,
        adminKey || undefined
      );
      setPayments(data.items || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, adminKey]);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const cfg = await fetchMfsConfig();
      if (cfg) setMfsConfig(cfg);
    } catch {
      // ignore
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const loadLimits = useCallback(async () => {
    setLimitsLoading(true);
    try {
      const data = await fetchPlatformLimits(adminKey || undefined);
      if (data) setTierLimits(data);
    } catch {
      // ignore
    } finally {
      setLimitsLoading(false);
    }
  }, [adminKey]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const [ov, inv] = await Promise.all([
        fetchUserOverrides(adminKey || undefined),
        fetchInvitations(adminKey || undefined),
      ]);
      setOverrides(ov);
      setInvitations(inv);
    } catch {
      // ignore
    } finally {
      setUsersLoading(false);
    }
  }, [adminKey]);

  useEffect(() => {
    if (isAuthorized) {
      loadPayments();
      loadConfig();
      loadLimits();
      loadUsers();
    }
  }, [isAuthorized, loadPayments, loadConfig, loadLimits, loadUsers]);

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    setLimitsSaving(true);
    setLimitsSuccess(false);
    try {
      const res = await updatePlatformLimits(
        { free: tierLimits.free, pro: tierLimits.pro },
        adminKey || undefined
      );
      if (res.limits) setTierLimits(res.limits);
      setLimitsSuccess(true);
      setTimeout(() => setLimitsSuccess(false), 3000);
    } catch (err: any) {
      setAlertInfo({
        title: 'Failed to Save Limits',
        description: err?.message || 'Server error saving limits.',
        variant: 'error',
      });
    } finally {
      setLimitsSaving(false);
    }
  };

  const handleCreateInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    try {
      const res = await createInvitation(
        {
          email: inviteEmail.trim().toLowerCase(),
          handle: inviteHandle.trim() || undefined,
          assignedTier: inviteTier,
          notes: inviteNotes.trim() || undefined,
        },
        adminKey || undefined
      );
      if (res.success) {
        setInviteModalOpen(false);
        setInviteEmail('');
        setInviteHandle('');
        setInviteNotes('');
        await loadUsers();
      } else {
        setAlertInfo({ title: 'Invite Failed', description: res.message, variant: 'error' });
      }
    } catch (err: any) {
      setAlertInfo({ title: 'Invite Failed', description: err?.message, variant: 'error' });
    }
  };

  const handleRevokeInviteClick = async (id: string) => {
    try {
      await revokeInvitation(id, adminKey || undefined);
      await loadUsers();
    } catch (err: any) {
      setAlertInfo({ title: 'Revoke Failed', description: err?.message, variant: 'error' });
    }
  };

  const handleSaveOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideUserId) return;
    try {
      const res = await saveUserOverride(
        {
          userId: overrideUserId.trim(),
          userEmail: overrideUserEmail.trim() || undefined,
          userHandle: overrideUserHandle.trim() || undefined,
          tier: overrideTier,
          customLimits: Object.keys(overrideLimits).length > 0 ? overrideLimits : undefined,
          notes: overrideNotes.trim() || undefined,
        },
        adminKey || undefined
      );
      if (res.success) {
        setOverrideModalOpen(false);
        setOverrideUserId('');
        setOverrideUserEmail('');
        setOverrideUserHandle('');
        setOverrideNotes('');
        setOverrideLimits({});
        await loadUsers();
      } else {
        setAlertInfo({ title: 'Override Failed', description: res.message, variant: 'error' });
      }
    } catch (err: any) {
      setAlertInfo({ title: 'Override Failed', description: err?.message, variant: 'error' });
    }
  };

  const handleDeleteOverrideClick = async (userId: string) => {
    try {
      await deleteUserOverride(userId, adminKey || undefined);
      await loadUsers();
    } catch (err: any) {
      setAlertInfo({ title: 'Delete Failed', description: err?.message, variant: 'error' });
    }
  };

  const handleSaveAdminKey = (newKey: string) => {
    setAdminKey(newKey);
    if (newKey) {
      localStorage.setItem('gitgrill_admin_key', newKey);
    } else {
      localStorage.removeItem('gitgrill_admin_key');
      localStorage.removeItem('devscope_admin_key');
    }
    setShowKeyInput(false);
  };

  const handleCopyTrx = (trxId: string) => {
    navigator.clipboard.writeText(trxId);
    setCopiedTrxId(trxId);
    setTimeout(() => setCopiedTrxId(null), 2000);
  };

  const handleApprove = (record: AdminMfsRecord) => {
    setPaymentToApprove(record);
  };

  const handleExecuteApprove = async () => {
    if (!paymentToApprove) return;
    const record = paymentToApprove;
    setActionInProgress(record.id);
    try {
      await verifyAdminMfsPayment(record.id, 'approve', undefined, adminKey || undefined);
      await loadPayments();
      setPaymentToApprove(null);
    } catch (err: any) {
      setAlertInfo({ title: 'Approval Failed', description: err?.message || 'Server error', variant: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalRecord) return;
    setActionInProgress(rejectModalRecord.id);
    try {
      await verifyAdminMfsPayment(
        rejectModalRecord.id,
        'reject',
        rejectReason.trim() || 'Payment details could not be verified.',
        adminKey || undefined
      );
      setRejectModalRecord(null);
      setRejectReason('');
      await loadPayments();
    } catch (err: any) {
      setAlertInfo({ title: 'Rejection Failed', description: err?.message || 'Server error', variant: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSaveMfsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigSuccess(false);
    try {
      const res = await updateAdminMfsConfig(mfsConfig, adminKey || undefined);
      if (res.config) setMfsConfig(res.config);
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err: any) {
      setAlertInfo({ title: 'Configuration Update Failed', description: err?.message || 'Server error', variant: 'error' });
    } finally {
      setConfigSaving(false);
    }
  };

  // Filtered list by search term
  const filteredPayments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return payments;
    return payments.filter(
      (p) =>
        p.trxId.toLowerCase().includes(q) ||
        p.senderNumber.includes(q) ||
        (p.userHandle && p.userHandle.toLowerCase().includes(q)) ||
        (p.userEmail && p.userEmail.toLowerCase().includes(q)) ||
        p.provider.toLowerCase().includes(q)
    );
  }, [payments, searchQuery]);

  // Metric counts
  const metrics = useMemo(() => {
    const pending = payments.filter((p) => p.status === 'pending_verification').length;
    const verified = payments.filter((p) => p.status === 'verified').length;
    const rejected = payments.filter((p) => p.status === 'rejected').length;
    const totalBdt = payments
      .filter((p) => p.status === 'verified')
      .reduce((sum, p) => sum + (p.amountBdt || 0), 0);

    return { total: payments.length, pending, verified, rejected, totalBdt };
  }, [payments]);

  // Loading state
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6 text-muted font-mono text-sm">
        <Icon.Refresh className="h-5 w-5 animate-spin mr-2 text-signal" />
        Authenticating Super Admin session...
      </div>
    );
  }

  // Unauthorized Gate Screen
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-canvas text-content flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-edge bg-card p-6 shadow-xl text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500 mx-auto">
            <Icon.Lock className="h-6 w-6" />
          </div>
          <h2 className="font-sans text-xl font-bold text-content">Super Admin Authorization Required</h2>
          <p className="font-mono text-xs text-muted leading-relaxed">
            The platform operations console is restricted to Super Admins. Sign in with an authorized administrator account or enter an admin secret key.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const val = (e.currentTarget.elements.namedItem('key') as HTMLInputElement)?.value;
              handleSaveAdminKey(val.trim());
            }}
            className="space-y-3 pt-2"
          >
            <input
              name="key"
              type="password"
              placeholder="Enter ADMIN_SECRET_KEY..."
              className="w-full rounded-xl border border-edge bg-well px-3.5 py-2.5 font-mono text-xs text-content focus:border-signal focus:outline-hidden"
              autoFocus
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-signal py-2.5 font-mono text-xs font-bold text-white uppercase tracking-wider hover:bg-signal/90 transition-all cursor-pointer"
            >
              Unlock Console
            </button>
          </form>

          <div className="pt-2 border-t border-edge">
            <Link
              href="/developer"
              className="font-mono text-xs text-muted hover:text-signal transition-colors inline-flex items-center gap-1"
            >
              <Icon.ArrowLeft className="h-3 w-3" />
              <span>Return to Developer Workspace</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-content">
      {/* Top Navigation Bar */}
      <header className="border-b border-edge bg-card sticky top-0 z-30 shadow-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Link
              href="/developer"
              className="flex items-center gap-1.5 font-mono text-xs text-muted hover:text-content transition-colors shrink-0"
            >
              <Icon.ArrowLeft className="h-3.5 w-3.5" />
              <span>Developer<span className="hidden xs:inline"> Workspace</span></span>
            </Link>
            <span className="text-edge">/</span>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-[#ea580c]/15 text-[#ea580c] font-mono font-bold text-xs shrink-0">
                ৳
              </span>
              <h1 className="font-sans text-sm font-bold tracking-tight text-content truncate">
                Admin Console
              </h1>
              <span className="hidden sm:inline-block rounded bg-well px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted border border-edge">
                {isSuperAdmin ? 'Super Admin' : 'Key Authenticated'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="flex items-center gap-1.5 rounded-lg border border-edge bg-card px-2.5 sm:px-3 py-1.5 font-mono text-xs text-muted hover:text-content hover:border-signal/50 transition-colors"
            >
              <Icon.Lock className="h-3.5 w-3.5" />
              <span>{adminKey ? 'Key Configured' : 'Set Admin Key'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                loadPayments();
                loadConfig();
                loadLimits();
                loadUsers();
              }}
              disabled={loading || limitsLoading || usersLoading}
              className="flex items-center gap-1.5 rounded-lg bg-well border border-edge hover:bg-well/80 px-2.5 sm:px-3 py-1.5 font-mono text-xs text-content transition-colors cursor-pointer"
            >
              <Icon.Refresh className={`h-3.5 w-3.5 ${loading || limitsLoading || usersLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex gap-4 sm:gap-6 border-t border-edge/60 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`flex items-center gap-2 py-3 font-mono text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'border-signal text-signal'
                : 'border-transparent text-muted hover:text-content'
            }`}
          >
            <span>৳ MFS Verification Ledger</span>
            {metrics.pending > 0 && (
              <span className="rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 px-2 py-0.2 text-[10px]">
                {metrics.pending} pending
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-2 py-3 font-mono text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'accounts'
                ? 'border-signal text-signal'
                : 'border-transparent text-muted hover:text-content'
            }`}
          >
            <Icon.Settings className="h-3.5 w-3.5" />
            <span>⚙️ MFS Accounts & Notices</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('limits')}
            className={`flex items-center gap-2 py-3 font-mono text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'limits'
                ? 'border-signal text-signal'
                : 'border-transparent text-muted hover:text-content'
            }`}
          >
            <Icon.Layers className="h-3.5 w-3.5" />
            <span>🎛️ Tier Limits & Capability Rules</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 py-3 font-mono text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-signal text-signal'
                : 'border-transparent text-muted hover:text-content'
            }`}
          >
            <Icon.Users className="h-3.5 w-3.5" />
            <span>👥 User Invites & Overrides</span>
            {invitations.filter((i) => i.status === 'pending').length > 0 && (
              <span className="rounded-full bg-signal/15 text-signal px-2 py-0.2 text-[10px]">
                {invitations.filter((i) => i.status === 'pending').length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Admin Key Drawer */}
      {showKeyInput && (
        <div className="bg-well/80 border-b border-edge px-4 sm:px-6 lg:px-8 py-3 animate-in fade-in">
          <div className="mx-auto max-w-7xl flex items-center gap-3">
            <span className="font-mono text-xs text-muted">Admin Secret Key:</span>
            <input
              type="password"
              defaultValue={adminKey}
              placeholder="Enter ADMIN_SECRET_KEY..."
              className="rounded-lg border border-edge bg-card px-3 py-1 font-mono text-xs text-content w-64 focus:border-signal focus:outline-hidden"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveAdminKey(e.currentTarget.value.trim());
                }
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                handleSaveAdminKey(input.value.trim());
              }}
              className="rounded-lg bg-signal text-white px-3 py-1 font-mono text-xs font-bold"
            >
              Save Key
            </button>
            <button
              type="button"
              onClick={() => handleSaveAdminKey('')}
              className="text-muted hover:text-rose-500 font-mono text-xs"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {activeTab === 'accounts' && (
          /* TAB 2: Dynamic MFS Accounts Configuration */
          <div className="max-w-3xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-sans text-xl font-bold text-content flex items-center gap-2">
                  <Icon.Settings className="h-5 w-5 text-signal" />
                  <span>Dynamic MFS Accounts Management</span>
                </h2>
                <p className="font-mono text-xs text-muted mt-1">
                  Update bKash and Nagad numbers, account types, and instructions directly. Changes apply immediately to all users.
                </p>
              </div>
              {configSuccess && (
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                  <Icon.Check className="h-4 w-4" />
                  <span>Settings Saved!</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSaveMfsConfig} className="space-y-6">
              {/* bKash Account Settings */}
              <div className="rounded-2xl border border-edge bg-card p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-edge pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#e2136e] text-white font-bold text-[10px]">
                      bK
                    </span>
                    <h3 className="font-sans font-bold text-sm text-content">bKash Account Settings</h3>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mfsConfig.bkash.isActive}
                      onChange={(e) =>
                        setMfsConfig({
                          ...mfsConfig,
                          bkash: { ...mfsConfig.bkash, isActive: e.target.checked },
                        })
                      }
                      className="rounded border-edge"
                    />
                    <span>Active for Checkout</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-muted mb-1.5">
                      bKash Phone Number
                    </label>
                    <input
                      type="text"
                      value={mfsConfig.bkash.number}
                      onChange={(e) =>
                        setMfsConfig({
                          ...mfsConfig,
                          bkash: { ...mfsConfig.bkash, number: e.target.value.trim() },
                        })
                      }
                      placeholder="017XXXXXXXX"
                      className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-muted mb-1.5">
                      Account Type
                    </label>
                    <select
                      value={mfsConfig.bkash.type}
                      onChange={(e) =>
                        setMfsConfig({
                          ...mfsConfig,
                          bkash: { ...mfsConfig.bkash, type: e.target.value as any },
                        })
                      }
                      className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden cursor-pointer"
                    >
                      <option value="personal">Personal (Send Money)</option>
                      <option value="merchant">Merchant (Payment)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-muted mb-1.5">
                    User Instructions Note (Bengali / English)
                  </label>
                  <input
                    type="text"
                    value={mfsConfig.bkash.note}
                    onChange={(e) =>
                      setMfsConfig({
                        ...mfsConfig,
                        bkash: { ...mfsConfig.bkash, note: e.target.value },
                      })
                    }
                    placeholder="e.g. Send Money অপশন ব্যবহার করুন। রেফারেন্সে গিটহাব হ্যান্ডেল দিন।"
                    className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Nagad Account Settings */}
              <div className="rounded-2xl border border-edge bg-card p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-edge pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#f7941d] text-white font-bold text-[10px]">
                      ন
                    </span>
                    <h3 className="font-sans font-bold text-sm text-content">Nagad Account Settings</h3>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mfsConfig.nagad.isActive}
                      onChange={(e) =>
                        setMfsConfig({
                          ...mfsConfig,
                          nagad: { ...mfsConfig.nagad, isActive: e.target.checked },
                        })
                      }
                      className="rounded border-edge"
                    />
                    <span>Active for Checkout</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-mono uppercase text-muted mb-1.5">
                      Nagad Phone Number
                    </label>
                    <input
                      type="text"
                      value={mfsConfig.nagad.number}
                      onChange={(e) =>
                        setMfsConfig({
                          ...mfsConfig,
                          nagad: { ...mfsConfig.nagad, number: e.target.value.trim() },
                        })
                      }
                      placeholder="018XXXXXXXX"
                      className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono uppercase text-muted mb-1.5">
                      Account Type
                    </label>
                    <select
                      value={mfsConfig.nagad.type}
                      onChange={(e) =>
                        setMfsConfig({
                          ...mfsConfig,
                          nagad: { ...mfsConfig.nagad, type: e.target.value as any },
                        })
                      }
                      className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden cursor-pointer"
                    >
                      <option value="personal">Personal (Send Money)</option>
                      <option value="merchant">Merchant (Payment)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-muted mb-1.5">
                    User Instructions Note (Bengali / English)
                  </label>
                  <input
                    type="text"
                    value={mfsConfig.nagad.note}
                    onChange={(e) =>
                      setMfsConfig({
                        ...mfsConfig,
                        nagad: { ...mfsConfig.nagad, note: e.target.value },
                      })
                    }
                    placeholder="e.g. Send Money অপশন ব্যবহার করুন।"
                    className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Notice Message Banner */}
              <div className="rounded-2xl border border-edge bg-card p-6 shadow-xs space-y-3">
                <h3 className="font-sans font-bold text-sm text-content flex items-center gap-2">
                  <Icon.Info className="h-4 w-4 text-signal" />
                  <span>Checkout Modal Announcement Banner</span>
                </h3>
                <p className="text-xs font-mono text-muted">
                  This notice will be prominently displayed inside the bKash/Nagad checkout modal for all users.
                </p>
                <TextArea
                  rows={2}
                  value={mfsConfig.noticeMessage || ''}
                  onChange={(e) =>
                    setMfsConfig({
                      ...mfsConfig,
                      noticeMessage: e.target.value,
                    })
                  }
                  placeholder="e.g. বিকাশ অথবা নগদ দিয়ে পেমেন্ট করার পর ট্রানজেকশন আইডি (TrxID) সাবমিট করুন..."
                  mono
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={configSaving}
                  className="rounded-xl bg-signal px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-signal/90 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {configSaving ? 'Saving Changes...' : 'Save MFS Configuration'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'ledger' && (
          /* TAB 1: Verification Ledger */
          <div className="space-y-6">
            {/* Metric Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="rounded-xl border border-edge bg-card p-4 shadow-xs">
                <div className="font-mono text-[11px] uppercase tracking-wider text-muted">
                  Total Submissions
                </div>
                <div className="mt-1 font-sans text-2xl font-bold text-content">
                  {metrics.total}
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 shadow-xs">
                <div className="font-mono text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold">
                  Pending Verification
                </div>
                <div className="mt-1 font-sans text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {metrics.pending}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-xs">
                <div className="font-mono text-[11px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
                  Verified Pro
                </div>
                <div className="mt-1 font-sans text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {metrics.verified}
                </div>
              </div>

              <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 shadow-xs">
                <div className="font-mono text-[11px] uppercase tracking-wider text-rose-600 dark:text-rose-400 font-semibold">
                  Rejected / Invalid
                </div>
                <div className="mt-1 font-sans text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {metrics.rejected}
                </div>
              </div>

              <div className="rounded-xl border border-[#ea580c]/30 bg-[#ea580c]/5 p-4 shadow-xs col-span-2 md:col-span-1">
                <div className="font-mono text-[11px] uppercase tracking-wider text-[#ea580c] dark:text-signal font-semibold">
                  Verified BDT Revenue
                </div>
                <div className="mt-1 font-sans text-2xl font-bold text-[#ea580c] dark:text-signal">
                  ৳{metrics.totalBdt.toLocaleString('en-US')}
                </div>
              </div>
            </div>

            {/* Controls Bar: Filter Status + Search Input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-edge rounded-xl p-3 shadow-xs">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto thin-scroll pb-1 sm:pb-0">
                {(['all', 'pending_verification', 'verified', 'rejected'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={`rounded-lg px-3 py-1.5 font-mono text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                      statusFilter === filter
                        ? 'bg-signal text-white shadow-xs'
                        : 'bg-well text-muted hover:text-content'
                    }`}
                  >
                    {filter === 'all'
                      ? 'All'
                      : filter === 'pending_verification'
                        ? 'Pending'
                        : filter === 'verified'
                          ? 'Verified'
                          : 'Rejected'}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 sm:max-w-xs">
                <Icon.Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Search TrxID, phone, user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-edge bg-well pl-9 pr-3 py-1.5 font-mono text-xs text-content focus:border-signal focus:outline-hidden"
                />
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-mono text-rose-600 dark:text-rose-400 flex items-center justify-between">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={loadPayments}
                  className="underline hover:no-underline font-bold"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Transactions Table */}
            <div className="rounded-2xl border border-edge bg-card shadow-xs overflow-hidden">
              <div className="overflow-x-auto thin-scroll">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-well/60 border-b border-edge text-[10px] uppercase tracking-wider text-muted">
                    <tr>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">TrxID</th>
                      <th className="px-4 py-3">Plan / BDT</th>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Sender Phone</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted At</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-muted">
                          <Icon.Refresh className="h-5 w-5 animate-spin mx-auto mb-2 text-signal" />
                          Loading transaction records...
                        </td>
                      </tr>
                    ) : filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-muted">
                          No transactions found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((record) => {
                        const planDef = PLANS[record.planId] || { label: record.planId, displayBdt: `৳${record.amountBdt}` };
                        const isPending = record.status === 'pending_verification';
                        const isBusy = actionInProgress === record.id;
                        const date = new Date(record.submittedAt || record.createdAt);

                        return (
                          <tr
                            key={record.id}
                            className={`transition-colors hover:bg-well/40 ${
                              isPending ? 'bg-amber-500/[0.02]' : ''
                            }`}
                          >
                            {/* Provider */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold text-white uppercase ${
                                  record.provider === 'bkash' ? 'bg-[#e2136e]' : 'bg-[#f7941d]'
                                }`}
                              >
                                {record.provider}
                              </span>
                            </td>

                            {/* TrxID */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-content tracking-wider">
                                  {record.trxId}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyTrx(record.trxId)}
                                  title="Copy TrxID"
                                  className="text-muted hover:text-content p-1 rounded hover:bg-well cursor-pointer"
                                >
                                  {copiedTrxId === record.trxId ? (
                                    <Icon.Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                  ) : (
                                    <Icon.Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Plan & Amount */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="font-bold text-content">
                                ৳{record.amountBdt}
                              </div>
                              <div className="text-[10px] text-muted">
                                {planDef.label}
                              </div>
                            </td>

                            {/* User */}
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-content truncate max-w-[140px]">
                                {record.userHandle ? `@${record.userHandle}` : record.userEmail || record.userId.slice(0, 10)}
                              </div>
                            </td>

                            {/* Phone */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-muted">
                              {record.senderNumber}
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  record.status === 'verified'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : record.status === 'rejected'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                <span>●</span>
                                <span>
                                  {record.status === 'verified'
                                    ? 'Verified'
                                    : record.status === 'rejected'
                                      ? 'Rejected'
                                      : 'Pending'}
                                </span>
                              </span>
                            </td>

                            {/* Date */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-muted text-[11px]">
                              {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{' '}
                              <span className="text-[10px] opacity-70">
                                {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3.5 whitespace-nowrap text-right">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleApprove(record)}
                                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                                  >
                                    {isBusy ? '...' : 'Approve'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => {
                                      setRejectModalRecord(record);
                                      setRejectReason('');
                                    }}
                                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 px-2 py-1 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted font-sans">
                                  {record.status === 'verified' ? '✓ Verified' : '✕ Rejected'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'limits' && (
          /* TAB 3: Dynamic Tier Limits & Capability Rules */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-sans text-xl font-bold text-content flex items-center gap-2">
                  <Icon.Layers className="h-5 w-5 text-signal" />
                  <span>Platform Tier Limits & Capability Engine</span>
                </h2>
                <p className="font-mono text-xs text-muted mt-1">
                  Adjust quotas and usage ceilings live across the platform without redeploying code.
                </p>
              </div>

              {limitsSuccess && (
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                  <Icon.Check className="h-4 w-4" />
                  <span>Platform Limits Updated Live!</span>
                </div>
              )}
            </div>

            {/* Super Admin Privileges Callout */}
            <div className="rounded-2xl border border-signal/30 bg-signal/5 p-4 shadow-xs flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal/15 text-signal font-bold">
                ∞
              </div>
              <div>
                <h4 className="font-sans font-bold text-sm text-content">
                  Super Admin Zero-Limit Enforcement
                </h4>
                <p className="font-mono text-xs text-muted leading-relaxed mt-0.5">
                  Super Admin users have permanent unrestricted access across all audit runs, deep AST analysis, resume vault slots, and interview drills without consuming any quota.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveLimits} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Free Tier Limits Card */}
                <div className="rounded-2xl border border-edge bg-card p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-edge pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-well text-muted font-bold text-xs border border-edge">
                        F
                      </span>
                      <h3 className="font-sans font-bold text-sm text-content">Free Tier Capabilities</h3>
                    </div>
                    <span className="font-mono text-[11px] text-muted uppercase">Unpaid Registered</span>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        Resume Vault Limit (Resumes & Variants)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={tierLimits.free['resumes.vault']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            free: { ...tierLimits.free, 'resumes.vault': parseInt(e.target.value) || 1 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        Target Roles & JD Benchmarks
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={tierLimits.free['target_role.create']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            free: { ...tierLimits.free, 'target_role.create': parseInt(e.target.value) || 1 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        Profile & Repo Audits (30-day window)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={tierLimits.free['audit.run']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            free: { ...tierLimits.free, 'audit.run': parseInt(e.target.value) || 1 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        Deep AST Code Audits (30-day window)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={tierLimits.free['audit.deep_code']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            free: { ...tierLimits.free, 'audit.deep_code': parseInt(e.target.value) || 0 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        AI Resume Tailoring Runs (30-day window)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={tierLimits.free['resume.tailor']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            free: { ...tierLimits.free, 'resume.tailor': parseInt(e.target.value) || 1 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        Behavioral & Defense Drills (30-day window)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={tierLimits.free['practice.defense']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            free: { ...tierLimits.free, 'practice.defense': parseInt(e.target.value) || 1 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        Published Verifiable Proof Pages (Active)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={tierLimits.free['proof.publish']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            free: { ...tierLimits.free, 'proof.publish': parseInt(e.target.value) || 1 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Pro Tier Limits Card */}
                <div className="rounded-2xl border border-signal/30 bg-card p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-edge pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-signal text-white font-bold text-xs">
                        P
                      </span>
                      <h3 className="font-sans font-bold text-sm text-content">Pro Tier Capabilities</h3>
                    </div>
                    <span className="font-mono text-[11px] text-signal font-bold uppercase">Paid / Subscribed</span>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        Resume Vault Limit (Resumes & Variants)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={200}
                        value={tierLimits.pro['resumes.vault']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            pro: { ...tierLimits.pro, 'resumes.vault': parseInt(e.target.value) || 5 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        Target Roles & JD Benchmarks
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={500}
                        value={tierLimits.pro['target_role.create']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            pro: { ...tierLimits.pro, 'target_role.create': parseInt(e.target.value) || 10 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        Profile & Repo Audits (30-day window)
                      </label>
                      <input
                        type="number"
                        min={20}
                        max={2000}
                        value={tierLimits.pro['audit.run']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            pro: { ...tierLimits.pro, 'audit.run': parseInt(e.target.value) || 20 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        Deep AST Code Audits (30-day window)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={500}
                        value={tierLimits.pro['audit.deep_code']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            pro: { ...tierLimits.pro, 'audit.deep_code': parseInt(e.target.value) || 5 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        AI Resume Tailoring Runs (30-day window)
                      </label>
                      <input
                        type="number"
                        min={20}
                        max={1000}
                        value={tierLimits.pro['resume.tailor']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            pro: { ...tierLimits.pro, 'resume.tailor': parseInt(e.target.value) || 20 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        Behavioral & Defense Drills (30-day window)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={500}
                        value={tierLimits.pro['practice.defense']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            pro: { ...tierLimits.pro, 'practice.defense': parseInt(e.target.value) || 10 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono uppercase text-muted mb-1">
                        Published Verifiable Proof Pages (Active)
                      </label>
                      <input
                        type="number"
                        min={2}
                        max={100}
                        value={tierLimits.pro['proof.publish']}
                        onChange={(e) =>
                          setTierLimits({
                            ...tierLimits,
                            pro: { ...tierLimits.pro, 'proof.publish': parseInt(e.target.value) || 2 },
                          })
                        }
                        className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-sm text-content focus:border-signal focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={limitsSaving}
                  className="rounded-xl bg-signal px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-signal/90 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {limitsSaving ? 'Saving Limits...' : 'Save Platform Limits'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'users' && (
          /* TAB 4: User Invites & Custom Quota Overrides */
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-sans text-xl font-bold text-content flex items-center gap-2">
                  <Icon.Users className="h-5 w-5 text-signal" />
                  <span>User Invites & Custom Quota Overrides</span>
                </h2>
                <p className="font-mono text-xs text-muted mt-1">
                  Invite users directly with pre-assigned tiers, or set customized quota limits per user.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(true)}
                  className="rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Icon.Plus className="h-3.5 w-3.5" />
                  <span>Invite User</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(true)}
                  className="rounded-xl border border-edge bg-well hover:bg-well/80 px-4 py-2 font-mono text-xs font-bold text-content transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Icon.Settings className="h-3.5 w-3.5" />
                  <span>Add Quota Override</span>
                </button>
              </div>
            </div>

            {/* Section 1: User Invitations */}
            <div className="space-y-3">
              <h3 className="font-sans font-bold text-sm text-content flex items-center gap-2">
                <span>Platform User Invitations</span>
                <span className="rounded-full bg-well border border-edge px-2 py-0.2 font-mono text-[10px] text-muted">
                  {invitations.length} total
                </span>
              </h3>

              <div className="rounded-2xl border border-edge bg-card shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-edge bg-well/50 text-[11px] text-muted uppercase tracking-wider">
                        <th className="px-4 py-3 font-semibold">User Email / Handle</th>
                        <th className="px-4 py-3 font-semibold">Assigned Tier</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Invited By</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-edge">
                      {usersLoading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-muted">
                            Loading invitations...
                          </td>
                        </tr>
                      ) : invitations.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-muted">
                            No invitations sent yet. Click "Invite User" to invite someone.
                          </td>
                        </tr>
                      ) : (
                        invitations.map((inv) => (
                          <tr key={inv.id} className="hover:bg-well/40 transition-colors">
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="font-bold text-content">{inv.email}</div>
                              {inv.handle && <div className="text-[10px] text-muted">@{inv.handle}</div>}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  inv.assignedTier === 'admin'
                                    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                                    : inv.assignedTier === 'pro'
                                      ? 'bg-signal/10 text-signal border border-signal/30'
                                      : 'bg-well text-muted border border-edge'
                                }`}
                              >
                                {inv.assignedTier}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  inv.status === 'accepted'
                                    ? 'bg-emerald-500/10 text-emerald-600'
                                    : inv.status === 'revoked'
                                      ? 'bg-rose-500/10 text-rose-600'
                                      : 'bg-amber-500/10 text-amber-600'
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap text-muted text-[11px]">
                              {inv.invitedBy}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap text-muted text-[11px]">
                              {new Date(inv.invitedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap text-right">
                              {inv.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeInviteClick(inv.id)}
                                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 px-2 py-1 text-xs font-bold transition-all cursor-pointer"
                                >
                                  Revoke
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Section 2: Custom User Quota Overrides */}
            <div className="space-y-3">
              <h3 className="font-sans font-bold text-sm text-content flex items-center gap-2">
                <span>Custom User Quota Overrides</span>
                <span className="rounded-full bg-well border border-edge px-2 py-0.2 font-mono text-[10px] text-muted">
                  {overrides.length} active
                </span>
              </h3>

              <div className="rounded-2xl border border-edge bg-card shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-edge bg-well/50 text-[11px] text-muted uppercase tracking-wider">
                        <th className="px-4 py-3 font-semibold">User ID / Email</th>
                        <th className="px-4 py-3 font-semibold">Overridden Tier</th>
                        <th className="px-4 py-3 font-semibold">Custom Quota Grants</th>
                        <th className="px-4 py-3 font-semibold">Notes</th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-edge">
                      {usersLoading ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted">
                            Loading overrides...
                          </td>
                        </tr>
                      ) : overrides.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-muted">
                            No custom overrides set. Platform defaults apply to all users.
                          </td>
                        </tr>
                      ) : (
                        overrides.map((ov) => (
                          <tr key={ov.userId} className="hover:bg-well/40 transition-colors">
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="font-bold text-content">{ov.userEmail || ov.userId}</div>
                              {ov.userHandle && <div className="text-[10px] text-muted">@{ov.userHandle}</div>}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                  ov.tier === 'admin'
                                    ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                                    : ov.tier === 'pro'
                                      ? 'bg-signal/10 text-signal border border-signal/30'
                                      : 'bg-well text-muted border border-edge'
                                }`}
                              >
                                {ov.tier || 'default'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-muted">
                              {ov.customLimits && Object.keys(ov.customLimits).length > 0 ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(ov.customLimits).map(([cap, val]) => (
                                    <span
                                      key={cap}
                                      className="rounded bg-well px-1.5 py-0.5 text-[10px] border border-edge text-content font-mono"
                                    >
                                      {cap}: {val}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted font-sans">Full {ov.tier} limits</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-muted text-[11px] max-w-xs truncate">
                              {ov.notes || '—'}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteOverrideClick(ov.userId)}
                                className="rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 px-2 py-1 text-xs font-bold transition-all cursor-pointer"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Reject Modal */}
      {rejectModalRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setRejectModalRecord(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fade-up relative w-full max-w-md rounded-2xl border border-edge bg-card p-6 shadow-pop text-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h3 className="font-sans font-bold text-sm text-content">
                Reject Transaction
              </h3>
              <button
                type="button"
                onClick={() => setRejectModalRecord(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-edge bg-well/50 text-muted transition-colors hover:border-signal/50 hover:bg-well hover:text-signal"
              >
                <Icon.X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 font-mono text-xs">
              <div className="rounded-lg border border-edge bg-well p-3 space-y-1">
                <div>TrxID: <span className="font-bold text-content">{rejectModalRecord.trxId}</span></div>
                <div>Sender: <span className="text-content">{rejectModalRecord.senderNumber}</span></div>
                <div>Amount: <span className="text-content">৳{rejectModalRecord.amountBdt}</span></div>
              </div>

              <div>
                <label className="block text-[11px] text-muted mb-1 font-mono uppercase tracking-wider">
                  Reason for rejection (saved to record):
                </label>
                <TextArea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Transaction ID not found in MFS statement, or incorrect amount."
                  mono
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalRecord(null)}
                  className="rounded-lg border border-edge px-3 py-1.5 text-muted hover:text-content"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={actionInProgress === rejectModalRecord.id}
                  className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve Payment Confirm Modal */}
      {paymentToApprove && (
        <ConfirmModal
          isOpen={!!paymentToApprove}
          onClose={() => setPaymentToApprove(null)}
          onConfirm={handleExecuteApprove}
          title="Approve MFS Payment?"
          description={
            <div className="space-y-2 font-sans text-xs">
              <p>
                Verify transaction <strong className="font-mono text-content">{paymentToApprove.trxId}</strong> from <strong>{paymentToApprove.senderNumber}</strong> ({paymentToApprove.amountBdt} BDT)?
              </p>
              <div className="rounded-xl border border-signal/20 bg-signal/10 p-3 text-signal">
                <p className="font-semibold">Grant Full Pro Subscription</p>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  This will upgrade user <span className="font-mono">{paymentToApprove.userEmail}</span> to the Pro tier immediately.
                </p>
              </div>
            </div>
          }
          confirmLabel="Approve Payment"
          variant="info"
        />
      )}

      {/* Invite User Modal */}
      {inviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setInviteModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fade-up relative w-full max-w-md rounded-2xl border border-edge bg-card p-6 shadow-pop text-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h3 className="font-sans font-bold text-sm text-content flex items-center gap-2">
                <Icon.Users className="h-4 w-4 text-signal" />
                <span>Invite Platform User</span>
              </h3>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-edge bg-well/50 text-muted transition-colors hover:border-signal/50 hover:bg-well hover:text-signal cursor-pointer"
              >
                <Icon.X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateInviteSubmit} className="mt-4 space-y-3.5 font-mono text-xs">
              <div>
                <label className="block text-[11px] text-muted mb-1 font-mono uppercase tracking-wider">
                  User Email Address *
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="developer@company.com"
                  className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-hidden"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[11px] text-muted mb-1 font-mono uppercase tracking-wider">
                  GitHub Handle (Optional)
                </label>
                <input
                  type="text"
                  value={inviteHandle}
                  onChange={(e) => setInviteHandle(e.target.value)}
                  placeholder="e.g. torvalds"
                  className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] text-muted mb-1 font-mono uppercase tracking-wider">
                  Assigned Tier / Access Role
                </label>
                <select
                  value={inviteTier}
                  onChange={(e) => setInviteTier(e.target.value as any)}
                  className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-hidden cursor-pointer"
                >
                  <option value="pro">Pro Tier (Full access & elevated quotas)</option>
                  <option value="admin">Super Admin (Unlimited ∞ on everything)</option>
                  <option value="free">Free Tier (Standard generous limits)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-muted mb-1 font-mono uppercase tracking-wider">
                  Admin Notes / Context (Optional)
                </label>
                <input
                  type="text"
                  value={inviteNotes}
                  onChange={(e) => setInviteNotes(e.target.value)}
                  placeholder="e.g. VIP speaker at DevCon, partner trial"
                  className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-edge">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="rounded-lg border border-edge px-3 py-1.5 text-muted hover:text-content cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-signal hover:bg-signal/90 text-white px-4 py-1.5 font-bold transition-all cursor-pointer shadow-xs"
                >
                  Create & Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set User Quota Override Modal */}
      {overrideModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setOverrideModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fade-up relative w-full max-w-lg rounded-2xl border border-edge bg-card p-6 shadow-pop text-content max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h3 className="font-sans font-bold text-sm text-content flex items-center gap-2">
                <Icon.Settings className="h-4 w-4 text-signal" />
                <span>Set User Custom Quota Override</span>
              </h3>
              <button
                type="button"
                onClick={() => setOverrideModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-edge bg-well/50 text-muted transition-colors hover:border-signal/50 hover:bg-well hover:text-signal cursor-pointer"
              >
                <Icon.X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form onSubmit={handleSaveOverrideSubmit} className="mt-4 space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-muted mb-1 font-mono uppercase tracking-wider">
                    User ID (or Email) *
                  </label>
                  <input
                    type="text"
                    value={overrideUserId}
                    onChange={(e) => setOverrideUserId(e.target.value)}
                    placeholder="user_id or email..."
                    className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-hidden"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-muted mb-1 font-mono uppercase tracking-wider">
                    Overridden Tier
                  </label>
                  <select
                    value={overrideTier}
                    onChange={(e) => setOverrideTier(e.target.value as any)}
                    className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-hidden cursor-pointer"
                  >
                    <option value="pro">Pro (Subscribed level)</option>
                    <option value="admin">Super Admin (Unlimited ∞)</option>
                    <option value="free">Free (Standard)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-muted mb-1 font-mono uppercase tracking-wider">
                    User Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={overrideUserEmail}
                    onChange={(e) => setOverrideUserEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-muted mb-1 font-mono uppercase tracking-wider">
                    GitHub Handle (Optional)
                  </label>
                  <input
                    type="text"
                    value={overrideUserHandle}
                    onChange={(e) => setOverrideUserHandle(e.target.value)}
                    placeholder="e.g. dev_guru"
                    className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-edge bg-well/50 p-3 space-y-2.5">
                <div className="font-sans font-bold text-xs text-content">
                  Custom Quota Overrides (Leave blank to inherit tier defaults)
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="text-muted block mb-0.5">Resume Vault Limit</label>
                    <input
                      type="number"
                      placeholder="e.g. 50"
                      value={overrideLimits['resumes.vault'] ?? ''}
                      onChange={(e) =>
                        setOverrideLimits({
                          ...overrideLimits,
                          'resumes.vault': e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      className="w-full rounded-lg border border-edge bg-card px-2.5 py-1 text-content"
                    />
                  </div>

                  <div>
                    <label className="text-muted block mb-0.5">Target Roles Limit</label>
                    <input
                      type="number"
                      placeholder="e.g. 100"
                      value={overrideLimits['target_role.create'] ?? ''}
                      onChange={(e) =>
                        setOverrideLimits({
                          ...overrideLimits,
                          'target_role.create': e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      className="w-full rounded-lg border border-edge bg-card px-2.5 py-1 text-content"
                    />
                  </div>

                  <div>
                    <label className="text-muted block mb-0.5">Profile Audits (30d)</label>
                    <input
                      type="number"
                      placeholder="e.g. 200"
                      value={overrideLimits['audit.run'] ?? ''}
                      onChange={(e) =>
                        setOverrideLimits({
                          ...overrideLimits,
                          'audit.run': e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      className="w-full rounded-lg border border-edge bg-card px-2.5 py-1 text-content"
                    />
                  </div>

                  <div>
                    <label className="text-muted block mb-0.5">AI Tailoring Runs (30d)</label>
                    <input
                      type="number"
                      placeholder="e.g. 300"
                      value={overrideLimits['resume.tailor'] ?? ''}
                      onChange={(e) =>
                        setOverrideLimits({
                          ...overrideLimits,
                          'resume.tailor': e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      className="w-full rounded-lg border border-edge bg-card px-2.5 py-1 text-content"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-muted mb-1 font-mono uppercase tracking-wider">
                  Notes
                </label>
                <input
                  type="text"
                  value={overrideNotes}
                  onChange={(e) => setOverrideNotes(e.target.value)}
                  placeholder="e.g. Granted extra quota for beta tester"
                  className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-edge">
                <button
                  type="button"
                  onClick={() => setOverrideModalOpen(false)}
                  className="rounded-lg border border-edge px-3 py-1.5 text-muted hover:text-content cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-signal hover:bg-signal/90 text-white px-4 py-1.5 font-bold transition-all cursor-pointer shadow-xs"
                >
                  Save User Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertInfo && (
        <AlertModal
          isOpen={!!alertInfo}
          onClose={() => setAlertInfo(null)}
          title={alertInfo.title}
          description={alertInfo.description}
          variant={alertInfo.variant}
        />
      )}
    </div>
  );
}
