'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from '@/lib/portfolio';
import { getResumes, ResumeProfile } from '@/lib/resumes';
import { ConfirmModal, AlertModal } from '@/components/ui';

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
            <p className="max-w-2xl font-sans text-xs sm:text-sm text-muted leading-relaxed">
              Your single source of truth for real-world engineering contributions across products, companies, and repositories.
              Atomic master bullets are maintained here once and queried into specialized resume branches dynamically.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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
        <div className="relative flex-1 max-w-md">
          <Icon.Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by company, tech stack, architecture, or metric..."
            className="w-full rounded-xl border border-edge bg-card pl-10 pr-4 py-2 font-sans text-xs text-content placeholder:text-muted focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-content p-0.5"
            >
              <Icon.X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

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
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                <Icon.Building className="h-4 w-4 text-signal" />
                <span>Companies & Products Hierarchy ({filteredCompanies.length})</span>
              </h2>
              <button
                onClick={() => setCompanyModal({ isOpen: true })}
                className="font-mono text-xs text-signal hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Icon.Plus className="h-3.5 w-3.5" />
                <span>Add Company</span>
              </button>
            </div>

            {filteredCompanies.length === 0 ? (
              <div className="rounded-xl border border-edge bg-card p-6 text-center text-xs text-muted font-mono">
                No companies match your search or filter.
              </div>
            ) : (
              filteredCompanies.map((company) => (
                <div
                  key={company.id}
                  className="rounded-2xl border border-edge bg-card overflow-hidden shadow-card transition-all"
                >
                  {/* Company Header */}
                  <div className="p-5 border-b border-edge/60 bg-surface/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-base sm:text-lg font-black text-content">
                          {company.name}
                        </span>
                        {company.is_current && (
                          <span className="rounded-full bg-signal/20 px-2 py-0.5 font-mono text-[10px] font-bold text-signal uppercase tracking-wider">
                            Present
                          </span>
                        )}
                        {company.domain && (
                          <a
                            href={company.domain.startsWith('http') ? company.domain : `https://${company.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-muted hover:text-signal flex items-center gap-1"
                          >
                            <span>{company.domain.replace(/^https?:\/\//, '')}</span>
                            <Icon.ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted font-mono flex-wrap">
                        {company.role_title && <span className="text-content font-medium">{company.role_title}</span>}
                        {(company.start_date || company.end_date) && (
                          <span>· {company.start_date || ''} — {company.is_current ? 'Present' : company.end_date || ''}</span>
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
                  <div className="p-5 space-y-4">
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
                      company.products.map((product) => (
                        <div
                          key={product.id}
                          className="rounded-xl border border-edge/70 bg-card/60 p-4 space-y-3"
                        >
                          {/* Product Header */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-edge/50">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-bold text-content">
                                {product.name}
                              </span>
                              {product.architecture_type && (
                                <span className="rounded-md border border-edge bg-surface px-2 py-0.5 font-mono text-[10px] font-bold text-muted uppercase">
                                  {product.architecture_type.replace(/_/g, ' ')}
                                </span>
                              )}
                              {product.repo_url && (
                                <a
                                  href={product.repo_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted hover:text-signal p-0.5"
                                  title="Repository"
                                >
                                  <Icon.Github className="h-3.5 w-3.5" />
                                </a>
                              )}
                              {product.live_url && (
                                <a
                                  href={product.live_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted hover:text-signal p-0.5"
                                  title="Live URL"
                                >
                                  <Icon.ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
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

                          {/* Bullets List */}
                          {!product.bullets || product.bullets.length === 0 ? (
                            <p className="font-mono text-xs text-muted/70 italic">No bullets added yet.</p>
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
                      ))
                    )}
                  </div>
                </div>
              ))
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
              filteredProjects.map((proj) => (
                <div
                  key={proj.id}
                  className="rounded-2xl border border-edge bg-card p-5 space-y-3 shadow-card"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-edge/60">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-base font-bold text-content">{proj.name}</span>
                        {proj.repo_url && (
                          <a
                            href={proj.repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
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
                            className="text-muted hover:text-signal p-0.5"
                            title="Live Project URL"
                          >
                            <Icon.ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      {proj.headline && (
                        <p className="font-sans text-xs text-muted">{proj.headline}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
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

                  {/* Bullets List */}
                  {!proj.bullets || proj.bullets.length === 0 ? (
                    <p className="font-mono text-xs text-muted/70 italic">No bullets added yet.</p>
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
              ))
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
  const [name, setName] = useState(company?.name || '');
  const [roleTitle, setRoleTitle] = useState(company?.role_title || '');
  const [domain, setDomain] = useState(company?.domain || '');
  const [location, setLocation] = useState(company?.location || '');
  const [startDate, setStartDate] = useState(company?.start_date || '');
  const [endDate, setEndDate] = useState(company?.end_date || '');
  const [isCurrent, setIsCurrent] = useState(company?.is_current || false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Company name is required.');
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
        start_date: startDate.trim() || null,
        end_date: isCurrent ? null : endDate.trim() || null,
        is_current: isCurrent,
      });
      await onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save company.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-edge bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-edge">
          <h3 className="font-mono text-base font-bold text-content">
            {company ? 'Edit Company' : 'Add Company / Organization'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-content">
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
              Company Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Stripe, Cefalo, Vercel"
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
              Your Role / Title
            </label>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g. Senior Backend Engineer / Tech Lead"
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
                Domain / URL
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="stripe.com"
                className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="San Francisco / Remote"
                className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
                Start Date
              </label>
              <input
                type="text"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="e.g. Jan 2022"
                className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
                End Date
              </label>
              <input
                type="text"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isCurrent}
                placeholder={isCurrent ? 'Present' : 'e.g. Dec 2024'}
                className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content disabled:opacity-50 focus:border-signal focus:outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
              className="rounded border-edge text-signal focus:ring-signal"
            />
            <span className="font-mono text-xs text-content">I currently work here</span>
          </label>

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
    </div>
  );
}

function ProductEditModal({
  companyId,
  product,
  onClose,
  onSaved,
}: {
  companyId: string;
  product?: PortfolioProduct;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(product?.name || '');
  const [architectureType, setArchitectureType] = useState(product?.architecture_type || 'microservices');
  const [liveUrl, setLiveUrl] = useState(product?.live_url || '');
  const [repoUrl, setRepoUrl] = useState(product?.repo_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveProduct({
        id: product?.id,
        company_id: companyId,
        name: name.trim(),
        architecture_type: architectureType.trim() || null,
        live_url: liveUrl.trim() || null,
        repo_url: repoUrl.trim() || null,
      });
      await onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-edge bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-edge">
          <h3 className="font-mono text-base font-bold text-content">
            {product ? 'Edit Product / Sub-system' : 'Add Product / Sub-system'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-content">
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
              Product / Subsystem Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High-Throughput Ingestion Engine, Checkout Core"
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
              Architecture Archetype
            </label>
            <select
              value={architectureType}
              onChange={(e) => setArchitectureType(e.target.value)}
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-none"
            >
              <option value="microservices">Event-Driven Microservices</option>
              <option value="distributed_storage">Distributed Storage / Caching Layer</option>
              <option value="api_gateway">High-Throughput API Gateway</option>
              <option value="realtime_stream">Real-Time Data Streaming / Pipeline</option>
              <option value="modular_monolith">Modular Monolith / Domain-Driven</option>
              <option value="ml_infra">ML Ops & Model Serving Pipeline</option>
              <option value="developer_tools">Developer CLI & Tooling</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
                Repository Link (optional)
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
                Live URL (optional)
              </label>
              <input
                type="text"
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="https://app.example.com"
                className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
              />
            </div>
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
    </div>
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
  const [name, setName] = useState(project?.name || '');
  const [headline, setHeadline] = useState(project?.headline || '');
  const [repoUrl, setRepoUrl] = useState(project?.repo_url || '');
  const [liveUrl, setLiveUrl] = useState(project?.live_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveProject({
        id: project?.id,
        name: name.trim(),
        headline: headline.trim() || null,
        repo_url: repoUrl.trim() || null,
        live_url: liveUrl.trim() || null,
      });
      await onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-edge bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-edge">
          <h3 className="font-mono text-base font-bold text-content">
            {project ? 'Edit Standalone Project' : 'Add Standalone Project'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-content">
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Distributed Key-Value Store"
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
              Headline / Brief
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Raft-consensus replicated key-value storage engine in Go"
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
                Repository Link
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/..."
                className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
                Live URL
              </label>
              <input
                type="text"
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="https://demo.example.com"
                className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
              />
            </div>
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
    </div>
  );
}

function BulletEditModal({
  productId,
  projectId,
  bullet,
  onClose,
  onSaved,
}: {
  productId?: string;
  projectId?: string;
  bullet?: MasterBullet;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
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
  }, [bulletText]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulletText.trim()) {
      setError('Bullet text is required.');
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
      await onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save bullet.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-edge bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-edge">
          <div className="space-y-0.5">
            <h3 className="font-mono text-base font-bold text-content">
              {bullet ? 'Edit Master Bullet' : 'Add Atomic Master Bullet'}
            </h3>
            <p className="font-sans text-xs text-muted">
              Define the measurable impact and defense rationale for this contribution.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-content">
            <Icon.X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
              Contribution Bullet Text *
            </label>
            <textarea
              rows={3}
              value={bulletText}
              onChange={(e) => setBulletText(e.target.value)}
              placeholder="e.g. Architected distributed Kafka event pipeline handling 12M events/day, reducing end-to-end sync latency by 45%."
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none leading-relaxed"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
                Action Verb
              </label>
              <input
                type="text"
                value={actionVerb}
                onChange={(e) => setActionVerb(e.target.value)}
                placeholder="Architected, Scaled, Streamlined"
                className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
                Primary Metric
              </label>
              <input
                type="text"
                value={metricPrimary}
                onChange={(e) => setMetricPrimary(e.target.value)}
                placeholder="45% latency drop, 12M events/day"
                className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
              Technologies & Tools (comma separated)
            </label>
            <input
              type="text"
              value={techStackStr}
              onChange={(e) => setTechStackStr(e.target.value)}
              placeholder="PostgreSQL, Apache Kafka, Go, Redis, Docker"
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
              Engineering Challenge (The Problem)
            </label>
            <textarea
              rows={2}
              value={contextChallenge}
              onChange={(e) => setContextChallenge(e.target.value)}
              placeholder="Legacy polling architecture was overwhelming the primary database and failing under traffic spikes."
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
              Defense Notes & Trade-offs (The 'Why')
            </label>
            <textarea
              rows={2}
              value={defenseNotes}
              onChange={(e) => setDefenseNotes(e.target.value)}
              placeholder="Chose partitioned Kafka logs over RabbitMQ due to strict ordering guarantees and replayability requirements."
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-sans text-xs text-content focus:border-signal focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1">
              Review Status
            </label>
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value as any)}
              className="w-full rounded-xl border border-edge bg-surface px-3.5 py-2 font-mono text-xs text-content focus:border-signal focus:outline-none"
            >
              <option value="approved">Approved (Verified & Ready for Resumes)</option>
              <option value="needs_review">Needs Review (Missing Metrics or Details)</option>
              <option value="draft">Draft (Work in Progress)</option>
            </select>
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
              <span>{saving ? 'Saving...' : 'Save Bullet'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
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
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState<any>(null);

  useEffect(() => {
    const list = getResumes();
    setResumes(list);
    if (list.length > 0) {
      setSelectedResumeId(list[0].id);
    }
  }, []);

  const handleImport = async () => {
    const target = resumes.find((r) => r.id === selectedResumeId);
    if (!target) {
      setError('Please select a resume profile to import.');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl border border-edge bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
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
                Imported {successResult.companies} companies, {successResult.products} products, {successResult.projects} projects, and {successResult.bullets} atomic master bullets.
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
              Extract company histories, products, and bullet points from an existing resume in your Resume Vault into atomic master records. This establishes your permanent SSOT without altering your original files.
            </p>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 font-mono">
                {error}
              </div>
            )}

            {resumes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-edge p-6 text-center">
                <p className="font-mono text-xs text-muted">No parsed resumes found in your Resume Vault yet.</p>
                <p className="mt-1 font-sans text-xs text-muted">
                  Upload a DOCX, PDF, or Markdown resume in the Resume Vault tab first.
                </p>
              </div>
            ) : (
              <div>
                <label className="block font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-1.5">
                  Select Source Resume Profile:
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {resumes.map((r) => (
                    <label
                      key={r.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                        selectedResumeId === r.id
                          ? 'border-signal bg-signal/5'
                          : 'border-edge bg-surface/50 hover:border-edge/80'
                      }`}
                    >
                      <input
                        type="radio"
                        name="resume_select"
                        value={r.id}
                        checked={selectedResumeId === r.id}
                        onChange={() => setSelectedResumeId(r.id)}
                        className="mt-0.5 text-signal focus:ring-signal"
                      />
                      <div className="flex-1 space-y-0.5">
                        <div className="font-mono text-xs font-bold text-content">{r.title}</div>
                        <div className="font-sans text-[11px] text-muted">
                          {r.fullName} · {r.experience?.length || 0} companies · {r.projects?.length || 0} projects
                        </div>
                      </div>
                    </label>
                  ))}
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
                disabled={importing || resumes.length === 0}
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
    </div>
  );
}
