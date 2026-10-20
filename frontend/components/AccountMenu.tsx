'use client';

/**
 * Account control for both workspace navs (M24B). Signed out: a sign-in
 * button (opens the auth modal). Signed in: identity chip with a dropdown —
 * workspace context switcher (Developer / Recruiter routes) + sign out.
 * The two contexts share the account, never the data (red line, §4).
 */

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { useSession } from '@/components/SessionProvider';
import { useEntitlements } from '@/hooks/useEntitlements';
import { createPortal } from 'react-dom';
import { PLANS, startPortal, BillingError } from '@/lib/billing';
import { isAdmin } from '@/lib/admin';
import { updatePassword, signInWithPassword, resetPassword } from '@/lib/auth';
import { BkashNagadModal } from '@/components/BkashNagadModal';

export function AccountMenu({ workspace }: { workspace?: 'developer' | 'recruiter' } = {}) {
  const { user, loading, openSignIn, signOut } = useSession();
  const { entitlements } = useEntitlements();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const effectiveWorkspace = workspace || (user?.role === 'recruiter' ? 'recruiter' : 'developer');
  const workspaceRoute = effectiveWorkspace === 'recruiter' ? '/recruiter' : '/developer';

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);

  const [billingBusy, setBillingBusy] = useState(false);
  const [billingNote, setBillingNote] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const paid = entitlements.tier === 'pro' || entitlements.tier === 'team';
  const isSuperAdmin = isAdmin(user);

  useEffect(() => {
    setMounted(true);
  }, []);

  function openPasswordModal() {
    setOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwError(null);
    setPwSuccess(false);
    setForgotSent(false);
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    setShowPasswordModal(true);
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match. Please verify both fields.');
      return;
    }

    setPwBusy(true);
    setPwError(null);
    try {
      // If user supplied a current password, verify it first
      if (currentPassword.trim() && user?.email) {
        try {
          await signInWithPassword(user.email, currentPassword.trim());
        } catch {
          throw new Error('Current password is incorrect. If you forgot your password, click "Forgot current password?" to reset it via email.');
        }
      }
      await updatePassword(newPassword);
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err?.message || 'Failed to update password.');
    } finally {
      setPwBusy(false);
    }
  }

  async function handleSendResetEmail() {
    if (!user?.email) return;
    setForgotBusy(true);
    setPwError(null);
    try {
      await resetPassword(user.email);
      setForgotSent(true);
    } catch (err: any) {
      setPwError(err?.message || 'Failed to send password reset email.');
    } finally {
      setForgotBusy(false);
    }
  }

  /** Self-serve billing: the portal handles cancel, plan change for existing paid users. */
  async function handleBilling() {
    if (!paid) {
      setShowPaymentModal(true);
      setOpen(false);
      return;
    }
    setBillingBusy(true);
    setBillingNote(null);
    try {
      const { url } = await startPortal();
      window.location.href = url;
    } catch (err) {
      setBillingNote(
        err instanceof BillingError && err.notConfigured
          ? 'Billing portal is not configured on this deployment.'
          : err instanceof Error
            ? err.message
            : 'Billing unavailable.'
      );
      setBillingBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (loading) {
    return (
      <div className="h-[30px] w-20 animate-pulse rounded-lg border border-edge bg-well" />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={openSignIn}
        className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#ea580c]/30 dark:border-signal/40 bg-[#ea580c]/5 dark:bg-signal/10 px-3 py-1.5 font-mono text-xs font-semibold text-[#ea580c] dark:text-signal shadow-xs transition-colors hover:bg-[#ea580c]/10 dark:hover:bg-signal/20 outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
      >
        <Icon.Lock className="h-3.5 w-3.5 shrink-0" />
        <span>Sign in</span>
      </button>
    );
  }

  const label = user.handle || user.email?.split('@')[0] || user.id.slice(0, 8);
  const initials = label.slice(0, 2).toUpperCase();

  // Tier display label: if user is logged in, tier should never show 'anonymous'
  const tierDisplay = isSuperAdmin
    ? 'Super Admin (Uncapped)'
    : paid
      ? entitlements.tier === 'pro'
        ? 'Developer Pro'
        : 'Team'
      : 'Free Starter';

  return (
    <>
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex items-center gap-2 rounded-xl border border-edge bg-card px-2.5 py-1.5 shadow-xs transition-colors hover:border-signal/50 outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-signal/30 bg-signal/10 font-mono text-xs font-bold text-signal">
            {initials}
          </span>
          <span className="hidden md:block font-mono text-xs font-bold text-content">
            @{label}
          </span>
          <Icon.ChevronDown className={`h-3 w-3 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div
            role="menu"
            className="fade-up absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-edge bg-card shadow-card"
          >
            {/* Signed-in identity chip */}
            <div className="border-b border-edge px-3.5 py-2.5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Signed in as
              </div>
              <div className="mt-0.5 truncate font-mono text-xs font-semibold text-content">
                {user.email || `@${label}`}
              </div>
            </div>

            {/* Dedicated Workspace Badges */}
            <div className="p-1.5 space-y-1">
              <div className="px-2 pb-1 pt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                {isSuperAdmin ? 'Workspaces (All-Access)' : 'Active Space'}
              </div>

              {isSuperAdmin ? (
                <>
                  <Link
                    href="/developer"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-mono text-xs font-semibold transition-all group ${
                      workspace === 'developer'
                        ? 'bg-signal/20 text-signal border border-signal/30'
                        : 'hover:bg-well text-content'
                    }`}
                    title="Developer CareerOS Workspace"
                  >
                    <Icon.Github className="h-3.5 w-3.5 text-signal shrink-0" />
                    <span className="flex-1">Developer CareerOS</span>
                    <span className="rounded bg-signal/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-signal">
                      CareerOS
                    </span>
                  </Link>

                  <Link
                    href="/recruiter"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-mono text-xs font-semibold transition-all group ${
                      workspace === 'recruiter'
                        ? 'bg-[#ea580c]/20 text-[#ea580c] border border-[#ea580c]/30'
                        : 'hover:bg-well text-content'
                    }`}
                    title="RecruiterOS Portal"
                  >
                    <Icon.Briefcase className="h-3.5 w-3.5 text-[#ea580c] shrink-0" />
                    <span className="flex-1 text-[#ea580c]">RecruiterOS Portal</span>
                    <span className="rounded bg-[#ea580c]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#ea580c]">
                      Unlimited
                    </span>
                  </Link>

                  <Link
                    href="/admin/billing"
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-lg border border-[#ea580c]/25 bg-[#ea580c]/5 hover:bg-[#ea580c]/15 px-2.5 py-1.5 font-mono text-xs text-[#ea580c] transition-colors"
                  >
                    <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-[#ea580c]/20 font-bold text-[9px]">৳</span>
                    <span className="flex-1 font-semibold">Super Admin Console</span>
                    <span className="rounded bg-[#ea580c]/20 px-1.5 py-0.5 text-[8px] uppercase font-bold">Admin</span>
                  </Link>
                </>
              ) : (
                <Link
                  href={workspaceRoute}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-lg bg-signal/10 hover:bg-signal/20 px-2.5 py-1.5 font-mono text-xs text-signal font-semibold transition-all group"
                  title="Go to active workspace"
                >
                  {effectiveWorkspace === 'recruiter' ? (
                    <>
                      <Icon.Briefcase className="h-3.5 w-3.5 text-[#ea580c]" />
                      <span className="flex-1 text-[#ea580c]">RecruiterOS</span>
                      <span className="rounded bg-[#ea580c]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#ea580c]">Recruiter</span>
                    </>
                  ) : (
                    <>
                      <Icon.Github className="h-3.5 w-3.5" />
                      <span className="flex-1">Developer CareerOS</span>
                      <span className="rounded bg-signal/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">Developer</span>
                    </>
                  )}
                  <Icon.ArrowRight className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Link>
              )}
            </div>

            {/* Plan & Upgrade Section */}
            <div className="border-t border-edge p-1.5">
              <div className="flex items-center justify-between px-2 pb-1 pt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                <span>Platform Tier</span>
                <span className={`font-semibold ${isSuperAdmin ? 'text-signal' : paid ? 'text-signal' : 'text-content'}`}>{tierDisplay}</span>
              </div>
              {isSuperAdmin ? (
                <div className="flex items-center gap-2 rounded-lg bg-signal/10 px-2.5 py-1.5 font-mono text-xs text-signal font-semibold">
                  <Icon.Shield className="h-3.5 w-3.5 text-signal shrink-0" />
                  <span className="flex-1">Full Unlimited Platform Access</span>
                </div>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  disabled={billingBusy}
                  onClick={() => void handleBilling()}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-xs text-content transition-colors hover:bg-well hover:text-signal disabled:opacity-60"
                >
                  <Icon.Zap className="h-3.5 w-3.5 text-[#ea580c] dark:text-signal" />
                  <span className="flex-1 text-left font-semibold">
                    {billingBusy
                      ? 'Opening…'
                      : paid
                        ? 'Manage billing'
                        : 'Upgrade to Pro — ৳399/mo'}
                  </span>
                </button>
              )}
              {billingNote && (
                <p className="px-2 pb-1 font-mono text-[10px] leading-relaxed text-muted">
                  {billingNote}
                </p>
              )}
            </div>

            {/* Password & Security */}
            <div className="border-t border-edge p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={openPasswordModal}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-xs text-content transition-colors hover:bg-well hover:text-signal"
              >
                <Icon.Lock className="h-3.5 w-3.5" />
                <span>Password & Security</span>
              </button>
            </div>

            {/* Sign Out */}
            <div className="border-t border-edge p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-xs text-muted transition-colors hover:bg-well hover:text-rose-500"
              >
                <Icon.LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Set / Change Password Modal (Portaled to body to prevent sticky header clipping) */}
      {showPasswordModal && mounted && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowPasswordModal(false)}
        >
          <div
            className="fade-up relative w-full max-w-[380px] my-auto rounded-2xl border border-edge bg-card p-5 sm:p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-mono text-sm font-bold text-content flex items-center gap-2">
                  <Icon.Lock className="h-4 w-4 text-signal" />
                  <span>Password & Security</span>
                </h3>
                <p className="font-sans text-xs text-muted mt-1">
                  Manage your direct sign-in credentials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="text-muted hover:text-content p-1 rounded-lg hover:bg-well transition-colors"
                aria-label="Close"
              >
                <Icon.X className="h-4 w-4" />
              </button>
            </div>

            {pwSuccess ? (
              <div className="py-4 text-center space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 shadow-xs">
                  <Icon.Check className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-emerald-500 font-mono text-xs font-bold">
                    Password updated successfully
                  </div>
                  <p className="mt-1 font-sans text-xs text-muted leading-relaxed">
                    You can now use your email and new password to log in directly.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="w-full rounded-xl bg-signal py-2 font-mono text-xs font-semibold text-white shadow-xs hover:brightness-105"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handlePasswordUpdate} className="space-y-3.5">
                {forgotSent && (
                  <div className="rounded-xl border border-signal/30 bg-signal/10 p-2.5 font-sans text-xs text-content flex items-start gap-2">
                    <Icon.Mail className="h-4 w-4 text-signal shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted leading-relaxed">
                      Reset link sent to <strong className="text-content font-mono">{user?.email}</strong>. Check your inbox to change your password without entering the old one.
                    </p>
                  </div>
                )}

                {pwError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 font-mono text-xs text-rose-500 leading-relaxed">
                    {pwError}
                  </div>
                )}

                {/* Current Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Current Password
                    </label>
                    <button
                      type="button"
                      disabled={forgotBusy}
                      onClick={handleSendResetEmail}
                      className="font-mono text-[10px] text-signal hover:underline disabled:opacity-50"
                    >
                      {forgotBusy ? 'Sending…' : 'Forgot?'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-edge bg-well/60 px-3 py-2 focus-within:border-signal focus-within:bg-card focus-within:ring-2 focus-within:ring-signal/15 transition-all">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Leave blank if first time"
                      className="w-full bg-transparent font-mono text-xs text-content placeholder:text-muted/50 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      className="text-muted hover:text-content p-0.5"
                      tabIndex={-1}
                    >
                      {showCurrentPw ? <Icon.EyeOff className="h-3.5 w-3.5" /> : <Icon.Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* New Password Field */}
                <div>
                  <label className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
                    New Password
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-edge bg-well/60 px-3 py-2 focus-within:border-signal focus-within:bg-card focus-within:ring-2 focus-within:ring-signal/15 transition-all">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full bg-transparent font-mono text-xs text-content placeholder:text-muted/50 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      className="text-muted hover:text-content p-0.5"
                      tabIndex={-1}
                    >
                      {showNewPw ? <Icon.EyeOff className="h-3.5 w-3.5" /> : <Icon.Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password Field */}
                <div>
                  <label className="block font-mono text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Confirm Password
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-edge bg-well/60 px-3 py-2 focus-within:border-signal focus-within:bg-card focus-within:ring-2 focus-within:ring-signal/15 transition-all">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full bg-transparent font-mono text-xs text-content placeholder:text-muted/50 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      className="text-muted hover:text-content p-0.5"
                      tabIndex={-1}
                    >
                      {showConfirmPw ? <Icon.EyeOff className="h-3.5 w-3.5" /> : <Icon.Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 rounded-xl border border-edge bg-well px-3 py-2 font-mono text-xs font-semibold text-content hover:bg-card transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pwBusy || newPassword.length < 6 || newPassword !== confirmPassword}
                    className="flex-1 rounded-xl bg-signal px-3 py-2 font-mono text-xs font-semibold text-white shadow-xs hover:brightness-105 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                  >
                    {pwBusy ? (
                      <>
                        <Icon.Spinner className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving…</span>
                      </>
                    ) : (
                      <span>Save Password</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Unified Payment Modal for bKash/Nagad & Cards */}
      <BkashNagadModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        defaultPlan="pro_monthly"
      />
    </>
  );
}
