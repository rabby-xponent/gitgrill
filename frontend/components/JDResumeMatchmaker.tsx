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
  initialCompareId?: string;
  onNavigateToRole?: (roleId: string) => void;
  onNavigateToResume?: (resumeId: string) => void;
}

export function JDResumeMatchmaker({
  initialRoleId,
  initialResumeId,
  initialCompareId,
  onNavigateToRole,
  onNavigateToResume,
}: JDResumeMatchmakerProps) {
  const [roles, setRoles] = useState<TargetRole[]>([]);
  const [resumes, setResumes] = useState<ResumeProfile[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [compareResumeId, setCompareResumeId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'single' | 'ab_benchmark'>(
    initialCompareId ? 'ab_benchmark' : 'single'
  );

  const [showRawJd, setShowRawJd] = useState(false);
  const [showRawResumeA, setShowRawResumeA] = useState(false);
  const [showRawResumeB, setShowRawResumeB] = useState(false);

  // AI Tailor Studio in matchmaker
  const [isTailorOpen, setIsTailorOpen] = useState(false);
  const [tailorProposal, setTailorProposal] = useState<TailoredResumeProposal | null>(null);
  const [tailorTargetResume, setTailorTargetResume] = useState<ResumeProfile | null>(null);
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

    // Initial resume selection (Variant A)
    let selectedA = '';
    if (initialResumeId && resumeList.some((r) => r.id === initialResumeId)) {
      selectedA = initialResumeId;
    } else if (resumeList.length > 0) {
      const master = resumeList.find((r) => r.isMasterCopy);
      selectedA = master ? master.id : resumeList[0].id;
    }
    setSelectedResumeId(selectedA);

    // Initial compare selection (Variant B)
    if (initialCompareId && resumeList.some((r) => r.id === initialCompareId)) {
      setCompareResumeId(initialCompareId);
      setViewMode('ab_benchmark');
    } else if (resumeList.length > 1) {
      const candidateB = resumeList.find((r) => r.id !== selectedA) || resumeList[1];
      setCompareResumeId(candidateB.id);
    }
  }, [initialRoleId, initialResumeId, initialCompareId]);

  const activeRole = roles.find((r) => r.id === selectedRoleId) || roles[0];
  const activeResume = resumes.find((r) => r.id === selectedResumeId) || resumes[0];

  // Active Resume B for comparison
  const activeResumeB = useMemo(() => {
    if (resumes.length < 2) return null;
    const match = resumes.find((r) => r.id === compareResumeId);
    if (match && match.id !== activeResume?.id) return match;
    return resumes.find((r) => r.id !== activeResume?.id) || null;
  }, [resumes, compareResumeId, activeResume]);

  // Evaluate active Resume (Variant A) against the active JD
  const matchReport: JDMatchReport | null = useMemo(() => {
    if (!activeResume || !activeRole) return null;
    return evaluateResumeAgainstJD(
      activeResume,
      activeRole.rawJdText || `${activeRole.title} ${activeRole.notes}`
    );
  }, [activeResume, activeRole]);

  // Evaluate active Resume B (Variant B) against the active JD
  const matchReportB: JDMatchReport | null = useMemo(() => {
    if (!activeResumeB || !activeRole) return null;
    return evaluateResumeAgainstJD(
      activeResumeB,
      activeRole.rawJdText || `${activeRole.title} ${activeRole.notes}`
    );
  }, [activeResumeB, activeRole]);

  // Compute leaderboard of all resumes in vault against active JD
  const leaderboard = useMemo(() => {
    if (!activeRole) return [];
    return resumes
      .map((r) => {
        const rep = evaluateResumeAgainstJD(
          r,
          activeRole.rawJdText || `${activeRole.title} ${activeRole.notes}`
        );
        return {
          resume: r,
          report: rep,
        };
      })
      .sort((a, b) => b.report.fitScore - a.report.fitScore);
  }, [activeRole, resumes]);

  // Compute Comparative A/B Diff Metrics
  const abComparison = useMemo(() => {
    if (!matchReport || !matchReportB || !activeResume || !activeResumeB || !activeRole) return null;

    const scoreDelta = matchReport.fitScore - matchReportB.fitScore;

    const dimensions = [
      {
        key: 'coreLanguages' as const,
        label: 'Core Languages & Runtimes',
        scoreA: matchReport.categoryScores.coreLanguages,
        scoreB: matchReportB.categoryScores.coreLanguages,
        delta: matchReport.categoryScores.coreLanguages - matchReportB.categoryScores.coreLanguages,
      },
      {
        key: 'distributedSystems' as const,
        label: 'Distributed Systems & Messaging',
        scoreA: matchReport.categoryScores.distributedSystems,
        scoreB: matchReportB.categoryScores.distributedSystems,
        delta: matchReport.categoryScores.distributedSystems - matchReportB.categoryScores.distributedSystems,
      },
      {
        key: 'devopsCloud' as const,
        label: 'DevOps & Container Cloud',
        scoreA: matchReport.categoryScores.devopsCloud,
        scoreB: matchReportB.categoryScores.devopsCloud,
        delta: matchReport.categoryScores.devopsCloud - matchReportB.categoryScores.devopsCloud,
      },
      {
        key: 'architectureScale' as const,
        label: 'Architecture & Database Scale',
        scoreA: matchReport.categoryScores.architectureScale,
        scoreB: matchReportB.categoryScores.architectureScale,
        delta: matchReport.categoryScores.architectureScale - matchReportB.categoryScores.architectureScale,
      },
    ];

    const setMatchedB = new Set(matchReportB.matchedSkills);
    const setMatchedA = new Set(matchReport.matchedSkills);

    const mutualMatched = matchReport.matchedSkills.filter((s) => setMatchedB.has(s));
    const uniqueToA = matchReport.matchedSkills.filter((s) => !setMatchedB.has(s));
    const uniqueToB = matchReportB.matchedSkills.filter((s) => !setMatchedA.has(s));

    const setMissingB = new Set(matchReportB.missingSkills);
    const mutualGaps = matchReport.missingSkills.filter((s) => setMissingB.has(s));

    let verdictTitle = '';
    let verdictDescription = '';

    if (scoreDelta > 3) {
      verdictTitle = `${activeResume.title} Leads by +${scoreDelta}% Overall Fit`;
      verdictDescription = `Variant A demonstrates stronger keyword and domain alignment for ${activeRole.company}. It uniquely verifies ${
        uniqueToA.length > 0 ? uniqueToA.slice(0, 4).join(', ') : 'more core criteria'
      } that are absent in Variant B.`;
    } else if (scoreDelta < -3) {
      verdictTitle = `${activeResumeB.title} Leads by +${Math.abs(scoreDelta)}% Overall Fit`;
      verdictDescription = `Variant B provides higher technical alignment for ${activeRole.company}'s stack. It uniquely verifies ${
        uniqueToB.length > 0 ? uniqueToB.slice(0, 4).join(', ') : 'more core criteria'
      } that are absent in Variant A.`;
    } else {
      verdictTitle = `Near Parity (${matchReport.fitScore}% vs ${matchReportB.fitScore}%) — Position by Strategic Angle`;
      verdictDescription = `Both variants demonstrate comparable total keyword overlap with ${activeRole.company}. Variant A emphasizes ${activeResume.targetRoleType}, while Variant B focuses on ${activeResumeB.targetRoleType}. Choose based on the specific team focus.`;
    }

    return {
      scoreDelta,
      dimensions,
      mutualMatched,
      uniqueToA,
      uniqueToB,
      mutualGaps,
      verdictTitle,
      verdictDescription,
    };
  }, [matchReport, matchReportB, activeResume, activeResumeB, activeRole]);

  // Swap Variant A and Variant B
  const handleSwapVariants = () => {
    if (!activeResumeB) return;
    const tempA = selectedResumeId;
    const tempB = activeResumeB.id;
    setSelectedResumeId(tempB);
    setCompareResumeId(tempA);
  };

  // Handle opening the tailoring studio
  const handleOpenTailor = (targetResume?: ResumeProfile) => {
    const resumeToTailor = targetResume || activeResume;
    if (!resumeToTailor || !activeRole) return;
    const prop = generateAITailoredProposal(
      resumeToTailor,
      `${activeRole.company} (${activeRole.title})`,
      activeRole.rawJdText
    );
    setTailorTargetResume(resumeToTailor);
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
    const baseResume = tailorTargetResume || activeResume;
    if (!baseResume || !activeRole || !tailorProposal) return;
    setSavingVariant(true);

    try {
      const variantTitle = `${baseResume.fullName || baseResume.title} — ${activeRole.company} Tailored`;
      const branched = branchResumeVariant(baseResume, variantTitle, baseResume.targetRoleType);

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

  const compareResumeOptions: SelectOption[] = resumes
    .filter((res) => res.id !== activeResume.id)
    .map((res) => ({
      value: res.id,
      label: `${res.title} ${res.isMasterCopy ? '★ (Master CV)' : `(${res.versionLabel || 'Variant'})`}`,
      description: `${res.targetRoleType} · ${res.fullName}`,
    }));

  return (
    <div className="space-y-6">
      {/* Matchmaker Banner Header & Mode Switcher */}
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
              Deterministic fit auditing comparing target job descriptions against your resume variants.
              Identify hard skill gaps, benchmark variants side-by-side on the 4-dimension matrix, and tailor 1-click variants.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-edge bg-well p-1">
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'single'
                    ? 'bg-card text-content shadow-xs border border-edge'
                    : 'text-muted hover:text-content'
                }`}
              >
                <Icon.Target className="h-3.5 w-3.5" />
                <span>Single Audit</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('ab_benchmark')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'ab_benchmark'
                    ? 'bg-card text-content shadow-xs border border-edge'
                    : 'text-muted hover:text-content'
                }`}
              >
                <Icon.ArrowLeftRight className="h-3.5 w-3.5 text-signal" />
                <span>A/B Benchmark</span>
                {resumes.length >= 2 && (
                  <span className="rounded bg-signal/15 px-1.5 py-0.2 font-mono text-[9px] font-bold text-signal">
                    {resumes.length}
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleOpenTailor()}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-all cursor-pointer text-center"
            >
              <Icon.Sparkle className="h-3.5 w-3.5 shrink-0" />
              <span>1-Click Tailor for {activeRole.company}</span>
            </button>
          </div>
        </div>

        {/* SHARED TARGET JD SELECTOR */}
        <div className="mt-5 rounded-xl border border-edge bg-well/40 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-content">
              <Icon.Target className="h-4 w-4 text-signal shrink-0" />
              <span>Target Job Description (JD Benchmark Constant)</span>
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

        {/* VARIANT SELECTORS */}
        {viewMode === 'single' ? (
          /* Single Resume Selector */
          <div className="mt-4 rounded-xl border border-edge bg-well/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-content">
                <Icon.FileText className="h-4 w-4 text-signal" />
                <span>Select Resume Variant to Audit</span>
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
                onClick={() => setShowRawResumeA(!showRawResumeA)}
                className="text-signal hover:underline flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Icon.Eye className="h-3 w-3" />
                <span>{showRawResumeA ? 'Hide Text' : 'Inspect Clean Text'}</span>
              </button>
            </div>

            {showRawResumeA && (
              <div className="mt-2 p-3 rounded-lg border border-edge bg-card max-h-48 overflow-y-auto font-mono text-[11px] text-content whitespace-pre-wrap leading-relaxed">
                {activeResume.rawCleanText || exportResumeAsMarkdown(activeResume)}
              </div>
            )}
          </div>
        ) : (
          /* Dual A/B Variant Selectors */
          <div className="mt-4 grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
            {/* Variant A Selector */}
            <div className="md:col-span-5 rounded-xl border border-edge bg-well/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-content">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-signal/15 text-signal text-[10px]">
                    A
                  </span>
                  <span>Baseline Variant (A)</span>
                </div>
                {activeResume.isMasterCopy ? (
                  <span className="rounded bg-signal/15 px-1.5 py-0.2 font-mono text-[9px] font-bold text-signal uppercase tracking-wider">
                    ★ Master
                  </span>
                ) : (
                  <span className="rounded border border-edge bg-card px-1.5 py-0.2 font-mono text-[9px] text-muted">
                    {activeResume.versionLabel || 'Variant'}
                  </span>
                )}
              </div>

              <Select
                value={selectedResumeId}
                onChange={setSelectedResumeId}
                options={resumeOptions}
                ariaLabel="Select Variant A"
                className="w-full"
              />

              <div className="flex items-center justify-between text-[11px] font-mono text-muted pt-1">
                <span className="truncate">{activeResume.targetRoleType}</span>
                <button
                  type="button"
                  onClick={() => setShowRawResumeA(!showRawResumeA)}
                  className="text-signal hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Icon.Eye className="h-3 w-3" />
                  <span>{showRawResumeA ? 'Hide' : 'Inspect'}</span>
                </button>
              </div>

              {showRawResumeA && (
                <div className="mt-2 p-2.5 rounded-lg border border-edge bg-card max-h-36 overflow-y-auto font-mono text-[10px] text-content whitespace-pre-wrap leading-relaxed">
                  {activeResume.rawCleanText || exportResumeAsMarkdown(activeResume)}
                </div>
              )}
            </div>

            {/* Swap Button */}
            <div className="md:col-span-1 flex justify-center py-1 md:py-0">
              <button
                type="button"
                onClick={handleSwapVariants}
                disabled={!activeResumeB}
                title="Swap Variant A and Variant B"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-edge bg-card text-muted hover:text-signal hover:border-signal/40 transition-all cursor-pointer shadow-xs disabled:opacity-40"
              >
                <Icon.ArrowLeftRight className="h-4 w-4" />
              </button>
            </div>

            {/* Variant B Selector */}
            <div className="md:col-span-5 rounded-xl border border-edge bg-well/40 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-content">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-500/15 text-blue-400 text-[10px]">
                    B
                  </span>
                  <span>Challenger Variant (B)</span>
                </div>
                {activeResumeB?.isMasterCopy ? (
                  <span className="rounded bg-signal/15 px-1.5 py-0.2 font-mono text-[9px] font-bold text-signal uppercase tracking-wider">
                    ★ Master
                  </span>
                ) : (
                  <span className="rounded border border-edge bg-card px-1.5 py-0.2 font-mono text-[9px] text-muted">
                    {activeResumeB?.versionLabel || 'Variant'}
                  </span>
                )}
              </div>

              {activeResumeB ? (
                <>
                  <Select
                    value={activeResumeB.id}
                    onChange={setCompareResumeId}
                    options={compareResumeOptions}
                    ariaLabel="Select Variant B"
                    className="w-full"
                  />

                  <div className="flex items-center justify-between text-[11px] font-mono text-muted pt-1">
                    <span className="truncate">{activeResumeB.targetRoleType}</span>
                    <button
                      type="button"
                      onClick={() => setShowRawResumeB(!showRawResumeB)}
                      className="text-signal hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Icon.Eye className="h-3 w-3" />
                      <span>{showRawResumeB ? 'Hide' : 'Inspect'}</span>
                    </button>
                  </div>

                  {showRawResumeB && (
                    <div className="mt-2 p-2.5 rounded-lg border border-edge bg-card max-h-36 overflow-y-auto font-mono text-[10px] text-content whitespace-pre-wrap leading-relaxed">
                      {activeResumeB.rawCleanText || exportResumeAsMarkdown(activeResumeB)}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-edge text-center font-mono text-xs text-muted">
                  Need 2+ variants in vault for A/B comparison.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* VIEW MODE 1: SINGLE RESUME AUDIT */}
      {viewMode === 'single' && matchReport && (
        <div className="space-y-6">
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

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenTailor(activeResume)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-signal/15 border border-signal/40 py-2.5 font-mono text-xs font-bold text-signal hover:bg-signal/25 transition-all cursor-pointer"
                >
                  <Icon.Sparkle className="h-3.5 w-3.5" />
                  <span>Tailor Bullets to Close Gaps</span>
                </button>
                {resumes.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => setViewMode('ab_benchmark')}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-edge bg-well py-2 font-mono text-xs text-muted hover:text-content hover:bg-card transition-all cursor-pointer"
                  >
                    <Icon.ArrowLeftRight className="h-3.5 w-3.5" />
                    <span>Benchmark A/B Against Another Variant</span>
                  </button>
                )}
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
        </div>
      )}

      {/* VIEW MODE 2: MULTI-RESUME A/B BENCHMARK STUDIO */}
      {viewMode === 'ab_benchmark' && (
        <div className="space-y-6">
          {!activeResumeB || !abComparison || !matchReport || !matchReportB ? (
            <div className="rounded-2xl border border-dashed border-edge bg-card p-8 sm:p-12 text-center shadow-card">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-edge bg-well text-muted">
                <Icon.ArrowLeftRight className="h-6 w-6 text-signal" />
              </span>
              <h3 className="mt-4 font-mono text-base font-bold text-content">
                At Least 2 Resume Variants Required for A/B Benchmarking
              </h3>
              <p className="mx-auto mt-1.5 max-w-md font-sans text-xs leading-relaxed text-muted">
                You currently have {resumes.length} variant in your vault. Create a second variant tailored to a different archetype or assemble one from your Master SSOT to benchmark side-by-side.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToResume) onNavigateToResume(activeResume.id);
                  }}
                  className="rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-all cursor-pointer"
                >
                  Assemble New Variant from SSOT
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* SIDE-BY-SIDE OVERALL FIT SCORECARD */}
              <div className="grid grid-cols-1 md:grid-cols-11 gap-4">
                {/* Variant A Scorecard */}
                <div className="md:col-span-5 rounded-2xl border border-edge bg-card p-5 sm:p-6 shadow-card space-y-4">
                  <div className="flex items-center justify-between border-b border-edge pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-signal/15 text-signal font-mono text-xs font-bold">
                        A
                      </span>
                      <div>
                        <h4 className="font-mono text-sm font-bold text-content truncate max-w-[200px]">
                          {activeResume.title}
                        </h4>
                        <span className="font-mono text-[10px] text-muted">
                          {activeResume.targetRoleType}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                        matchReport.fitScore >= 80
                          ? 'bg-signal/15 text-signal border border-signal/30'
                          : matchReport.fitScore >= 60
                          ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                          : 'bg-red-500/15 text-red-500 border border-red-500/30'
                      }`}
                    >
                      {matchReport.fitScore >= 80 ? 'Strong Fit' : 'Moderate'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="font-mono text-5xl font-extrabold text-content">
                        {matchReport.fitScore}
                      </span>
                      <span className="font-mono text-xs text-muted ml-1">/ 100</span>
                    </div>
                    <div className="text-right font-mono text-xs space-y-0.5">
                      <div className="text-signal font-semibold">
                        {matchReport.matchedSkills.length} Verified Skills
                      </div>
                      <div className="text-amber-500 font-semibold">
                        {matchReport.missingSkills.length} Remaining Gaps
                      </div>
                    </div>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-edge">
                    <div
                      className="h-full rounded-full bg-signal transition-all duration-700"
                      style={{ width: `${matchReport.fitScore}%` }}
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-muted">
                      {activeResume.experience.reduce((acc, e) => acc + e.bullets.length, 0)} master bullets
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenTailor(activeResume)}
                      className="inline-flex items-center gap-1 font-mono text-xs text-signal hover:underline cursor-pointer"
                    >
                      <Icon.Sparkle className="h-3 w-3" />
                      <span>Tailor Variant A</span>
                    </button>
                  </div>
                </div>

                {/* Center Differential Delta Badge */}
                <div className="md:col-span-1 flex flex-col items-center justify-center p-3 rounded-2xl border border-edge bg-well/60 shadow-xs text-center space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
                    Delta
                  </span>
                  <div
                    className={`font-mono text-base font-extrabold px-2 py-1 rounded-lg ${
                      abComparison.scoreDelta > 0
                        ? 'bg-signal/20 text-signal border border-signal/30'
                        : abComparison.scoreDelta < 0
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-card text-muted border border-edge'
                    }`}
                  >
                    {abComparison.scoreDelta > 0
                      ? `+${abComparison.scoreDelta}%`
                      : abComparison.scoreDelta < 0
                      ? `+${Math.abs(abComparison.scoreDelta)}%`
                      : '0%'}
                  </div>
                  <span className="font-mono text-[9px] text-muted leading-tight">
                    {abComparison.scoreDelta > 0
                      ? 'A leads'
                      : abComparison.scoreDelta < 0
                      ? 'B leads'
                      : 'Parity'}
                  </span>
                  <button
                    type="button"
                    onClick={handleSwapVariants}
                    title="Swap Baseline A and Challenger B"
                    className="mt-1 flex h-7 w-7 items-center justify-center rounded-lg border border-edge bg-card text-muted hover:text-content hover:border-signal/40 transition-colors cursor-pointer"
                  >
                    <Icon.ArrowLeftRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Variant B Scorecard */}
                <div className="md:col-span-5 rounded-2xl border border-edge bg-card p-5 sm:p-6 shadow-card space-y-4">
                  <div className="flex items-center justify-between border-b border-edge pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/15 text-blue-400 font-mono text-xs font-bold">
                        B
                      </span>
                      <div>
                        <h4 className="font-mono text-sm font-bold text-content truncate max-w-[200px]">
                          {activeResumeB.title}
                        </h4>
                        <span className="font-mono text-[10px] text-muted">
                          {activeResumeB.targetRoleType}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                        matchReportB.fitScore >= 80
                          ? 'bg-signal/15 text-signal border border-signal/30'
                          : matchReportB.fitScore >= 60
                          ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                          : 'bg-red-500/15 text-red-500 border border-red-500/30'
                      }`}
                    >
                      {matchReportB.fitScore >= 80 ? 'Strong Fit' : 'Moderate'}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="font-mono text-5xl font-extrabold text-content">
                        {matchReportB.fitScore}
                      </span>
                      <span className="font-mono text-xs text-muted ml-1">/ 100</span>
                    </div>
                    <div className="text-right font-mono text-xs space-y-0.5">
                      <div className="text-signal font-semibold">
                        {matchReportB.matchedSkills.length} Verified Skills
                      </div>
                      <div className="text-amber-500 font-semibold">
                        {matchReportB.missingSkills.length} Remaining Gaps
                      </div>
                    </div>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-edge">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-700"
                      style={{ width: `${matchReportB.fitScore}%` }}
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-muted">
                      {activeResumeB.experience.reduce((acc, e) => acc + e.bullets.length, 0)} master bullets
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenTailor(activeResumeB)}
                      className="inline-flex items-center gap-1 font-mono text-xs text-blue-400 hover:underline cursor-pointer"
                    >
                      <Icon.Sparkle className="h-3 w-3" />
                      <span>Tailor Variant B</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* STRATEGIC POSITIONING RECOMMENDATION BANNER */}
              <div className="rounded-2xl border border-edge bg-card p-5 sm:p-6 shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-signal/15 text-signal">
                      <Icon.Scale className="h-3.5 w-3.5" />
                    </span>
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
                      A/B Benchmarking Strategy & Recruiter Positioning Verdict
                    </span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-signal">
                    Deterministic Comparative Matrix
                  </span>
                </div>

                <div className="rounded-xl border border-edge bg-well/40 p-4 space-y-1.5">
                  <h4 className="font-mono text-sm font-bold text-content">
                    {abComparison.verdictTitle}
                  </h4>
                  <p className="font-sans text-xs text-muted leading-relaxed">
                    {abComparison.verdictDescription}
                  </p>
                </div>
              </div>

              {/* 4-DIMENSION SIDE-BY-SIDE ALIGNMENT MATRIX */}
              <div className="rounded-2xl border border-edge bg-card p-5 sm:p-6 shadow-card space-y-5">
                <div className="flex items-center justify-between border-b border-edge pb-3">
                  <div>
                    <h3 className="font-mono text-sm font-bold text-content flex items-center gap-2">
                      <Icon.Target className="h-4 w-4 text-signal" />
                      <span>4-Dimension Technical Alignment Matrix</span>
                    </h3>
                    <p className="font-sans text-xs text-muted mt-0.5">
                      Side-by-side verification of technical domain depth between Variant A and Variant B.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="flex items-center gap-1 text-signal font-bold">
                      <span className="h-2 w-2 rounded-full bg-signal inline-block" />
                      Variant A
                    </span>
                    <span className="flex items-center gap-1 text-blue-400 font-bold">
                      <span className="h-2 w-2 rounded-full bg-blue-500 inline-block" />
                      Variant B
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {abComparison.dimensions.map((dim) => (
                    <div
                      key={dim.key}
                      className="rounded-xl border border-edge bg-well/30 p-4 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-mono text-xs">
                        <span className="font-bold text-content">{dim.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-signal font-bold">A: {dim.scoreA}%</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                              dim.delta > 0
                                ? 'bg-signal/20 text-signal'
                                : dim.delta < 0
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-card text-muted'
                            }`}
                          >
                            {dim.delta > 0
                              ? `+${dim.delta}% A`
                              : dim.delta < 0
                              ? `+${Math.abs(dim.delta)}% B`
                              : 'Tied'}
                          </span>
                          <span className="text-blue-400 font-bold">B: {dim.scoreB}%</span>
                        </div>
                      </div>

                      {/* Side-by-side Dual Progress Bar */}
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <div className="space-y-1">
                          <div className="h-2 w-full bg-well rounded-full overflow-hidden">
                            <div
                              className="h-full bg-signal rounded-full transition-all duration-500"
                              style={{ width: `${dim.scoreA}%` }}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="h-2 w-full bg-well rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${dim.scoreB}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* HARD SKILLS COMPARATIVE MATRIX (4 QUADRANTS) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Quadrant 1: Unique to Variant A */}
                <div className="rounded-2xl border border-edge bg-card p-5 shadow-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-signal">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-signal/15 text-[10px]">
                        A
                      </span>
                      <span>Unique Advantages in Variant A ({abComparison.uniqueToA.length})</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted">Present only in A</span>
                  </div>

                  {abComparison.uniqueToA.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {abComparison.uniqueToA.map((skill) => (
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
                    <p className="font-mono text-xs text-muted pt-2">
                      No unique keywords over Variant B.
                    </p>
                  )}
                </div>

                {/* Quadrant 2: Unique to Variant B */}
                <div className="rounded-2xl border border-edge bg-card p-5 shadow-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-blue-400">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-blue-500/15 text-[10px]">
                        B
                      </span>
                      <span>Unique Advantages in Variant B ({abComparison.uniqueToB.length})</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted">Present only in B</span>
                  </div>

                  {abComparison.uniqueToB.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {abComparison.uniqueToB.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-blue-400 uppercase tracking-wider"
                        >
                          <Icon.Check className="h-3 w-3" />
                          <span>{skill}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="font-mono text-xs text-muted pt-2">
                      No unique keywords over Variant A.
                    </p>
                  )}
                </div>

                {/* Quadrant 3: Mutual Verified Primitives */}
                <div className="rounded-2xl border border-edge bg-card p-5 shadow-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-content">
                      <Icon.CheckCircle className="h-4 w-4 text-signal" />
                      <span>Mutual Verified Primitives ({abComparison.mutualMatched.length})</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted">Shared by A & B</span>
                  </div>

                  {abComparison.mutualMatched.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {abComparison.mutualMatched.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center gap-1 rounded-lg border border-edge bg-well px-2.5 py-1 font-mono text-xs font-medium text-content uppercase tracking-wider"
                        >
                          <Icon.Check className="h-3 w-3 text-signal" />
                          <span>{skill}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="font-mono text-xs text-muted pt-2">
                      No mutual primitives identified.
                    </p>
                  )}
                </div>

                {/* Quadrant 4: Mutual Skill Gaps */}
                <div className="rounded-2xl border border-edge bg-card p-5 shadow-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-500">
                      <Icon.Alert className="h-4 w-4" />
                      <span>Mutual Remaining Gaps ({abComparison.mutualGaps.length})</span>
                    </div>
                    <span className="font-mono text-[10px] text-muted">Missing in both</span>
                  </div>

                  {abComparison.mutualGaps.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {abComparison.mutualGaps.map((gap) => (
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
                    <p className="font-mono text-xs text-signal font-semibold pt-2">
                      Zero mutual gaps! The combination of variants covers all JD requirements.
                    </p>
                  )}
                </div>
              </div>

              {/* NARRATIVE & PROFESSIONAL SUMMARY COMPARISON */}
              <div className="rounded-2xl border border-edge bg-card p-5 sm:p-6 shadow-card space-y-4">
                <div className="flex items-center justify-between border-b border-edge pb-3">
                  <div>
                    <h3 className="font-mono text-sm font-bold text-content flex items-center gap-2">
                      <Icon.FileText className="h-4 w-4 text-signal" />
                      <span>Career Narrative & Professional Summary Differentiation</span>
                    </h3>
                    <p className="font-sans text-xs text-muted mt-0.5">
                      Examine how the executive pitch is tuned between Variant A and Variant B.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Variant A Summary */}
                  <div className="rounded-xl border border-edge bg-well/30 p-4 space-y-2">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-bold text-signal flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded bg-signal/15 text-[10px]">
                          A
                        </span>
                        {activeResume.title}
                      </span>
                      <span className="text-[10px] text-muted">
                        {activeResume.summary.trim() ? `${activeResume.summary.trim().split(/\s+/).length} words` : 'No summary'}
                      </span>
                    </div>
                    <p className="font-sans text-xs text-content leading-relaxed bg-card p-3 rounded-lg border border-edge min-h-[80px]">
                      {activeResume.summary || (
                        <span className="italic text-muted font-mono text-[11px]">
                          No professional summary defined for Variant A.
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Variant B Summary */}
                  <div className="rounded-xl border border-edge bg-well/30 p-4 space-y-2">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="font-bold text-blue-400 flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded bg-blue-500/15 text-[10px]">
                          B
                        </span>
                        {activeResumeB.title}
                      </span>
                      <span className="text-[10px] text-muted">
                        {activeResumeB.summary.trim() ? `${activeResumeB.summary.trim().split(/\s+/).length} words` : 'No summary'}
                      </span>
                    </div>
                    <p className="font-sans text-xs text-content leading-relaxed bg-card p-3 rounded-lg border border-edge min-h-[80px]">
                      {activeResumeB.summary || (
                        <span className="italic text-muted font-mono text-[11px]">
                          No professional summary defined for Variant B.
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
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
              Rank all resumes in your vault against this JD. Set baseline (A) or challenger (B) in 1 click.
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
                const isSelectedA = resume.id === activeResume.id;
                const isSelectedB = resume.id === activeResumeB?.id;

                return (
                  <tr
                    key={resume.id}
                    className={`transition-colors ${
                      isSelectedA
                        ? 'bg-signal/5 font-semibold'
                        : isSelectedB
                        ? 'bg-blue-500/5 font-semibold'
                        : 'hover:bg-well/50'
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
                        {isSelectedA && (
                          <span className="rounded border border-signal/40 bg-signal/10 px-1.5 py-0.2 text-[9px] text-signal font-bold">
                            Variant A
                          </span>
                        )}
                        {isSelectedB && (
                          <span className="rounded border border-blue-500/40 bg-blue-500/10 px-1.5 py-0.2 text-[9px] text-blue-400 font-bold">
                            Variant B
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
                    <td className="py-3 text-right space-x-1.5">
                      {!isSelectedA && (
                        <button
                          type="button"
                          onClick={() => setSelectedResumeId(resume.id)}
                          className="rounded-lg border border-edge bg-well px-2.5 py-1 text-[11px] text-content hover:border-signal/50 hover:text-signal transition-colors cursor-pointer"
                        >
                          Set A
                        </button>
                      )}
                      {!isSelectedB && resume.id !== activeResume.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setCompareResumeId(resume.id);
                            setViewMode('ab_benchmark');
                          }}
                          className="rounded-lg border border-edge bg-well px-2.5 py-1 text-[11px] text-blue-400 hover:border-blue-500/50 transition-colors cursor-pointer"
                        >
                          Compare B
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenTailor(resume)}
                        className="rounded-lg bg-signal/15 border border-signal/40 px-2.5 py-1 text-[11px] text-signal font-bold hover:bg-signal/25 transition-colors cursor-pointer"
                      >
                        Tailor
                      </button>
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
