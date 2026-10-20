'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getPublicProof, ProofSnapshotClient } from '@/lib/proof-pages';
import { GitGrillLogo } from '@/components/GitGrillLogo';
import { Icon } from '@/components/icons';

/**
 * Public Proof Page (/proof/:username/:roleId — ideation §2.3)
 *
 * The recruiter-legible artifact a developer attaches to an application.
 * Served from the published snapshot — a stable, point-in-time record of the
 * exact audit the developer vetted. Honest by design: unverified claims and
 * gap probes are shown, not hidden; the evidence is the product.
 */

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const chip = {
  met: 'border-signal/40 bg-signal/15 text-signal',
  partial: 'border-signal/25 bg-signal/[0.06] text-signal/90',
  gap: 'border-edge bg-well text-muted',
} as const;

function StatusChip({ label, kind }: { label: string; kind: keyof typeof chip }) {
  return (
    <span
      className={`inline-flex flex-none items-center rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${chip[kind]}`}
    >
      {label}
    </span>
  );
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-edge bg-card shadow-card print:break-inside-avoid print:shadow-none">
      <header className="flex items-center justify-between gap-3 border-b border-edge px-5 py-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          {title}
        </h2>
        {right}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export default function ProofPage() {
  const params = useParams();
  const username = String(params.username || '');
  const roleId = String(params.roleId || '');

  const [snap, setSnap] = useState<ProofSnapshotClient | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    getPublicProof(username, roleId)
      .then((data) => {
        if (cancelled) return;
        if (!data) setState('missing');
        else {
          setSnap(data);
          setState('ready');
        }
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
    };
  }, [username, roleId]);

  if (state === 'loading') {
    return (
      <main className="page-texture flex min-h-screen items-center justify-center bg-canvas text-content">
        <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.25em] text-muted">
          <span className="h-2 w-2 animate-pulse rounded-full bg-signal" />
          loading proof
        </div>
      </main>
    );
  }

  if (state !== 'ready' || !snap) {
    return (
      <main className="page-texture flex min-h-screen items-center justify-center bg-canvas px-6 text-content">
        <div className="fade-up w-full max-w-md rounded-xl border border-edge bg-card p-10 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-edge bg-well text-muted">
            <Icon.Link className="h-5 w-5" />
          </div>
          <h1 className="font-mono text-sm font-semibold uppercase tracking-wider text-content">
            {state === 'missing' ? 'Proof page not found' : 'Something went wrong'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {state === 'missing'
              ? 'This link may be incorrect, or the candidate has not published a proof page for this role.'
              : 'The proof page could not be loaded. Try again shortly.'}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-signal"
          >
            <Icon.ArrowUpRight className="h-3 w-3" />
            what is gitgrill
          </Link>
        </div>
      </main>
    );
  }

  const { profile } = snap;
  const fit = profile.requisitionFit;
  const matrix = profile.claimEvidenceMatrix || [];
  const live = profile.liveAppAudit;
  const panel = profile.recruiterPanel;
  const verifiedCount = matrix.filter((m) => m.status === 'verified').length;

  return (
    <main className="page-texture min-h-screen bg-canvas text-content flex flex-col">
      {/* Minimal nav — the page is the artifact; everything else defers to it */}
      <nav className="sticky top-0 z-10 border-b border-edge bg-card/90 backdrop-blur print:hidden flex-none">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <Link href="/" className="flex items-center shrink-0">
            <GitGrillLogo size="sm" />
          </Link>
          <div className="flex items-center gap-2.5 sm:gap-4">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-signal"
            >
              <Icon.Printer className="h-3 w-3" />
              <span>print<span className="hidden xs:inline"> / pdf</span></span>
            </button>
            <Link
              href="/recruiter"
              className="rounded-md border border-edge bg-card px-2.5 sm:px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-signal/50 hover:text-signal"
            >
              <span className="hidden xs:inline">screen with </span>gitgrill
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10 print:max-w-none print:px-0 print:py-0 flex-1 w-full flex flex-col">
        {/* ── Attestation header ─────────────────────────────────────────── */}
        <header className="fade-up mb-8 rounded-xl border border-edge bg-card p-4 sm:p-6 shadow-card print:rounded-none print:border-0 print:p-0">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 sm:gap-6">
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Snapshots are file-backed artifacts that outlive code versions,
                  so a missing GitHub block must not white-screen the page. */}
              {profile.github?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.github.avatarUrl}
                  alt=""
                  className="h-12 w-12 sm:h-14 sm:w-14 flex-none rounded-full border border-edge object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 sm:h-14 sm:w-14 flex-none items-center justify-center rounded-full border border-edge bg-well font-mono text-base sm:text-lg uppercase text-muted">
                  {(profile.github?.name || profile.username || '?').slice(0, 2)}
                </div>
              )}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted">
                  Pre-flight audit · proof of evidence
                </p>
                <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">
                  {profile.github?.name || profile.username}
                  <span className="ml-2 font-mono text-xs sm:text-sm font-normal text-muted block xs:inline">
                    @{profile.username}
                  </span>
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-muted">
                  Assessed against:{' '}
                  <span className="font-medium text-content">{snap.roleTitle}</span>
                </p>
              </div>
            </div>

            {fit && (
              <div className="text-left sm:text-right border-t sm:border-t-0 border-edge pt-3 sm:pt-0">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-4xl sm:text-5xl font-bold leading-none text-signal">
                    {fit.matchScore}
                  </span>
                  <span className="font-mono text-xs text-muted">/100 fit</span>
                </div>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                  {fit.verdict.replace(/_/g, ' ')}
                </p>
              </div>
            )}
          </div>

          {/* Attestation strip */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-edge pt-4">
            <p className="flex items-center gap-2 font-mono text-[11px] leading-relaxed text-muted">
              <Icon.CheckCircle className="h-3.5 w-3.5 flex-none text-signal" />
              <span>
                Attested by GitGrill — audit of public artifacts completed{' '}
                {fmtDate(new Date(profile.generatedAt).getTime() || snap.publishedAt)}. Published{' '}
                {fmtDate(snap.publishedAt)} · snapshot v{snap.version}.
              </span>
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted/60">
              proof · {username} / {roleId.slice(0, 12)}
            </p>
          </div>
        </header>

        {snap.note && (
          <blockquote className="mb-8 rounded-xl border border-edge bg-card px-6 py-4 shadow-card print:break-inside-avoid">
            <p className="text-sm italic leading-relaxed text-content/90">“{snap.note}”</p>
            <footer className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              — candidate&apos;s note
            </footer>
          </blockquote>
        )}

        <div className="grid gap-6 lg:grid-cols-5 print:block">
          {/* ── Requirement scorecard ──────────────────────────────────── */}
          {fit ? (
            <div className="lg:col-span-3">
              <Card
                title="Requirement scorecard"
                right={
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    {fit.requirements.filter((r) => r.status === 'met').length} met ·{' '}
                    {fit.requirements.filter((r) => r.status === 'partially_met').length} partial ·{' '}
                    {fit.requirements.filter((r) => r.status === 'gap_probe').length} gaps
                  </span>
                }
              >
                <ul className="space-y-4">
                  {fit.requirements.map((req, i) => (
                    <li key={i} className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug text-content">
                          {req.requirement}
                        </p>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted">{req.evidence}</p>
                      </div>
                      <StatusChip
                        label={
                          req.status === 'met' ? 'Met' : req.status === 'partially_met' ? 'Partial' : 'Gap'
                        }
                        kind={
                          req.status === 'met' ? 'met' : req.status === 'partially_met' ? 'partial' : 'gap'
                        }
                      />
                    </li>
                  ))}
                </ul>
                {fit.summary && (
                  <p className="mt-5 border-t border-edge pt-4 text-[13px] leading-relaxed text-muted">
                    {fit.summary}
                  </p>
                )}
              </Card>
            </div>
          ) : (
            <div className="lg:col-span-3" />
          )}

          <div className="space-y-6 lg:col-span-2">
            {/* ── Verified claims matrix ───────────────────────────────── */}
            {matrix.length > 0 && (
              <Card
                title="Verified claims"
                right={
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    {verifiedCount}/{matrix.length} verified
                  </span>
                }
              >
                <ul className="space-y-3">
                  {matrix.map((m, i) => (
                    <li key={i} className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-content">{m.skill}</p>
                      <StatusChip
                        label={
                          m.status === 'verified'
                            ? 'Verified'
                            : m.status === 'production_observed'
                              ? 'Observed'
                              : 'Probe'
                        }
                        kind={
                          m.status === 'verified'
                            ? 'met'
                            : m.status === 'production_observed'
                              ? 'partial'
                              : 'gap'
                        }
                      />
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-edge pt-3 text-[11px] leading-relaxed text-muted/80">
                  “Probe” = claimed but not evidenced publicly. GitGrill flags these for the
                  interview — honesty is the point.
                </p>
              </Card>
            )}

            {/* ── Live app audit ───────────────────────────────────────── */}
            {live && (
              <Card title="Live artifact audit">
                <a
                  href={live.finalUrl || live.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 truncate font-mono text-xs text-signal hover:underline"
                >
                  <Icon.ArrowUpRight className="h-3 w-3 flex-none" />
                  {live.url}
                </a>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-muted">
                  <span className={live.isLive ? 'text-signal' : ''}>
                    {live.isLive ? '● live' : '○ down'} · {live.status}
                  </span>
                  <span>{live.responseTimeMs}ms · {live.speedRating}</span>
                  {live.hostingPlatform && <span>{live.hostingPlatform}</span>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {[
                    ['HTTPS enforced', live.productionStandards.httpsEnforced],
                    ['Mobile responsive', live.productionStandards.mobileResponsive],
                    ['SEO meta', live.productionStandards.hasSeoMeta],
                    ['Security headers', live.productionStandards.hasSecurityHeaders],
                  ].map(([label, ok]) => (
                    <span
                      key={label as string}
                      className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider ${
                        ok ? 'text-content' : 'text-muted/50 line-through'
                      }`}
                    >
                      <Icon.Check className="h-3 w-3 flex-none" style={ok ? undefined : { opacity: 0.35 }} />
                      {label as string}
                    </span>
                  ))}
                </div>
                {(live.detectedStack.framework || (live.detectedStack.toolsAndLibraries || []).length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-edge pt-3">
                    {live.detectedStack.framework && (
                      <span className="rounded border border-edge bg-well px-2 py-0.5 font-mono text-[10px] text-muted">
                        {live.detectedStack.framework}
                      </span>
                    )}
                    {(live.detectedStack.toolsAndLibraries || []).slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded border border-edge bg-well px-2 py-0.5 font-mono text-[10px] text-muted"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* ── Candidate snapshot ───────────────────────────────────── */}
            {panel && (
              <Card title="Signal snapshot">
                <dl className="space-y-2.5">
                  {[
                    ['Seniority', panel.seniorityEstimate],
                    ['Collaboration', panel.collaborationLevel],
                    ['Commit quality', panel.commitQuality],
                    [
                      'Activity',
                      panel.daysSinceLastCommit <= 7
                        ? 'active this week'
                        : `last commit ${panel.daysSinceLastCommit}d ago`,
                    ],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex items-baseline justify-between gap-4">
                      <dt className="font-mono text-[10px] uppercase tracking-wider text-muted">{k}</dt>
                      <dd className="font-mono text-xs capitalize text-content">{v as string}</dd>
                    </div>
                  ))}
                </dl>
                {panel.standoutFacts.length > 0 && (
                  <ul className="mt-4 space-y-2 border-t border-edge pt-3">
                    {panel.standoutFacts.slice(0, 3).map((fact, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] leading-relaxed text-muted">
                        <Icon.Zap className="mt-0.5 h-3 w-3 flex-none text-signal" />
                        {fact}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </div>
        </div>

        {/* ── Free-tier attribution (§11 decision 12) ──────────────────── */}
        {snap.branded !== false && (
          <p className="mt-8 border-t border-edge pt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Built with GitGrill
          </p>
        )}

        {/* ── Footer CTA (hidden in print) ─────────────────────────────── */}
        <footer className="mt-auto flex-none flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-edge pt-6 print:hidden">
          <p className="max-w-lg text-[13px] leading-relaxed text-muted">
            This page is a point-in-time snapshot generated by{' '}
            <span className="font-medium text-content">GitGrill</span> — the evidence layer for
            technical hiring. Re-run an audit for current signal.
          </p>
          <Link
            href="/"
            className="w-full sm:w-auto justify-center inline-flex items-center gap-1.5 rounded-lg bg-signal px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:bg-signal/90 active:scale-95 text-center"
          >
            <Icon.Search className="h-3 w-3" />
            audit a candidate
          </Link>
        </footer>
      </div>
    </main>
  );
}
