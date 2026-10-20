'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  JobProject,
  JobCandidateRecord,
  PipelineStage,
  updateCandidateInProject,
  removeCandidateFromProject,
  batchUpdateCandidatesStage,
  exportPipelineToMarkdown,
} from '@/lib/job-projects';
import { Icon } from '@/components/icons';
import { Select, Checkbox, StarRating, SearchInput, SegmentedTabs, ConfirmModal } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import CandidateCompareModal from './CandidateCompareModal';
import HiringCommitteeBriefModal from './HiringCommitteeBriefModal';

interface JobCandidatePipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: JobProject;
  projects: JobProject[];
  onSelectProject: (projectId: string) => void;
  onOpenGuardrails: () => void;
  onRefreshProjects: () => void;
  onScreenCandidate: (username: string) => void;
}

export default function JobCandidatePipelineModal({
  isOpen,
  onClose,
  project,
  projects,
  onSelectProject,
  onOpenGuardrails,
  onRefreshProjects,
  onScreenCandidate,
}: JobCandidatePipelineModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'fit_desc' | 'fit_asc' | 'rating_desc' | 'date_desc'>('fit_desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  const [copiedMd, setCopiedMd] = useState(false);

  // Quick candidate screen input
  const [quickHandle, setQuickHandle] = useState('');

  // Modals
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [briefCandidate, setBriefCandidate] = useState<JobCandidateRecord | null>(null);
  const [candidateToRemove, setCandidateToRemove] = useState<{ candId: string; username: string } | null>(null);

  if (!isOpen) return null;

  const stageOptions: { value: PipelineStage; label: string }[] = [
    { value: 'new_assessed', label: 'New Assessed' },
    { value: 'phone_screen_scheduled', label: 'Phone Screen' },
    { value: 'interviewing', label: 'Interviewing' },
    { value: 'offer', label: 'Offer Stage' },
    { value: 'archived', label: 'Archived' },
  ];

  const stageSelectOptions: SelectOption[] = stageOptions.map((s) => ({
    value: s.value,
    label: s.label,
  }));

  const sortOptions: SelectOption[] = [
    { value: 'fit_desc', label: 'Fit Score: High → Low' },
    { value: 'fit_asc', label: 'Fit Score: Low → High' },
    { value: 'rating_desc', label: 'Rating: Highest First' },
    { value: 'date_desc', label: 'Evaluated: Newest First' },
  ];

  const projectSelectOptions: SelectOption[] = projects.map((p) => ({
    value: p.id,
    label: `${p.title} (${p.candidates.length} candidates)`,
  }));

  // Filter & Sort
  const filteredCandidates = useMemo(() => {
    let list = [...project.candidates];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.username.toLowerCase().includes(q) ||
          (c.fullName && c.fullName.toLowerCase().includes(q)) ||
          (c.recruiterNotes && c.recruiterNotes.toLowerCase().includes(q))
      );
    }

    if (selectedStage !== 'all') {
      list = list.filter((c) => c.pipelineStage === selectedStage);
    }

    list.sort((a, b) => {
      if (sortBy === 'fit_desc') return b.fitScore - a.fitScore;
      if (sortBy === 'fit_asc') return a.fitScore - b.fitScore;
      if (sortBy === 'rating_desc') return (b.starRating || 0) - (a.starRating || 0);
      if (sortBy === 'date_desc')
        return new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime();
      return 0;
    });

    return list;
  }, [project.candidates, searchQuery, selectedStage, sortBy]);

  // Stats calculation
  const totalCount = project.candidates.length;
  const avgFit = totalCount > 0 ? Math.round(project.candidates.reduce((sum, c) => sum + c.fitScore, 0) / totalCount) : 0;
  const shortlistedCount = project.candidates.filter(
    (c) => c.pipelineStage === 'phone_screen_scheduled' || c.pipelineStage === 'interviewing' || c.pipelineStage === 'offer'
  ).length;

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? filteredCandidates.map((c) => c.id) : []);
  };

  const handleStageChange = (candId: string, stage: PipelineStage) => {
    updateCandidateInProject(project.id, candId, { pipelineStage: stage });
    onRefreshProjects();
  };

  const handleRatingChange = (candId: string, rating: number) => {
    updateCandidateInProject(project.id, candId, { starRating: rating });
    onRefreshProjects();
  };

  const handleSaveNote = (candId: string) => {
    updateCandidateInProject(project.id, candId, { recruiterNotes: editingNoteValue.trim() });
    setEditingNoteId(null);
    onRefreshProjects();
  };

  const handleRemove = (candId: string, username: string) => {
    setCandidateToRemove({ candId, username });
  };

  const handleBatchStageChange = (stage: PipelineStage) => {
    if (selectedIds.length === 0) return;
    batchUpdateCandidatesStage(project.id, selectedIds, stage);
    setSelectedIds([]);
    onRefreshProjects();
  };

  const handleExportMarkdown = () => {
    const md = exportPipelineToMarkdown(project);
    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2500);
  };

  const handleQuickScreen = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickHandle.trim()) return;
    const clean = quickHandle.trim().replace(/^@/, '');
    onScreenCandidate(clean);
    setQuickHandle('');
  };

  const compareCandidates = project.candidates.filter((c) => selectedIds.includes(c.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-md animate-in">
      <div className="relative flex h-[94vh] w-full max-w-7xl flex-col rounded-2xl border border-edge bg-card shadow-pop overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-edge bg-well px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-edge bg-card text-muted shrink-0">
              <Icon.Users className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-signal font-bold truncate">
                  RecruiterOS Pipeline
                </span>
                <span className="h-1 w-1 rounded-full bg-muted/60 shrink-0" />
                <span className="font-mono text-xs text-muted truncate">{project.department}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {/* Project Switcher */}
                <Select
                  value={project.id}
                  onChange={onSelectProject}
                  options={projectSelectOptions}
                  ariaLabel="Switch job project"
                  buttonClassName="border-none bg-transparent px-0 font-mono text-base font-bold text-content shadow-none hover:text-signal focus-visible:ring-0 truncate"
                />
              </div>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="flex items-center gap-1.5 rounded-lg border border-edge bg-card px-2.5 sm:px-3 py-1.5 font-mono text-xs font-semibold text-content transition-colors hover:border-signal/50 hover:text-signal outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
              title="Copy markdown table of this pipeline to clipboard"
            >
              <Icon.Clipboard className="h-3.5 w-3.5 text-muted" />
              <span>{copiedMd ? 'Copied' : 'Export'}<span className="hidden xs:inline"> Leaderboard</span></span>
              {copiedMd && <Icon.Check className="h-3 w-3 text-signal" />}
            </button>

            <button
              type="button"
              onClick={onOpenGuardrails}
              className="flex items-center gap-1.5 rounded-lg border border-edge bg-card px-2.5 sm:px-3 py-1.5 font-mono text-xs font-semibold text-content transition-colors hover:border-signal/50 hover:text-signal outline-none focus-visible:ring-2 focus-visible:ring-signal/40"
            >
              <Icon.Settings className="h-3.5 w-3.5 text-muted" />
              <span>Guardrails</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close pipeline"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-card font-mono text-sm text-muted transition-colors hover:border-signal/50 hover:text-signal ml-1"
            >
              <Icon.X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Requisition Summary Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 border-b border-edge px-4 sm:px-6 py-2.5 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted/80">Must-Have:</span>
              {project.requisition.mustHaveSkills.map((s) => (
                <span
                  key={s}
                  className="rounded border border-edge bg-well px-2 py-0.5 text-content text-[11px]"
                >
                  {s}
                </span>
              ))}
            </div>
            <span className="text-edge hidden xs:inline">|</span>
            <span className="text-muted">Target: <strong className="text-content uppercase">{project.requisition.seniorityTarget}</strong></span>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-muted text-[11px]">
            <span>Total: <strong className="text-content">{totalCount}</strong></span>
            <span>Shortlisted: <strong className="text-content">{shortlistedCount}</strong></span>
            <span>Avg Match: <strong className="text-signal">{avgFit}%</strong></span>
          </div>
        </div>

        {/* Toolbar: Search, Stage Filter Pills, Sort & Quick Screen */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-edge px-4 sm:px-6 py-3">
          <div className="overflow-x-auto no-scrollbar pb-1 -mb-1">
            <SegmentedTabs
              active={selectedStage}
              onChange={setSelectedStage}
              tabs={[
                { value: 'all', label: 'All', count: totalCount },
                ...stageOptions.map((st) => ({
                  value: st.value,
                  label: st.label,
                  count: project.candidates.filter((c) => c.pipelineStage === st.value).length,
                })),
              ]}
            />
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search candidate…"
              className="w-full sm:w-48"
            />

            <Select
              value={sortBy}
              onChange={(v) => setSortBy(v as typeof sortBy)}
              options={sortOptions}
              ariaLabel="Sort candidates"
              className="w-full sm:w-48"
            />
          </div>
        </div>

        {/* Candidate Table Area */}
        <div className="flex-1 overflow-y-auto thin-scroll p-3 sm:p-6">
          {filteredCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-edge bg-well text-muted">
                <Icon.Folder className="h-6 w-6" />
              </span>
              <div>
                <h4 className="font-mono text-sm font-bold text-content">
                  No candidates match current criteria
                </h4>
                <p className="mt-1 font-sans text-xs text-muted max-w-sm">
                  {searchQuery || selectedStage !== 'all'
                    ? 'Try clearing filters or search terms to view all evaluated candidates.'
                    : `No candidates assessed against ${project.title} yet. Add a candidate below to audit their fit.`}
                </p>
              </div>

              {/* Quick Screen Input */}
              <form
                onSubmit={handleQuickScreen}
                className="flex items-center gap-2 max-w-sm w-full pt-2"
              >
                <div className="flex items-center gap-1.5 flex-1 rounded-xl border border-edge bg-well px-3 py-2 transition-colors focus-within:border-signal">
                  <span className="font-mono text-xs text-signal font-bold">@</span>
                  <input
                    type="text"
                    value={quickHandle}
                    onChange={(e) => setQuickHandle(e.target.value)}
                    placeholder="github-username"
                    className="w-full bg-transparent font-mono text-xs text-content outline-none placeholder:text-muted/60"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white hover:bg-signal/90 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-signal/40 shadow-xs"
                >
                  Screen
                </button>
              </form>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-edge text-left font-mono text-[10px] uppercase tracking-wider text-muted">
                    <th className="py-2.5 pl-3 pr-2 w-8">
                      <Checkbox
                        checked={
                          filteredCandidates.length > 0 &&
                          selectedIds.length === filteredCandidates.length
                        }
                        onChange={handleSelectAll}
                        ariaLabel="Select all candidates"
                      />
                    </th>
                    <th className="py-2.5 px-2 w-12 text-center">Rank</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Candidate</th>
                    <th className="py-2.5 px-3 text-center min-w-[110px]">Fit Score</th>
                    <th className="py-2.5 px-3 text-center min-w-[130px]">Seniority</th>
                    <th className="py-2.5 px-3 min-w-[130px]">Stack Check</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Pipeline Stage</th>
                    <th className="py-2.5 px-3 min-w-[110px]">Rating</th>
                    <th className="py-2.5 px-3 min-w-[220px]">Recruiter Notes</th>
                    <th className="py-2.5 pr-3 pl-2 text-right min-w-[140px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {filteredCandidates.map((cand, idx) => {
                    const isSelected = selectedIds.includes(cand.id);

                    return (
                      <tr
                        key={cand.id}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-signal/[0.07] border-l-2 border-l-signal'
                            : 'hover:bg-well/60'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 pl-3 pr-2">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => handleToggleSelect(cand.id)}
                            ariaLabel={`Select ${cand.username}`}
                          />
                        </td>

                        {/* Rank */}
                        <td className="py-3 px-2 text-center">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-bold border ${
                              idx === 0
                                ? 'border-signal/40 bg-signal/15 text-signal'
                                : idx === 1
                                ? 'border-edge bg-well text-content'
                                : idx === 2
                                ? 'border-signal/25 bg-signal/[0.07] text-signal/90'
                                : 'border-edge bg-card text-muted'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                        </td>

                        {/* Candidate Identity */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full border border-edge bg-well overflow-hidden flex-none flex items-center justify-center">
                              {cand.avatarUrl ? (
                                <img
                                  src={cand.avatarUrl}
                                  alt={cand.username}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="font-mono text-xs font-bold text-muted">
                                  {cand.username.slice(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/profile/${cand.username}?jobId=${project.id}`}
                                target="_blank"
                                className="font-mono text-xs font-bold text-content hover:text-signal transition-colors block truncate"
                              >
                                {cand.fullName || `@${cand.username}`}
                              </Link>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted">
                                <span className="text-signal">@{cand.username}</span>
                                <span>·</span>
                                <span className="capitalize">{cand.persona.replace(/_/g, ' ')}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Fit Score */}
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`rounded-lg border px-2 py-0.5 font-mono text-xs font-bold ${
                                cand.fitScore >= 85
                                  ? 'border-signal/35 bg-signal/10 text-signal'
                                  : cand.fitScore >= 70
                                  ? 'border-edge bg-well text-content'
                                  : 'border-edge bg-well text-muted'
                              }`}
                            >
                              {cand.fitScore}%
                            </span>
                            <span className="mt-0.5 text-[9px] text-muted capitalize truncate max-w-[100px]">
                              {cand.verdict.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </td>

                        {/* Seniority */}
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="capitalize font-semibold text-content">
                              {cand.seniorityEstimate}
                            </span>
                            <span className="text-[9px] text-muted">
                              Target: {project.requisition.seniorityTarget}
                            </span>
                          </div>
                        </td>

                        {/* Stack Check */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="inline-flex items-center gap-1 text-signal font-bold">
                                <Icon.Check className="h-3 w-3" />
                                {cand.requirementsSummary.metCount} Met
                              </span>
                              {cand.requirementsSummary.missingCount > 0 && (
                                <span className="inline-flex items-center gap-1 text-muted">
                                  <Icon.X className="h-3 w-3" />
                                  {cand.requirementsSummary.missingCount}
                                </span>
                              )}
                            </div>
                            <div className="text-[9px] text-muted truncate max-w-[130px]">
                              {project.requisition.mustHaveSkills.slice(0, 3).join(', ')}
                            </div>
                          </div>
                        </td>

                        {/* Pipeline Stage Select */}
                        <td className="py-3 px-3">
                          <Select
                            value={cand.pipelineStage}
                            onChange={(v) => handleStageChange(cand.id, v as PipelineStage)}
                            options={stageSelectOptions}
                            ariaLabel={`Pipeline stage for ${cand.username}`}
                            buttonClassName="py-1 text-[11px]"
                          />
                        </td>

                        {/* Rating */}
                        <td className="py-3 px-3">
                          <StarRating
                            value={cand.starRating || 0}
                            onChange={(rating) => handleRatingChange(cand.id, rating)}
                          />
                        </td>

                        {/* Inline Recruiter Note */}
                        <td className="py-3 px-3">
                          {editingNoteId === cand.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingNoteValue}
                                onChange={(e) => setEditingNoteValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveNote(cand.id);
                                  if (e.key === 'Escape') setEditingNoteId(null);
                                }}
                                autoFocus
                                className="w-full rounded border border-signal bg-card px-2 py-1 font-mono text-xs text-content outline-none ring-2 ring-signal/20"
                              />
                              <button
                                onClick={() => handleSaveNote(cand.id)}
                                className="rounded bg-signal px-2 py-1 text-[10px] font-bold text-white shadow-xs"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingNoteId(cand.id);
                                setEditingNoteValue(cand.recruiterNotes || '');
                              }}
                              className="group flex items-center justify-between gap-1 rounded p-1 hover:bg-well cursor-pointer"
                              title="Click to edit recruiter notes"
                            >
                              <span className="truncate text-muted text-[11px] italic font-sans max-w-[190px]">
                                {cand.recruiterNotes || '+ Add note…'}
                              </span>
                              <Icon.Pencil className="h-3 w-3 flex-none text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 pr-3 pl-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setBriefCandidate(cand)}
                              className="rounded border border-edge bg-card px-2 py-1 font-mono text-[10px] font-medium text-content transition-colors hover:border-signal/50 hover:text-signal"
                              title="View and print 1-pager brief for hiring committee"
                            >
                              EM Brief
                            </button>

                            <Link
                              href={`/profile/${cand.username}?jobId=${project.id}`}
                              target="_blank"
                              className="flex h-[26px] w-[26px] items-center justify-center rounded border border-edge bg-card text-muted transition-colors hover:border-signal/50 hover:text-signal"
                              title="Open full interactive GitGrill audit dossier"
                            >
                              <Icon.ArrowUpRight className="h-3 w-3" />
                            </Link>

                            <button
                              type="button"
                              onClick={() => handleRemove(cand.id, cand.username)}
                              className="flex h-[26px] w-[26px] items-center justify-center rounded border border-edge bg-card text-muted transition-colors hover:border-rose-400/60 hover:text-rose-500"
                              title="Remove candidate from this job"
                            >
                              <Icon.X className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Floating Multi-Select Action Bar */}
        {selectedIds.length > 0 && (
          <div className="absolute bottom-5 inset-x-0 z-40 flex justify-center pointer-events-none px-4">
            <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-signal/40 bg-card/95 px-4 py-2.5 shadow-pop backdrop-blur-md max-w-full overflow-x-auto thin-scroll animate-in">
              <span className="font-mono text-xs font-bold text-signal whitespace-nowrap shrink-0">
                {selectedIds.length} candidate{selectedIds.length > 1 ? 's' : ''} selected
              </span>

              <span className="h-4 w-[1px] bg-edge shrink-0" />

              {/* Compare Side-by-Side (enabled when 2 or 3 selected) */}
              <button
                type="button"
                disabled={selectedIds.length < 2 || selectedIds.length > 3}
                onClick={() => setCompareModalOpen(true)}
                className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                  selectedIds.length >= 2 && selectedIds.length <= 3
                    ? 'bg-signal text-white hover:bg-signal/90 shadow-xs'
                    : 'cursor-not-allowed border border-edge bg-well text-muted/60'
                }`}
                title={
                  selectedIds.length < 2
                    ? 'Select 2 or 3 candidates to compare side-by-side'
                    : selectedIds.length > 3
                    ? 'Select at most 3 candidates to compare'
                    : 'Compare selected candidates side-by-side'
                }
              >
                <Icon.Scale className="h-3.5 w-3.5 shrink-0" />
                <span>Compare Side-by-Side</span>
              </button>

              {/* Batch Change Stage */}
              <Select
                value=""
                onChange={(v) => {
                  if (v) handleBatchStageChange(v as PipelineStage);
                }}
                options={[{ value: '', label: 'Move To Stage…' }, ...stageSelectOptions]}
                placeholder="Move To Stage…"
                ariaLabel="Batch move selected candidates to stage"
                className="w-44 shrink-0"
              />

              {/* Clear Selection */}
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="font-mono text-xs text-muted hover:text-content px-1.5 py-1 shrink-0 whitespace-nowrap"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Footer info bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-edge bg-well px-4 sm:px-6 py-2.5 sm:py-3 font-mono text-xs text-muted">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span>Showing {filteredCandidates.length} of {project.candidates.length} candidates</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">Select 2-3 candidates to calibrate</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="self-end sm:self-auto rounded-lg border border-edge bg-card px-4 py-1.5 font-mono text-xs font-semibold text-content transition-colors hover:border-signal/50 hover:text-signal"
          >
            Done
          </button>
        </div>
      </div>

      {/* Side-by-Side Calibration Modal */}
      {compareModalOpen && (
        <CandidateCompareModal
          isOpen={compareModalOpen}
          onClose={() => setCompareModalOpen(false)}
          project={project}
          candidates={compareCandidates}
        />
      )}

      {/* Hiring Committee 1-Pager Brief Modal */}
      {briefCandidate && (
        <HiringCommitteeBriefModal
          isOpen={!!briefCandidate}
          onClose={() => setBriefCandidate(null)}
          project={project}
          candidate={briefCandidate}
        />
      )}

      {/* Candidate Deletion Confirm Modal */}
      {candidateToRemove && (
        <ConfirmModal
          isOpen={!!candidateToRemove}
          onClose={() => setCandidateToRemove(null)}
          onConfirm={() => {
            if (candidateToRemove) {
              removeCandidateFromProject(project.id, candidateToRemove.candId);
              setSelectedIds((prev) => prev.filter((i) => i !== candidateToRemove.candId));
              onRefreshProjects();
              setCandidateToRemove(null);
            }
          }}
          title="Remove Candidate from Pipeline?"
          description={
            <div className="space-y-2 font-sans text-xs">
              <p>
                Remove <strong className="text-content">@{candidateToRemove.username}</strong> from the pipeline for <strong>{project.title}</strong>?
              </p>
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-500">
                <p className="font-semibold">Candidate Disassociated</p>
                <p className="mt-0.5 text-[11px] leading-relaxed">
                  Stage assignments and recruiter notes for this candidate in this requisition will be cleared.
                </p>
              </div>
            </div>
          }
          confirmLabel="Remove Candidate"
          variant="danger"
        />
      )}
    </div>
  );
}
