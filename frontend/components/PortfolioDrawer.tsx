'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/icons';
import {
  PortfolioCompany,
  PortfolioProduct,
  PortfolioProject,
  MasterBullet,
  saveCompany,
  saveProduct,
  saveProject,
  saveBullet,
  setStoredCompanyRole,
  getStoredCompanyRoles,
  normalizeDateToISO,
  formatISODateToDisplay,
  humanizePortfolioError,
} from '@/lib/portfolio';
import {
  FormField,
  TextInput,
  TextArea,
  Select,
  Checkbox,
  Tooltip,
  type SelectOption,
} from '@/components/ui';

export type DrawerEntity =
  | { type: 'company'; company?: PortfolioCompany }
  | { type: 'product'; companyId: string; companyRole?: string | null; product?: PortfolioProduct }
  | { type: 'project'; project?: PortfolioProject }
  | {
      type: 'bullet';
      productId?: string;
      projectId?: string;
      parentProduct?: PortfolioProduct;
      parentProject?: PortfolioProject;
      bullet?: MasterBullet;
    };

interface PortfolioDrawerProps {
  entity: DrawerEntity | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleteRequest?: (item: { type: 'company' | 'product' | 'project' | 'bullet'; id: string; title: string }) => void;
}

const ARCHITECTURE_OPTIONS: SelectOption[] = [
  { value: 'Event-Driven Microservices', label: 'Event-Driven Microservices', description: 'Kafka, RabbitMQ, gRPC decoupled services' },
  { value: 'Distributed Storage / Caching Layer', label: 'Distributed Storage / Caching Layer', description: 'Redis, Raft, DynamoDB partitioning' },
  { value: 'High-Throughput API Gateway', label: 'High-Throughput API Gateway', description: 'Rate limiting, reverse proxy, auth middleware' },
  { value: 'Real-Time Data Streaming / Pipeline', label: 'Real-Time Data Streaming / Pipeline', description: 'Flink, Spark, real-time telemetry ingestion' },
  { value: 'Modular Monolith / Domain-Driven', label: 'Modular Monolith / Domain-Driven', description: 'Clean architecture, boundaries, Hexagonal' },
  { value: 'ML Ops & Model Serving Pipeline', label: 'ML Ops & Model Serving Pipeline', description: 'Inference serving, model latency optimization' },
  { value: 'Serverless / Cloud-Native Functions', label: 'Serverless / Cloud-Native Functions', description: 'Lambda, Step Functions, DynamoDB event triggers' },
  { value: 'Full-Stack Web Application', label: 'Full-Stack Web Application', description: 'Next.js, React, Node.js SSR/Edge compute' },
  { value: 'Developer Tools & CLI Engine', label: 'Developer Tools & CLI Engine', description: 'Developer productivity tools, code generators' },
  { value: '__custom__', label: '✏️ Custom / Freeform Archetype…', description: 'Type any custom architecture style or engineering paradigm' },
];

const REVIEW_STATUS_OPTIONS: Array<{ value: MasterBullet['review_status']; label: string; dotColor: string; description: string }> = [
  { value: 'approved', label: 'Approved', dotColor: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]', description: 'Verified metrics ready for resume compilation' },
  { value: 'needs_review', label: 'Needs Review', dotColor: 'bg-amber-400', description: 'Requires quantification or architecture defense context' },
  { value: 'draft', label: 'Draft', dotColor: 'bg-muted/60', description: 'Preliminary draft undergoing engineering iteration' },
];

export function PortfolioDrawer({ entity, onClose, onSaved, onDeleteRequest }: PortfolioDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Global Esc key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!mounted || !entity) return null;

  return createPortal(
    <div className="fixed inset-0 z-[140] flex justify-end">
      {/* Backdrop scrim */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/45 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
      />

      {/* Slide-over panel */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-[150] w-full max-w-xl md:max-w-2xl bg-card border-l border-edge/80 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 ease-out"
      >
        {entity.type === 'company' && (
          <CompanyDrawerContent company={entity.company} onClose={onClose} onSaved={onSaved} onDeleteRequest={onDeleteRequest} />
        )}
        {entity.type === 'product' && (
          <ProductDrawerContent
            companyId={entity.companyId}
            companyRole={entity.companyRole}
            product={entity.product}
            onClose={onClose}
            onSaved={onSaved}
            onDeleteRequest={onDeleteRequest}
          />
        )}
        {entity.type === 'project' && (
          <ProjectDrawerContent project={entity.project} onClose={onClose} onSaved={onSaved} onDeleteRequest={onDeleteRequest} />
        )}
        {entity.type === 'bullet' && (
          <BulletDrawerContent
            productId={entity.productId}
            projectId={entity.projectId}
            parentProduct={entity.parentProduct}
            parentProject={entity.parentProject}
            bullet={entity.bullet}
            onClose={onClose}
            onSaved={onSaved}
            onDeleteRequest={onDeleteRequest}
          />
        )}
      </div>
    </div>,
    document.body
  );
}

/* ==========================================================================
   1. Company Drawer Content
   ========================================================================== */
function CompanyDrawerContent({
  company,
  onClose,
  onSaved,
  onDeleteRequest,
}: {
  company?: PortfolioCompany;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleteRequest?: (item: { type: 'company'; id: string; title: string }) => void;
}) {
  const isEditing = Boolean(company?.id);
  const DRAFT_KEY = 'gitgrill_company_drawer_draft_v1';
  const initialRole = company?.role_title || (company?.id ? getStoredCompanyRoles()[company.id] : '') || '';

  const [name, setName] = useState(company?.name || '');
  const [roleTitle, setRoleTitle] = useState(initialRole);
  const [domain, setDomain] = useState(company?.domain || company?.website_url || '');
  const [location, setLocation] = useState(company?.location || '');
  const [startDate, setStartDate] = useState(company?.start_date ? formatISODateToDisplay(company.start_date) : '');
  const [endDate, setEndDate] = useState(company?.end_date ? formatISODateToDisplay(company.end_date) : '');
  const [isCurrent, setIsCurrent] = useState(company?.is_current || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Cmd/Ctrl + S to save
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  });

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError('Company / Organization name is required.');
      return;
    }

    setSaving(true);
    setError('');

    const startISO = normalizeDateToISO(startDate);
    const endISO = isCurrent ? null : normalizeDateToISO(endDate);

    try {
      const saved = await saveCompany({
        ...(company || {}),
        id: company?.id,
        name: name.trim(),
        role_title: roleTitle.trim() || null,
        domain: domain.trim() || null,
        website_url: domain.trim() || null,
        location: location.trim() || null,
        start_date: startISO,
        end_date: endISO,
        is_current: isCurrent,
      });

      if (saved?.id && roleTitle.trim()) {
        setStoredCompanyRole(saved.id, roleTitle.trim());
      }

      await onSaved();
      onClose();
    } catch (err: any) {
      setError(humanizePortfolioError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full divide-y divide-edge/60 font-sans">
      {/* Header */}
      <div className="px-5 py-4 bg-surface/50 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-1.5 rounded-lg bg-signal/10 text-signal border border-signal/20 shrink-0">
            <Icon.Building className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-signal">
                Company Node
              </span>
              <span className="text-muted/40">•</span>
              <span className="font-mono text-[11px] text-muted truncate">
                {isEditing ? 'Inspector & Deep Edit' : 'New Organization'}
              </span>
            </div>
            <h2 className="font-mono text-base font-bold text-content truncate">
              {name.trim() || (isEditing ? company?.name : 'Add Organization')}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Tooltip content="Close (Esc)" align="end">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-content hover:bg-surface border border-transparent hover:border-edge transition-colors cursor-pointer"
            >
              <Icon.X className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 thin-scroll">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono flex items-center gap-2 animate-in fade-in">
            <Icon.AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <FormField label="Company or Organization Name" required description="The legal or public enterprise name (e.g. Amazon.com, Stripe, Mediaocean)">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Amazon.com"
              required
              autoFocus
              className="font-mono"
            />
          </FormField>

          <FormField label="Job / Role Title" description="Your primary title at this organization (e.g. Software Development Engineer II)">
            <TextInput
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. Software Development Engineer"
              className="font-mono"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Start Date" description="e.g. Jul 2019 or 2019-07">
              <TextInput
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="e.g. Jul 2019"
                className="font-mono"
              />
            </FormField>

            <FormField label="End Date" description={isCurrent ? 'Present role' : 'e.g. Mar 2023'}>
              <TextInput
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="e.g. Mar 2023"
                disabled={isCurrent}
                className="font-mono disabled:opacity-50"
              />
            </FormField>
          </div>

          <div className="pt-0.5">
            <Checkbox
              checked={isCurrent}
              onChange={setIsCurrent}
              label="Currently employed here (Present)"
              description="Marks this organization as active on your live portfolio and resumes."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <FormField label="Location" description="City, State / Country">
              <TextInput
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Seattle, WA"
              />
            </FormField>

            <FormField label="Company Website / Domain" description="For enterprise verification">
              <TextInput
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. amazon.com"
                className="font-mono"
              />
            </FormField>
          </div>
        </div>

        {/* Info Box */}
        <div className="rounded-xl border border-edge/70 bg-surface/50 p-3.5 space-y-1.5 font-mono text-xs">
          <div className="flex items-center gap-1.5 text-signal font-bold text-[11px] uppercase tracking-wider">
            <Icon.Sparkle className="h-3.5 w-3.5" />
            <span>Decoupled SSOT Node</span>
          </div>
          <p className="font-sans text-xs text-muted leading-relaxed">
            Organizations group your subsystem products and master contributions. You can add direct company bullets or partition work across child products.
          </p>
        </div>
      </form>

      {/* Sticky Footer */}
      <div className="px-5 py-3.5 bg-surface/60 border-t border-edge/60 flex items-center justify-between gap-3 shrink-0">
        <div>
          {isEditing && company?.id && onDeleteRequest ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeleteRequest({ type: 'company', id: company.id, title: company.name });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
            >
              <Icon.Trash className="h-3.5 w-3.5" />
              <span>Delete Company</span>
            </button>
          ) : (
            <span className="font-mono text-[11px] text-muted/60 hidden sm:inline">
              Press <kbd className="px-1.5 py-0.5 rounded bg-well border border-edge text-content text-[10px]">⌘S</kbd> to save
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-edge bg-card hover:bg-surface text-muted hover:text-content font-mono text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-signal hover:bg-signal-hover text-surface font-mono text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {saving && <Icon.Spinner className="h-3.5 w-3.5 animate-spin" />}
            <span>{isEditing ? 'Save Changes' : 'Create Organization'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   2. Product / Subsystem Drawer Content
   ========================================================================== */
function ProductDrawerContent({
  companyId,
  companyRole,
  product,
  onClose,
  onSaved,
  onDeleteRequest,
}: {
  companyId: string;
  companyRole?: string | null;
  product?: PortfolioProduct;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleteRequest?: (item: { type: 'product'; id: string; title: string }) => void;
}) {
  const isEditing = Boolean(product?.id);
  const [name, setName] = useState(product?.name || '');
  const isKnownPreset = ARCHITECTURE_OPTIONS.some(
    (p) => p.value !== '__custom__' && (p.value === product?.architecture_type || p.value.toLowerCase() === (product?.architecture_type || '').toLowerCase())
  );
  const [isCustomArch, setIsCustomArch] = useState(Boolean(product?.architecture_type && !isKnownPreset));
  const [architectureType, setArchitectureType] = useState(product?.architecture_type || 'Event-Driven Microservices');
  const [techStack, setTechStack] = useState<string[]>(product?.tech_stack || []);
  const [techInput, setTechInput] = useState('');
  const [liveUrl, setLiveUrl] = useState(product?.live_url || '');
  const [repoUrl, setRepoUrl] = useState(product?.repo_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Cmd/Ctrl + S to save
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  });

  const handleAddTechChip = () => {
    const cleaned = techInput.trim().replace(/^#/, '');
    if (cleaned && !techStack.includes(cleaned)) {
      setTechStack([...techStack, cleaned]);
      setTechInput('');
    }
  };

  const handleRemoveTechChip = (tech: string) => {
    setTechStack(techStack.filter((t) => t !== tech));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError('Product or Subsystem name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await saveProduct({
        ...(product || {}),
        id: product?.id,
        company_id: companyId,
        name: name.trim(),
        architecture_type: architectureType.trim() || null,
        tech_stack: techStack,
        live_url: liveUrl.trim() || null,
        repo_url: repoUrl.trim() || null,
      });

      await onSaved();
      onClose();
    } catch (err: any) {
      setError(humanizePortfolioError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full divide-y divide-edge/60 font-sans">
      {/* Header */}
      <div className="px-5 py-4 bg-surface/50 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-500 border border-amber-500/25 shrink-0">
            <Icon.Layers className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-500">
                Product / Subsystem Node
              </span>
              <span className="text-muted/40">•</span>
              <span className="font-mono text-[11px] text-muted truncate">
                {isEditing ? 'Subsystem Inspector' : 'New Subsystem'}
              </span>
            </div>
            <h2 className="font-mono text-base font-bold text-content truncate">
              {name.trim() || (isEditing ? product?.name : 'Add Subsystem')}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Tooltip content="Close (Esc)" align="end">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-content hover:bg-surface border border-transparent hover:border-edge transition-colors cursor-pointer"
            >
              <Icon.X className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 thin-scroll">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono flex items-center gap-2 animate-in fade-in">
            <Icon.AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <FormField label="Product or Subsystem Title" required description="e.g. EBS Client Software, Ad Intelligence Pipeline, Scope CEP Analytics Engine">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. EBS Client Software"
              required
              autoFocus
              className="font-mono"
            />
          </FormField>

          <FormField label="Engineering Architecture Archetype" description="The core technical paradigm and architectural pattern underpinning this subsystem">
            <Select
              options={ARCHITECTURE_OPTIONS}
              value={isCustomArch ? '__custom__' : architectureType}
              onChange={(val) => {
                if (val === '__custom__') {
                  setIsCustomArch(true);
                  if (isKnownPreset) setArchitectureType('');
                } else {
                  setIsCustomArch(false);
                  setArchitectureType(val);
                }
              }}
            />
          </FormField>

          {isCustomArch && (
            <FormField label="Custom Engineering Paradigm / Archetype" required description="Type any specialized architecture archetype">
              <TextInput
                value={architectureType}
                onChange={(e) => setArchitectureType(e.target.value)}
                placeholder="e.g. Zero-Knowledge Proof Ingestion Layer"
                className="font-mono"
                autoFocus
              />
            </FormField>
          )}

          {/* Tech Stack Chip Manager */}
          <div className="space-y-1.5">
            <label className="block font-mono text-xs font-semibold text-content">
              Product Tech Stack Chips
            </label>
            <p className="font-sans text-xs text-muted">
              Subtle monochrome chips displayed at the Product level (e.g. AWS EC2, C++, Python, Ember.js).
            </p>

            <div className="flex items-center gap-2 pt-1">
              <TextInput
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTechChip();
                  }
                }}
                placeholder="Type tech and press Enter (e.g. Kafka, Redis, Go)"
                className="font-mono flex-1 text-xs"
              />
              <button
                type="button"
                onClick={handleAddTechChip}
                className="px-3 py-1.5 rounded-lg border border-edge bg-well hover:bg-surface text-content font-mono text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                + Add Chip
              </button>
            </div>

            {/* Active Chip Cloud */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              {techStack.length === 0 ? (
                <span className="font-mono text-xs text-muted/60 italic">No tech stack chips added yet.</span>
              ) : (
                techStack.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-1 rounded bg-well/80 border border-edge/80 px-2 py-0.5 font-mono text-xs text-content shadow-2xs"
                  >
                    <span>#{tech}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTechChip(tech)}
                      className="text-muted hover:text-red-400 p-0.5 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <FormField label="Internal Repo / Documentation URL" description="Link to repo or technical documentation">
              <TextInput
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="e.g. https://github.com/org/repo"
                className="font-mono text-xs"
              />
            </FormField>

            <FormField label="Live Production URL" description="Subsystem dashboard or live URL">
              <TextInput
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="e.g. https://aws.amazon.com/ebs/"
                className="font-mono text-xs"
              />
            </FormField>
          </div>
        </div>
      </form>

      {/* Sticky Footer */}
      <div className="px-5 py-3.5 bg-surface/60 border-t border-edge/60 flex items-center justify-between gap-3 shrink-0">
        <div>
          {isEditing && product?.id && onDeleteRequest ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeleteRequest({ type: 'product', id: product.id, title: product.name });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
            >
              <Icon.Trash className="h-3.5 w-3.5" />
              <span>Delete Product</span>
            </button>
          ) : (
            <span className="font-mono text-[11px] text-muted/60 hidden sm:inline">
              Press <kbd className="px-1.5 py-0.5 rounded bg-well border border-edge text-content text-[10px]">⌘S</kbd> to save
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-edge bg-card hover:bg-surface text-muted hover:text-content font-mono text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-signal hover:bg-signal-hover text-surface font-mono text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {saving && <Icon.Spinner className="h-3.5 w-3.5 animate-spin" />}
            <span>{isEditing ? 'Save Changes' : 'Create Subsystem'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   3. Master Bullet Drawer Content (Deep Defense, Impact & Trade-offs)
   ========================================================================== */
function BulletDrawerContent({
  productId,
  projectId,
  parentProduct,
  parentProject,
  bullet,
  onClose,
  onSaved,
  onDeleteRequest,
}: {
  productId?: string;
  projectId?: string;
  parentProduct?: PortfolioProduct;
  parentProject?: PortfolioProject;
  bullet?: MasterBullet;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleteRequest?: (item: { type: 'bullet'; id: string; title: string }) => void;
}) {
  const isEditing = Boolean(bullet?.id);
  const [bulletText, setBulletText] = useState(bullet?.bullet_text || '');
  const [actionVerb, setActionVerb] = useState(bullet?.action_verb || '');
  const [metricPrimary, setMetricPrimary] = useState(bullet?.metric_primary || '');
  const [techStackStr, setTechStackStr] = useState(bullet?.tech_stack?.join(', ') || '');
  const [contextChallenge, setContextChallenge] = useState(bullet?.context_challenge || '');
  const [defenseNotes, setDefenseNotes] = useState(bullet?.defense_notes || '');
  const [reviewStatus, setReviewStatus] = useState<MasterBullet['review_status']>(bullet?.review_status || 'approved');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Auto-detect action verb and primary metric as user types
  useEffect(() => {
    if (!bullet) {
      const matchVerb = bulletText.match(/^\s*([A-Za-z]+ed|[A-Za-z]+ing)\b/i);
      if (matchVerb && !actionVerb) {
        setActionVerb(matchVerb[1]);
      }
      const matchMetric = bulletText.match(/(\d+[%kKmMbBxX]|\b\d+\s*(ms|seconds|minutes|hours|days|x|users|req\/s|rps|queries|events)\b|\$\d+)/);
      if (matchMetric && !metricPrimary) {
        setMetricPrimary(matchMetric[0]);
      }
    }
  }, [bulletText, bullet, actionVerb, metricPrimary]);

  // Cmd/Ctrl + S to save
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  });

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!bulletText.trim()) {
      setError('Bullet text cannot be empty.');
      return;
    }

    setSaving(true);
    setError('');

    const techArray = techStackStr
      .split(',')
      .map((s) => s.trim().replace(/^#/, ''))
      .filter(Boolean);

    try {
      await saveBullet({
        ...(bullet || {}),
        id: bullet?.id,
        product_id: productId || bullet?.product_id || null,
        project_id: projectId || bullet?.project_id || null,
        bullet_text: bulletText.trim(),
        action_verb: actionVerb.trim() || null,
        metric_primary: metricPrimary.trim() || null,
        tech_stack: techArray,
        context_challenge: contextChallenge.trim() || null,
        defense_notes: defenseNotes.trim() || null,
        review_status: reviewStatus,
        source_type: bullet?.source_type || 'manual',
      });

      await onSaved();
      onClose();
    } catch (err: any) {
      setError(humanizePortfolioError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full divide-y divide-edge/60 font-sans">
      {/* Header */}
      <div className="px-5 py-4 bg-surface/50 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 shrink-0">
            <Icon.Sparkle className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                Master Bullet Inspector
              </span>
              <span className="text-muted/40">•</span>
              <span className="font-mono text-[11px] text-muted truncate">
                {parentProduct?.name || parentProject?.name || 'Atomic Impact Entry'}
              </span>
            </div>
            <h2 className="font-mono text-base font-bold text-content truncate">
              {isEditing ? 'Engineering Contribution & Defense' : 'New Master Bullet'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Tooltip content="Close (Esc)" align="end">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-content hover:bg-surface border border-transparent hover:border-edge transition-colors cursor-pointer"
            >
              <Icon.X className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 thin-scroll">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono flex items-center gap-2 animate-in fade-in">
            <Icon.AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Status Segmented Switcher */}
        <div className="space-y-1.5">
          <label className="block font-mono text-xs font-semibold text-content">
            Verification & Review Status
          </label>
          <div className="grid grid-cols-3 gap-2">
            {REVIEW_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setReviewStatus(opt.value)}
                className={`flex items-center justify-center gap-2 py-2 px-2.5 rounded-xl border text-xs font-mono font-semibold transition-all cursor-pointer ${
                  reviewStatus === opt.value
                    ? 'border-signal bg-signal/15 text-signal font-bold shadow-xs'
                    : 'border-edge bg-card text-muted hover:text-content hover:bg-surface'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${opt.dotColor}`} />
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Primary Bullet Text Editor */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block font-mono text-xs font-semibold text-content">
              Contribution Text <span className="text-signal">*</span>
            </label>
            <span className="font-mono text-[11px] text-muted">
              {bulletText.trim().split(/\s+/).filter(Boolean).length} words
            </span>
          </div>
          <TextArea
            value={bulletText}
            onChange={(e) => setBulletText(e.target.value)}
            rows={4}
            placeholder="e.g. Built scalable, deployable & high-performance software support for EC2 instance launch and network data storage attachment..."
            required
            autoFocus
            className="font-sans leading-relaxed text-sm"
          />
          <p className="font-sans text-[11px] text-muted">
            Focus on action verb + technical system + quantifiable outcome. Do not repeat technology tags if already assigned to the product.
          </p>
        </div>

        {/* Metric & Action Verb Dual Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Action Verb" description="e.g. Architected, Optimized, Sharded">
            <TextInput
              value={actionVerb}
              onChange={(e) => setActionVerb(e.target.value)}
              placeholder="e.g. Architected"
              className="font-mono text-xs"
            />
          </FormField>

          <FormField label="Primary Quantified Metric" description="e.g. 70%, 45k req/s, $2M">
            <TextInput
              value={metricPrimary}
              onChange={(e) => setMetricPrimary(e.target.value)}
              placeholder="e.g. 70% reduction in latency"
              className="font-mono text-xs"
            />
          </FormField>
        </div>

        {/* GitGrill Signature: Architectural Defense & Trade-Offs */}
        <div className="rounded-xl border border-edge/80 bg-card/60 p-4 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 border-b border-edge/60 pb-2.5">
            <span className="p-1 rounded bg-signal/15 text-signal">
              <Icon.Shield className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-mono text-xs font-bold text-content uppercase tracking-wider">
                Interview Defense & Trade-Off Context
              </h3>
              <p className="font-sans text-[11px] text-muted">
                Pre-loaded architectural justification for technical deep-dives and grilling sessions.
              </p>
            </div>
          </div>

          <FormField label="Engineering Challenge / Complexity" description="What made this problem non-trivial? High concurrency, scale, legacy constraints?">
            <TextArea
              value={contextChallenge}
              onChange={(e) => setContextChallenge(e.target.value)}
              rows={2}
              placeholder="e.g. High hypervisor thread contention during mass instance reboot cycles caused packet drops."
              className="font-sans text-xs"
            />
          </FormField>

          <FormField label="Trade-Off Defense & Alternatives Considered" description="Why this design over alternatives? What were the downsides or trade-offs?">
            <TextArea
              value={defenseNotes}
              onChange={(e) => setDefenseNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Evaluated in-kernel queueing vs userspace offload; chose offload to safeguard hypervisor kernel stability despite 4% serialization overhead."
              className="font-sans text-xs"
            />
          </FormField>
        </div>
      </form>

      {/* Sticky Footer */}
      <div className="px-5 py-3.5 bg-surface/60 border-t border-edge/60 flex items-center justify-between gap-3 shrink-0">
        <div>
          {isEditing && bullet?.id && onDeleteRequest ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeleteRequest({ type: 'bullet', id: bullet.id, title: 'bullet' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
            >
              <Icon.Trash className="h-3.5 w-3.5" />
              <span>Delete Bullet</span>
            </button>
          ) : (
            <span className="font-mono text-[11px] text-muted/60 hidden sm:inline">
              Press <kbd className="px-1.5 py-0.5 rounded bg-well border border-edge text-content text-[10px]">⌘S</kbd> to save
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-edge bg-card hover:bg-surface text-muted hover:text-content font-mono text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-signal hover:bg-signal-hover text-surface font-mono text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {saving && <Icon.Spinner className="h-3.5 w-3.5 animate-spin" />}
            <span>{isEditing ? 'Save Changes' : 'Create Master Bullet'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   4. Standalone Project Drawer Content
   ========================================================================== */
function ProjectDrawerContent({
  project,
  onClose,
  onSaved,
  onDeleteRequest,
}: {
  project?: PortfolioProject;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleteRequest?: (item: { type: 'project'; id: string; title: string }) => void;
}) {
  const isEditing = Boolean(project?.id);
  const [name, setName] = useState(project?.name || '');
  const [headline, setHeadline] = useState(project?.headline || '');
  const [repoUrl, setRepoUrl] = useState(project?.repo_url || '');
  const [liveUrl, setLiveUrl] = useState(project?.live_url || '');
  const [techStack, setTechStack] = useState<string[]>(project?.tech_stack || []);
  const [techInput, setTechInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Cmd/Ctrl + S to save
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  });

  const handleAddTechChip = () => {
    const cleaned = techInput.trim().replace(/^#/, '');
    if (cleaned && !techStack.includes(cleaned)) {
      setTechStack([...techStack, cleaned]);
      setTechInput('');
    }
  };

  const handleRemoveTechChip = (tech: string) => {
    setTechStack(techStack.filter((t) => t !== tech));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await saveProject({
        ...(project || {}),
        id: project?.id,
        name: name.trim(),
        headline: headline.trim() || null,
        repo_url: repoUrl.trim() || null,
        live_url: liveUrl.trim() || null,
        tech_stack: techStack,
      });

      await onSaved();
      onClose();
    } catch (err: any) {
      setError(humanizePortfolioError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full divide-y divide-edge/60 font-sans">
      {/* Header */}
      <div className="px-5 py-4 bg-surface/50 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-1.5 rounded-lg bg-sky-500/15 text-sky-500 border border-sky-500/25 shrink-0">
            <Icon.Code className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-sky-500">
                Standalone Project Node
              </span>
              <span className="text-muted/40">•</span>
              <span className="font-mono text-[11px] text-muted truncate">
                {isEditing ? 'Project Inspector' : 'New Project'}
              </span>
            </div>
            <h2 className="font-mono text-base font-bold text-content truncate">
              {name.trim() || (isEditing ? project?.name : 'Add Project')}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Tooltip content="Close (Esc)" align="end">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-content hover:bg-surface border border-transparent hover:border-edge transition-colors cursor-pointer"
            >
              <Icon.X className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 thin-scroll">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono flex items-center gap-2 animate-in fade-in">
            <Icon.AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <FormField label="Project Name" required description="e.g. GitGrill, Distributed Raft Engine, DevScope CLI">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Distributed Key-Value Store"
              required
              autoFocus
              className="font-mono"
            />
          </FormField>

          <FormField label="One-Line Pitch / Subtitle" description="What makes this project notable or architecturally complex?">
            <TextInput
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. High-throughput distributed storage engine implementing the Raft consensus algorithm in Go."
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="GitHub Repository URL" description="Public or private repository">
              <TextInput
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="e.g. https://github.com/user/project"
                className="font-mono text-xs"
              />
            </FormField>

            <FormField label="Live Demo / Deployment URL" description="Production URL or documentation">
              <TextInput
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="e.g. https://project.dev"
                className="font-mono text-xs"
              />
            </FormField>
          </div>

          {/* Tech Stack Chip Manager */}
          <div className="space-y-1.5 pt-1">
            <label className="block font-mono text-xs font-semibold text-content">
              Project Tech Stack Chips
            </label>
            <div className="flex items-center gap-2">
              <TextInput
                value={techInput}
                onChange={(e) => setTechInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTechChip();
                  }
                }}
                placeholder="Type tech and press Enter (e.g. Rust, WebSockets, WASM)"
                className="font-mono flex-1 text-xs"
              />
              <button
                type="button"
                onClick={handleAddTechChip}
                className="px-3 py-1.5 rounded-lg border border-edge bg-well hover:bg-surface text-content font-mono text-xs font-semibold transition-colors cursor-pointer shrink-0"
              >
                + Add Chip
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              {techStack.length === 0 ? (
                <span className="font-mono text-xs text-muted/60 italic">No tech stack chips added yet.</span>
              ) : (
                techStack.map((tech) => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-1 rounded bg-well/80 border border-edge/80 px-2 py-0.5 font-mono text-xs text-content shadow-2xs"
                  >
                    <span>#{tech}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTechChip(tech)}
                      className="text-muted hover:text-red-400 p-0.5 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </form>

      {/* Sticky Footer */}
      <div className="px-5 py-3.5 bg-surface/60 border-t border-edge/60 flex items-center justify-between gap-3 shrink-0">
        <div>
          {isEditing && project?.id && onDeleteRequest ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDeleteRequest({ type: 'project', id: project.id, title: project.name });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all cursor-pointer"
            >
              <Icon.Trash className="h-3.5 w-3.5" />
              <span>Delete Project</span>
            </button>
          ) : (
            <span className="font-mono text-[11px] text-muted/60 hidden sm:inline">
              Press <kbd className="px-1.5 py-0.5 rounded bg-well border border-edge text-content text-[10px]">⌘S</kbd> to save
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-edge bg-card hover:bg-surface text-muted hover:text-content font-mono text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-signal hover:bg-signal-hover text-surface font-mono text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {saving && <Icon.Spinner className="h-3.5 w-3.5 animate-spin" />}
            <span>{isEditing ? 'Save Changes' : 'Create Project'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
