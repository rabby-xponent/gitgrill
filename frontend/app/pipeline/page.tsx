'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  getJobProjects,
  getActiveJobProjectId,
  setActiveJobProjectId,
  JobProject,
  saveJobProject,
} from '@/lib/job-projects';
import JobCandidatePipelineModal from '@/components/JobCandidatePipelineModal';
import JobGuardrailsModal from '@/components/JobGuardrailsModal';
import NewJobModal from '@/components/NewJobModal';
import { GitGrillLogo } from '@/components/GitGrillLogo';
import { Icon } from '@/components/icons';

function PipelineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [projects, setProjects] = useState<JobProject[]>([]);
  const [activeJobId, setActiveJobId] = useState<string>('');
  const [showGuardrailsModal, setShowGuardrailsModal] = useState(false);
  const [showNewJobModal, setShowNewJobModal] = useState(false);

  useEffect(() => {
    const list = getJobProjects();
    setProjects(list);

    const queryJobId = searchParams.get('jobId');
    if (queryJobId && list.some((p) => p.id === queryJobId)) {
      setActiveJobId(queryJobId);
      setActiveJobProjectId(queryJobId);
    } else {
      const active = getActiveJobProjectId();
      setActiveJobId(active);
    }
  }, [searchParams]);

  const activeProject = projects.find((p) => p.id === activeJobId) || projects[0];

  const handleRefreshProjects = () => {
    const list = getJobProjects();
    setProjects(list);
  };

  const handleSelectProject = (projectId: string) => {
    setActiveJobId(projectId);
    setActiveJobProjectId(projectId);
    router.push(`/pipeline?jobId=${projectId}`);
  };

  const handleSaveGuardrails = (updatedProject: JobProject) => {
    saveJobProject(updatedProject);
    handleRefreshProjects();
  };

  const handleCreateJob = (newProject: Partial<JobProject> & { title: string }) => {
    const created = saveJobProject(newProject);
    handleRefreshProjects();
    setActiveJobId(created.id);
    setActiveJobProjectId(created.id);
    router.push(`/pipeline?jobId=${created.id}`);
  };

  const handleScreenCandidate = (username: string) => {
    router.push(`/profile/${encodeURIComponent(username)}?jobId=${activeJobId}&mode=recruiter`);
  };

  if (!activeProject) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-muted font-mono text-sm">
        Loading RecruiterOS Pipeline…
      </div>
    );
  }

  return (
    <main className="page-texture min-h-screen bg-canvas text-content">
      {/* Top Nav */}
      <nav className="border-b border-edge bg-card/90 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link href="/" className="flex items-center shrink-0">
              <GitGrillLogo size="sm" />
            </Link>
            <span className="text-edge shrink-0">/</span>
            <span className="font-mono text-xs font-semibold text-signal uppercase tracking-wider truncate">
              RecruiterOS Pipeline
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => setShowNewJobModal(true)}
              className="flex items-center gap-1.5 rounded-lg bg-signal px-3 sm:px-3.5 py-1.5 font-mono text-xs font-bold text-white transition-colors hover:bg-signal/90 outline-none focus-visible:ring-2 focus-visible:ring-signal/40 shadow-xs"
            >
              <Icon.Plus className="h-3.5 w-3.5" />
              <span>New Job<span className="hidden xs:inline"> Project</span></span>
            </button>

            <Link
              href="/"
              className="rounded-lg border border-edge bg-card px-2.5 sm:px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-signal/50 hover:text-signal"
            >
              ← <span className="hidden sm:inline">Back to </span>Console
            </Link>
          </div>
        </div>
      </nav>

      {/* Embedded Master Pipeline View */}
      <div className="p-4 sm:p-6 mx-auto max-w-7xl">
        <JobCandidatePipelineModal
          isOpen={true}
          onClose={() => router.push('/')}
          project={activeProject}
          projects={projects}
          onSelectProject={handleSelectProject}
          onOpenGuardrails={() => setShowGuardrailsModal(true)}
          onRefreshProjects={handleRefreshProjects}
          onScreenCandidate={handleScreenCandidate}
        />
      </div>

      {/* Hiring Guardrails Modal */}
      {showGuardrailsModal && (
        <JobGuardrailsModal
          isOpen={showGuardrailsModal}
          onClose={() => setShowGuardrailsModal(false)}
          project={activeProject}
          onSave={handleSaveGuardrails}
        />
      )}

      {/* Create New Job Project Modal */}
      {showNewJobModal && (
        <NewJobModal
          isOpen={showNewJobModal}
          onClose={() => setShowNewJobModal(false)}
          onCreate={handleCreateJob}
        />
      )}
    </main>
  );
}

export default function PipelinePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-canvas text-muted font-mono text-sm">
          Loading RecruiterOS Pipeline…
        </div>
      }
    >
      <PipelineContent />
    </Suspense>
  );
}
