'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { BkashNagadModal } from '@/components/BkashNagadModal';
import { PlanId } from '@/lib/billing';

export function PricingSection() {
  const [pricingAudience, setPricingAudience] = useState<'developer' | 'recruiter'>('developer');
  const [annual, setAnnual] = useState(false);
  const [showBkashModal, setShowBkashModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('pro_monthly');

  const handleFreeCta = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const input = document.querySelector('input');
    input?.focus();
  };

  const handleProCta = (plan: PlanId = 'pro_monthly') => {
    setSelectedPlan(plan);
    setShowBkashModal(true);
  };

  return (
    <section id="pricing" className="relative py-20 sm:py-28 border-b border-slate-200 dark:border-edge/60 bg-[#faf9f5] dark:bg-[#0c0b0e] scroll-mt-16">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-[#ea580c] dark:text-signal font-semibold">
            <span>●</span> Transparent Pricing & Plans
          </div>
          <h2 className="mt-4 font-sans text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-900 dark:text-[#ece9f0]">
            Predictable plans for <span className="text-[#ea580c] dark:text-signal">builders & hiring teams.</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-600 dark:text-muted">
            No token surprises or hidden API meters. Start free with 3 audits and an immutable Resume Vault, or go Pro for full Job Pre-Flights, variant branching, and deep code defense.
          </p>

          {/* Primary Audience Segmented Switcher */}
          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center p-1 rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/80 shadow-sm backdrop-blur-md">
              <button
                type="button"
                onClick={() => setPricingAudience('developer')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all ${
                  pricingAudience === 'developer'
                    ? 'bg-[#ea580c] dark:bg-signal text-white dark:text-ink shadow-xs'
                    : 'text-slate-600 dark:text-muted hover:text-slate-900 dark:hover:text-[#ece9f0]'
                }`}
              >
                <Icon.Monitor className="h-3.5 w-3.5" />
                <span>For Developers & Job Seekers</span>
              </button>
              <button
                type="button"
                onClick={() => setPricingAudience('recruiter')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all ${
                  pricingAudience === 'recruiter'
                    ? 'bg-[#ea580c] dark:bg-signal text-white dark:text-ink shadow-xs'
                    : 'text-slate-600 dark:text-muted hover:text-slate-900 dark:hover:text-[#ece9f0]'
                }`}
              >
                <Icon.Building className="h-3.5 w-3.5" />
                <span>For Hiring Teams & Recruiters</span>
              </button>
            </div>
          </div>

          {/* Unified Billing Cycle Segmented Control */}
          <div className="mt-5 flex justify-center">
            <div className="inline-flex items-center rounded-full border border-slate-200 dark:border-edge bg-white dark:bg-surface/80 p-1 shadow-2xs backdrop-blur-md">
              <button
                type="button"
                onClick={() => setAnnual(false)}
                className={`rounded-full px-4 py-1.5 font-mono text-xs font-semibold tracking-wider transition-all ${
                  !annual
                    ? 'bg-slate-900 dark:bg-[#ece9f0] text-white dark:text-ink shadow-xs'
                    : 'text-slate-600 dark:text-muted hover:text-slate-900 dark:hover:text-[#ece9f0]'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setAnnual(true)}
                className={`rounded-full px-4 py-1.5 font-mono text-xs font-semibold tracking-wider transition-all flex items-center gap-2 ${
                  annual
                    ? 'bg-slate-900 dark:bg-[#ece9f0] text-white dark:text-ink shadow-xs'
                    : 'text-slate-600 dark:text-muted hover:text-slate-900 dark:hover:text-[#ece9f0]'
                }`}
              >
                <span>Annual</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight transition-colors ${
                    annual
                      ? 'bg-emerald-400 text-slate-950 font-extrabold'
                      : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30'
                  }`}
                >
                  {pricingAudience === 'developer' ? 'Save 27% (2 mos free)' : 'Save 20% on Annual'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* DEVELOPER CAREEROS PRICING GRID */}
        {pricingAudience === 'developer' && (
          <div className="mt-12 grid gap-8 lg:grid-cols-3 items-stretch">
            {/* Dev Plan 1: Free Starter */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/60 p-7 shadow-sm hover:shadow-md transition-shadow">
              <div>
                <div className="font-mono text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-muted">
                  Free Starter
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-sans text-4xl font-extrabold tracking-tight text-slate-900 dark:text-[#ece9f0]">
                    ৳0
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-muted">
                    / free forever
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-muted">
                  No credit card required · Instant access
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-muted">
                  Essential tools for developers starting a job search and testing baseline code fit.
                </p>

                <div className="mt-6 border-t border-slate-100 dark:border-edge/50 pt-6">
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-[#ece9f0] mb-3">
                    Included in Free:
                  </div>
                  <ul className="space-y-2.5 font-mono text-xs text-slate-600 dark:text-muted">
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span><strong>Resume Vault:</strong> 1 Master CV with 2D coordinate PDF & DOCX parser</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span><strong>1 Tailored Variant:</strong> Branch v1.1 with in-place bullet editing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span><strong>1 Target Job Fit Pre-Flight:</strong> Cross-reference JD requirements against git code</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span><strong>3 fresh profile & code audits</strong> / every 30 days</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span><strong>1 shareable public Proof Page</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span>Headless live web bundle audit (Next.js, Tailwind, latency)</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <Link
                  href="/developer"
                  className="block w-full text-center rounded-xl border border-slate-200 dark:border-edge bg-slate-50 dark:bg-card px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-[#ece9f0] transition-colors hover:border-[#ea580c] hover:text-[#ea580c] dark:hover:border-signal dark:hover:text-signal shadow-xs"
                >
                  Open Free CareerOS →
                </Link>
              </div>
            </div>

            {/* Dev Plan 2: Developer Pro (Highlighted) */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-[#ea580c] dark:border-signal bg-white dark:bg-surface p-7 shadow-xl ring-4 ring-[#ea580c]/10 dark:ring-signal/15">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#ea580c] dark:bg-signal px-3.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white dark:text-ink shadow-sm">
                Most Popular
              </div>

              <div>
                <div className="font-mono text-xs font-bold uppercase tracking-widest text-[#ea580c] dark:text-signal">
                  Developer Pro
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-2">
                  <span className="font-sans text-4xl font-extrabold tracking-tight text-slate-900 dark:text-[#ece9f0]">
                    {annual ? '৳3,490' : '৳399'}
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-muted">
                    {annual ? '/ year' : '/ month'}
                  </span>
                </div>

                {annual ? (
                  <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                    <Icon.Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Save ৳1,298 · 2 months free (only ৳290/mo)</span>
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-muted">
                    bKash or Nagad · Instant 24h provisional activation
                  </div>
                )}

                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-muted">
                  Full career pre-flight intelligence, unlimited resume branching, and adversarial code defense for active job hunters.
                </p>

                <div className="mt-6 border-t border-slate-100 dark:border-edge/50 pt-6">
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-[#ece9f0] mb-3">
                    Everything in Free, plus:
                  </div>
                  <ul className="space-y-2.5 font-mono text-xs text-slate-600 dark:text-muted">
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong className="text-slate-900 dark:text-[#ece9f0]">Unlimited Resume Vault Variants:</strong> Branch tailored v1.1, v2.0 without altering master CV</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong className="text-slate-900 dark:text-[#ece9f0]">AI Job Pre-Flight Audits:</strong> Full Claim vs Evidence fit analysis against any JD</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong className="text-slate-900 dark:text-[#ece9f0]">Tailored Variant Studio:</strong> Auto-tune Experience & Project bullets backed by git proof</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong className="text-slate-900 dark:text-[#ece9f0]">Tier 2 Deep Code Audit:</strong> Real source code exploration & commit diff forensics</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong className="text-slate-900 dark:text-[#ece9f0]">Adversarial Code Defense:</strong> Line-level interview defense drills with Senior/Staff rubric</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong className="text-slate-900 dark:text-[#ece9f0]">Printable PDF Engine:</strong> Export high-contrast CVs & dossiers ready for submission</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong>Priority Multi-Model LLM Gateway:</strong> Gemini 2.5 Flash + Groq (zero queue delay)</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => handleProCta(annual ? 'pro_annual' : 'pro_monthly')}
                  className="w-full rounded-xl bg-[#ea580c] hover:bg-[#c2410c] dark:bg-signal dark:hover:bg-signal/90 px-4 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-white dark:text-ink shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <span>Get Pro with bKash / Nagad →</span>
                </button>
              </div>
            </div>

            {/* Dev Plan 3: 90-Day Job Hunt Season Pass */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/60 p-7 shadow-sm hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-muted">
                    Job Hunt Season Pass
                  </span>
                  <span className="rounded-full bg-orange-100 dark:bg-signal/15 px-2 py-0.5 font-mono text-[9px] font-bold text-[#ea580c] dark:text-signal border border-orange-200 dark:border-signal/30 uppercase">
                    3-Month Sprint
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-2">
                  <span className="font-sans text-4xl font-extrabold tracking-tight text-slate-900 dark:text-[#ece9f0]">
                    ৳899
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-muted">
                    / 90 days total
                  </span>
                </div>

                <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-orange-200 dark:border-signal/30 bg-orange-50 dark:bg-signal/10 px-2.5 py-1 font-mono text-[11px] font-bold text-[#ea580c] dark:text-signal">
                  <Icon.Check className="h-3.5 w-3.5" />
                  <span>Save 25% vs monthly · Only ৳299/mo across 3 months</span>
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-muted">
                  Tailored for active candidates running an intensive 90-day job search campaign across multiple target companies.
                </p>

                <div className="mt-6 border-t border-slate-100 dark:border-edge/50 pt-6">
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-[#ece9f0] mb-3">
                    All Pro Features for 90 Days:
                  </div>
                  <ul className="space-y-2.5 font-mono text-xs text-slate-600 dark:text-muted">
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-signal mt-0.5" />
                      <span><strong>Complete 90-Day Coverage:</strong> No recurring monthly renewal stress</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-signal mt-0.5" />
                      <span><strong>Unlimited Target Roles:</strong> Track multiple companies from application to offer</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-signal mt-0.5" />
                      <span><strong>Unlimited Resume Variants:</strong> Generate dedicated CVs for every opening</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-signal mt-0.5" />
                      <span><strong>Unlimited Deep Code Audits</strong> & mock defense questions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-signal mt-0.5" />
                      <span>Instant bKash/Nagad activation with 24-hr provisional access</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => handleProCta('pro_monthly')}
                  className="w-full rounded-xl border border-slate-200 dark:border-edge bg-slate-50 dark:bg-card hover:border-[#ea580c] hover:text-[#ea580c] dark:hover:border-signal dark:hover:text-signal px-4 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-[#ece9f0] transition-colors shadow-xs"
                >
                  Get 90-Day Pass (৳899) →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RECRUITER TALENTOS PRICING GRID */}
        {pricingAudience === 'recruiter' && (
          <div className="mt-12 grid gap-8 lg:grid-cols-3 items-stretch">
            {/* Recruiter Plan 1: Solo Recruiter / Co-Pilot */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/60 p-7 shadow-sm hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-muted">
                    Solo Recruiter
                  </span>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 uppercase">
                    Personal Co-Pilot
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-2">
                  <span className="font-sans text-4xl font-extrabold tracking-tight text-slate-900 dark:text-[#ece9f0]">
                    {annual ? '৳665' : '৳999'}
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-muted">
                    {annual ? '/ mo (৳7,990/yr)' : '/ month'}
                  </span>
                </div>

                <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-muted">
                  Less than half the price of Claude Pro · Out-of-pocket affordable
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-muted">
                  Personal talent screening assistant for independent recruiters, tech leads, and founders vetting candidates.
                </p>

                <div className="mt-6 border-t border-slate-100 dark:border-edge/50 pt-6">
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-[#ece9f0] mb-3">
                    Included in Solo Recruiter:
                  </div>
                  <ul className="space-y-2.5 font-mono text-xs text-slate-600 dark:text-muted">
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span><strong>30 Candidate Audits</strong> / month</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span><strong>3 Active Job Requisitions</strong> with custom guardrails</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span><strong>Claim vs. Evidence Matrix</strong> on every profile</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span><strong>15-Minute Calibrated Phone Screen Guides</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span>1-Click Executive PDF & 1-Pager EM Brief exports</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <Link
                  href="/recruiter"
                  className="block w-full text-center rounded-xl border border-slate-200 dark:border-edge bg-slate-50 dark:bg-card px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-[#ece9f0] transition-colors hover:border-signal hover:text-signal shadow-xs"
                >
                  Start Solo Workspace →
                </Link>
              </div>
            </div>

            {/* Recruiter Plan 2: Recruiter Pro (Highlighted) */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-[#ea580c] dark:border-signal bg-white dark:bg-surface p-7 shadow-xl ring-4 ring-[#ea580c]/10 dark:ring-signal/15">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#ea580c] dark:bg-signal px-3.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-white dark:text-ink shadow-sm">
                Matches Claude Pro Cost
              </div>

              <div>
                <div className="font-mono text-xs font-bold uppercase tracking-widest text-[#ea580c] dark:text-signal">
                  Recruiter Pro (Team)
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-2">
                  <span className="font-sans text-4xl font-extrabold tracking-tight text-slate-900 dark:text-[#ece9f0]">
                    {annual ? '৳1,665' : '৳2,490'}
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-muted">
                    {annual ? '/ mo (৳19,990/yr)' : '/ month (~$22)'}
                  </span>
                </div>

                <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-muted">
                  Same cost as 1 Claude/ChatGPT Pro seat · Built for hiring teams
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-muted">
                  Batch pipeline screening, CSV candidate ranking, deep source code review, and automated hiring committee briefs.
                </p>

                <div className="mt-6 border-t border-slate-100 dark:border-edge/50 pt-6">
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-[#ece9f0] mb-3">
                    Everything in Solo, plus:
                  </div>
                  <ul className="space-y-2.5 font-mono text-xs text-slate-600 dark:text-muted">
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong>100 Candidate Audits</strong> / month</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong>10 Active Job Requisitions</strong> with bias shield</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong>Batch Candidate CSV Upload & Ranking</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong>Tier 2 Deep Code Forensics:</strong> Source tree & commit diff analysis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong>Candidate Leaderboards</strong> & team interview notes</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-[#ea580c] dark:text-signal mt-0.5" />
                      <span><strong>3 Team Seats Included</strong></span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <Link
                  href="/recruiter"
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] dark:bg-signal dark:hover:bg-signal/90 px-4 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-white dark:text-ink shadow-md transition-all active:scale-95"
                >
                  <span>Launch Recruiter Pro →</span>
                </Link>
              </div>
            </div>

            {/* Recruiter Plan 3: Enterprise & Agency */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-edge bg-white dark:bg-surface/60 p-7 shadow-sm hover:shadow-md transition-shadow">
              <div>
                <div className="font-mono text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-muted">
                  Agency & Enterprise
                </div>
                <div className="mt-4 flex flex-wrap items-baseline gap-2">
                  <span className="font-sans text-4xl font-extrabold tracking-tight text-slate-900 dark:text-[#ece9f0]">
                    {annual ? '৳4,160' : '৳5,990'}
                  </span>
                  <span className="font-mono text-xs text-slate-500 dark:text-muted">
                    {annual ? '/ mo (৳49,990/yr)' : '/ month (~$55)'}
                  </span>
                </div>

                <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-muted">
                  High-volume talent pipelines & agency clients
                </div>

                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-muted">
                  For tech staffing agencies and scale-ups managing ongoing client pipelines with custom evaluation rubrics.
                </p>

                <div className="mt-6 border-t border-slate-100 dark:border-edge/50 pt-6">
                  <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-[#ece9f0] mb-3">
                    Agency Privileges:
                  </div>
                  <ul className="space-y-2.5 font-mono text-xs text-slate-600 dark:text-muted">
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-blue-600 dark:text-blue-400 mt-0.5" />
                      <span><strong>Unlimited Candidate Audits</strong> & requisitions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-blue-600 dark:text-blue-400 mt-0.5" />
                      <span><strong>Custom Senior/Staff Guardrail Rubrics</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-blue-600 dark:text-blue-400 mt-0.5" />
                      <span><strong>Greenhouse & Lever ATS Export Formatting</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-blue-600 dark:text-blue-400 mt-0.5" />
                      <span>Unlimited team seats & audit history</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Icon.Check className="h-4 w-4 flex-none text-blue-600 dark:text-blue-400 mt-0.5" />
                      <span>Dedicated technical account manager & priority queue</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <Link
                  href="/recruiter"
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-edge bg-slate-50 dark:bg-card px-4 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-slate-900 dark:text-[#ece9f0] transition-colors hover:border-signal hover:text-signal shadow-xs"
                >
                  Contact Agency Team →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Guarantees & MFS Trust Bar */}
        <div className="mt-12 rounded-2xl border border-slate-200 dark:border-edge/70 bg-white/70 dark:bg-surface/50 p-5 shadow-sm backdrop-blur-md">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Accepted MFS Badges */}
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-semibold text-slate-700 dark:text-muted">Payment Methods:</span>
              <span className="inline-flex items-center rounded-lg border border-pink-200 dark:border-pink-900/40 bg-pink-50 dark:bg-pink-950/30 px-2.5 py-1 font-mono text-[11px] font-bold text-pink-700 dark:text-pink-300">
                bKash
              </span>
              <span className="inline-flex items-center rounded-lg border border-orange-200 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-950/30 px-2.5 py-1 font-mono text-[11px] font-bold text-orange-700 dark:text-orange-300">
                Nagad
              </span>
            </div>

            {/* Instant Activation Guarantee */}
            <div className="flex items-center gap-2 font-mono text-xs text-slate-600 dark:text-muted">
              <Icon.Zap className="h-4 w-4 text-[#ea580c] dark:text-signal flex-none" />
              <span>
                <strong>24-Hour Instant Provisional Access:</strong> Submit your bKash/Nagad TrxID for immediate access with zero wait time.
              </span>
            </div>
          </div>
        </div>

        {/* bKash & Nagad Modal */}
        {showBkashModal && (
          <BkashNagadModal
            isOpen={showBkashModal}
            defaultPlan={selectedPlan}
            onClose={() => setShowBkashModal(false)}
          />
        )}
      </div>
    </section>
  );
}
