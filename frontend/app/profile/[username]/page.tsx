'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useDevScopeStream } from '@/hooks/useDevScopeStream';
import { AgentTrace } from '@/components/AgentTrace';
import { AgentProgress } from '@/components/AgentProgress';
import { ProfileView } from '@/components/ProfileView';
import { DeepCodeAuditModal } from '@/components/DeepCodeAuditModal';
import { Icon } from '@/components/icons';
import { getRequisitionById } from '@/lib/requisitions';
import { getJobProjectById, addCandidateToProject } from '@/lib/job-projects';
import { getTargetRoleById, recordAuditForRole } from '@/lib/target-roles';
import { PublishProofBar } from '@/components/PublishProofBar';
import { DemoWall, DemoSignupBanner } from '@/components/DemoUpsell';
import { GitGrillLogo } from '@/components/GitGrillLogo';

export default function ProfilePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const username = String(params.username || '');
  const liveUrl = searchParams.get('liveUrl') || undefined;
  const roleId = searchParams.get('roleId') || undefined;
  const jobId = searchParams.get('jobId') || undefined;
  const targetRoleId = searchParams.get('targetRoleId') || undefined;
  const rawJd = searchParams.get('jd') || undefined;
  const mode = searchParams.get('mode') === 'developer' ? 'developer' : 'recruiter';

  let activeJd = rawJd;
  let activeTitle = searchParams.get('roleTitle') || undefined;

  // Resolve from JobProject if jobId is supplied (RecruiterOS Engine)
  if (jobId) {
    const project = getJobProjectById(jobId);
    if (project) {
      activeJd = project.requisition.rawJdText;
      activeTitle = project.title;
    }
  } else if (targetRoleId) {
    // Resolve from CareerOS target role (Developer Campaign Engine)
    const target = targetRoleId ? getTargetRoleById(targetRoleId) : undefined;
    if (target) {
      activeJd = target.rawJdText;
      activeTitle = target.title;
    }
  } else if (roleId) {
    const saved = getRequisitionById(roleId);
    if (saved) {
      activeJd = saved.rawJdText;
      activeTitle = saved.title;
    }
  }

  const { status, trace, profile, cached, error, generate, reset } = useDevScopeStream();
  const [showDeepAudit, setShowDeepAudit] = useState(false);

  useEffect(() => {
    if (username) generate(username, false, liveUrl, activeJd, activeTitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, liveUrl, roleId, jobId, rawJd, targetRoleId]);

  // Auto-record assessed candidate into Job Project pipeline upon completion
  useEffect(() => {
    if (status === 'complete' && profile && jobId) {
      const fit = profile.requisitionFit;
      try {
        addCandidateToProject(jobId, {
          username: profile.username,
          fullName: profile.github.name || profile.username,
          avatarUrl: profile.github.avatarUrl,
          liveUrl: profile.liveAppAudit?.url || liveUrl,
          fitScore: fit?.matchScore || 75,
          verdict: fit?.verdict || 'strong_match',
          seniorityEstimate: (profile.recruiterPanel?.seniorityEstimate as any) || 'senior',
          persona: profile.recruiterPanel?.developerPersona || 'working_professional',
          signalConfidence: 94,
          requirementsSummary: {
            metCount: fit?.requirements.filter((r) => r.status === 'met').length || 0,
            partialCount: fit?.requirements.filter((r) => r.status === 'partially_met').length || 0,
            missingCount: fit?.requirements.filter((r) => r.status === 'gap_probe').length || 0,
          },
          recruiterNotes: profile.headline || 'Automated screening assessment',
          pipelineStage: 'new_assessed',
        });
      } catch {
        /* ignore */
      }
    }
  }, [status, profile, jobId, liveUrl]);

  // Auto-record developer pre-flight audit into the CareerOS target role ledger
  useEffect(() => {
    if (status === 'complete' && profile && targetRoleId) {
      try {
        recordAuditForRole(targetRoleId, profile);
      } catch {
        /* ignore */
      }
    }
  }, [status, profile, targetRoleId]);

  const isWorking = status === 'connecting' || status === 'streaming';

  return (
    <main className="page-texture min-h-screen bg-canvas text-content flex flex-col">
      <nav className="sticky top-0 z-30 border-b border-edge bg-canvas shadow-xs print:hidden flex-none">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <Link href="/" className="flex items-center shrink-0">
            <GitGrillLogo size="sm" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {status === 'complete' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowDeepAudit(true)}
                  className="rounded-md border border-[#ea580c]/50 bg-[#ea580c]/10 hover:bg-[#ea580c]/20 px-2.5 sm:px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#ea580c] dark:text-signal transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
                >
                  <span className="hidden xs:inline">Tier 2 Code Audit</span>
                  <span className="xs:hidden">Tier 2</span>
                </button>
                <button
                  onClick={() => generate(username, true, liveUrl, activeJd, activeTitle)}
                  className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-signal cursor-pointer shrink-0"
                  title="Regenerate analysis"
                >
                  <Icon.Refresh className="h-3 w-3" />
                  <span className="hidden sm:inline">regenerate</span>
                </button>
              </>
            )}
            <Link
              href="/"
              className="rounded-md border border-edge bg-card px-2.5 sm:px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-signal/50 hover:text-signal shrink-0 whitespace-nowrap"
            >
              <span className="hidden sm:inline">+ analyze another</span>
              <span className="sm:hidden">+ new</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10 print:max-w-none print:p-0 flex-1 w-full flex flex-col">
        {error &&
          (error.code === 'demo_exhausted' ||
            error.code === 'rate_limited' ||
            error.code === 'quota_exhausted') && (
          <div className="my-auto">
            <DemoWall code={error.code} username={username} message={error.message} />
          </div>
        )}
        {error &&
          error.code !== 'demo_exhausted' &&
          error.code !== 'rate_limited' &&
          error.code !== 'quota_exhausted' && (
          <div className="fade-up mx-auto my-auto max-w-xl rounded-xl border border-edge/80 bg-surface/90 p-8 text-center shadow-2xl print:hidden">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-edge bg-well text-muted">
            <Icon.Alert className="h-5 w-5" />
          </div>
            <h3 className="font-mono text-sm font-semibold uppercase tracking-wider text-signal">
              Analysis Temporarily Paused
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ece9f0/90">
              {error.message}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => generate(username, true, liveUrl, activeJd, activeTitle)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:bg-signal/90 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
              >
                <Icon.Refresh className="h-3.5 w-3.5" />
                Retry Analysis
              </button>
              <Link
                href="/"
                className="rounded-lg border border-edge bg-surface/60 px-5 py-2.5 font-mono text-xs font-medium uppercase tracking-wider text-muted transition-all hover:border-signal/50 hover:text-ece9f0"
              >
                ← Analyze Another Candidate
              </Link>
            </div>
            {error.technicalDetails && (searchParams.get('debug') === 'true' || process.env.NODE_ENV === 'development') && (
              <details className="mt-6 text-left border-t border-edge/60 pt-4">
                <summary className="cursor-pointer font-mono text-[11px] text-muted hover:text-signal">
                  Technical Diagnostics (Developer Debug)
                </summary>
                <div className="mt-2 max-h-36 overflow-y-auto rounded bg-ink/70 p-3 font-mono text-[11px] leading-relaxed text-zinc-400 border border-edge/40 break-all select-all">
                  {error.technicalDetails}
                </div>
              </details>
            )}
            {error.code === 'connection_blocked' && (searchParams.get('debug') === 'true' || process.env.NODE_ENV === 'development') && (
              <p className="mt-4 rounded-lg border border-edge/60 bg-well/60 p-3 font-mono text-[11px] leading-relaxed text-muted">
                admin fix: add <span className="text-signal">this site's origin</span> to the backend
                env <span className="text-signal">ALLOWED_ORIGINS</span> (or fix
                <span className="text-signal"> NEXT_PUBLIC_API_URL</span> on the frontend) and
                redeploy both services.
              </p>
            )}
          </div>
        )}

        {!error && isWorking && (
          <div className="my-auto">
            <AgentProgress username={username} trace={trace} />
          </div>
        )}

        {!error && status === 'complete' && profile && (
          <>
            {!cached && <DemoSignupBanner username={username} />}
            {cached && (
              <div className="fade-up mb-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-edge bg-surface/60 px-4 py-3 print:hidden">
                <p className="font-mono text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1 text-signal"><Icon.Zap className="h-3 w-3" /> instant result —</span> this profile was analyzed
                  before, so we served it from cache instead of running the agent again.
                </p>
                <button
                  onClick={() => generate(username, true, liveUrl, activeJd, activeTitle)}
                  className="flex-none rounded-md border border-edge bg-card px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:border-signal/50 hover:text-signal"
                >
                  run a fresh analysis
                </button>
              </div>
            )}
            {mode === 'developer' && targetRoleId && (
              <PublishProofBar username={username} targetRoleId={targetRoleId} profile={profile} />
            )}
            <ProfileView profile={profile} mode={mode} />
            {trace.length > 0 && (
              <details className="mt-10 border-t border-edge pt-6 print:hidden">
                <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-muted hover:text-signal">
                  view agent trace ({trace.filter((t) => t.type === 'tool_call').length} tool calls)
                </summary>
                <div className="mt-4 max-w-md">
                  <AgentTrace trace={trace} active={false} />
                </div>
              </details>
            )}
          </>
        )}
      </div>

      <footer className="border-t border-edge/80 py-6 text-center print:hidden mt-auto flex-none">
        <p className="font-mono text-xs text-slate-500 dark:text-muted">
          developed by{' '}
          <a
            href="https://www.linkedin.com/in/golamrabby-/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#ea580c] dark:text-signal hover:underline transition-colors"
          >
            Golam Rabby
          </a>
        </p>
      </footer>

      {showDeepAudit && (
        <DeepCodeAuditModal
          isOpen={showDeepAudit}
          onClose={() => setShowDeepAudit(false)}
          owner={username}
          repos={profile?.openSourceImpact?.topRepos}
          jobDescription={activeJd}
        />
      )}
    </main>
  );
}
