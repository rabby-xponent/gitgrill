'use client';

/**
 * Dedicated Engineering Build Dossier Page (/dossier).
 *
 * Designed as a canonical, linkable reference for technical recruiters,
 * engineering managers, and interviewers evaluating the GitGrill codebase.
 * Direct URL: https://gitgrill-gr.vercel.app/dossier
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { GitGrillLogo } from '@/components/GitGrillLogo';
import { ThemeToggle } from '@/lib/theme';
import { Icon } from '@/components/icons';
import {
  DOSSIER_STATS,
  DOSSIER_SYSTEM_MAP,
  DOSSIER_DECISIONS,
  DOSSIER_VERIFICATION,
  DOSSIER_STACK,
  DossierDecision,
} from '@/lib/dossier';

const DECISION_ICONS: Record<DossierDecision['icon'], React.ComponentType<{ className?: string }>> = {
  zap: Icon.Zap,
  scale: Icon.Scale,
  lock: Icon.Lock,
  target: Icon.Target,
  briefcase: Icon.Briefcase,
  users: Icon.Users,
  check: Icon.Check,
  info: Icon.Info,
};

type DossierTab = 'blueprint' | 'decisions' | 'verification' | 'stack';

export default function DossierPage() {
  const [activeTab, setActiveTab] = useState<DossierTab>('blueprint');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShare = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf9f5] dark:bg-[#0c0b0e] text-slate-900 dark:text-[#ece9f0] transition-colors duration-200 flex flex-col print:bg-white print:text-black">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-edge/80 bg-[#faf9f5]/90 dark:bg-[#0c0b0e]/90 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-3.5 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/" className="shrink-0">
              <GitGrillLogo size="sm" />
            </Link>
            <span className="text-slate-300 dark:text-muted/40 font-mono text-sm shrink-0">/</span>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#ea580c] dark:text-signal truncate">
                Dossier
              </span>
              <span className="rounded-full bg-orange-100 dark:bg-signal/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#ea580c] dark:text-signal border border-orange-200 dark:border-signal/30 shrink-0">
                v2.4
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-edge bg-white dark:bg-surface px-2.5 sm:px-3 py-1.5 font-mono text-xs text-slate-700 dark:text-muted hover:text-[#ea580c] dark:hover:text-signal transition-colors shadow-xs"
              title="Copy link to dossier"
            >
              {copiedLink ? <Icon.Check className="h-3.5 w-3.5 text-signal" /> : <Icon.Copy className="h-3.5 w-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Share'}</span>
            </button>

            <button
              onClick={() => typeof window !== 'undefined' && window.print()}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-edge bg-white dark:bg-surface px-3 py-1.5 font-mono text-xs text-slate-700 dark:text-muted hover:text-[#ea580c] dark:hover:text-signal transition-colors shadow-xs"
              title="Print or save as PDF"
            >
              <Icon.Printer className="h-3.5 w-3.5" />
              <span>Print / PDF</span>
            </button>

            <ThemeToggle />

            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 dark:bg-white px-2.5 sm:px-3.5 py-1.5 font-mono text-xs font-bold text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-xs"
            >
              <span>Back<span className="hidden xs:inline"> to App</span></span>
              <Icon.ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Header */}
      <section className="border-b border-slate-200 dark:border-edge/60 bg-white dark:bg-[#121118]/70 py-8 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 dark:border-edge bg-orange-50 dark:bg-surface/80 px-3.5 py-1 font-mono text-[11px] uppercase tracking-widest text-[#ea580c] dark:text-signal font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ea580c] dark:bg-signal animate-pulse" />
            Engineering Proof of Work & Systems Blueprint
          </div>

          <h1 className="mt-4 font-sans text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-[#ece9f0]">
            GitGrill <span className="text-[#ea580c] dark:text-signal">Engineering Build Dossier.</span>
          </h1>

          <p className="mt-4 max-w-3xl font-sans text-sm sm:text-[16px] leading-relaxed text-slate-600 dark:text-muted">
            Prepared specifically for Engineering Managers, Staff Engineers, and Technical Recruiters. This single document outlines the complete architectural blueprint, multi-turn ReAct agent loop, 2D visual PDF parsing engine, resilient multi-model LLM gateway, and verified production benchmarks.
          </p>

          {/* Quick Metrics Bar */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {DOSSIER_STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200 dark:border-edge/70 bg-slate-50/70 dark:bg-[#0c0b0e]/70 p-4"
              >
                <div className="font-mono text-xl sm:text-2xl font-extrabold text-[#ea580c] dark:text-signal">
                  {stat.value}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-muted">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Primary Quick Links */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5 sm:gap-3 font-mono text-xs">
            <span className="text-slate-500 dark:text-muted">Live Portals:</span>
            <Link
              href="/developer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-edge bg-white dark:bg-surface px-2.5 py-1 text-slate-700 dark:text-muted hover:border-[#ea580c] hover:text-[#ea580c] dark:hover:border-signal dark:hover:text-signal transition-colors"
            >
              <Icon.Briefcase className="h-3 w-3 text-signal" />
              <span>Developer CareerOS</span>
              <Icon.ArrowUpRight className="h-3 w-3 opacity-60" />
            </Link>
            <Link
              href="/recruiter"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-edge bg-white dark:bg-surface px-2.5 py-1 text-slate-700 dark:text-muted hover:border-[#ea580c] hover:text-[#ea580c] dark:hover:border-signal dark:hover:text-signal transition-colors"
            >
              <Icon.Building className="h-3 w-3 text-signal" />
              <span>RecruiterOS Command Center</span>
              <Icon.ArrowUpRight className="h-3 w-3 opacity-60" />
            </Link>
            <a
              href="https://github.com/Golam-Rabby821"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-edge bg-white dark:bg-surface px-2.5 py-1 text-slate-700 dark:text-muted hover:text-[#ea580c] dark:hover:text-signal transition-colors"
            >
              <Icon.Github className="h-3 w-3" />
              <span>Author GitHub</span>
              <Icon.ArrowUpRight className="h-3 w-3 opacity-60" />
            </a>
          </div>
        </div>
      </section>

      {/* Interactive Tabs Section */}
      <section className="flex-1 py-8 sm:py-14 bg-[#faf9f5] dark:bg-[#0c0b0e]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-edge pb-4 mb-8 overflow-x-auto no-scrollbar flex-nowrap">
            {(
              [
                { id: 'blueprint', label: 'System Blueprint & Subsystems' },
                { id: 'decisions', label: 'Engineering Decisions & Trade-Offs' },
                { id: 'verification', label: 'Verified Test Benchmarks' },
                { id: 'stack', label: 'Production Tech Stack' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 sm:px-4 py-2 rounded-xl font-mono text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#ea580c] dark:bg-signal text-white dark:text-ink shadow-sm'
                    : 'border border-slate-200 dark:border-edge bg-white dark:bg-surface text-slate-600 dark:text-muted hover:text-slate-900 dark:hover:text-[#ece9f0]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: System Blueprint */}
          {activeTab === 'blueprint' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/20 p-4">
                <p className="font-sans text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
                  <strong>Architectural Philosophy:</strong> GitGrill avoids monolithic prompt dumps or superficial star-counting. Systems are decoupled into deterministic statistical profilers, autonomous tool-calling ReAct agents, client-side privacy boundaries, and a resilient multi-provider LLM gateway with strict fallback floors.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {DOSSIER_SYSTEM_MAP.map((sub, idx) => (
                  <div
                    key={sub.title}
                    className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-[#141217] p-6 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs font-extrabold text-[#ea580c] dark:text-signal">
                          0{idx + 1}
                        </span>
                        <span className="rounded-full bg-slate-100 dark:bg-surface px-2.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:text-muted border border-slate-200 dark:border-edge">
                          {sub.badge}
                        </span>
                      </div>
                      <h3 className="mt-3 font-sans text-base font-bold text-slate-900 dark:text-[#ece9f0]">
                        {sub.title}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-muted">
                        {sub.description}
                      </p>
                    </div>

                    <div className="mt-5 border-t border-slate-100 dark:border-edge/70 pt-4">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400 dark:text-muted/60 mb-2">
                        Core Components & Modules
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {sub.components.map((c) => (
                          <span
                            key={c}
                            className="rounded-md bg-slate-50 dark:bg-[#0c0b0e] px-2 py-1 font-mono text-[10px] text-slate-700 dark:text-muted border border-slate-200 dark:border-edge"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Engineering Decisions */}
          {activeTab === 'decisions' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/70 dark:bg-amber-950/20 p-4">
                <p className="font-sans text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                  <strong>Engineering Decisions & Hard Trade-Offs:</strong> Every technical choice in GitGrill was made to eliminate failure modes common to talent intelligence platforms—preventing context-window blowouts, handling unmetered LLM billing vulnerabilities, and defending against false junior-biases for NDA engineers.
                </p>
              </div>

              <div className="space-y-5">
                {DOSSIER_DECISIONS.map((d) => {
                  const IconComp = DECISION_ICONS[d.icon] || Icon.Target;
                  return (
                    <div
                      key={d.id}
                      className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-[#141217] p-6 shadow-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-orange-50 dark:bg-signal/10 border border-orange-200 dark:border-signal/25 text-[#ea580c] dark:text-signal">
                          <IconComp className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-sans text-base font-bold text-slate-900 dark:text-[#ece9f0]">
                            {d.title}
                          </h3>

                          <div className="mt-3 space-y-2 text-xs leading-relaxed">
                            <p className="text-slate-800 dark:text-[#ece9f0]/90">
                              <strong className="text-slate-900 dark:text-white font-semibold">The Decision: </strong>
                              {d.decision}
                            </p>
                            <p className="text-slate-600 dark:text-muted">
                              <strong className="text-slate-800 dark:text-slate-300 font-semibold">Why this approach: </strong>
                              {d.why}
                            </p>
                          </div>

                          <div className="mt-4 rounded-xl bg-slate-50 dark:bg-[#0c0b0e] p-3 font-mono text-[11px] text-slate-700 dark:text-muted border border-slate-200 dark:border-edge flex items-start gap-2">
                            <Icon.Check className="h-3.5 w-3.5 flex-none text-signal mt-0.5" />
                            <span>
                              <strong>Verified By:</strong> {d.verifiedBy}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Verification Benchmarks */}
          {activeTab === 'verification' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/70 dark:bg-emerald-950/20 p-4">
                <p className="font-sans text-xs text-emerald-900 dark:text-emerald-300 leading-relaxed">
                  <strong>Verification & Regression Benchmarks:</strong> All subsystems are continuously verified against active failure states, edge-case resumes, concurrency races, and upstream provider outages.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {DOSSIER_VERIFICATION.map((v, i) => (
                  <div
                    key={v.title}
                    className="rounded-xl border border-slate-200 dark:border-edge bg-white dark:bg-[#141217] p-4.5 shadow-xs flex items-start gap-3"
                  >
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] font-bold">
                      ✓
                    </span>
                    <div>
                      <h4 className="font-mono text-xs font-bold text-slate-900 dark:text-[#ece9f0]">
                        {v.title}
                      </h4>
                      <p className="mt-1 font-sans text-xs text-slate-600 dark:text-muted leading-relaxed">
                        {v.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Production Tech Stack */}
          {activeTab === 'stack' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/70 dark:bg-purple-950/20 p-4">
                <p className="font-sans text-xs text-purple-900 dark:text-purple-300 leading-relaxed">
                  <strong>Deterministic & Multi-Model Hybrid Stack:</strong> Zero bloated dependencies. The stack pairs Next.js 14 App Router and token-calibrated Tailwind with robust backend agents and strict cryptographic boundaries.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-3">
                {Object.entries(DOSSIER_STACK).map(([category, items]) => (
                  <div
                    key={category}
                    className="rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-[#141217] p-5 shadow-xs"
                  >
                    <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[#ea580c] dark:text-signal border-b border-slate-100 dark:border-edge pb-2.5">
                      {category}
                    </h4>
                    <ul className="mt-3.5 space-y-2">
                      {items.map((item) => (
                        <li key={item} className="flex items-center gap-2 font-mono text-xs text-slate-700 dark:text-muted">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#ea580c] dark:bg-signal" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-edge/60 py-6 sm:py-8 text-center font-mono text-xs text-slate-500 dark:text-muted/60 bg-[#faf9f5] dark:bg-[#0c0b0e] mt-auto">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>GitGrill · Engineering Build Dossier</span>
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
    </main>
  );
}
