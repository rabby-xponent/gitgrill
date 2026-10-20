'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '@/components/icons';
import { Select, AlertModal } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { TargetRole, getTargetRoles } from '@/lib/target-roles';
import {
  ResumeProfile,
  getResumes,
  saveResume,
  branchResumeVariant,
  evaluateResumeAgainstJD,
  JDMatchReport,
  generateAITailoredProposal,
  TailoredResumeProposal,
  exportResumeAsMarkdown,
} from '@/lib/resumes';

interface JDResumeMatchmakerProps {
  initialRoleId?: string;
  initialResumeId?: string;
  onNavigateToRole?: (roleId: string) => void;
  onNavigateToResume?: (resumeId: string) => void;
}

export function JDResumeMatchmaker({
  initialRoleId,
  initialResumeId,
  onNavigateToRole,
  onNavigateToResume,
}: JDResumeMatchmakerProps) {
  const [roles, setRoles] = useState<TargetRole[]>([]);
  const [resumes, setResumes] = useState<ResumeProfile[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [showRawJd, setShowRawJd] = useState(false);
  const [showRawResume, setShowRawResume] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // AI Tailor Studio in matchmaker
  const [isTailorOpen, setIsTailorOpen] = useState(false);
  const [tailorProposal, setTailorProposal] = useState<TailoredResumeProposal | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);

  // Active expanded interview probe
  const [expandedProbeIdx, setExpandedProbeIdx] = useState<number | null>(0);

  // Alert modal
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    variant?: 'error' | 'info' | 'warning';
  }>({
    isOpen: false,
    title: '',
    description: '',
  });

  useEffect(() => {
    const roleList = getTargetRoles();
    const resumeList = getResumes();

    setRoles(roleList);
    setResumes(resumeList);

    // Initial role selection
    if (initialRoleId && roleList.some((r) => r.id === initialRoleId)) {
      setSelectedRoleId(initialRoleId);
    } else if (roleList.length > 0) {
      setSelectedRoleId(roleList[0].id);
    }

    // Initial resume selection
    if (initialResumeId && resumeList.some((r) => r.id === initialResumeId)) {
      setSelectedResumeId(initialResumeId);
    } else if (resumeList.length > 0) {
      // Pick master copy if available, or first
      const master = resumeList.find((r) => r.isMasterCopy);
      setSelectedResumeId(master ? master.id : resumeList[0].id);
    }
  }, [initialRoleId, initialResumeId]);

  const activeRole = roles.find((r) => r.id === selectedRoleId) || roles[0];
  const activeResume = resumes.find((r) => r.id === selectedResumeId) || resumes[0];

  // Evaluate the active Resume against the active JD
  const matchReport: JDMatchReport | null = useMemo(() => {
    if (!activeResume || !activeRole) return null;
    return evaluateResumeAgainstJD(activeResume, activeRole.rawJdText || `${activeRole.title} ${activeRole.notes}`);
  }, [activeResume, activeRole]);

  // Compute leaderboard of all resumes in vault against active JD
  const leaderboard = useMemo(() => {
    if (!activeRole) return [];
    return resumes
      .map((r) => {
        const rep = evaluateResumeAgainstJD(r, activeRole.rawJdText || `${activeRole.title} ${activeRole.notes}`);
        return {
          resume: r,
          report: rep,
        };
      })
      .sort((a, b) => b.report.fitScore - a.report.fitScore);
  }, [activeRole, resumes]);

  // Handle opening the tailoring studio
  const handleOpenTailor = () => {
    if (!activeResume || !activeRole) return;
    const prop = generateAITailoredProposal(
      activeResume,
      `${activeRole.company} (${activeRole.title})`,
      activeRole.rawJdText
    );
    setTailorProposal(prop);
    setIsTailorOpen(true);
  };

  // Toggle bullet proposal enabled state
  const handleToggleBullet = (idx: number) => {
    if (!tailorProposal) return;
    const next = [...tailorProposal.bulletProposals];
    next[idx].enabled = !next[idx].enabled;
    setTailorProposal({ ...tailorProposal, bulletProposals: next });
  };

  // Confirm and branch tailored variant
  const handleConfirmTailoredVariant = () => {
    if (!activeResume || !activeRole || !tailorProposal) return;
    setSavingVariant(true);

    try {
      const variantTitle = `${activeResume.fullName || activeResume.title} — ${activeRole.company} Tailored`;
      const branched = branchResumeVariant(activeResume, variantTitle, activeResume.targetRoleType);

      // Apply enabled bullets
      const updatedExperiences = branched.experience.map((exp) => {
        const updatedBullets = exp.bullets.map((b, bIdx) => {
          const propMatch = tailorProposal.bulletProposals.find(
            (p) => p.expId === exp.id && p.bulletIndex === bIdx && p.enabled
          );
          return propMatch ? propMatch.tailored : b;
        });
        return { ...exp, bullets: updatedBullets };
      });

      const saved = saveResume({
        ...branched,
        summary: tailorProposal.tailoredSummary,
        experience: updatedExperiences,
        versionLabel: `v2.0 (Tailored for ${activeRole.company})`,
      });

      const refreshed = getResumes();
      setResumes(refreshed);
      setSelectedResumeId(saved.id);
      setIsTailorOpen(false);
      setSavingVariant(false);

      setAlertModal({
        isOpen: true,
        title: 'Tailored Resume Variant Created',
        description: `Successfully created "${saved.title}" (${saved.versionLabel}). Your original master copy was kept 100% immutable and untouched.`,
        variant: 'info',
      });
    } catch {
      setSavingVariant(false);
      setAlertModal({
        isOpen: true,
        title: 'Error Creating Variant',
        description: 'An unexpected error occurred while saving the tailored variant.',
        variant: 'error',
      });
    }
  };

  if (!activeRole || !activeResume) {
    return (
      <div className="rounded-2xl border border-dashed border-edge bg-card p-12 text-center shadow-card">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-edge bg-well text-muted">
          <Icon.Sparkle className="h-6 w-6 text-signal" />
        </span>
        <h3 className="mt-4 font-mono text-base font-bold text-content">
          JD ↔ Resume Matchmaker Ready
        </h3>
        <p className="mx-auto mt-1.5 max-w-md font-sans text-xs leading-relaxed text-muted">
          Add at least one Target Role (JD) and upload your Resume in the respective tabs to unlock
          deterministic fit scoring, multi-resume rankings, and 1-click tailored branching.
        </p>
      </div>
    );
  }

  const roleOptions: SelectOption[] = roles.map((r) => ({
    value: r.id,
    label: `${r.company} — ${r.title}`,
    description: `Status: ${r.status.toUpperCase()} · ${r.rawJdText.length} chars JD`,
  }));

  const resumeOptions: SelectOption[] = resumes.map((res) => ({
    value: res.id,
    label: `${res.title} ${res.isMasterCopy ? '★ (Master CV)' : `(${res.versionLabel || 'Variant'})`}`,
    description: `${res.targetRoleType} · ${res.fullName}`,
  }));

  return (
    <div className="space-y-6">
      {/* Matchmaker Banner Header */}
      <div className="rounded-2xl border border-edge bg-card p-4 sm:p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-edge pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-signal/15 text-signal">
                <Icon.Sparkle className="h-4 w-4" />
              </span>
              <h2 className="font-mono text-base sm:text-lg font-bold text-content">
                JD ↔ Resume Matchmaker & Positioning Engine
              </h2>
            </div>
            <p className="mt-1 font-sans text-xs text-muted max-w-2xl">
              Deterministic fit auditing comparing any target job description against your resume variants.
              Identify hard skill gaps, benchmark all resumes on a leaderboard, and generate 1-click tailored variants.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleOpenTailor}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-all cursor-pointer text-center"
            >
              <Icon.Sparkle className="h-3.5 w-3.5 shrink-0" />
              <span>⚡ 1-Click Tailor for {activeRole.company}</span>
            </button>
          </div>
        </div>

        {/* Deterministic Selectors: Choose JD and Choose Resume */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* DOMAIN 1: Target JD Selector */}
          <div className="rounded-xl border border-edge bg-well/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-content">
                <Icon.Target className="h-4 w-4 text-signal shrink-0" />
                <span>1. Select Target Job Description (JD)</span>
              </div>
              <span className="rounded bg-signal/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-signal shrink-0">
                {activeRole.status}
              </span>
            </div>

            <Select
              value={selectedRoleId}
              onChange={setSelectedRoleId}
              options={roleOptions}
              ariaLabel="Select Target Job Description"
              className="w-full"
            />

            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono text-muted pt-1">
              <span className="truncate max-w-[200px] sm:max-w-none">{activeRole.company} · {activeRole.title}</span>
              <button
                type="button"
                onClick={() => setShowRawJd(!showRawJd)}
                className="text-signal hover:underline flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Icon.FileText className="h-3 w-3" />
                <span>{showRawJd ? 'Hide Full JD Text' : 'View Full JD Text'}</span>
              </button>
            </div>

            {showRawJd && (
              <div className="mt-2 p-3 rounded-lg border border-edge bg-card max-h-48 overflow-y-auto font-mono text-[11px] text-content whitespace-pre-wrap leading-relaxed">
                {activeRole.rawJdText || 'No raw JD text saved for this target role.'}
              </div>
            )}
          </div>

          {/* DOMAIN 2: Resume Selector */}
          <div className="rounded-xl border border-edge bg-well/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-content">
                <Icon.FileText className="h-4 w-4 text-signal" />
                <span>2. Select Resume Variant from Vault</span>
              </div>
              {activeResume.isMasterCopy ? (
                <span className="rounded bg-signal/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-signal">
                  ★ Master CV
                </span>
              ) : (
                <span className="rounded border border-edge bg-card px-2 py-0.5 font-mono text-[10px] text-muted">
                  {activeResume.versionLabel || 'Variant'}
                </span>
              )}
            </div>

            <Select
              value={selectedResumeId}
              onChange={setSelectedResumeId}
              options={resumeOptions}
              ariaLabel="Select Resume Profile"
              className="w-full"
            />

            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono text-muted pt-1">
              <span className="truncate max-w-[200px] sm:max-w-none">{activeResume.fullName} · {activeResume.targetRoleType}</span>
              <button
                type="button"
                onClick={() => setShowRawResume(!showRawResume)}
                className="text-signal hover:underline flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Icon.Eye className="h-3 w-3" />
                <span>{showRawResume ? 'Hide Text' : 'Inspect Clean Text'}</span>
              </button>
            </div>

            {showRawResume && (
              <div className="mt-2 p-3 rounded-lg border border-edge bg-card max-h-48 overflow-y-auto font-mono text-[11px] text-content whitespace-pre-wrap leading-relaxed">
                {activeResume.rawCleanText || exportResumeAsMarkdown(activeResume)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COMBINED DOMAIN: Match Scorecard & Gap Analysis */}
      {matchReport && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Fit Card */}
          <div className="lg:col-span-1 rounded-2xl border border-edge bg-card p-5 sm:p-6 shadow-card space-y-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
                Deterministic Fit Score
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                  matchReport.fitScore >= 80
                    ? 'bg-signal/15 text-signal border border-signal/30'
                    : matchReport.fitScore >= 60
                    ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                    : 'bg-red-500/15 text-red-500 border border-red-500/30'
                }`}
              >
                {matchReport.fitScore >= 80
                  ? 'Strong Alignment'
                  : matchReport.fitScore >= 60
                  ? 'Moderate Fit'
                  : 'Gap Remediation Needed'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-mono text-6xl font-extrabold text-content">
                {matchReport.fitScore}
              </span>
              <span className="font-mono text-sm text-muted">/ 100</span>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-edge">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  matchReport.fitScore >= 80
                    ? 'bg-signal'
                    : matchReport.fitScore >= 60
                    ? 'bg-amber-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${matchReport.fitScore}%` }}
              />
            </div>

            {/* Category Breakdown */}
            <div className="space-y-3 pt-3 border-t border-edge">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted">
                Dimension Alignment
              </span>

              <div className="space-y-2 font-mono text-xs">
                <div>
                  <div className="flex justify-between text-muted pb-1">
                    <span>Core Languages & Runtimes</span>
                    <span className="font-bold text-content">{matchReport.categoryScores.coreLanguages}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-well rounded-full overflow-hidden">
                    <div className="h-full bg-signal" style={{ width: `${matchReport.categoryScores.coreLanguages}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-muted pb-1">
                    <span>Distributed Systems & Messaging</span>
                    <span className="font-bold text-content">{matchReport.categoryScores.distributedSystems}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-well rounded-full overflow-hidden">
                    <div className="h-full bg-signal" style={{ width: `${matchReport.categoryScores.distributedSystems}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-muted pb-1">
                    <span>DevOps & Container Cloud</span>
                    <span className="font-bold text-content">{matchReport.categoryScores.devopsCloud}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-well rounded-full overflow-hidden">
                    <div className="h-full bg-signal" style={{ width: `${matchReport.categoryScores.devopsCloud}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-muted pb-1">
                    <span>Architecture & Database Scale</span>
                    <span className="font-bold text-content">{matchReport.categoryScores.architectureScale}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-well rounded-full overflow-hidden">
                    <div className="h-full bg-signal" style={{ width: `${matchReport.categoryScores.architectureScale}%` }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleOpenTailor}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-signal/15 border border-signal/40 py-2.5 font-mono text-xs font-bold text-signal hover:bg-signal/25 transition-all cursor-pointer"
              >
                <Icon.Sparkle className="h-3.5 w-3.5" />
                <span>Tailor Bullets to Close Gaps</span>
              </button>
            </div>
          </div>

          {/* Hard Skills Matrix: Matched vs Missing */}
          <div className="lg:col-span-2 rounded-2xl border border-edge bg-card p-5 sm:p-6 shadow-card space-y-5">
            <div>
              <h3 className="font-mono text-sm font-bold text-content">
                Hard Requirements Matrix
              </h3>
              <p className="mt-1 font-sans text-xs text-muted">
                Direct verification of technical primitives demanded by {activeRole.company}&apos;s job description.
              </p>
            </div>

            {/* Matched Skills */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-signal">
                <Icon.CheckCircle className="h-4 w-4" />
                <span>Verified Matched in Resume ({matchReport.matchedSkills.length})</span>
              </div>
              {matchReport.matchedSkills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {matchReport.matchedSkills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 rounded-lg border border-signal/40 bg-signal/10 px-2.5 py-1 font-mono text-xs font-semibold text-signal uppercase tracking-wider"
                    >
                      <Icon.Check className="h-3 w-3" />
                      <span>{skill}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-mono text-xs text-muted">No explicit keywords matched yet.</p>
              )}
            </div>

            {/* Missing Skills */}
            <div className="space-y-2.5 pt-4 border-t border-edge">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-500">
                <Icon.Alert className="h-4 w-4" />
                <span>Missing Skill Gaps in Resume ({matchReport.missingSkills.length})</span>
              </div>
              {matchReport.missingSkills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {matchReport.missingSkills.map((gap) => (
                    <span
                      key={gap}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-amber-500 uppercase tracking-wider"
                    >
                      <Icon.Alert className="h-3 w-3" />
                      <span>{gap}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="font-mono text-xs text-signal font-semibold">
                  Zero hard skill gaps identified! All high-priority JD primitives are present.
                </p>
              )}
            </div>

            {/* Recommended Bullet Enhancements */}
            {matchReport.bulletRecommendations.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-edge">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-content flex items-center gap-1.5">
                    <Icon.Zap className="h-3.5 w-3.5 text-signal" />
                    <span>Targeted Bullet Alignments</span>
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    {matchReport.bulletRecommendations.length} opportunities
                  </span>
                </div>

                <div className="space-y-2.5">
                  {matchReport.bulletRecommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-edge bg-well/40 p-3 text-xs space-y-1.5 font-mono"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span className="font-bold text-content">{rec.company}</span>
                        <span className="text-signal">{rec.rationale}</span>
                      </div>
                      <p className="text-content font-sans text-xs bg-card p-2 rounded-lg border border-edge">
                        {rec.tailored}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMBINED CAPABILITY 2: Multi-Resume Leaderboard for this JD */}
      <div className="rounded-2xl border border-edge bg-card p-5 sm:p-6 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-edge pb-3">
          <div>
            <h3 className="font-mono text-sm font-bold text-content flex items-center gap-2">
              <Icon.Scale className="h-4 w-4 text-signal" />
              <span>Multi-Resume Leaderboard for {activeRole.company}</span>
            </h3>
            <p className="font-sans text-xs text-muted mt-0.5">
              Rank all resumes in your vault against this JD to instantly know which variant is best positioned.
            </p>
          </div>
          <span className="font-mono text-xs text-muted">
            {leaderboard.length} variant{leaderboard.length === 1 ? '' : 's'} audited
          </span>
        </div>

        <div className="overflow-x-auto -mx-1 sm:mx-0">
          <table className="w-full min-w-[620px] text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-edge text-muted text-[11px] uppercase tracking-wider">
                <th className="pb-2.5 font-bold">Rank</th>
                <th className="pb-2.5 font-bold">Resume Profile</th>
                <th className="pb-2.5 font-bold">Target Category</th>
                <th className="pb-2.5 font-bold">Fit Score</th>
                <th className="pb-2.5 font-bold">Matched Skills</th>
                <th className="pb-2.5 font-bold">Open Gaps</th>
                <th className="pb-2.5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {leaderboard.map(({ resume, report }, idx) => {
                const isCurrentActive = resume.id === activeResume.id;
                return (
                  <tr
                    key={resume.id}
                    className={`transition-colors ${
                      isCurrentActive ? 'bg-signal/5 font-semibold' : 'hover:bg-well/50'
                    }`}
                  >
                    <td className="py-3 pr-2">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-md font-bold text-[11px] ${
                          idx === 0
                            ? 'bg-signal text-white'
                            : 'border border-edge bg-well text-muted'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-content font-bold">{resume.title}</span>
                        {resume.isMasterCopy && (
                          <span className="rounded bg-signal/15 px-1.5 py-0.2 text-[9px] font-bold text-signal uppercase tracking-wider">
                            Master
                          </span>
                        )}
                        {isCurrentActive && (
                          <span className="rounded border border-signal/40 bg-signal/10 px-1.5 py-0.2 text-[9px] text-signal font-bold">
                            Selected
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted">{resume.fullName}</span>
                    </td>
                    <td className="py-3 pr-4 text-muted text-[11px]">
                      {resume.targetRoleType}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold text-sm ${
                            report.fitScore >= 80
                              ? 'text-signal'
                              : report.fitScore >= 60
                              ? 'text-amber-500'
                              : 'text-red-500'
                          }`}
                        >
                          {report.fitScore}%
                        </span>
                        <div className="w-16 h-1.5 bg-well rounded-full overflow-hidden hidden sm:block">
                          <div
                            className={`h-full ${
                              report.fitScore >= 80 ? 'bg-signal' : 'bg-amber-500'
                            }`}
                            style={{ width: `${report.fitScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-signal font-bold">
                      {report.matchedSkills.length} verified
                    </td>
                    <td className="py-3 pr-4 text-amber-500 font-bold">
                      {report.missingSkills.length} gap{report.missingSkills.length === 1 ? '' : 's'}
                    </td>
                    <td className="py-3 text-right space-x-2">
                      {!isCurrentActive ? (
                        <button
                          type="button"
                          onClick={() => setSelectedResumeId(resume.id)}
                          className="rounded-lg border border-edge bg-well px-2.5 py-1 text-[11px] text-content hover:border-signal/50 hover:text-signal transition-colors cursor-pointer"
                        >
                          Select
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleOpenTailor}
                          className="rounded-lg bg-signal px-2.5 py-1 text-[11px] text-white font-bold hover:bg-signal/90 transition-colors cursor-pointer"
                        >
                          Tailor
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMBINED CAPABILITY 3: JD-Specific Interview Defense Simulation */}
      {matchReport && matchReport.interviewDefenseProbes.length > 0 && (
        <div className="rounded-2xl border border-edge bg-card p-5 sm:p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-edge pb-3">
            <div>
              <h3 className="font-mono text-sm font-bold text-content flex items-center gap-2">
                <Icon.Target className="h-4 w-4 text-signal" />
                <span>JD-Targeted Technical Interview Defense Simulator</span>
              </h3>
              <p className="font-sans text-xs text-muted mt-0.5">
                Probes designed specifically for the intersection of {activeResume.fullName}&apos;s resume and {activeRole.company}&apos;s stack.
              </p>
            </div>
            <span className="font-mono text-xs text-muted">
              {matchReport.interviewDefenseProbes.length} Targeted Questions
            </span>
          </div>

          <div className="space-y-3">
            {matchReport.interviewDefenseProbes.map((probe, idx) => {
              const isOpen = expandedProbeIdx === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-edge bg-well/30 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedProbeIdx(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-4 text-left font-mono text-xs hover:bg-well/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-3">
                      <span className="flex h-5 w-5 flex-none items-center justify-center rounded bg-signal/15 font-bold text-signal text-[10px]">
                        Q{idx + 1}
                      </span>
                      <span className="font-bold text-content truncate">
                        {probe.targetingGap}
                      </span>
                    </div>
                    <Icon.ChevronDown
                      className={`h-4 w-4 flex-none text-muted transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-signal' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="p-4 pt-1 border-t border-edge space-y-3 font-sans text-xs leading-relaxed">
                      <div className="p-3 rounded-lg bg-card border border-edge font-mono text-xs font-semibold text-content">
                        &ldquo;{probe.question}&rdquo;
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="p-3 rounded-lg border border-edge bg-card space-y-1">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                            What the Hiring Team Listens For
                          </span>
                          <p className="text-muted text-xs leading-relaxed">
                            {probe.whatHiringTeamListensFor}
                          </p>
                        </div>

                        <div className="p-3 rounded-lg border border-signal/30 bg-signal/5 space-y-1">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-signal">
                            Recommended Engineering Defense
                          </span>
                          <p className="text-content text-xs leading-relaxed">
                            {probe.recommendedDefense}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Tailoring Studio Modal */}
      {isTailorOpen && tailorProposal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setIsTailorOpen(false)}
        >
          <div
            className="fade-up relative w-full max-w-3xl my-auto rounded-2xl border border-edge bg-card p-6 sm:p-7 shadow-card max-h-[90vh] overflow-y-auto space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-edge">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-signal font-bold">
                  AI Tailoring Studio · Non-Destructive Variant
                </span>
                <h3 className="mt-1 font-mono text-lg font-bold text-content">
                  Tailor for {tailorProposal.targetRoleOrCompany}
                </h3>
                <p className="font-sans text-xs text-muted mt-0.5">
                  Confirm proposed bullet improvements and summary alignments. This will branch into a new versioned variant, leaving your master CV untouched.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTailorOpen(false)}
                className="rounded-lg p-1 text-muted hover:bg-well hover:text-content"
              >
                <Icon.X className="h-5 w-5" />
              </button>
            </div>

            {/* Summary Diff */}
            <div className="space-y-2">
              <span className="font-mono text-xs font-bold text-content">
                Summary Positioning Proposal
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-sans">
                <div className="p-3 rounded-xl border border-edge bg-well/40 space-y-1">
                  <span className="font-mono text-[10px] text-muted uppercase font-bold">Original</span>
                  <p className="text-muted leading-relaxed">{tailorProposal.originalSummary}</p>
                </div>
                <div className="p-3 rounded-xl border border-signal/40 bg-signal/5 space-y-1">
                  <span className="font-mono text-[10px] text-signal uppercase font-bold">Tailored Proposal</span>
                  <p className="text-content font-medium leading-relaxed">{tailorProposal.tailoredSummary}</p>
                </div>
              </div>
            </div>

            {/* Bullets Proposals */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-content">
                  Impact Bullets Transformation ({tailorProposal.bulletProposals.length})
                </span>
                <span className="font-mono text-[11px] text-muted">
                  Toggle bullets to include
                </span>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {tailorProposal.bulletProposals.map((prop, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleToggleBullet(idx)}
                    className={`cursor-pointer rounded-xl border p-3.5 space-y-2 transition-all ${
                      prop.enabled
                        ? 'border-signal/50 bg-signal/5'
                        : 'border-edge bg-well/20 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded ${
                            prop.enabled ? 'bg-signal text-white' : 'border border-edge'
                          }`}
                        >
                          {prop.enabled && <Icon.Check className="h-3 w-3" />}
                        </span>
                        <span className="font-bold text-content">{prop.rationale}</span>
                      </div>
                      <span className="text-[10px] text-muted">
                        {prop.enabled ? 'Included' : 'Excluded'}
                      </span>
                    </div>

                    <div className="space-y-1 font-sans text-xs">
                      <div className="text-muted line-through text-[11px]">
                        {prop.original}
                      </div>
                      <div className="text-content font-medium text-xs">
                        {prop.tailored}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-edge">
              <button
                type="button"
                onClick={() => setIsTailorOpen(false)}
                className="w-full sm:w-auto text-center rounded-xl border border-edge px-4 py-2 font-mono text-xs text-muted hover:text-content hover:bg-well transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingVariant}
                onClick={handleConfirmTailoredVariant}
                className="w-full sm:w-auto justify-center flex items-center gap-1.5 rounded-xl bg-signal px-5 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-all cursor-pointer disabled:opacity-50 text-center"
              >
                <Icon.Sparkle className="h-3.5 w-3.5" />
                <span>{savingVariant ? 'Saving Variant…' : `Confirm & Save Variant for ${activeRole.company}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        description={alertModal.description}
        variant={alertModal.variant}
      />
    </div>
  );
}
