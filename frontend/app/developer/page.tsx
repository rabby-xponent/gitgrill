'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/lib/theme';
import { getDeveloperProfile } from '@/lib/workspace-profiles';
import { ProofPagesCard } from '@/components/ProofPagesCard';
import { AccountMenu } from '@/components/AccountMenu';
import { QuotaMeter } from '@/components/QuotaMeter';
import { CheckoutNotice } from '@/components/CheckoutNotice';
import { useCapabilityLock } from '@/components/FeatureLock';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Icon } from '@/components/icons';
import { GitGrillLogo } from '@/components/GitGrillLogo';
import { Select, SearchInput, ConfirmModal, AlertModal } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import NewTargetRoleModal from '@/components/NewTargetRoleModal';
import DefenseHub from '@/components/DefenseHub';
import { ResumeVault } from '@/components/ResumeVault';
import { ResumeTailorModal } from '@/components/ResumeTailorModal';
import { JDResumeMatchmaker } from '@/components/JDResumeMatchmaker';
import { CareerQuotaHUD } from '@/components/CareerQuotaHUD';
import {
  TargetRole,
  ApplicationStatus,
  getTargetRoles,
  saveTargetRole,
  deleteTargetRole,
  getActiveTargetRoleId,
  setActiveTargetRoleId,
  latestAudit,
  fitDelta,
  computeProofStrength,
  aggregateGaps,
  aggregateUnverified,
  generateEvidenceTasks,
  syncDefenseCards,
  DefenseCard,
  APPLICATION_STATUS_META,
} from '@/lib/target-roles';

const STATUS_SELECT_OPTIONS: SelectOption[] = (
  Object.keys(APPLICATION_STATUS_META) as ApplicationStatus[]
).map((s) => ({ value: s, label: APPLICATION_STATUS_META[s].label }));

function DeveloperCareerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [devProfile, setDevProfile] = useState<ReturnType<typeof getDeveloperProfile> | null>(null);
  const [roles, setRoles] = useState<TargetRole[]>([]);
  const [activeRoleId, setActiveRoleId] = useState('');
  const [showNewRoleModal, setShowNewRoleModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [defenseCards, setDefenseCards] = useState<DefenseCard[]>([]);
  const [activeTab, setActiveTab] = useState<'roles' | 'resumes' | 'matchmaker'>('roles');
  const [selectedTailorRole, setSelectedTailorRole] = useState<TargetRole | null>(null);
  const [roleToRemove, setRoleToRemove] = useState<{ id: string; title: string } | null>(null);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; description: string; variant?: 'error' | 'info' | 'warning' }>({
    isOpen: false,
    title: '',
    description: '',
  });

  // Entitlements (M25A): the meter and every lock chip below read verdicts from
  // the backend tier registry — the browser never decides a limit itself.
  const { entitlements } = useEntitlements();

  useEffect(() => {
    setDevProfile(getDeveloperProfile());
    const list = getTargetRoles();
    setRoles(list);
    setDefenseCards(syncDefenseCards(list));

    const queryRole = searchParams.get('roleId');
    if (queryRole && list.some((r) => r.id === queryRole)) {
      setActiveRoleId(queryRole);
      setActiveTargetRoleId(queryRole);
    } else {
      setActiveRoleId(getActiveTargetRoleId());
    }
  }, [searchParams]);

  const refreshRoles = () => {
    const list = getTargetRoles();
    setRoles(list);
    setDefenseCards(syncDefenseCards(list));
  };

  const activeRole = roles.find((r) => r.id === activeRoleId) || roles[0];
  const proof = useMemo(() => computeProofStrength(roles), [roles]);
  const gaps = useMemo(() => aggregateGaps(roles), [roles]);
  const unverified = useMemo(() => aggregateUnverified(roles), [roles]);
  const tasks = useMemo(() => generateEvidenceTasks(roles), [roles]);

  const filteredRoles = useMemo(() => {
    let list = [...roles];
    if (statusFilter !== 'all') {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.company.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q)
      );
    }
    return list;
  }, [roles, statusFilter, searchQuery]);

  const handleSelectRole = (id: string) => {
    setActiveRoleId(id);
    setActiveTargetRoleId(id);
  };

  const handleStatusChange = (id: string, status: ApplicationStatus) => {
    const role = roles.find((r) => r.id === id);
    if (!role) return;
    saveTargetRole({ ...role, status });
    refreshRoles();
  };

  const handleRemoveRole = (id: string, title: string) => {
    setRoleToRemove({ id, title });
  };

  const handlePreFlight = (role?: TargetRole) => {
    const handle = devProfile?.githubUsername?.trim().replace(/^@/, '');
    if (!handle) {
      setAlertModal({
        isOpen: true,
        title: 'GitHub Handle Required',
        description: 'Set your GitHub username in this command center first — pre-flight audits evaluate your proof against your active repository profile.',
        variant: 'warning',
      });
      return;
    }
    const params = new URLSearchParams({ mode: 'developer' });
    params.set('targetRoleId', (role || activeRole)?.id || '');
    router.push(`/profile/${encodeURIComponent(handle)}?${params.toString()}`);
  };

  // `target_role.create` (1 on Free, unlimited on Pro). Existing roles stay
  // fully usable when locked — only adding a new one is gated (§6).
  const roleLock = useCapabilityLock(entitlements, 'target_role.create', roles.length);
  const atRoleLimit = roleLock.locked;

  const handleAddRole = () => {
    if (atRoleLimit) {
      roleLock.onRequest();
      return;
    }
    setShowNewRoleModal(true);
  };

  if (!devProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas font-mono text-sm text-muted">
        Loading CareerOS Workspace…
      </div>
    );
  }

  const strengthLabel =
    proof.score >= 80 ? 'Strong' : proof.score >= 60 ? 'Competitive' : proof.score > 0 ? 'Building' : 'Not assessed';

  return (
    <main className="page-texture min-h-screen bg-canvas text-content pb-24 transition-colors">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-30 border-b border-edge bg-card/90 backdrop-blur-md px-6 py-3.5 transition-colors">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="shrink-0">
              <GitGrillLogo size="sm" />
            </Link>
            <span className="text-edge">/</span>
            <div className="flex items-center gap-2">
              <span className="rounded border border-signal/30 bg-signal/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-signal">
                CareerOS
              </span>
              <span className="hidden sm:inline font-mono text-xs text-muted">
                Engineering Job Search Command Center
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <QuotaMeter />
            <AccountMenu workspace="developer" />
            <ThemeToggle />
            <Link
              href="/"
              className="rounded-lg border border-edge bg-card px-3 py-1.5 font-mono text-xs text-muted shadow-xs transition-colors hover:border-signal/50 hover:text-signal"
            >
              ← Public Home
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl space-y-8 px-4 pt-8 sm:px-6">
        <CheckoutNotice />
        {/* Welcome + Identity Card */}
        <div className="relative flex flex-col justify-between gap-5 overflow-hidden rounded-2xl border border-edge bg-card p-6 shadow-card sm:p-7 md:flex-row md:items-center">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/50 to-transparent" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-signal/30 bg-signal/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-signal">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                Welcome back{devProfile.githubUsername ? `, @${devProfile.githubUsername.replace(/^@/, '')}` : ''}
              </span>
              <span className="font-mono text-xs text-muted">Job search campaign</span>
            </div>
            <h1 className="font-sans text-2xl font-bold tracking-tight text-content sm:text-3xl">
              Developer Career OS
            </h1>
            <p className="max-w-2xl font-sans text-xs leading-relaxed text-muted">
              Track every role you&apos;re chasing, audit yourself against each JD before you apply,
              close the gaps GitGrill finds, and watch your fit scores move as your evidence grows.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-xl border border-edge bg-well px-3.5 py-2 transition-colors focus-within:border-signal focus-within:ring-2 focus-within:ring-signal/15">
              <span className="font-mono text-sm font-bold text-signal">@</span>
              <input
                type="text"
                defaultValue={devProfile.githubUsername}
                placeholder="your-github-username"
                onChange={(e) => {
                  const v = e.target.value;
                  setDevProfile((p) => (p ? { ...p, githubUsername: v } : p));
                }}
                onBlur={(e) => {
                  import('@/lib/workspace-profiles').then(({ saveDeveloperProfile }) => {
                    saveDeveloperProfile({ githubUsername: e.target.value.trim().replace(/^@/, '') });
                  });
                }}
                className="w-44 bg-transparent font-mono text-sm text-content outline-none placeholder:text-muted/60"
              />
            </div>
            <button
              onClick={handleAddRole}
              title={atRoleLimit ? roleLock.verdict.reason || undefined : undefined}
              className="flex items-center gap-1.5 rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white shadow-xs transition-colors hover:bg-signal/90 outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
            >
              <Icon.Plus className="h-3.5 w-3.5" />
              <span>Add Target Role</span>
              {atRoleLimit && roleLock.lock}
            </button>
          </div>
        </div>

        {/* Developer CareerOS Quota & Consumption HUD */}
        <CareerQuotaHUD username={devProfile.githubUsername} />

        {/* Workspace Mode Switcher Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all ${
                activeTab === 'roles'
                  ? 'border border-signal/40 bg-signal/10 text-signal shadow-xs'
                  : 'border border-transparent text-muted hover:border-edge hover:bg-card hover:text-content'
              }`}
            >
              <Icon.Target className="h-4 w-4" />
              <span>Target Roles & Campaigns</span>
              <span className="ml-1 rounded-full bg-signal/20 px-2 py-0.5 font-mono text-[10px]">
                {roles.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('resumes')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all ${
                activeTab === 'resumes'
                  ? 'border border-signal/40 bg-signal/10 text-signal shadow-xs'
                  : 'border border-transparent text-muted hover:border-edge hover:bg-card hover:text-content'
              }`}
            >
              <Icon.FileText className="h-4 w-4" />
              <span>Resume Vault & Diagnostics</span>
              <span className="ml-1 rounded-full bg-signal/20 px-2 py-0.5 font-mono text-[10px] text-signal uppercase tracking-wider">
                AI Audit
              </span>
            </button>

            <button
              onClick={() => setActiveTab('matchmaker')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs font-bold transition-all ${
                activeTab === 'matchmaker'
                  ? 'border border-signal/40 bg-signal/10 text-signal shadow-xs'
                  : 'border border-transparent text-muted hover:border-edge hover:bg-card hover:text-content'
              }`}
            >
              <Icon.Sparkle className="h-4 w-4" />
              <span>JD ↔ Resume Matchmaker</span>
              <span className="ml-1 rounded-full bg-signal/20 px-2 py-0.5 font-mono text-[10px] text-signal uppercase tracking-wider font-bold">
                Combined
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-muted">
            <Icon.Sparkle className="h-3.5 w-3.5 text-signal" />
            <span>Positioning & Evidence for Private & NDA Developers</span>
          </div>
        </div>

        {activeTab === 'resumes' ? (
          <ResumeVault />
        ) : activeTab === 'matchmaker' ? (
          <JDResumeMatchmaker
            initialRoleId={activeRoleId}
            onNavigateToRole={(rId) => {
              setActiveRoleId(rId);
              setActiveTab('roles');
            }}
            onNavigateToResume={() => {
              setActiveTab('resumes');
            }}
          />
        ) : (
          <>
            {/* Proof Strength + Quick Stats */}
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-4">
          <div className="rounded-2xl border border-edge bg-card p-5 shadow-card lg:col-span-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-signal font-bold">
                Proof Strength
              </span>
              <span className="font-mono text-[10px] text-muted">{strengthLabel}</span>
            </div>
            <div className="mt-3 flex items-end gap-3">
              <span className="font-mono text-5xl font-extrabold text-content">
                {proof.auditedRoles > 0 ? proof.score : '—'}
              </span>
              <span className="pb-1.5 font-mono text-xs text-muted">
                {proof.auditedRoles > 0 ? '/ 100' : 'run your first audit'}
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-edge">
              <div
                className="h-full rounded-full bg-signal transition-all duration-700"
                style={{ width: `${proof.score}%` }}
              />
            </div>
            <p className="mt-3 font-sans text-[11px] leading-relaxed text-muted">
              Composite of your latest fit scores, verified-requirement breadth, and the share of
              claims backed by public evidence. Improves as you close gaps — not by editing a resume.
            </p>
          </div>

          <div className="rounded-2xl border border-edge bg-card p-5 shadow-card">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
              Target Roles
            </div>
            <div className="mt-2 font-mono text-3xl font-extrabold text-content">{roles.length}</div>
            <div className="mt-1 font-mono text-[11px] text-muted">
              {proof.auditedRoles} audited · {roles.length - proof.auditedRoles} pending
            </div>
          </div>

          <div className="rounded-2xl border border-edge bg-card p-5 shadow-card">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
              Open Gaps
            </div>
            <div className="mt-2 font-mono text-3xl font-extrabold text-content">{proof.totalGaps}</div>
            <div className="mt-1 font-mono text-[11px] text-muted">
              {proof.totalUnverified} unverified claim{proof.totalUnverified === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        {/* Target Roles Board */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-lg font-bold text-content">Target Roles</h2>
              <span className="font-mono text-xs text-muted">({roles.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search roles…"
                className="w-44"
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All statuses' },
                  ...STATUS_SELECT_OPTIONS,
                ]}
                ariaLabel="Filter by status"
                className="w-40"
              />
            </div>
          </div>

          {filteredRoles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-edge bg-card p-10 text-center shadow-card">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-edge bg-well text-muted">
                <Icon.Target className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-mono text-sm font-bold text-content">
                {roles.length === 0 ? 'No target roles yet' : 'No roles match this filter'}
              </h3>
              <p className="mx-auto mt-1 max-w-sm font-sans text-xs leading-relaxed text-muted">
                {roles.length === 0
                  ? 'Add the job you\'re chasing next. GitGrill audits you against its exact requirements and tracks your progress across the whole campaign.'
                  : 'Try clearing the search or status filter.'}
              </p>
              {roles.length === 0 && (
                <button
                  onClick={() => setShowNewRoleModal(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white transition-colors hover:bg-signal/90"
                >
                  <Icon.Plus className="h-3.5 w-3.5" />
                  Add your first target role
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              {filteredRoles.map((role) => {
                const audit = latestAudit(role);
                const delta = fitDelta(role);
                const isActive = role.id === activeRole?.id;
                return (
                  <div
                    key={role.id}
                    onClick={() => handleSelectRole(role.id)}
                    className={`group relative cursor-pointer rounded-xl border p-4 transition-all ${
                      isActive
                        ? 'border-signal bg-card bg-gradient-to-br from-signal/[0.08] to-signal/[0.02] shadow-card ring-2 ring-signal/25'
                        : 'border-edge bg-card shadow-card hover:border-signal/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded border border-edge bg-well px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
                            {role.company}
                          </span>
                          {delta !== null && delta > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-signal">
                              <Icon.ArrowUp className="h-2.5 w-2.5" />
                              {delta} pts
                            </span>
                          )}
                        </div>
                        <h3 className={`mt-1.5 truncate font-mono text-sm font-bold ${isActive ? 'text-signal' : 'text-content'}`}>
                          {role.title}
                        </h3>
                      </div>

                      <div className="flex flex-none flex-col items-end gap-1">
                        {audit ? (
                          <>
                            <span className="rounded-lg border border-signal/35 bg-signal/10 px-2 py-0.5 font-mono text-xs font-bold text-signal">
                              {audit.fitScore}%
                            </span>
                            <span className="font-mono text-[9px] text-muted">
                              {audit.metCount} met · {audit.missingCount} gaps
                            </span>
                          </>
                        ) : (
                          <span className="rounded-lg border border-edge bg-well px-2 py-0.5 font-mono text-[10px] text-muted">
                            Not audited
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-edge pt-2.5">
                      <Select
                        value={role.status}
                        onChange={(v) => handleStatusChange(role.id, v as ApplicationStatus)}
                        options={STATUS_SELECT_OPTIONS}
                        ariaLabel={`Status for ${role.title}`}
                        buttonClassName="py-0.5 text-[10px]"
                        className="w-36"
                      />
                      <div className="flex items-center gap-1.5">
                        {role.proofUrl && (
                          <a
                            href={role.proofUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-signal/35 bg-signal/10 text-signal transition-colors hover:bg-signal/20"
                            title={`Proof page live · snapshot v${role.proofVersion || 1}`}
                          >
                            <Icon.Link className="h-3 w-3" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRole(role.id);
                            setActiveTab('matchmaker');
                          }}
                          className="flex items-center gap-1 rounded-lg border border-signal/35 bg-signal/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-signal transition-colors hover:bg-signal/20 cursor-pointer"
                          title="Match and rank your resumes against this JD"
                        >
                          <Icon.Sparkle className="h-3 w-3" />
                          <span>Match Resumes</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreFlight(role);
                          }}
                          className="flex items-center gap-1 rounded-lg border border-edge bg-well px-2.5 py-1 font-mono text-[11px] font-semibold text-content transition-colors hover:border-signal/60 hover:text-signal"
                          title="Run pre-flight audit against this role"
                        >
                          <Icon.Zap className="h-3 w-3" />
                          Pre-Flight
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRole(role.id, role.title);
                          }}
                          className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border border-edge bg-card text-muted transition-colors hover:border-rose-400/60 hover:text-rose-500"
                          title="Remove role"
                        >
                          <Icon.X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Proof Pages (published, shareable evidence links) */}
        <ProofPagesCard
          username={devProfile?.githubUsername?.trim().replace(/^@/, '') || ''}
          roles={roles}
        />

        {/* Skill Gap Radar + Unverified Claims */}
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
          <div className="rounded-2xl border border-edge bg-card p-6 shadow-card">
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h2 className="font-mono text-base font-bold text-content">Skill Gap Radar</h2>
              <span className="font-mono text-[10px] text-muted">aggregated across roles</span>
            </div>
            {gaps.length === 0 ? (
              <p className="mt-4 font-sans text-xs leading-relaxed text-muted">
                Run pre-flight audits against your target roles — recurring gaps will surface here,
                ranked by how often they block you.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {gaps.slice(0, 6).map((gap) => (
                  <li key={gap.skill} className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-well px-3 py-2">
                    <span className="min-w-0 truncate font-mono text-xs text-content">{gap.skill}</span>
                    <span className="flex-none rounded border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-signal">
                      {gap.count} role{gap.count > 1 ? 's' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-edge bg-card p-6 shadow-card">
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h2 className="font-mono text-base font-bold text-content">Unverified Claims</h2>
              <span className="font-mono text-[10px] text-muted">probe-ready skills</span>
            </div>
            {unverified.length === 0 ? (
              <p className="mt-4 font-sans text-xs leading-relaxed text-muted">
                Skills the agent could not verify from your public artifacts will collect here —
                these are exactly what interviewers probe. Close them with evidence or practice.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {unverified.slice(0, 6).map((u) => (
                  <li key={u.skill} className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-well px-3 py-2">
                    <span className="min-w-0 truncate font-mono text-xs text-content">{u.skill}</span>
                    <span className="flex-none font-mono text-[9px] text-muted">probe-ready</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Interview Defense Hub (practice deck) */}
        <DefenseHub cards={defenseCards} />

        {/* Evidence-Building Tasks */}
        {tasks.length > 0 && (
          <div className="rounded-2xl border border-edge bg-card p-6 shadow-card">
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <h2 className="font-mono text-base font-bold text-content">Next Evidence Moves</h2>
              <span className="font-mono text-[10px] text-muted">derived from your gaps</span>
            </div>
            <ol className="mt-3 space-y-2.5">
              {tasks.map((task, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl border border-edge bg-well p-3.5">
                  <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-signal/30 bg-signal/10 font-mono text-[10px] font-bold text-signal">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-semibold text-content">{task.title}</div>
                    <p className="mt-1 font-sans text-[11px] leading-relaxed text-muted">{task.why}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
          </>
        )}
      </div>

      {/* New Target Role Modal */}
      {showNewRoleModal && (
        <NewTargetRoleModal
          isOpen={showNewRoleModal}
          onClose={() => setShowNewRoleModal(false)}
          onCreate={() => refreshRoles()}
        />
      )}

      {/* Resume Tailoring Studio Modal */}
      {selectedTailorRole && (
        <ResumeTailorModal
          role={selectedTailorRole}
          onClose={() => setSelectedTailorRole(null)}
        />
      )}

      {/* Role Deletion Confirm Modal */}
      {roleToRemove && (
        <ConfirmModal
          isOpen={!!roleToRemove}
          onClose={() => setRoleToRemove(null)}
          onConfirm={() => {
            if (roleToRemove) {
              deleteTargetRole(roleToRemove.id);
              refreshRoles();
              setRoleToRemove(null);
            }
          }}
          title="Remove Target Role?"
          description={
            <div className="space-y-2 font-sans text-xs">
              <p>
                Remove <strong className="text-content">{roleToRemove.title}</strong> from your campaign pipeline?
              </p>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-500">
                <p className="font-semibold">Audit History Lost</p>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  All pre-flight gap evaluations and requirement fit checkpoints for this role will be deleted.
                </p>
              </div>
            </div>
          }
          confirmLabel="Remove Role"
          variant="danger"
        />
      )}

      {/* In-App Alert Modal */}
      {alertModal.isOpen && (
        <AlertModal
          isOpen={alertModal.isOpen}
          onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
          title={alertModal.title}
          description={alertModal.description}
          variant={alertModal.variant}
        />
      )}
    </main>
  );
}

export default function DeveloperCareerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-canvas font-mono text-sm text-muted">
          Loading CareerOS Workspace…
        </div>
      }
    >
      <DeveloperCareerContent />
    </Suspense>
  );
}
