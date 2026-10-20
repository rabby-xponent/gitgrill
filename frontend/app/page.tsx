'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import {
  getDeveloperProfile,
  recordDeveloperAudit,
  DeveloperWorkspaceProfile,
} from '@/lib/workspace-profiles';
import { ThemeToggle } from '@/lib/theme';
import { EngineeringDossier, EngineeringDossierDrawer } from '@/components/EngineeringDossier';
import { PricingSection } from '@/components/PricingSection';
import { AccountMenu } from '@/components/AccountMenu';
import { GitGrillLogo } from '@/components/GitGrillLogo';
import { useSession } from '@/components/SessionProvider';

const CANDIDATE_ARCHETYPES = [
  {
    label: 'Enterprise / React Core',
    username: 'gaearon',
    liveUrl: 'https://overreacted.io',
    note: 'Working Dev with Private Meta History',
  },
  {
    label: 'Prolific OSS Builder',
    username: 'tj',
    liveUrl: '',
    note: 'High-Volume Systems Architect',
  },
  {
    label: 'UI Systems & Components',
    username: 'shadcn',
    liveUrl: 'https://ui.shadcn.com',
    note: 'Modern Design Systems & Full-Stack DX',
  },
];

export default function Home() {
  const { user, loading: sessionLoading, openSignIn } = useSession();

  // Simple Quick Audit Search State
  const [auditUsername, setAuditUsername] = useState('');
  const [auditLiveUrl, setAuditLiveUrl] = useState('');
  const [showLiveUrl, setShowLiveUrl] = useState(false);

  // Developer identity (username memory + portfolio URL for the audit box)
  const [devProfile, setDevProfile] = useState<DeveloperWorkspaceProfile | null>(null);

  // Engineering dossier drawer (portfolio section)
  const [dossierOpen, setDossierOpen] = useState(false);

  // Hero Right Card interactive preview mode (Developer CareerOS vs Recruiter Dossier)
  const [heroPreviewMode, setHeroPreviewMode] = useState<'developer' | 'recruiter'>('developer');

  // Mobile navigation drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const dProf = getDeveloperProfile();
    setDevProfile(dProf);
    if (dProf.githubUsername) setAuditUsername(dProf.githubUsername);
    if (dProf.portfolioUrl) {
      setAuditLiveUrl(dProf.portfolioUrl);
      setShowLiveUrl(true);
    }
    if (typeof window !== 'undefined' && (window.location.hash === '#dossier' || window.location.search.includes('dossier=true'))) {
      setDossierOpen(true);
    }
  }, []);

  const handleAnalyze = (targetUser?: string, targetLive?: string) => {
    const u = (targetUser ?? auditUsername).trim().replace(/^@/, '');
    const l = (targetLive ?? auditLiveUrl).trim();
    if (!u) return;

    if (devProfile?.githubUsername) {
      recordDeveloperAudit(u, 'Technical Talent Audit');
      setDevProfile(getDeveloperProfile());
    }

    const params = new URLSearchParams({ mode: 'recruiter' });
    if (l) params.set('liveUrl', l);

    const qs = params.toString() ? `?${params.toString()}` : '';
    router.push(`/profile/${encodeURIComponent(u)}${qs}`);
  };

  return (
    <main className="min-h-screen bg-[#faf9f5] dark:bg-[#0c0b0e] text-slate-900 dark:text-[#ece9f0] selection:bg-orange-500 selection:text-white dark:selection:bg-signal dark:selection:text-ink transition-colors duration-200 flex flex-col">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-edge/80 bg-[#faf9f5]/90 dark:bg-[#0c0b0e]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5">
          <Link href="/" className="shrink-0 flex items-center">
            <GitGrillLogo size="sm" />
          </Link>

          <div className="hidden items-center gap-7 font-mono text-xs text-slate-600 dark:text-muted md:flex shrink-0">
            <a href="#how-it-works" className="whitespace-nowrap transition-colors hover:text-[#ea580c] dark:hover:text-signal">
              How It Works
            </a>
            <a href="#features" className="whitespace-nowrap transition-colors hover:text-[#ea580c] dark:hover:text-signal">
              Features
            </a>
            <a href="#pricing" className="whitespace-nowrap transition-colors hover:text-[#ea580c] dark:hover:text-signal">
              Pricing
            </a>
            <button
              type="button"
              onClick={() => setDossierOpen(true)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs font-semibold text-[#ea580c] dark:text-signal px-2.5 py-1 rounded-lg border border-orange-200 dark:border-signal/30 bg-orange-50/70 dark:bg-signal/10 hover:bg-orange-100 dark:hover:bg-signal/20 transition-all shadow-2xs cursor-pointer"
              title="Open Engineering Build Dossier"
            >
              <Icon.Terminal className="h-3 w-3" />
              <span>Build Dossier</span>
              <Icon.ArrowUpRight className="h-3 w-3 opacity-70" />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            {user ? (
              <AccountMenu />
            ) : !sessionLoading && (
              <>
                <button
                  type="button"
                  onClick={openSignIn}
                  className="font-mono text-xs font-medium text-slate-600 dark:text-muted hover:text-[#ea580c] dark:hover:text-signal transition-colors px-2 py-1.5 cursor-pointer"
                >
                  Sign in
                </button>
                <Link
                  href="/developer"
                  className="hidden xs:inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg bg-[#ea580c] dark:bg-signal px-3 py-1.5 sm:px-3.5 sm:py-1.5 font-mono text-xs font-bold text-white dark:text-ink hover:bg-[#ea580c]/90 dark:hover:bg-signal/90 transition-all shadow-xs"
                >
                  <Icon.Briefcase className="h-3.5 w-3.5 shrink-0" />
                  <span>CareerOS</span>
                  <Icon.ArrowRight className="h-3 w-3 shrink-0" />
                </Link>
              </>
            )}

            {/* Mobile Navigation Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex md:hidden items-center justify-center rounded-lg border border-slate-200 dark:border-edge bg-slate-50 dark:bg-card p-1.5 text-slate-700 dark:text-muted hover:text-[#ea580c] dark:hover:text-signal transition-colors cursor-pointer"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {mobileMenuOpen ? <Icon.X className="h-4 w-4" /> : <Icon.Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200/80 dark:border-edge/80 bg-[#faf9f5] dark:bg-[#0c0b0e] px-4 py-4 space-y-3 font-mono text-xs shadow-lg animate-in fade-in duration-150">
            <div className="flex flex-col space-y-1">
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-700 dark:text-muted hover:bg-slate-100 dark:hover:bg-surface hover:text-[#ea580c] dark:hover:text-signal transition-colors font-medium"
              >
                How It Works
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-700 dark:text-muted hover:bg-slate-100 dark:hover:bg-surface hover:text-[#ea580c] dark:hover:text-signal transition-colors font-medium"
              >
                Features
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-slate-700 dark:text-muted hover:bg-slate-100 dark:hover:bg-surface hover:text-[#ea580c] dark:hover:text-signal transition-colors font-medium"
              >
                Pricing & Packages
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setDossierOpen(true);
                }}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-[#ea580c] dark:text-signal bg-orange-50/70 dark:bg-signal/10 border border-orange-200 dark:border-signal/30 font-semibold text-left"
              >
                <span className="flex items-center gap-2">
                  <Icon.Terminal className="h-3.5 w-3.5" />
                  Engineering Build Dossier
                </span>
                <Icon.ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-edge grid grid-cols-2 gap-2">
              <Link
                href="/developer"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#ea580c] dark:bg-signal text-white dark:text-ink font-bold shadow-xs text-center"
              >
                <Icon.Briefcase className="h-3.5 w-3.5 shrink-0" />
                <span>CareerOS</span>
              </Link>
              <Link
                href="/recruiter"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-edge bg-white dark:bg-surface text-slate-800 dark:text-[#ece9f0] font-semibold shadow-2xs text-center"
              >
                <Icon.Building className="h-3.5 w-3.5 shrink-0" />
                <span>RecruiterOS</span>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="grid-bg relative overflow-hidden border-b border-slate-200 dark:border-edge/60 pb-20 pt-16 sm:pb-28 sm:pt-24">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#faf9f5]/30 via-[#faf9f5]/80 to-[#faf9f5] dark:from-[#0c0b0e]/30 dark:via-[#0c0b0e]/80 dark:to-[#0c0b0e]" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Hero Left: Value Prop & Interactive Console */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 dark:border-edge bg-orange-50/80 dark:bg-surface/70 px-3.5 py-1 font-mono text-[11px] uppercase tracking-widest text-[#ea580c] dark:text-signal font-semibold shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ea580c] dark:bg-signal animate-pulse" />
                Technical Talent Intelligence & Developer CareerOS
              </div>

              <h1 className="mt-6 font-sans text-3xl font-extrabold leading-[1.15] tracking-tight text-slate-900 dark:text-[#ece9f0] sm:text-5xl lg:text-[56px]">
                Verify engineering depth{' '}
                <span className="text-[#ea580c] dark:text-signal">& pre-flight your applications.</span>
              </h1>

              <p className="mt-5 max-w-xl text-[15px] sm:text-[16px] leading-relaxed text-slate-600 dark:text-muted">
                Resume keywords and vanity commit streaks lie. GitGrill cross-examines real GitHub codebases, inspects live deployed applications, and builds calibrated dossiers for hiring teams while giving developers an immutable resume vault and targeted job pre-flight.
              </p>

              {/* Assessment Console & Portals */}
              <div id="console" className="mt-8 max-w-xl space-y-4">
                {/* Clean Audit Box */}
                <div className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/90 p-4 sm:p-5 shadow-xl shadow-slate-200/50 dark:shadow-2xl backdrop-blur-md space-y-3.5">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-2 rounded-xl bg-slate-50 dark:bg-[#0c0b0e] px-3.5 py-3 border border-slate-200 dark:border-edge/80 focus-within:border-[#ea580c] dark:focus-within:border-signal transition-colors min-w-0">
                      <span className="font-mono text-sm text-[#ea580c] dark:text-signal font-bold shrink-0">@</span>
                      <input
                        id="hero-audit-input"
                        type="text"
                        value={auditUsername}
                        onChange={(e) => setAuditUsername(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                        placeholder="candidate-github-username"
                        className="w-full bg-transparent font-mono text-xs sm:text-sm text-slate-900 dark:text-[#ece9f0] outline-none placeholder:text-slate-400 dark:placeholder:text-muted/40 min-w-0"
                        autoFocus
                      />
                    </div>

                    <button
                      onClick={() => handleAnalyze()}
                      className="w-full sm:w-auto flex-none rounded-xl bg-[#ea580c] hover:bg-[#c2410c] dark:bg-signal dark:hover:bg-signal/90 px-6 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-white dark:text-ink transition-all shadow-md shadow-orange-500/20 active:scale-95 text-center cursor-pointer"
                    >
                      Audit Engineer ↗
                    </button>
                  </div>

                  {/* Optional Live Demo URL */}
                  <div>
                    {showLiveUrl ? (
                      <div className="flex items-center gap-2 rounded-xl bg-slate-50 dark:bg-[#0c0b0e]/70 px-3.5 py-2.5 border border-slate-200 dark:border-edge/60">
                        <Icon.Globe className="h-3.5 w-3.5 flex-none text-muted" />
                        <input
                          type="url"
                          value={auditLiveUrl}
                          onChange={(e) => setAuditLiveUrl(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                          placeholder="https://candidate-app.vercel.app (production demo / portfolio)"
                          className="flex-1 bg-transparent font-mono text-xs text-slate-900 dark:text-[#ece9f0] outline-none placeholder:text-slate-400 dark:placeholder:text-muted/40"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setAuditLiveUrl('');
                            setShowLiveUrl(false);
                          }}
                          aria-label="Remove URL"
                          className="rounded p-0.5 text-slate-400 transition-colors hover:text-[#ea580c] dark:text-muted dark:hover:text-signal"
                        >
                          <Icon.X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowLiveUrl(true)}
                        className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 dark:text-muted transition-colors hover:text-[#ea580c] dark:hover:text-signal"
                      >
                        <span className="text-[#ea580c] dark:text-signal font-bold">＋</span>
                        <span>Add live deployed app or demo URL (audits production bundle)</span>
                      </button>
                    )}
                  </div>

                  {/* Quick Test Profiles */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] text-slate-500 dark:text-muted/80">
                    <span className="text-slate-400 dark:text-muted/60 font-medium">Or test with live profiles:</span>
                    {CANDIDATE_ARCHETYPES.map((arch) => (
                      <button
                        key={arch.username}
                        onClick={() => handleAnalyze(arch.username, arch.liveUrl)}
                        className="group rounded-lg border border-slate-200 dark:border-edge/60 bg-slate-50 dark:bg-[#0c0b0e] px-2.5 py-1 text-slate-600 dark:text-muted transition-all hover:border-[#ea580c]/50 hover:text-[#ea580c] dark:hover:border-signal/50 dark:hover:text-signal"
                        title={arch.note}
                      >
                        <span className="font-semibold text-slate-900 group-hover:text-[#ea580c] dark:text-[#ece9f0] dark:group-hover:text-signal">@{arch.username}</span>
                        <span className="ml-1 text-[10px] text-slate-400 dark:text-muted/60">({arch.label.split('/')[0].trim()})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dedicated Workspace Portals Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  {/* Dedicated Recruiter Portal Card */}
                  <Link
                    href="/recruiter"
                    className="group rounded-2xl border border-orange-500/20 dark:border-signal/30 bg-white dark:bg-[#121118]/80 p-4.5 backdrop-blur-md hover:border-[#ea580c] dark:hover:border-signal transition-all shadow-sm hover:shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal/10 border border-signal/25 text-signal">
                          <Icon.Building className="h-4 w-4" />
                        </span>
                        <span className="rounded-full bg-orange-50 dark:bg-signal/15 px-2.5 py-0.5 font-mono text-[9px] font-bold text-[#ea580c] dark:text-signal border border-orange-200 dark:border-signal/30 uppercase">
                          Dedicated Space ↗
                        </span>
                      </div>
                      <h3 className="mt-2.5 font-mono text-sm font-bold text-slate-900 dark:text-[#ece9f0] group-hover:text-[#ea580c] dark:group-hover:text-signal transition-colors">
                        RecruiterOS Command Center
                      </h3>
                      <p className="mt-1 font-sans text-xs text-slate-500 dark:text-muted leading-relaxed">
                        Manage open job requisitions, set custom hiring guardrails, track candidate pipeline leaderboards, and export 1-pager EM briefs.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1 font-mono text-xs font-semibold text-[#ea580c] dark:text-signal group-hover:translate-x-1 transition-transform">
                      <span>Launch Recruiter Workspace</span>
                      <span>→</span>
                    </div>
                  </Link>

                  {/* Developer Career Suite Card */}
                  <Link
                    href="/developer"
                    className="group rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-[#121118]/80 p-4.5 backdrop-blur-md transition-all cursor-pointer hover:border-slate-900/40 dark:hover:border-signal/60 hover:shadow-md flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/[0.04] dark:bg-[#0c0b0e] border border-slate-200 dark:border-edge text-muted">
                          <Icon.Monitor className="h-4 w-4" />
                        </span>
                        <span className="rounded-full bg-slate-100 dark:bg-surface px-2.5 py-0.5 font-mono text-[9px] font-bold text-slate-600 dark:text-muted border border-slate-200 dark:border-edge uppercase">
                          Dedicated Space ↗
                        </span>
                      </div>
                      <h3 className="mt-2.5 font-mono text-sm font-bold text-slate-900 dark:text-[#ece9f0] group-hover:text-slate-700 dark:group-hover:text-signal transition-colors">
                        Developer CareerOS
                      </h3>
                      <p className="mt-1 font-sans text-xs text-slate-500 dark:text-muted leading-relaxed">
                        Immutable resume vault (2D PDF parser), target job pipeline, pre-flight audits against real JDs, and 1-click tailored variant generation.
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-1 font-mono text-xs font-semibold text-slate-700 dark:text-[#ece9f0] group-hover:translate-x-1 transition-transform">
                      <span>Open Career Workspace</span>
                      <span>→</span>
                    </div>
                  </Link>
                </div>

                {/* Trust Signals Row */}
                <div className="flex flex-wrap items-center gap-5 font-mono text-[11px] text-slate-500 dark:text-muted/60 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Icon.Check className="h-3 w-3 text-signal" /> No Candidate Login Needed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon.Check className="h-3 w-3 text-signal" /> Private Dev Bias Shield
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Icon.Check className="h-3 w-3 text-signal" /> 1-Click Executive PDF Export
                  </span>
                </div>
              </div>
            </div>

            {/* Hero Right: Live Dossier Preview Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl border border-slate-200 dark:border-edge/80 bg-white dark:bg-[#141217] p-6 shadow-xl shadow-slate-200/50 dark:shadow-2xl">
                {/* Dossier Header Badge with Dual Mode Switcher */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-edge/80 pb-3.5">
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-[#0c0b0e] border border-slate-200 dark:border-edge">
                    <button
                      type="button"
                      onClick={() => setHeroPreviewMode('developer')}
                      className={`px-2.5 py-1 rounded-md font-mono text-[10px] font-bold transition-all ${
                        heroPreviewMode === 'developer'
                          ? 'bg-white dark:bg-surface text-[#ea580c] dark:text-signal shadow-2xs'
                          : 'text-slate-500 dark:text-muted hover:text-slate-900 dark:hover:text-[#ece9f0]'
                      }`}
                    >
                      CareerOS Pre-Flight
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeroPreviewMode('recruiter')}
                      className={`px-2.5 py-1 rounded-md font-mono text-[10px] font-bold transition-all ${
                        heroPreviewMode === 'recruiter'
                          ? 'bg-white dark:bg-surface text-[#ea580c] dark:text-signal shadow-2xs'
                          : 'text-slate-500 dark:text-muted hover:text-slate-900 dark:hover:text-[#ece9f0]'
                      }`}
                    >
                      Recruiter Brief
                    </button>
                  </div>

                  <span className="rounded-full border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {heroPreviewMode === 'developer' ? '92% Pre-Flight Fit' : '94% Confidence'}
                  </span>
                </div>

                {heroPreviewMode === 'developer' ? (
                  <>
                    {/* Developer Candidate Overview */}
                    <div className="mt-4 flex items-start gap-3">
                      <div className="h-12 w-12 flex-none rounded-xl border border-slate-200 dark:border-edge bg-orange-50 dark:bg-signal/10 flex items-center justify-center font-mono text-base font-bold text-[#ea580c] dark:text-signal">
                        GR
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-900 dark:text-[#ece9f0]">Golam Rabby</span>
                          <span className="font-mono text-xs text-[#ea580c] dark:text-signal">@Golam-Rabby821</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-orange-200 dark:border-signal/40 bg-orange-50 dark:bg-signal/15 px-2 py-0.5 font-mono text-[10px] text-orange-700 dark:text-signal font-semibold">
                            Target: Senior Full-Stack Engineer
                          </span>
                          <span className="rounded-full border border-slate-200 dark:border-edge bg-slate-50 dark:bg-surface px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:text-muted">
                            Vault v1.1 Variant
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pre-Flight Live App Audit */}
                    <div className="mt-4 rounded-xl border border-slate-200 dark:border-edge bg-slate-50/70 dark:bg-[#0c0b0e]/60 p-3 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-muted text-[10px] uppercase tracking-wider">
                          Portfolio & Project Verification
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-signal text-[11px] font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
                          Live Verified (118ms)
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                        <span className="text-slate-900 dark:text-[#ece9f0] font-medium">prottaho.com</span>
                        <span className="rounded bg-white dark:bg-surface px-1.5 py-0.5 text-[9px] text-slate-500 dark:text-muted border border-slate-200 dark:border-edge">
                          Production Next.js + Supabase
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="rounded bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                          2D Coordinate PDF Parsed
                        </span>
                        <span className="rounded bg-white dark:bg-surface px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-[#ece9f0] border border-slate-200 dark:border-edge">
                          Mammoth DOCX AST
                        </span>
                        <span className="rounded bg-white dark:bg-surface px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-muted border border-slate-200 dark:border-edge">
                          Immutable Master
                        </span>
                      </div>
                    </div>

                    {/* Pre-Flight Fit Matrix */}
                    <div className="mt-3 rounded-xl border border-slate-200 dark:border-edge bg-slate-50/70 dark:bg-[#0c0b0e]/60 p-3 font-mono text-xs space-y-2">
                      <div className="text-slate-500 dark:text-muted text-[10px] uppercase tracking-wider">
                        JD Requirements vs. Code Evidence
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-900 dark:text-[#ece9f0] font-medium">Next.js 14 App Router / TS</span>
                        <span className="inline-flex items-center gap-1 text-signal font-semibold">
                          <Icon.Check className="h-3 w-3" /> Code Verified
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-900 dark:text-[#ece9f0] font-medium">Postgres RLS / JWT Auth</span>
                        <span className="inline-flex items-center gap-1 text-slate-700 dark:text-[#ece9f0]/80 font-semibold">
                          <Icon.Globe className="h-3 w-3" /> Live Shipped
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-900 dark:text-[#ece9f0] font-medium">Distributed Kafka / Redis</span>
                        <span className="inline-flex items-center gap-1 text-muted font-semibold">
                          <Icon.Alert className="h-3 w-3" /> Gap Flagged (Probed)
                        </span>
                      </div>
                    </div>

                    {/* Pre-Flight Tailoring Advice */}
                    <div className="mt-3 rounded-xl border border-orange-200 dark:border-signal/30 bg-orange-50/70 dark:bg-signal/10 p-3 font-mono text-xs">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#ea580c] dark:text-signal">
                        <Icon.Zap className="h-3 w-3" /> Tailoring Recommendation
                      </div>
                      <p className="mt-1 text-[11px] text-slate-800 dark:text-[#ece9f0]/90 leading-snug">
                        Emphasize bKash/Nagad concurrency resilience and multi-provider failover.
                      </p>
                    </div>

                    <div className="mt-3 text-center font-mono text-[10px] text-slate-400 dark:text-muted/60">
                      1-Click tailored variant ready with bullet point preservation.
                    </div>
                  </>
                ) : (
                  <>
                    {/* Candidate Overview */}
                    <div className="mt-4 flex items-start gap-3">
                      <div className="h-12 w-12 flex-none rounded-xl border border-slate-200 dark:border-edge bg-slate-50 dark:bg-surface flex items-center justify-center font-mono text-base font-bold text-[#ea580c] dark:text-signal">
                        GA
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-[#ece9f0]">Dan Abramov</span>
                          <span className="font-mono text-xs text-[#ea580c] dark:text-signal">@gaearon</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-blue-200 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 font-mono text-[10px] text-blue-700 dark:text-blue-300">
                            Working Professional
                          </span>
                          <span className="rounded-full border border-purple-200 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/30 px-2 py-0.5 font-mono text-[10px] text-purple-700 dark:text-purple-300">
                            Senior Engineer
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Live Shipped Verification */}
                    <div className="mt-4 rounded-xl border border-slate-200 dark:border-edge bg-slate-50/70 dark:bg-[#0c0b0e]/60 p-3 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-muted text-[10px] uppercase tracking-wider">
                          Live App Audit
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-signal text-[11px] font-medium">
                          <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
                          Live (142ms · Fast)
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                        <span className="text-slate-900 dark:text-[#ece9f0] font-medium">overreacted.io</span>
                        <span className="rounded bg-white dark:bg-surface px-1.5 py-0.5 text-[9px] text-slate-500 dark:text-muted border border-slate-200 dark:border-edge">
                          Vercel
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="rounded bg-orange-50 dark:bg-signal/10 px-1.5 py-0.5 text-[10px] text-orange-700 dark:text-signal border border-orange-200 dark:border-signal/20">
                          Next.js (React)
                        </span>
                        <span className="rounded bg-white dark:bg-surface px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-[#ece9f0] border border-slate-200 dark:border-edge">
                          TypeScript
                        </span>
                        <span className="rounded bg-white dark:bg-surface px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-muted border border-slate-200 dark:border-edge">
                          Responsive Viewport
                        </span>
                      </div>
                    </div>

                    {/* Claim vs Evidence Snippet */}
                    <div className="mt-3 rounded-xl border border-slate-200 dark:border-edge bg-slate-50/70 dark:bg-[#0c0b0e]/60 p-3 font-mono text-xs space-y-2">
                      <div className="text-slate-500 dark:text-muted text-[10px] uppercase tracking-wider">
                        Claim vs. Evidence Matrix
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-900 dark:text-[#ece9f0] font-medium">React / State Architecture</span>
                        <span className="inline-flex items-center gap-1 text-signal font-semibold">
                          <Icon.Check className="h-3 w-3" /> Code Verified
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-900 dark:text-[#ece9f0] font-medium">Production Next.js</span>
                        <span className="inline-flex items-center gap-1 text-slate-700 dark:text-[#ece9f0]/80 font-semibold">
                          <Icon.Globe className="h-3 w-3" /> Live Shipped
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-900 dark:text-[#ece9f0] font-medium">Kubernetes / Distributed</span>
                        <span className="inline-flex items-center gap-1 text-muted font-semibold">
                          <Icon.Search className="h-3 w-3" /> Probe Required
                        </span>
                      </div>
                    </div>

                    {/* 15-Minute Screen Guide Snippet */}
                    <div className="mt-3 rounded-xl border border-amber-200 dark:border-edge/70 bg-amber-50/80 dark:bg-amber-950/10 p-3">
                      <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-signal">
                        <Icon.Zap className="h-3 w-3" /> 15-Min Phone Screen Guide
                      </div>
                      <p className="mt-1 text-xs text-slate-800 dark:text-[#ece9f0]/90 leading-snug">
                        &quot;Describe a production debugging incident where rendering regressions impacted client performance.&quot;
                      </p>
                      <div className="mt-2 flex items-center justify-between font-mono text-[10px]">
                        <span className="inline-flex items-center gap-1 text-signal font-medium">
                          <Icon.Check className="h-3 w-3" /> Profiler / Flamegraphs
                        </span>
                        <span className="inline-flex items-center gap-1 text-muted font-medium">
                          <Icon.Alert className="h-3 w-3" /> Vague &quot;checked console&quot;
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 text-center font-mono text-[10px] text-slate-400 dark:text-muted/60">
                      Ready to share with hiring committees in PDF format.
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Social Proof Metric Bar */}
          <div className="mt-16 grid grid-cols-2 gap-6 border-t border-slate-200 dark:border-edge/60 pt-10 sm:grid-cols-4">
            <div>
              <div className="font-mono text-3xl font-extrabold text-slate-900 dark:text-[#ece9f0]">34+</div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-muted mt-1">
                Engineered Milestones
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl font-extrabold text-[#ea580c] dark:text-signal">2D-Grid</div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-muted mt-1">
                Coordinate PDF & DOCX Parser
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl font-extrabold text-slate-900 dark:text-[#ece9f0]">11+</div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-muted mt-1">
                Deterministic Audit Tools
              </div>
            </div>
            <div>
              <div className="font-mono text-3xl font-extrabold text-[#ea580c] dark:text-signal">~14s</div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-muted mt-1">
                Average Dossier Latency
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Reality Section (Clean High-Contrast Editorial Style) */}
      <section id="the-problem" className="bg-[#f6f4ee] dark:bg-[#111015] text-slate-900 dark:text-[#ece9f0] py-20 sm:py-28 border-b border-slate-200 dark:border-edge/60">
        <div className="mx-auto max-w-6xl px-6">
          <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#ea580c] dark:text-signal font-semibold">
            <span>●</span> The Technical Hiring Reality
          </div>

          <h2 className="mt-4 font-sans text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl text-slate-900 dark:text-[#ece9f0]">
            Technical screening shouldn&apos;t be{' '}
            <span className="text-[#ea580c] dark:text-signal">a guessing game.</span>
          </h2>

          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-slate-600 dark:text-muted">
            Resumes are now AI-generated with 20+ buzzwords. Meanwhile, the strongest engineers
            write proprietary code behind enterprise NDAs. Current tools fail both sides.
          </p>

          <div className="mt-14 grid gap-8 lg:grid-cols-2">
            {/* Left: The Recruiter & Hiring Manager Struggle */}
            <div className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-[#16151c] p-7 shadow-sm">
              <div className="font-mono text-xs uppercase tracking-widest text-[#ea580c] dark:text-signal font-bold">
                For The Technical Recruiter & EM
              </div>
              <ul className="mt-6 space-y-4 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-3">
                  <Icon.X className="mt-0.5 h-4 w-4 flex-none text-[#ea580c] dark:text-signal" strokeWidth={2} />
                  <span>
                    <strong>Buzzword inflation:</strong> Resumes claim Next.js, Kubernetes, and Kafka with zero proof of hands-on depth.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Icon.X className="mt-0.5 h-4 w-4 flex-none text-[#ea580c] dark:text-signal" strokeWidth={2} />
                  <span>
                    <strong>The private repo blindspot:</strong> Top enterprise engineers have almost zero public commits, getting mislabeled as &quot;inactive&quot;.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Icon.X className="mt-0.5 h-4 w-4 flex-none text-[#ea580c] dark:text-signal" strokeWidth={2} />
                  <span>
                    <strong>Non-technical phone screens:</strong> Initial interviewers lack calibrated questions to separate shallow buzzword answers from real architecture experience.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Icon.X className="mt-0.5 h-4 w-4 flex-none text-[#ea580c] dark:text-signal" strokeWidth={2} />
                  <span>
                    <strong>Engineering manager burnout:</strong> Senior staff waste 10+ hours a week interviewing candidates who fail basic tech screens.
                  </span>
                </li>
              </ul>
            </div>

            {/* Right: The Real Developer Struggle */}
            <div className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-[#16151c] p-7 shadow-sm">
              <div className="font-mono text-xs uppercase tracking-widest text-slate-900 dark:text-[#ece9f0] font-bold">
                For The Working Software Engineer
              </div>
              <ul className="mt-6 space-y-4 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-3">
                  <span className="text-slate-400 dark:text-muted font-bold text-base leading-none">•</span>
                  <span>
                    <strong>Unfairly penalized by naive ATS:</strong> Working engineers who ship private code to paying customers get ignored in favor of students copying public tutorial repos.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-slate-400 dark:text-muted font-bold text-base leading-none">•</span>
                  <span>
                    <strong>Production live builds ignored:</strong> Shipped apps, SaaS demos, and live client projects on Vercel or Render are never inspected by recruiters.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-slate-400 dark:text-muted font-bold text-base leading-none">•</span>
                  <span>
                    <strong>Irrelevant LeetCode marathons:</strong> Candidates are judged on inverted binary trees instead of architectural tradeoffs and production debugging.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-slate-400 dark:text-muted font-bold text-base leading-none">•</span>
                  <span>
                    <strong>Ghosted after technical submissions:</strong> No objective breakdown of how practical code was evaluated.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-slate-400 dark:text-muted font-bold text-base leading-none">•</span>
                  <span>
                    <strong>Static resumes & blind applications:</strong> Candidates spray static PDFs into ATS black holes without pre-flight validation against actual job requirements or ability to branch tailored variants.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Result Banner */}
          <div className="mt-10 rounded-xl bg-slate-900 dark:bg-[#1c1917] p-4 text-white font-mono text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[#f97316] font-semibold">THE OUTCOME:</span>
              <div className="flex flex-wrap items-center gap-1.5 text-stone-300 text-[11px] sm:text-xs">
                <span>Blind Applications</span>
                <span>→</span>
                <span>False Negatives</span>
                <span>→</span>
                <span>Engineering Burnout</span>
                <span>→</span>
                <span className="text-white font-semibold">Solve Both with GitGrill ⚡</span>
              </div>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-stone-800 pt-3 sm:pt-0">
              <Link href="/developer" className="text-[#f97316] font-semibold underline hover:text-white transition-colors">
                Developer CareerOS →
              </Link>
              <button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  document.querySelector('input')?.focus();
                }}
                className="text-stone-300 underline hover:text-white transition-colors cursor-pointer"
              >
                Audit Handle ↑
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 sm:py-28 border-b border-slate-200 dark:border-edge/60 bg-[#faf9f5] dark:bg-[#0c0b0e]">
        <div className="mx-auto max-w-6xl px-6">
          <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#ea580c] dark:text-signal font-semibold">
            <span>●</span> Automated Ground-Truth Pipeline
          </div>

          <h2 className="mt-4 font-sans text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-900 dark:text-[#ece9f0]">
            From raw signals to calibrated intelligence{' '}
            <span className="text-[#ea580c] dark:text-signal">in three steps.</span>
          </h2>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/40 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="font-mono text-4xl font-extrabold text-[#ea580c] dark:text-signal">01</div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-[#ece9f0]">Ingest Signals or Master Resume</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-muted">
                Audit any engineer via their GitHub handle and live deployed app URL, or upload your resume (PDF/DOCX) into the immutable CareerOS vault with 2D coordinate parsing.
              </p>
              <div className="mt-4 rounded-xl bg-slate-50 dark:bg-[#0c0b0e] p-2.5 font-mono text-[11px] text-slate-600 dark:text-muted border border-slate-200 dark:border-edge">
                @username + live-url or Resume.pdf
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/40 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="font-mono text-4xl font-extrabold text-[#ea580c] dark:text-signal">02</div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-[#ece9f0]">Multi-Signal Ground-Truth Audit</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-muted">
                11 deterministic tools execute in parallel: commit message forensics, language byte counts, PR reviews, headless live app DOM inspection, and ReAct code tree traversal with line-bounded buffers.
              </p>
              <div className="mt-4 rounded-xl bg-slate-50 dark:bg-[#0c0b0e] p-2.5 font-mono text-[11px] text-slate-600 dark:text-muted font-medium border border-slate-200 dark:border-edge inline-flex items-center gap-1.5">
                <Icon.Check className="h-3 w-3 text-signal" />
                11 Parallel Tools + Live Bundle Audit
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/40 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="font-mono text-4xl font-extrabold text-[#ea580c] dark:text-signal">03</div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-[#ece9f0]">Executive Brief or Tailored Variant</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-muted">
                Recruiters receive calibrated seniority, Claim vs Evidence matrices, and 15-min screen guides. Developers receive target-fit pre-flights and versioned tailored resume variants.
              </p>
              <div className="mt-4 rounded-xl bg-slate-50 dark:bg-[#0c0b0e] p-2.5 font-mono text-[11px] text-[#ea580c] dark:text-signal font-medium border border-slate-200 dark:border-edge inline-flex items-center gap-1.5">
                <Icon.Clipboard className="h-3 w-3" />
                Executive PDF & Tailored Variant Studio
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You Get / Core Features */}
      <section id="features" className="py-20 sm:py-28 bg-[#f4f2ea] dark:bg-[#100e13] border-b border-slate-200 dark:border-edge/60">
        <div className="mx-auto max-w-6xl px-6">
          <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#ea580c] dark:text-signal font-semibold">
            <span>●</span> Unified Technical Intelligence & Career Suite
          </div>

          <h2 className="mt-4 font-sans text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-900 dark:text-[#ece9f0]">
            Engineered for hiring teams & engineers who value{' '}
            <span className="text-[#ea580c] dark:text-signal">accuracy.</span>
          </h2>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/60 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-signal/25 bg-signal/10 text-signal">
                <Icon.Briefcase className="h-5 w-5" />
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900 dark:text-[#ece9f0]">Developer CareerOS & Resume Vault</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-muted">
                2D coordinate visual PDF extraction and Mammoth DOCX list preservation. Store immutable master resumes and branch versioned variants (v1.0, v1.1, v2.0) with rich Experience & Project section editors.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/60 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-signal/25 bg-signal/10 text-signal">
                <Icon.Target className="h-5 w-5" />
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900 dark:text-[#ece9f0]">Target Job Fit Pre-Flight</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-muted">
                Cross-references candidate code repositories and live applications against specific job descriptions before applying, pinpointing verified strengths and suspicious buzzword gaps.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/60 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-signal/25 bg-signal/10 text-signal">
                <Icon.Globe className="h-5 w-5" />
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900 dark:text-[#ece9f0]">Live Application Inspection</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-muted">
                Inspects production builds in real time. Detects Next.js, React, Tailwind, Supabase, response latency, and mobile responsiveness directly from deployed URLs.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/60 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-signal/25 bg-signal/10 text-signal">
                <Icon.Building className="h-5 w-5" />
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900 dark:text-[#ece9f0]">RecruiterOS Command Center</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-muted">
                Dedicated workspace for managing open job requisitions, setting seniority rubrics & hiring guardrails, tracking candidate leaderboards, and exporting 1-pager EM briefs.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/60 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-signal/25 bg-signal/10 text-signal">
                <Icon.Scale className="h-5 w-5" />
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900 dark:text-[#ece9f0]">Claim vs. Evidence Matrix</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-muted">
                Cross-references resume buzzwords against verified artifacts. Separates code-verified skills from unverified claims that require phone screen probing.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/60 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-signal/25 bg-signal/10 text-signal">
                <Icon.Zap className="h-5 w-5" />
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900 dark:text-[#ece9f0]">Multi-Model Resilient Gateway</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-muted">
                Autonomous synthesis backed by Gemini 2.5 Flash, Groq, OpenRouter, DeepSeek, and OpenAI with automatic failover and deterministic fallback floor, guaranteeing 99.9% uptime.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing & Package Plans */}
      <PricingSection />

      {/* Engineering Dossier (portfolio) */}
      <EngineeringDossier onOpen={() => setDossierOpen(true)} />

      {/* Bottom CTA Section */}
      <section className="py-20 text-center bg-[#faf9f5] dark:bg-[#0c0b0e]">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-sans text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-900 dark:text-[#ece9f0]">
            Stop guessing. Build, verify, & apply with{' '}
            <span className="text-[#ea580c] dark:text-signal">ground truth.</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-600 dark:text-muted leading-relaxed">
            Whether you&apos;re an engineer pre-flighting your next job application or a hiring team auditing candidate depth, GitGrill replaces buzzword guesswork with deterministic code proof.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 w-full sm:w-auto max-w-md sm:max-w-none mx-auto">
            <Link
              href="/developer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] dark:bg-signal dark:hover:bg-signal/90 px-7 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-white dark:text-ink transition-all shadow-md shadow-orange-500/20 active:scale-95 text-center"
            >
              <Icon.Briefcase className="h-4 w-4" />
              <span>Launch Developer CareerOS →</span>
            </Link>

            <button
              onClick={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                const input = document.querySelector('input');
                input?.focus();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-edge bg-white dark:bg-card hover:border-[#ea580c] hover:text-[#ea580c] dark:hover:border-signal dark:hover:text-signal px-7 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-[#ece9f0] transition-colors shadow-xs text-center cursor-pointer"
            >
              <span>Audit Engineering Handle ↑</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-edge/60 py-8 text-center font-mono text-xs text-slate-500 dark:text-muted/60 bg-[#faf9f5] dark:bg-[#0c0b0e] mt-auto flex-none">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span>GitGrill · Technical Ground-Truth Intelligence & Code Defense</span>
          <span>
            developed by{' '}
            <a
              href="https://www.linkedin.com/in/golamrabby-/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#ea580c] dark:text-signal hover:underline transition-colors"
            >
              Golam Rabby
            </a>
          </span>
        </div>
      </footer>

      {/* Engineering dossier drawer */}
      <EngineeringDossierDrawer open={dossierOpen} onClose={() => setDossierOpen(false)} />

    </main>
  );
}
