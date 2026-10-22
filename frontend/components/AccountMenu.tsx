'use client';

/**
 * Account Menu (Header Popover)
 * Streamlined, lightweight profile dropdown:
 * - User identity chip
 * - Link to full Account & Settings center (/developer/profile)
 * - Living Portfolio SSOT link
 * - Workspace switcher (Admin)
 * - Sign out
 */

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { useSession } from '@/components/SessionProvider';
import { useEntitlements } from '@/hooks/useEntitlements';
import { isAdmin } from '@/lib/admin';

export function AccountMenu({ workspace }: { workspace?: 'developer' | 'recruiter' } = {}) {
  const { user, loading, openSignIn, signOut } = useSession();
  const { entitlements } = useEntitlements();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const effectiveWorkspace = workspace || (user?.role === 'recruiter' ? 'recruiter' : 'developer');
  const paid = entitlements.tier === 'pro' || entitlements.tier === 'team';
  const isSuperAdmin = isAdmin(user);

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
        className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-[#ea580c]/30 dark:border-signal/40 bg-[#ea580c]/5 dark:bg-signal/10 px-3 py-1.5 font-mono text-xs font-semibold text-[#ea580c] dark:text-signal shadow-xs transition-colors hover:bg-[#ea580c]/10 dark:hover:bg-signal/20 outline-none focus-visible:ring-2 focus-visible:ring-signal/40 cursor-pointer"
      >
        <Icon.Lock className="h-3.5 w-3.5 shrink-0" />
        <span>Sign in</span>
      </button>
    );
  }

  const label = user.handle || user.email?.split('@')[0] || user.id.slice(0, 8);
  const initials = label.slice(0, 2).toUpperCase();

  const tierDisplay = isSuperAdmin
    ? 'Super Admin'
    : paid
      ? entitlements.tier === 'pro'
        ? 'Developer Pro'
        : 'Team'
      : 'Free Starter';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-xl border border-edge bg-card px-2.5 py-1.5 shadow-xs transition-colors hover:border-signal/50 outline-none focus-visible:ring-2 focus-visible:ring-signal/40 cursor-pointer"
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
          className="fade-up absolute right-0 top-full z-40 mt-2 w-56 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-edge bg-card shadow-card"
        >
          {/* Identity Header */}
          <div className="border-b border-edge px-3.5 py-2.5 bg-well/40">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
                Account
              </span>
              <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                isSuperAdmin
                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                  : paid
                  ? 'bg-signal/15 text-signal border border-signal/30'
                  : 'bg-edge text-muted'
              }`}>
                {tierDisplay}
              </span>
            </div>
            <div className="mt-1 font-mono text-xs font-bold text-content truncate">
              {user.name || `@${label}`}
            </div>
            {user.email && (
              <div className="truncate font-mono text-[11px] text-muted">
                {user.email}
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <div className="p-1.5 space-y-1">
            {/* When on Home page (no workspace specified), provide the single primary portal access link */}
            {!workspace && (
              <Link
                href={user.role === 'recruiter' ? '/recruiter' : '/developer'}
                prefetch={true}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg px-2.5 py-2 font-mono text-xs font-bold text-signal bg-signal/10 hover:bg-signal/20 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Icon.Briefcase className="h-4 w-4 shrink-0 text-signal" />
                  <span>{user.role === 'recruiter' ? 'RecruiterOS Portal' : 'Developer CareerOS'}</span>
                </div>
                <Icon.ArrowRight className="h-3.5 w-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}

            <Link
              href="/developer/profile"
              prefetch={true}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-mono text-xs font-medium text-content hover:bg-well hover:text-signal transition-colors group"
            >
              <Icon.Settings className="h-4 w-4 text-muted group-hover:text-signal shrink-0 transition-colors" />
              <span>Account & Settings</span>
            </Link>

            {isSuperAdmin && workspace !== 'recruiter' && (
              <Link
                href="/recruiter"
                prefetch={true}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-mono text-xs font-medium text-[#ea580c] hover:bg-[#ea580c]/10 transition-colors group"
              >
                <Icon.Briefcase className="h-4 w-4 text-[#ea580c] shrink-0" />
                <span>RecruiterOS Portal</span>
              </Link>
            )}

            {isSuperAdmin && workspace === 'recruiter' && (
              <Link
                href="/developer"
                prefetch={true}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-mono text-xs font-medium text-signal hover:bg-signal/10 transition-colors group"
              >
                <Icon.Code className="h-4 w-4 text-signal shrink-0" />
                <span>Developer CareerOS</span>
              </Link>
            )}
          </div>

          {/* Sign Out */}
          <div className="border-t border-edge p-1.5 bg-well/20">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 font-mono text-xs text-muted hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer"
            >
              <Icon.LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
