'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { GitGrillLogo } from '@/components/GitGrillLogo';
import { ThemeToggle } from '@/lib/theme';
import { AccountMenu } from '@/components/AccountMenu';
import { useSession } from '@/components/SessionProvider';
import { isAdmin } from '@/lib/admin';
import { getDeveloperProfile } from '@/lib/workspace-profiles';
import { CareerQuotaHUD } from '@/components/CareerQuotaHUD';
import { BkashNagadModal } from '@/components/BkashNagadModal';
import { PlanId } from '@/lib/billing';

export default function DeveloperProfilePage() {
  const { user, openSignIn } = useSession();
  const isSuperAdmin = isAdmin(user);
  const [devProfile, setDevProfile] = useState<ReturnType<typeof getDeveloperProfile> | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('pro_monthly');

  useEffect(() => {
    setDevProfile(getDeveloperProfile());
  }, []);

  return (
    <main className="page-texture min-h-screen bg-canvas text-content pb-24 transition-colors">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-30 border-b border-edge bg-card/90 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-3.5 transition-colors">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/" className="shrink-0 flex items-center">
              <GitGrillLogo size="sm" />
            </Link>
            <span className="text-edge">/</span>
            <Link href="/developer" className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity">
              <span className="shrink-0 rounded border border-signal/30 bg-signal/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-signal">
                CareerOS
              </span>
              <span className="font-mono text-xs text-muted truncate">
                Command Center
              </span>
            </Link>
            <span className="text-edge">/</span>
            <span className="font-mono text-xs font-semibold text-content truncate">
              Profile & Limits
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <AccountMenu workspace="developer" />
            <ThemeToggle />
            <Link
              href="/developer"
              className="rounded-lg border border-edge bg-card px-2.5 sm:px-3 py-1.5 font-mono text-xs text-muted shadow-xs transition-colors hover:border-signal/50 hover:text-signal"
            >
              ← Back to Workspace
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl space-y-8 px-4 pt-6 sm:pt-8 sm:px-6">
        {/* Profile Card */}
        <div className="relative overflow-hidden rounded-2xl border border-edge bg-card p-6 shadow-card">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/50 to-transparent" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-signal/30 bg-signal/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-signal">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                  Developer Profile & Tier Ledger
                </span>
                {isSuperAdmin && (
                  <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-purple-400">
                    Super Admin
                  </span>
                )}
              </div>
              <h1 className="font-sans text-2xl font-bold tracking-tight text-content">
                {user?.email || (devProfile?.githubUsername ? `@${devProfile.githubUsername}` : 'Developer Account')}
              </h1>
              <p className="font-sans text-xs text-muted leading-relaxed">
                Review your real-time consumption quotas, rolling 30-day limits, and active tier benefits.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {!user && (
                <button
                  type="button"
                  onClick={() => openSignIn()}
                  className="flex items-center gap-2 rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white hover:bg-signal/90 transition-colors shadow-xs"
                >
                  <Icon.User className="h-4 w-4" />
                  <span>Sign In / Create Account</span>
                </button>
              )}
              {user && !isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-signal to-signal/90 px-4 py-2 font-mono text-xs font-bold text-white hover:scale-[1.02] transition-all shadow-xs"
                >
                  <Icon.Sparkle className="h-4 w-4" />
                  <span>Upgrade via bKash / Nagad</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Account Badges */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-edge pt-5">
            <div className="rounded-xl border border-edge bg-well p-3.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">Authentication</span>
              <div className="mt-1 font-mono text-xs text-content font-semibold truncate">
                {user ? user.email || 'Authenticated' : 'Anonymous / Guest'}
              </div>
            </div>

            <div className="rounded-xl border border-edge bg-well p-3.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">Linked GitHub</span>
              <div className="mt-1 font-mono text-xs text-content font-semibold truncate">
                {devProfile?.githubUsername ? `@${devProfile.githubUsername.replace(/^@/, '')}` : 'Not linked'}
              </div>
            </div>

            <div className="rounded-xl border border-edge bg-well p-3.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">Workspace Role</span>
              <div className="mt-1 font-mono text-xs text-signal font-semibold uppercase">
                {isSuperAdmin ? 'Super Administrator' : user?.role || 'Developer'}
              </div>
            </div>
          </div>
        </div>

        {/* Detailed 7-Capability Quota Ledger */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm font-bold text-content">Capability Quota & Ledger Matrix</h2>
            <span className="font-mono text-xs text-muted">Rolling 30-day reset</span>
          </div>

          <CareerQuotaHUD
            username={devProfile?.githubUsername}
            variant="full"
          />
        </div>
      </div>

      {/* Upgrade MFS Modal */}
      {isUpgradeModalOpen && (
        <BkashNagadModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          defaultPlan={selectedPlan}
        />
      )}
    </main>
  );
}
