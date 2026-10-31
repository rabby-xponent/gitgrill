'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/icons';
import { Checkbox } from '@/components/ui';
import { ResumeProfile } from '@/lib/resumes';
import {
  ResumeTemplateId,
  ResumeFontFamily,
  ResumeSectionOrder,
  ResumeExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  TEMPLATE_METADATA,
  downloadResumeDocx,
  generateResumeMarkdown,
} from '@/lib/docx-export';

interface ResumeExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  resume: ResumeProfile | null;
}

export function ResumeExportModal({ isOpen, onClose, resume }: ResumeExportModalProps) {
  const [options, setOptions] = useState<ResumeExportOptions>(DEFAULT_EXPORT_OPTIONS);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);

  if (!isOpen || !resume) return null;

  const currentTemplateMeta = TEMPLATE_METADATA[options.template];
  const markdownPreview = generateResumeMarkdown(resume, options);

  const handleDownloadDocx = async () => {
    setIsExportingDocx(true);
    try {
      await downloadResumeDocx(resume, options);
    } catch (err) {
      console.error('Failed to export DOCX:', err);
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleDownloadMarkdown = () => {
    const md = generateResumeMarkdown(resume, options);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (resume.fullName || resume.title || 'resume')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');
    a.download = `${safeName}_${options.template}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = () => {
    const md = generateResumeMarkdown(resume, options);
    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="fade-up relative w-full max-w-5xl my-auto rounded-2xl border border-edge bg-card shadow-2xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between shrink-0 bg-surface/50">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-signal/15 text-signal">
              <Icon.Download className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-base font-bold text-content">
                  ATS Document Export Studio
                </h3>
                <span className="rounded bg-signal/15 px-2 py-0.5 font-mono text-[10px] font-bold text-signal uppercase tracking-wider">
                  {currentTemplateMeta.badge}
                </span>
              </div>
              <p className="font-sans text-xs text-muted">
                Export &ldquo;{resume.title}&rdquo; into recruiter-ready formats with your preferred layout archetype.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-well hover:text-content transition-colors cursor-pointer"
          >
            <Icon.X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Controls & Live Preview */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Layout & Styling Controls (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Template Archetype Selection */}
            <div className="space-y-2.5">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
                1. Select Layout Archetype
              </span>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(TEMPLATE_METADATA) as ResumeTemplateId[]).map((tId) => {
                  const meta = TEMPLATE_METADATA[tId];
                  const isSelected = options.template === tId;
                  return (
                    <div
                      key={tId}
                      onClick={() => setOptions((prev) => ({ ...prev, template: tId }))}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1 ${
                        isSelected
                          ? 'border-signal bg-signal/5 shadow-xs'
                          : 'border-edge bg-well/40 hover:border-signal/40'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className={`font-bold ${isSelected ? 'text-signal' : 'text-content'}`}>
                          {meta.label}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                            isSelected
                              ? 'bg-signal text-white'
                              : 'border border-edge bg-card text-muted'
                          }`}
                        >
                          {meta.atsPassRate}
                        </span>
                      </div>
                      <p className="font-sans text-[11px] text-muted leading-relaxed">
                        {meta.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Typography & Section Customization */}
            <div className="space-y-3 pt-4 border-t border-edge">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted">
                2. Typography & Structure
              </span>

              {/* Font Family */}
              <div className="space-y-1.5">
                <label className="font-mono text-[11px] text-content block">Font Family</label>
                <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
                  {(['Calibri', 'Arial', 'Georgia', 'Inter'] as ResumeFontFamily[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setOptions((prev) => ({ ...prev, fontFamily: f }))}
                      className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer text-xs ${
                        options.fontFamily === f
                          ? 'border-signal bg-signal text-white font-bold'
                          : 'border-edge bg-card text-content hover:bg-well'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Section Ordering */}
              <div className="space-y-1.5 pt-1">
                <label className="font-mono text-[11px] text-content block">Section Flow</label>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setOptions((prev) => ({ ...prev, sectionOrder: 'skills_first' }))}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer text-xs ${
                      options.sectionOrder === 'skills_first'
                        ? 'border-signal bg-signal/10 text-signal font-bold'
                        : 'border-edge bg-card text-muted hover:text-content'
                    }`}
                  >
                    <div>Skills Matrix Top</div>
                    <span className="text-[10px] text-muted font-normal">Skills → Experience</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptions((prev) => ({ ...prev, sectionOrder: 'experience_first' }))}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer text-xs ${
                      options.sectionOrder === 'experience_first'
                        ? 'border-signal bg-signal/10 text-signal font-bold'
                        : 'border-edge bg-card text-muted hover:text-content'
                    }`}
                  >
                    <div>Experience Top</div>
                    <span className="text-[10px] text-muted font-normal">Experience → Skills</span>
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-2">
                <Checkbox
                  checked={options.includeSummary}
                  onChange={(checked) => setOptions((prev) => ({ ...prev, includeSummary: !!checked }))}
                  label="Include Professional Summary"
                  description="Executive 3-beat pitch block"
                />
                <Checkbox
                  checked={options.includeProjects}
                  onChange={(checked) => setOptions((prev) => ({ ...prev, includeProjects: !!checked }))}
                  label="Include Standalone Projects"
                />
                <Checkbox
                  checked={options.includeEducation}
                  onChange={(checked) => setOptions((prev) => ({ ...prev, includeEducation: !!checked }))}
                  label="Include Academic Education"
                />
                <Checkbox
                  checked={options.showDividers !== false}
                  onChange={(checked) => setOptions((prev) => ({ ...prev, showDividers: !!checked }))}
                  label="Hairline Section Dividers"
                  description="Clean hairline rule beneath each section title"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Live Document Preview Box (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Icon.Eye className="h-3.5 w-3.5 text-signal" />
                <span>Live Document Preview</span>
              </span>
              <span className="font-mono text-[10px] text-muted">
                Font: {options.fontFamily} · {options.sectionOrder === 'skills_first' ? 'Skills First' : 'Exp First'}
              </span>
            </div>

            {/* Document Sheet Simulation */}
            <div className="flex-1 min-h-[440px] max-h-[500px] overflow-y-auto rounded-xl border border-edge bg-well/30 p-5 font-mono text-xs shadow-inner">
              <div
                className="bg-card p-6 sm:p-8 rounded-lg border border-edge shadow-card space-y-4 text-content"
                style={{
                  fontFamily:
                    options.fontFamily === 'Calibri'
                      ? 'Calibri, sans-serif'
                      : options.fontFamily === 'Arial'
                      ? 'Arial, sans-serif'
                      : options.fontFamily === 'Georgia'
                      ? 'Georgia, serif'
                      : 'var(--font-sans)',
                }}
              >
                {/* Header preview */}
                <div
                  className={`space-y-1 pb-3 ${
                    options.template === 'classic_centered' ? 'text-center' : 'text-left'
                  }`}
                >
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-content uppercase">
                    {resume.fullName || resume.title}
                  </h1>
                  {resume.targetRoleType && (
                    <div className="text-xs font-semibold text-signal uppercase tracking-wider">
                      {resume.targetRoleType}
                    </div>
                  )}
                  <div className="text-[11px] text-muted pt-1 flex flex-wrap gap-2 justify-center lg:justify-start">
                    {resume.location && <span>{resume.location}</span>}
                    {resume.email && <span>• {resume.email}</span>}
                    {resume.phone && <span>• {resume.phone}</span>}
                    {resume.githubUrl && <span>• {resume.githubUrl.replace(/^https?:\/\//, '')}</span>}
                  </div>
                </div>

                {/* Summary */}
                {options.includeSummary && resume.summary && (
                  <div className="space-y-1.5 pt-1">
                    <h2
                      className={`text-xs font-bold uppercase tracking-wider text-content ${
                        options.showDividers ? 'border-b border-edge pb-1' : ''
                      }`}
                    >
                      Professional Summary
                    </h2>
                    <p className="text-xs text-content/90 leading-relaxed font-sans">
                      {resume.summary}
                    </p>
                  </div>
                )}

                {/* Skills First or Exp First */}
                {options.sectionOrder === 'skills_first' ? (
                  <>
                    {/* Skills */}
                    {resume.skills && resume.skills.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <h2
                          className={`text-xs font-bold uppercase tracking-wider text-content ${
                            options.showDividers ? 'border-b border-edge pb-1' : ''
                          }`}
                        >
                          Technical Skills
                        </h2>
                        <div className="space-y-1 text-xs">
                          {resume.skills.map((c, i) => (
                            <div key={i}>
                              <strong className="text-content">{c.category}: </strong>
                              <span className="text-muted">{c.items.join(', ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Experience */}
                    {resume.experience && resume.experience.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <h2
                          className={`text-xs font-bold uppercase tracking-wider text-content ${
                            options.showDividers ? 'border-b border-edge pb-1' : ''
                          }`}
                        >
                          Professional Experience
                        </h2>
                        {resume.experience.map((exp, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-content">
                              <span>{exp.company}</span>
                              <span className="text-muted font-normal text-[11px]">
                                {exp.period}
                              </span>
                            </div>
                            <div className="text-xs italic text-signal">{exp.role}</div>
                            <ul className="list-disc list-inside space-y-1 text-xs text-content/90 font-sans pl-1">
                              {(exp.bullets || []).map((b, bIdx) => (
                                <li key={bIdx} className="leading-relaxed">
                                  {b}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Experience First */}
                    {resume.experience && resume.experience.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <h2
                          className={`text-xs font-bold uppercase tracking-wider text-content ${
                            options.showDividers ? 'border-b border-edge pb-1' : ''
                          }`}
                        >
                          Professional Experience
                        </h2>
                        {resume.experience.map((exp, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-content">
                              <span>{exp.company}</span>
                              <span className="text-muted font-normal text-[11px]">
                                {exp.period}
                              </span>
                            </div>
                            <div className="text-xs italic text-signal">{exp.role}</div>
                            <ul className="list-disc list-inside space-y-1 text-xs text-content/90 font-sans pl-1">
                              {(exp.bullets || []).map((b, bIdx) => (
                                <li key={bIdx} className="leading-relaxed">
                                  {b}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Skills */}
                    {resume.skills && resume.skills.length > 0 && (
                      <div className="space-y-1.5 pt-2">
                        <h2
                          className={`text-xs font-bold uppercase tracking-wider text-content ${
                            options.showDividers ? 'border-b border-edge pb-1' : ''
                          }`}
                        >
                          Technical Skills
                        </h2>
                        <div className="space-y-1 text-xs">
                          {resume.skills.map((c, i) => (
                            <div key={i}>
                              <strong className="text-content">{c.category}: </strong>
                              <span className="text-muted">{c.items.join(', ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Education */}
                {options.includeEducation && resume.education && resume.education.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    <h2
                      className={`text-xs font-bold uppercase tracking-wider text-content ${
                        options.showDividers ? 'border-b border-edge pb-1' : ''
                      }`}
                    >
                      Education & Credentials
                    </h2>
                    {resume.education.map((edu, i) => (
                      <div key={i} className="flex items-baseline justify-between text-xs">
                        <div>
                          <strong className="text-content">{edu.degree}</strong>
                          <span className="text-muted"> — {edu.institution}</span>
                        </div>
                        <span className="text-muted text-[11px]">{edu.year}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-edge bg-surface/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs font-semibold text-content hover:bg-card transition-colors cursor-pointer"
            >
              <Icon.Clipboard className="h-3.5 w-3.5 text-signal" />
              <span>{copiedMd ? 'Copied ATS Markdown!' : 'Copy ATS Text'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs font-semibold text-content hover:bg-card transition-colors cursor-pointer"
            >
              <Icon.Printer className="h-3.5 w-3.5 text-muted" />
              <span>Print / PDF</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-edge bg-card px-4 py-2 font-mono text-xs font-bold text-content hover:bg-well transition-colors cursor-pointer"
            >
              <Icon.FileText className="h-3.5 w-3.5 text-signal" />
              <span>Export .MD</span>
            </button>
            <button
              type="button"
              disabled={isExportingDocx}
              onClick={handleDownloadDocx}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-signal px-5 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-all cursor-pointer disabled:opacity-50"
            >
              <Icon.Download className="h-4 w-4" />
              <span>{isExportingDocx ? 'Generating Word DOCX…' : 'Download Formatted .DOCX'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
