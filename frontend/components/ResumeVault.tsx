'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@/components/icons';
import {
  ConfirmModal,
  AlertModal,
  Select,
  FormField,
  TextInput,
  TextArea,
} from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import {
  ResumeProfile,
  ResumeExperience,
  ResumeEducation,
  ResumeProject,
  IdentifiedSection,
  getResumes,
  saveResume,
  deleteResume,
  getActiveResumeId,
  setActiveResumeId,
  exportResumeAsMarkdown,
  parseUploadedResumeText,
  identifyResumeSections,
  extractDocxText,
  extractPdfText,
  dataUrlToArrayBuffer,
  branchResumeVariant,
  generateBulletInterviewDrills,
  generateHiringManagerPitch,
  generateAITailoredProposal,
  TailoredResumeProposal,
  evaluateResumeAgainstJD,
  JDMatchReport,
} from '@/lib/resumes';
import { TargetRole, getTargetRoles } from '@/lib/target-roles';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useSession } from '@/components/SessionProvider';
import { isAdmin } from '@/lib/admin';

type ViewMode = 'preview' | 'matchmaker' | 'diagnostics' | 'defense' | 'inmail';

const ROLE_CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'Backend / Distributed Systems', label: 'Backend / Distributed Systems', description: 'Go, Rust, Microservices, Low-latency' },
  { value: 'Staff Cloud Architect', label: 'Staff Cloud Architect', description: 'AWS, GCP, Kubernetes, Multi-region' },
  { value: 'Fullstack Lead', label: 'Fullstack Lead', description: 'React, Next.js, Node.js, GraphQL' },
  { value: 'DevOps / SRE / Platform', label: 'DevOps / SRE / Platform', description: 'Terraform, CI/CD, Observability' },
  { value: 'Frontend / Design Systems', label: 'Frontend / Design Systems', description: 'TypeScript, Web Performance, UI/UX' },
  { value: 'Data / ML Infrastructure', label: 'Data / ML Infrastructure', description: 'Kafka, Spark, Vector DBs, Pipelines' },
  { value: 'Engineering Leadership', label: 'Engineering Leadership', description: 'Engineering Manager, Director, Staff+' },
];

export function ResumeVault() {
  const [resumes, setResumes] = useState<ResumeProfile[]>([]);
  const [activeResumeId, setActiveId] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [isBranching, setIsBranching] = useState(false);
  const [editingResume, setEditingResume] = useState<ResumeProfile | null>(null);
  const [creationMethod, setCreationMethod] = useState<'upload' | 'paste' | 'form'>('upload');
  const [activeViewMode, setActiveViewMode] = useState<ViewMode>('preview');
  const [previewFormat, setPreviewFormat] = useState<'structured' | 'source' | 'pdf'>('structured');
  const [copied, setCopied] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawPasteText, setRawPasteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Premium Modal states
  const [resumeToDelete, setResumeToDelete] = useState<{ id: string; title: string; isMaster: boolean } | null>(null);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; description: string; variant?: 'error' | 'info' | 'warning' }>({
    isOpen: false,
    title: '',
    description: '',
  });

  // AI Tailor Studio state
  const [isTailorModalOpen, setIsTailorModalOpen] = useState(false);
  const [tailorTarget, setTailorTarget] = useState('Cefalo (Software Engineer)');
  const [proposal, setProposal] = useState<TailoredResumeProposal | null>(null);

  // Section Editor state
  const [isSectionEditOpen, setIsSectionEditOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editContactLine, setEditContactLine] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editExperiences, setEditExperiences] = useState<ResumeExperience[]>([]);
  const [editProjects, setEditProjects] = useState<ResumeProject[]>([]);
  const [editSkills, setEditSkills] = useState<{ category: string; items: string[] }[]>([]);
  const [editEducation, setEditEducation] = useState<ResumeEducation[]>([]);

  // Form / Branch state
  const [formTitle, setFormTitle] = useState('');
  const [formRoleType, setFormRoleType] = useState('Backend / Distributed Systems');
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formGithub, setFormGithub] = useState('');
  const [formLinkedin, setFormLinkedin] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formSkillsText, setFormSkillsText] = useState('');
  const [formBulletsText, setFormBulletsText] = useState('');

  // JD Matchmaker state in Vault
  const [targetRoles, setTargetRoles] = useState<TargetRole[]>([]);
  const [matchRoleId, setMatchRoleId] = useState<string>('');
  const [expandedMatchProbeIdx, setExpandedMatchProbeIdx] = useState<number | null>(0);

  // Dynamic Quota & Entitlement Gating
  const { entitlements } = useEntitlements();
  const { user } = useSession();
  const isSuperAdmin = isAdmin(user);
  const vaultVerdict = entitlements.capabilities['resumes.vault'];
  const vaultLimit = isSuperAdmin ? 'unlimited' : (typeof vaultVerdict?.limit === 'number' ? vaultVerdict.limit : 3);
  const isVaultAtLimit = !isSuperAdmin && typeof vaultLimit === 'number' && resumes.length >= vaultLimit;

  const loadData = async () => {
    let list = getResumes();
    const rolesList = getTargetRoles();
    setTargetRoles(rolesList);
    if (rolesList.length > 0) {
      setMatchRoleId((prev) => (prev ? prev : rolesList[0].id));
    }

    // Auto-heal master copies with upgraded coordinate-sorted extractor and parser
    let healed = false;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const hasGluedSkills = r.skills?.some((s) => s.category.includes('WebSocketsTesting') || s.category.includes('TestingInfra'));
      const hasBrokenProjects = r.projects?.some((p) => p.name.includes('Built full-stack') || (p.bullets && p.bullets.length === 0));
      const hasBogusCustomSection = r.identifiedSections?.some((s) => s.title.toLowerCase() === (r.fullName || '').toLowerCase() || s.title === 'GOLAM RABBY');
      const hasEmptyText = !r.rawCleanText || r.experience.length <= 1;

      if (r.isMasterCopy && r.sourceFileDataUrl && (hasGluedSkills || hasBrokenProjects || hasBogusCustomSection || hasEmptyText)) {
        try {
          const ab = await dataUrlToArrayBuffer(r.sourceFileDataUrl);
          const text = r.sourceFileType === 'pdf' ? await extractPdfText(ab) : await extractDocxText(ab);
          if (text) {
            const parsed = parseUploadedResumeText(text, r.sourceFileName);
            const cleanIdentifiedSections = (parsed.identifiedSections || r.identifiedSections || []).filter(
              (s) => s.title.toLowerCase() !== (parsed.fullName || r.fullName || '').toLowerCase() &&
                     s.title !== 'GOLAM RABBY' &&
                     !s.title.toLowerCase().includes('curriculum') &&
                     !s.title.toLowerCase().includes('resume') &&
                     !s.rawContent.includes(parsed.email || r.email || '@@@')
            );

            list[i] = saveResume({
              ...r,
              title: parsed.title || r.title,
              targetRoleType: parsed.targetRoleType || r.targetRoleType,
              fullName: parsed.fullName || r.fullName,
              email: parsed.email || r.email,
              phone: parsed.phone || r.phone,
              location: parsed.location || r.location,
              githubUrl: parsed.githubUrl || r.githubUrl,
              linkedinUrl: parsed.linkedinUrl || r.linkedinUrl,
              portfolioUrl: parsed.portfolioUrl || r.portfolioUrl,
              summary: parsed.summary || r.summary,
              skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : r.skills,
              experience: parsed.experience && parsed.experience.length > 0 ? parsed.experience : r.experience,
              education: parsed.education && parsed.education.length > 0 ? parsed.education : r.education,
              projects: parsed.projects && parsed.projects.length > 0 ? parsed.projects : r.projects,
              rawCleanText: text,
              identifiedSections: cleanIdentifiedSections,
            });
            healed = true;
          }
        } catch (e) {
          console.warn('Auto-heal failed:', e);
        }
      }
    }

    if (healed) {
      list = getResumes();
    }
    setResumes(list);
    const active = getActiveResumeId() || list[0]?.id || '';
    setActiveId(active);
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeResume = resumes.find((r) => r.id === activeResumeId) || resumes[0];

  // Ingestion from file: extracts clean text & preserves original binary DataURL
  const processUploadedFile = async (file: File) => {
    if (isVaultAtLimit) {
      setAlertModal({
        isOpen: true,
        title: 'Resume Vault Capacity Reached',
        description: `You have reached your limit of ${vaultLimit} stored resumes in the vault. Upgrade to Pro for 20 resumes and role variants.`,
        variant: 'warning',
      });
      return;
    }
    setIsProcessing(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      // 1. Read file as Data URL to preserve exact original binary for download and native preview
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      let cleanText = '';

      // 2. Cleanly extract text depending on file type
      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        cleanText = await extractDocxText(arrayBuffer);
      } else if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        cleanText = await extractPdfText(arrayBuffer);
      } else if (ext === 'md' || ext === 'txt' || ext === 'json') {
        cleanText = await file.text();
      }

      // 3. Parse into structured sections
      const parsed = cleanText ? parseUploadedResumeText(cleanText, file.name) : {};
      const cleanTitle = parsed.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      // 4. Save as IMMUTABLE MASTER COPY
      const saved = saveResume({
        title: cleanTitle,
        targetRoleType: parsed.targetRoleType || 'Software Engineer',
        fullName: parsed.fullName || cleanTitle,
        email: parsed.email || '',
        phone: parsed.phone || '',
        location: parsed.location || '',
        githubUrl: parsed.githubUrl || '',
        linkedinUrl: parsed.linkedinUrl || '',
        portfolioUrl: parsed.portfolioUrl || '',
        summary: parsed.summary || (ext === 'pdf' ? `Original uploaded document: ${file.name}` : `Master copy uploaded from ${file.name}`),
        skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : [{ category: 'Core Stack', items: ['TypeScript', 'Go', 'PostgreSQL', 'Docker', 'AWS'] }],
        experience: parsed.experience && parsed.experience.length > 0 ? parsed.experience : [
          {
            id: 'exp-master',
            company: 'Primary Engineering Experience',
            role: cleanTitle,
            period: 'Recent',
            bullets: ['Preserved in original master document.'],
          },
        ],
        education: parsed.education || [],
        projects: parsed.projects || [],
        identifiedSections: parsed.identifiedSections,
        isMasterCopy: true,
        versionLabel: 'v1.0 (Master Copy)',
        sourceFileName: file.name,
        sourceFileType: ext,
        sourceFileSize: file.size,
        sourceFileDataUrl: dataUrl,
        rawCleanText: cleanText,
      });

      setIsCreating(false);
      loadData();
      setActiveId(saved.id);
      setActiveResumeId(saved.id);
    } catch (err) {
      console.error('File upload failed:', err);
      setAlertModal({
        isOpen: true,
        title: 'Document Upload Failed',
        description: 'Could not process this file. Please ensure it is a valid .docx, .pdf, .md, or .txt file.',
        variant: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Ingestion from full raw paste: preserves exact text & identifies sections
  const handleSavePastedResume = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawPasteText.trim()) return;

    if (isVaultAtLimit) {
      setAlertModal({
        isOpen: true,
        title: 'Resume Vault Capacity Reached',
        description: `You have reached your limit of ${vaultLimit} stored resumes in the vault. Upgrade to Pro for 20 resumes and role variants.`,
        variant: 'warning',
      });
      return;
    }

    const parsed = parseUploadedResumeText(rawPasteText.trim());
    const cleanTitle = formTitle.trim() || parsed.title || 'Master Resume';

    const saved = saveResume({
      title: cleanTitle,
      targetRoleType: formRoleType,
      fullName: parsed.fullName || cleanTitle,
      email: parsed.email || '',
      phone: parsed.phone || '',
      location: parsed.location || '',
      githubUrl: parsed.githubUrl || '',
      linkedinUrl: parsed.linkedinUrl || '',
      summary: parsed.summary || 'Master resume profile.',
      skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : [{ category: 'Core Stack', items: ['TypeScript', 'Go', 'PostgreSQL', 'Docker', 'AWS'] }],
      experience: parsed.experience && parsed.experience.length > 0 ? parsed.experience : [],
      education: parsed.education || [],
      projects: parsed.projects || [],
      identifiedSections: parsed.identifiedSections,
      rawCleanText: rawPasteText.trim(),
      isMasterCopy: true,
      versionLabel: 'v1.0 (Master Copy)',
      sourceFileName: `${cleanTitle.replace(/\s+/g, '_')}.md`,
      sourceFileType: 'md',
      sourceFileSize: new Blob([rawPasteText]).size,
    });

    setRawPasteText('');
    setIsCreating(false);
    loadData();
    setActiveId(saved.id);
    setActiveResumeId(saved.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleCreateNew = () => {
    if (isVaultAtLimit) {
      setAlertModal({
        isOpen: true,
        title: 'Resume Vault Capacity Reached',
        description: `You have reached your limit of ${vaultLimit} stored resumes in the vault. Upgrade to Pro for 20 resumes and role variants.`,
        variant: 'warning',
      });
      return;
    }
    setFormTitle('Senior Software Engineer');
    setFormRoleType('Backend / Distributed Systems');
    setFormFullName('');
    setFormEmail('');
    setFormPhone('');
    setFormLocation('');
    setFormGithub('');
    setFormLinkedin('');
    setFormSummary('Senior Systems Engineer specializing in low-latency backend architectures, distributed consensus, and cloud-native infrastructure.');
    setFormSkillsText('Go, Rust, TypeScript, PostgreSQL, Redis, Kafka, Kubernetes, AWS, Docker, gRPC, CI/CD');
    setFormBulletsText(
      'Architected event-driven distributed ingestion pipeline processing 14k events/sec with sub-50ms p99 latency.\n' +
      'Scaled PostgreSQL database layer using read-replicas and connection pooling, cutting query overhead by 42%.\n' +
      'Spearheaded transition to Kubernetes clusters, reducing deployment downtime to zero across 12 microservices.'
    );
    setRawPasteText('');
    setEditingResume(null);
    setCreationMethod('upload');
    setIsCreating(true);
  };

  // Branching: Creates a new derived version from the master, leaving the master untouched!
  const handleStartBranch = (parent: ResumeProfile) => {
    setFormTitle(`${parent.fullName || parent.title} (Tailored Variant)`);
    setFormRoleType(parent.targetRoleType);
    setFormFullName(parent.fullName);
    setFormEmail(parent.email);
    setFormPhone(parent.phone || '');
    setFormLocation(parent.location || '');
    setFormGithub(parent.githubUrl || '');
    setFormLinkedin(parent.linkedinUrl || '');
    setFormSummary(parent.summary);
    setFormSkillsText(parent.skills.map((s) => s.items.join(', ')).join('\n'));
    setFormBulletsText(parent.experience.flatMap((e) => e.bullets).join('\n'));
    setIsBranching(true);
  };

  const handleSaveBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeResume) return;

    const skillsCategories = formSkillsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, idx) => ({
        category: idx === 0 ? 'Core Stack' : `Domain ${idx + 1}`,
        items: line.split(',').map((s) => s.trim()).filter(Boolean),
      }));

    const derived = branchResumeVariant(activeResume, formTitle, formRoleType);
    const updated = saveResume({
      ...derived,
      fullName: formFullName || derived.fullName,
      email: formEmail || derived.email,
      phone: formPhone || derived.phone,
      location: formLocation || derived.location,
      githubUrl: formGithub || derived.githubUrl,
      linkedinUrl: formLinkedin || derived.linkedinUrl,
      summary: formSummary || derived.summary,
      skills: skillsCategories.length > 0 ? skillsCategories : derived.skills,
      experience: derived.experience,
      projects: derived.projects,
      education: derived.education,
    });

    setIsBranching(false);
    loadData();
    setActiveId(updated.id);
    setActiveResumeId(updated.id);
  };

  // Edit existing derived resume (only derived copies can be edited directly; masters are immutable)
  const handleEditDerived = (res: ResumeProfile) => {
    setFormTitle(res.title);
    setFormRoleType(res.targetRoleType);
    setFormFullName(res.fullName);
    setFormEmail(res.email);
    setFormPhone(res.phone || '');
    setFormLocation(res.location || '');
    setFormGithub(res.githubUrl || '');
    setFormLinkedin(res.linkedinUrl || '');
    setFormSummary(res.summary);
    setFormSkillsText(res.skills.map((s) => s.items.join(', ')).join('\n'));
    setFormBulletsText(res.experience.flatMap((e) => e.bullets).join('\n'));
    setEditingResume(res);
    setCreationMethod('form');
    setIsCreating(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();

    const skillsCategories = formSkillsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, idx) => ({
        category: idx === 0 ? 'Core Stack' : `Domain ${idx + 1}`,
        items: line.split(',').map((s) => s.trim()).filter(Boolean),
      }));

    const saved = saveResume({
      id: editingResume?.id,
      title: formTitle,
      targetRoleType: formRoleType,
      fullName: formFullName || 'Engineering Professional',
      email: formEmail,
      phone: formPhone,
      location: formLocation,
      githubUrl: formGithub,
      linkedinUrl: formLinkedin,
      summary: formSummary,
      skills: skillsCategories.length > 0 ? skillsCategories : (editingResume?.skills || []),
      experience: editingResume?.experience || [],
      projects: editingResume?.projects || [],
      education: editingResume?.education || [],
      isMasterCopy: editingResume?.isMasterCopy ?? false,
      versionLabel: editingResume?.versionLabel || 'v1.0',
    });

    setIsCreating(false);
    setEditingResume(null);
    loadData();
    setActiveId(saved.id);
    setActiveResumeId(saved.id);
  };

  // --- AI Tailor Studio Actions ----------------------------------------------
  const handleOpenTailor = (targetFocus: string = 'Cefalo (Software Engineer)') => {
    if (!activeResume) return;
    setTailorTarget(targetFocus);
    const prop = generateAITailoredProposal(activeResume, targetFocus);
    setProposal(prop);
    setIsTailorModalOpen(true);
  };

  const handleApplyTailoredProposal = () => {
    if (!activeResume || !proposal) return;

    if (isVaultAtLimit) {
      setAlertModal({
        isOpen: true,
        title: 'Resume Vault Capacity Reached',
        description: `You have reached your limit of ${vaultLimit} stored resumes in the vault. Upgrade to Pro for 20 resumes and role variants.`,
        variant: 'warning',
      });
      return;
    }

    // Apply enabled bullet proposals to experiences
    const updatedExperiences = activeResume.experience.map((exp) => {
      const expProposals = proposal.bulletProposals.filter((p) => p.expId === exp.id && p.enabled);
      const updatedBullets = [...exp.bullets];
      for (const p of expProposals) {
        if (updatedBullets[p.bulletIndex] !== undefined) {
          updatedBullets[p.bulletIndex] = p.tailored;
        }
      }
      return {
        ...exp,
        bullets: updatedBullets,
      };
    });

    const isCefalo = proposal.targetRoleOrCompany.toLowerCase().includes('cefalo');
    const versionLabel = `v2.0 (${isCefalo ? 'Tailored for Cefalo' : 'AI Tailored'})`;
    const newTitle = `${activeResume.fullName || 'Developer'} — Software Engineer (${isCefalo ? 'Cefalo Tailored' : 'Tailored'})`;

    const saved = saveResume({
      title: newTitle,
      targetRoleType: activeResume.targetRoleType || 'Software Engineer',
      fullName: activeResume.fullName,
      email: activeResume.email,
      phone: activeResume.phone,
      location: activeResume.location,
      githubUrl: activeResume.githubUrl,
      linkedinUrl: activeResume.linkedinUrl,
      portfolioUrl: activeResume.portfolioUrl,
      summary: proposal.tailoredSummary,
      skills: JSON.parse(JSON.stringify(activeResume.skills)),
      experience: updatedExperiences,
      education: JSON.parse(JSON.stringify(activeResume.education)),
      projects: JSON.parse(JSON.stringify(activeResume.projects)),
      isMasterCopy: false,
      versionLabel,
      parentMasterId: activeResume.id,
      sourceFileName: activeResume.sourceFileName,
      sourceFileType: activeResume.sourceFileType,
      sourceFileSize: activeResume.sourceFileSize,
      sourceFileDataUrl: activeResume.sourceFileDataUrl,
      rawCleanText: activeResume.rawCleanText,
    });

    setIsTailorModalOpen(false);
    loadData();
    setActiveId(saved.id);
    setActiveResumeId(saved.id);
  };

  // --- Section-by-Section In-Place Editor -------------------------------------
  const handleOpenSectionEdit = () => {
    if (!activeResume) return;
    setEditFullName(activeResume.fullName);
    setEditTitle(activeResume.title);
    setEditContactLine([
      activeResume.location,
      activeResume.email,
      activeResume.phone,
      activeResume.githubUrl,
      activeResume.linkedinUrl,
      activeResume.portfolioUrl,
    ].filter(Boolean).join(' | '));
    setEditSummary(activeResume.summary);
    setEditExperiences(JSON.parse(JSON.stringify(activeResume.experience)));
    setEditProjects(JSON.parse(JSON.stringify(activeResume.projects || [])));
    setEditSkills(JSON.parse(JSON.stringify(activeResume.skills || [])));
    setEditEducation(JSON.parse(JSON.stringify(activeResume.education || [])));
    setIsSectionEditOpen(true);
  };

  const handleSaveSectionEdit = () => {
    if (!activeResume) return;

    // Parse contact row
    const contactParts = editContactLine.split('|').map((s) => s.trim());
    let em = activeResume.email;
    let ph = activeResume.phone;
    let loc = activeResume.location;
    let gh = activeResume.githubUrl;
    let li = activeResume.linkedinUrl;
    let po = activeResume.portfolioUrl;

    for (const part of contactParts) {
      if (part.includes('@')) em = part;
      else if (part.match(/\d{4,}/)) ph = part;
      else if (part.includes('github')) gh = part;
      else if (part.includes('linkedin')) li = part;
      else if (part.includes('.app') || part.includes('.dev') || part.includes('.me')) po = part;
      else if (part.includes(',')) loc = part;
    }

    const isMaster = activeResume.isMasterCopy;
    const versionLabel = isMaster ? 'v1.1 (Custom Edit)' : activeResume.versionLabel || 'v2.0';

    const saved = saveResume({
      id: isMaster ? undefined : activeResume.id,
      title: editTitle || activeResume.title,
      targetRoleType: activeResume.targetRoleType,
      fullName: editFullName || activeResume.fullName,
      email: em,
      phone: ph,
      location: loc,
      githubUrl: gh,
      linkedinUrl: li,
      portfolioUrl: po,
      summary: editSummary,
      experience: editExperiences,
      projects: editProjects,
      skills: editSkills,
      education: editEducation,
      isMasterCopy: false, // Edits always branch into versioned variants!
      versionLabel,
      parentMasterId: isMaster ? activeResume.id : activeResume.parentMasterId,
      sourceFileName: activeResume.sourceFileName,
      sourceFileType: activeResume.sourceFileType,
      sourceFileSize: activeResume.sourceFileSize,
      sourceFileDataUrl: activeResume.sourceFileDataUrl,
      rawCleanText: activeResume.rawCleanText,
    });

    setIsSectionEditOpen(false);
    loadData();
    setActiveId(saved.id);
    setActiveResumeId(saved.id);
  };

  const handlePrintResume = () => {
    window.print();
  };

  const handleDeleteClick = (id: string, isMaster?: boolean, title?: string) => {
    setResumeToDelete({
      id,
      title: title || 'Resume Profile',
      isMaster: !!isMaster,
    });
  };

  // Download exact original file
  const handleDownloadOriginalFile = (resume: ResumeProfile) => {
    if (!resume.sourceFileDataUrl) {
      handleDownloadMarkdown();
      return;
    }
    const link = document.createElement('a');
    link.href = resume.sourceFileDataUrl;
    link.download = resume.sourceFileName || `${resume.fullName.replace(/\s+/g, '_')}_Resume.${resume.sourceFileType || 'pdf'}`;
    link.click();
  };

  const handleDownloadMarkdown = () => {
    if (!activeResume) return;
    const md = exportResumeAsMarkdown(activeResume);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeResume.fullName.replace(/\s+/g, '_')}_${activeResume.title.replace(/\s+/g, '_')}_Resume.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = () => {
    if (!activeResume) return;
    const md = exportResumeAsMarkdown(activeResume);
    navigator.clipboard.writeText(md);
    setCopied('md');
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & File Dropzone */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-edge bg-card p-5 shadow-card">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-signal/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-signal">
              Multi-Resume Vault & Version Tree
            </span>
            <span className="font-mono text-xs text-muted flex items-center gap-1.5">
              <span>{resumes.length} / {isSuperAdmin ? '∞' : vaultLimit} stored</span>
              {isVaultAtLimit && (
                <span className="rounded bg-amber-500/15 text-amber-500 px-1.5 py-0.2 text-[10px] font-bold uppercase">
                  Vault Full
                </span>
              )}
            </span>
          </div>
          <h2 className="mt-1 font-mono text-base font-bold text-content">
            Document Ingestion, Immutable Masters & Versioned Tailoring
          </h2>
          <p className="mt-1 font-sans text-xs text-muted max-w-xl leading-relaxed">
            Upload your master CV (`.docx`, `.pdf`, `.md`, `.txt`). GitGrill preserves your exact original file uncorrupted. Any changes, improvements, or JD tailoring branch into clean, versioned variants.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.docx,.doc,.md,.txt,.json"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                processUploadedFile(e.target.files[0]);
              }
            }}
            className="hidden"
          />
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-well px-3.5 py-2 font-mono text-xs font-semibold text-content shadow-xs hover:border-signal/50 hover:text-signal transition-colors shrink-0 disabled:opacity-50"
            title="Upload your master CV (.docx, .pdf, .md)"
          >
            <Icon.Upload className="h-3.5 w-3.5 text-signal" />
            <span>{isProcessing ? 'Processing...' : 'Upload Master CV'}</span>
          </button>
          <button
            type="button"
            onClick={handleCreateNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-signal px-3.5 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-all shrink-0"
          >
            <Icon.Plus className="h-3.5 w-3.5" />
            <span>New Variant</span>
          </button>
        </div>
      </div>

      {/* Upload & New Resume Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="fade-up relative w-full max-w-2xl my-auto rounded-2xl border border-edge bg-card p-6 shadow-card max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-edge mb-4">
              <div>
                <h3 className="font-mono text-sm font-bold text-content">
                  {editingResume ? 'Edit Tailored Variant' : 'Upload or Register Master Resume'}
                </h3>
                <p className="font-sans text-xs text-muted">
                  Your uploaded file is preserved as an immutable master copy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-muted hover:text-content p-1 rounded-lg hover:bg-well transition-colors"
              >
                <Icon.X className="h-4 w-4" />
              </button>
            </div>

            {!editingResume && (
              <div className="flex items-center gap-1.5 mb-5 rounded-xl border border-edge bg-well/60 p-1 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setCreationMethod('upload')}
                  className={`flex-1 rounded-lg py-1.5 px-3 font-semibold transition-all ${
                    creationMethod === 'upload'
                      ? 'bg-card text-signal shadow-xs border border-edge'
                      : 'text-muted hover:text-content'
                  }`}
                >
                  Upload File (.docx, .pdf, .md, .txt)
                </button>
                <button
                  type="button"
                  onClick={() => setCreationMethod('paste')}
                  className={`flex-1 rounded-lg py-1.5 px-3 font-semibold transition-all ${
                    creationMethod === 'paste'
                      ? 'bg-card text-signal shadow-xs border border-edge'
                      : 'text-muted hover:text-content'
                  }`}
                >
                  Paste Full Resume / Markdown
                </button>
              </div>
            )}

            {!editingResume && creationMethod === 'upload' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
                  isDragging
                    ? 'border-signal bg-signal/10 scale-[1.01]'
                    : 'border-edge hover:border-signal/50 bg-well/30'
                }`}
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-edge bg-card text-signal shadow-xs mb-3">
                  <Icon.Upload className="h-6 w-6" />
                </div>
                <h4 className="font-mono text-sm font-bold text-content">
                  Drop your Master CV File Here
                </h4>
                <p className="mt-1 font-sans text-xs text-muted max-w-sm mx-auto">
                  Supports <strong className="text-content">.docx, .pdf, .md, .txt</strong>. Original file binary is preserved intact for 100% download fidelity.
                </p>
                <button
                  type="button"
                  disabled={isProcessing}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90"
                >
                  <Icon.Upload className="h-3.5 w-3.5" />
                  <span>{isProcessing ? 'Extracting Clean Content...' : 'Select File'}</span>
                </button>
              </div>
            ) : !editingResume && creationMethod === 'paste' ? (
              <form onSubmit={handleSavePastedResume} className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Resume Title (Optional)" hint="e.g. Master Engineering Resume">
                    <TextInput
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Senior Software Engineer"
                    />
                  </FormField>
                  <FormField label="Role Specialization" hint="Primary focus area">
                    <Select
                      value={formRoleType}
                      onChange={(v) => setFormRoleType(v)}
                      options={ROLE_CATEGORY_OPTIONS}
                      ariaLabel="Role Specialization"
                    />
                  </FormField>
                </div>

                <FormField
                  label="Paste Entire Resume Text or Markdown *"
                  hint="Paste all sections verbatim without chopping: Summary, Experience, Skills, Education, Projects"
                >
                  <TextArea
                    rows={12}
                    value={rawPasteText}
                    onChange={(e) => setRawPasteText(e.target.value)}
                    placeholder={`# Jane Doe\njane@example.com | (555) 123-4567 | github.com/janedoe\n\n## Professional Summary\nSenior Systems Engineer with 8+ years experience scaling distributed infrastructure...\n\n## Work Experience\nStaff Engineer | Acme Cloud (2021 — Present)\n- Scaled event-driven ingestion pipeline to 35k events/sec with sub-40ms latency.\n- Architected PostgreSQL partitioning scheme, reducing query p95 by 48%.\n\n## Technical Skills\nLanguages: Go, Rust, TypeScript, Python\nDatabases: PostgreSQL, Redis, Kafka\nInfra: Docker, Kubernetes, AWS, Terraform\n\n## Education\nB.S. in Computer Science — Tech University (2018)`}
                    mono
                  />
                </FormField>

                {/* Live Section Recognition Pill Bar */}
                {rawPasteText.trim() && (
                  <div className="rounded-xl border border-signal/30 bg-signal/5 p-3.5 space-y-2">
                    <div className="flex items-center gap-2 font-mono font-bold text-signal text-xs">
                      <Icon.Sparkle className="h-4 w-4" />
                      <span>Live Section Identification</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {identifyResumeSections(rawPasteText).map((sec) => (
                        <span
                          key={sec.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-edge bg-card px-2.5 py-1 font-mono text-[11px] text-content shadow-xs"
                        >
                          <span className="font-bold text-signal">{sec.title}</span>
                          <span className="text-muted">({sec.itemCount || 1} {sec.itemCount === 1 ? 'item' : 'items'})</span>
                        </span>
                      ))}
                    </div>
                    <p className="font-sans text-[11px] text-muted leading-relaxed">
                      Your original text is saved 100% verbatim as an immutable anchor. Recognized sections are mapped directly for AI diagnostics and job tailoring without losing content.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-edge">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="rounded-xl border border-edge px-4 py-2 font-semibold text-muted hover:text-content"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!rawPasteText.trim()}
                    className="rounded-xl bg-signal px-6 py-2.5 font-bold text-white shadow-xs hover:bg-signal/90 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    <Icon.CheckCircle className="h-4 w-4" />
                    <span>Register Master Resume</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveForm} className="space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Variant Title" hint="Tailored version name">
                    <TextInput
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. Senior Backend Engineer"
                      mono
                    />
                  </FormField>
                  <FormField label="Role Category" hint="Target specialization">
                    <Select
                      value={formRoleType}
                      onChange={(v) => setFormRoleType(v)}
                      options={ROLE_CATEGORY_OPTIONS}
                      ariaLabel="Role Category"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <FormField label="Full Name">
                    <TextInput
                      value={formFullName}
                      onChange={(e) => setFormFullName(e.target.value)}
                      placeholder="Your Name"
                    />
                  </FormField>
                  <FormField label="Email">
                    <TextInput
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="developer@example.com"
                      mono
                    />
                  </FormField>
                </div>

                <FormField label="Professional Summary" hint="High-impact technical overview">
                  <TextArea
                    rows={2}
                    value={formSummary}
                    onChange={(e) => setFormSummary(e.target.value)}
                    placeholder="Senior engineer specializing in low-latency architectures..."
                  />
                </FormField>

                <FormField label="Technical Stack" hint="Comma-separated technologies">
                  <TextInput
                    value={formSkillsText}
                    onChange={(e) => setFormSkillsText(e.target.value)}
                    placeholder="Go, Rust, TypeScript, PostgreSQL, Kafka, Kubernetes, AWS..."
                    mono
                  />
                </FormField>

                <FormField
                  label="Accomplishments & Bullets"
                  badge={<span className="text-[10px] text-signal font-mono font-semibold">Tip: Include scale (%, ms, rps, $)</span>}
                  hint="One quantifiable achievement bullet per line"
                >
                  <TextArea
                    rows={5}
                    value={formBulletsText}
                    onChange={(e) => setFormBulletsText(e.target.value)}
                    placeholder="Architected event-driven ingestion handling 12k req/s with sub-40ms latency..."
                  />
                </FormField>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-edge">
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
                    className="rounded-xl border border-edge px-4 py-2 font-semibold text-muted hover:text-content"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-signal px-5 py-2 font-bold text-white shadow-xs hover:bg-signal/90"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Branch New Version Modal */}
      {isBranching && activeResume && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="fade-up relative w-full max-w-2xl my-auto rounded-2xl border border-edge bg-card p-6 shadow-card max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3.5 border-b border-edge mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-signal/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-signal">
                    Branch New Version
                  </span>
                  <span className="font-mono text-xs text-muted">
                    Parent: {activeResume.title}
                  </span>
                </div>
                <h3 className="mt-1 font-mono text-base font-bold text-content">
                  Create Tailored Variant
                </h3>
                <p className="font-sans text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  ✓ Your master resume ({activeResume.sourceFileName || activeResume.title}) will remain 100% unaltered.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBranching(false)}
                className="text-muted hover:text-content p-1 rounded-lg hover:bg-well transition-colors"
              >
                <Icon.X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBranch} className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Variant Title" hint="e.g. Cefalo Backend Variant">
                  <TextInput
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Staff Backend Engineer — Cefalo Tailored"
                    mono
                  />
                </FormField>
                <FormField label="Target Role Category">
                  <Select
                    value={formRoleType}
                    onChange={(v) => setFormRoleType(v)}
                    options={ROLE_CATEGORY_OPTIONS}
                    ariaLabel="Role Category"
                  />
                </FormField>
              </div>

              <FormField label="Tailored Professional Summary" hint="Aligned with target company roadmap">
                <TextArea
                  rows={3}
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="Tailored summary emphasizing high-scale systems..."
                />
              </FormField>

              <FormField label="Technical Stack for This Variant" hint="Comma-separated">
                <TextInput
                  value={formSkillsText}
                  onChange={(e) => setFormSkillsText(e.target.value)}
                  placeholder="Go, Rust, TypeScript, PostgreSQL, Kafka..."
                  mono
                />
              </FormField>

              <FormField
                label="Tailored Accomplishments & Bullets"
                badge={<span className="text-[10px] text-signal font-mono font-semibold">Tip: Tune metrics for this specific role</span>}
                hint="Highlight technologies and scale requested in the JD"
              >
                <TextArea
                  rows={6}
                  value={formBulletsText}
                  onChange={(e) => setFormBulletsText(e.target.value)}
                  placeholder="Architected distributed ingestion..."
                />
              </FormField>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-edge">
                <button
                  type="button"
                  onClick={() => setIsBranching(false)}
                  className="rounded-xl border border-edge px-4 py-2 font-semibold text-muted hover:text-content"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-signal px-5 py-2 font-bold text-white shadow-xs hover:bg-signal/90 flex items-center gap-1.5"
                >
                  <Icon.Sparkle className="h-3.5 w-3.5" />
                  <span>Save as New Version</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {resumes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-edge bg-card/60 p-12 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-signal/10 border border-signal/20 text-signal shadow-xs">
            <Icon.Briefcase className="h-6 w-6" />
          </div>
          <h3 className="font-mono text-sm font-bold text-content">No Resume Profiles Yet</h3>
          <p className="max-w-md mx-auto font-sans text-xs text-muted leading-relaxed">
            Drop your master CV (`.docx`, `.pdf`, `.md`) to register your base document. GitGrill preserves your exact original file and generates derived versions for tailoring.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-well px-4 py-2 font-mono text-xs font-semibold text-content hover:border-signal/50"
            >
              <Icon.Upload className="h-3.5 w-3.5 text-signal" />
              <span>Upload Master CV</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Version Hierarchy */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-muted px-1">
              <span>Resume Profiles ({resumes.length})</span>
              <span>Type / Status</span>
            </div>

            {resumes.map((res) => {
              const isSelected = res.id === activeResumeId;
              const isMaster = res.isMasterCopy;

              return (
                <div
                  key={res.id}
                  onClick={() => {
                    setActiveId(res.id);
                    setActiveResumeId(res.id);
                  }}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-xs ${
                    isSelected
                      ? 'border-signal bg-signal/5 dark:bg-signal/10 shadow-sm ring-1 ring-signal/30'
                      : 'border-edge bg-card hover:border-signal/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {isMaster ? (
                          <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                            Master Copy
                          </span>
                        ) : (
                          <span className="rounded bg-signal/15 border border-signal/30 px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase text-signal">
                            {res.versionLabel || 'Derived'}
                          </span>
                        )}
                        {res.sourceFileType && (
                          <span className="font-mono text-[9px] text-muted uppercase">
                            .{res.sourceFileType}
                          </span>
                        )}
                      </div>
                      <div className="truncate font-mono text-xs font-bold text-content">
                        {res.title}
                      </div>
                      <div className="font-sans text-[11px] text-muted truncate mt-0.5">
                        {res.fullName}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs font-extrabold text-signal">
                          {res.diagnostic.overallScore}
                        </span>
                        <span className="font-mono text-[9px] text-muted">/100</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] font-mono border-t border-edge/60 pt-2.5">
                    <span className="text-muted text-[10px]">
                      {isMaster ? '🔒 Original Source' : 'Derived Variant'}
                    </span>
                    <div className="flex items-center gap-2">
                      {!isMaster ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditDerived(res);
                          }}
                          className="text-muted hover:text-signal transition-colors p-1"
                          title="Edit derived variant"
                        >
                          <Icon.Pencil className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartBranch(res);
                          }}
                          className="text-signal hover:text-signal/80 transition-colors p-1"
                          title="Branch new version from master"
                        >
                          <Icon.Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(res.id, isMaster, res.title);
                        }}
                        className="text-muted hover:text-rose-500 transition-colors p-1"
                        title="Delete entry"
                      >
                        <Icon.X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Active Resume & Mode Studio */}
          {activeResume && (
            <div className="lg:col-span-8 space-y-4">
              {/* Active Header & Integrity Banner */}
              <div className="rounded-2xl border border-edge bg-card p-5 shadow-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-edge">
                  <div>
                    <div className="flex items-center gap-2">
                      {activeResume.isMasterCopy ? (
                        <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                          🔒 Master Document (Original Upload)
                        </span>
                      ) : (
                        <span className="rounded bg-signal/15 border border-signal/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-signal">
                          Derived Variant ({activeResume.versionLabel || 'v2.0'})
                        </span>
                      )}
                      <span className="font-mono text-xs text-muted">
                        Score: {activeResume.diagnostic.overallScore}/100
                      </span>
                    </div>
                    <h3 className="mt-1 font-mono text-base font-bold text-content">
                      {activeResume.title}
                    </h3>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Always allow downloading original source file */}
                    {activeResume.sourceFileDataUrl && (
                      <button
                        type="button"
                        onClick={() => handleDownloadOriginalFile(activeResume)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors shadow-xs"
                        title="Download exact original uncorrupted file"
                      >
                        <Icon.Download className="h-3.5 w-3.5" />
                        <span>Download Original (.{activeResume.sourceFileType || 'file'})</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleDownloadMarkdown}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-well px-3 py-1.5 font-mono text-xs font-semibold text-content hover:border-signal/50 hover:text-signal transition-colors shadow-xs"
                      title="Download clean Markdown"
                    >
                      <Icon.Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Export .MD</span>
                    </button>

                    {/* Master copy branches a new version; derived copy edits directly */}
                    {activeResume.isMasterCopy ? (
                      <button
                        type="button"
                        onClick={() => handleStartBranch(activeResume)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-signal px-3.5 py-1.5 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-all"
                        title="Create a new version to modify without touching master"
                      >
                        <Icon.Plus className="h-3.5 w-3.5" />
                        <span>Branch New Version</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleEditDerived(activeResume)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-signal px-3.5 py-1.5 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-all"
                      >
                        <Icon.Pencil className="h-3.5 w-3.5" />
                        <span>Edit Variant</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Master Integrity Notice */}
                {activeResume.isMasterCopy && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex items-center justify-between text-xs font-sans">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                      <Icon.CheckCircle className="h-4 w-4 shrink-0" />
                      <span>
                        Source File: <strong>{activeResume.sourceFileName || 'Uploaded document'}</strong> ({Math.round((activeResume.sourceFileSize || 1024) / 1024)} KB). Master copy is protected from in-place edits.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleStartBranch(activeResume)}
                      className="font-mono text-xs font-bold text-signal underline hover:no-underline ml-2 shrink-0"
                    >
                      Branch new version →
                    </button>
                  </div>
                )}

                {/* Sub-Mode Tabs */}
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs border-b border-edge pb-2">
                  <button
                    type="button"
                    onClick={() => setActiveViewMode('preview')}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all ${
                      activeViewMode === 'preview'
                        ? 'border border-signal/40 bg-signal/10 text-signal shadow-xs'
                        : 'text-muted hover:text-content hover:bg-well'
                    }`}
                  >
                    <Icon.Eye className="h-3.5 w-3.5" />
                    <span>Document Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveViewMode('matchmaker')}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all ${
                      activeViewMode === 'matchmaker'
                        ? 'border border-signal/40 bg-signal/10 text-signal shadow-xs'
                        : 'text-muted hover:text-content hover:bg-well'
                    }`}
                  >
                    <Icon.Sparkle className="h-3.5 w-3.5 text-signal" />
                    <span>JD Matchmaker</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveViewMode('diagnostics')}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all ${
                      activeViewMode === 'diagnostics'
                        ? 'border border-signal/40 bg-signal/10 text-signal shadow-xs'
                        : 'text-muted hover:text-content hover:bg-well'
                    }`}
                  >
                    <Icon.Zap className="h-3.5 w-3.5" />
                    <span>AI Diagnostics</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveViewMode('defense')}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all ${
                      activeViewMode === 'defense'
                        ? 'border border-signal/40 bg-signal/10 text-signal shadow-xs'
                        : 'text-muted hover:text-content hover:bg-well'
                    }`}
                  >
                    <Icon.Target className="h-3.5 w-3.5" />
                    <span>Interview Drills</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveViewMode('inmail')}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-bold transition-all ${
                      activeViewMode === 'inmail'
                        ? 'border border-signal/40 bg-signal/10 text-signal shadow-xs'
                        : 'text-muted hover:text-content hover:bg-well'
                    }`}
                  >
                    <Icon.Mail className="h-3.5 w-3.5" />
                    <span>InMail Pitch</span>
                  </button>
                </div>

                {/* MODE 1: Formatted Document Preview & Verbatim Source Viewer */}
                {activeViewMode === 'preview' && (
                  <div className="space-y-4">
                    {/* Preview Sub-Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-edge bg-well/50">
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => setPreviewFormat('structured')}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition-all ${
                            previewFormat === 'structured'
                              ? 'bg-card text-signal border border-edge shadow-xs'
                              : 'text-muted hover:text-content'
                          }`}
                        >
                          <Icon.FileText className="h-3.5 w-3.5" />
                          <span>Structured Sections</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewFormat('source')}
                          className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition-all ${
                            previewFormat === 'source'
                              ? 'bg-card text-signal border border-edge shadow-xs'
                              : 'text-muted hover:text-content'
                          }`}
                        >
                          <Icon.Terminal className="h-3.5 w-3.5" />
                          <span>Verbatim Source / Text</span>
                        </button>
                        {activeResume.sourceFileType === 'pdf' && activeResume.sourceFileDataUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewFormat('pdf')}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-semibold transition-all ${
                              previewFormat === 'pdf'
                                ? 'bg-card text-signal border border-edge shadow-xs'
                                : 'text-muted hover:text-content'
                            }`}
                          >
                            <Icon.Eye className="h-3.5 w-3.5" />
                            <span>Original PDF</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const textToCopy = activeResume.rawCleanText || exportResumeAsMarkdown(activeResume);
                            navigator.clipboard.writeText(textToCopy);
                            setCopied('source');
                            setTimeout(() => setCopied(null), 2000);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-card px-2.5 py-1 font-mono text-xs text-muted hover:text-content transition-colors"
                          title="Copy entire raw resume text"
                        >
                          <Icon.Copy className="h-3 w-3" />
                          <span>{copied === 'source' ? 'Copied Full Text!' : 'Copy Full Text'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadOriginalFile(activeResume)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-well border border-edge px-2.5 py-1 font-mono text-xs text-content hover:border-signal/50 hover:text-signal transition-colors"
                          title="Download original file or markdown"
                        >
                          <Icon.Download className="h-3 w-3 text-signal" />
                          <span>Download</span>
                        </button>
                      </div>
                    </div>

                    {/* FORMAT A: Authentic Document Layout matching uploaded CV */}
                    {previewFormat === 'structured' && (
                      <div className="space-y-4">
                        {/* Action Ribbon: In-Place Tailoring, Section Editing & Clean PDF Export */}
                        <div className="no-print flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-edge bg-well/60 shadow-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenTailor('Cefalo (Software Engineer)')}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-signal px-3.5 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90 transition-all cursor-pointer"
                            >
                              <Icon.Sparkle className="h-3.5 w-3.5" />
                              <span>⚡ AI Tailor Resume / Section</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveViewMode('matchmaker')}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-signal/40 bg-signal/10 px-3.5 py-2 font-mono text-xs font-bold text-signal shadow-xs hover:bg-signal/20 transition-all cursor-pointer"
                            >
                              <Icon.Target className="h-3.5 w-3.5" />
                              <span>⚡ Match Against JD</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleOpenSectionEdit}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-card px-3.5 py-2 font-mono text-xs font-bold text-content shadow-xs hover:border-signal/50 hover:text-signal transition-all cursor-pointer"
                            >
                              <Icon.Pencil className="h-3.5 w-3.5" />
                              <span>✏️ Edit Sections</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handlePrintResume}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-card px-3.5 py-2 font-mono text-xs font-semibold text-content hover:border-signal/50 hover:text-signal shadow-xs transition-colors cursor-pointer"
                              title="Print directly or save clean PDF with pure layout"
                            >
                              <Icon.Download className="h-3.5 w-3.5 text-signal" />
                              <span>Export / Print PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleDownloadMarkdown}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-edge bg-card px-3 py-2 font-mono text-xs text-muted hover:text-content hover:border-signal/50 transition-colors cursor-pointer"
                              title="Export .MD"
                            >
                              <Icon.FileText className="h-3.5 w-3.5" />
                              <span>.MD</span>
                            </button>
                          </div>
                        </div>

                        {/* Printable Authentic Document Sheet */}
                        <div
                          id="printable-resume-sheet"
                          className="bg-white text-neutral-900 border border-neutral-300 dark:border-neutral-700 shadow-xl rounded-2xl p-8 sm:p-12 font-sans max-w-[850px] mx-auto space-y-4"
                        >
                          {/* Header Block: Name, Title & Contact */}
                          <div className="space-y-1">
                            <h1 className="text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-neutral-900">
                              {activeResume.fullName || 'Golam Rabby'}
                            </h1>
                            <div className="font-bold text-neutral-800 text-sm sm:text-base">
                              {activeResume.targetRoleType || 'Software Engineer'}
                            </div>
                            <div className="flex flex-wrap items-center justify-start gap-x-2 gap-y-1 text-xs text-neutral-700 pt-0.5 font-normal">
                              {activeResume.location && <span>{activeResume.location}</span>}
                              {activeResume.location && activeResume.email && <span className="text-neutral-400">|</span>}
                              {activeResume.email && (
                                <a href={`mailto:${activeResume.email}`} className="hover:underline">
                                  {activeResume.email}
                                </a>
                              )}
                              {activeResume.phone && <span className="text-neutral-400">|</span>}
                              {activeResume.phone && <span>{activeResume.phone}</span>}
                              {activeResume.githubUrl && <span className="text-neutral-400">|</span>}
                              {activeResume.githubUrl && (
                                <a
                                  href={activeResume.githubUrl.startsWith('http') ? activeResume.githubUrl : `https://${activeResume.githubUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline hover:text-neutral-950"
                                >
                                  {activeResume.githubUrl.replace(/^https?:\/\//, '')}
                                </a>
                              )}
                              {activeResume.linkedinUrl && <span className="text-neutral-400">|</span>}
                              {activeResume.linkedinUrl && (
                                <a
                                  href={activeResume.linkedinUrl.startsWith('http') ? activeResume.linkedinUrl : `https://${activeResume.linkedinUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline hover:text-neutral-950"
                                >
                                  {activeResume.linkedinUrl.replace(/^https?:\/\//, '')}
                                </a>
                              )}
                              {activeResume.portfolioUrl && <span className="text-neutral-400">|</span>}
                              {activeResume.portfolioUrl && (
                                <a
                                  href={activeResume.portfolioUrl.startsWith('http') ? activeResume.portfolioUrl : `https://${activeResume.portfolioUrl}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline hover:text-neutral-950"
                                >
                                  {activeResume.portfolioUrl.replace(/^https?:\/\//, '')}
                                </a>
                              )}
                            </div>
                          </div>

                          {/* SUMMARY Section */}
                          {activeResume.summary && (
                            <div>
                              <div className="border border-neutral-900 px-2.5 py-0.5 font-bold uppercase tracking-wider text-xs text-neutral-900 bg-neutral-50 mb-2">
                                SUMMARY
                              </div>
                              <p className="text-xs leading-relaxed text-neutral-800 whitespace-pre-line text-justify">
                                {activeResume.summary}
                              </p>
                            </div>
                          )}

                          {/* PROFESSIONAL EXPERIENCE Section */}
                          {activeResume.experience.length > 0 && (
                            <div>
                              <div className="border border-neutral-900 px-2.5 py-0.5 font-bold uppercase tracking-wider text-xs text-neutral-900 bg-neutral-50 mb-2.5 flex items-center justify-between">
                                <span>PROFESSIONAL EXPERIENCE</span>
                                <span className="text-[10px] font-normal text-neutral-600 no-print">
                                  {activeResume.experience.length} position{activeResume.experience.length === 1 ? '' : 's'}
                                </span>
                              </div>
                              <div className="space-y-4">
                                {activeResume.experience.map((exp) => (
                                  <div key={exp.id} className="space-y-1">
                                    <div className="flex flex-wrap items-baseline justify-between text-xs gap-2">
                                      <div className="font-bold text-neutral-900">
                                        <span className="text-sm">{exp.company}</span>
                                        {exp.role && <span className="font-medium text-neutral-800"> | {exp.role}</span>}
                                        {exp.location && (
                                          <span className="font-medium text-neutral-900">
                                            {' '}| <span className="underline">{exp.location}</span>
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-medium text-neutral-800 text-xs shrink-0">
                                        {exp.period}
                                      </span>
                                    </div>
                                    <ul className="list-disc list-outside pl-4 space-y-1 text-xs text-neutral-800 leading-relaxed">
                                      {exp.bullets.map((b, bi) => (
                                        <li key={bi}>{b}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* PROJECTS Section */}
                          {activeResume.projects && activeResume.projects.length > 0 && (
                            <div>
                              <div className="border border-neutral-900 px-2.5 py-0.5 font-bold uppercase tracking-wider text-xs text-neutral-900 bg-neutral-50 mb-2.5 flex items-center justify-between">
                                <span>PROJECTS</span>
                                <span className="text-[10px] font-normal text-neutral-600 no-print">
                                  {activeResume.projects.length} projects
                                </span>
                              </div>
                              <div className="space-y-3.5">
                                {activeResume.projects.map((proj, pi) => (
                                  <div key={pi} className="space-y-1 text-xs">
                                    <div className="flex flex-wrap items-baseline justify-between">
                                      <div className="font-bold text-neutral-900 text-sm">
                                        <span>{proj.name}</span>
                                        {proj.link && (
                                          <span className="font-normal">
                                            {' '}| <span className="underline">{proj.link}</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {proj.description && (
                                      <div className="italic text-neutral-700 text-xs font-normal">
                                        {proj.description}
                                      </div>
                                    )}
                                    {proj.bullets && proj.bullets.length > 0 && (
                                      <ul className="list-disc list-outside pl-4 space-y-1 text-neutral-800 leading-relaxed">
                                        {proj.bullets.map((pb, pbi) => (
                                          <li key={pbi}>{pb}</li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* TECHNICAL SKILLS Section */}
                          {activeResume.skills.length > 0 && (
                            <div>
                              <div className="border border-neutral-900 px-2.5 py-0.5 font-bold uppercase tracking-wider text-xs text-neutral-900 bg-neutral-50 mb-2">
                                TECHNICAL SKILLS
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-neutral-800">
                                {activeResume.skills.map((cat, i) => (
                                  <div key={i} className="leading-snug">
                                    <strong className="font-bold text-neutral-900">{cat.category}: </strong>
                                    <span>{cat.items.join(', ')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* EDUCATION Section */}
                          {activeResume.education && activeResume.education.length > 0 && (
                            <div>
                              <div className="border border-neutral-900 px-2.5 py-0.5 font-bold uppercase tracking-wider text-xs text-neutral-900 bg-neutral-50 mb-2">
                                EDUCATION
                              </div>
                              <div className="space-y-2 text-xs text-neutral-800">
                                {activeResume.education.map((edu, i) => (
                                  <div key={i} className="space-y-0.5">
                                    <div className="flex justify-between items-baseline">
                                      <strong className="font-bold text-neutral-900">{edu.degree}</strong>
                                      {edu.year && <span className="text-neutral-700 font-medium">{edu.year}</span>}
                                    </div>
                                    <div>{edu.institution}</div>
                                    {edu.coursework && (
                                      <div className="pl-4 list-disc text-neutral-800">
                                        • <strong className="font-semibold text-neutral-900">Relevant Coursework:</strong>{' '}
                                        {edu.coursework.replace(/^Relevant Coursework:?\s*/i, '')}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Custom Sections */}
                          {activeResume.identifiedSections
                            ?.filter(
                              (s) =>
                                (s.type === 'custom' || s.type === 'certifications') &&
                                s.title.toLowerCase() !== (activeResume.fullName || '').toLowerCase() &&
                                s.title !== 'GOLAM RABBY' &&
                                !s.title.toLowerCase().includes('curriculum') &&
                                !s.title.toLowerCase().includes('resume') &&
                                !s.rawContent.includes(activeResume.email || '@@@') &&
                                !s.rawContent.includes('github.com')
                            )
                            .map((sec) => (
                              <div key={sec.id}>
                                <div className="border border-neutral-900 px-2.5 py-0.5 font-bold uppercase tracking-wider text-xs text-neutral-900 bg-neutral-50 mb-2">
                                  {sec.title}
                                </div>
                                <div className="text-xs text-neutral-800 whitespace-pre-line leading-relaxed">
                                  {sec.rawContent}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* FORMAT B: Verbatim Source / Raw Text View */}
                    {previewFormat === 'source' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-mono text-muted px-1">
                          <span>
                            Source Document: <strong className="text-content">{activeResume.sourceFileName || 'Direct Document Text'}</strong>
                          </span>
                          <span>
                            {(activeResume.rawCleanText || '').split(/\r?\n/).length} lines •{' '}
                            {(activeResume.rawCleanText || '').split(/\s+/).filter(Boolean).length} words
                          </span>
                        </div>

                        <div className="relative rounded-2xl border border-edge bg-canvas overflow-hidden shadow-inner">
                          <pre className="p-6 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed text-content/90 thin-scroll max-h-[700px] select-text">
                            {activeResume.rawCleanText || exportResumeAsMarkdown(activeResume)}
                          </pre>
                        </div>

                        <div className="rounded-xl border border-edge bg-well/50 p-3 flex items-center justify-between text-xs font-sans text-muted">
                          <span>
                            🔒 This exact text is preserved uncorrupted as the master reference anchor for all automated AI audits and JD matchmaking.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* FORMAT C: Original PDF Native Viewer */}
                    {previewFormat === 'pdf' && activeResume.sourceFileDataUrl && (
                      <div className="rounded-2xl border border-edge overflow-hidden shadow-card">
                        <iframe
                          src={activeResume.sourceFileDataUrl}
                          title="Original PDF Document Preview"
                          className="w-full h-[700px] bg-canvas"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* MODE 2: AI Impact Diagnostics */}
                {activeViewMode === 'diagnostics' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-edge bg-well/50 p-3.5">
                        <div className="flex items-center justify-between text-muted font-mono text-[10px] uppercase font-bold">
                          <span>Impact Density</span>
                          <span className="text-signal">{activeResume.diagnostic.impactScore}%</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-edge overflow-hidden">
                          <div
                            className="h-full bg-signal rounded-full transition-all duration-500"
                            style={{ width: `${activeResume.diagnostic.impactScore}%` }}
                          />
                        </div>
                        <p className="mt-1.5 font-sans text-[10px] text-muted leading-tight">
                          Percentage of bullets backed by numbers, latency, and scale metrics.
                        </p>
                      </div>

                      <div className="rounded-xl border border-edge bg-well/50 p-3.5">
                        <div className="flex items-center justify-between text-muted font-mono text-[10px] uppercase font-bold">
                          <span>Clarity & Power</span>
                          <span className="text-emerald-500">{activeResume.diagnostic.clarityScore}%</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-edge overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${activeResume.diagnostic.clarityScore}%` }}
                          />
                        </div>
                        <p className="mt-1.5 font-sans text-[10px] text-muted leading-tight">
                          Free of weak passive phrases (*"helped with"*, *"responsible for"*).
                        </p>
                      </div>

                      <div className="rounded-xl border border-edge bg-well/50 p-3.5">
                        <div className="flex items-center justify-between text-muted font-mono text-[10px] uppercase font-bold">
                          <span>Technical Depth</span>
                          <span className="text-orange-500">{activeResume.diagnostic.technicalScore}%</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-edge overflow-hidden">
                          <div
                            className="h-full bg-orange-500 rounded-full transition-all duration-500"
                            style={{ width: `${activeResume.diagnostic.technicalScore}%` }}
                          />
                        </div>
                        <p className="mt-1.5 font-sans text-[10px] text-muted leading-tight">
                          Breadth of distributed systems primitives and cloud tooling.
                        </p>
                      </div>
                    </div>

                    {activeResume.diagnostic.weakPhrases.length > 0 && (
                      <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-2.5">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[#ea580c] dark:text-signal uppercase tracking-wider">
                          <Icon.Lightbulb className="h-4 w-4" />
                          <span>Detected Weak Phrasing & Recommended Refinements</span>
                        </div>
                        <div className="space-y-2">
                          {activeResume.diagnostic.weakPhrases.map((wp, i) => (
                            <div key={i} className="rounded-lg bg-card border border-edge p-2.5 font-sans text-xs space-y-1">
                              <div className="text-rose-500 font-mono text-[11px] line-through">
                                {wp.original}
                              </div>
                              <div className="text-emerald-500 font-mono text-[11px] font-semibold">
                                → {wp.suggested}
                              </div>
                              <p className="text-[10px] text-muted leading-tight">
                                {wp.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MODE 3: Interview Defense Drills */}
                {activeViewMode === 'defense' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-signal/20 bg-signal/5 p-3.5 flex items-start gap-2.5">
                      <Icon.Target className="h-4 w-4 text-signal mt-0.5 shrink-0" />
                      <p className="font-sans text-xs text-muted leading-relaxed">
                        Hiring managers grill candidates on their exact resume claims. Here are the probing trap questions and STAR-L answer blueprints for this version.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {activeResume.experience.flatMap((e) => e.bullets).map((bullet, idx) => {
                        const drill = generateBulletInterviewDrills(bullet);
                        return (
                          <div key={idx} className="rounded-xl border border-edge bg-well/40 p-4 space-y-3">
                            <div className="border-l-2 border-signal pl-3">
                              <div className="font-mono text-[10px] uppercase font-bold text-muted">
                                Claim Under Review
                              </div>
                              <p className="font-sans text-xs text-content mt-0.5 font-medium">
                                &ldquo;{bullet}&rdquo;
                              </p>
                            </div>

                            <div className="rounded-lg bg-card border border-edge p-3 space-y-1.5">
                              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-rose-500 uppercase">
                                <Icon.Alert className="h-3.5 w-3.5" />
                                <span>Trap Question ({drill.focusArea})</span>
                              </div>
                              <p className="font-sans text-xs text-content font-semibold">
                                {drill.trapQuestion}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-sans">
                              <div className="rounded-lg border border-edge bg-card/60 p-2.5">
                                <span className="font-mono text-[9px] uppercase font-bold text-signal block mb-0.5">
                                  Situation & Bottleneck
                                </span>
                                <span className="text-muted leading-tight">{drill.starFramework.situation}</span>
                              </div>
                              <div className="rounded-lg border border-edge bg-card/60 p-2.5">
                                <span className="font-mono text-[9px] uppercase font-bold text-signal block mb-0.5">
                                  Architectural Mechanism
                                </span>
                                <span className="text-muted leading-tight">{drill.starFramework.action}</span>
                              </div>
                              <div className="rounded-lg border border-edge bg-card/60 p-2.5">
                                <span className="font-mono text-[9px] uppercase font-bold text-signal block mb-0.5">
                                  Quantifiable Delta
                                </span>
                                <span className="text-muted leading-tight">{drill.starFramework.result}</span>
                              </div>
                              <div className="rounded-lg border border-edge bg-card/60 p-2.5">
                                <span className="font-mono text-[9px] uppercase font-bold text-signal block mb-0.5">
                                  Explicit Trade-off
                                </span>
                                <span className="text-muted leading-tight">{drill.starFramework.tradeoff}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* MODE 4: Hiring Manager Direct InMail Pitch */}
                {activeViewMode === 'inmail' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-signal/20 bg-signal/5 p-3.5 flex items-start gap-2.5">
                      <Icon.Mail className="h-4 w-4 text-signal mt-0.5 shrink-0" />
                      <p className="font-sans text-xs text-muted leading-relaxed">
                        Send this high-signal, engineer-to-engineer note directly to the Engineering Director or Hiring Manager on LinkedIn or via email.
                      </p>
                    </div>

                    <div className="rounded-xl border border-edge bg-well/40 p-4 space-y-3 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-content text-[11px]">
                          Cold InMail / Outreach Draft
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const pitch = generateHiringManagerPitch(activeResume);
                            navigator.clipboard.writeText(pitch);
                            setCopied('pitch');
                            setTimeout(() => setCopied(null), 2000);
                          }}
                          className="inline-flex items-center gap-1 text-signal hover:text-signal/80 font-bold transition-colors"
                        >
                          <Icon.Copy className="h-3.5 w-3.5" />
                          <span>{copied === 'pitch' ? 'Copied Pitch!' : 'Copy to Clipboard'}</span>
                        </button>
                      </div>

                      <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-content bg-card border border-edge rounded-lg p-4">
                        {generateHiringManagerPitch(activeResume)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* MODE 5: JD Matchmaker for this Resume */}
                {activeViewMode === 'matchmaker' && (() => {
                  const activeTargetRole = targetRoles.find((r) => r.id === matchRoleId) || targetRoles[0];
                  const matchRep = activeTargetRole
                    ? evaluateResumeAgainstJD(activeResume, activeTargetRole.rawJdText || `${activeTargetRole.title} ${activeTargetRole.notes}`)
                    : null;

                  if (!activeTargetRole || !matchRep) {
                    return (
                      <div className="rounded-xl border border-dashed border-edge bg-well/40 p-8 text-center space-y-2">
                        <Icon.Target className="h-6 w-6 text-muted mx-auto" />
                        <h4 className="font-mono text-xs font-bold text-content">No Target Roles Found</h4>
                        <p className="font-sans text-xs text-muted max-w-sm mx-auto">
                          Add target job descriptions in the &ldquo;Target Roles &amp; Campaigns&rdquo; tab to run live deterministic matching against this resume.
                        </p>
                      </div>
                    );
                  }

                  const roleSelectOpts: SelectOption[] = targetRoles.map((r) => ({
                    value: r.id,
                    label: `${r.company} — ${r.title}`,
                    description: `Status: ${r.status.toUpperCase()} · ${r.rawJdText.length} chars JD`,
                  }));

                  return (
                    <div className="space-y-5">
                      {/* Top Header & Role Selector */}
                      <div className="rounded-xl border border-edge bg-well/40 p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-mono text-xs font-bold text-content">
                            <Icon.Sparkle className="h-4 w-4 text-signal" />
                            <span>Target Role (JD) to Match Against</span>
                          </div>
                          <span className="rounded bg-signal/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-signal self-start sm:self-auto">
                            {activeTargetRole.status}
                          </span>
                        </div>

                        <Select
                          value={activeTargetRole.id}
                          onChange={(val) => setMatchRoleId(val)}
                          options={roleSelectOpts}
                          ariaLabel="Select Target Job Description"
                          className="w-full"
                        />

                        <div className="flex items-center justify-between text-[11px] font-mono text-muted pt-1">
                          <span>{activeTargetRole.company} · {activeTargetRole.title}</span>
                          <button
                            type="button"
                            onClick={() => handleOpenTailor(`${activeTargetRole.company} (${activeTargetRole.title})`)}
                            className="text-signal hover:underline flex items-center gap-1 font-bold cursor-pointer"
                          >
                            <Icon.Sparkle className="h-3 w-3" />
                            <span>⚡ Tailor for this JD</span>
                          </button>
                        </div>
                      </div>

                      {/* Match Score Card & Category Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1 rounded-xl border border-edge bg-card p-4 space-y-4 shadow-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                              Fit Score
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase ${
                                matchRep.fitScore >= 80
                                  ? 'bg-signal/15 text-signal'
                                  : matchRep.fitScore >= 60
                                  ? 'bg-amber-500/15 text-amber-500'
                                  : 'bg-red-500/15 text-red-500'
                              }`}
                            >
                              {matchRep.fitScore >= 80 ? 'Strong Alignment' : matchRep.fitScore >= 60 ? 'Moderate' : 'Gaps'}
                            </span>
                          </div>

                          <div className="flex items-baseline gap-1.5">
                            <span className="font-mono text-5xl font-extrabold text-content">{matchRep.fitScore}</span>
                            <span className="font-mono text-xs text-muted">/ 100</span>
                          </div>

                          <div className="h-1.5 w-full bg-edge rounded-full overflow-hidden">
                            <div
                              className={`h-full ${matchRep.fitScore >= 80 ? 'bg-signal' : 'bg-amber-500'}`}
                              style={{ width: `${matchRep.fitScore}%` }}
                            />
                          </div>

                          <div className="space-y-2 pt-2 border-t border-edge text-xs font-mono">
                            <div className="flex justify-between text-muted text-[11px]">
                              <span>Core Tech</span>
                              <span className="text-content font-bold">{matchRep.categoryScores.coreLanguages}%</span>
                            </div>
                            <div className="flex justify-between text-muted text-[11px]">
                              <span>Distributed Systems</span>
                              <span className="text-content font-bold">{matchRep.categoryScores.distributedSystems}%</span>
                            </div>
                            <div className="flex justify-between text-muted text-[11px]">
                              <span>Cloud & DevOps</span>
                              <span className="text-content font-bold">{matchRep.categoryScores.devopsCloud}%</span>
                            </div>
                            <div className="flex justify-between text-muted text-[11px]">
                              <span>Scale & Testing</span>
                              <span className="text-content font-bold">{matchRep.categoryScores.architectureScale}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Matched vs Missing Badges */}
                        <div className="md:col-span-2 rounded-xl border border-edge bg-card p-4 space-y-4 shadow-xs">
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-signal">
                              <Icon.CheckCircle className="h-3.5 w-3.5" />
                              <span>Verified in this Resume ({matchRep.matchedSkills.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {matchRep.matchedSkills.map((sk) => (
                                <span
                                  key={sk}
                                  className="inline-flex items-center gap-1 rounded border border-signal/30 bg-signal/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-signal uppercase"
                                >
                                  <Icon.Check className="h-2.5 w-2.5" />
                                  <span>{sk}</span>
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2 pt-3 border-t border-edge">
                            <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-500">
                              <Icon.Alert className="h-3.5 w-3.5" />
                              <span>Missing Gaps for this Role ({matchRep.missingSkills.length})</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {matchRep.missingSkills.length > 0 ? (
                                matchRep.missingSkills.map((gap) => (
                                  <span
                                    key={gap}
                                    className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-500 uppercase"
                                  >
                                    <Icon.Alert className="h-2.5 w-2.5" />
                                    <span>{gap}</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs font-mono text-signal">No gaps identified!</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bullet Recommendations */}
                      {matchRep.bulletRecommendations.length > 0 && (
                        <div className="rounded-xl border border-edge bg-card p-4 space-y-3 shadow-xs">
                          <span className="font-mono text-xs font-bold text-content flex items-center gap-1.5">
                            <Icon.Zap className="h-3.5 w-3.5 text-signal" />
                            <span>Targeted Bullet Alignments for {activeTargetRole.company}</span>
                          </span>
                          <div className="space-y-2">
                            {matchRep.bulletRecommendations.map((rec, i) => (
                              <div key={i} className="rounded-lg border border-edge bg-well/40 p-3 font-mono text-xs space-y-1">
                                <div className="flex justify-between text-[11px] text-muted">
                                  <span className="font-bold text-content">{rec.company}</span>
                                  <span className="text-signal">{rec.rationale}</span>
                                </div>
                                <div className="font-sans text-xs text-content bg-card p-2 rounded border border-edge">
                                  {rec.tailored}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Interview Defense Probes */}
                      {matchRep.interviewDefenseProbes.length > 0 && (
                        <div className="rounded-xl border border-edge bg-card p-4 space-y-3 shadow-xs">
                          <span className="font-mono text-xs font-bold text-content flex items-center gap-1.5">
                            <Icon.Target className="h-3.5 w-3.5 text-signal" />
                            <span>JD-Targeted Interview Practice Probes</span>
                          </span>
                          <div className="space-y-2 font-mono text-xs">
                            {matchRep.interviewDefenseProbes.map((probe, i) => {
                              const isOpen = expandedMatchProbeIdx === i;
                              return (
                                <div key={i} className="rounded-lg border border-edge bg-well/30 overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedMatchProbeIdx(isOpen ? null : i)}
                                    className="w-full flex items-center justify-between p-3 text-left font-bold text-content hover:bg-well/60 transition-colors cursor-pointer"
                                  >
                                    <span className="truncate pr-2">{probe.targetingGap}</span>
                                    <Icon.ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${isOpen ? 'rotate-180 text-signal' : ''}`} />
                                  </button>
                                  {isOpen && (
                                    <div className="p-3 pt-0 border-t border-edge space-y-2 font-sans text-xs">
                                      <p className="font-mono text-content font-semibold bg-card p-2 rounded border border-edge mt-2">
                                        &ldquo;{probe.question}&rdquo;
                                      </p>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                        <div className="p-2 rounded bg-card border border-edge text-muted">
                                          <strong className="text-content block mb-0.5">What Hiring Team Listens For:</strong>
                                          {probe.whatHiringTeamListensFor}
                                        </div>
                                        <div className="p-2 rounded bg-signal/5 border border-signal/30 text-content">
                                          <strong className="text-signal block mb-0.5">Recommended Defense:</strong>
                                          {probe.recommendedDefense}
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
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Premium Confirm Delete Modal */}
      {resumeToDelete && (
        <ConfirmModal
          isOpen={!!resumeToDelete}
          onClose={() => setResumeToDelete(null)}
          onConfirm={() => {
            if (resumeToDelete) {
              deleteResume(resumeToDelete.id);
              loadData();
              setResumeToDelete(null);
            }
          }}
          title={resumeToDelete.isMaster ? 'Delete Master Resume?' : 'Delete Tailored Variant?'}
          description={
            resumeToDelete.isMaster ? (
              <div className="space-y-2 font-sans text-xs">
                <p>
                  Are you sure you want to delete <strong className="text-content">{resumeToDelete.title}</strong>?
                </p>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-500">
                  <p className="font-semibold">Permanent Deletion</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed">
                    The original uploaded file and all related AI diagnostics will be removed from your vault.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 font-sans text-xs">
                <p>
                  Are you sure you want to delete <strong className="text-content">{resumeToDelete.title}</strong>?
                </p>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
                  <p className="font-semibold">Safe Deletion</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed">
                    Your master resume copy will remain 100% safe and intact in your vault.
                  </p>
                </div>
              </div>
            )
          }
          confirmLabel={resumeToDelete.isMaster ? 'Delete Master Copy' : 'Delete Variant'}
          variant="danger"
        />
      )}

      {/* Premium Alert Modal */}
      {alertModal.isOpen && (
        <AlertModal
          isOpen={alertModal.isOpen}
          onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
          title={alertModal.title}
          description={alertModal.description}
          variant={alertModal.variant}
        />
      )}

      {/* AI Tailoring Studio Modal */}
      {isTailorModalOpen && proposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="fade-up relative w-full max-w-3xl my-auto rounded-2xl border border-edge bg-card p-6 shadow-card max-h-[92vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3.5 border-b border-edge">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal/15 border border-signal/30 text-signal">
                  <Icon.Sparkle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-content">
                    AI Resume & Section Tailoring Engine
                  </h3>
                  <p className="font-sans text-xs text-muted">
                    Transforms passive wording into high-signal engineering impact with quantifiable metrics.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTailorModalOpen(false)}
                className="text-muted hover:text-content p-1 rounded-lg hover:bg-well transition-colors"
              >
                <Icon.X className="h-4 w-4" />
              </button>
            </div>

            {/* Target Alignment Selector */}
            <div className="rounded-xl border border-signal/20 bg-signal/5 p-4 space-y-3 font-mono text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="font-bold text-content text-[11px] uppercase tracking-wider">
                  Target Role / Company Focus:
                </span>
                <span className="rounded bg-signal/15 border border-signal/30 px-2 py-0.5 text-signal font-bold text-[10px]">
                  Branching into Versioned Variant
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {['Cefalo (Software Engineer)', 'Backend & Distributed Systems', 'Senior Fullstack & Performance'].map((target) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => {
                      setTailorTarget(target);
                      if (activeResume) {
                        setProposal(generateAITailoredProposal(activeResume, target));
                      }
                    }}
                    className={`rounded-lg border px-3 py-2 text-left transition-all ${
                      tailorTarget === target
                        ? 'border-signal bg-signal/15 text-signal font-bold shadow-xs'
                        : 'border-edge bg-card text-muted hover:text-content hover:border-signal/40'
                    }`}
                  >
                    {target}
                  </button>
                ))}
              </div>
            </div>

            {/* Proposed Tailored Summary */}
            <div className="space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <label className="font-bold text-content text-xs">
                  Proposed Tailored Professional Summary
                </label>
                <span className="text-[10px] text-signal font-semibold">Editable Draft</span>
              </div>
              <TextArea
                rows={4}
                value={proposal.tailoredSummary}
                onChange={(e) =>
                  setProposal({ ...proposal, tailoredSummary: e.target.value })
                }
              />
            </div>

            {/* Proposed Bullet Improvements (Side-by-Side Diff) */}
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-edge pb-1">
                <label className="font-bold text-content text-xs">
                  Enhanced Experience Bullets ({proposal.bulletProposals.length} Proposed)
                </label>
                <span className="text-[10px] text-muted">
                  Toggle or edit any bullet point before applying
                </span>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 thin-scroll">
                {proposal.bulletProposals.map((bp, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3.5 space-y-2 transition-all ${
                      bp.enabled
                        ? 'border-signal/40 bg-well/40'
                        : 'border-edge bg-well/20 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bp.enabled}
                          onChange={(e) => {
                            const updated = [...proposal.bulletProposals];
                            updated[idx].enabled = e.target.checked;
                            setProposal({ ...proposal, bulletProposals: updated });
                          }}
                          className="h-3.5 w-3.5 rounded border-edge text-signal focus:ring-signal"
                        />
                        <span className="font-bold text-content text-[11px]">
                          Bullet #{idx + 1}
                        </span>
                      </label>
                      <span className="rounded bg-signal/10 border border-signal/20 px-2 py-0.5 text-[10px] font-semibold text-signal">
                        {bp.rationale}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="text-muted line-through font-sans">
                        Original: {bp.original}
                      </div>
                      <div className="pt-1">
                        <textarea
                          rows={2}
                          value={bp.tailored}
                          disabled={!bp.enabled}
                          onChange={(e) => {
                            const updated = [...proposal.bulletProposals];
                            updated[idx].tailored = e.target.value;
                            setProposal({ ...proposal, bulletProposals: updated });
                          }}
                          className="w-full rounded-lg border border-edge bg-card p-2 text-content font-sans text-xs focus:border-signal focus:outline-hidden disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-edge">
              <span className="font-sans text-[11px] text-muted">
                🔒 Your original Master Copy will remain 100% uncorrupted. A versioned variant will be created.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTailorModalOpen(false)}
                  className="rounded-xl border border-edge bg-well px-4 py-2 font-mono text-xs font-semibold text-content hover:bg-card"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyTailoredProposal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90"
                >
                  <Icon.Sparkle className="h-3.5 w-3.5" />
                  <span>Confirm & Create Tailored Variant (v2.0)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section-by-Section In-Place Editor Modal */}
      {isSectionEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="fade-up relative w-full max-w-3xl my-auto rounded-2xl border border-edge bg-card p-6 shadow-card max-h-[92vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-edge">
              <div>
                <h3 className="font-mono text-sm font-bold text-content">
                  Edit Resume Sections Directly
                </h3>
                <p className="font-sans text-xs text-muted">
                  Edit without opening Word. Edits create or update clean versioned variants in the exact same format.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSectionEditOpen(false)}
                className="text-muted hover:text-content p-1 rounded-lg hover:bg-well transition-colors"
              >
                <Icon.X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Candidate Full Name">
                  <TextInput
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    placeholder="e.g. Golam Rabby"
                  />
                </FormField>
                <FormField label="Role Subtitle">
                  <TextInput
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. Software Engineer"
                  />
                </FormField>
              </div>

              <FormField
                label="Contact Row (Pipe-separated)"
                hint="e.g. Location | Email | Phone | GitHub | LinkedIn | Portfolio"
              >
                <TextInput
                  value={editContactLine}
                  onChange={(e) => setEditContactLine(e.target.value)}
                  placeholder="Chattogram, Bangladesh | golamrabby821@gmail.com | 01842-052136 | github.com/... | linkedin.com/..."
                />
              </FormField>

              <FormField label="Professional Summary">
                <TextArea
                  rows={4}
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                />
              </FormField>

              {/* Work Experiences Section */}
              <div className="space-y-3 pt-2 border-t border-edge">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-content text-xs">
                    Work Experiences ({editExperiences.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setEditExperiences([
                        ...editExperiences,
                        {
                          id: `exp_new_${Date.now()}`,
                          company: 'Company Name',
                          role: 'Software Engineer',
                          period: 'Present',
                          bullets: ['Key engineering achievement or responsibility.'],
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-signal hover:underline text-[11px] font-bold"
                  >
                    <Icon.Plus className="h-3 w-3" />
                    <span>Add Position</span>
                  </button>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 thin-scroll">
                  {editExperiences.map((exp, expIdx) => (
                    <div key={exp.id} className="rounded-xl border border-edge bg-well/40 p-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-signal text-[11px]">Position #{expIdx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditExperiences(editExperiences.filter((_, i) => i !== expIdx));
                          }}
                          className="text-muted hover:text-rose-500 transition-colors p-1"
                          title="Delete position"
                        >
                          <Icon.X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <TextInput
                          value={exp.company}
                          onChange={(e) => {
                            const updated = [...editExperiences];
                            updated[expIdx].company = e.target.value;
                            setEditExperiences(updated);
                          }}
                          placeholder="Company"
                        />
                        <TextInput
                          value={exp.role}
                          onChange={(e) => {
                            const updated = [...editExperiences];
                            updated[expIdx].role = e.target.value;
                            setEditExperiences(updated);
                          }}
                          placeholder="Role"
                        />
                        <TextInput
                          value={exp.period}
                          onChange={(e) => {
                            const updated = [...editExperiences];
                            updated[expIdx].period = e.target.value;
                            setEditExperiences(updated);
                          }}
                          placeholder="Date Period"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-muted font-bold uppercase">Bullet Points</label>
                        {exp.bullets.map((b, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-1.5">
                            <span className="text-muted">•</span>
                            <input
                              type="text"
                              value={b}
                              onChange={(e) => {
                                const updated = [...editExperiences];
                                updated[expIdx].bullets[bIdx] = e.target.value;
                                setEditExperiences(updated);
                              }}
                              className="flex-1 rounded border border-edge bg-card px-2 py-1 text-content font-sans text-xs focus:border-signal focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...editExperiences];
                                updated[expIdx].bullets = updated[expIdx].bullets.filter((_, i) => i !== bIdx);
                                setEditExperiences(updated);
                              }}
                              className="text-muted hover:text-rose-500 p-1"
                            >
                              <Icon.X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...editExperiences];
                            updated[expIdx].bullets.push('New responsibility or metric achievement.');
                            setEditExperiences(updated);
                          }}
                          className="text-signal hover:underline text-[10px] font-bold inline-flex items-center gap-1 mt-1"
                        >
                          <Icon.Plus className="h-2.5 w-2.5" />
                          <span>Add Bullet Point</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Projects Section */}
              <div className="space-y-3 pt-3 border-t border-edge">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-content text-xs">
                    Key Projects ({editProjects.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setEditProjects([
                        ...editProjects,
                        {
                          name: 'New Project Name',
                          link: 'github.com/...',
                          description: 'React, TypeScript, Supabase',
                          bullets: ['Key engineering achievement or architectural decision.'],
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-signal hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    <Icon.Plus className="h-3 w-3" />
                    <span>Add Project</span>
                  </button>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 thin-scroll">
                  {editProjects.map((proj, projIdx) => (
                    <div key={projIdx} className="rounded-xl border border-edge bg-well/40 p-3.5 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-signal text-[11px]">Project #{projIdx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditProjects(editProjects.filter((_, i) => i !== projIdx));
                          }}
                          className="text-muted hover:text-rose-500 transition-colors p-1 cursor-pointer"
                          title="Delete project"
                        >
                          <Icon.X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <TextInput
                          value={proj.name}
                          onChange={(e) => {
                            const updated = [...editProjects];
                            updated[projIdx].name = e.target.value;
                            setEditProjects(updated);
                          }}
                          placeholder="Project Name (e.g. Prottaho)"
                        />
                        <TextInput
                          value={proj.link || ''}
                          onChange={(e) => {
                            const updated = [...editProjects];
                            updated[projIdx].link = e.target.value;
                            setEditProjects(updated);
                          }}
                          placeholder="Live Link / GitHub (e.g. prottaho.com | Feb 2026)"
                        />
                      </div>

                      <TextInput
                        value={proj.description}
                        onChange={(e) => {
                          const updated = [...editProjects];
                          updated[projIdx].description = e.target.value;
                          setEditProjects(updated);
                        }}
                        placeholder="Tech Stack (e.g. React, TypeScript, Tailwind, Supabase)"
                      />

                      <div className="space-y-1.5">
                        <label className="text-[10px] text-muted font-bold uppercase">Project Bullet Points</label>
                        {(proj.bullets || []).map((pb, pbIdx) => (
                          <div key={pbIdx} className="flex items-center gap-1.5">
                            <span className="text-muted">•</span>
                            <input
                              type="text"
                              value={pb}
                              onChange={(e) => {
                                const updated = [...editProjects];
                                if (!updated[projIdx].bullets) updated[projIdx].bullets = [];
                                updated[projIdx].bullets![pbIdx] = e.target.value;
                                setEditProjects(updated);
                              }}
                              className="flex-1 rounded border border-edge bg-card px-2 py-1 text-content font-sans text-xs focus:border-signal focus:outline-hidden"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...editProjects];
                                updated[projIdx].bullets = (updated[projIdx].bullets || []).filter((_, i) => i !== pbIdx);
                                setEditProjects(updated);
                              }}
                              className="text-muted hover:text-rose-500 p-1 cursor-pointer"
                            >
                              <Icon.X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...editProjects];
                            if (!updated[projIdx].bullets) updated[projIdx].bullets = [];
                            updated[projIdx].bullets!.push('Architected feature with measurable performance impact.');
                            setEditProjects(updated);
                          }}
                          className="text-signal hover:underline text-[10px] font-bold inline-flex items-center gap-1 mt-1 cursor-pointer"
                        >
                          <Icon.Plus className="h-2.5 w-2.5" />
                          <span>Add Project Bullet</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Technical Skills Section */}
              <div className="space-y-3 pt-3 border-t border-edge">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-content text-xs">
                    Technical Skills ({editSkills.length} Categories)
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setEditSkills([
                        ...editSkills,
                        { category: 'New Category', items: ['Skill 1', 'Skill 2'] },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-signal hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    <Icon.Plus className="h-3 w-3" />
                    <span>Add Category</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1 thin-scroll">
                  {editSkills.map((sk, sIdx) => (
                    <div key={sIdx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={sk.category}
                        onChange={(e) => {
                          const updated = [...editSkills];
                          updated[sIdx].category = e.target.value;
                          setEditSkills(updated);
                        }}
                        placeholder="Category (e.g. Frontend)"
                        className="w-1/3 rounded border border-edge bg-card px-2 py-1 text-content font-mono text-xs focus:border-signal focus:outline-hidden"
                      />
                      <input
                        type="text"
                        value={sk.items.join(', ')}
                        onChange={(e) => {
                          const updated = [...editSkills];
                          updated[sIdx].items = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setEditSkills(updated);
                        }}
                        placeholder="Comma-separated items (e.g. React, Next.js, TypeScript)"
                        className="flex-1 rounded border border-edge bg-card px-2 py-1 text-content font-sans text-xs focus:border-signal focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditSkills(editSkills.filter((_, i) => i !== sIdx));
                        }}
                        className="text-muted hover:text-rose-500 p-1 cursor-pointer"
                      >
                        <Icon.X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Education Section */}
              <div className="space-y-3 pt-3 border-t border-edge">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-content text-xs">
                    Education ({editEducation.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setEditEducation([
                        ...editEducation,
                        {
                          degree: 'B.Sc. in Electrical and Electronic Engineering',
                          institution: 'Khulna University of Engineering & Technology (KUET)',
                          year: 'Jan 2026',
                          coursework: 'Data Structures, Algorithms, Software Engineering',
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-signal hover:underline text-[11px] font-bold cursor-pointer"
                  >
                    <Icon.Plus className="h-3 w-3" />
                    <span>Add Degree</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 thin-scroll">
                  {editEducation.map((edu, eduIdx) => (
                    <div key={eduIdx} className="rounded-xl border border-edge bg-well/40 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-signal text-[11px]">Degree #{eduIdx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditEducation(editEducation.filter((_, i) => i !== eduIdx));
                          }}
                          className="text-muted hover:text-rose-500 transition-colors p-1 cursor-pointer"
                        >
                          <Icon.X className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={edu.degree}
                          onChange={(e) => {
                            const updated = [...editEducation];
                            updated[eduIdx].degree = e.target.value;
                            setEditEducation(updated);
                          }}
                          placeholder="Degree"
                          className="rounded border border-edge bg-card px-2 py-1 text-content font-sans text-xs focus:border-signal focus:outline-hidden"
                        />
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => {
                            const updated = [...editEducation];
                            updated[eduIdx].institution = e.target.value;
                            setEditEducation(updated);
                          }}
                          placeholder="Institution / University"
                          className="rounded border border-edge bg-card px-2 py-1 text-content font-sans text-xs focus:border-signal focus:outline-hidden"
                        />
                        <input
                          type="text"
                          value={edu.year || ''}
                          onChange={(e) => {
                            const updated = [...editEducation];
                            updated[eduIdx].year = e.target.value;
                            setEditEducation(updated);
                          }}
                          placeholder="Year (e.g. Jan 2026)"
                          className="rounded border border-edge bg-card px-2 py-1 text-content font-sans text-xs focus:border-signal focus:outline-hidden"
                        />
                      </div>

                      <input
                        type="text"
                        value={edu.coursework || ''}
                        onChange={(e) => {
                          const updated = [...editEducation];
                          updated[eduIdx].coursework = e.target.value;
                          setEditEducation(updated);
                        }}
                        placeholder="Relevant Coursework (e.g. Data Structures, Algorithms, Software Engineering)"
                        className="w-full rounded border border-edge bg-card px-2 py-1 text-content font-sans text-xs focus:border-signal focus:outline-hidden"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-edge">
              <button
                type="button"
                onClick={() => setIsSectionEditOpen(false)}
                className="rounded-xl border border-edge bg-well px-4 py-2 font-mono text-xs font-semibold text-content hover:bg-card"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSectionEdit}
                className="rounded-xl bg-signal px-4 py-2 font-mono text-xs font-bold text-white shadow-xs hover:bg-signal/90"
              >
                Save as Versioned Variant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Flawless Native Print to PDF */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          header,
          nav,
          aside,
          button,
          .no-print,
          [role='navigation'] {
            display: none !important;
          }
          #printable-resume-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}
