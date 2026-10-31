'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/icons';
import {
  PortfolioSSOT,
  PortfolioCompany,
  PortfolioProduct,
  MasterBullet,
  getLocalPortfolio,
  fetchPortfolio,
} from '@/lib/portfolio';
import {
  ResumeProfile,
  assembleResumeFromPortfolioSSOT,
  saveResume,
} from '@/lib/resumes';
import { FormField, TextInput, TextArea, Select, Checkbox, type SelectOption } from '@/components/ui';

interface ResumeSSOTAssemblerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAssembled: (newResume: ResumeProfile) => void;
  existingResume?: ResumeProfile | null;
}

const ROLE_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'Backend / Distributed Systems', label: 'Backend / Distributed Systems', description: 'Go, Rust, Microservices, Low-latency' },
  { value: 'Staff Cloud Architect', label: 'Staff Cloud Architect', description: 'AWS, GCP, Kubernetes, Multi-region' },
  { value: 'Fullstack Lead', label: 'Fullstack Lead', description: 'React, Next.js, Node.js, WebSockets' },
  { value: 'DevOps / SRE / Platform', label: 'DevOps / SRE / Platform', description: 'Terraform, CI/CD, Observability' },
  { value: 'Frontend / Design Systems', label: 'Frontend / Design Systems', description: 'TypeScript, Web Performance, UI/UX' },
  { value: 'Data / ML Infrastructure', label: 'Data / ML Infrastructure', description: 'Kafka, Spark, Vector DBs, Pipelines' },
  { value: 'Engineering Leadership', label: 'Engineering Leadership', description: 'Engineering Manager, Director, Staff+' },
];

export function ResumeSSOTAssemblerModal({
  isOpen,
  onClose,
  onAssembled,
  existingResume,
}: ResumeSSOTAssemblerModalProps) {
  const [mounted, setMounted] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioSSOT>({
    companies: [],
    standalone_projects: [],
    unattached_bullets: [],
  });
  const [loading, setLoading] = useState(true);

  // Variant Configuration State
  const [variantTitle, setVariantTitle] = useState('');
  const [targetRoleType, setTargetRoleType] = useState('Backend / Distributed Systems');
  const [customHeadline, setCustomHeadline] = useState('');
  const [customSummary, setCustomSummary] = useState('');
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeProjects, setIncludeProjects] = useState(true);
  const [includeEducation, setIncludeEducation] = useState(true);

  // Selection Sets
  const [selectedBulletIds, setSelectedBulletIds] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [selectedEducationIds, setSelectedEducationIds] = useState<Set<string>>(new Set());

  // Search / filter within the assembler modal
  const [bulletSearch, setBulletSearch] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load latest SSOT data on open
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    const initFromPortfolio = (data: PortfolioSSOT) => {
      setPortfolio(data);

      const fullName = data.identity?.full_name || 'Software Engineer';
      const initialHeadline = data.identity?.headline || 'Senior Software Engineer';
      const defaultRoleType = ROLE_CATEGORY_OPTIONS.some((r) => initialHeadline.toLowerCase().includes(r.value.toLowerCase()))
        ? initialHeadline
        : 'Backend / Distributed Systems';

      setTargetRoleType(defaultRoleType);
      setCustomHeadline(initialHeadline);
      setCustomSummary(data.summary || '');
      setIncludeSummary(Boolean(data.summary?.trim()));

      if (existingResume) {
        setVariantTitle(existingResume.title);
        setTargetRoleType(existingResume.targetRoleType || defaultRoleType);
        setCustomSummary(existingResume.summary || '');
      } else {
        setVariantTitle(`${fullName} — ${defaultRoleType} (SSOT Assembled)`);
      }

      // Default select all approved bullets or all bullets
      const allBulletIds = new Set<string>();
      data.companies.forEach((comp) => {
        comp.bullets?.forEach((b) => allBulletIds.add(b.id));
        comp.products?.forEach((prod) => {
          prod.bullets?.forEach((b) => allBulletIds.add(b.id));
        });
      });
      data.standalone_projects.forEach((pr) => {
        pr.bullets?.forEach((b) => allBulletIds.add(b.id));
      });
      setSelectedBulletIds(allBulletIds);

      // Default select all skills categories
      const allCats = new Set<string>((data.skills || []).map((s) => s.category));
      setSelectedCategories(allCats);

      // Default select all projects and education
      setSelectedProjectIds(new Set(data.standalone_projects.map((p) => p.id)));
      setSelectedEducationIds(new Set((data.education || []).map((e) => e.id)));

      setLoading(false);
    };

    fetchPortfolio()
      .then(initFromPortfolio)
      .catch(() => {
        initFromPortfolio(getLocalPortfolio());
      });
  }, [isOpen, existingResume]);

  // Keyboard shortcut: Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Aggregate Bullet Stats
  const totalAvailableBullets = useMemo(() => {
    let count = 0;
    portfolio.companies.forEach((comp) => {
      count += comp.bullets?.length || 0;
      comp.products?.forEach((prod) => {
        count += prod.bullets?.length || 0;
      });
    });
    portfolio.standalone_projects.forEach((pr) => {
      count += pr.bullets?.length || 0;
    });
    return count;
  }, [portfolio]);

  const selectedBulletCount = selectedBulletIds.size;

  // Toggle helpers
  const handleToggleBullet = (id: string) => {
    setSelectedBulletIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleSelectAllBullets = () => {
    const all = new Set<string>();
    portfolio.companies.forEach((comp) => {
      comp.bullets?.forEach((b) => all.add(b.id));
      comp.products?.forEach((prod) => {
        prod.bullets?.forEach((b) => all.add(b.id));
      });
    });
    portfolio.standalone_projects.forEach((pr) => {
      pr.bullets?.forEach((b) => all.add(b.id));
    });
    setSelectedBulletIds(all);
  };

  const handleSelectApprovedOnly = () => {
    const approved = new Set<string>();
    portfolio.companies.forEach((comp) => {
      comp.bullets?.filter((b) => b.review_status === 'approved').forEach((b) => approved.add(b.id));
      comp.products?.forEach((prod) => {
        prod.bullets?.filter((b) => b.review_status === 'approved').forEach((b) => approved.add(b.id));
      });
    });
    portfolio.standalone_projects.forEach((pr) => {
      pr.bullets?.filter((b) => b.review_status === 'approved').forEach((b) => approved.add(b.id));
    });
    setSelectedBulletIds(approved);
  };

  const handleClearAllBullets = () => {
    setSelectedBulletIds(new Set());
  };

  const handleToggleCompanyBullets = (comp: PortfolioCompany) => {
    const compBulletIds: string[] = [];
    comp.bullets?.forEach((b) => compBulletIds.push(b.id));
    comp.products?.forEach((prod) => {
      prod.bullets?.forEach((b) => compBulletIds.push(b.id));
    });

    const allInCompSelected = compBulletIds.every((id) => selectedBulletIds.has(id));

    setSelectedBulletIds((prev) => {
      const next = new Set(prev);
      if (allInCompSelected) {
        compBulletIds.forEach((id) => next.delete(id));
      } else {
        compBulletIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Submit / Assemble Handler
  const handleAssemble = () => {
    const assembled = assembleResumeFromPortfolioSSOT(portfolio, {
      title: variantTitle.trim() || `${portfolio.identity?.full_name || 'Developer'} Resume`,
      targetRoleType,
      customSummary: includeSummary ? customSummary.trim() : '',
      selectedBulletIds: Array.from(selectedBulletIds),
      selectedSkillCategories: Array.from(selectedCategories),
      selectedProjectIds: Array.from(selectedProjectIds),
      selectedEducationIds: Array.from(selectedEducationIds),
      includeProjects,
      includeEducation,
      versionLabel: 'v1.0 (SSOT Assembled)',
    });

    const saved = saveResume(assembled);
    onAssembled(saved);
    onClose();
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-4xl my-auto rounded-2xl border border-edge/80 bg-card shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-edge/80 bg-surface/80 backdrop-blur-md shrink-0 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded bg-signal/15 text-signal px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border border-signal/25">
                Multi-Resume Studio · SSOT Assembler
              </span>
              <span className="text-[11px] font-mono text-muted hidden sm:inline">
                {selectedBulletCount} of {totalAvailableBullets} master bullets selected
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold font-mono text-content truncate">
              {existingResume ? 'Re-Assemble Variant from Master SSOT' : 'Assemble Resume Variant from Master SSOT'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-content hover:bg-muted/15 transition-colors cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <Icon.X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-16 text-center space-y-3 font-mono text-xs text-muted">
              <Icon.Spinner className="h-6 w-6 animate-spin mx-auto text-signal" />
              <p>Loading Living Portfolio SSOT ledger...</p>
            </div>
          ) : portfolio.companies.length === 0 && portfolio.standalone_projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-edge/80 p-8 text-center space-y-3">
              <p className="font-mono text-sm text-content font-bold">Your Master Portfolio SSOT is Empty</p>
              <p className="font-sans text-xs text-muted max-w-md mx-auto">
                Before assembling tailored resume variants, record your companies and accomplishments in the Living Portfolio ledger, or import an existing CV.
              </p>
            </div>
          ) : (
            <>
              {/* Step 1: Target Objective & Variant Details */}
              <div className="rounded-xl border border-edge/80 bg-surface/50 p-4 space-y-4 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-content">
                  <span className="text-signal">01</span>
                  <span>Target Variant Objective</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Variant Document Title" required hint="Identifier in your Resume Vault">
                    <TextInput
                      value={variantTitle}
                      onChange={(e) => setVariantTitle(e.target.value)}
                      placeholder="e.g. Staff Backend Engineer — Distributed Systems"
                      autoFocus
                    />
                  </FormField>
                  <FormField label="Target Role Specialization" required hint="Aligns positioning with JD requirements">
                    <Select
                      value={targetRoleType}
                      onChange={setTargetRoleType}
                      options={ROLE_CATEGORY_OPTIONS}
                      ariaLabel="Target Role Specialization"
                    />
                  </FormField>
                </div>
              </div>

              {/* Step 2: Pillar 1 & 2 (Identity & Summary) */}
              <div className="rounded-xl border border-edge/80 bg-surface/50 p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-edge/40">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-content">
                    <span className="text-signal">02</span>
                    <span>Identity Header & Professional Summary</span>
                  </div>
                  <Checkbox
                    checked={includeSummary}
                    onChange={setIncludeSummary}
                    label="Include Summary"
                  />
                </div>

                <div className="text-xs font-mono text-muted flex items-center gap-3 flex-wrap">
                  <span className="text-content font-bold">{portfolio.identity?.full_name || 'Candidate Name'}</span>
                  {portfolio.identity?.location && <span>• {portfolio.identity.location}</span>}
                  {portfolio.identity?.email && <span>• {portfolio.identity.email}</span>}
                </div>

                {includeSummary && (
                  <div className="pt-2">
                    <TextArea
                      rows={3}
                      value={customSummary}
                      onChange={(e) => setCustomSummary(e.target.value)}
                      placeholder="Executive summary for this variant..."
                    />
                  </div>
                )}
              </div>

              {/* Step 3: Pillar 3 (Technical Skills Matrix) */}
              {portfolio.skills && portfolio.skills.length > 0 && (
                <div className="rounded-xl border border-edge/80 bg-surface/50 p-4 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-edge/40">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-content">
                      <span className="text-signal">03</span>
                      <span>Technical Competencies Matrix ({selectedCategories.size} of {portfolio.skills.length} categories)</span>
                    </div>
                  </div>

                  <p className="text-xs font-sans text-muted">
                    Toggle which skill domains to include in this tailored variant.
                  </p>

                  <div className="space-y-2 pt-1">
                    {portfolio.skills.map((cat, idx) => {
                      const isSelected = selectedCategories.has(cat.category);
                      return (
                        <div
                          key={idx}
                          onClick={() => handleToggleCategory(cat.category)}
                          className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                            isSelected
                              ? 'border-signal/40 bg-card shadow-xs'
                              : 'border-edge/50 bg-card/40 opacity-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={isSelected}
                              onChange={() => handleToggleCategory(cat.category)}
                            />
                            <span className="font-mono text-xs font-bold text-content">
                              {cat.category}:
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                            {cat.items.map((skill, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-2 py-0.5 rounded text-[10px] font-mono bg-well/80 border border-edge/70 text-content"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Pillars 4 & 5 (Experience & Master Bullets Selector) */}
              <div className="rounded-xl border border-edge/80 bg-surface/50 p-4 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-edge/40">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-content">
                    <span className="text-signal">04</span>
                    <span>Selective Experience & Master Bullets Ledger</span>
                  </div>

                  {/* Bulk Controls */}
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={handleSelectApprovedOnly}
                      className="px-2 py-1 rounded border border-edge bg-card hover:bg-well text-muted hover:text-content transition-colors cursor-pointer"
                    >
                      Approved Only
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectAllBullets}
                      className="px-2 py-1 rounded border border-edge bg-card hover:bg-well text-muted hover:text-content transition-colors cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllBullets}
                      className="px-2 py-1 rounded border border-edge bg-card hover:bg-well text-muted hover:text-red-500 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {portfolio.companies.map((comp) => {
                    const compBullets: { bullet: MasterBullet; productTitle?: string }[] = [];
                    (comp.bullets || []).forEach((b) => compBullets.push({ bullet: b }));
                    (comp.products || []).forEach((prod) => {
                      (prod.bullets || []).forEach((b) => compBullets.push({ bullet: b, productTitle: prod.name }));
                    });

                    const selectedInComp = compBullets.filter((b) => selectedBulletIds.has(b.bullet.id)).length;

                    return (
                      <div
                        key={comp.id}
                        className="rounded-xl border border-edge/80 bg-card p-4 space-y-3 shadow-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-edge/30">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Checkbox
                              checked={selectedInComp === compBullets.length && compBullets.length > 0}
                              indeterminate={selectedInComp > 0 && selectedInComp < compBullets.length}
                              onChange={() => handleToggleCompanyBullets(comp)}
                              title={selectedInComp === compBullets.length ? 'Deselect company' : 'Select all in company'}
                            />
                            <span className="font-mono font-bold text-sm text-content">
                              {comp.name}
                            </span>
                            {comp.role_title && (
                              <span className="font-mono text-xs text-signal">
                                / {comp.role_title}
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-muted">
                              ({selectedInComp} of {compBullets.length} bullets included)
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleCompanyBullets(comp)}
                            className="text-[11px] font-mono text-muted hover:text-content underline cursor-pointer self-start sm:self-auto"
                          >
                            {selectedInComp === compBullets.length ? 'Deselect company' : 'Select all in company'}
                          </button>
                        </div>

                        {/* Bullets List */}
                        <div className="space-y-2 pt-1">
                          {compBullets.map(({ bullet, productTitle }) => {
                            const isChecked = selectedBulletIds.has(bullet.id);
                            return (
                              <div
                                key={bullet.id}
                                onClick={() => handleToggleBullet(bullet.id)}
                                className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                                  isChecked
                                    ? 'border-signal/40 bg-surface/70'
                                    : 'border-edge/50 bg-surface/20 opacity-45'
                                }`}
                              >
                                <Checkbox
                                  checked={isChecked}
                                  onChange={() => handleToggleBullet(bullet.id)}
                                  className="mt-0.5"
                                />

                                <div className="space-y-1 min-w-0 flex-1">
                                  {productTitle && (
                                    <span className="font-mono text-[10px] text-muted uppercase tracking-wider block">
                                      {productTitle}
                                    </span>
                                  )}
                                  <p className="font-sans text-xs text-content leading-relaxed">
                                    {bullet.bullet_text}
                                  </p>
                                </div>

                                {bullet.metric_primary && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                                    {bullet.metric_primary}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 5: Standalone Projects & Education */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Projects */}
                <div className="rounded-xl border border-edge/80 bg-surface/50 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-edge/40">
                    <span className="font-mono text-xs font-bold text-content uppercase tracking-wider">
                      Standalone Projects ({portfolio.standalone_projects.length})
                    </span>
                    <Checkbox
                      checked={includeProjects}
                      onChange={setIncludeProjects}
                      label="Include"
                    />
                  </div>

                  {includeProjects && (
                    <div className="space-y-2">
                      {portfolio.standalone_projects.map((pr) => (
                        <div
                          key={pr.id}
                          onClick={() => {
                            setSelectedProjectIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(pr.id)) next.delete(pr.id);
                              else next.add(pr.id);
                              return next;
                            });
                          }}
                          className="flex items-start gap-2 p-2 rounded-lg border border-edge bg-card text-xs cursor-pointer hover:border-signal/40 transition-colors"
                        >
                          <Checkbox
                            checked={selectedProjectIds.has(pr.id)}
                            onChange={() => {
                              setSelectedProjectIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(pr.id)) next.delete(pr.id);
                                else next.add(pr.id);
                                return next;
                              });
                            }}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-content block">{pr.name}</span>
                            {pr.headline && <span className="font-sans text-[11px] text-muted block truncate">{pr.headline}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Education */}
                <div className="rounded-xl border border-edge/80 bg-surface/50 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-edge/40">
                    <span className="font-mono text-xs font-bold text-content uppercase tracking-wider">
                      Academic Credentials ({portfolio.education?.length || 0})
                    </span>
                    <Checkbox
                      checked={includeEducation}
                      onChange={setIncludeEducation}
                      label="Include"
                    />
                  </div>

                  {includeEducation && (
                    <div className="space-y-2">
                      {(portfolio.education || []).map((edu) => (
                        <div
                          key={edu.id}
                          onClick={() => {
                            setSelectedEducationIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(edu.id)) next.delete(edu.id);
                              else next.add(edu.id);
                              return next;
                            });
                          }}
                          className="flex items-start gap-2 p-2 rounded-lg border border-edge bg-card text-xs cursor-pointer hover:border-signal/40 transition-colors"
                        >
                          <Checkbox
                            checked={selectedEducationIds.has(edu.id)}
                            onChange={() => {
                              setSelectedEducationIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(edu.id)) next.delete(edu.id);
                                else next.add(edu.id);
                                return next;
                              });
                            }}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <span className="font-mono font-bold text-content block">{edu.degree}</span>
                            <span className="font-mono text-[11px] text-signal block">{edu.institution}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-edge/80 bg-surface/80 backdrop-blur-md shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-xs font-mono text-muted">
            <span>
              <strong className="text-content">{selectedBulletCount}</strong> bullets
            </span>
            <span>•</span>
            <span>
              <strong className="text-content">{selectedCategories.size}</strong> skill categories
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-edge/70 bg-card hover:bg-muted/10 text-muted hover:text-content text-xs font-mono font-medium transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssemble}
              disabled={loading || selectedBulletCount === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-signal hover:bg-signal-hover text-surface text-xs font-mono font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Icon.Sparkle className="h-3.5 w-3.5" />
              <span>Assemble Variant</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
