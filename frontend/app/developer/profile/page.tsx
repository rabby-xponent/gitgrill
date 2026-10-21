'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { useSession } from '@/components/SessionProvider';
import { useEntitlements } from '@/hooks/useEntitlements';
import { capabilityOf } from '@/lib/entitlements';
import { isAdmin } from '@/lib/admin';
import {
  getDeveloperProfile,
  saveDeveloperProfile,
  DeveloperWorkspaceProfile,
} from '@/lib/workspace-profiles';
import { getResumes } from '@/lib/resumes';
import { getTargetRoles } from '@/lib/target-roles';
import { listPublishedProofs } from '@/lib/proof-pages';
import { BkashNagadModal } from '@/components/BkashNagadModal';
import { updatePassword, signInWithPassword, resetPassword } from '@/lib/auth';
import { PlanId } from '@/lib/billing';

type SettingsTab = 'details' | 'security' | 'billing' | 'quotas';

function DeveloperProfileContent() {
  const { user, openSignIn } = useSession();
  const { entitlements } = useEntitlements();
  const isSuperAdmin = isAdmin(user);

  const [activeTab, setActiveTab] = useState<SettingsTab>('details');
  const [profile, setProfile] = useState<DeveloperWorkspaceProfile>(getDeveloperProfile);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('pro_monthly');

  // Client-side Counters for Capabilities
  const [resumesCount, setResumesCount] = useState(0);
  const [rolesCount, setRolesCount] = useState(0);
  const [proofsCount, setProofsCount] = useState(0);

  // Profile Edit State
  const [fullName, setFullName] = useState('');
  const [primaryGithub, setPrimaryGithub] = useState('');
  const [newGithubInput, setNewGithubInput] = useState('');
  const [additionalGithubs, setAdditionalGithubs] = useState<string[]>([]);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  // Password / Security State
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    const p = getDeveloperProfile();
    setProfile(p);
    setFullName(p.fullName || user?.name || '');
    setPrimaryGithub(p.githubUsername || user?.handle || '');
    setAdditionalGithubs(p.additionalGithubAccounts || []);
    setLinkedinUrl(p.linkedinUrl || '');
    setPortfolioUrl(p.portfolioUrl || '');

    try {
      setResumesCount(getResumes().length);
    } catch {
      setResumesCount(0);
    }

    try {
      setRolesCount(getTargetRoles().length);
    } catch {
      setRolesCount(0);
    }

    if (p.githubUsername) {
      listPublishedProofs(p.githubUsername)
        .then((l) => setProofsCount(l.length))
        .catch(() => setProofsCount(0));
    }
  }, [user]);

  // Handle Profile Save
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = saveDeveloperProfile({
      fullName: fullName.trim(),
      githubUsername: primaryGithub.trim().replace(/^@/, ''),
      additionalGithubAccounts: additionalGithubs,
      linkedinUrl: linkedinUrl.trim(),
      portfolioUrl: portfolioUrl.trim(),
    });
    setProfile(updated);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  // Add Secondary GitHub Handle
  const handleAddGithubAccount = () => {
    const cleaned = newGithubInput.trim().replace(/^@/, '');
    if (!cleaned) return;
    if (additionalGithubs.includes(cleaned) || cleaned.toLowerCase() === primaryGithub.toLowerCase()) {
      setNewGithubInput('');
      return;
    }
    setAdditionalGithubs((prev) => [...prev, cleaned]);
    setNewGithubInput('');
  };

  const handleRemoveGithubAccount = (handleToRemove: string) => {
    setAdditionalGithubs((prev) => prev.filter((h) => h !== handleToRemove));
  };

  // Handle Password Update
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPw !== confirmPw) {
      setPwError('New passwords do not match. Please verify both fields.');
      return;
    }

    setPwBusy(true);
    setPwError(null);
    setPwSuccess(false);

    try {
      if (currentPw.trim() && user?.email) {
        try {
          await signInWithPassword(user.email, currentPw.trim());
        } catch {
          throw new Error('Current password is incorrect. Click "Reset via Email" if you cannot recall it.');
        }
      }
      await updatePassword(newPw);
      setPwSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      setPwError(err?.message || 'Failed to update password.');
    } finally {
      setPwBusy(false);
    }
  };

  // Handle Email Password Reset
  const handleEmailReset = async () => {
    if (!user?.email) {
      setPwError('No email associated with this account to send reset link.');
      return;
    }
    setResetBusy(true);
    setPwError(null);
    try {
      await resetPassword(user.email);
      setResetSent(true);
    } catch (err: any) {
      setPwError(err?.message || 'Failed to dispatch reset email.');
    } finally {
      setResetBusy(false);
    }
  };

  const activeTier = isSuperAdmin ? 'admin' : entitlements.tier;
  const isPro = activeTier === 'pro' || activeTier === 'admin' || activeTier === 'team';

  // Compute Clean 7-Capability Quota Rows
  const capabilityRows = useMemo(() => {
    // 1. Deep AST Code Audits
    const codeV = capabilityOf(entitlements, 'audit.deep_code');
    const codeLimit = isSuperAdmin ? 'unlimited' : (typeof codeV.limit === 'number' ? codeV.limit : 25);
    const codeRem = isSuperAdmin ? null : (codeV.remaining ?? 0);
    const codeUsed = isSuperAdmin ? 0 : (typeof codeLimit === 'number' && typeof codeRem === 'number' ? Math.max(0, codeLimit - codeRem) : 0);

    // 2. Profile & Repo Audits
    const auditV = capabilityOf(entitlements, 'audit.run');
    const auditLimit = isSuperAdmin ? 'unlimited' : (typeof auditV.limit === 'number' ? auditV.limit : 100);
    const auditRem = isSuperAdmin ? null : (auditV.remaining ?? 0);
    const auditUsed = isSuperAdmin ? 0 : (typeof auditLimit === 'number' && typeof auditRem === 'number' ? Math.max(0, auditLimit - auditRem) : 0);

    // 3. AI Resume Tailoring
    const tailorV = capabilityOf(entitlements, 'resume.tailor');
    const tailorLimit = isSuperAdmin ? 'unlimited' : (typeof tailorV.limit === 'number' ? tailorV.limit : 150);
    const tailorRem = isSuperAdmin ? null : (tailorV.remaining ?? 0);
    const tailorUsed = isSuperAdmin ? 0 : (typeof tailorLimit === 'number' && typeof tailorRem === 'number' ? Math.max(0, tailorLimit - tailorRem) : 0);

    // 4. Target Roles & JDs
    const roleV = capabilityOf(entitlements, 'target_role.create', rolesCount);
    const roleLimit = isSuperAdmin ? 'unlimited' : (typeof roleV.limit === 'number' ? roleV.limit : 50);
    const roleRem = isSuperAdmin ? null : (typeof roleLimit === 'number' ? Math.max(0, roleLimit - rolesCount) : null);

    // 5. Resumes in Vault
    const vaultV = capabilityOf(entitlements, 'resumes.vault', resumesCount);
    const vaultLimit = isSuperAdmin ? 'unlimited' : (typeof vaultV.limit === 'number' ? vaultV.limit : 20);
    const vaultRem = isSuperAdmin ? null : (typeof vaultLimit === 'number' ? Math.max(0, vaultLimit - resumesCount) : null);

    // 6. Defense & Behavioral Drills
    const defV = capabilityOf(entitlements, 'practice.defense');
    const defLimit = isSuperAdmin ? 'unlimited' : (typeof defV.limit === 'number' ? defV.limit : 50);
    const defRem = isSuperAdmin ? null : (defV.remaining ?? 0);
    const defUsed = isSuperAdmin ? 0 : (typeof defLimit === 'number' && typeof defRem === 'number' ? Math.max(0, defLimit - defRem) : 0);

    // 7. Published Verifiable Proof Links
    const proofV = capabilityOf(entitlements, 'proof.publish', proofsCount);
    const proofLimit = isSuperAdmin ? 'unlimited' : (typeof proofV.limit === 'number' ? proofV.limit : 10);
    const proofRem = isSuperAdmin ? null : (typeof proofLimit === 'number' ? Math.max(0, proofLimit - proofsCount) : null);

    return [
      {
        id: 'audit.deep_code',
        title: 'Deep AST Code Audits',
        category: 'Rolling 30-day window',
        icon: Icon.Code,
        used: codeUsed,
        limit: codeLimit,
        remaining: codeRem,
      },
      {
        id: 'audit.run',
        title: 'Profile & Repo Pre-Flight Audits',
        category: 'Rolling 30-day window',
        icon: Icon.Zap,
        used: auditUsed,
        limit: auditLimit,
        remaining: auditRem,
      },
      {
        id: 'resume.tailor',
        title: 'AI Resume Tailoring Runs',
        category: 'Rolling 30-day window',
        icon: Icon.Sparkle,
        used: tailorUsed,
        limit: tailorLimit,
        remaining: tailorRem,
      },
      {
        id: 'target_role.create',
        title: 'Target Roles & Pipeline Campaigns',
        category: 'Active tracking capacity',
        icon: Icon.Target,
        used: isSuperAdmin ? 0 : rolesCount,
        limit: roleLimit,
        remaining: roleRem,
      },
      {
        id: 'resumes.vault',
        title: 'Master Resumes in Vault',
        category: 'Immutable storage profiles',
        icon: Icon.FileText,
        used: isSuperAdmin ? 0 : resumesCount,
        limit: vaultLimit,
        remaining: vaultRem,
      },
      {
        id: 'practice.defense',
        title: 'Defense Hub Interview Drills',
        category: 'Rolling 30-day window',
        icon: Icon.Shield,
        used: defUsed,
        limit: defLimit,
        remaining: defRem,
      },
      {
        id: 'proof.publish',
        title: 'Published Proof Links',
        category: 'Verifiable candidate shares',
        icon: Icon.Link,
        used: isSuperAdmin ? 0 : proofsCount,
        limit: proofLimit,
        remaining: proofRem,
      },
    ];
  }, [entitlements, isSuperAdmin, rolesCount, resumesCount, proofsCount]);

  return (
    <div className="pb-24">
      <div className="mx-auto max-w-5xl space-y-8 px-4 pt-6 sm:pt-8 sm:px-6">
        {/* Header Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-edge bg-card p-6 shadow-card">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/50 to-transparent" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-signal/30 bg-signal/10 font-mono text-xl font-bold text-signal shadow-inner">
                {user?.email?.slice(0, 2).toUpperCase() || (primaryGithub ? primaryGithub.slice(0, 2).toUpperCase() : 'DEV')}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">Account Command Center</span>
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                    isSuperAdmin
                      ? 'border border-purple-500/30 bg-purple-500/15 text-purple-400'
                      : isPro
                      ? 'border border-signal/30 bg-signal/15 text-signal'
                      : 'border border-edge bg-well text-muted'
                  }`}>
                    {isSuperAdmin ? 'Super Admin' : activeTier === 'pro' ? 'Pro Plan' : 'Free Starter'}
                  </span>
                </div>
                <h1 className="font-sans text-2xl font-bold tracking-tight text-content sm:text-3xl">
                  {fullName || user?.email || (primaryGithub ? `@${primaryGithub}` : 'Developer Account')}
                </h1>
                <p className="font-mono text-xs text-muted">
                  {user?.email || 'Guest Workspace'} · Workspace Role: {isSuperAdmin ? 'Super Administrator' : 'Software Developer'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {!isPro && (
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white hover:bg-signal/90 transition-colors shadow-xs cursor-pointer"
                >
                  <Icon.Zap className="h-4 w-4" />
                  <span>Upgrade to Pro (৳৩৯৯/mo)</span>
                </button>
              )}
              {!user && (
                <button
                  type="button"
                  onClick={() => openSignIn()}
                  className="flex items-center gap-2 rounded-xl border border-edge bg-card px-4 py-2 font-mono text-xs font-semibold text-content hover:border-signal/50 hover:text-signal transition-colors cursor-pointer"
                >
                  <Icon.Lock className="h-4 w-4" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-8 flex items-center gap-1 border-t border-edge pt-4 overflow-x-auto thin-scroll">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'details'
                  ? 'bg-signal/15 text-signal border border-signal/30 shadow-2xs'
                  : 'text-muted hover:text-content hover:bg-well'
              }`}
            >
              <Icon.User className="h-3.5 w-3.5" />
              <span>Profile & Accounts</span>
            </button>

            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'security'
                  ? 'bg-signal/15 text-signal border border-signal/30 shadow-2xs'
                  : 'text-muted hover:text-content hover:bg-well'
              }`}
            >
              <Icon.Lock className="h-3.5 w-3.5" />
              <span>Password & Security</span>
            </button>

            <button
              onClick={() => setActiveTab('billing')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'billing'
                  ? 'bg-signal/15 text-signal border border-signal/30 shadow-2xs'
                  : 'text-muted hover:text-content hover:bg-well'
              }`}
            >
              <Icon.CreditCard className="h-3.5 w-3.5" />
              <span>Plans & Subscriptions</span>
            </button>

            <button
              onClick={() => setActiveTab('quotas')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'quotas'
                  ? 'bg-signal/15 text-signal border border-signal/30 shadow-2xs'
                  : 'text-muted hover:text-content hover:bg-well'
              }`}
            >
              <Icon.BarChart className="h-3.5 w-3.5" />
              <span>Capability Quotas Ledger</span>
            </button>
          </div>
        </div>

        {/* TAB 1: Profile & Identity */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            <form onSubmit={handleSaveProfile} className="rounded-2xl border border-edge bg-card p-6 shadow-card space-y-6">
              <div className="flex items-center justify-between border-b border-edge pb-4">
                <div>
                  <h2 className="font-mono text-sm font-bold text-content">Personal & Professional Identity</h2>
                  <p className="font-mono text-xs text-muted">Manage your primary identity, repositories, and linked profiles.</p>
                </div>
                {profileSaved && (
                  <span className="flex items-center gap-1.5 rounded-full border border-signal/40 bg-signal/15 px-3 py-1 font-mono text-xs font-bold text-signal">
                    <Icon.Check className="h-3.5 w-3.5" />
                    <span>Saved Successfully</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-semibold text-content">
                    Full Name / Preferred Display Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Alex Mercer"
                    className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content placeholder:text-muted/60 focus:border-signal focus:outline-none"
                  />
                </div>

                {/* Email (Read Only from Auth) */}
                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-semibold text-content">
                    Account Email Address
                  </label>
                  <input
                    type="email"
                    value={user?.email || 'anonymous@local'}
                    readOnly
                    className="w-full rounded-xl border border-edge bg-well/50 px-3.5 py-2 font-mono text-xs text-muted cursor-not-allowed"
                  />
                </div>
              </div>

              {/* GitHub Accounts Management */}
              <div className="space-y-4 border-t border-edge pt-5">
                <div>
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-content">
                    GitHub Accounts & Repositories
                  </h3>
                  <p className="font-mono text-xs text-muted">
                    Your code audits and commit proof can index your primary handle or secondary accounts (work, open source, freelancing).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Primary GitHub */}
                  <div className="space-y-1.5">
                    <label className="font-mono text-xs font-semibold text-content flex items-center justify-between">
                      <span>Primary GitHub Handle</span>
                      <span className="text-[10px] text-signal font-bold uppercase">Evaluated in Audits</span>
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-3 flex items-center font-mono text-xs text-muted select-none">
                        @
                      </span>
                      <input
                        type="text"
                        value={primaryGithub}
                        onChange={(e) => setPrimaryGithub(e.target.value)}
                        placeholder="username"
                        className="w-full rounded-xl border border-edge bg-well pl-7 pr-3.5 py-2 font-mono text-xs text-content placeholder:text-muted/60 focus:border-signal focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Add Secondary GitHub Accounts */}
                  <div className="space-y-1.5">
                    <label className="font-mono text-xs font-semibold text-content">
                      Link Additional GitHub Accounts
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute inset-y-0 left-3 flex items-center font-mono text-xs text-muted select-none">
                          @
                        </span>
                        <input
                          type="text"
                          value={newGithubInput}
                          onChange={(e) => setNewGithubInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddGithubAccount();
                            }
                          }}
                          placeholder="secondary-handle"
                          className="w-full rounded-xl border border-edge bg-well pl-7 pr-3.5 py-2 font-mono text-xs text-content placeholder:text-muted/60 focus:border-signal focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddGithubAccount}
                        className="rounded-xl border border-edge bg-well hover:border-signal/50 hover:text-signal px-3.5 py-2 font-mono text-xs font-bold transition-colors cursor-pointer"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Additional Handles Pill List */}
                {additionalGithubs.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="font-mono text-[10px] uppercase font-bold text-muted">
                      Linked Additional Accounts ({additionalGithubs.length}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {additionalGithubs.map((h) => (
                        <span
                          key={h}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-well px-3 py-1 font-mono text-xs text-content"
                        >
                          <Icon.Github className="h-3.5 w-3.5 text-signal" />
                          <span>@{h}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveGithubAccount(h)}
                            className="ml-1 text-muted hover:text-rose-500 cursor-pointer"
                            title="Remove account"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* External Profiles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-edge pt-5">
                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-semibold text-content">
                    LinkedIn Profile URL
                  </label>
                  <input
                    type="url"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content placeholder:text-muted/60 focus:border-signal focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-semibold text-content">
                    Personal Portfolio / Web URL
                  </label>
                  <input
                    type="url"
                    value={portfolioUrl}
                    onChange={(e) => setPortfolioUrl(e.target.value)}
                    placeholder="https://yourname.dev"
                    className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content placeholder:text-muted/60 focus:border-signal focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-edge">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-signal px-5 py-2.5 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-colors cursor-pointer"
                >
                  <Icon.Check className="h-4 w-4" />
                  <span>Save Profile Settings</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 2: Password & Security */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-edge bg-card p-6 shadow-card space-y-6">
              <div className="border-b border-edge pb-4">
                <h2 className="font-mono text-sm font-bold text-content">Password & Account Authentication</h2>
                <p className="font-mono text-xs text-muted">
                  Update your account password or request a secure magic reset link to your email.
                </p>
              </div>

              {pwSuccess && (
                <div className="flex items-center gap-2 rounded-xl border border-signal/40 bg-signal/10 px-4 py-3 font-mono text-xs text-signal">
                  <Icon.CheckCircle className="h-4 w-4 shrink-0" />
                  <span>Your password has been successfully updated. Next login will require your new credentials.</span>
                </div>
              )}

              {pwError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 font-mono text-xs text-rose-500">
                  <Icon.AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{pwError}</span>
                </div>
              )}

              {resetSent && (
                <div className="flex items-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/10 px-4 py-3 font-mono text-xs text-purple-400">
                  <Icon.Mail className="h-4 w-4 shrink-0" />
                  <span>A password reset link has been dispatched to {user?.email}. Check your inbox.</span>
                </div>
              )}

              <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-xs font-semibold text-content">
                      Current Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw(!showCurrentPw)}
                      className="font-mono text-[10px] text-muted hover:text-signal cursor-pointer"
                    >
                      {showCurrentPw ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-xs font-semibold text-content">
                      New Password (min 6 characters)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNewPw(!showNewPw)}
                      className="font-mono text-[10px] text-muted hover:text-signal cursor-pointer"
                    >
                      {showNewPw ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-semibold text-content">
                    Confirm New Password
                  </label>
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <button
                    type="submit"
                    disabled={pwBusy}
                    className="flex items-center gap-2 rounded-xl bg-signal px-5 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Icon.Lock className="h-3.5 w-3.5" />
                    <span>{pwBusy ? 'Updating Password…' : 'Update Password'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={resetBusy}
                    onClick={handleEmailReset}
                    className="rounded-xl border border-edge bg-well px-4 py-2 font-mono text-xs font-semibold text-muted hover:border-signal/50 hover:text-signal transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {resetBusy ? 'Dispatching…' : 'Forgot? Reset via Email'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: Plans & Subscriptions */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-edge bg-card p-6 shadow-card space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-edge pb-4">
                <div>
                  <h2 className="font-mono text-sm font-bold text-content">Current Plan & Billing Cycle</h2>
                  <p className="font-mono text-xs text-muted">
                    Manage your active subscription, upgrade tiers, or review billing renewal dates.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">Billing Cycle:</span>
                  <span className="rounded-full border border-signal/30 bg-signal/10 px-2.5 py-0.5 font-mono text-xs font-bold text-signal">
                    Rolling 30-Day Auto-Reset
                  </span>
                </div>
              </div>

              {/* Plan Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Free Starter */}
                <div className={`rounded-2xl border p-5 space-y-4 ${
                  !isPro ? 'border-signal/50 bg-signal/5 shadow-2xs' : 'border-edge bg-well/40'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-sans text-lg font-bold text-content">Free Starter</h3>
                      <p className="font-mono text-xs text-muted">Individual proof evaluation</p>
                    </div>
                    {!isPro && (
                      <span className="rounded-full border border-signal/40 bg-signal/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-signal uppercase tracking-wider">
                        Current Active Plan
                      </span>
                    )}
                  </div>
                  <div className="font-sans text-2xl font-bold text-content">
                    $0 <span className="font-mono text-xs font-normal text-muted">/ forever</span>
                  </div>
                  <ul className="space-y-2 font-mono text-xs text-muted">
                    <li className="flex items-center gap-2">
                      <Icon.Check className="h-3.5 w-3.5 text-signal" />
                      <span>1 deep AST code audit / 30-day window</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Icon.Check className="h-3.5 w-3.5 text-signal" />
                      <span>1 Target Role tracked in pipeline</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Icon.Check className="h-3.5 w-3.5 text-signal" />
                      <span>2 immutable resume master profiles</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Icon.Check className="h-3.5 w-3.5 text-signal" />
                      <span>Living Portfolio SSOT master studio</span>
                    </li>
                  </ul>
                </div>

                {/* Developer Pro */}
                <div className={`rounded-2xl border p-5 space-y-4 ${
                  isPro ? 'border-signal bg-signal/10 shadow-card' : 'border-edge bg-card hover:border-signal/40 transition-colors'
                }`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-sans text-lg font-bold text-content">Developer Pro</h3>
                      <p className="font-mono text-xs text-signal font-semibold">Uncapped job search campaign</p>
                    </div>
                    {isPro ? (
                      <span className="rounded-full border border-signal bg-signal px-2.5 py-0.5 font-mono text-[10px] font-bold text-white uppercase tracking-wider">
                        Current Active Plan
                      </span>
                    ) : (
                      <span className="rounded-full border border-signal/30 bg-signal/10 px-2 py-0.5 font-mono text-[10px] font-bold text-signal uppercase">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="font-sans text-2xl font-bold text-content">
                    ৳৩৯৯ <span className="font-mono text-xs font-normal text-muted">/ month (~$3.99)</span>
                  </div>
                  <ul className="space-y-2 font-mono text-xs text-content">
                    <li className="flex items-center gap-2">
                      <Icon.Check className="h-3.5 w-3.5 text-signal" />
                      <span className="font-bold">10 deep AST audits</span> per rolling 30-day window
                    </li>
                    <li className="flex items-center gap-2">
                      <Icon.Check className="h-3.5 w-3.5 text-signal" />
                      <span className="font-bold">Unlimited</span> Target Roles & job pipeline tracking
                    </li>
                    <li className="flex items-center gap-2">
                      <Icon.Check className="h-3.5 w-3.5 text-signal" />
                      <span className="font-bold">Unlimited</span> JD ↔ Resume tailored variants
                    </li>
                    <li className="flex items-center gap-2">
                      <Icon.Check className="h-3.5 w-3.5 text-signal" />
                      <span className="font-bold">Unlimited</span> Defense Hub interview probe simulations
                    </li>
                  </ul>

                  {!isPro && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlan('pro_monthly');
                        setIsUpgradeModalOpen(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-signal py-2.5 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-colors cursor-pointer"
                    >
                      <Icon.Zap className="h-4 w-4" />
                      <span>Upgrade via bKash / Nagad</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Clean, Minimalist Capability Quotas Ledger */}
        {activeTab === 'quotas' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-edge bg-card p-6 shadow-card space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-edge pb-4">
                <div>
                  <h2 className="font-mono text-sm font-bold text-content">Platform Usage & Capability Ledger</h2>
                  <p className="font-mono text-xs text-muted">
                    Honest counter across all 7 capabilities. Monthly allowances reset every 30 days.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                    isSuperAdmin
                      ? 'border border-purple-500/30 bg-purple-500/15 text-purple-400'
                      : isPro
                      ? 'border border-signal/30 bg-signal/15 text-signal'
                      : 'border border-edge bg-well text-muted'
                  }`}>
                    {isSuperAdmin ? 'Super Admin (Uncapped)' : isPro ? 'Developer Pro Tier' : 'Free Starter Tier'}
                  </span>
                </div>
              </div>

              {/* Clean Capability Rows */}
              <div className="divide-y divide-edge/40">
                {capabilityRows.map((item) => {
                  const ItemIcon = item.icon;
                  const isInfinite = isSuperAdmin || item.limit === 'unlimited';
                  const pct = isInfinite
                    ? 0
                    : Math.min(100, Math.round((item.used / (typeof item.limit === 'number' ? Math.max(1, item.limit) : 1)) * 100));

                  return (
                    <div
                      key={item.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-well/30 px-3 rounded-xl transition-colors"
                    >
                      {/* Left: Icon & Name */}
                      <div className="flex items-center gap-3 min-w-[240px]">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-well shrink-0">
                          <ItemIcon className="h-4 w-4 text-signal" />
                        </div>
                        <div>
                          <div className="font-mono text-xs font-bold text-content">{item.title}</div>
                          <div className="font-mono text-[10px] text-muted">{item.category}</div>
                        </div>
                      </div>

                      {/* Center: Slim Progress Bar */}
                      <div className="flex-1 max-w-sm space-y-1">
                        <div className="flex justify-between font-mono text-[10px] text-muted">
                          <span>{isInfinite ? 'Unlimited Allowance' : `${item.used} of ${item.limit} used`}</span>
                          {!isInfinite && <span>{pct}%</span>}
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-well overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-400' : 'bg-signal'
                            }`}
                            style={{ width: isInfinite ? '10%' : `${pct}%` }}
                          />
                        </div>
                      </div>

                      {/* Right: Badge */}
                      <div className="flex sm:justify-end min-w-[110px]">
                        {isInfinite ? (
                          <span className="font-mono text-[10px] font-bold uppercase text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
                            Uncapped (∞)
                          </span>
                        ) : item.remaining !== null && item.remaining <= 0 ? (
                          <span className="font-mono text-[10px] font-bold uppercase text-rose-500 bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 rounded-full">
                            0 left
                          </span>
                        ) : item.remaining !== null && item.remaining === 1 ? (
                          <span className="font-mono text-[10px] font-bold uppercase text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                            1 left
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                            {item.remaining} left
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Subtle Note */}
              <div className="border-t border-edge/60 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono text-[11px] text-muted">
                <span>Your work is never locked or removed. Limits only apply to creating new evaluations.</span>
                {!isPro && (
                  <button
                    type="button"
                    onClick={() => setIsUpgradeModalOpen(true)}
                    className="font-bold text-signal hover:underline cursor-pointer"
                  >
                    Upgrade for 10x Audits & Unlimited Roles →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Modal */}
      {isUpgradeModalOpen && (
        <BkashNagadModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          defaultPlan={selectedPlan}
        />
      )}
    </div>
  );
}

export default function DeveloperProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-canvas font-mono text-sm text-muted">
          Loading Account Settings…
        </div>
      }
    >
      <DeveloperProfileContent />
    </Suspense>
  );
}
