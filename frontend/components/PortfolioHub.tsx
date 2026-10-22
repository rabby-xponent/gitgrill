'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/icons';
import {
  PortfolioSSOT,
  PortfolioCompany,
  PortfolioProduct,
  PortfolioProject,
  MasterBullet,
  fetchPortfolio,
  saveCompany,
  deleteCompany,
  saveProduct,
  deleteProduct,
  saveProject,
  deleteProject,
  saveBullet,
  deleteBullet,
  bootstrapPortfolioFromResume,
  normalizeDateToISO,
  formatISODateToDisplay,
  humanizePortfolioError,
  getStoredCompanyRoles,
} from '@/lib/portfolio';
import {
  getResumes,
  ResumeProfile,
  saveResume,
  extractDocxText,
  extractPdfText,
  parseUploadedResumeText,
} from '@/lib/resumes';
import {
  ConfirmModal,
  AlertModal,
  Checkbox,
  Select,
  FormField,
  TextInput,
  TextArea,
  SearchInput,
  type SelectOption,
} from '@/components/ui';

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

const REVIEW_STATUS_OPTIONS: SelectOption[] = [
  { value: 'approved', label: 'Approved (Verified & Ready for Resumes)', description: 'Production metric validated and ready to query' },
  { value: 'needs_review', label: 'Needs Review (Missing Metrics or Details)', description: 'Requires quantification or architecture defense context' },
  { value: 'draft', label: 'Draft (Work in Progress)', description: 'Preliminary bullet draft still undergoing iteration' },
];

export function PortfolioHub() {
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<PortfolioSSOT>({
    companies: [],
    standalone_projects: [],
    unattached_bullets: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterReviewStatus, setFilterReviewStatus] = useState<'all' | 'approved' | 'needs_review' | 'draft'>('all');

  // Modals state
  const [companyModal, setCompanyModal] = useState<{ isOpen: boolean; company?: PortfolioCompany } | null>(null);
  const [productModal, setProductModal] = useState<{ isOpen: boolean; companyId: string; product?: PortfolioProduct } | null>(null);
  const [projectModal, setProjectModal] = useState<{ isOpen: boolean; project?: PortfolioProject } | null>(null);
  const [bulletModal, setBulletModal] = useState<{
    isOpen: boolean;
    productId?: string;
    projectId?: string;
    bullet?: MasterBullet;
  } | null>(null);
  const [importModal, setImportModal] = useState<{ isOpen: boolean } | null>(null);

  // Deletion confirm modals
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'company' | 'product' | 'project' | 'bullet';
    id: string;
    title: string;
  } | null>(null);

  // Alert modal
  const [alertState, setAlertState] = useState<{ isOpen: boolean; title: string; description: string; variant?: 'info' | 'error' | 'warning' }>({
    isOpen: false,
    title: '',
    description: '',
  });

  // Capabilities & Workflow Guide state (persisted dismiss, re-openable anytime)
  const GUIDE_DISMISSED_KEY = 'gitgrill_portfolio_capabilities_guide_dismissed_v1';
  const [showCapabilitiesGuide, setShowCapabilitiesGuide] = useState(false);

  useEffect(() => {
    try {
      const isDismissed = localStorage.getItem(GUIDE_DISMISSED_KEY);
      if (!isDismissed) {
        setShowCapabilitiesGuide(true);
      }
    } catch {}
  }, []);

  const handleDismissGuide = () => {
    setShowCapabilitiesGuide(false);
    try {
      localStorage.setItem(GUIDE_DISMISSED_KEY, 'true');
    } catch {}
  };

  // Collapsible hierarchy states for companies, products & projects
  const [collapsedCompanies, setCollapsedCompanies] = useState<Record<string, boolean>>({});
  const [collapsedProducts, setCollapsedProducts] = useState<Record<string, boolean>>({});
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});

  const toggleCompany = (id: string) => {
    setCollapsedCompanies((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleProduct = (id: string) => {
    setCollapsedProducts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleProject = (id: string) => {
    setCollapsedProjects((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allProductIds = useMemo(() => {
    return portfolio.companies.flatMap((c) => (c.products || []).map((p) => p.id));
  }, [portfolio.companies]);

  const areAllProductsCollapsed = useMemo(() => {
    if (allProductIds.length === 0) return false;
    return allProductIds.every((id) => collapsedProducts[id]);
  }, [allProductIds, collapsedProducts]);

  const toggleAllProducts = () => {
    if (areAllProductsCollapsed) {
      setCollapsedProducts({});
    } else {
      const next: Record<string, boolean> = {};
      allProductIds.forEach((id) => { next[id] = true; });
      setCollapsedProducts(next);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchPortfolio();
      setPortfolio(data);
    } catch (err: any) {
      console.error('Failed to load portfolio', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Stats computation
  const stats = useMemo(() => {
    const totalCompanies = portfolio.companies.length;
    const totalProducts = portfolio.companies.reduce((sum, c) => sum + (c.products?.length || 0), 0);
    const totalProjects = portfolio.standalone_projects.length;
    let totalBullets = 0;
    let approvedBullets = 0;
    let bulletsWithMetrics = 0;

    const countBullet = (b: MasterBullet) => {
      totalBullets++;
      if (b.review_status === 'approved') approvedBullets++;
      if (b.metric_primary || /(\d+[%kKmMbBxX]|\b\d+\s*(ms|seconds|minutes|hours|days|x|users|req\/s|rps|queries|events)\b|\$\d+)/.test(b.bullet_text)) {
        bulletsWithMetrics++;
      }
    };

    portfolio.companies.forEach((c) => c.products?.forEach((p) => p.bullets?.forEach(countBullet)));
    portfolio.standalone_projects.forEach((pr) => pr.bullets?.forEach(countBullet));
    portfolio.unattached_bullets.forEach(countBullet);

    const metricDensity = totalBullets > 0 ? Math.round((bulletsWithMetrics / totalBullets) * 100) : 0;

    return {
      totalCompanies,
      totalProducts,
      totalProjects,
      totalBullets,
      approvedBullets,
      bulletsWithMetrics,
      metricDensity,
    };
  }, [portfolio]);

  // Filtering
  const filteredCompanies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q && filterReviewStatus === 'all') return portfolio.companies;

    return portfolio.companies
      .map((c) => {
        const matchesComp = c.name.toLowerCase().includes(q) || (c.role_title && c.role_title.toLowerCase().includes(q));
        const filteredProds = (c.products || []).filter((p) => {
          const matchesProd = p.name.toLowerCase().includes(q) || (p.architecture_type && p.architecture_type.toLowerCase().includes(q));
          const matchesBullets = (p.bullets || []).some((b) => {
            const matchesText = b.bullet_text.toLowerCase().includes(q) || (b.tech_stack || []).some((t) => t.toLowerCase().includes(q));
            const matchesStatus = filterReviewStatus === 'all' || b.review_status === filterReviewStatus;
            return matchesText && matchesStatus;
          });
          return matchesProd || matchesBullets;
        });

        if (matchesComp || filteredProds.length > 0) {
          return { ...c, products: filteredProds.length > 0 ? filteredProds : c.products };
        }
        return null;
      })
      .filter(Boolean) as PortfolioCompany[];
  }, [portfolio.companies, searchQuery, filterReviewStatus]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q && filterReviewStatus === 'all') return portfolio.standalone_projects;

    return portfolio.standalone_projects.filter((p) => {
      const matchesText = p.name.toLowerCase().includes(q) || (p.headline && p.headline.toLowerCase().includes(q));
      const matchesBullets = (p.bullets || []).some((b) => {
        const matchesBText = b.bullet_text.toLowerCase().includes(q) || (b.tech_stack || []).some((t) => t.toLowerCase().includes(q));
        const matchesStatus = filterReviewStatus === 'all' || b.review_status === filterReviewStatus;
        return matchesBText && matchesStatus;
      });
      return matchesText || matchesBullets;
    });
  }, [portfolio.standalone_projects, searchQuery, filterReviewStatus]);

  // Handle Deletions
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      if (itemToDelete.type === 'company') {
        await deleteCompany(itemToDelete.id);
      } else if (itemToDelete.type === 'product') {
        await deleteProduct(itemToDelete.id);
      } else if (itemToDelete.type === 'project') {
        await deleteProject(itemToDelete.id);
      } else if (itemToDelete.type === 'bullet') {
        await deleteBullet(itemToDelete.id);
      }
      await loadData();
    } catch (err: any) {
      setAlertState({
        isOpen: true,
        title: 'Delete Failed',
        description: err.message || 'Could not delete item.',
        variant: 'error',
      });
    } finally {
      setItemToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner / Decoupled SSOT Concept */}
      <div className="relative overflow-hidden rounded-2xl border border-edge bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-signal/30 bg-signal/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-signal uppercase tracking-wider">
                <Icon.Layers className="h-3 w-3" />
                Decoupled SSOT
              </span>
              <span className="font-mono text-xs text-muted">
                Living Career Operating System
              </span>
            </div>
            <h1 className="font-mono text-xl sm:text-2xl font-black tracking-tight text-content">
              Engineering Master Portfolio
            </h1>
            <p className="font-sans text-xs sm:text-sm text-muted">
              Central source of truth for your systems, products, and quantified engineering impact.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowCapabilitiesGuide((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                showCapabilitiesGuide
                  ? 'border-signal bg-signal/15 text-signal font-bold'
                  : 'border-edge bg-card text-muted hover:text-content hover:bg-muted/10'
              }`}
              title="Toggle Portfolio Capabilities Guide"
            >
              <Icon.Sparkle className="h-3.5 w-3.5 text-signal" />
              <span>Capabilities</span>
            </button>
            <button
              onClick={() => setImportModal({ isOpen: true })}
              className="inline-flex items-center gap-2 rounded-xl border border-signal/40 bg-signal/10 hover:bg-signal/20 px-4 py-2 font-mono text-xs font-bold text-signal transition-all shadow-xs cursor-pointer"
            >
              <Icon.Sparkle className="h-4 w-4" />
              <span>Import from Resume</span>
            </button>
            <button
              onClick={() => setCompanyModal({ isOpen: true })}
              className="inline-flex items-center gap-2 rounded-xl bg-signal hover:bg-signal-hover text-surface px-4 py-2 font-mono text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Icon.Plus className="h-4 w-4" />
              <span>Add Company</span>
            </button>
            <button
              onClick={() => setProjectModal({ isOpen: true })}
              className="inline-flex items-center gap-2 rounded-xl border border-edge bg-card hover:bg-muted/10 text-content px-3.5 py-2 font-mono text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              <Icon.Code className="h-4 w-4 text-muted" />
              <span>Add Standalone Project</span>
            </button>
          </div>
        </div>

        {/* 3-Pillar Superpowers & Capabilities Interactive Banner */}
        {showCapabilitiesGuide && (
          <div className="mt-5 rounded-2xl border border-signal/30 bg-signal/5 p-4 sm:p-5 relative animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-signal/20">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-signal/15 text-signal font-mono text-xs font-bold">
                  ⚡
                </span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-content">
                  Portfolio Superpowers — How Your Master SSOT Powers Your Career
                </span>
              </div>
              <button
                type="button"
                onClick={handleDismissGuide}
                className="rounded-lg px-2 py-1 text-muted hover:text-content text-xs font-mono inline-flex items-center gap-1 cursor-pointer transition-colors hover:bg-signal/10"
              >
                <span>Dismiss</span>
                <Icon.X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Pillar 1 */}
              <div className="rounded-xl border border-edge/80 bg-card/85 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-well text-signal font-mono text-xs font-bold">
                    01
                  </div>
                  <span className="font-mono text-xs font-bold text-content">
                    Hierarchical SSOT
                  </span>
                </div>
                <p className="font-sans text-xs text-muted leading-relaxed">
                  Structure your experience hierarchically: <span className="font-mono text-content font-semibold">Company</span> → <span className="font-mono text-content font-semibold">Products & Modules</span> owned → <span className="font-mono text-content font-semibold">Atomic Bullets</span>.
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCompanyModal({ isOpen: true })}
                    className="text-[11px] font-mono text-signal hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Add Company</span>
                  </button>
                  <span className="text-muted text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={() => setImportModal({ isOpen: true })}
                    className="text-[11px] font-mono text-muted hover:text-content font-semibold cursor-pointer"
                  >
                    Import CV
                  </button>
                </div>
              </div>

              {/* Pillar 2 */}
              <div className="rounded-xl border border-edge/80 bg-card/85 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-well text-signal font-mono text-xs font-bold">
                    02
                  </div>
                  <span className="font-mono text-xs font-bold text-content">
                    Metric Bullets & Defense
                  </span>
                </div>
                <p className="font-sans text-xs text-muted leading-relaxed">
                  Record battle-tested engineering bullets with action verbs, quantifiable metrics, and architectural trade-off context for technical interviews.
                </p>
                <div className="pt-1">
                  <span className="text-[11px] font-mono text-muted">
                    Click <span className="text-signal font-semibold">+ Add Bullet</span> on any product
                  </span>
                </div>
              </div>

              {/* Pillar 3 */}
              <div className="rounded-xl border border-edge/80 bg-card/85 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-well text-signal font-mono text-xs font-bold">
                    03
                  </div>
                  <span className="font-mono text-xs font-bold text-content">
                    Dynamic Resume Branching
                  </span>
                </div>
                <p className="font-sans text-xs text-muted leading-relaxed">
                  Never write a CV from scratch. Your verified master bullets are queried and assembled into role-tailored variants in the Resume Vault.
                </p>
                <div className="pt-1">
                  <a
                    href="/developer/resumes"
                    className="text-[11px] font-mono text-signal hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Open Resume Vault</span>
                    <Icon.ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4-Dimension Metric Stats Strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-5 border-t border-edge/60">
          <div className="rounded-xl border border-edge/60 bg-surface/50 p-3.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
              Companies / Orgs
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-extrabold text-content">{stats.totalCompanies}</span>
              <span className="font-mono text-[11px] text-muted">{stats.totalProducts} products</span>
            </div>
          </div>

          <div className="rounded-xl border border-edge/60 bg-surface/50 p-3.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
              Standalone Projects
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-extrabold text-content">{stats.totalProjects}</span>
              <span className="font-mono text-[11px] text-muted">open-source / repos</span>
            </div>
          </div>

          <div className="rounded-xl border border-edge/60 bg-surface/50 p-3.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
              Master Bullets
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-extrabold text-content">{stats.totalBullets}</span>
              <span className="font-mono text-[11px] text-signal font-semibold">
                {stats.approvedBullets} approved
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-edge/60 bg-surface/50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
                Metric Density
              </span>
              <span className="font-mono text-[10px] text-signal font-bold">{stats.metricDensity}%</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-edge">
              <div
                className="h-full rounded-full bg-signal transition-all duration-500"
                style={{ width: `${stats.metricDensity}%` }}
              />
            </div>
            <div className="mt-1.5 font-mono text-[10px] text-muted">
              {stats.bulletsWithMetrics} / {stats.totalBullets} bullets quantify impact
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by company, tech stack, architecture, or metric..."
          className="w-full max-w-md py-1"
        />

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted uppercase font-bold shrink-0">Status:</span>
          {(['all', 'approved', 'needs_review', 'draft'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterReviewStatus(status)}
              className={`rounded-lg px-2.5 py-1 font-mono text-xs font-semibold capitalize transition-all cursor-pointer ${
                filterReviewStatus === status
                  ? 'border border-signal/40 bg-signal/10 text-signal'
                  : 'border border-transparent text-muted hover:border-edge hover:bg-card hover:text-content'
              }`}
            >
              {status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="rounded-2xl border border-edge bg-card p-12 text-center">
          <Icon.Spinner className="mx-auto h-6 w-6 animate-spin text-signal" />
          <p className="mt-3 font-mono text-xs text-muted">Loading Living Portfolio SSOT...</p>
        </div>
      ) : portfolio.companies.length === 0 && portfolio.standalone_projects.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-edge bg-card/50 p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-signal/10 text-signal border border-signal/20">
            <Icon.Layers className="h-7 w-7" />
          </div>
          <h3 className="mt-4 font-mono text-base font-bold text-content">
            Your Living Portfolio SSOT is Empty
          </h3>
          <p className="mx-auto mt-2 max-w-md font-sans text-xs text-muted leading-relaxed">
            Stop pasting the same experience into separate resume files. Bootstrap your master portfolio from an uploaded resume in 1 click, or start building your structured company and subsystem ledger.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setImportModal({ isOpen: true })}
              className="inline-flex items-center gap-2 rounded-xl bg-signal hover:bg-signal-hover text-surface px-4 py-2 font-mono text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Icon.Sparkle className="h-4 w-4" />
              <span>1-Click Bootstrap from Resume</span>
            </button>
            <button
              onClick={() => setCompanyModal({ isOpen: true })}
              className="inline-flex items-center gap-2 rounded-xl border border-edge bg-card hover:bg-muted/10 text-content px-4 py-2 font-mono text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Icon.Plus className="h-4 w-4 text-muted" />
              <span>Add First Company</span>
            </button>
          </div>
        </div>
      ) : (
        /* Active Portfolio List */
        <div className="space-y-6">
          {/* Companies Hierarchy */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                <Icon.Building className="h-4 w-4 text-signal" />
                <span>Companies & Products Hierarchy ({filteredCompanies.length})</span>
              </h2>
              <div className="flex items-center gap-3">
                {allProductIds.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllProducts}
                    className="font-mono text-xs text-muted hover:text-signal transition-colors flex items-center gap-1 cursor-pointer"
                    title="Toggle all products expanded or collapsed"
                  >
                    <Icon.ChevronDown className={`h-3.5 w-3.5 transition-transform ${areAllProductsCollapsed ? '-rotate-90' : ''}`} />
                    <span>{areAllProductsCollapsed ? 'Expand All Products' : 'Collapse All Products'}</span>
                  </button>
                )}
                <button
                  onClick={() => setCompanyModal({ isOpen: true })}
                  className="font-mono text-xs text-signal hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Icon.Plus className="h-3.5 w-3.5" />
                  <span>Add Company</span>
                </button>
              </div>
            </div>

            {filteredCompanies.length === 0 ? (
              <div className="rounded-xl border border-edge bg-card p-6 text-center text-xs text-muted font-mono">
                No companies match your search or filter.
              </div>
            ) : (
              filteredCompanies.map((company) => {
                const isCompanyCollapsed = Boolean(collapsedCompanies[company.id]);
                const compBulletsCount = (company.products || []).reduce((sum, p) => sum + (p.bullets?.length || 0), 0);

                return (
                  <div
                    key={company.id}
                    className="rounded-2xl border border-edge bg-card overflow-hidden shadow-card transition-all"
                  >
                    {/* Company Header */}
                    <div className="p-4 sm:p-5 border-b border-edge/60 bg-surface/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div
                        onClick={() => toggleCompany(company.id)}
                        className="space-y-1 cursor-pointer select-none flex-1 group"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            className="text-muted group-hover:text-signal transition-colors p-0.5"
                            title={isCompanyCollapsed ? 'Expand company' : 'Collapse company'}
                          >
                            <Icon.ChevronDown className={`h-4 w-4 transition-transform ${isCompanyCollapsed ? '-rotate-90' : ''}`} />
                          </button>
                          <span className="font-mono text-base sm:text-lg font-black text-content group-hover:text-signal transition-colors">
                            {company.name}
                          </span>
                          {company.is_current && (
                            <span className="rounded-full bg-signal/20 px-2 py-0.5 font-mono text-[10px] font-bold text-signal uppercase tracking-wider">
                              Present
                            </span>
                          )}
                          <span className="rounded-md border border-edge bg-surface/80 px-2 py-0.5 font-mono text-[10px] text-muted font-medium">
                            {company.products?.length || 0} {company.products?.length === 1 ? 'product' : 'products'} · {compBulletsCount} {compBulletsCount === 1 ? 'bullet' : 'bullets'}
                          </span>
                          {(company.domain || company.website_url) && (
                            <a
                              href={(company.domain || company.website_url)!.startsWith('http') ? (company.domain || company.website_url)! : `https://${company.domain || company.website_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono text-xs text-muted hover:text-signal flex items-center gap-1"
                            >
                              <span>{(company.domain || company.website_url)!.replace(/^https?:\/\//, '')}</span>
                              <Icon.ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted font-mono flex-wrap pl-6">
                          {company.role_title && <span className="text-content font-medium">{company.role_title}</span>}
                          {(company.start_date || company.end_date) && (
                            <span>{company.role_title ? '· ' : ''}{formatISODateToDisplay(company.start_date)} — {company.is_current ? 'Present' : formatISODateToDisplay(company.end_date)}</span>
                          )}
                          {company.location && <span>· {company.location}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setProductModal({ isOpen: true, companyId: company.id })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-edge bg-surface hover:border-signal hover:text-signal px-3 py-1.5 font-mono text-xs font-semibold text-content transition-all cursor-pointer"
                        >
                          <Icon.Plus className="h-3.5 w-3.5" />
                          <span>Add Product</span>
                        </button>
                        <button
                          onClick={() => setCompanyModal({ isOpen: true, company })}
                          className="rounded-lg border border-edge bg-surface hover:border-edge/80 p-1.5 text-muted hover:text-content transition-all cursor-pointer"
                          title="Edit Company"
                        >
                          <Icon.Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setItemToDelete({ type: 'company', id: company.id, title: company.name })}
                          className="rounded-lg border border-edge bg-surface hover:border-red-500/40 hover:text-red-400 p-1.5 text-muted transition-all cursor-pointer"
                          title="Delete Company"
                        >
                          <Icon.Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Company Products */}
                    {!isCompanyCollapsed && (
                      <div className="p-4 sm:p-5 space-y-3">
                        {!company.products || company.products.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-edge/60 p-4 text-center">
                            <p className="font-mono text-xs text-muted">No products or sub-systems recorded for this company yet.</p>
                            <button
                              onClick={() => setProductModal({ isOpen: true, companyId: company.id })}
                              className="mt-2 font-mono text-xs text-signal font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Icon.Plus className="h-3.5 w-3.5" />
                              <span>Define First Product / Module</span>
                            </button>
                          </div>
                        ) : (
                          company.products.map((product) => {
                            const isProdCollapsed = Boolean(collapsedProducts[product.id]);
                            const bulletCount = product.bullets?.length || 0;

                            return (
                              <div
                                key={product.id}
                                className="rounded-xl border border-edge/70 bg-card/60 overflow-hidden shadow-xs transition-all"
                              >
                                {/* Product Header Row (Click to toggle collapse) */}
                                <div
                                  onClick={() => toggleProduct(product.id)}
                                  className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 cursor-pointer select-none hover:bg-surface/40 transition-colors ${
                                    !isProdCollapsed ? 'border-b border-edge/50 bg-surface/20' : ''
                                  }`}
                                >
                                  <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <button
                                        type="button"
                                        className="text-muted hover:text-signal transition-colors p-0.5"
                                        title={isProdCollapsed ? 'Expand product bullets' : 'Collapse product bullets'}
                                      >
                                        <Icon.ChevronDown className={`h-3.5 w-3.5 transition-transform ${isProdCollapsed ? '-rotate-90' : ''}`} />
                                      </button>
                                      <span className="font-mono text-sm font-bold text-content">
                                        {product.name || (product as any).title || 'Untitled Subsystem'}
                                      </span>
                                      {(product.architecture_type || (product as any).architectural_notes) && (
                                        <span className="rounded-md border border-edge bg-surface px-2 py-0.5 font-mono text-[10px] font-bold text-muted uppercase">
                                          {String(product.architecture_type || (product as any).architectural_notes).replace(/_/g, ' ')}
                                        </span>
                                      )}
                                      <span className="rounded-full bg-signal/15 px-2 py-0.5 font-mono text-[10px] font-bold text-signal">
                                        {bulletCount} {bulletCount === 1 ? 'bullet' : 'bullets'}
                                      </span>
                                      {(product.repo_url || (Array.isArray((product as any).repo_links) && (product as any).repo_links[0]?.url)) && (
                                        <a
                                          href={product.repo_url || (product as any).repo_links[0].url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-muted hover:text-signal p-0.5"
                                          title="Repository"
                                        >
                                          <Icon.Github className="h-3.5 w-3.5" />
                                        </a>
                                      )}
                                      {(product.live_url || (typeof (product as any).description === 'string' && (product as any).description.startsWith('Live: ') ? (product as any).description.slice(6) : null)) && (
                                        <a
                                          href={product.live_url || (product as any).description.slice(6)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="text-muted hover:text-signal p-0.5"
                                          title="Live URL"
                                        >
                                          <Icon.ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      )}
                                    </div>

                                    {/* Core Tech Stack Badges */}
                                    {product.tech_stack && product.tech_stack.length > 0 && (
                                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5 pl-5">
                                        {product.tech_stack.map((tech) => (
                                          <span
                                            key={tech}
                                            className="rounded bg-edge/40 px-1.5 py-0.5 font-mono text-[10px] text-content/85 font-medium border border-edge/60"
                                          >
                                            {tech}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1.5 shrink-0 pt-0.5"
                                  >
                                    <button
                                      onClick={() => setBulletModal({ isOpen: true, productId: product.id })}
                                      className="inline-flex items-center gap-1 rounded-md border border-signal/30 bg-signal/5 hover:bg-signal/15 px-2.5 py-1 font-mono text-[11px] font-semibold text-signal transition-all cursor-pointer"
                                    >
                                      <Icon.Plus className="h-3 w-3" />
                                      <span>Add Bullet</span>
                                    </button>
                                    <button
                                      onClick={() => setProductModal({ isOpen: true, companyId: company.id, product })}
                                      className="rounded-md p-1 text-muted hover:text-content hover:bg-surface transition-all cursor-pointer"
                                      title="Edit Product"
                                    >
                                      <Icon.Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setItemToDelete({ type: 'product', id: product.id, title: product.name })}
                                      className="rounded-md p-1 text-muted hover:text-red-400 hover:bg-surface transition-all cursor-pointer"
                                      title="Delete Product"
                                    >
                                      <Icon.Trash className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Bullets List (Rendered when expanded) */}
                                {!isProdCollapsed && (
                                  <div className="p-3.5 space-y-2.5">
                                    {!product.bullets || product.bullets.length === 0 ? (
                                      <div className="rounded-xl border border-dashed border-edge/80 bg-surface/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                                        <div className="space-y-0.5">
                                          <div className="flex items-center gap-1.5">
                                            <Icon.Sparkle className="h-3.5 w-3.5 text-signal" />
                                            <span className="font-mono text-xs font-bold text-content">No atomic bullets added yet</span>
                                          </div>
                                          <p className="font-sans text-[11px] text-muted max-w-lg leading-relaxed">
                                            Quantify contributions for <span className="font-mono text-content font-semibold">{product.name || (product as any).title}</span> with metrics, action verbs, and interview defense rationale.
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => setBulletModal({ isOpen: true, productId: product.id })}
                                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-signal/10 hover:bg-signal/20 text-signal border border-signal/30 px-3 py-1 font-mono text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                                        >
                                          <Icon.Plus className="h-3 w-3" />
                                          <span>Add First Bullet</span>
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="space-y-2.5 pt-1">
                                        {product.bullets.map((b) => (
                                          <BulletItem
                                            key={b.id}
                                            bullet={b}
                                            onEdit={() => setBulletModal({ isOpen: true, productId: product.id, bullet: b })}
                                            onDelete={() => setItemToDelete({ type: 'bullet', id: b.id, title: 'bullet' })}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Standalone Projects Section */}
          <div className="space-y-4 pt-4 border-t border-edge">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                <Icon.Code className="h-4 w-4 text-signal" />
                <span>Standalone & Open-Source Projects ({filteredProjects.length})</span>
              </h2>
              <button
                onClick={() => setProjectModal({ isOpen: true })}
                className="font-mono text-xs text-signal hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Icon.Plus className="h-3.5 w-3.5" />
                <span>Add Project</span>
              </button>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-edge/60 p-6 text-center">
                <p className="font-mono text-xs text-muted">No standalone or open-source projects recorded.</p>
              </div>
            ) : (
              filteredProjects.map((proj) => {
                const isProjCollapsed = Boolean(collapsedProjects[proj.id]);
                const projBulletCount = proj.bullets?.length || 0;

                return (
                  <div
                    key={proj.id}
                    className="rounded-2xl border border-edge bg-card overflow-hidden shadow-card transition-all"
                  >
                    {/* Project Header Row (Click to toggle collapse) */}
                    <div
                      onClick={() => toggleProject(proj.id)}
                      className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-surface/30 transition-colors ${
                        !isProjCollapsed ? 'border-b border-edge/60 bg-surface/20' : ''
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            className="text-muted hover:text-signal transition-colors p-0.5"
                            title={isProjCollapsed ? 'Expand project bullets' : 'Collapse project bullets'}
                          >
                            <Icon.ChevronDown className={`h-4 w-4 transition-transform ${isProjCollapsed ? '-rotate-90' : ''}`} />
                          </button>
                          <span className="font-mono text-base font-bold text-content">{proj.name}</span>
                          <span className="rounded-full bg-signal/15 px-2 py-0.5 font-mono text-[10px] font-bold text-signal">
                            {projBulletCount} {projBulletCount === 1 ? 'bullet' : 'bullets'}
                          </span>
                          {proj.repo_url && (
                            <a
                              href={proj.repo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted hover:text-signal p-0.5"
                              title="GitHub Repository"
                            >
                              <Icon.Github className="h-4 w-4" />
                            </a>
                          )}
                          {proj.live_url && (
                            <a
                              href={proj.live_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted hover:text-signal p-0.5"
                              title="Live Project URL"
                            >
                              <Icon.ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        {proj.headline && (
                          <p className="font-sans text-xs text-muted pl-6">{proj.headline}</p>
                        )}
                        {proj.tech_stack && proj.tech_stack.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5 pl-6">
                            {proj.tech_stack.map((tech) => (
                              <span
                                key={tech}
                                className="rounded bg-edge/40 px-1.5 py-0.5 font-mono text-[10px] text-content/85 font-medium border border-edge/60"
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 shrink-0"
                      >
                        <button
                          onClick={() => setBulletModal({ isOpen: true, projectId: proj.id })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-signal/30 bg-signal/5 hover:bg-signal/15 px-3 py-1 font-mono text-xs font-semibold text-signal transition-all cursor-pointer"
                        >
                          <Icon.Plus className="h-3.5 w-3.5" />
                          <span>Add Bullet</span>
                        </button>
                        <button
                          onClick={() => setProjectModal({ isOpen: true, project: proj })}
                          className="rounded-lg border border-edge bg-surface hover:border-edge/80 p-1.5 text-muted hover:text-content transition-all cursor-pointer"
                          title="Edit Project"
                        >
                          <Icon.Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setItemToDelete({ type: 'project', id: proj.id, title: proj.name })}
                          className="rounded-lg border border-edge bg-surface hover:border-red-500/40 hover:text-red-400 p-1.5 text-muted transition-all cursor-pointer"
                          title="Delete Project"
                        >
                          <Icon.Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Bullets List (Rendered when expanded) */}
                    {!isProjCollapsed && (
                      <div className="p-4 sm:p-5 space-y-3">
                        {!proj.bullets || proj.bullets.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-edge/80 bg-surface/30 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <Icon.Sparkle className="h-3.5 w-3.5 text-signal" />
                                <span className="font-mono text-xs font-bold text-content">No project bullets added yet</span>
                              </div>
                              <p className="font-sans text-[11px] text-muted max-w-lg leading-relaxed">
                                Highlight technical architectural choices, starred repos, or performance optimizations for <span className="font-mono text-content font-semibold">{proj.name}</span>.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setBulletModal({ isOpen: true, projectId: proj.id })}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-signal/10 hover:bg-signal/20 text-signal border border-signal/30 px-3 py-1 font-mono text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
                            >
                              <Icon.Plus className="h-3 w-3" />
                              <span>Add First Bullet</span>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2.5 pt-1">
                            {proj.bullets.map((b) => (
                              <BulletItem
                                key={b.id}
                                bullet={b}
                                onEdit={() => setBulletModal({ isOpen: true, projectId: proj.id, bullet: b })}
                                onDelete={() => setItemToDelete({ type: 'bullet', id: b.id, title: 'bullet' })}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* --- MODALS --- */}

      {/* 1. Company Modal */}
      {companyModal?.isOpen && (
        <CompanyEditModal
          company={companyModal.company}
          onClose={() => setCompanyModal(null)}
          onSaved={async () => {
            setCompanyModal(null);
            await loadData();
          }}
        />
      )}

      {/* 2. Product Modal */}
      {productModal?.isOpen && (
        <ProductEditModal
          companyId={productModal.companyId}
          companyRole={portfolio.companies.find((c) => c.id === productModal.companyId)?.role_title}
          product={productModal.product}
          onClose={() => setProductModal(null)}
          onSaved={async () => {
            setProductModal(null);
            await loadData();
          }}
        />
      )}

      {/* 3. Standalone Project Modal */}
      {projectModal?.isOpen && (
        <ProjectEditModal
          project={projectModal.project}
          onClose={() => setProjectModal(null)}
          onSaved={async () => {
            setProjectModal(null);
            await loadData();
          }}
        />
      )}

      {/* 4. Master Bullet Modal */}
      {bulletModal?.isOpen && (
        <BulletEditModal
          productId={bulletModal.productId}
          projectId={bulletModal.projectId}
          parentProduct={
            bulletModal.productId
              ? portfolio.companies.flatMap((c) => c.products || []).find((p) => p.id === bulletModal.productId)
              : undefined
          }
          parentProject={
            bulletModal.projectId
              ? portfolio.standalone_projects.find((p) => p.id === bulletModal.projectId)
              : undefined
          }
          bullet={bulletModal.bullet}
          onClose={() => setBulletModal(null)}
          onSaved={async () => {
            setBulletModal(null);
            await loadData();
          }}
        />
      )}

      {/* 5. Resume Import Modal */}
      {importModal?.isOpen && (
        <ResumeImportModal
          onClose={() => setImportModal(null)}
          onImported={async () => {
            setImportModal(null);
            await loadData();
          }}
        />
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        title={`Delete ${itemToDelete?.type || 'item'}`}
        description={`Are you sure you want to delete this ${itemToDelete?.type}? ${
          itemToDelete?.type === 'company' || itemToDelete?.type === 'product' || itemToDelete?.type === 'project'
            ? 'All associated child products and master bullets will also be removed.'
            : ''
        }`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setItemToDelete(null)}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        description={alertState.description}
        variant={alertState.variant}
        onClose={() => setAlertState((s) => ({ ...s, isOpen: false }))}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-component: Bullet Item display with provenance & defense preview
// -----------------------------------------------------------------------------
function BulletItem({
  bullet,
  onEdit,
  onDelete,
}: {
  bullet: MasterBullet;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showDefense, setShowDefense] = useState(false);

  // Format bullet text with bolded metrics
  const highlightedHtml = useMemo(() => {
    const raw = bullet.bullet_text || '';
    // Highlight numbers/percentages/metrics
    return raw.replace(
      /(\d+[%kKmMbBxX]|\b\d+\s*(ms|seconds|minutes|hours|days|x|users|req\/s|rps|queries|events)\b|\$\d+)/g,
      '<strong class="text-signal font-bold">$1</strong>'
    );
  }, [bullet.bullet_text]);

  return (
    <div className="group rounded-lg border border-edge/60 bg-surface/40 p-3 hover:border-edge transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status indicator */}
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider ${
                bullet.review_status === 'approved'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : bullet.review_status === 'needs_review'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-muted/10 text-muted border border-edge'
              }`}
            >
              {bullet.review_status.replace('_', ' ')}
            </span>

            {/* Source Provenance */}
            <span className="rounded bg-edge/50 px-1.5 py-0.5 font-mono text-[9px] text-muted uppercase">
              {bullet.source_type.replace('_', ' ')}
            </span>

            {/* Metric pill */}
            {bullet.metric_primary && (
              <span className="rounded-full bg-signal/15 px-2 py-0.5 font-mono text-[10px] font-bold text-signal">
                {bullet.metric_primary}
              </span>
            )}
          </div>

          {/* Bullet Text */}
          <p
            className="font-sans text-xs text-content leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />

          {/* Tech Stack Chips */}
          {bullet.tech_stack && bullet.tech_stack.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {bullet.tech_stack.map((tech) => (
                <span
                  key={tech}
                  className="rounded bg-edge/40 px-1.5 py-0.5 font-mono text-[10px] text-muted font-medium"
                >
                  {tech}
                </span>
              ))}
            </div>
          )}

          {/* Technical Context / Defense Expandable */}
          {(bullet.context_challenge || bullet.defense_notes) && (
            <div className="pt-1">
              <button
                onClick={() => setShowDefense(!showDefense)}
                className="font-mono text-[10px] text-muted hover:text-signal flex items-center gap-1 cursor-pointer"
              >
                <Icon.Shield className="h-3 w-3" />
                <span>{showDefense ? 'Hide Architectural Trade-offs' : 'View Architectural Trade-offs'}</span>
                <Icon.ChevronDown className={`h-3 w-3 transition-transform ${showDefense ? 'rotate-180' : ''}`} />
              </button>

              {showDefense && (
                <div className="mt-2 rounded-md border border-edge/80 bg-surface/80 p-2.5 font-mono text-[11px] space-y-1.5 text-muted">
                  {bullet.context_challenge && (
                    <div>
                      <strong className="text-content uppercase text-[9px] block">Engineering Challenge:</strong>
                      <span className="font-sans text-xs text-content/90">{bullet.context_challenge}</span>
                    </div>
                  )}
                  {bullet.defense_notes && (
                    <div>
                      <strong className="text-content uppercase text-[9px] block">Defense & Trade-offs:</strong>
                      <span className="font-sans text-xs text-content/90">{bullet.defense_notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="rounded p-1 text-muted hover:text-content hover:bg-surface transition-all cursor-pointer"
            title="Edit Bullet"
          >
            <Icon.Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1 text-muted hover:text-red-400 hover:bg-surface transition-all cursor-pointer"
            title="Delete Bullet"
          >
            <Icon.Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-modals for Editing
// -----------------------------------------------------------------------------

function CompanyEditModal({
  company,
  onClose,
  onSaved,
}: {
  company?: PortfolioCompany;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const DRAFT_KEY = 'gitgrill_company_draft_v1';
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

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

  // Auto-restore draft if creating new company
  useEffect(() => {
    if (company) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.name || d.roleTitle || d.domain || d.location || d.startDate || d.endDate || d.isCurrent) {
          setName(d.name || '');
          setRoleTitle(d.roleTitle || '');
          setDomain(d.domain || '');
          setLocation(d.location || '');
          setStartDate(d.startDate || '');
          setEndDate(d.endDate || '');
          setIsCurrent(Boolean(d.isCurrent));
          setHasRestoredDraft(true);
        }
      }
    } catch {}
  }, [company]);

  // Auto-save draft on every keystroke when creating
  useEffect(() => {
    if (company) return;
    try {
      if (name || roleTitle || domain || location || startDate || endDate || isCurrent) {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ name, roleTitle, domain, location, startDate, endDate, isCurrent })
        );
      }
    } catch {}
  }, [company, name, roleTitle, domain, location, startDate, endDate, isCurrent]);

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setName('');
    setRoleTitle('');
    setDomain('');
    setLocation('');
    setStartDate('');
    setEndDate('');
    setIsCurrent(false);
    setHasRestoredDraft(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Company name is required.');
      return;
    }

    const parsedStart = startDate.trim() ? normalizeDateToISO(startDate) : null;
    if (startDate.trim() && !parsedStart) {
      setError('Invalid start date format. Please use "Jun 2026", "2026-06", or "Jan 2022".');
      return;
    }

    const parsedEnd = (!isCurrent && endDate.trim()) ? normalizeDateToISO(endDate) : null;
    if (!isCurrent && endDate.trim() && !parsedEnd) {
      setError('Invalid end date format. Please use "Dec 2024", "2024-12", or "Dec 2024".');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await saveCompany({
        id: company?.id,
        name: name.trim(),
        role_title: roleTitle.trim() || null,
        domain: domain.trim() || null,
        location: location.trim() || null,
        start_date: parsedStart,
        end_date: isCurrent ? null : parsedEnd,
        is_current: isCurrent,
      });

      // Clear draft on successful save
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}

      await onSaved();
    } catch (err: any) {
      setError(humanizePortfolioError(err?.message, 'Failed to save company.'));
    } finally {
      setSaving(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-edge bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-edge">
          <h3 className="font-mono text-base font-bold text-content">
            {company ? 'Edit Company' : 'Add Company / Organization'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-content">
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {hasRestoredDraft && !company && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-signal/30 bg-signal/10 px-3.5 py-2 text-xs font-mono text-signal animate-in fade-in">
            <span className="flex items-center gap-1.5 font-semibold">
              <Icon.Sparkle className="h-3.5 w-3.5" />
              <span>Unsaved draft restored</span>
            </span>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-[11px] underline hover:opacity-80 font-bold cursor-pointer"
            >
              Discard Draft
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <FormField label="Company Name *">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stripe, Linear, Vercel"
              required
            />
          </FormField>

          <FormField label="Your Role / Title">
            <TextInput
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer / Tech Lead"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Domain / URL">
              <TextInput
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="stripe.com"
              />
            </FormField>
            <FormField label="Location">
              <TextInput
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="San Francisco / Remote"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Start Date" hint="e.g. Jun 2026, 2026-06, or Jan 2022">
              <TextInput
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="e.g. Jun 2026"
              />
            </FormField>
            <FormField label="End Date" hint={isCurrent ? 'Currently working here' : 'e.g. Dec 2024 or 2024-12'}>
              <TextInput
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isCurrent}
                placeholder={isCurrent ? 'Present' : 'e.g. Dec 2024'}
              />
            </FormField>
          </div>

          <div className="pt-1">
            <Checkbox
              checked={isCurrent}
              onChange={setIsCurrent}
              label="I currently work here"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-edge">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-edge bg-surface px-4 py-2 font-mono text-xs font-semibold text-content hover:bg-muted/10 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-signal hover:bg-signal-hover text-surface px-4 py-2 font-mono text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {saving && <Icon.Spinner className="h-3.5 w-3.5 animate-spin" />}
              <span>{saving ? 'Saving...' : 'Save Company'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function ProductEditModal({
  companyId,
  companyRole,
  product,
  onClose,
  onSaved,
}: {
  companyId: string;
  companyRole?: string | null;
  product?: PortfolioProduct;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const DRAFT_KEY = `gitgrill_product_draft_${companyId}`;
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const [name, setName] = useState(product?.name || '');
  const isKnownPreset = ARCHITECTURE_OPTIONS.some(
    (p) => p.value !== '__custom__' && (p.value === product?.architecture_type || p.value.toLowerCase() === (product?.architecture_type || '').toLowerCase())
  );
  const [isCustomArch, setIsCustomArch] = useState(
    Boolean(product?.architecture_type && !isKnownPreset)
  );
  const [architectureType, setArchitectureType] = useState(
    product?.architecture_type || 'Event-Driven Microservices'
  );
  const [techStackStr, setTechStackStr] = useState(product?.tech_stack?.join(', ') || '');
  const [liveUrl, setLiveUrl] = useState(product?.live_url || '');
  const [repoUrl, setRepoUrl] = useState(product?.repo_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Auto-restore draft if creating new product
  useEffect(() => {
    if (product) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.name || d.liveUrl || d.repoUrl || d.architectureType || d.techStackStr) {
          setName(d.name || '');
          if (d.techStackStr) setTechStackStr(d.techStackStr);
          if (d.architectureType) {
            setArchitectureType(d.architectureType);
            if (d.isCustomArch !== undefined) {
              setIsCustomArch(Boolean(d.isCustomArch));
            } else {
              const known = ARCHITECTURE_OPTIONS.some((p) => p.value !== '__custom__' && p.value === d.architectureType);
              setIsCustomArch(!known);
            }
          }
          setLiveUrl(d.liveUrl || '');
          setRepoUrl(d.repoUrl || '');
          setHasRestoredDraft(true);
        }
      }
    } catch {}
  }, [product, DRAFT_KEY]);

  // Auto-save draft on every change
  useEffect(() => {
    if (product) return;
    try {
      if (name || liveUrl || repoUrl || architectureType || techStackStr) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, architectureType, isCustomArch, techStackStr, liveUrl, repoUrl }));
      }
    } catch {}
  }, [product, DRAFT_KEY, name, architectureType, isCustomArch, techStackStr, liveUrl, repoUrl]);

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setName('');
    setIsCustomArch(false);
    setArchitectureType('Event-Driven Microservices');
    setTechStackStr('');
    setLiveUrl('');
    setRepoUrl('');
    setHasRestoredDraft(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const techStack = techStackStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await saveProduct({
        id: product?.id,
        company_id: companyId,
        name: name.trim(),
        title: name.trim(),
        role_title: companyRole || 'Software Engineer',
        architecture_type: architectureType.trim() || null,
        tech_stack: techStack,
        live_url: liveUrl.trim() || null,
        repo_url: repoUrl.trim() || null,
      });

      // Clear draft on save
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}

      await onSaved();
    } catch (err: any) {
      setError(humanizePortfolioError(err?.message, 'Failed to save product.'));
    } finally {
      setSaving(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-edge bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-edge">
          <h3 className="font-mono text-base font-bold text-content">
            {product ? 'Edit Product / Sub-system' : 'Add Product / Sub-system'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-content">
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {hasRestoredDraft && !product && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-signal/30 bg-signal/10 px-3.5 py-2 text-xs font-mono text-signal animate-in fade-in">
            <span className="flex items-center gap-1.5 font-semibold">
              <Icon.Sparkle className="h-3.5 w-3.5" />
              <span>Unsaved draft restored</span>
            </span>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-[11px] underline hover:opacity-80 font-bold cursor-pointer"
            >
              Discard Draft
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <FormField label="Product / Subsystem Name *">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High-Throughput Ingestion Engine, Checkout Core"
              required
            />
          </FormField>

          <FormField
            label="Architecture Archetype"
            hint="Choose from industry archetypes or type any custom architecture freeform"
            badge={
              <button
                type="button"
                onClick={() => {
                  const nextCustom = !isCustomArch;
                  setIsCustomArch(nextCustom);
                }}
                className="font-mono text-[10px] text-signal hover:underline cursor-pointer flex items-center gap-1"
              >
                <Icon.Sparkle className="h-3 w-3" />
                <span>{isCustomArch ? 'Choose from presets' : 'Type custom archetype'}</span>
              </button>
            }
          >
            {isCustomArch ? (
              <div className="space-y-2">
                <TextInput
                  value={architectureType}
                  onChange={(e) => setArchitectureType(e.target.value)}
                  placeholder="e.g. WebRTC Media Mesh, CQRS / Event Sourcing, Edge Worker"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="font-mono text-[10px] text-muted">Suggestions:</span>
                  {['Microservices', 'Distributed Storage', 'API Gateway', 'Streaming Pipeline', 'Modular Monolith', 'Serverless', 'CQRS', 'Edge Worker'].map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setArchitectureType(sug)}
                      className="rounded-md border border-edge bg-surface/60 hover:border-signal/40 hover:text-signal px-2 py-0.5 font-mono text-[10px] text-muted transition-all cursor-pointer"
                    >
                      +{sug}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Select
                value={architectureType}
                onChange={(val) => {
                  if (val === '__custom__') {
                    setIsCustomArch(true);
                    setArchitectureType('');
                  } else {
                    setArchitectureType(val);
                  }
                }}
                options={ARCHITECTURE_OPTIONS}
                placeholder="Select Architecture Archetype"
              />
            )}
          </FormField>

          <FormField
            label="Core Tech Stack & Config"
            hint="The primary languages, frameworks, databases & infrastructure for this product"
          >
            <div className="space-y-2">
              <TextInput
                value={techStackStr}
                onChange={(e) => setTechStackStr(e.target.value)}
                placeholder="e.g. Next.js, TypeScript, PostgreSQL, Redis, Docker, Tailwind"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="font-mono text-[10px] text-muted">Quick add:</span>
                {['TypeScript', 'Next.js', 'React', 'Node.js', 'PostgreSQL', 'Redis', 'Python', 'Go', 'Docker', 'AWS', 'GraphQL', 'Kafka', 'Tailwind'].map((tech) => (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => {
                      const current = techStackStr.split(',').map((s) => s.trim()).filter(Boolean);
                      if (!current.includes(tech)) {
                        setTechStackStr(current.length > 0 ? `${current.join(', ')}, ${tech}` : tech);
                      }
                    }}
                    className="rounded-md border border-edge bg-surface/60 hover:border-signal/40 hover:text-signal px-2 py-0.5 font-mono text-[10px] text-muted transition-all cursor-pointer"
                  >
                    +{tech}
                  </button>
                ))}
              </div>
            </div>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Repository Link (optional)">
              <TextInput
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/..."
              />
            </FormField>
            <FormField label="Live URL (optional)">
              <TextInput
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="https://app.example.com"
              />
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-edge">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-edge bg-surface px-4 py-2 font-mono text-xs font-semibold text-content hover:bg-muted/10 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-signal hover:bg-signal-hover text-surface px-4 py-2 font-mono text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {saving && <Icon.Spinner className="h-3.5 w-3.5 animate-spin" />}
              <span>{saving ? 'Saving...' : 'Save Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function ProjectEditModal({
  project,
  onClose,
  onSaved,
}: {
  project?: PortfolioProject;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const DRAFT_KEY = 'gitgrill_project_draft_v1';
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const [name, setName] = useState(project?.name || '');
  const [headline, setHeadline] = useState(project?.headline || '');
  const [techStackStr, setTechStackStr] = useState(project?.tech_stack?.join(', ') || '');
  const [repoUrl, setRepoUrl] = useState(project?.repo_url || '');
  const [liveUrl, setLiveUrl] = useState(project?.live_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Auto-restore draft if creating
  useEffect(() => {
    if (project) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.name || d.headline || d.techStackStr || d.repoUrl || d.liveUrl) {
          setName(d.name || '');
          setHeadline(d.headline || '');
          if (d.techStackStr) setTechStackStr(d.techStackStr);
          setRepoUrl(d.repoUrl || '');
          setLiveUrl(d.liveUrl || '');
          setHasRestoredDraft(true);
        }
      }
    } catch {}
  }, [project]);

  // Auto-save draft on every change
  useEffect(() => {
    if (project) return;
    try {
      if (name || headline || techStackStr || repoUrl || liveUrl) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, headline, techStackStr, repoUrl, liveUrl }));
      }
    } catch {}
  }, [project, name, headline, techStackStr, repoUrl, liveUrl]);

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setName('');
    setHeadline('');
    setTechStackStr('');
    setRepoUrl('');
    setLiveUrl('');
    setHasRestoredDraft(false);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const techStack = techStackStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await saveProject({
        id: project?.id,
        name: name.trim(),
        headline: headline.trim() || null,
        tech_stack: techStack,
        repo_url: repoUrl.trim() || null,
        live_url: liveUrl.trim() || null,
      });

      // Clear draft on save
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}

      await onSaved();
    } catch (err: any) {
      setError(humanizePortfolioError(err?.message, 'Failed to save project.'));
    } finally {
      setSaving(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-edge bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-edge">
          <h3 className="font-mono text-base font-bold text-content">
            {project ? 'Edit Standalone Project' : 'Add Standalone Project'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-content">
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {hasRestoredDraft && !project && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-signal/30 bg-signal/10 px-3.5 py-2 text-xs font-mono text-signal animate-in fade-in">
            <span className="flex items-center gap-1.5 font-semibold">
              <Icon.Sparkle className="h-3.5 w-3.5" />
              <span>Unsaved draft restored</span>
            </span>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-[11px] underline hover:opacity-80 font-bold cursor-pointer"
            >
              Discard Draft
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <FormField label="Project Name *">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Distributed Key-Value Store"
              required
            />
          </FormField>

          <FormField label="Headline / Brief">
            <TextInput
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Raft-consensus replicated key-value storage engine in Go"
            />
          </FormField>

          <FormField
            label="Tech Stack & Config"
            hint="Primary technologies and tools powering this project"
          >
            <div className="space-y-2">
              <TextInput
                value={techStackStr}
                onChange={(e) => setTechStackStr(e.target.value)}
                placeholder="e.g. Go, Raft, gRPC, Docker, Prometheus"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="font-mono text-[10px] text-muted">Quick add:</span>
                {['Go', 'Rust', 'TypeScript', 'Python', 'React', 'Node.js', 'PostgreSQL', 'Redis', 'Docker', 'AWS'].map((tech) => (
                  <button
                    key={tech}
                    type="button"
                    onClick={() => {
                      const current = techStackStr.split(',').map((s) => s.trim()).filter(Boolean);
                      if (!current.includes(tech)) {
                        setTechStackStr(current.length > 0 ? `${current.join(', ')}, ${tech}` : tech);
                      }
                    }}
                    className="rounded-md border border-edge bg-surface/60 hover:border-signal/40 hover:text-signal px-2 py-0.5 font-mono text-[10px] text-muted transition-all cursor-pointer"
                  >
                    +{tech}
                  </button>
                ))}
              </div>
            </div>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Repository Link">
              <TextInput
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/..."
              />
            </FormField>
            <FormField label="Live URL">
              <TextInput
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="https://demo.example.com"
              />
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-edge">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-edge bg-surface px-4 py-2 font-mono text-xs font-semibold text-content hover:bg-muted/10 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-signal hover:bg-signal-hover text-surface px-4 py-2 font-mono text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {saving && <Icon.Spinner className="h-3.5 w-3.5 animate-spin" />}
              <span>{saving ? 'Saving...' : 'Save Project'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function BulletEditModal({
  productId,
  projectId,
  parentProduct,
  parentProject,
  bullet,
  onClose,
  onSaved,
}: {
  productId?: string;
  projectId?: string;
  parentProduct?: PortfolioProduct;
  parentProject?: PortfolioProject;
  bullet?: MasterBullet;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const DRAFT_KEY = `gitgrill_bullet_draft_${productId || projectId || 'unattached'}`;
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const [bulletText, setBulletText] = useState(bullet?.bullet_text || '');
  const [actionVerb, setActionVerb] = useState(bullet?.action_verb || '');
  const [metricPrimary, setMetricPrimary] = useState(bullet?.metric_primary || '');
  const [techStackStr, setTechStackStr] = useState(bullet?.tech_stack?.join(', ') || '');
  const [contextChallenge, setContextChallenge] = useState(bullet?.context_challenge || '');
  const [defenseNotes, setDefenseNotes] = useState(bullet?.defense_notes || '');
  const [reviewStatus, setReviewStatus] = useState<MasterBullet['review_status']>(bullet?.review_status || 'approved');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Auto-restore draft if creating
  useEffect(() => {
    if (bullet) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.bulletText || d.actionVerb || d.metricPrimary || d.techStackStr || d.contextChallenge || d.defenseNotes) {
          setBulletText(d.bulletText || '');
          setActionVerb(d.actionVerb || '');
          setMetricPrimary(d.metricPrimary || '');
          setTechStackStr(d.techStackStr || '');
          setContextChallenge(d.contextChallenge || '');
          setDefenseNotes(d.defenseNotes || '');
          if (d.reviewStatus) setReviewStatus(d.reviewStatus);
          setHasRestoredDraft(true);
        }
      }
    } catch {}
  }, [bullet, DRAFT_KEY]);

  // Auto-save draft on every change
  useEffect(() => {
    if (bullet) return;
    try {
      if (bulletText || actionVerb || metricPrimary || techStackStr || contextChallenge || defenseNotes) {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ bulletText, actionVerb, metricPrimary, techStackStr, contextChallenge, defenseNotes, reviewStatus })
        );
      }
    } catch {}
  }, [bullet, DRAFT_KEY, bulletText, actionVerb, metricPrimary, techStackStr, contextChallenge, defenseNotes, reviewStatus]);

  const handleDiscardDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setBulletText('');
    setActionVerb('');
    setMetricPrimary('');
    setTechStackStr('');
    setContextChallenge('');
    setDefenseNotes('');
    setReviewStatus('approved');
    setHasRestoredDraft(false);
    setError('');
  };

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
  }, [bulletText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulletText.trim()) {
      setError('Accomplishment sentence is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const techStack = techStackStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await saveBullet({
        id: bullet?.id,
        product_id: productId || bullet?.product_id || null,
        project_id: projectId || bullet?.project_id || null,
        bullet_text: bulletText.trim(),
        action_verb: actionVerb.trim() || null,
        metric_primary: metricPrimary.trim() || null,
        tech_stack: techStack,
        context_challenge: contextChallenge.trim() || null,
        defense_notes: defenseNotes.trim() || null,
        review_status: reviewStatus,
        source_type: bullet?.source_type || 'manual',
      });

      // Clear draft on save
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}

      await onSaved();
    } catch (err: any) {
      setError(humanizePortfolioError(err?.message, 'Failed to save bullet.'));
    } finally {
      setSaving(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  const parentStack = parentProduct?.tech_stack || parentProject?.tech_stack || [];
  const parentName = parentProduct?.name || parentProject?.name;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-edge bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-edge">
          <div className="space-y-0.5">
            <h3 className="font-mono text-base font-bold text-content">
              {bullet ? 'Edit Accomplishment Sentence' : 'Add Accomplishment Sentence'}
            </h3>
            <p className="font-sans text-xs text-muted">
              Add a concrete, metric-driven contribution for this subsystem.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-content">
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {/* Product / Project Context Banner */}
        {parentName && (
          <div className="mt-3 rounded-xl border border-edge/80 bg-surface/50 p-3 space-y-1.5 font-mono text-xs">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 font-bold text-content">
                <Icon.Layers className="h-3.5 w-3.5 text-signal" />
                <span>{parentProduct ? `Product: ${parentName}` : `Project: ${parentName}`}</span>
              </div>
              {parentProduct?.architecture_type && (
                <span className="rounded bg-edge/60 px-2 py-0.5 text-[10px] uppercase font-bold text-muted">
                  {parentProduct.architecture_type.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            {parentStack.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[11px] text-muted">
                <span className="text-[10px] uppercase font-bold text-muted/80">Inherited Stack:</span>
                {parentStack.map((t) => (
                  <span key={t} className="rounded bg-edge/40 px-1.5 py-0.2 text-[10px] text-content/85 font-medium border border-edge/50">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {hasRestoredDraft && !bullet && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-signal/30 bg-signal/10 px-3.5 py-2 text-xs font-mono text-signal animate-in fade-in">
            <span className="flex items-center gap-1.5 font-semibold">
              <Icon.Sparkle className="h-3.5 w-3.5" />
              <span>Unsaved draft restored</span>
            </span>
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="text-[11px] underline hover:opacity-80 font-bold cursor-pointer"
            >
              Discard Draft
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <FormField
            label="Accomplishment Sentence *"
            hint="1-2 sentences capturing what you built, scaled, or optimized with measurable impact"
          >
            <TextArea
              rows={3}
              value={bulletText}
              onChange={(e) => setBulletText(e.target.value)}
              placeholder="e.g. Architected distributed Kafka event pipeline handling 12M events/day, reducing end-to-end sync latency by 45%."
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Action Verb" hint="Auto-extracted from sentence">
              <TextInput
                value={actionVerb}
                onChange={(e) => setActionVerb(e.target.value)}
                placeholder="Architected, Scaled, Optimized"
              />
            </FormField>
            <FormField label="Primary Metric" hint="Auto-extracted metric">
              <TextInput
                value={metricPrimary}
                onChange={(e) => setMetricPrimary(e.target.value)}
                placeholder="45% latency drop, 12M events/day"
              />
            </FormField>
          </div>

          <FormField
            label="Specific Skills / Tools Highlight (Optional)"
            hint={parentName ? `Inherits core stack from ${parentName}. Tag specific tools only if relevant to this sentence.` : 'Optional specific skills or tools for this bullet'}
          >
            <div className="space-y-2">
              <TextInput
                value={techStackStr}
                onChange={(e) => setTechStackStr(e.target.value)}
                placeholder="e.g. Apache Kafka, Redis, Docker"
              />
              {parentStack.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="font-mono text-[10px] text-muted">Tag from product stack:</span>
                  {parentStack.map((tech) => {
                    const current = techStackStr.split(',').map((s) => s.trim()).filter(Boolean);
                    const isSelected = current.includes(tech);
                    return (
                      <button
                        key={tech}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setTechStackStr(current.filter((t) => t !== tech).join(', '));
                          } else {
                            setTechStackStr([...current, tech].join(', '));
                          }
                        }}
                        className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition-all cursor-pointer ${
                          isSelected
                            ? 'border-signal/50 bg-signal/15 text-signal font-bold'
                            : 'border-edge bg-surface/60 hover:border-signal/40 hover:text-signal text-muted'
                        }`}
                      >
                        {isSelected ? `✓ ${tech}` : `+${tech}`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </FormField>

          {/* Optional Collapsible Technical Context & Defense */}
          <details className="group rounded-xl border border-edge/70 bg-surface/30 p-3.5 space-y-3">
            <summary className="font-mono text-xs font-bold text-muted hover:text-content cursor-pointer flex items-center justify-between list-none">
              <span className="flex items-center gap-1.5">
                <Icon.Shield className="h-3.5 w-3.5 text-signal" />
                <span>Interview Defense & Technical Context (Optional)</span>
              </span>
              <Icon.ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            </summary>
            <div className="pt-2 space-y-3">
              <FormField label="Engineering Challenge (The Problem)" hint="What was broken, slow, or bottlenecked?">
                <TextArea
                  rows={2}
                  value={contextChallenge}
                  onChange={(e) => setContextChallenge(e.target.value)}
                  placeholder="Legacy polling architecture was overwhelming the primary database and failing under traffic spikes."
                />
              </FormField>

              <FormField label="Defense Notes & Trade-offs (The 'Why')" hint="Why did you choose this architecture over alternatives?">
                <TextArea
                  rows={2}
                  value={defenseNotes}
                  onChange={(e) => setDefenseNotes(e.target.value)}
                  placeholder="Chose partitioned Kafka logs over RabbitMQ due to strict ordering guarantees and replayability requirements."
                />
              </FormField>
            </div>
          </details>

          <FormField label="Review Status">
            <Select
              value={reviewStatus}
              onChange={(val) => setReviewStatus(val as any)}
              options={REVIEW_STATUS_OPTIONS}
            />
          </FormField>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-edge">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-edge bg-surface px-4 py-2 font-mono text-xs font-semibold text-content hover:bg-muted/10 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-signal hover:bg-signal-hover text-surface px-4 py-2 font-mono text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              {saving && <Icon.Spinner className="h-3.5 w-3.5 animate-spin" />}
              <span>{saving ? 'Saving...' : 'Save Sentence'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function ResumeImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [resumes, setResumes] = useState<ResumeProfile[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedNotice, setUploadedNotice] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState<any>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const list = getResumes();
    setResumes(list);
    if (list.length > 0) {
      setSelectedResumeId(list[0].id);
    }
  }, []);

  const handleUploadFile = async (file: File) => {
    setUploading(true);
    setError('');
    setUploadedNotice('');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!['pdf', 'docx', 'doc', 'md', 'txt', 'json'].includes(ext)) {
        throw new Error('Unsupported format. Please upload a .pdf, .docx, or .md file.');
      }

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      let cleanText = '';
      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer();
        cleanText = await extractDocxText(arrayBuffer);
      } else if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        cleanText = await extractPdfText(arrayBuffer);
      } else if (ext === 'md' || ext === 'txt' || ext === 'json') {
        cleanText = await file.text();
      }

      const parsed = cleanText ? parseUploadedResumeText(cleanText, file.name) : {};
      const cleanTitle = parsed.title || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

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
        summary: parsed.summary || `Master copy uploaded from ${file.name}`,
        skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : [{ category: 'Core Stack', items: ['TypeScript', 'Go', 'PostgreSQL', 'Docker', 'AWS'] }],
        experience: parsed.experience && parsed.experience.length > 0 ? parsed.experience : [],
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

      setResumes((prev) => [saved, ...prev.filter((r) => r.id !== saved.id)]);
      setSelectedResumeId(saved.id);
      setUploadedNotice(`Uploaded and selected: ${file.name} (${saved.experience?.length || 0} companies, ${saved.projects?.length || 0} projects detected). Click "Bootstrap SSOT Now" below to import.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to process and parse uploaded resume file.');
    } finally {
      setUploading(false);
    }
  };

  const handleImport = async () => {
    const target = resumes.find((r) => r.id === selectedResumeId);
    if (!target) {
      setError('Please select or upload a resume profile to import.');
      return;
    }

    setImporting(true);
    setError('');
    try {
      const res = await bootstrapPortfolioFromResume(target.experience || [], target.projects || []);
      setSuccessResult(res.imported);
    } catch (err: any) {
      setError(err.message || 'Failed to import resume.');
      setImporting(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-edge bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-edge">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal/10 text-signal">
              <Icon.Sparkle className="h-4 w-4" />
            </div>
            <h3 className="font-mono text-base font-bold text-content">
              Bootstrap Living Portfolio from Resume
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-content">
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {successResult ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-2">
              <Icon.CheckCircle className="mx-auto h-8 w-8 text-emerald-400" />
              <h4 className="font-mono text-sm font-bold text-emerald-400">
                Portfolio SSOT Bootstrapped Successfully!
              </h4>
              <p className="font-sans text-xs text-muted">
                Imported {successResult.companies} companies, {successResult.products} products, {successResult.projects} projects, and {successResult.bullets} atomic master bullets into your permanent SSOT.
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={onImported}
                className="rounded-xl bg-signal hover:bg-signal-hover text-surface px-5 py-2 font-mono text-xs font-bold transition-all cursor-pointer"
              >
                View Living Portfolio
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="font-sans text-xs text-muted leading-relaxed">
              Extract company histories, products, and bullet points from a resume into atomic master records. This establishes your permanent SSOT without altering your original files.
            </p>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono">
                {error}
              </div>
            )}

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.docx,.doc,.md,.txt,.json"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleUploadFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {/* Drag & Drop / Click to Upload Box */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleUploadFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-all select-none ${
                isDragging
                  ? 'border-signal bg-signal/10 scale-[1.01]'
                  : 'border-edge hover:border-signal/50 hover:bg-well/50 bg-well/20'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal/10 text-signal">
                  {uploading ? (
                    <Icon.Spinner className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon.Upload className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="font-mono text-xs font-bold text-content">
                    {uploading ? 'Parsing & Extracting Document AST...' : 'Upload New Resume (.pdf, .docx, .md)'}
                  </p>
                  <p className="font-sans text-[11px] text-muted">
                    Drag & drop here or click to browse. Automatically extracts companies, roles, and bullets.
                  </p>
                </div>
              </div>
            </div>

            {uploadedNotice && (
              <div className="rounded-xl border border-signal/30 bg-signal/10 p-3 text-xs text-signal font-mono flex items-center gap-2">
                <Icon.CheckCircle className="h-4 w-4 shrink-0" />
                <span>{uploadedNotice}</span>
              </div>
            )}

            {resumes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-mono text-[10px] uppercase tracking-wider text-muted font-bold">
                    Or Select From Resume Vault ({resumes.length}):
                  </label>
                  <span className="font-mono text-[10px] text-muted">Click to select</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto thin-scroll">
                  {resumes.map((r) => {
                    const isSelected = selectedResumeId === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedResumeId(r.id)}
                        className={`flex items-start gap-2.5 rounded-xl border p-2.5 cursor-pointer transition-all select-none ${
                          isSelected
                            ? 'border-signal bg-signal/5'
                            : 'border-edge bg-surface/50 hover:border-edge/80'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full border transition-all ${
                            isSelected
                              ? 'border-signal bg-signal text-white'
                              : 'border-edge bg-card'
                          }`}
                        >
                          {isSelected && <span className="h-1 w-1 rounded-full bg-white" />}
                        </div>
                        <div className="flex-1 space-y-0.5 min-w-0">
                          <div className="font-mono text-xs font-bold text-content truncate">{r.title}</div>
                          <div className="font-sans text-[11px] text-muted truncate">
                            {r.fullName} · {r.experience?.length || 0} companies · {r.projects?.length || 0} projects
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-edge">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-edge bg-surface px-4 py-2 font-mono text-xs font-semibold text-content hover:bg-muted/10 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importing || uploading || !selectedResumeId}
                onClick={handleImport}
                className="inline-flex items-center gap-2 rounded-xl bg-signal hover:bg-signal-hover text-surface px-5 py-2 font-mono text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {importing && <Icon.Spinner className="h-3.5 w-3.5 animate-spin" />}
                <span>{importing ? 'Importing SSOT...' : 'Bootstrap SSOT Now'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
