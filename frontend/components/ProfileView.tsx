'use client';

import { useState } from 'react';
import { DevProfile } from '@/types/profile';
import { Icon } from '@/components/icons';

function Stat({ label, value, className = '' }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={`rounded-lg border border-edge/60 bg-surface/30 p-3 print:border-zinc-300 print:bg-white print:p-2 ${className}`}>
      <div className="font-mono text-xl font-bold text-ece9f0 print:text-base print:text-zinc-900">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted print:text-zinc-500">
        {label}
      </div>
    </div>
  );
}

function Section({
  id,
  index,
  title,
  subtitle,
  children,
  className = '',
}: {
  id?: string;
  index: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`border-t border-edge py-8 print:py-3.5 print-section ${className}`}>
      <div className="mb-4 flex flex-col gap-1 print:mb-2 print-heading">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-xs font-bold text-signal print:text-amber-800">{index}</span>
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-ece9f0 print:text-zinc-900">
            {title}
          </h2>
        </div>
        {subtitle && (
          <p className="font-mono text-[11px] text-muted print:text-zinc-500">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Pill({
  icon,
  label,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide print:px-2 print:py-0.5 print:text-[10px] ${className}`}
    >
      <span className="flex-none flex items-center">{icon}</span>
      <span>{label}</span>
    </span>
  );
}

const LEVEL_WIDTH: Record<string, number> = {
  primary: 75,
  secondary: 45,
  minor: 20,
  occasional: 20,
};

const SENIORITY_STYLES: Record<string, string> = {
  junior:
    'border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 print:text-zinc-700 print:border-zinc-400 print:bg-zinc-100',
  mid:
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300 print:text-blue-800 print:border-blue-300 print:bg-blue-50',
  senior:
    'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-500/30 dark:bg-purple-950/40 dark:text-purple-300 print:text-purple-800 print:border-purple-300 print:bg-purple-50',
  staff:
    'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-950/40 dark:text-orange-300 print:text-orange-800 print:border-orange-300 print:bg-orange-50',
  principal:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300 print:text-amber-800 print:border-amber-300 print:bg-amber-50',
};

const COLLAB_STYLES: Record<string, string> = {
  high:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 print:text-emerald-800 print:border-emerald-300 print:bg-emerald-50',
  medium:
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300 print:text-blue-800 print:border-blue-300 print:bg-blue-50',
  low:
    'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400 print:text-zinc-700 print:border-zinc-300 print:bg-zinc-100',
  solo:
    'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-950/40 dark:text-orange-300 print:text-orange-800 print:border-orange-300 print:bg-orange-50',
};

const QUALITY_STYLES: Record<string, string> = {
  excellent:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 print:text-emerald-800 print:border-emerald-300 print:bg-emerald-50',
  good:
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300 print:text-blue-800 print:border-blue-300 print:bg-blue-50',
  average:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300 print:text-amber-800 print:border-amber-300 print:bg-amber-50',
  poor:
    'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-300 print:text-rose-800 print:border-rose-300 print:bg-rose-50',
};

const CONSISTENCY_STYLES: Record<string, string> = {
  daily:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 print:text-emerald-800 print:border-emerald-300 print:bg-emerald-50',
  regular:
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300 print:text-blue-800 print:border-blue-300 print:bg-blue-50',
  sporadic:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300 print:text-amber-800 print:border-amber-300 print:bg-amber-50',
  burst:
    'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-950/40 dark:text-orange-300 print:text-orange-800 print:border-orange-300 print:bg-orange-50',
};

const PERSONA_CONFIG: Record<string, { icon: string; label: string; style: string; badge: string; desc: string }> = {
  working_professional: {
    icon: 'briefcase',
    label: 'Working Professional',
    style: 'border-orange-200 bg-orange-50 text-orange-800 dark:border-signal/35 dark:bg-signal/10 dark:text-signal print:border-amber-300 print:bg-amber-50 print:text-amber-900',
    badge: 'Enterprise & Private Repos',
    desc: 'Primary engineering output is in private/corporate repositories. Evaluated through architectural tenure, live demos, and technical depth rather than public hobby commits.',
  },
  fresher_builder: {
    icon: 'zap',
    label: 'Active Builder',
    style: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 print:border-emerald-300 print:bg-emerald-50 print:text-emerald-900',
    badge: 'High Public Velocity',
    desc: 'Demonstrates strong self-driven momentum with active public repositories, personal projects, and continuous learning patterns.',
  },
  open_source_contributor: {
    icon: 'globe',
    label: 'OSS Contributor',
    style: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300 print:border-blue-300 print:bg-blue-50 print:text-blue-900',
    badge: 'Community Code Author',
    desc: 'Proven track record of public pull requests, community package maintenance, and peer-reviewed open-source contributions.',
  },
  specialist: {
    icon: 'target',
    label: 'Domain Specialist',
    style: 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-500/30 dark:bg-purple-950/40 dark:text-purple-300 print:border-purple-300 print:bg-purple-50 print:text-purple-900',
    badge: 'Deep Niche Mastery',
    desc: 'Focused technical mastery in a specialized ecosystem with concentrated contributions, custom tooling, and high architectural depth.',
  },
};

function PersonaIcon({ name, className = 'h-3.5 w-3.5' }: { name: string; className?: string }) {
  const Cmp = (Icon as Record<string, (p: React.SVGProps<SVGSVGElement>) => JSX.Element>)[name] || Icon.Briefcase;
  return <Cmp className={className} />;
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function extractUrl(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s,)]+/i);
  return match ? match[0] : isUrl(value) ? value.trim() : null;
}

function WebChip({
  icon,
  label,
  href,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  sublabel?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-edge bg-card px-4 py-2 font-mono text-xs text-content transition-colors hover:border-signal/50 hover:text-signal print:border-zinc-300 print:bg-white print:text-zinc-800"
    >
      <span className="flex-none text-muted">{icon}</span>
      <span>{label}</span>
      {sublabel && <span className="text-muted print:text-zinc-500">· {sublabel}</span>}
    </a>
  );
}

function expertiseBarWidth(level: string, percentage?: number): string {
  if (typeof percentage === 'number' && percentage > 0) {
    return `${Math.min(percentage, 100)}%`;
  }
  return `${LEVEL_WIDTH[level] ?? 20}%`;
}

export function ProfileView({
  profile,
  mode = 'recruiter',
}: {
  profile: DevProfile;
  mode?: 'recruiter' | 'developer';
}) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'verdict' | 'evidence' | 'signals' | 'interview'>('verdict');
  const g = profile.github;
  const rp = profile.recruiterPanel;

  const isDev = mode === 'developer';

  const copyRecruiterBrief = () => {
    const lines = [
      isDev
        ? `ENGINEERING CAREER PRE-FLIGHT DOSSIER: ${g.name || profile.username} (@${profile.username})`
        : `CANDIDATE INTELLIGENCE DOSSIER: ${g.name || profile.username} (@${profile.username})`,
      `Estimated Seniority: ${rp?.seniorityEstimate?.toUpperCase() || 'ENGINEER'} (${rp?.seniorityReason || ''})`,
      `Candidate Classification: ${rp?.developerPersona ? PERSONA_CONFIG[rp.developerPersona]?.label : 'Engineer'}`,
      `Headline: ${profile.headline}`,
      '',
      'EXECUTIVE HIGHLIGHTS:',
      ...(rp?.standoutFacts || []).map((f) => `• ${f}`),
      '',
      'VERIFIED EXPERTISE: ' + profile.expertise.map((e) => `${e.language} (${e.percentage || 0}%)`).join(', '),
      '',
      'CORE STRENGTHS:',
      ...profile.strengths.map((s) => `+ ${s}`),
      '',
      ...(profile.liveAppAudit
        ? [
            '',
            `LIVE PRODUCTION APP AUDIT: ${profile.liveAppAudit.url}`,
            `Status: ${profile.liveAppAudit.isLive ? 'LIVE' : 'OFFLINE'} (${profile.liveAppAudit.responseTimeMs}ms) · Stack: ${profile.liveAppAudit.detectedStack.framework || 'Web App'} · Hosting: ${profile.liveAppAudit.hostingPlatform || 'Cloud'}`,
            `Architecture: ${profile.liveAppAudit.architectureSummary || 'Inspected production bundle.'}`,
          ]
        : []),
      ...(profile.claimEvidenceMatrix && profile.claimEvidenceMatrix.length > 0
        ? [
            '',
            'CLAIM VS. EVIDENCE MATRIX:',
            ...profile.claimEvidenceMatrix.map(
              (m) => `• [${m.status.toUpperCase()}] ${m.skill}: ${m.detail}`
            ),
          ]
        : []),
      ...(profile.requisitionFit
        ? [
            '',
            `TARGET REQUISITION FIT: ${profile.requisitionFit.roleTitle} (${profile.requisitionFit.matchScore}% Match · ${profile.requisitionFit.verdict.toUpperCase().replace(/_/g, ' ')})`,
            profile.requisitionFit.summary,
            ...profile.requisitionFit.requirements.map(
              (r) => `• [${r.status.toUpperCase()}] ${r.requirement}: ${r.evidence}`
            ),
          ]
        : []),
      ...(rp?.phoneScreenGuide && rp.phoneScreenGuide.length > 0
        ? [
            '',
            '15-MINUTE PHONE SCREEN GUIDE:',
            ...rp.phoneScreenGuide.map(
              (q, i) =>
                `${i + 1}. ${q.question}\n   • Listen for: ${q.whatToListenFor}\n   • Red flag: ${q.redFlagSignal}`
            ),
          ]
        : []),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeColor =
    rp && rp.daysSinceLastCommit <= 30
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 print:border-emerald-300 print:bg-emerald-50 print:text-emerald-800'
      : rp && rp.daysSinceLastCommit <= 90
        ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300 print:border-amber-300 print:bg-amber-50 print:text-amber-800'
        : 'border-edge bg-well text-muted print:border-zinc-300 print:bg-zinc-100 print:text-zinc-700';

  const activeLabel = rp
    ? rp.daysSinceLastCommit <= 30
      ? `Active ${rp.daysSinceLastCommit}d ago`
      : rp.daysSinceLastCommit <= 90
        ? `Active ${rp.daysSinceLastCommit}d ago`
        : `Private Repo Activity · ${rp.daysSinceLastCommit}d Public Gap`
    : null;

  const hnUrl =
    profile.webPresence.hackerNews && /^https?:\/\//i.test(profile.webPresence.hackerNews)
      ? profile.webPresence.hackerNews
      : profile.webPresence.hackerNewsMentions
        ? `https://hn.algolia.com/?q=${encodeURIComponent(g.name || profile.username)}`
        : null;
  const blogUrl = profile.webPresence.blog
    ? extractUrl(profile.webPresence.blog)
    : null;
  const otherUrl = profile.webPresence.other
    ? extractUrl(profile.webPresence.other)
    : null;
  const isTwitter =
    profile.webPresence.other &&
    /twitter|x\.com/i.test(profile.webPresence.other);

  const hnMentionCount =
    profile.webPresence.hackerNewsMentions != null
      ? profile.webPresence.hackerNewsMentions.toLocaleString()
      : profile.webPresence.hackerNews?.match(/([\d,]+)\s*(HN\s*)?mentions?/i)?.[1] ?? null;

  const persona = rp?.developerPersona && PERSONA_CONFIG[rp.developerPersona]
    ? PERSONA_CONFIG[rp.developerPersona]
    : PERSONA_CONFIG.working_professional;

  // Compute a hiring readiness confidence rating
  const confidenceScore = profile.claimEvidenceMatrix && profile.claimEvidenceMatrix.length > 0
    ? Math.min(96, Math.max(82, 85 + (profile.claimEvidenceMatrix.filter(c => c.status === 'verified').length * 3)))
    : 88;

  return (
    <article className="fade-up">
      {/* Executive Branded Print Header (Visible ONLY in Print / PDF export) */}
      <div className="hidden border-b-2 border-zinc-900 pb-3 mb-6 print:flex print:items-center print:justify-between print-avoid-break">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold tracking-widest text-zinc-900">GITGRILL</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-800 bg-zinc-100 px-2.5 py-0.5 rounded-full border border-zinc-300 font-semibold">
              Candidate Intelligence Dossier
            </span>
          </div>
          <p className="font-mono text-[10px] text-zinc-500 mt-1">
            Automated Engineering Assessment & Recruiter Brief · gitgrill.app
          </p>
        </div>
        <div className="text-right font-mono text-[10px] text-zinc-600">
          <div>Candidate: <strong className="text-zinc-900">@{profile.username}</strong></div>
          <div>Level: <strong className="text-zinc-900">{rp?.seniorityEstimate?.toUpperCase() || 'ENGINEER'}</strong></div>
          <div>Date: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        </div>
      </div>

      {/* Candidate Profile Header */}
      <header className="flex flex-col gap-6 pb-6 sm:flex-row sm:items-start print:pb-3 print:gap-4 print-avoid-break">
        {g.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={g.avatarUrl}
            alt={g.name}
            className="h-20 w-20 flex-none rounded-xl border border-edge object-cover shadow-lg print:h-16 print:w-16 print:border-zinc-300"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
            <span className="font-medium text-ece9f0">
              <span className="text-signal">@</span>
              {profile.username}
            </span>
            {g.location && <span>· {g.location}</span>}
            {g.company && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-card px-2.5 py-0.5 text-[11px] text-content/90 print:border-zinc-300 print:bg-zinc-100 print:text-zinc-800">
                <Icon.Building className="h-3 w-3 text-muted" />
                {g.company.replace('@', '')}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-ece9f0 sm:text-3xl print:text-xl print:text-zinc-900">
              {g.name || profile.username}
            </h1>
            {/* Recruiter / Developer Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto print:hidden">
              <button
                onClick={copyRecruiterBrief}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg border border-edge bg-card px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-content shadow-xs transition-all hover:border-signal/50 hover:bg-well hover:text-signal active:scale-95 cursor-pointer text-center"
              >
                <span>{copied ? <Icon.Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> : <Icon.Clipboard className="h-3.5 w-3.5 shrink-0" />}</span>
                <span>
                  {copied
                    ? isDev
                      ? 'Copied Pre-Flight!'
                      : 'Copied ATS Brief!'
                    : isDev
                      ? 'Copy Pre-Flight Sheet'
                      : 'Copy Recruiter Brief'}
                </span>
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg border border-signal/30 bg-signal/[0.08] px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-signal shadow-xs transition-all hover:bg-signal/15 active:scale-95 cursor-pointer text-center"
              >
                <Icon.Printer className="h-3.5 w-3.5 shrink-0" />
                <span>Export PDF</span>
              </button>
            </div>
          </div>

          <p className="mt-2 text-base leading-relaxed text-ece9f0/90 print:text-[13px] print:leading-normal">
            {profile.headline}
          </p>
        </div>
      </header>

      {/* EXECUTIVE VERDICT & HIRING SNAPSHOT (HireJudge Style Hero Card) */}
      <div className="mb-6 rounded-xl border border-edge bg-gradient-to-br from-surface/90 via-surface/60 to-ink p-5 shadow-xl print:border-zinc-300 print:bg-none print:bg-white print:p-3.5 print-avoid-break">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge/60 pb-4 print:border-zinc-300 print:pb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-signal animate-pulse" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted print:text-zinc-600 font-bold">
                {isDev ? 'Career Pre-Flight & Interview Readiness' : 'Executive Candidate Assessment'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-lg font-bold text-ece9f0 print:text-base print:text-zinc-900">
                {rp?.seniorityEstimate?.toUpperCase() || 'ENGINEER'} LEVEL
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-0.5 font-mono text-[11px] font-semibold text-orange-800 dark:border-signal/30 dark:bg-signal/10 dark:text-signal print:border-orange-300 print:bg-orange-50 print:text-orange-900">
                <PersonaIcon name={persona.icon} />
                {persona.label}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-0.5 font-mono text-[11px] font-semibold text-orange-800 dark:border-signal/30 dark:bg-signal/10 dark:text-signal print:border-orange-300 print:bg-orange-50 print:text-orange-900">
                <Icon.Star className="h-3 w-3" />
                Shortlist Recommendation
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div className="rounded-lg border border-edge/80 bg-surface/70 px-4 py-2 print:border-zinc-300 print:bg-white print:px-3 print:py-1">
              <div className="font-mono text-xl font-bold text-signal print:text-amber-800">{confidenceScore}%</div>
              <div className="font-mono text-[9px] uppercase tracking-widest text-muted print:text-zinc-500">
                Signal Confidence
              </div>
            </div>
          </div>
        </div>

        {/* Persona & Working Context Explainer */}
        <div className="mt-3.5 flex items-start gap-3 rounded-lg border border-edge bg-card p-3 print:border-zinc-200 print:bg-zinc-50 print:p-2.5">
          <Icon.Info className="mt-0.5 h-4 w-4 flex-none text-muted print:text-zinc-500" />
          <div className="min-w-0 flex-1 font-mono text-xs leading-relaxed text-muted print:text-[10.5px] print:text-zinc-700">
            <strong className="text-content print:text-zinc-900">{persona.badge}: </strong>
            {rp?.privateWorkContext || persona.desc}
          </div>
        </div>

        {/* Quick Indicators Bar */}
        {rp && (
          <div className="mt-4 flex flex-wrap items-center gap-2 print:mt-2.5 print:gap-1.5">
            {activeLabel && (
              <Pill
                icon={
                  rp.recentlyActive ? (
                    <span className="block h-1.5 w-1.5 rounded-full bg-current" />
                  ) : rp.daysSinceLastCommit <= 90 ? (
                    <span className="block h-1.5 w-1.5 rounded-full border border-current" />
                  ) : (
                    <Icon.Building className="h-3 w-3" />
                  )
                }
                label={activeLabel}
                className={activeColor}
              />
            )}
            <Pill
              icon={<Icon.Check className="h-3 w-3" />}
              label={`Commits: ${rp.commitQuality}`}
              className={QUALITY_STYLES[rp.commitQuality] || QUALITY_STYLES.average}
            />
            <Pill
              icon={<Icon.Users className="h-3 w-3" />}
              label={`Collaboration: ${rp.collaborationLevel}`}
              className={COLLAB_STYLES[rp.collaborationLevel] || COLLAB_STYLES.medium}
            />
            <Pill
              icon={<Icon.Calendar className="h-3 w-3" />}
              label={`Pacing: ${rp.consistencyPattern}`}
              className={CONSISTENCY_STYLES[rp.consistencyPattern] || CONSISTENCY_STYLES.regular}
            />
            {profile.liveAppAudit && profile.liveAppAudit.isLive && (
              <Pill
                icon={<Icon.Globe className="h-3 w-3" />}
                label={`Live App: ${profile.liveAppAudit.detectedStack.framework || 'Shipped'} (${profile.liveAppAudit.responseTimeMs}ms)`}
                className="border-signal/35 bg-signal/10 text-signal print:border-emerald-300 print:bg-emerald-50 print:text-emerald-900"
              />
            )}
          </div>
        )}
      </div>

      {/* REQUISITION FIT SCORECARD (Rendered if candidate was benchmarked against a target role) */}
      {profile.requisitionFit && (
        <div className="mb-6 rounded-2xl border border-signal/30 bg-card bg-gradient-to-br from-signal/[0.07] via-card to-card p-5 sm:p-6 shadow-card print:border-zinc-300 print:bg-none print:bg-white print:p-3.5 print-card">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge/60 pb-3.5 print:border-zinc-300 print:pb-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-signal print:text-amber-800 font-bold">
                  <Icon.Target className="h-3.5 w-3.5" />
                  Target Requisition Match
                </span>
                <span className="rounded-full bg-well px-2.5 py-0.5 font-mono text-[10px] text-muted border border-edge print:bg-white print:border-zinc-300">
                  Role Benchmark
                </span>
              </div>
              <h3 className="mt-1 font-mono text-base font-bold text-content print:text-zinc-900">
                {profile.requisitionFit.roleTitle}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full border px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
                  profile.requisitionFit.verdict === 'strong_match'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300 print:border-emerald-300 print:bg-emerald-50 print:text-emerald-800'
                    : profile.requisitionFit.verdict === 'qualified_with_probes'
                      ? 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-950/40 dark:text-blue-300 print:border-blue-300 print:bg-blue-50 print:text-blue-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300 print:border-amber-300 print:bg-amber-50 print:text-amber-800'
                }`}
              >
                {profile.requisitionFit.verdict.replace(/_/g, ' ')}
              </span>
              <div className="rounded-xl border border-edge bg-well px-3 py-1.5 font-mono text-right print:bg-white print:border-zinc-300 shadow-xs">
                <div className="text-base font-bold text-signal print:text-amber-800">
                  {profile.requisitionFit.matchScore}%
                </div>
                <div className="text-[9px] uppercase tracking-wider text-muted print:text-zinc-600">Fit Score</div>
              </div>
            </div>
          </div>

          <p className="mt-3 font-sans text-xs leading-relaxed text-muted print:text-zinc-700">
            {profile.requisitionFit.summary}
          </p>

          <div className="mt-4 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted print:text-zinc-700 font-bold">
              Must-Have Requirements vs. Verified Evidence:
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {profile.requisitionFit.requirements.map((req, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-edge bg-well/70 p-3 font-mono text-xs print:bg-white print:border-zinc-300"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-content print:text-zinc-900">{req.requirement}</span>
                    <span
                      className={`flex-none rounded-full px-2.5 py-0.5 text-[9px] uppercase tracking-wider font-bold ${
                        req.status === 'met'
                          ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : req.status === 'partially_met'
                            ? 'border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-950/50 dark:text-blue-300'
                            : 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-300'
                      }`}
                    >
                      {req.status === 'met' ? 'Met' : req.status === 'partially_met' ? 'Partial' : 'Gap Probe'}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted print:text-zinc-600">
                    {req.evidence}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {profile.requisitionFit.customProbeQuestions && profile.requisitionFit.customProbeQuestions.length > 0 && (
            <div className="mt-3.5 rounded border border-edge/60 bg-surface/30 p-2.5 font-mono text-[11px] print:bg-white print:border-zinc-300">
              <span className="font-bold text-signal print:text-amber-800">Role-Specific Phone Screen Probes: </span>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-muted print:text-zinc-700">
                {profile.requisitionFit.customProbeQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Recruiter Navigation Bar (Web Only) */}
      <div className="sticky top-[57px] z-20 -mx-4 sm:-mx-6 mb-8 flex items-center justify-between border-y border-edge bg-canvas px-4 sm:px-6 py-2 sm:py-2.5 shadow-xs print:hidden">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => setActiveTab('verdict')}
            className={`rounded-md px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
              activeTab === 'verdict'
                ? 'bg-signal text-white font-semibold shadow-xs'
                : 'text-muted hover:text-content hover:bg-well'
            }`}
          >
            Overview & Facts
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`rounded-md px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
              activeTab === 'evidence'
                ? 'bg-signal text-white font-semibold shadow-xs'
                : 'text-muted hover:text-content hover:bg-well'
            }`}
          >
            Evidence & Live Audit
          </button>
          <button
            onClick={() => setActiveTab('signals')}
            className={`rounded-md px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
              activeTab === 'signals'
                ? 'bg-signal text-white font-semibold shadow-xs'
                : 'text-muted hover:text-content hover:bg-well'
            }`}
          >
            Codebase Signals
          </button>
          <button
            onClick={() => setActiveTab('interview')}
            className={`rounded-md px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors shrink-0 whitespace-nowrap cursor-pointer ${
              activeTab === 'interview'
                ? 'bg-signal text-white font-semibold shadow-xs'
                : 'text-muted hover:text-content hover:bg-well'
            }`}
          >
            15-Min Phone Screen
          </button>
        </div>
        <div className="hidden font-mono text-[10px] text-muted lg:block shrink-0 ml-2">
          Candidate Evaluation View
        </div>
      </div>

      {/* Primary Metrics (GitHub & Project Data) */}
      <div className="grid grid-cols-2 gap-3 pb-8 sm:grid-cols-5 print:pb-2.5 print:gap-2 print-avoid-break">
        <Stat label="Total Stars" value={g.totalStars.toLocaleString()} />
        <Stat label="Public Repos" value={g.publicRepos} />
        <Stat label="Total Forks" value={g.totalForks.toLocaleString()} />
        <Stat label="Network Followers" value={g.followers.toLocaleString()} />
        <Stat label="Member Since" value={g.joinedYear || '—'} className="col-span-2 sm:col-span-1" />
      </div>

      {/* SECTION GROUP 1: OVERVIEW & KEY FACTS */}
      <div className={activeTab === 'verdict' || activeTab === 'signals' ? 'block' : 'hidden print:block'}>
        {rp && rp.standoutFacts.length > 0 && (
          <Section
            id="facts"
            index="01"
            title="Key Facts for Technical Hiring Managers"
            subtitle="Verified highlights synthesized from codebase commits and architectural track record"
            className="print-avoid-break"
          >
            <div className="rounded-xl border border-edge bg-surface/40 p-4 print:border-zinc-300 print:bg-white print:p-3">
              <ul className="space-y-2.5 print:space-y-1.5">
                {rp.standoutFacts.map((fact, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-[15px] font-medium leading-relaxed text-ece9f0/95 print:text-[12px] print:leading-snug print:text-zinc-800"
                  >
                    <span className="flex-none font-mono text-signal print:text-amber-800">+</span>
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>
        )}

        <Section
          id="summary"
          index="02"
          title="Executive Engineering Summary"
          subtitle="Comprehensive architectural and domain background assessment"
          className="print-avoid-break"
        >
          <div className="w-full space-y-3.5 text-[15px] leading-relaxed text-ece9f0/90 print:space-y-1.5 print:text-[12px] print:leading-normal print:text-zinc-800">
            {profile.summary.split('\n').filter(Boolean).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </Section>
      </div>

      {/* SECTION GROUP 2: EVIDENCE & AUDIT (LIVE APP + CLAIM EVIDENCE MATRIX) */}
      <div className={activeTab === 'evidence' || activeTab === 'verdict' ? 'block' : 'hidden print:block'}>
        {profile.liveAppAudit && (
          <Section
            id="live-audit"
            index="03"
            title="Live Deployed Application Audit"
            subtitle="Real-world production inspection of the candidate's deployed project bundle"
            className="print-avoid-break"
          >
            <div className="rounded-xl border border-edge bg-surface/70 p-5 shadow-lg print:border-zinc-400 print:bg-white print:p-3.5 print-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge/60 pb-3 print:border-zinc-300 print:pb-2">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-edge bg-card text-muted print:border-zinc-300">
                    <Icon.Globe className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-signal print:text-amber-800">
                        Inspected Production Target
                      </span>
                      {profile.liveAppAudit.hostingPlatform && (
                        <span className="rounded bg-surface px-2 py-0.5 font-mono text-[10px] text-muted border border-edge print:border-zinc-300 print:bg-zinc-100 print:text-zinc-700">
                          {profile.liveAppAudit.hostingPlatform}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5">
                      <a
                        href={profile.liveAppAudit.finalUrl || profile.liveAppAudit.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-ece9f0 underline decoration-muted/50 hover:text-signal print:text-zinc-900"
                      >
                        {profile.liveAppAudit.url}
                      </a>
                    </div>
                  </div>
                </div>

                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 font-mono text-[11px] font-semibold print:px-2 print:py-0.5 print:text-[10px] ${
                      profile.liveAppAudit.isLive
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-600/50 dark:bg-emerald-950/30 dark:text-emerald-300 print:border-emerald-300 print:bg-emerald-50 print:text-emerald-800'
                        : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-600/50 dark:bg-rose-950/30 dark:text-rose-300 print:border-rose-300 print:bg-rose-50 print:text-rose-800'
                    }`}
                  >
                    <span className="flex-none flex items-center">
                      <span className={`block h-2 w-2 rounded-full bg-current ${profile.liveAppAudit.isLive ? 'animate-pulse' : ''}`} />
                    </span>
                    <span>
                      {profile.liveAppAudit.isLive
                        ? `Live Shipped (${profile.liveAppAudit.responseTimeMs}ms · ${profile.liveAppAudit.speedRating})`
                        : `HTTP Status ${profile.liveAppAudit.status}`}
                    </span>
                  </span>
                </div>
              </div>

              {profile.liveAppAudit.title && (
                <div className="mt-3.5">
                  <div className="font-sans text-sm font-semibold text-ece9f0 print:text-zinc-900">{profile.liveAppAudit.title}</div>
                  {profile.liveAppAudit.description && (
                    <p className="mt-1 text-xs leading-relaxed text-muted print:text-zinc-600">{profile.liveAppAudit.description}</p>
                  )}
                </div>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-2 print:gap-2">
                <div className="rounded-lg border border-edge/60 bg-surface/50 p-3 font-mono text-xs print:border-zinc-300 print:bg-zinc-50 print:p-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted print:text-zinc-600">
                    Detected Production Stack
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {profile.liveAppAudit.detectedStack.framework && (
                      <span className="rounded bg-orange-50 px-2 py-0.5 text-orange-800 border border-orange-200 text-[11px] font-semibold dark:border-signal/20 dark:bg-signal/10 dark:text-signal print:border-amber-300 print:bg-amber-50 print:text-amber-900">
                        {profile.liveAppAudit.detectedStack.framework}
                      </span>
                    )}
                    {profile.liveAppAudit.detectedStack.styling?.map((s, i) => (
                      <span key={i} className="rounded bg-well px-2 py-0.5 text-content border border-edge text-[11px] font-medium print:border-zinc-300 print:bg-white print:text-zinc-800">
                        {s}
                      </span>
                    ))}
                    {profile.liveAppAudit.detectedStack.toolsAndLibraries?.map((t, i) => (
                      <span key={i} className="rounded bg-well px-2 py-0.5 text-content border border-edge text-[11px] font-medium print:border-zinc-300 print:bg-white print:text-zinc-600">
                        {t}
                      </span>
                    ))}
                    {profile.liveAppAudit.detectedStack.backendSignals?.map((b, i) => (
                      <span key={i} className="rounded bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-semibold dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40 print:border-blue-200 print:bg-blue-50 print:text-blue-800">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-edge/60 bg-surface/50 p-3 font-mono text-xs print:border-zinc-300 print:bg-zinc-50 print:p-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted print:text-zinc-600">
                    Production Standards Checklist
                  </div>
                  <div className="mt-2 grid grid-cols-1 xs:grid-cols-2 gap-1.5 text-[11px]">
                    <span className={`inline-flex items-center gap-1 ${profile.liveAppAudit.productionStandards.httpsEnforced ? 'text-signal print:text-emerald-800 font-semibold' : 'text-muted/70 print:text-zinc-500'}`}>
                      {profile.liveAppAudit.productionStandards.httpsEnforced ? <Icon.Check className="h-3 w-3" /> : <Icon.X className="h-3 w-3" />} HTTPS Enforced
                    </span>
                    <span className={`inline-flex items-center gap-1 ${profile.liveAppAudit.productionStandards.mobileResponsive ? 'text-signal print:text-emerald-800 font-semibold' : 'text-muted/70 print:text-zinc-500'}`}>
                      {profile.liveAppAudit.productionStandards.mobileResponsive ? <Icon.Check className="h-3 w-3" /> : <Icon.X className="h-3 w-3" />} Mobile Responsive
                    </span>
                    <span className={`inline-flex items-center gap-1 ${profile.liveAppAudit.productionStandards.hasSeoMeta ? 'text-signal print:text-emerald-800 font-semibold' : 'text-muted/70 print:text-zinc-500'}`}>
                      {profile.liveAppAudit.productionStandards.hasSeoMeta ? <Icon.Check className="h-3 w-3" /> : <Icon.X className="h-3 w-3" />} SEO Meta Present
                    </span>
                    <span className={`inline-flex items-center gap-1 ${profile.liveAppAudit.productionStandards.hasSecurityHeaders ? 'text-signal print:text-emerald-800 font-semibold' : 'text-muted/70 print:text-zinc-500'}`}>
                      {profile.liveAppAudit.productionStandards.hasSecurityHeaders ? <Icon.Check className="h-3 w-3" /> : <Icon.X className="h-3 w-3" />} Security Headers
                    </span>
                  </div>
                </div>
              </div>

              {profile.liveAppAudit.architectureSummary && (
                <div className="mt-3.5 rounded border border-edge/40 bg-surface/30 p-2.5 font-mono text-[11px] leading-relaxed text-muted print:border-zinc-300 print:bg-zinc-50 print:text-[10px] print:text-zinc-700">
                  <strong className="text-ece9f0 print:text-zinc-900">Architecture Insight: </strong>
                  {profile.liveAppAudit.architectureSummary}
                </div>
              )}
            </div>
          </Section>
        )}

        {profile.claimEvidenceMatrix && profile.claimEvidenceMatrix.length > 0 && (
          <Section
            id="claim-matrix"
            index="04"
            title="Claim vs. Evidence Matrix"
            subtitle="Cross-referencing candidate technical claims against verified codebase artifacts and live production builds"
          >
            <div className="w-full space-y-3">
              {profile.claimEvidenceMatrix.map((item, i) => {
                const isVerified = item.status === 'verified';
                const isObserved = item.status === 'production_observed';
                return (
                  <div
                    key={i}
                    className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-edge bg-surface/50 p-4 transition-all hover:border-edge/90 print:border-zinc-300 print:bg-white print:p-2.5 print-card"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-bold text-ece9f0 print:text-zinc-900">{item.skill}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider print:px-1.5 print:py-0.5 ${
                            isVerified
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300 print:border-emerald-300 print:bg-emerald-50 print:text-emerald-800'
                              : isObserved
                                ? 'border border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300 print:border-blue-300 print:bg-blue-50 print:text-blue-800'
                                : 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300 print:border-amber-300 print:bg-amber-50 print:text-amber-800'
                          }`}
                        >
                          <span className="inline-flex items-center gap-1">
                            {isVerified ? (
                              <>
                                <Icon.Check className="h-3 w-3" /> Code Verified
                              </>
                            ) : isObserved ? (
                              <>
                                <Icon.Globe className="h-3 w-3" /> Live Shipped
                              </>
                            ) : (
                              <>
                                <Icon.Search className="h-3 w-3" /> Unverified Claim
                              </>
                            )}
                          </span>
                        </span>
                      </div>
                      <p className="mt-1.5 font-mono text-xs leading-relaxed text-muted print:text-[10.5px] print:text-zinc-700">
                        {item.detail}
                      </p>
                    </div>
                    <div className="flex-none font-mono text-[10px] uppercase text-muted/70 sm:text-right print:text-zinc-500">
                      source: {item.evidenceSource.replace('_', ' ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <Section
          id="expertise"
          index="05"
          title="Verified Technical Stack & Expertise"
          subtitle="Language and framework proficiency backed by codebase analysis"
        >
          <div className="w-full space-y-3.5 print:space-y-1.5">
            {profile.expertise.map((e, i) => (
              <div key={i} className="flex items-center gap-4 print:gap-3">
                <div className="w-32 flex-none font-mono text-sm font-medium text-ece9f0 print:text-[11px] print:w-28 print:text-zinc-900">
                  {e.language}
                  {typeof e.percentage === 'number' && (
                    <span className="ml-1 text-muted print:text-zinc-600 font-semibold">{e.percentage}%</span>
                  )}
                </div>
                <div className="h-2 flex-1 rounded-full bg-edge print:bg-zinc-200">
                  <div
                    className="h-full rounded-full bg-signal transition-all print:bg-amber-700"
                    style={{ width: expertiseBarWidth(e.level, e.percentage) }}
                  />
                </div>
                <div className="hidden w-48 flex-none font-mono text-[11px] text-muted sm:block print:block print:w-44 print:text-[10px] print:text-zinc-600">
                  {e.evidence}
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* SECTION GROUP 3: CODEBASE SIGNALS */}
      <div className={activeTab === 'signals' || activeTab === 'verdict' ? 'block' : 'hidden print:block'}>
        {rp && (
          <Section
            id="commit-intel"
            index="06"
            title="Commit Quality & Development Habits"
            subtitle="Code hygiene, consistency cadence, and collaboration signals"
          >
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 print:gap-2">
              <div className="rounded-lg border border-edge bg-surface/40 p-3 print:border-zinc-300 print:bg-white print:p-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted print:text-zinc-600 font-semibold">
                  Commit Quality
                </div>
                <div
                  className={`mt-1.5 inline-block rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold capitalize ${QUALITY_STYLES[rp.commitQuality] || ''}`}
                >
                  {rp.commitQuality}
                </div>
              </div>
              <div className="rounded-lg border border-edge bg-surface/40 p-3 print:border-zinc-300 print:bg-white print:p-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted print:text-zinc-600 font-semibold">
                  Pacing Cadence
                </div>
                <div
                  className={`mt-1.5 inline-block rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold capitalize ${CONSISTENCY_STYLES[rp.consistencyPattern] || ''}`}
                >
                  {rp.consistencyPattern}
                </div>
              </div>
              <div className="rounded-lg border border-edge bg-surface/40 p-3 print:border-zinc-300 print:bg-white print:p-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted print:text-zinc-600 font-semibold">
                  Collaboration
                </div>
                <div
                  className={`mt-1.5 inline-block rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold capitalize ${COLLAB_STYLES[rp.collaborationLevel] || ''}`}
                >
                  {rp.collaborationLevel}
                </div>
              </div>
              <div className="rounded-lg border border-edge bg-surface/40 p-3 print:border-zinc-300 print:bg-white print:p-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted print:text-zinc-600 font-semibold">
                  Last Active
                </div>
                <div className="mt-1.5 font-mono text-sm font-bold text-ece9f0 print:text-xs print:text-zinc-900">
                  {rp.daysSinceLastCommit}d ago
                </div>
              </div>
            </div>
            {rp.commitStyleInsight && (
              <p className="mt-4 flex w-full items-start gap-2 text-[14px] italic leading-relaxed text-content/80 print:mt-2 print:text-[11px] print:text-zinc-700">
                <Icon.Message className="mt-0.5 h-4 w-4 flex-none text-muted not-italic print:text-zinc-500" />
                <span>{rp.commitStyleInsight}</span>
              </p>
            )}
          </Section>
        )}

        <Section
          id="repos"
          index="07"
          title="Open Source & Flagship Repositories"
          subtitle="Notable public codebases and technical contributions"
        >
          <p className="mb-6 w-full text-[15px] leading-relaxed text-ece9f0/90 print:mb-2.5 print:text-[12px] print:leading-normal print:text-zinc-800">
            {profile.openSourceImpact.narrative}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 print:gap-2">
            {profile.openSourceImpact.topRepos.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="group rounded-xl border border-edge bg-surface/40 p-4 transition-all hover:border-signal/50 print:border-zinc-300 print:bg-white print:p-2.5 print-card"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-ece9f0 group-hover:text-signal print:text-xs print:text-zinc-900">
                    {r.name}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-muted print:text-[10px] print:text-zinc-600">
                    <Icon.Star className="h-3 w-3" />
                    {r.stars.toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ece9f0/80 print:mt-1 print:text-[11px] print:leading-snug print:text-zinc-700">
                  {r.description}
                </p>
                <p className="mt-2 font-mono text-[11px] text-muted print:mt-1 print:text-[9.5px] print:text-zinc-500">
                  {r.why}
                </p>
              </a>
            ))}
          </div>
        </Section>

        <Section
          id="evolution"
          index="08"
          title="Technology Evolution & Growth"
          subtitle="How the candidate's focus and technical stack shifted over time"
          className="print-avoid-break"
        >
          <p className="w-full text-[15px] leading-relaxed text-ece9f0/90 print:text-[12px] print:leading-normal print:text-zinc-800">
            {profile.techEvolution}
          </p>
        </Section>

        <Section
          id="strengths"
          index="09"
          title="Strengths & Growth Areas"
          subtitle="Identified technical spikes alongside areas requiring qualification"
          className="print-avoid-break"
        >
          <div className="grid w-full gap-8 sm:grid-cols-2 print:gap-4">
            <div>
              <h3 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-signal print:text-amber-800 font-bold print:mb-1.5">
                Demonstrated Strengths
              </h3>
              <ul className="space-y-2 print:space-y-1">
                {profile.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-ece9f0/90 print:text-[11.5px] print:leading-snug print:text-zinc-800">
                    <span className="text-signal print:text-amber-800 font-bold">+</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted print:text-zinc-600 font-bold print:mb-1.5">
                Growth Areas & Gaps
              </h3>
              <ul className="space-y-2 print:space-y-1">
                {profile.growthAreas.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-ece9f0/90 print:text-[11.5px] print:leading-snug print:text-zinc-700">
                    <span className="text-muted print:text-zinc-500 font-bold">→</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {(profile.webPresence.hackerNews ||
          profile.webPresence.hackerNewsMentions ||
          profile.webPresence.blog ||
          profile.webPresence.other) && (
          <Section
            id="web-presence"
            index="10"
            title="Public Web & Community Footprint"
            subtitle="External technical presence, discussion forums, and technical writing"
          >
            <div className="flex flex-wrap gap-3 print:gap-2">
              {(hnUrl || hnMentionCount) && (
                <WebChip
                  icon={<Icon.Message className="h-3.5 w-3.5" />}
                  label="Hacker News"
                  href={hnUrl || `https://hn.algolia.com/?q=${encodeURIComponent(g.name || profile.username)}`}
                  sublabel={hnMentionCount ? `${hnMentionCount} mentions` : undefined}
                />
              )}
              {blogUrl && <WebChip icon={<Icon.Globe className="h-3.5 w-3.5" />} label="Tech Blog" href={blogUrl} />}
              {otherUrl && isTwitter && (
                <WebChip icon={<Icon.Link className="h-3.5 w-3.5" />} label="Twitter/X" href={otherUrl} />
              )}
              {otherUrl && !isTwitter && (
                <WebChip icon={<Icon.Link className="h-3.5 w-3.5" />} label="Web Portfolio" href={otherUrl} />
              )}
            </div>
          </Section>
        )}
      </div>

      {/* SECTION GROUP 4: 15-MINUTE INTERVIEW PLAYBOOK */}
      <div className={activeTab === 'interview' || activeTab === 'verdict' ? 'block' : 'hidden print:block'}>
        {rp && rp.phoneScreenGuide && rp.phoneScreenGuide.length > 0 && (
          <Section
            id="screen-guide"
            index="11"
            title="15-Minute Technical Phone Screen Playbook"
            subtitle="Calibrated technical screening questions for recruiters and hiring managers. Probe hands-on depth before escalating to engineering rounds."
          >
            <div className="w-full space-y-4 print:space-y-2.5">
              {rp.phoneScreenGuide.map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-edge bg-surface/60 p-4 transition-all hover:border-signal/30 print:border-zinc-300 print:bg-white print:p-2.5 print-card"
                >
                  <div className="flex items-start gap-3 print:gap-2">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-signal/10 font-mono text-xs font-bold text-signal print:text-zinc-800 print:bg-zinc-100 print:border print:border-zinc-300">
                      Q{i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-[15px] font-semibold text-ece9f0 print:text-[12px] print:text-zinc-900">
                        {item.question}
                      </h4>
                      <div className="mt-3 grid gap-2.5 sm:grid-cols-2 print:mt-1.5 print:gap-2">
                        <div className="rounded-lg border border-signal/25 bg-signal/[0.06] p-3 print:border-emerald-300 print:bg-emerald-50 print:p-2">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-signal print:text-emerald-800 print:text-[10px]">
                            <Icon.Check className="h-3 w-3" /> What to Listen For
                          </div>
                          <p className="mt-1 font-sans text-xs leading-relaxed text-content/90 print:text-[10px] print:leading-snug print:text-zinc-700">
                            {item.whatToListenFor}
                          </p>
                        </div>
                        <div className="rounded-lg border border-edge bg-well p-3 print:border-rose-300 print:bg-rose-50 print:p-2">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-muted print:text-rose-800 print:text-[10px]">
                            <Icon.Alert className="h-3 w-3" /> Red Flag Signal
                          </div>
                          <p className="mt-1 font-sans text-xs leading-relaxed text-content/90 print:text-[10px] print:leading-snug print:text-zinc-700">
                            {item.redFlagSignal}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {rp && (
          <Section
            id="validation-topics"
            index="12"
            title="Candidate Validation & Probe Topics"
            subtitle="Specific architectural questions and potential areas of concern identified during deep analysis"
          >
            <div className="grid w-full gap-8 sm:grid-cols-2 print:gap-4">
              <div>
                <h3 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-signal print:text-amber-800 font-bold print:mb-1.5">
                  Target Technical Topics
                </h3>
                <ul className="space-y-2 print:space-y-1">
                  {rp.interviewTopics.map((topic, i) => (
                    <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-content/90 print:text-[11.5px] print:leading-snug print:text-zinc-800">
                      <Icon.Search className="mt-1 h-3.5 w-3.5 flex-none text-muted print:text-zinc-500" />
                      <span>{topic}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted print:text-zinc-600 font-bold print:mb-1.5">
                  Gaps & Areas to Verify
                </h3>
                {rp.redFlags.length === 0 ? (
                  <p className="flex items-start gap-2 text-[15px] leading-relaxed text-content/80 print:text-emerald-800 print:text-[11.5px]">
                    <Icon.CheckCircle className="mt-1 h-4 w-4 flex-none text-muted print:text-emerald-700" />
                    No significant technical gaps identified in public code or artifacts.
                  </p>
                ) : (
                  <ul className="space-y-2 print:space-y-1">
                    {rp.redFlags.map((flag, i) => (
                      <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-content/85 print:text-rose-800 print:text-[11.5px] print:leading-snug">
                        <Icon.Alert className="mt-1 h-3.5 w-3.5 flex-none text-muted print:text-rose-700" />
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>
        )}
      </div>

      {/* Executive Branded Print Footer (Visible ONLY when printed/saved as PDF) */}
      <div className="hidden border-t border-zinc-300 pt-3 mt-6 print:flex print:items-center print:justify-between font-mono text-[9px] text-zinc-500">
        <span>CONFIDENTIAL · Generated for Hiring Committee Evaluation</span>
        <span>GitGrill Engineering Intelligence Dossier · @{profile.username}</span>
      </div>
    </article>
  );
}
