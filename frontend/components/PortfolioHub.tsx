'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/icons';
import { PortfolioDrawer, type DrawerEntity } from './PortfolioDrawer';
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
  deleteEducation,
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
  Tooltip,
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
  const [selectedTechFilter, setSelectedTechFilter] = useState<string | null>(null);

  // Drag & drop state for bullets
  const [draggedBullet, setDraggedBullet] = useState<{
    bullet: MasterBullet;
    sourceParentId: string;
  } | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);

  // Universal Slide-Over Drawer State
  const [activeDrawer, setActiveDrawer] = useState<DrawerEntity | null>(null);
  const [importModal, setImportModal] = useState<{ isOpen: boolean } | null>(null);

  // Deletion confirm modals
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'company' | 'product' | 'project' | 'bullet' | 'education';
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

  // Dynamic Tech Stacks aggregated from products and projects
  const allTechStacks = useMemo(() => {
    const counts = new Map<string, number>();
    portfolio.companies.forEach((c) => {
      (c.products || []).forEach((p) => {
        (p.tech_stack || []).forEach((t) => {
          if (t && t.trim()) {
            const clean = t.trim();
            counts.set(clean, (counts.get(clean) || 0) + 1);
          }
        });
        (p.bullets || []).forEach((b) => {
          (b.tech_stack || []).forEach((t) => {
            if (t && t.trim()) {
              const clean = t.trim();
              counts.set(clean, (counts.get(clean) || 0) + 1);
            }
          });
        });
      });
    });
    portfolio.standalone_projects.forEach((pr) => {
      (pr.tech_stack || []).forEach((t) => {
        if (t && t.trim()) {
          const clean = t.trim();
          counts.set(clean, (counts.get(clean) || 0) + 1);
        }
      });
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)
      .slice(0, 10);
  }, [portfolio]);

  // All valid move targets for bullets across companies and products
  const allMoveTargets = useMemo(() => {
    const targets: Array<{ id: string; name: string; type: 'company' | 'product'; companyName: string }> = [];
    portfolio.companies.forEach((c) => {
      targets.push({ id: c.id, name: `${c.name} (Direct)`, type: 'company', companyName: c.name });
      (c.products || []).forEach((p) => {
        targets.push({ id: p.id, name: p.name, type: 'product', companyName: c.name });
      });
    });
    return targets;
  }, [portfolio.companies]);

  // Filtering
  const filteredCompanies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const techFilter = selectedTechFilter?.toLowerCase().trim();
    if (!q && filterReviewStatus === 'all' && !techFilter) return portfolio.companies;

    return portfolio.companies
      .map((c) => {
        const matchesComp = c.name.toLowerCase().includes(q) || (c.role_title && c.role_title.toLowerCase().includes(q));
        const filteredProds = (c.products || []).filter((p) => {
          const matchesTech = !techFilter ||
            (p.tech_stack || []).some((t) => t.toLowerCase() === techFilter) ||
            (p.bullets || []).some((b) =>
              (b.tech_stack || []).some((t) => t.toLowerCase() === techFilter) ||
              b.bullet_text.toLowerCase().includes(techFilter)
            );
          const matchesProd = p.name.toLowerCase().includes(q) || (p.architecture_type && p.architecture_type.toLowerCase().includes(q));
          const matchesBullets = (p.bullets || []).some((b) => {
            const matchesText = b.bullet_text.toLowerCase().includes(q) || (b.tech_stack || []).some((t) => t.toLowerCase().includes(q));
            const matchesStatus = filterReviewStatus === 'all' || b.review_status === filterReviewStatus;
            return matchesText && matchesStatus;
          });
          return matchesTech && (matchesProd || matchesBullets);
        });

        const filteredDirectBullets = (c.bullets || []).filter((b) => {
          const matchesTech = !techFilter ||
            (b.tech_stack || []).some((t) => t.toLowerCase() === techFilter) ||
            b.bullet_text.toLowerCase().includes(techFilter);
          const matchesText = b.bullet_text.toLowerCase().includes(q) || (b.tech_stack || []).some((t) => t.toLowerCase().includes(q));
          const matchesStatus = filterReviewStatus === 'all' || b.review_status === filterReviewStatus;
          return matchesTech && matchesText && matchesStatus;
        });

        if ((matchesComp && !techFilter) || filteredProds.length > 0 || filteredDirectBullets.length > 0) {
          return {
            ...c,
            products: filteredProds.length > 0 ? filteredProds : (techFilter ? [] : c.products),
            bullets: filteredDirectBullets.length > 0 ? filteredDirectBullets : (techFilter ? [] : c.bullets),
          };
        }
        return null;
      })
      .filter(Boolean) as PortfolioCompany[];
  }, [portfolio.companies, searchQuery, filterReviewStatus, selectedTechFilter]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const techFilter = selectedTechFilter?.toLowerCase().trim();
    if (!q && filterReviewStatus === 'all' && !techFilter) return portfolio.standalone_projects;

    return portfolio.standalone_projects.filter((p) => {
      const matchesTech = !techFilter ||
        (p.tech_stack || []).some((t) => t.toLowerCase() === techFilter) ||
        (p.bullets || []).some((b) =>
          (b.tech_stack || []).some((t) => t.toLowerCase() === techFilter) ||
          b.bullet_text.toLowerCase().includes(techFilter)
        );
      const matchesText = p.name.toLowerCase().includes(q) || (p.headline && p.headline.toLowerCase().includes(q));
      const matchesBullets = (p.bullets || []).some((b) => {
        const matchesBText = b.bullet_text.toLowerCase().includes(q) || (b.tech_stack || []).some((t) => t.toLowerCase().includes(q));
        const matchesStatus = filterReviewStatus === 'all' || b.review_status === filterReviewStatus;
        return matchesBText && matchesStatus;
      });
      return matchesTech && (matchesText || matchesBullets);
    });
  }, [portfolio.standalone_projects, searchQuery, filterReviewStatus, selectedTechFilter]);

  // Bullet inline save handler
  const handleSaveBulletInline = async (bulletId: string, newText: string) => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    const words = trimmed.split(/\s+/);
    const firstWord = words[0]?.replace(/[^a-zA-Z]/g, '') || null;
    const metricMatch = extractImpactMetric(trimmed);

    let existing: MasterBullet | null = null;
    for (const c of portfolio.companies) {
      for (const p of c.products || []) {
        const b = (p.bullets || []).find((x) => x.id === bulletId);
        if (b) { existing = b; break; }
      }
      if (existing) break;
      const directB = (c.bullets || []).find((x) => x.id === bulletId);
      if (directB) { existing = directB; break; }
    }
    if (!existing) {
      for (const pr of portfolio.standalone_projects) {
        const b = (pr.bullets || []).find((x) => x.id === bulletId);
        if (b) { existing = b; break; }
      }
    }

    const updatedPayload: MasterBullet = {
      ...(existing || { id: bulletId, source_type: 'manual', review_status: 'approved' }),
      bullet_text: trimmed,
      action_verb: firstWord,
      metric_primary: metricMatch || existing?.metric_primary || null,
    };

    setPortfolio((prev) => {
      const next = { ...prev };
      next.companies = next.companies.map((c) => ({
        ...c,
        bullets: (c.bullets || []).map((b) => (b.id === bulletId ? updatedPayload : b)),
        products: (c.products || []).map((p) => ({
          ...p,
          bullets: (p.bullets || []).map((b) => (b.id === bulletId ? updatedPayload : b)),
        })),
      }));
      next.standalone_projects = next.standalone_projects.map((pr) => ({
        ...pr,
        bullets: (pr.bullets || []).map((b) => (b.id === bulletId ? updatedPayload : b)),
      }));
      return next;
    });

    try {
      await saveBullet(updatedPayload);
    } catch (err) {
      console.error('Failed to save bullet inline:', err);
      await loadData();
    }
  };

  // Move bullet between company and products
  const handleMoveBullet = async (
    bullet: MasterBullet,
    targetType: 'company' | 'product',
    targetId: string
  ) => {
    let nextProductId: string | null = null;
    if (targetType === 'product') {
      nextProductId = targetId;
    }

    const updatedPayload: MasterBullet = {
      ...bullet,
      product_id: nextProductId,
      project_id: null,
    };

    setPortfolio((prev) => {
      const next = { ...prev };
      next.companies = next.companies.map((c) => {
        const filteredDirect = (c.bullets || []).filter((b) => b.id !== bullet.id);
        const updatedProds = (c.products || []).map((p) => {
          let prodsBullets = (p.bullets || []).filter((b) => b.id !== bullet.id);
          if (targetType === 'product' && p.id === targetId) {
            prodsBullets = [...prodsBullets, updatedPayload];
          }
          return { ...p, bullets: prodsBullets };
        });
        let compBullets = filteredDirect;
        if (targetType === 'company' && c.id === targetId) {
          compBullets = [...compBullets, updatedPayload];
        }
        return { ...c, bullets: compBullets, products: updatedProds };
      });
      return next;
    });

    try {
      await saveBullet(updatedPayload);
    } catch (err) {
      console.error('Failed to re-parent bullet:', err);
      await loadData();
    }
  };

  // Toggle review status (approved -> needs_review -> draft -> approved)
  const handleToggleBulletStatus = async (bullet: MasterBullet) => {
    const cycle: Record<MasterBullet['review_status'], MasterBullet['review_status']> = {
      approved: 'needs_review',
      needs_review: 'draft',
      draft: 'approved',
    };
    const nextStatus = cycle[bullet.review_status] || 'approved';
    const updated = { ...bullet, review_status: nextStatus };

    setPortfolio((prev) => {
      const next = { ...prev };
      next.companies = next.companies.map((c) => ({
        ...c,
        bullets: (c.bullets || []).map((b) => (b.id === bullet.id ? updated : b)),
        products: (c.products || []).map((p) => ({
          ...p,
          bullets: (p.bullets || []).map((b) => (b.id === bullet.id ? updated : b)),
        })),
      }));
      next.standalone_projects = next.standalone_projects.map((pr) => ({
        ...pr,
        bullets: (pr.bullets || []).map((b) => (b.id === bullet.id ? updated : b)),
      }));
      return next;
    });

    try {
      await saveBullet(updated);
    } catch {
      await loadData();
    }
  };

  // Drag and drop handlers
  const handleBulletDragStart = (e: React.DragEvent, bullet: MasterBullet, sourceParentId: string) => {
    setDraggedBullet({ bullet, sourceParentId });
    e.dataTransfer.setData('text/plain', bullet.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnProduct = async (e: React.DragEvent, targetProductId: string) => {
    e.preventDefault();
    setDragOverTargetId(null);
    if (!draggedBullet || draggedBullet.bullet.product_id === targetProductId) return;
    await handleMoveBullet(draggedBullet.bullet, 'product', targetProductId);
    setDraggedBullet(null);
  };

  const handleDropOnCompany = async (e: React.DragEvent, targetCompanyId: string) => {
    e.preventDefault();
    setDragOverTargetId(null);
    if (!draggedBullet) return;
    await handleMoveBullet(draggedBullet.bullet, 'company', targetCompanyId);
    setDraggedBullet(null);
  };

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
      } else if (itemToDelete.type === 'education') {
        await deleteEducation(itemToDelete.id);
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
            <Tooltip content="Toggle Portfolio Capabilities Guide">
              <button
                type="button"
                onClick={() => setShowCapabilitiesGuide((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 font-mono text-xs font-semibold transition-all shadow-xs cursor-pointer ${
                  showCapabilitiesGuide
                    ? 'border-signal bg-signal/15 text-signal font-bold'
                    : 'border-edge bg-card text-muted hover:text-content hover:bg-muted/10'
                }`}
              >
                <Icon.Sparkle className="h-3.5 w-3.5 text-signal" />
                <span>Capabilities</span>
              </button>
            </Tooltip>
            <button
              onClick={() => setImportModal({ isOpen: true })}
              className="inline-flex items-center gap-2 rounded-xl border border-signal/40 bg-signal/10 hover:bg-signal/20 px-4 py-2 font-mono text-xs font-bold text-signal transition-all shadow-xs cursor-pointer"
            >
              <Icon.Sparkle className="h-4 w-4" />
              <span>Import from Resume</span>
            </button>
            <button
              onClick={() => setActiveDrawer({ type: 'company' })}
              className="inline-flex items-center gap-2 rounded-xl bg-signal hover:bg-signal-hover text-surface px-4 py-2 font-mono text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Icon.Plus className="h-4 w-4" />
              <span>Add Company</span>
            </button>
            <button
              onClick={() => setActiveDrawer({ type: 'project' })}
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
                    onClick={() => setActiveDrawer({ type: 'company' })}
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

      {/* Search & Dynamic Tech Stack Filter Toolbar */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by company, tech stack, architecture, or metric..."
            className="w-full max-w-md py-1"
          />

          <div className="flex items-center gap-2 flex-wrap">
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

        {/* Dynamic Tech Stack Filter Chips (Linear / VS Code style) */}
        {allTechStacks.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
            <span className="text-muted/70 text-[10px] uppercase font-bold tracking-wider shrink-0 mr-1">
              Product Stacks:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTechFilter(null)}
              className={`rounded px-2 py-0.5 text-[11px] font-semibold transition-all shrink-0 cursor-pointer ${
                selectedTechFilter === null
                  ? 'bg-signal text-surface font-bold shadow-xs'
                  : 'bg-surface/80 text-muted hover:text-content border border-edge/60'
              }`}
            >
              All
            </button>
            {allTechStacks.map((tech) => (
              <button
                key={tech}
                type="button"
                onClick={() => setSelectedTechFilter(selectedTechFilter === tech ? null : tech)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-all shrink-0 cursor-pointer ${
                  selectedTechFilter === tech
                    ? 'bg-signal text-surface font-bold shadow-xs'
                    : 'bg-well/80 text-muted hover:text-content hover:bg-well border border-edge/70'
                }`}
              >
                #{tech}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="rounded-2xl border border-edge bg-card p-12 text-center">
          <Icon.Spinner className="mx-auto h-6 w-6 animate-spin text-signal" />
          <p className="mt-3 font-mono text-xs text-muted">Loading Living Portfolio SSOT...</p>
        </div>
      ) : portfolio.companies.length === 0 && portfolio.standalone_projects.length === 0 && !portfolio.summary && (!portfolio.skills || portfolio.skills.length === 0) && (!portfolio.education || portfolio.education.length === 0) ? (
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
              onClick={() => setActiveDrawer({ type: 'company' })}
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
          {/* Pillar 1: Candidate Identity & Global Header Strip */}
          <div className="rounded-xl border border-edge/80 bg-card/70 backdrop-blur-md p-4 sm:p-5 shadow-sm transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="rounded bg-signal/15 text-signal px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider border border-signal/25">
                    Pillar 1 · Identity & Positioning
                  </span>
                  {portfolio.identity?.location && (
                    <span className="text-[11px] font-mono text-muted flex items-center gap-1">
                      <span>📍</span>
                      <span>{portfolio.identity.location}</span>
                    </span>
                  )}
                  {portfolio.identity?.email && (
                    <span className="text-[11px] font-mono text-muted flex items-center gap-1">
                      <span>✉️</span>
                      <span>{portfolio.identity.email}</span>
                    </span>
                  )}
                  {portfolio.identity?.phone && (
                    <span className="text-[11px] font-mono text-muted flex items-center gap-1">
                      <span>📞</span>
                      <span>{portfolio.identity.phone}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-2.5 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-mono font-black text-content tracking-tight">
                    {portfolio.identity?.full_name || 'Your Full Name'}
                  </h2>
                  <span className="text-muted/60 text-xs hidden sm:inline">•</span>
                  <span className="text-xs sm:text-sm font-sans font-medium text-signal">
                    {portfolio.identity?.headline || 'Add your target professional headline (e.g. Senior Software Engineer)'}
                  </span>
                </div>

                {/* Social & Portfolio Links */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {portfolio.identity?.github_url && (
                    <a
                      href={portfolio.identity.github_url.startsWith('http') ? portfolio.identity.github_url : `https://${portfolio.identity.github_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono bg-well/80 border border-edge text-content hover:text-signal hover:border-signal/40 transition-colors"
                    >
                      <Icon.Github className="h-3 w-3" />
                      <span>{portfolio.identity.github_url.replace(/^https?:\/\/(www\.)?github\.com\//, '')}</span>
                    </a>
                  )}
                  {portfolio.identity?.linkedin_url && (
                    <a
                      href={portfolio.identity.linkedin_url.startsWith('http') ? portfolio.identity.linkedin_url : `https://${portfolio.identity.linkedin_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono bg-well/80 border border-edge text-content hover:text-signal hover:border-signal/40 transition-colors"
                    >
                      <Icon.Link className="h-3 w-3" />
                      <span>{portfolio.identity.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '')}</span>
                    </a>
                  )}
                  {portfolio.identity?.portfolio_url && (
                    <a
                      href={portfolio.identity.portfolio_url.startsWith('http') ? portfolio.identity.portfolio_url : `https://${portfolio.identity.portfolio_url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono bg-well/80 border border-edge text-content hover:text-signal hover:border-signal/40 transition-colors"
                    >
                      <Icon.Globe className="h-3 w-3" />
                      <span>{portfolio.identity.portfolio_url.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {!portfolio.identity?.github_url && !portfolio.identity?.linkedin_url && !portfolio.identity?.portfolio_url && (
                    <span className="text-[11px] font-sans text-muted/70 italic">
                      No public profile links configured yet.
                    </span>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center md:self-start">
                <button
                  type="button"
                  onClick={() => setActiveDrawer({ type: 'identity', identity: portfolio.identity })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-edge/80 bg-well hover:bg-muted/15 text-xs font-mono font-bold text-content hover:text-signal transition-all shadow-xs cursor-pointer"
                >
                  <Icon.Pencil className="h-3.5 w-3.5 text-muted" />
                  <span>Edit Profile</span>
                </button>
              </div>
            </div>
          </div>

          {/* Responsive 2-Column Container: Pillar 2 (Summary) & Pillar 3 (Skills Matrix) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Pillar 2: Professional Summary Card (5 cols on large screens) */}
            <div className="lg:col-span-5 rounded-xl border border-edge/80 bg-card/70 backdrop-blur-md p-4 sm:p-5 flex flex-col justify-between shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-edge/40">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-content uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
                      <span className="text-signal font-black">λ</span>
                      <span>Professional Summary</span>
                    </span>
                    <span className="rounded bg-signal/15 text-signal px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider border border-signal/25">
                      Pillar 2
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {portfolio.summary && (
                      <span className="text-[10px] font-mono text-muted">
                        {portfolio.summary.trim().split(/\s+/).length} words
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveDrawer({ type: 'summary', summary: portfolio.summary })}
                      className="p-1 text-muted hover:text-signal rounded transition-colors cursor-pointer"
                      title="Edit Professional Summary"
                    >
                      <Icon.Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {portfolio.summary ? (
                  <p className="font-sans text-xs sm:text-[13px] text-content/90 leading-relaxed font-normal">
                    {portfolio.summary}
                  </p>
                ) : (
                  <div className="rounded-lg border border-dashed border-edge/80 p-4 text-center space-y-2">
                    <p className="text-xs font-sans text-muted">
                      No career positioning statement added yet. Craft a 50-word narrative summarizing your engineering focus.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveDrawer({ type: 'summary', summary: '' })}
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-signal hover:underline cursor-pointer"
                    >
                      <Icon.Plus className="h-3 w-3" />
                      <span>Write Summary</span>
                    </button>
                  </div>
                )}
              </div>

              {portfolio.summary && (
                <div className="pt-3 mt-3 border-t border-edge/30 flex items-center justify-between text-[11px] font-mono text-muted">
                  <span className="text-[10px] uppercase tracking-wider text-muted/80">Living Career Narrative</span>
                  <button
                    type="button"
                    onClick={() => setActiveDrawer({ type: 'summary', summary: portfolio.summary })}
                    className="text-signal hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    Edit Narrative →
                  </button>
                </div>
              )}
            </div>

            {/* Pillar 3: Categorized Technical Skills Matrix (7 cols on large screens) */}
            <div className="lg:col-span-7 rounded-xl border border-edge/80 bg-card/70 backdrop-blur-md p-4 sm:p-5 flex flex-col justify-between shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-edge/40">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-content uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
                      <span className="text-signal font-black">λ</span>
                      <span>Technical Skills Matrix</span>
                    </span>
                    <span className="rounded bg-signal/15 text-signal px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase tracking-wider border border-signal/25">
                      Pillar 3
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted">
                      {portfolio.skills?.length || 0} categories · {portfolio.skills?.reduce((acc, c) => acc + (c.items?.length || 0), 0) || 0} skills
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveDrawer({ type: 'skills', skills: portfolio.skills })}
                      className="p-1 text-muted hover:text-signal rounded transition-colors cursor-pointer"
                      title="Manage Skills Matrix"
                    >
                      <Icon.Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {Array.isArray(portfolio.skills) && portfolio.skills.length > 0 ? (
                  <div className="space-y-2.5">
                    {portfolio.skills.map((cat, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2.5 text-xs">
                        <span className="font-mono font-bold text-content text-[11px] sm:min-w-[130px] shrink-0 pt-0.5">
                          {cat.category}:
                        </span>
                        <div className="flex flex-wrap items-center gap-1">
                          {cat.items.map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-well/80 border border-edge/70 text-content"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-edge/80 p-4 text-center space-y-2">
                    <p className="text-xs font-sans text-muted">
                      No categorized technical skills configured yet. Partition your stack by Languages, Frontend, Backend & APIs, Databases, etc.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveDrawer({ type: 'skills', skills: [] })}
                      className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-signal hover:underline cursor-pointer"
                    >
                      <Icon.Plus className="h-3 w-3" />
                      <span>Setup Skills Matrix</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-3 mt-3 border-t border-edge/30 flex items-center justify-between text-[11px] font-mono text-muted">
                <span className="text-[10px] uppercase tracking-wider text-muted/80">Domain-Partitioned Matrix</span>
                <button
                  type="button"
                  onClick={() => setActiveDrawer({ type: 'skills', skills: portfolio.skills })}
                  className="text-signal hover:underline font-bold text-[11px] cursor-pointer"
                >
                  Manage Categories & Skills →
                </button>
              </div>
            </div>
          </div>

          {/* Master Ledger Frame */}
          <div className="rounded-xl border border-edge/80 bg-card/70 backdrop-blur-md divide-y divide-edge/40 shadow-xl">
            {/* Ledger Top Header / Actions Bar */}
            <div className="px-4 py-3 bg-surface/60 border-b border-edge/60 rounded-t-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-mono">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-bold text-content uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span className="text-signal font-black">λ</span>
                  <span>Master Portfolio Ledger</span>
                </span>
                <span className="rounded bg-signal/15 text-signal px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider border border-signal/25">
                  Living DB
                </span>
                <span className="text-muted/50 hidden sm:inline">•</span>
                <span className="text-muted text-[11px] hidden sm:inline">
                  {stats.totalCompanies} companies · {stats.totalProducts} products · {stats.totalBullets} master bullets
                </span>
              </div>

              <div className="flex items-center gap-3">
                {allProductIds.length > 0 && (
                  <Tooltip content={areAllProductsCollapsed ? 'Expand all products' : 'Collapse all products'} align="end">
                    <button
                      type="button"
                      onClick={toggleAllProducts}
                      className="text-muted hover:text-signal transition-colors flex items-center gap-1 cursor-pointer text-[11px]"
                    >
                      <Icon.ChevronDown className={`h-3 w-3 transition-transform ${areAllProductsCollapsed ? '-rotate-90' : ''}`} />
                      <span>{areAllProductsCollapsed ? 'Expand All' : 'Collapse All'}</span>
                    </button>
                  </Tooltip>
                )}
                <button
                  onClick={() => setActiveDrawer({ type: 'company' })}
                  className="rounded-lg bg-signal/15 hover:bg-signal/25 text-signal border border-signal/30 px-2.5 py-1 hover:underline flex items-center gap-1 cursor-pointer font-bold text-[11px] transition-all"
                >
                  <Icon.Plus className="h-3 w-3" />
                  <span>Add Company</span>
                </button>
              </div>
            </div>

            {/* Companies List */}
            {filteredCompanies.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted font-mono">
                No organizations or initiatives match your active filter.
              </div>
            ) : (
              filteredCompanies.map((company) => {
                const isCompanyCollapsed = Boolean(collapsedCompanies[company.id]);
                const compBulletsCount = (company.products || []).reduce((sum, p) => sum + (p.bullets?.length || 0), 0) + (company.bullets?.length || 0);
                const isDragOverComp = dragOverTargetId === company.id;

                return (
                  <div
                    key={company.id}
                    onDragOver={(e) => { e.preventDefault(); setDragOverTargetId(company.id); }}
                    onDragLeave={() => setDragOverTargetId(null)}
                    onDrop={(e) => handleDropOnCompany(e, company.id)}
                    className={`transition-colors divide-y divide-edge/30 ${isDragOverComp ? 'bg-signal/10' : ''}`}
                  >
                    {/* Level 0: Company Header Row */}
                    <div className="py-2.5 px-3 sm:px-4 bg-surface/30 hover:bg-surface/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 group relative hover:z-20">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleCompany(company.id)}
                          className="text-muted group-hover:text-signal transition-colors p-0.5 cursor-pointer shrink-0"
                          title={isCompanyCollapsed ? 'Expand company' : 'Collapse company'}
                        >
                          <Icon.ChevronDown className={`h-3.5 w-3.5 transition-transform ${isCompanyCollapsed ? '-rotate-90' : ''}`} />
                        </button>
                        <div
                          onClick={() => setActiveDrawer({
                            type: 'company',
                            company,
                          })}
                          className="flex items-baseline gap-1.5 min-w-0 cursor-pointer group/comp select-none"
                        >
                          <Tooltip content={`${company.name}${company.role_title ? ' · ' + company.role_title : ''} — Click to inspect in Drawer`} align="start">
                            <span className="font-mono text-sm sm:text-base font-bold text-content group-hover/comp:text-signal transition-colors shrink-0">
                              {company.name}
                            </span>
                          </Tooltip>
                          {company.role_title && (
                            <span className="font-mono text-xs sm:text-[13px] text-muted font-medium truncate">
                              <span className="text-muted/40 mx-1">/</span>
                              {company.role_title}
                            </span>
                          )}
                        </div>
                        {company.is_current && (
                          <span className="rounded-full bg-signal/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-signal uppercase tracking-wider shrink-0">
                            Present
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-xs font-mono text-muted pl-6 sm:pl-0">
                        {(company.start_date || company.end_date) && (
                          <span>
                            {formatISODateToDisplay(company.start_date)} — {company.is_current ? 'Present' : formatISODateToDisplay(company.end_date)}
                          </span>
                        )}
                        {company.location && <span className="hidden md:inline">· {company.location}</span>}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-edge/40 text-muted/90 font-medium">
                          {company.products?.length || 0} {company.products?.length === 1 ? 'product' : 'products'} · {compBulletsCount} {compBulletsCount === 1 ? 'bullet' : 'bullets'}
                        </span>

                        {/* Hover Action Icons */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <Tooltip content="Inspect Company Dossier in Drawer" align="end">
                            <button
                              type="button"
                              onClick={() => setActiveDrawer({ type: 'company', company })}
                              className="p-1 rounded text-muted hover:text-signal hover:bg-surface transition-colors cursor-pointer"
                            >
                              <Icon.Sidebar className="h-3.5 w-3.5" />
                            </button>
                          </Tooltip>
                          <Tooltip content="Add Subsystem to this Company" align="end">
                            <button
                              type="button"
                              onClick={() => setActiveDrawer({ type: 'product', companyId: company.id, companyName: company.name, companyRole: company.role_title })}
                              className="px-2 py-0.5 rounded bg-signal/10 hover:bg-signal/20 text-signal text-[10px] font-mono font-bold transition-all cursor-pointer"
                            >
                              + Product
                            </button>
                          </Tooltip>
                          <Tooltip content="Edit Company Details" align="end">
                            <button
                              type="button"
                              onClick={() => setActiveDrawer({ type: 'company', company })}
                              className="p-1 rounded text-muted hover:text-content hover:bg-surface transition-colors cursor-pointer"
                            >
                              <Icon.Pencil className="h-3 w-3" />
                            </button>
                          </Tooltip>
                          <Tooltip content="Delete Company" align="end">
                            <button
                              type="button"
                              onClick={() => setItemToDelete({ type: 'company', id: company.id, title: company.name })}
                              className="p-1 rounded text-muted hover:text-red-400 hover:bg-surface transition-colors cursor-pointer"
                            >
                              <Icon.Trash className="h-3 w-3" />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>

                    {/* Company Children (Direct Bullets & Products) */}
                    {!isCompanyCollapsed && (
                      <div className="py-1 px-2 sm:px-3 space-y-1 bg-card/30">
                        {/* Direct Company Bullets (Level 1) */}
                        {company.bullets && company.bullets.length > 0 && (
                          <div className="ml-4 pl-3.5 border-l border-edge/60 space-y-0.5 py-1">
                            {company.bullets.map((b) => (
                              <TreeBulletRow
                                key={b.id}
                                bullet={b}
                                parentType="company"
                                parentId={company.id}
                                allTargets={allMoveTargets}
                                onSaveInline={handleSaveBulletInline}
                                onMoveBullet={handleMoveBullet}
                                onDelete={() => setItemToDelete({ type: 'bullet', id: b.id, title: 'bullet' })}
                                onToggleStatus={handleToggleBulletStatus}
                                onDragStart={handleBulletDragStart}
                                onOpenInspector={(b) => setActiveDrawer({ type: 'bullet', bullet: b, productId: b.product_id || undefined, companyName: company.name, projectId: b.project_id || undefined })}
                              />
                            ))}
                          </div>
                        )}

                        {/* Products / Initiatives (Level 1) */}
                        {company.products && company.products.length > 0 ? (
                          <div className="space-y-1 py-0.5">
                            {company.products.map((product) => {
                              const isProdCollapsed = Boolean(collapsedProducts[product.id]);
                              const bulletCount = product.bullets?.length || 0;
                              const isDragTarget = dragOverTargetId === product.id;

                              return (
                                <div
                                  key={product.id}
                                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverTargetId(product.id); }}
                                  onDragLeave={() => setDragOverTargetId(null)}
                                  onDrop={(e) => { e.stopPropagation(); handleDropOnProduct(e, product.id); }}
                                  className={`rounded-md transition-colors ${isDragTarget ? 'bg-signal/15 ring-1 ring-signal' : ''}`}
                                >
                                  {/* Product Header Row */}
                                  <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface/50 transition-colors group relative hover:z-20">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <button
                                        type="button"
                                        onClick={() => toggleProduct(product.id)}
                                        className="text-muted group-hover:text-signal transition-colors p-0.5 cursor-pointer shrink-0"
                                        title={isProdCollapsed ? 'Expand product' : 'Collapse product'}
                                      >
                                        <Icon.ChevronDown className={`h-3.5 w-3.5 transition-transform ${isProdCollapsed ? '-rotate-90' : ''}`} />
                                      </button>
                                      <Tooltip content={`${product.name} — Click to inspect subsystem in Drawer`} align="start">
                                        <span
                                          onClick={() => setActiveDrawer({
                                            type: 'product',
                                            companyId: company.id,
                                            companyName: company.name,
                                            companyRole: company.role_title,
                                            product,
                                          })}
                                          className="font-mono text-xs sm:text-[13px] font-bold text-content hover:text-signal transition-colors cursor-pointer"
                                        >
                                          {product.name}
                                        </span>
                                      </Tooltip>
                                      <span className="rounded bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.2 font-mono text-[10px] text-amber-500 font-semibold shrink-0">
                                        {bulletCount} {bulletCount === 1 ? 'contribution' : 'contributions'}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Product-Level Monochrome Tech Stack Chips */}
                                      <div className="hidden sm:flex items-center gap-1">
                                        {(product.tech_stack || []).slice(0, 4).map((tech) => (
                                          <span
                                            key={tech}
                                            className="rounded bg-well/80 border border-edge/70 px-1.5 py-0.5 font-mono text-[10px] text-muted hover:text-content transition-colors"
                                          >
                                            #{tech}
                                          </span>
                                        ))}
                                      </div>

                                      {/* Hover Micro-Actions */}
                                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                        <Tooltip content="Inspect Subsystem in Drawer" align="end">
                                          <button
                                            type="button"
                                            onClick={() => setActiveDrawer({ type: 'product', companyId: company.id, companyName: company.name, companyRole: company.role_title, product })}
                                            className="p-1 rounded text-muted hover:text-signal hover:bg-surface transition-colors cursor-pointer"
                                          >
                                            <Icon.Sidebar className="h-3 w-3" />
                                          </button>
                                        </Tooltip>
                                        <Tooltip content="Add Bullet to Product" align="end">
                                          <button
                                            type="button"
                                            onClick={() => setActiveDrawer({ type: 'bullet', productId: product.id, parentProduct: product, companyName: company.name })}
                                            className="px-2 py-0.5 rounded bg-signal/10 hover:bg-signal/20 text-signal font-mono text-[10px] font-bold transition-all cursor-pointer"
                                          >
                                            + Bullet
                                          </button>
                                        </Tooltip>
                                        <Tooltip content="Edit Product & Stack" align="end">
                                          <button
                                            type="button"
                                            onClick={() => setActiveDrawer({ type: 'product', companyId: company.id, companyName: company.name, companyRole: company.role_title, product })}
                                            className="p-1 rounded text-muted hover:text-content hover:bg-surface transition-colors cursor-pointer"
                                          >
                                            <Icon.Pencil className="h-3 w-3" />
                                          </button>
                                        </Tooltip>
                                        <Tooltip content="Delete Product" align="end">
                                          <button
                                            type="button"
                                            onClick={() => setItemToDelete({ type: 'product', id: product.id, title: product.name })}
                                            className="p-1 rounded text-muted hover:text-red-400 hover:bg-surface transition-colors cursor-pointer"
                                          >
                                            <Icon.Trash className="h-3 w-3" />
                                          </button>
                                        </Tooltip>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Level 2: Product Bullets */}
                                  {!isProdCollapsed && (
                                    <div className="ml-4 pl-3.5 border-l border-edge/60 space-y-0.5 py-0.5">
                                      {product.bullets && product.bullets.length > 0 ? (
                                        product.bullets.map((b) => (
                                          <TreeBulletRow
                                            key={b.id}
                                            bullet={b}
                                            parentType="product"
                                            parentId={product.id}
                                            allTargets={allMoveTargets}
                                            onSaveInline={handleSaveBulletInline}
                                            onMoveBullet={handleMoveBullet}
                                            onDelete={() => setItemToDelete({ type: 'bullet', id: b.id, title: 'bullet' })}
                                            onToggleStatus={handleToggleBulletStatus}
                                            onDragStart={handleBulletDragStart}
                                            onOpenInspector={(b) => setActiveDrawer({ type: 'bullet', bullet: b, productId: product.id, parentProduct: product, companyName: company.name })}
                                          />
                                        ))
                                      ) : (
                                        <div className="py-1 px-2 text-muted text-xs font-mono flex items-center justify-between">
                                          <span>No contributions added yet.</span>
                                          <button
                                            type="button"
                                            onClick={() => setActiveDrawer({ type: 'bullet', productId: product.id, parentProduct: product })}
                                            className="text-signal hover:underline font-bold text-[11px] cursor-pointer"
                                          >
                                            + Add First Bullet
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : !company.bullets || company.bullets.length === 0 ? (
                          <div className="py-2 px-3 text-muted text-xs font-mono flex items-center justify-between">
                            <span>No initiatives or bullets recorded for this organization yet.</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setActiveDrawer({ type: 'product', companyId: company.id })}
                                className="text-signal hover:underline font-bold text-[11px] cursor-pointer"
                              >
                                + Define Product
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Ledger Bottom Status Bar */}
            <div className="px-4 py-2 bg-surface/40 border-t border-edge/40 rounded-b-xl flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] font-mono text-muted">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Ready for ATS Ingestion & Resume Tailoring</span>
              </span>
              <span className="text-muted/70">
                Double-click bullet text to edit inline · Drag ⠿ handle to reposition
              </span>
            </div>
          </div>

          {/* Standalone & Open-Source Projects Section (Compact Ledger) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                <Icon.Code className="h-4 w-4 text-signal" />
                <span>Standalone & Open-Source Projects ({filteredProjects.length})</span>
              </h2>
              <button
                onClick={() => setActiveDrawer({ type: 'project' })}
                className="font-mono text-xs text-signal hover:underline flex items-center gap-1 cursor-pointer font-semibold"
              >
                <Icon.Plus className="h-3.5 w-3.5" />
                <span>Add Project</span>
              </button>
            </div>

            {filteredProjects.length === 0 ? (
              <div className="rounded-xl border border-dashed border-edge/60 bg-surface/30 p-5 text-center text-xs text-muted font-mono">
                No standalone or open-source projects recorded.
              </div>
            ) : (
              <div className="rounded-xl border border-edge/80 bg-card/70 backdrop-blur-md divide-y divide-edge/40 shadow-md">
                {filteredProjects.map((proj) => {
                  const isProjCollapsed = Boolean(collapsedProjects[proj.id]);
                  const projBulletCount = proj.bullets?.length || 0;

                  return (
                    <div key={proj.id} className="transition-colors divide-y divide-edge/30">
                      {/* Project Header Row */}
                      <div className="py-2.5 px-3 sm:px-4 bg-surface/30 hover:bg-surface/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 group">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => toggleProject(proj.id)}
                            className="text-muted group-hover:text-signal transition-colors p-0.5 cursor-pointer shrink-0"
                            title={isProjCollapsed ? 'Expand project' : 'Collapse project'}
                          >
                            <Icon.ChevronDown className={`h-3.5 w-3.5 transition-transform ${isProjCollapsed ? '-rotate-90' : ''}`} />
                          </button>
                          <span
                            onClick={() => setActiveDrawer({ type: 'project', project: proj })}
                            className="font-mono text-sm font-bold text-content hover:text-signal transition-colors cursor-pointer"
                          >
                            {proj.name}
                          </span>
                          <span className="rounded bg-signal/15 text-signal px-1.5 py-0.2 font-mono text-[10px] font-bold">
                            {projBulletCount} {projBulletCount === 1 ? 'bullet' : 'bullets'}
                          </span>
                          {proj.repo_url && (
                            <Tooltip content="Open GitHub Repository" align="end">
                              <a
                                href={proj.repo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted hover:text-signal p-0.5 inline-flex items-center"
                              >
                                <Icon.Github className="h-3.5 w-3.5" />
                              </a>
                            </Tooltip>
                          )}
                          {proj.live_url && (
                            <Tooltip content="Open Live Project" align="end">
                              <a
                                href={proj.live_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted hover:text-signal p-0.5 inline-flex items-center"
                              >
                                <Icon.ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Tooltip>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 pl-6 sm:pl-0">
                          {/* Project Tech Stack Chips */}
                          <div className="hidden sm:flex items-center gap-1">
                            {(proj.tech_stack || []).slice(0, 4).map((tech) => (
                              <span
                                key={tech}
                                className="rounded bg-well/80 border border-edge/70 px-1.5 py-0.5 font-mono text-[10px] text-muted hover:text-content transition-colors"
                              >
                                #{tech}
                              </span>
                            ))}
                          </div>

                          {/* Hover Actions */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                            <Tooltip content="Add Bullet to Project" align="end">
                              <button
                                type="button"
                                onClick={() => setActiveDrawer({ type: 'bullet', projectId: proj.id, parentProject: proj })}
                                className="px-2 py-0.5 rounded bg-signal/10 hover:bg-signal/20 text-signal font-mono text-[10px] font-bold transition-all cursor-pointer"
                              >
                                + Bullet
                              </button>
                            </Tooltip>
                            <Tooltip content="Edit Project" align="end">
                              <button
                                type="button"
                                onClick={() => setActiveDrawer({ type: 'project', project: proj })}
                                className="p-1 rounded text-muted hover:text-content hover:bg-surface transition-colors cursor-pointer"
                              >
                                <Icon.Pencil className="h-3 w-3" />
                              </button>
                            </Tooltip>
                            <Tooltip content="Delete Project" align="end">
                              <button
                                type="button"
                                onClick={() => setItemToDelete({ type: 'project', id: proj.id, title: proj.name })}
                                className="p-1 rounded text-muted hover:text-red-400 hover:bg-surface transition-colors cursor-pointer"
                              >
                                <Icon.Trash className="h-3 w-3" />
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                      </div>

                      {/* Project Bullets */}
                      {!isProjCollapsed && (
                        <div className="py-1 px-3 sm:px-4 bg-card/30">
                          <div className="ml-4 pl-3.5 border-l border-edge/60 space-y-0.5 py-1">
                            {proj.bullets && proj.bullets.length > 0 ? (
                              proj.bullets.map((b) => (
                                <TreeBulletRow
                                  key={b.id}
                                  bullet={b}
                                  parentType="project"
                                  parentId={proj.id}
                                  allTargets={allMoveTargets}
                                  onSaveInline={handleSaveBulletInline}
                                  onMoveBullet={handleMoveBullet}
                                  onDelete={() => setItemToDelete({ type: 'bullet', id: b.id, title: 'bullet' })}
                                  onToggleStatus={handleToggleBulletStatus}
                                  onDragStart={handleBulletDragStart}
                                  onOpenInspector={(b) => setActiveDrawer({ type: 'bullet', bullet: b, projectId: proj.id, parentProject: proj })}
                                />
                              ))
                            ) : (
                              <div className="py-1 px-2 text-muted text-xs font-mono flex items-center justify-between">
                                <span>No project bullets added yet.</span>
                                <button
                                  type="button"
                                  onClick={() => setActiveDrawer({ type: 'bullet', projectId: proj.id, parentProject: proj })}
                                  className="text-signal hover:underline font-bold text-[11px] cursor-pointer"
                                >
                                  + Add First Bullet
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pillar 6: Academic Credentials & Education */}
          <div className="rounded-xl border border-edge/80 bg-card/70 backdrop-blur-md shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-surface/60 border-b border-edge/60 flex items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-content uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span className="text-signal font-black">λ</span>
                  <span>Education & Academic Credentials</span>
                </span>
                <span className="rounded bg-signal/15 text-signal px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider border border-signal/25">
                  Pillar 6
                </span>
                <span className="text-muted/50 hidden sm:inline">•</span>
                <span className="text-muted text-[11px] hidden sm:inline">
                  {portfolio.education?.length || 0} degrees & credentials
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveDrawer({ type: 'education' })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-edge/80 bg-well hover:bg-muted/15 px-2.5 py-1 text-xs font-mono font-bold text-content hover:text-signal transition-all cursor-pointer"
              >
                <Icon.Plus className="h-3.5 w-3.5 text-muted" />
                <span>Add Credential</span>
              </button>
            </div>

            {Array.isArray(portfolio.education) && portfolio.education.length > 0 ? (
              <div className="divide-y divide-edge/40">
                {portfolio.education.map((edu) => (
                  <div
                    key={edu.id}
                    className="p-4 sm:p-5 hover:bg-muted/5 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-3 group"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-content">
                          {edu.degree}
                        </span>
                        <span className="text-muted/60 text-xs hidden sm:inline">•</span>
                        <span className="font-mono text-xs text-signal font-semibold">
                          {edu.institution}
                        </span>
                        {edu.grade_or_gpa && (
                          <span className="text-[11px] font-mono px-2 py-0.2 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold">
                            {edu.grade_or_gpa}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs font-mono text-muted flex-wrap">
                        {(edu.start_date || edu.end_date) && (
                          <span>
                            {edu.start_date || ''} {edu.start_date && edu.end_date ? '–' : ''} {edu.end_date || 'Present'}
                          </span>
                        )}
                        {edu.location && (
                          <>
                            <span>•</span>
                            <span>{edu.location}</span>
                          </>
                        )}
                        {edu.field_of_study && (
                          <>
                            <span>•</span>
                            <span>Major: {edu.field_of_study}</span>
                          </>
                        )}
                      </div>

                      {Array.isArray(edu.bullets) && edu.bullets.length > 0 && (
                        <div className="pt-1.5 space-y-1">
                          {edu.bullets.map((b, bIdx) => (
                            <div key={bIdx} className="flex items-start gap-2 text-xs font-sans text-muted">
                              <span className="text-signal font-mono font-bold mt-0.5">•</span>
                              <span className="leading-relaxed">{b}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => setActiveDrawer({ type: 'education', education: edu })}
                        className="px-2.5 py-1 rounded-md text-xs font-mono font-bold text-muted hover:text-content hover:bg-muted/15 border border-edge/60 cursor-pointer"
                      >
                        Edit Credential
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs font-sans text-muted">
                  No academic credentials configured in your SSOT yet.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveDrawer({ type: 'education' })}
                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-signal hover:underline cursor-pointer"
                >
                  <Icon.Plus className="h-3.5 w-3.5" />
                  <span>+ Add First Degree or Certificate</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- UNIVERSAL SLIDE-OVER DRAWER --- */}
      <PortfolioDrawer
        entity={activeDrawer}
        onClose={() => setActiveDrawer(null)}
        onSaved={async () => {
          await loadData();
        }}
        onDeleteRequest={(item) => {
          setItemToDelete(item);
        }}
      />

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
// Sub-component: High-Density Tree-Ledger Bullet Row (Linear / VS Code style)
// -----------------------------------------------------------------------------

function splitBulletLead(text: string): { lead: string; rest: string } {
  const words = (text || '').trim().split(/\s+/);
  if (words.length <= 4) return { lead: text || '', rest: '' };
  const cut = Math.min(words.length, 4);
  const lead = words.slice(0, cut).join(' ');
  const rest = words.slice(cut).join(' ');
  return { lead, rest };
}

function extractImpactMetric(text: string): string | null {
  const match = (text || '').match(/(\d+(?:\.\d+)?%|\$\d+[kKmMbB]?|\b\d+x\b|\b\d+\s*(?:ms|seconds|minutes|hours|days|req\/s|rps|users|clients|microservices|pipelines)\b)/i);
  return match ? match[0] : null;
}

function TreeBulletRow({
  bullet,
  parentType,
  parentId,
  allTargets,
  onSaveInline,
  onMoveBullet,
  onDelete,
  onToggleStatus,
  onDragStart,
  onOpenInspector,
}: {
  bullet: MasterBullet;
  parentType: 'company' | 'product' | 'project';
  parentId: string;
  allTargets: Array<{ id: string; name: string; type: 'company' | 'product'; companyName: string }>;
  onSaveInline: (bulletId: string, newText: string) => Promise<void>;
  onMoveBullet: (bullet: MasterBullet, targetType: 'company' | 'product', targetId: string) => Promise<void>;
  onDelete: () => void;
  onToggleStatus: (bullet: MasterBullet) => Promise<void>;
  onDragStart: (e: React.DragEvent, bullet: MasterBullet, parentId: string) => void;
  onOpenInspector: (bullet: MasterBullet) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(bullet.bullet_text || '');
  const [saving, setSaving] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showDefense, setShowDefense] = useState(false);

  const { lead, rest } = useMemo(() => splitBulletLead(bullet.bullet_text), [bullet.bullet_text]);
  const primaryMetric = useMemo(
    () => bullet.metric_primary || extractImpactMetric(bullet.bullet_text),
    [bullet.bullet_text, bullet.metric_primary]
  );

  const handleSave = async () => {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await onSaveInline(bullet.id, editText.trim());
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditText(bullet.bullet_text || '');
    setIsEditing(false);
  };

  return (
    <div
      draggable={!isEditing}
      onDragStart={(e) => onDragStart(e, bullet, parentId)}
      className={`group flex flex-col py-1 px-2 rounded-md hover:bg-surface/50 transition-colors relative ${showMoveMenu ? 'z-30' : 'hover:z-10'}`}
    >
      <div className="flex items-start justify-between gap-2.5">
        {/* Left: Drag Handle + Status Indicator Dot + Content */}
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* 6-dot Drag Handle */}
          <Tooltip content="Drag to reorder or reassign">
            <span
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 cursor-grab active:cursor-grabbing text-muted transition-opacity pt-1 shrink-0"
            >
              <Icon.GripVertical className="h-3.5 w-3.5" />
            </span>
          </Tooltip>

          {/* 6px Status Dot (Clickable cycle: approved -> needs_review -> draft) */}
          <Tooltip content={`Status: ${bullet.review_status.replace('_', ' ')} · Click to cycle`}>
            <button
              type="button"
              onClick={() => onToggleStatus(bullet)}
              className="pt-1.5 shrink-0 focus:outline-none cursor-pointer"
            >
              <span
                className={`block h-1.5 w-1.5 rounded-full transition-all ${
                  bullet.review_status === 'approved'
                    ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                    : bullet.review_status === 'needs_review'
                    ? 'bg-amber-400'
                    : 'bg-muted/60'
                }`}
              />
            </button>
          </Tooltip>

          {/* Inline Edit Mode vs Normal Presentation */}
          {isEditing ? (
            <div className="flex-1 space-y-1.5 animate-in fade-in duration-100">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSave();
                  } else if (e.key === 'Escape') {
                    handleCancel();
                  }
                }}
                autoFocus
                rows={2}
                disabled={saving}
                className="w-full rounded bg-surface border border-signal px-2 py-1 text-xs text-content focus:outline-none font-sans leading-relaxed resize-y"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-2.5 py-0.5 rounded bg-signal hover:bg-signal-hover text-surface font-mono text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  {saving && <Icon.Spinner className="h-3 w-3 animate-spin" />}
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-2 py-0.5 rounded border border-edge text-muted hover:text-content font-mono text-[11px] transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <span className="text-[10px] font-mono text-muted/60">
                  Press Enter to save · Esc to cancel
                </span>
              </div>
            </div>
          ) : (
            <div
              onDoubleClick={() => setIsEditing(true)}
              className="flex-1 min-w-0 text-xs sm:text-[13px] leading-relaxed cursor-text select-text"
              title="Double-click to edit inline"
            >
              <span className="font-semibold text-content">{lead}</span>{' '}
              <span className="text-content/75 dark:text-muted leading-relaxed">{rest}</span>
            </div>
          )}
        </div>

        {/* Right: Detected Impact Metric Pill + Hover Micro-Actions */}
        {!isEditing && (
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            {primaryMetric && (
              <Tooltip content="Quantified ATS Impact Metric" align="end">
                <span
                  className="rounded bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0"
                >
                  {primaryMetric}
                </span>
              </Tooltip>
            )}

            {/* Hover Actions: Edit inline, Move to target, Toggle Trade-offs, Delete */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
              {(bullet.context_challenge || bullet.defense_notes) && (
                <Tooltip content={showDefense ? "Hide Architecture Defense" : "View Architecture Defense & Trade-offs"} align="end">
                  <button
                    type="button"
                    onClick={() => setShowDefense(!showDefense)}
                    className={`p-1 rounded transition-colors cursor-pointer ${showDefense ? 'text-signal bg-surface' : 'text-muted hover:text-content hover:bg-surface'}`}
                  >
                    <Icon.Shield className="h-3 w-3" />
                  </button>
                </Tooltip>
              )}

              <Tooltip content="Inspect Details & Defense in Drawer" align="end">
                <button
                  type="button"
                  onClick={() => onOpenInspector(bullet)}
                  className="p-1 rounded text-muted hover:text-signal hover:bg-surface transition-colors cursor-pointer"
                >
                  <Icon.Sidebar className="h-3 w-3" />
                </button>
              </Tooltip>

              <Tooltip content="Edit Bullet inline (or double-click)" align="end">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="p-1 rounded text-muted hover:text-content hover:bg-surface transition-colors cursor-pointer"
                >
                  <Icon.Pencil className="h-3 w-3" />
                </button>
              </Tooltip>

              {/* Move to target dropdown menu */}
              <div className="relative">
                <Tooltip content="Move to another Product or Company" align="end">
                  <button
                    type="button"
                    onClick={() => setShowMoveMenu(!showMoveMenu)}
                    className={`p-1 rounded transition-colors cursor-pointer ${showMoveMenu ? 'text-signal bg-surface' : 'text-muted hover:text-content hover:bg-surface'}`}
                  >
                    <Icon.ArrowLeftRight className="h-3 w-3" />
                  </button>
                </Tooltip>

                {showMoveMenu && (
                  <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl border border-edge bg-card shadow-2xl p-1.5 text-xs font-mono animate-in fade-in zoom-in-95">
                    <div className="px-2 py-1 text-[10px] font-bold text-muted uppercase tracking-wider border-b border-edge/60">
                      Move bullet to:
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-0.5 py-1">
                      {allTargets
                        .filter((t) => t.id !== parentId)
                        .map((target) => (
                          <button
                            key={target.id}
                            type="button"
                            onClick={async () => {
                              setShowMoveMenu(false);
                              await onMoveBullet(bullet, target.type, target.id);
                            }}
                            className="w-full text-left px-2 py-1 rounded hover:bg-surface text-content hover:text-signal truncate block text-[11px] cursor-pointer"
                          >
                            <span className="text-muted/70 text-[9px] block uppercase">{target.companyName}</span>
                            <span>{target.name}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <Tooltip content="Delete Bullet" align="end">
                <button
                  type="button"
                  onClick={onDelete}
                  className="p-1 rounded text-muted hover:text-red-400 hover:bg-surface transition-colors cursor-pointer"
                >
                  <Icon.Trash className="h-3 w-3" />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
      </div>

      {/* Expandable Architectural Defense Context */}
      {showDefense && (bullet.context_challenge || bullet.defense_notes) && (
        <div className="mt-1.5 ml-6 rounded-md border border-edge/70 bg-surface/70 p-2 text-xs font-mono space-y-1 animate-in fade-in duration-150">
          {bullet.context_challenge && (
            <div>
              <span className="text-signal text-[10px] font-bold uppercase tracking-wider block">Engineering Challenge:</span>
              <p className="font-sans text-xs text-content/90">{bullet.context_challenge}</p>
            </div>
          )}
          {bullet.defense_notes && (
            <div>
              <span className="text-signal text-[10px] font-bold uppercase tracking-wider block">Trade-off Defense:</span>
              <p className="font-sans text-xs text-content/90">{bullet.defense_notes}</p>
            </div>
          )}
        </div>
      )}
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
  const [replaceExisting, setReplaceExisting] = useState(true);
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
      let expToImport = target.experience || [];
      let projToImport = target.projects || [];
      let identityToImport = {
        full_name: target.fullName || '',
        headline: target.targetRoleType || 'Software Engineer',
        email: target.email || '',
        phone: target.phone || '',
        location: target.location || '',
        github_url: target.githubUrl || '',
        linkedin_url: target.linkedinUrl || '',
        portfolio_url: target.portfolioUrl || '',
      };
      let summaryToImport = target.summary || '';
      let skillsToImport = target.skills || [];
      let educationToImport = target.education || [];

      if (target.rawCleanText && target.rawCleanText.trim().length > 40) {
        const reparsed = parseUploadedResumeText(target.rawCleanText, target.sourceFileName);
        if (reparsed.fullName) {
          identityToImport.full_name = reparsed.fullName;
        }
        if (reparsed.email) identityToImport.email = reparsed.email;
        if (reparsed.phone) identityToImport.phone = reparsed.phone;
        if (reparsed.location) identityToImport.location = reparsed.location;
        if (reparsed.githubUrl) identityToImport.github_url = reparsed.githubUrl;
        if (reparsed.linkedinUrl) identityToImport.linkedin_url = reparsed.linkedinUrl;
        if (reparsed.portfolioUrl) identityToImport.portfolio_url = reparsed.portfolioUrl;
        if (reparsed.targetRoleType) identityToImport.headline = reparsed.targetRoleType;

        if (reparsed.summary) summaryToImport = reparsed.summary;
        if (reparsed.skills && reparsed.skills.length > 0) skillsToImport = reparsed.skills;
        if (reparsed.education && reparsed.education.length > 0) educationToImport = reparsed.education;
        if (reparsed.experience && reparsed.experience.length > 0) {
          expToImport = reparsed.experience;
        }
        if (reparsed.projects && reparsed.projects.length > 0) {
          projToImport = reparsed.projects;
        }
      }
      const res = await bootstrapPortfolioFromResume({
        experience: expToImport,
        projects: projToImport,
        education: educationToImport,
        skills: skillsToImport,
        summary: summaryToImport,
        identity: identityToImport,
        replaceExisting,
      });
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

            <label className="flex items-center gap-2.5 rounded-xl border border-edge bg-surface/60 px-3.5 py-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-edge accent-signal cursor-pointer"
              />
              <span className="font-sans text-xs text-content">
                Clean slate: replace existing SSOT records with this import
              </span>
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
