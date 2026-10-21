'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { useSession } from '@/components/SessionProvider';
import { useEntitlements } from '@/hooks/useEntitlements';
import { capabilityOf } from '@/lib/entitlements';
import { isAdmin } from '@/lib/admin';
import { getResumes } from '@/lib/resumes';
import { getTargetRoles } from '@/lib/target-roles';
import { listPublishedProofs, ProofMeta } from '@/lib/proof-pages';
import { BkashNagadModal } from './BkashNagadModal';
import { PlanId } from '@/lib/billing';

interface CapabilityCardData {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Icon;
  used: number;
  limit: number | 'unlimited';
  remaining: number | null;
  per?: string;
  resetAt?: string | null;
  status: 'healthy' | 'warning' | 'exhausted' | 'unlimited';
  subtext?: string;
}

export function CareerQuotaHUD({
  username,
  variant = 'compact',
}: {
  username?: string;
  variant?: 'compact' | 'full';
}) {
  const { user, openSignIn } = useSession();
  const { entitlements } = useEntitlements();
  const isSuperAdmin = isAdmin(user);

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [selectedPlanForUpgrade, setSelectedPlanForUpgrade] = useState<PlanId>('pro_monthly');
  const [isExpandedInline, setIsExpandedInline] = useState(false);
  const [resumesCount, setResumesCount] = useState(0);
  const [rolesCount, setRolesCount] = useState(0);
  const [proofsCount, setProofsCount] = useState(0);

  // Sync client-side counters (resumes, roles, proof links)
  useEffect(() => {
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

    if (username) {
      listPublishedProofs(username)
        .then((list) => setProofsCount(list.length))
        .catch(() => setProofsCount(0));
    }
  }, [username]);

  const activeTier = isSuperAdmin ? 'admin' : (entitlements?.tier ?? 'free');

  // Compute metrics for the 7 capabilities
  const cards: CapabilityCardData[] = useMemo(() => {
    // 1. Resumes in Vault
    const vaultVerdict = capabilityOf(entitlements, 'resumes.vault', resumesCount);
    const vaultLimit = isSuperAdmin ? 'unlimited' : (typeof vaultVerdict.limit === 'number' ? vaultVerdict.limit : 20);
    const vaultRemaining = isSuperAdmin ? null : (typeof vaultLimit === 'number' ? Math.max(0, vaultLimit - resumesCount) : null);

    // 2. Target Roles & JDs
    const roleVerdict = capabilityOf(entitlements, 'target_role.create', rolesCount);
    const roleLimit = isSuperAdmin ? 'unlimited' : (typeof roleVerdict.limit === 'number' ? roleVerdict.limit : 50);
    const roleRemaining = isSuperAdmin ? null : (typeof roleLimit === 'number' ? Math.max(0, roleLimit - rolesCount) : null);

    // 3. Profile & Repo Audits (Rolling 30d)
    const auditVerdict = capabilityOf(entitlements, 'audit.run');
    const auditLimit = isSuperAdmin ? 'unlimited' : (typeof auditVerdict.limit === 'number' ? auditVerdict.limit : 100);
    const auditRem = isSuperAdmin ? null : (auditVerdict.remaining ?? 0);
    const auditUsed = isSuperAdmin ? 0 : (typeof auditLimit === 'number' && typeof auditRem === 'number' ? Math.max(0, auditLimit - auditRem) : 0);

    // 4. Deep AST Code Audits (Rolling 30d)
    const codeVerdict = capabilityOf(entitlements, 'audit.deep_code');
    const codeLimit = isSuperAdmin ? 'unlimited' : (typeof codeVerdict.limit === 'number' ? codeVerdict.limit : 25);
    const codeRem = isSuperAdmin ? null : (codeVerdict.remaining ?? 0);
    const codeUsed = isSuperAdmin ? 0 : (typeof codeLimit === 'number' && typeof codeRem === 'number' ? Math.max(0, codeLimit - codeRem) : 0);

    // 5. AI Resume Tailoring Runs (Rolling 30d)
    const tailorVerdict = capabilityOf(entitlements, 'resume.tailor');
    const tailorLimit = isSuperAdmin ? 'unlimited' : (typeof tailorVerdict.limit === 'number' ? tailorVerdict.limit : 150);
    const tailorRem = isSuperAdmin ? null : (tailorVerdict.remaining ?? 0);
    const tailorUsed = isSuperAdmin ? 0 : (typeof tailorLimit === 'number' && typeof tailorRem === 'number' ? Math.max(0, tailorLimit - tailorRem) : 0);

    // 6. Defense & Behavioral Drills (Rolling 30d)
    const defenseVerdict = capabilityOf(entitlements, 'practice.defense');
    const defenseLimit = isSuperAdmin ? 'unlimited' : (typeof defenseVerdict.limit === 'number' ? defenseVerdict.limit : 50);
    const defenseRem = isSuperAdmin ? null : (defenseVerdict.remaining ?? 0);
    const defenseUsed = isSuperAdmin ? 0 : (typeof defenseLimit === 'number' && typeof defenseRem === 'number' ? Math.max(0, defenseLimit - defenseRem) : 0);

    // 7. Published Verifiable Proof Links
    const proofVerdict = capabilityOf(entitlements, 'proof.publish', proofsCount);
    const proofLimit = isSuperAdmin ? 'unlimited' : (typeof proofVerdict.limit === 'number' ? proofVerdict.limit : 10);
    const proofRemaining = isSuperAdmin ? null : (typeof proofLimit === 'number' ? Math.max(0, proofLimit - proofsCount) : null);

    const helperStatus = (used: number, limit: number | 'unlimited', rem: number | null): CapabilityCardData['status'] => {
      if (isSuperAdmin || limit === 'unlimited') return 'unlimited';
      if (rem !== null && rem <= 0) return 'exhausted';
      if (rem !== null && rem <= Math.max(1, Math.round(limit * 0.15))) return 'warning';
      return 'healthy';
    };

    return [
      {
        id: 'resumes.vault',
        title: 'Resumes in Vault',
        description: 'Multi-variant resume profiles & ATS diagnostic snapshots',
        icon: 'FileText',
        used: isSuperAdmin ? 0 : resumesCount,
        limit: vaultLimit,
        remaining: vaultRemaining,
        status: helperStatus(resumesCount, vaultLimit, vaultRemaining),
        subtext: isSuperAdmin ? 'Unlimited resume vault' : `${resumesCount} profile${resumesCount === 1 ? '' : 's'} stored`,
      },
      {
        id: 'target_role.create',
        title: 'Target Roles & JDs',
        description: 'Active target company benchmarks & gap analyses',
        icon: 'Target',
        used: isSuperAdmin ? 0 : rolesCount,
        limit: roleLimit,
        remaining: roleRemaining,
        status: helperStatus(rolesCount, roleLimit, roleRemaining),
        subtext: isSuperAdmin ? 'Unlimited campaign roles' : `${rolesCount} role${rolesCount === 1 ? '' : 's'} active`,
      },
      {
        id: 'audit.run',
        title: 'Profile & Repo Audits',
        description: 'Comprehensive code, repository & profile evaluations',
        icon: 'Zap',
        used: auditUsed,
        limit: auditLimit,
        remaining: auditRem,
        per: '30d',
        resetAt: auditVerdict.resetAt,
        status: helperStatus(auditUsed, auditLimit, auditRem),
        subtext: 'Rolling 30-day window',
      },
      {
        id: 'audit.deep_code',
        title: 'Deep AST Code Audits',
        description: 'Architecture, cyclomatic complexity & refactor audits',
        icon: 'Code',
        used: codeUsed,
        limit: codeLimit,
        remaining: codeRem,
        per: '30d',
        resetAt: codeVerdict.resetAt,
        status: helperStatus(codeUsed, codeLimit, codeRem),
        subtext: 'Rolling 30-day window',
      },
      {
        id: 'resume.tailor',
        title: 'AI Resume Tailoring',
        description: 'Role-specific bullet restructuring & JD alignment',
        icon: 'Sparkle',
        used: tailorUsed,
        limit: tailorLimit,
        remaining: tailorRem,
        per: '30d',
        resetAt: tailorVerdict.resetAt,
        status: helperStatus(tailorUsed, tailorLimit, tailorRem),
        subtext: 'Rolling 30-day window',
      },
      {
        id: 'practice.defense',
        title: 'Behavioral & Defense Drills',
        description: 'Scenario defense, system trade-offs & interview drills',
        icon: 'Layers',
        used: defenseUsed,
        limit: defenseLimit,
        remaining: defenseRem,
        per: '30d',
        resetAt: defenseVerdict.resetAt,
        status: helperStatus(defenseUsed, defenseLimit, defenseRem),
        subtext: 'Rolling 30-day window',
      },
      {
        id: 'proof.publish',
        title: 'Published Proof Links',
        description: 'Verifiable public engineering proof links for recruiters',
        icon: 'Shield',
        used: isSuperAdmin ? 0 : proofsCount,
        limit: proofLimit,
        remaining: proofRemaining,
        status: helperStatus(proofsCount, proofLimit, proofRemaining),
        subtext: isSuperAdmin ? 'Unbranded & unrestricted' : proofVerdict.branded ? 'Branded badge' : 'Unbranded public link',
      },
    ];
  }, [entitlements, isSuperAdmin, resumesCount, rolesCount, proofsCount]);

  const handleOpenUpgrade = (plan: PlanId = 'pro_monthly') => {
    setSelectedPlanForUpgrade(plan);
    setIsUpgradeModalOpen(true);
  };

  // 1. Anonymous / Signed-Out Visitor: Clean Guest Banner (Zero exhausted error cards!)
  if (!user) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-edge bg-card/80 p-3.5 sm:px-5 sm:py-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-signal/30 bg-signal/10 text-signal">
            <Icon.Sparkle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-content">Guest Sandbox Mode</span>
              <span className="rounded bg-well px-1.5 py-0.5 font-mono text-[9px] text-muted uppercase">Local Storage</span>
            </div>
            <p className="font-sans text-[11px] text-muted truncate">
              You are exploring CareerOS locally. Sign in to cloud-sync your target roles, defense cards, and audits across devices.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openSignIn()}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-signal px-3.5 py-1.5 font-mono text-xs font-bold text-white shadow-xs transition-colors hover:bg-signal/90 shrink-0 cursor-pointer"
        >
          <Icon.User className="h-3.5 w-3.5" />
          <span>Sign In to Cloud Sync</span>
        </button>
      </div>
    );
  }

  // 7-Card Matrix Grid Renderer
  const renderCardsGrid = () => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const IconComp = Icon[card.icon] || Icon.Zap;
        const isInfinite = card.limit === 'unlimited';
        const percentUsed =
          !isInfinite && typeof card.limit === 'number' && card.limit > 0
            ? Math.min(100, Math.round((card.used / card.limit) * 100))
            : 0;

        return (
          <div
            key={card.id}
            className={`group relative flex flex-col justify-between rounded-xl border p-3.5 transition-all duration-200 hover:border-signal/40 ${
              card.status === 'exhausted'
                ? 'border-signal/60 bg-signal/5'
                : card.status === 'warning'
                  ? 'border-amber-500/50 bg-amber-500/5'
                  : 'border-edge bg-card/60 hover:bg-card'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                      card.status === 'exhausted'
                        ? 'border-signal/40 bg-signal/10 text-signal'
                        : card.status === 'warning'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                          : isInfinite
                            ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                            : 'border-edge bg-well text-muted group-hover:text-signal'
                    }`}
                  >
                    <IconComp className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-mono text-xs font-bold text-content">
                    {card.title}
                  </span>
                </div>

                {isInfinite ? (
                  <span className="font-mono text-[10px] font-semibold text-purple-400">
                    &infin; Uncapped
                  </span>
                ) : card.status === 'exhausted' ? (
                  <span className="rounded bg-signal/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-signal">
                    Exhausted
                  </span>
                ) : card.status === 'warning' ? (
                  <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-400">
                    Low Quota
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-muted">
                    {card.subtext}
                  </span>
                )}
              </div>

              <p className="mt-1.5 line-clamp-2 font-sans text-[11px] leading-snug text-muted">
                {card.description}
              </p>
            </div>

            <div className="mt-3.5 pt-2 border-t border-edge/40">
              <div className="flex items-baseline justify-between font-mono text-xs">
                {isInfinite ? (
                  <span className="text-base font-bold text-purple-400">&infin; / &infin;</span>
                ) : (
                  <span className="font-bold text-content">
                    {card.used}
                    <span className="text-muted font-normal"> / {card.limit} used</span>
                  </span>
                )}

                {!isInfinite && card.remaining !== null && (
                  <span
                    className={`text-[11px] font-semibold ${
                      card.status === 'exhausted'
                        ? 'text-signal'
                        : card.status === 'warning'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {card.remaining} left
                  </span>
                )}
              </div>

              {!isInfinite && typeof card.limit === 'number' && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-edge/60">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      card.status === 'exhausted'
                        ? 'bg-signal'
                        : card.status === 'warning'
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, percentUsed)}%` }}
                  />
                </div>
              )}

              {card.resetAt && !isInfinite && (
                <div className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-muted">
                  <Icon.Refresh className="h-2.5 w-2.5" />
                  <span>
                    Refills{' '}
                    {new Date(card.resetAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // 2. Compact View for Main DeveloperOS Workspace: Ultra-clean 44px status ribbon
  if (variant === 'compact') {
    return (
      <>
        <section id="career-quota-hud" className="rounded-2xl border border-edge bg-card/90 p-3 sm:px-4 sm:py-2.5 shadow-card transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left: Tier Badge + Key Metrics */}
            <div className="flex flex-wrap items-center gap-2.5 min-w-0">
              <div className="flex items-center gap-1.5 shrink-0">
                {isSuperAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-purple-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                    Super Admin (∞)
                  </span>
                ) : activeTier === 'pro' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Pro Tier
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-signal/30 bg-signal/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-signal">
                    Free Tier
                  </span>
                )}
              </div>

              <div className="h-3 w-px bg-edge hidden xs:block" />

              <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted">
                <span className="flex items-center gap-1">
                  <span className="text-content font-bold">{rolesCount}</span>
                  <span className="text-[11px]">roles</span>
                </span>
                <span className="text-edge">·</span>
                <span className="flex items-center gap-1">
                  <span className="text-content font-bold">{resumesCount}</span>
                  <span className="text-[11px]">resumes</span>
                </span>
                <span className="text-edge">·</span>
                <span className="flex items-center gap-1">
                  <span className="text-content font-bold">
                    {isSuperAdmin ? '∞' : `${cards[2].used}/${cards[2].limit}`}
                  </span>
                  <span className="text-[11px]">audits</span>
                </span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              {!isSuperAdmin && activeTier !== 'pro' && (
                <button
                  type="button"
                  onClick={() => handleOpenUpgrade('pro_monthly')}
                  className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-signal to-signal/90 px-2.5 py-1 font-mono text-[11px] font-bold text-white shadow-2xs hover:scale-[1.02] transition-transform cursor-pointer"
                >
                  <Icon.Sparkle className="h-3 w-3" />
                  <span>Upgrade</span>
                </button>
              )}

              <Link
                href="/developer/profile"
                className="inline-flex items-center gap-1 rounded-lg border border-edge bg-well px-2.5 py-1 font-mono text-[11px] font-semibold text-content hover:border-signal/50 hover:text-signal transition-colors"
              >
                <span>Full Quotas & Limits</span>
                <Icon.ArrowRight className="h-3 w-3" />
              </Link>

              <button
                type="button"
                onClick={() => setIsExpandedInline(!isExpandedInline)}
                className="flex items-center gap-1 rounded-lg border border-edge bg-well px-2 py-1 font-mono text-[11px] text-muted hover:text-content transition-colors cursor-pointer"
                title={isExpandedInline ? 'Collapse inline view' : 'Quick peek cards'}
              >
                <Icon.ChevronDown className={`h-3 w-3 transition-transform ${isExpandedInline ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Inline Expandable Peek */}
          {isExpandedInline && (
            <div className="mt-4 pt-4 border-t border-edge">
              {renderCardsGrid()}
            </div>
          )}
        </section>

        {isUpgradeModalOpen && (
          <BkashNagadModal
            isOpen={isUpgradeModalOpen}
            onClose={() => setIsUpgradeModalOpen(false)}
            defaultPlan={selectedPlanForUpgrade}
          />
        )}
      </>
    );
  }

  // 3. Full View (Used on /developer/profile)
  return (
    <>
      <section id="career-quota-hud" className="relative scroll-mt-20 overflow-hidden rounded-2xl border border-edge bg-gradient-to-b from-card via-card/95 to-canvas p-4 sm:p-5 shadow-card transition-all">
        {/* Ambient Top Glow Accent */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${
            isSuperAdmin
              ? 'from-amber-500 via-purple-500 to-signal'
              : activeTier === 'pro'
                ? 'from-emerald-500 via-signal to-sky-500'
                : 'from-signal/60 via-signal to-amber-500'
          }`}
        />

        {/* HUD Header Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-edge/60 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                isSuperAdmin
                  ? 'border-purple-500/40 bg-purple-500/10 text-purple-400'
                  : activeTier === 'pro'
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : 'border-signal/40 bg-signal/10 text-signal'
              }`}
            >
              {isSuperAdmin ? (
                <Icon.Shield className="h-5 w-5" />
              ) : activeTier === 'pro' ? (
                <Icon.Sparkle className="h-5 w-5" />
              ) : (
                <Icon.Zap className="h-5 w-5" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-mono text-sm font-bold tracking-tight text-content">
                  CareerOS Quota & Consumption HUD
                </h2>
                {isSuperAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-purple-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                    Super Admin (∞)
                  </span>
                ) : activeTier === 'pro' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Pro Tier
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-signal/30 bg-signal/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-signal">
                    Free Tier
                  </span>
                )}
              </div>
              <p className="font-sans text-xs text-muted">
                {isSuperAdmin
                  ? 'All 7 capability meters unlocked with zero rate-limits or paywalls.'
                  : 'Real-time ledger meters for AI audits, resume tailoring, and interview drills.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            {!isSuperAdmin && activeTier !== 'pro' && (
              <button
                type="button"
                onClick={() => handleOpenUpgrade('pro_monthly')}
                className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-signal to-signal/90 px-3.5 py-1.5 font-mono text-xs font-bold text-white shadow-xs transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Icon.Sparkle className="h-3.5 w-3.5 shrink-0" />
                <span>Upgrade to Pro (৳399/mo)</span>
              </button>
            )}
          </div>
        </div>

        {/* Super Admin Notice */}
        {isSuperAdmin && (
          <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent p-3 sm:px-4 sm:py-2.5">
            <div className="flex items-center gap-2.5">
              <Icon.Shield className="h-4 w-4 text-purple-400 shrink-0" />
              <div className="font-mono text-xs text-purple-200">
                <span className="font-bold">Super Admin Privilege Active:</span> All 7 developer capabilities run in unrestricted bypass mode with infinite quota (&infin;).
              </div>
            </div>
            <span className="hidden sm:inline font-mono text-[11px] text-purple-400/80 shrink-0">
              Zero quota deductions recorded
            </span>
          </div>
        )}

        {/* 7 Capability Quota Grid */}
        <div className="mt-4">
          {renderCardsGrid()}
        </div>

        {/* Footer info strip */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-edge/40 pt-3 font-mono text-[11px] text-muted">
          <div className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Direct backend ledger connection &bull; No cached limit gates</span>
          </div>

          {!isSuperAdmin && activeTier !== 'pro' && (
            <div className="flex items-center gap-2">
              <span>Need 50 target roles & 150 AI tailorings?</span>
              <button
                type="button"
                onClick={() => handleOpenUpgrade('pro_monthly')}
                className="font-bold text-signal underline underline-offset-2 hover:text-signal/80 cursor-pointer"
              >
                Upgrade via bKash / Nagad &rarr;
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Embedded One-Click bKash / Nagad Upgrade Modal */}
      <BkashNagadModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        defaultPlan={selectedPlanForUpgrade}
        onSuccess={() => {
          setIsUpgradeModalOpen(false);
        }}
      />
    </>
  );
}
