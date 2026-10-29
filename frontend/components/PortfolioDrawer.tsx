'use client';

import React, { useState, useEffect } from 'react';
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
  | {
      type: 'company';
      company?: PortfolioCompany;
      onAddProduct?: (companyId: string) => void;
      onAddBullet?: (companyId: string) => void;
      onSelectProduct?: (product: PortfolioProduct) => void;
    }
  | {
      type: 'product';
      companyId: string;
      companyName?: string;
      companyRole?: string | null;
      product?: PortfolioProduct;
      onAddBullet?: (productId: string) => void;
      onSelectBullet?: (bullet: MasterBullet) => void;
    }
  | {
      type: 'project';
      project?: PortfolioProject;
      onAddBullet?: (projectId: string) => void;
      onSelectBullet?: (bullet: MasterBullet) => void;
    }
  | {
      type: 'bullet';
      productId?: string;
      projectId?: string;
      parentProduct?: PortfolioProduct;
      parentProject?: PortfolioProject;
      companyName?: string;
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
  { value: 'Distributed Storage / Caching Layer', label: 'Distributed Storage / Caching Layer', description: 'Redis, Raft, DynamoDB partitioning, 3PAR, SAN' },
  { value: 'High-Throughput API Gateway', label: 'High-Throughput API Gateway', description: 'Rate limiting, reverse proxy, auth middleware' },
  { value: 'Real-Time Data Streaming / Pipeline', label: 'Real-Time Data Streaming / Pipeline', description: 'Flink, Spark, real-time telemetry ingestion' },
  { value: 'Modular Monolith / Domain-Driven', label: 'Modular Monolith / Domain-Driven', description: 'Clean architecture, boundaries, Hexagonal' },
  { value: 'High-Availability Cluster & Disaster Recovery', label: 'High-Availability Cluster & Disaster Recovery', description: 'Serviceguard, failover, cluster quorum, active-passive' },
  { value: 'ML Ops & Model Serving Pipeline', label: 'ML Ops & Model Serving Pipeline', description: 'Inference serving, model latency optimization' },
  { value: 'Serverless / Cloud-Native Functions', label: 'Serverless / Cloud-Native Functions', description: 'Lambda, Step Functions, DynamoDB event triggers' },
  { value: 'Full-Stack Web Application', label: 'Full-Stack Web Application', description: 'Next.js, React, Node.js SSR/Edge compute' },
  { value: 'Developer Tools & Automation Engine', label: 'Developer Tools & Automation Engine', description: 'CRON automation, test harnesses, code generators' },
  { value: '__custom__', label: '✏️ Custom / Freeform Archetype…', description: 'Type any custom architecture style or engineering paradigm' },
];

const REVIEW_STATUS_OPTIONS: Array<{ value: MasterBullet['review_status']; label: string; dotColor: string; description: string }> = [
  { value: 'approved', label: 'Approved', dotColor: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]', description: 'Verified metrics ready for resume compilation' },
  { value: 'needs_review', label: 'Needs Review', dotColor: 'bg-amber-400', description: 'Requires quantification or architecture defense context' },
  { value: 'draft', label: 'Draft', dotColor: 'bg-muted/60', description: 'Preliminary draft undergoing engineering iteration' },
];

export function PortfolioDrawer({ entity, onClose, onSaved, onDeleteRequest }: PortfolioDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [currentEntity, setCurrentEntity] = useState<DrawerEntity | null>(entity);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCurrentEntity(entity);
  }, [entity]);

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

  if (!mounted || !currentEntity) return null;

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
        {currentEntity.type === 'company' && (
          <CompanyDrawerContent
            company={currentEntity.company}
            onClose={onClose}
            onSaved={onSaved}
            onDeleteRequest={onDeleteRequest}
            onNavigateToProduct={(prod) => {
              setCurrentEntity({
                type: 'product',
                companyId: currentEntity.company?.id || '',
                companyName: currentEntity.company?.name,
                companyRole: currentEntity.company?.role_title,
                product: prod,
              });
            }}
            onAddProduct={(cid) => {
              setCurrentEntity({
                type: 'product',
                companyId: cid,
                companyName: currentEntity.company?.name,
                companyRole: currentEntity.company?.role_title,
              });
            }}
            onAddDirectBullet={(cid) => {
              setCurrentEntity({
                type: 'bullet',
                companyName: currentEntity.company?.name,
              });
            }}
          />
        )}

        {currentEntity.type === 'product' && (
          <ProductDrawerContent
            companyId={currentEntity.companyId}
            companyName={currentEntity.companyName}
            companyRole={currentEntity.companyRole}
            product={currentEntity.product}
            onClose={onClose}
            onSaved={onSaved}
            onDeleteRequest={onDeleteRequest}
            onBackToCompany={
              currentEntity.companyName
                ? () => {
                    setCurrentEntity({
                      type: 'company',
                      company: {
                        id: currentEntity.companyId,
                        name: currentEntity.companyName || '',
                        role_title: currentEntity.companyRole,
                      },
                    });
                  }
                : undefined
            }
            onSelectBullet={(b) => {
              setCurrentEntity({
                type: 'bullet',
                productId: currentEntity.product?.id,
                parentProduct: currentEntity.product,
                companyName: currentEntity.companyName,
                bullet: b,
              });
            }}
            onAddBullet={(pid) => {
              setCurrentEntity({
                type: 'bullet',
                productId: pid,
                parentProduct: currentEntity.product,
                companyName: currentEntity.companyName,
              });
            }}
          />
        )}

        {currentEntity.type === 'project' && (
          <ProjectDrawerContent
            project={currentEntity.project}
            onClose={onClose}
            onSaved={onSaved}
            onDeleteRequest={onDeleteRequest}
            onSelectBullet={(b) => {
              setCurrentEntity({
                type: 'bullet',
                projectId: currentEntity.project?.id,
                parentProject: currentEntity.project,
                bullet: b,
              });
            }}
            onAddBullet={(pid) => {
              setCurrentEntity({
                type: 'bullet',
                projectId: pid,
                parentProject: currentEntity.project,
              });
            }}
          />
        )}

        {currentEntity.type === 'bullet' && (
          <BulletDrawerContent
            productId={currentEntity.productId}
            projectId={currentEntity.projectId}
            parentProduct={currentEntity.parentProduct}
            parentProject={currentEntity.parentProject}
            companyName={currentEntity.companyName}
            bullet={currentEntity.bullet}
            onClose={onClose}
            onSaved={onSaved}
            onDeleteRequest={onDeleteRequest}
            onBackToProduct={
              currentEntity.parentProduct
                ? () => {
                    setCurrentEntity({
                      type: 'product',
                      companyId: currentEntity.parentProduct?.company_id || '',
                      companyName: currentEntity.companyName,
                      product: currentEntity.parentProduct,
                    });
                  }
                : undefined
            }
          />
        )}
      </div>
    </div>,
    document.body
  );
}

/* ==========================================================================
   1. Company Drawer Content (Rich Dossier & Subsystems Overview)
   ========================================================================== */
function CompanyDrawerContent({
  company,
  onClose,
  onSaved,
  onDeleteRequest,
  onNavigateToProduct,
  onAddProduct,
  onAddDirectBullet,
}: {
  company?: PortfolioCompany;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleteRequest?: (item: { type: 'company'; id: string; title: string }) => void;
  onNavigateToProduct?: (product: PortfolioProduct) => void;
  onAddProduct?: (companyId: string) => void;
  onAddDirectBullet?: (companyId: string) => void;
}) {
  const isEditing = Boolean(company?.id);
  const initialRole = company?.role_title || (company?.id ? getStoredCompanyRoles()[company.id] : '') || '';

  const [activeTab, setActiveTab] = useState<'dossier' | 'edit'>('dossier');
  const [name, setName] = useState(company?.name || '');
  const [roleTitle, setRoleTitle] = useState(initialRole);
  const [domain, setDomain] = useState(company?.domain || company?.website_url || '');
  const [location, setLocation] = useState(company?.location || '');
  const [startDate, setStartDate] = useState(company?.start_date ? formatISODateToDisplay(company.start_date) : '');
  const [endDate, setEndDate] = useState(company?.end_date ? formatISODateToDisplay(company.end_date) : '');
  const [isCurrent, setIsCurrent] = useState(company?.is_current || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Aggregate stats across products
  const products = company?.products || [];
  const totalBullets = products.reduce((sum, p) => sum + (p.bullets?.length || 0), 0) + (company?.bullets?.length || 0);
  const companyTechStack = Array.from(
    new Set(products.flatMap((p) => p.tech_stack || []).filter(Boolean))
  );

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
          <span className="p-2 rounded-xl bg-signal/15 text-signal border border-signal/25 shrink-0">
            <Icon.Building className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-signal">
                Company Dossier
              </span>
              <span className="text-muted/40">•</span>
              <span className="font-mono text-[11px] text-muted">
                {products.length} {products.length === 1 ? 'subsystem' : 'subsystems'} · {totalBullets} master bullets
              </span>
            </div>
            {/* Prominent Unclipped Company Name */}
            <h2 className="font-mono text-base sm:text-lg font-bold text-content break-words leading-tight">
              {name.trim() || (isEditing ? company?.name : 'New Organization')}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Tab Switcher */}
          {isEditing && (
            <div className="flex items-center rounded-lg bg-well p-0.5 border border-edge text-xs font-mono mr-1">
              <button
                type="button"
                onClick={() => setActiveTab('dossier')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  activeTab === 'dossier'
                    ? 'bg-card text-signal shadow-2xs font-bold'
                    : 'text-muted hover:text-content'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  activeTab === 'edit'
                    ? 'bg-card text-signal shadow-2xs font-bold'
                    : 'text-muted hover:text-content'
                }`}
              >
                Edit
              </button>
            </div>
          )}

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

      {/* Main Drawer Body */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 thin-scroll">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono flex items-center gap-2 animate-in fade-in">
            <Icon.AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'dossier' && isEditing ? (
          /* Rich Company Overview & Subsystems Dossier */
          <div className="space-y-5">
            {/* Unclipped Role & Metadata Summary Box */}
            <div className="rounded-xl border border-edge/80 bg-surface/50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-edge/60 pb-3">
                <div>
                  <span className="font-mono text-[10px] uppercase font-bold text-muted tracking-wider block">
                    Engineering Role
                  </span>
                  <div className="font-mono text-sm sm:text-base font-bold text-content break-words mt-0.5">
                    {roleTitle || 'Role Title Unspecified'}
                  </div>
                </div>

                <div className="text-right sm:text-right shrink-0">
                  <span className="font-mono text-[10px] uppercase font-bold text-muted tracking-wider block">
                    Tenure
                  </span>
                  <div className="font-mono text-xs text-content font-medium mt-0.5">
                    {startDate || endDate
                      ? `${startDate || 'Start'} — ${isCurrent ? 'Present' : endDate || 'End'}`
                      : 'Tenure Unspecified'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-muted pt-1">
                {location && (
                  <div className="flex items-center gap-1.5">
                    <Icon.Globe className="h-3.5 w-3.5 text-signal shrink-0" />
                    <span className="text-content font-medium">{location}</span>
                  </div>
                )}
                {domain && (
                  <div className="flex items-center gap-1.5">
                    <Icon.Link className="h-3.5 w-3.5 text-signal shrink-0" />
                    <a
                      href={domain.startsWith('http') ? domain : `https://${domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-signal hover:underline truncate"
                    >
                      {domain.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Aggregated Organization Tech Stacks */}
            {companyTechStack.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted block">
                  Enterprise Technologies & Stack Cloud
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {companyTechStack.map((tech) => (
                    <span
                      key={tech}
                      className="rounded bg-well/80 border border-edge/80 px-2 py-0.5 font-mono text-xs text-content"
                    >
                      #{tech}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Subsystems & Products Ledger Section */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-mono text-xs font-bold text-content uppercase tracking-wider">
                    Subsystems & Initiatives ({products.length})
                  </h3>
                  <p className="font-sans text-[11px] text-muted">
                    Click any subsystem to inspect its architecture archetype and atomic contributions.
                  </p>
                </div>
                {company?.id && onAddProduct && (
                  <button
                    type="button"
                    onClick={() => onAddProduct(company.id)}
                    className="px-2.5 py-1 rounded-lg bg-signal/15 hover:bg-signal/25 text-signal border border-signal/30 font-mono text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Icon.Plus className="h-3 w-3" />
                    <span>Add Subsystem</span>
                  </button>
                )}
              </div>

              {products.length === 0 ? (
                <div className="rounded-xl border border-dashed border-edge/80 bg-well/30 p-5 text-center text-xs text-muted font-mono space-y-2">
                  <p>No subsystems or products recorded under this organization.</p>
                  {company?.id && onAddProduct && (
                    <button
                      type="button"
                      onClick={() => onAddProduct(company.id)}
                      className="text-signal hover:underline font-bold"
                    >
                      + Define First Subsystem
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {products.map((prod) => (
                    <div
                      key={prod.id}
                      onClick={() => onNavigateToProduct && onNavigateToProduct(prod)}
                      className="p-3 rounded-xl border border-edge/80 bg-card hover:border-signal/50 hover:bg-surface/50 transition-all cursor-pointer group space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs sm:text-sm font-bold text-content group-hover:text-signal transition-colors">
                              {prod.name}
                            </span>
                            <span className="rounded bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.2 font-mono text-[10px] text-amber-500 font-semibold shrink-0">
                              {prod.bullets?.length || 0} {(prod.bullets?.length || 0) === 1 ? 'bullet' : 'bullets'}
                            </span>
                          </div>
                          {prod.architecture_type && (
                            <span className="font-mono text-[11px] text-muted block mt-0.5">
                              {prod.architecture_type}
                            </span>
                          )}
                        </div>

                        <span className="text-muted group-hover:text-signal p-1">
                          <Icon.ChevronRight className="h-4 w-4" />
                        </span>
                      </div>

                      {/* Tech stack chips */}
                      {prod.tech_stack && prod.tech_stack.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          {prod.tech_stack.slice(0, 5).map((tech) => (
                            <span
                              key={tech}
                              className="rounded bg-well/80 border border-edge/70 px-1.5 py-0.2 font-mono text-[10px] text-muted"
                            >
                              #{tech}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Edit Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Company or Organization Name" required description="The legal or public enterprise name (e.g. Hewlett Packard Enterprise, Amazon.com)">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hewlett Packard Enterprise"
                required
                autoFocus
                className="font-mono text-sm"
              />
            </FormField>

            <FormField label="Job / Role Title" description="Your primary title at this organization (e.g. Research and Development Engineer)">
              <TextInput
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Research and Development Engineer"
                className="font-mono text-sm"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Start Date" description="e.g. Aug 2015">
                <TextInput
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="e.g. Aug 2015"
                  className="font-mono"
                />
              </FormField>

              <FormField label="End Date" description={isCurrent ? 'Present role' : 'e.g. Sep 2017'}>
                <TextInput
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="e.g. Sep 2017"
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
                  placeholder="e.g. Bangalore, Karnataka, India"
                />
              </FormField>

              <FormField label="Company Website / Domain" description="For enterprise verification">
                <TextInput
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g. hpe.com"
                  className="font-mono"
                />
              </FormField>
            </div>
          </form>
        )}
      </div>

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
          {activeTab === 'dossier' && isEditing ? (
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-signal/15 hover:bg-signal/25 text-signal border border-signal/30 font-mono text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Icon.Pencil className="h-3.5 w-3.5" />
              <span>Edit Organization</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => isEditing ? setActiveTab('dossier') : onClose()}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   2. Product / Subsystem Drawer Content (Rich Archetype Dossier & Bullets)
   ========================================================================== */
function ProductDrawerContent({
  companyId,
  companyName,
  companyRole,
  product,
  onClose,
  onSaved,
  onDeleteRequest,
  onBackToCompany,
  onSelectBullet,
  onAddBullet,
}: {
  companyId: string;
  companyName?: string;
  companyRole?: string | null;
  product?: PortfolioProduct;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleteRequest?: (item: { type: 'product'; id: string; title: string }) => void;
  onBackToCompany?: () => void;
  onSelectBullet?: (bullet: MasterBullet) => void;
  onAddBullet?: (productId: string) => void;
}) {
  const isEditing = Boolean(product?.id);
  const [activeTab, setActiveTab] = useState<'overview' | 'edit'>('overview');

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

  const bullets = product?.bullets || [];
  const selectedArchObj = ARCHITECTURE_OPTIONS.find((a) => a.value === architectureType);

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
          <span className="p-2 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/25 shrink-0">
            <Icon.Layers className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            {/* Breadcrumb back to Company */}
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px] text-muted">
              {companyName && (
                <button
                  type="button"
                  onClick={onBackToCompany}
                  className="font-bold text-signal hover:underline cursor-pointer"
                >
                  {companyName}
                </button>
              )}
              {companyName && <span className="text-muted/40">/</span>}
              <span className="uppercase font-bold tracking-wider text-amber-500">
                Subsystem Node
              </span>
            </div>
            {/* Prominent Unclipped Product Name */}
            <h2 className="font-mono text-base sm:text-lg font-bold text-content break-words leading-tight mt-0.5">
              {name.trim() || (isEditing ? product?.name : 'New Subsystem')}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Tab Switcher */}
          {isEditing && (
            <div className="flex items-center rounded-lg bg-well p-0.5 border border-edge text-xs font-mono mr-1">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-card text-signal shadow-2xs font-bold'
                    : 'text-muted hover:text-content'
                }`}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  activeTab === 'edit'
                    ? 'bg-card text-signal shadow-2xs font-bold'
                    : 'text-muted hover:text-content'
                }`}
              >
                Edit
              </button>
            </div>
          )}

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

      {/* Main Drawer Body */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 thin-scroll">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono flex items-center gap-2 animate-in fade-in">
            <Icon.AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'overview' && isEditing ? (
          /* Rich Product Overview & Contributions Dossier */
          <div className="space-y-5">
            {/* Architecture Archetype Card */}
            <div className="rounded-xl border border-edge/80 bg-surface/50 p-4 space-y-2">
              <span className="font-mono text-[10px] uppercase font-bold text-muted tracking-wider block">
                Engineering Architecture Archetype
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25 px-2.5 py-1 font-mono text-xs font-bold text-amber-500">
                  <Icon.Layers className="h-3.5 w-3.5" />
                  <span>{architectureType}</span>
                </span>
              </div>
              {selectedArchObj?.description && (
                <p className="font-sans text-xs text-muted leading-relaxed pt-1">
                  {selectedArchObj.description}
                </p>
              )}
            </div>

            {/* Subsystem Tech Stack Chips */}
            <div className="space-y-1.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted block">
                Subsystem Tech Stack
              </span>
              {techStack.length === 0 ? (
                <span className="font-mono text-xs text-muted italic">No tech stack chips configured.</span>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {techStack.map((tech) => (
                    <span
                      key={tech}
                      className="rounded bg-well/80 border border-edge/80 px-2 py-0.5 font-mono text-xs text-content"
                    >
                      #{tech}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Contributions / Master Bullets List */}
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-mono text-xs font-bold text-content uppercase tracking-wider">
                    Master Contributions ({bullets.length})
                  </h3>
                  <p className="font-sans text-[11px] text-muted">
                    Click any bullet to inspect its full text, quantified impact metrics, and trade-off defense.
                  </p>
                </div>
                {product?.id && onAddBullet && (
                  <button
                    type="button"
                    onClick={() => onAddBullet(product.id)}
                    className="px-2.5 py-1 rounded-lg bg-signal/15 hover:bg-signal/25 text-signal border border-signal/30 font-mono text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Icon.Plus className="h-3 w-3" />
                    <span>Add Bullet</span>
                  </button>
                )}
              </div>

              {bullets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-edge/80 bg-well/30 p-5 text-center text-xs text-muted font-mono space-y-2">
                  <p>No contributions recorded for this subsystem yet.</p>
                  {product?.id && onAddBullet && (
                    <button
                      type="button"
                      onClick={() => onAddBullet(product.id)}
                      className="text-signal hover:underline font-bold"
                    >
                      + Add First Bullet
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {bullets.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => onSelectBullet && onSelectBullet(b)}
                      className="p-3 rounded-xl border border-edge/80 bg-card hover:border-signal/50 hover:bg-surface/50 transition-all cursor-pointer group space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <span
                            className={`block h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${
                              b.review_status === 'approved'
                                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                                : b.review_status === 'needs_review'
                                ? 'bg-amber-400'
                                : 'bg-muted/60'
                            }`}
                          />
                          <p className="font-sans text-xs text-content/90 leading-relaxed group-hover:text-content">
                            {b.bullet_text}
                          </p>
                        </div>
                        <span className="text-muted group-hover:text-signal p-0.5 shrink-0">
                          <Icon.ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </div>

                      {/* Detected metric / trade-off indicator */}
                      {(b.metric_primary || b.context_challenge) && (
                        <div className="flex items-center gap-2 pl-3.5 pt-0.5 text-[10px] font-mono">
                          {b.metric_primary && (
                            <span className="rounded bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.2 text-emerald-500 font-bold">
                              {b.metric_primary}
                            </span>
                          )}
                          {b.context_challenge && (
                            <span className="text-muted/80 flex items-center gap-1">
                              <Icon.Shield className="h-3 w-3 text-signal" />
                              <span>Defense loaded</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Edit Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Product or Subsystem Title" required description="e.g. Research and Development Engineer Initiatives, Serviceguard Metrocluster High Availability">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Serviceguard Metrocluster High Availability"
                required
                autoFocus
                className="font-mono text-sm"
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
                  placeholder="e.g. Disaster Recovery & Cluster Quorum Engine"
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
                Subtle monochrome chips displayed at the Product level (e.g. C++, Shell Script, 3PAR Storage, EVA).
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
                  placeholder="Type tech and press Enter (e.g. C++, Shell, Oracle)"
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
                  placeholder="e.g. https://hpe.com/serviceguard"
                  className="font-mono text-xs"
                />
              </FormField>
            </div>
          </form>
        )}
      </div>

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
          {activeTab === 'overview' && isEditing ? (
            <button
              type="button"
              onClick={() => setActiveTab('edit')}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-signal/15 hover:bg-signal/25 text-signal border border-signal/30 font-mono text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Icon.Pencil className="h-3.5 w-3.5" />
              <span>Edit Subsystem</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => isEditing ? setActiveTab('overview') : onClose()}
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
            </>
          )}
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
  companyName,
  bullet,
  onClose,
  onSaved,
  onDeleteRequest,
  onBackToProduct,
}: {
  productId?: string;
  projectId?: string;
  parentProduct?: PortfolioProduct;
  parentProject?: PortfolioProject;
  companyName?: string;
  bullet?: MasterBullet;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleteRequest?: (item: { type: 'bullet'; id: string; title: string }) => void;
  onBackToProduct?: () => void;
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
          <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 shrink-0">
            <Icon.Sparkle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px] text-muted">
              {parentProduct && onBackToProduct ? (
                <button
                  type="button"
                  onClick={onBackToProduct}
                  className="font-bold text-signal hover:underline cursor-pointer"
                >
                  {parentProduct.name}
                </button>
              ) : companyName ? (
                <span>{companyName}</span>
              ) : null}
              {(parentProduct || companyName) && <span className="text-muted/40">/</span>}
              <span className="uppercase font-bold tracking-wider text-emerald-500">
                Master Contribution
              </span>
            </div>
            <h2 className="font-mono text-base font-bold text-content truncate mt-0.5">
              {isEditing ? 'Contribution & Architecture Defense' : 'New Master Bullet'}
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
            placeholder="e.g. Extended disaster recovery solutions in Serviceguard to ensure high availability for metrocluster using huge storage arrays..."
            required
            autoFocus
            className="font-sans leading-relaxed text-sm"
          />
        </div>

        {/* Metric & Action Verb Dual Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Action Verb" description="e.g. Extended, Released, Reduced">
            <TextInput
              value={actionVerb}
              onChange={(e) => setActionVerb(e.target.value)}
              placeholder="e.g. Extended"
              className="font-mono text-xs"
            />
          </FormField>

          <FormField label="Primary Quantified Metric" description="e.g. 70%, 45k req/s, 3PAR">
            <TextInput
              value={metricPrimary}
              onChange={(e) => setMetricPrimary(e.target.value)}
              placeholder="e.g. 70% reduction in manual testing"
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

          <FormField label="Engineering Challenge / Complexity" description="What made this problem non-trivial? High concurrency, scale, disaster recovery?">
            <TextArea
              value={contextChallenge}
              onChange={(e) => setContextChallenge(e.target.value)}
              rows={2}
              placeholder="e.g. Synchronization between metroclusters separated by 50km required sub-10ms heartbeat quorum."
              className="font-sans text-xs"
            />
          </FormField>

          <FormField label="Trade-Off Defense & Alternatives Considered" description="Why this design over alternatives? What were the downsides or trade-offs?">
            <TextArea
              value={defenseNotes}
              onChange={(e) => setDefenseNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Chose asynchronous 3PAR replication over synchronous commit to prevent I/O blocking during fiber disruptions."
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
  onSelectBullet,
  onAddBullet,
}: {
  project?: PortfolioProject;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleteRequest?: (item: { type: 'project'; id: string; title: string }) => void;
  onSelectBullet?: (bullet: MasterBullet) => void;
  onAddBullet?: (projectId: string) => void;
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
          <span className="p-2 rounded-xl bg-sky-500/15 text-sky-500 border border-sky-500/25 shrink-0">
            <Icon.Code className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-sky-500">
                Standalone Project
              </span>
              <span className="text-muted/40">•</span>
              <span className="font-mono text-[11px] text-muted">
                {project?.bullets?.length || 0} master bullets
              </span>
            </div>
            <h2 className="font-mono text-base sm:text-lg font-bold text-content break-words leading-tight mt-0.5">
              {name.trim() || (isEditing ? project?.name : 'New Project')}
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
