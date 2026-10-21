/**
 * Portfolio Single Source of Truth (SSOT) Client Library
 * Developer CareerOS
 *
 * Interfaces and API client for:
 * - Companies & Organizations
 * - Products & Sub-systems
 * - Standalone / Open-Source Projects
 * - Atomic Master Bullets & Provenance
 * - One-click Resume Vault to Portfolio SSOT Bootstrap
 */

import { API_URL } from './config';
import { authHeaders } from './auth';

export interface MasterBullet {
  id: string;
  user_id?: string;
  product_id?: string | null;
  project_id?: string | null;
  bullet_text: string;
  action_verb?: string | null;
  metric_primary?: string | null;
  tech_stack?: string[];
  context_challenge?: string | null;
  defense_notes?: string | null;
  source_type: 'manual' | 'docx_import' | 'git_digest' | 'pr_artifact' | 'interview_probe';
  review_status: 'draft' | 'needs_review' | 'approved';
  git_commit_sha?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioProduct {
  id: string;
  user_id?: string;
  company_id: string;
  name: string;
  architecture_type?: string | null;
  repo_url?: string | null;
  live_url?: string | null;
  tech_stack?: string[];
  display_order?: number;
  bullets?: MasterBullet[];
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioCompany {
  id: string;
  user_id?: string;
  name: string;
  domain?: string | null;
  website_url?: string | null;
  role_title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
  location?: string | null;
  display_order?: number;
  products?: PortfolioProduct[];
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioProject {
  id: string;
  user_id?: string;
  name: string;
  headline?: string | null;
  repo_url?: string | null;
  live_url?: string | null;
  tech_stack?: string[];
  display_order?: number;
  bullets?: MasterBullet[];
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioSSOT {
  companies: PortfolioCompany[];
  standalone_projects: PortfolioProject[];
  unattached_bullets: MasterBullet[];
}

const LOCAL_STORAGE_KEY = 'gitgrill_portfolio_ssot_local_v1';
const COMPANY_ROLES_MAP_KEY = 'gitgrill_company_roles_map_v1';

export function getStoredCompanyRoles(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(COMPANY_ROLES_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setStoredCompanyRole(companyId: string, roleTitle: string | null | undefined): void {
  if (typeof window === 'undefined' || !companyId) return;
  try {
    const roles = getStoredCompanyRoles();
    if (roleTitle && roleTitle.trim()) {
      roles[companyId] = roleTitle.trim();
    } else {
      delete roles[companyId];
    }
    localStorage.setItem(COMPANY_ROLES_MAP_KEY, JSON.stringify(roles));
  } catch {}
}

export function deleteStoredCompanyRole(companyId: string): void {
  if (typeof window === 'undefined' || !companyId) return;
  try {
    const roles = getStoredCompanyRoles();
    delete roles[companyId];
    localStorage.setItem(COMPANY_ROLES_MAP_KEY, JSON.stringify(roles));
  } catch {}
}

export function getLocalPortfolio(): PortfolioSSOT {
  if (typeof window === 'undefined') {
    return { companies: [], standalone_projects: [], unattached_bullets: [] };
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to read local portfolio SSOT', err);
  }
  return { companies: [], standalone_projects: [], unattached_bullets: [] };
}

export const getPortfolioSSOTLocal = getLocalPortfolio;

export function countTotalMasterBullets(portfolio?: PortfolioSSOT | null): number {
  if (!portfolio) return 0;
  let count = 0;
  portfolio.companies?.forEach((c) => c.products?.forEach((p) => { count += (p.bullets?.length || 0); }));
  portfolio.standalone_projects?.forEach((pr) => { count += (pr.bullets?.length || 0); });
  count += (portfolio.unattached_bullets?.length || 0);
  return count;
}

function saveLocalPortfolio(data: PortfolioSSOT): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save local portfolio SSOT', err);
  }
}

/**
 * Fetch complete structured portfolio hierarchy
 */
export async function fetchPortfolio(): Promise<PortfolioSSOT> {
  const headers = await authHeaders();
  if (headers.Authorization) {
    try {
      const res = await fetch(`${API_URL}/api/portfolio`, {
        headers: {
          'content-type': 'application/json',
          ...headers,
        },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const localRoles = getStoredCompanyRoles();
        const normalizedCompanies: PortfolioCompany[] = (data.companies || []).map((c: any) => {
          const products = (c.products || []).map((p: any) => {
            const name = p.name || p.title || '';
            const architecture_type = p.architecture_type || p.architectural_notes || null;
            let live_url = p.live_url || null;
            if (!live_url && typeof p.description === 'string' && p.description.startsWith('Live: ')) {
              live_url = p.description.slice(6).trim();
            }
            let repo_url = p.repo_url || null;
            if (!repo_url && Array.isArray(p.repo_links) && p.repo_links[0]?.url) {
              repo_url = p.repo_links[0].url;
            }
            return {
              ...p,
              name,
              architecture_type,
              live_url,
              repo_url,
              tech_stack: Array.isArray(p.tech_stack) ? p.tech_stack : [],
              bullets: Array.isArray(p.bullets) ? p.bullets : [],
            };
          });
          // Prioritize: explicit user role saved for this company > c.role_title from DB > child product fallback
          const explicitRole = localRoles[c.id];
          const inferredRole = explicitRole || c.role_title || products.find((p: any) => p.role_title)?.role_title || null;
          const resolvedDomain = c.domain || c.website_url || null;
          return {
            ...c,
            domain: resolvedDomain,
            website_url: resolvedDomain,
            role_title: inferredRole,
            products,
          };
        });

        const ssot: PortfolioSSOT = {
          companies: normalizedCompanies,
          standalone_projects: (data.standalone_projects || []).map((pr: any) => ({
            ...pr,
            tech_stack: Array.isArray(pr.tech_stack) ? pr.tech_stack : [],
            bullets: Array.isArray(pr.bullets) ? pr.bullets : [],
          })),
          unattached_bullets: data.unattached_bullets || [],
        };
        // Update local cache
        saveLocalPortfolio(ssot);
        return ssot;
      }
    } catch (err) {
      console.warn('[portfolio] Fetch from backend failed, falling back to local storage cache', err);
    }
  }

  return getLocalPortfolio();
}

/**
 * Normalize human date strings (e.g. "Jun 2026", "2026-06", "06/2026", "Jan 2022")
 * into valid Postgres/ISO YYYY-MM-DD date strings ("2026-06-01").
 */
export function normalizeDateToISO(val: string | null | undefined): string | null {
  if (!val || typeof val !== 'string' || !val.trim()) return null;
  const s = val.trim();

  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // If YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;

  // If MM/YYYY or M/YYYY
  const mmyyyy = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmyyyy) {
    const month = mmyyyy[1].padStart(2, '0');
    return `${mmyyyy[2]}-${month}-01`;
  }

  // If Month Year (e.g. "Jun 2026", "June 2026", "Jan 2022")
  const monthMap: Record<string, string> = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', sept: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  };

  const nameMatch = s.match(/^([a-zA-Z]+)[,\s]+(\d{4})$/);
  if (nameMatch) {
    const mStr = nameMatch[1].toLowerCase();
    const year = nameMatch[2];
    const mNum = monthMap[mStr];
    if (mNum) return `${year}-${mNum}-01`;
  }

  // If Year only: "2026"
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;

  // Fallback: try standard JS Date
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

/**
 * Format ISO dates (e.g. "2026-06-01") for elegant human display ("Jun 2026").
 */
export function formatISODateToDisplay(iso: string | null | undefined): string {
  if (!iso || typeof iso !== 'string' || !iso.trim()) return '';
  const clean = iso.trim();
  const match = clean.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
  if (!match) return clean;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIdx = parseInt(match[2], 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${monthNames[monthIdx]} ${match[1]}`;
  }
  return clean;
}

/**
 * Maps raw backend/database error strings into user-friendly messages.
 */
export function humanizePortfolioError(raw: string | undefined | null, fallback = 'Operation failed. Please try again.'): string {
  if (!raw) return fallback;
  if (raw.includes('violates foreign key constraint') || raw.includes('user_id_fkey') || raw.includes('portfolio_companies_user_id_fkey')) {
    return 'User profile could not be synchronized. Please try saving again.';
  }
  if (raw.includes('company_id') || raw.includes('role_title') || raw.includes('title are required')) {
    return 'Product name is required. Please verify inputs and try again.';
  }
  if (raw.includes('invalid input syntax for type date')) {
    return 'Please enter a valid date (e.g. Jun 2026, 2026-06, or Jan 2022).';
  }
  if (raw.includes('duplicate key') || raw.includes('unique constraint')) {
    return 'An item with this name already exists in your portfolio.';
  }
  if (raw.includes('syntax error') || raw.includes('relation ') || raw.includes('violates')) {
    return fallback;
  }
  return raw;
}

/**
 * Save / Update a Company
 */
export async function saveCompany(
  company: Partial<PortfolioCompany> & { name: string; website_url?: string | null }
): Promise<PortfolioCompany> {
  const normalizedStart = normalizeDateToISO(company.start_date) || (company.start_date ? null : new Date().toISOString().slice(0, 10));
  const normalizedEnd = company.is_current ? null : normalizeDateToISO(company.end_date);

  const payload = {
    ...company,
    domain: company.domain || company.website_url || null,
    website_url: company.website_url || company.domain || null,
    start_date: normalizedStart,
    end_date: normalizedEnd,
  };

  const headers = await authHeaders();
  if (headers.Authorization) {
    const res = await fetch(`${API_URL}/api/portfolio/companies`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(humanizePortfolioError(errJson.error, 'Failed to save company.'));
    }
    const data = await res.json();
    const resolvedDomain = data.company?.domain || data.company?.website_url || payload.domain || payload.website_url || null;
    const finalRoleId = data.company?.id || company.id;
    if (finalRoleId) {
      setStoredCompanyRole(finalRoleId, payload.role_title);
    }
    const finalComp: PortfolioCompany = {
      ...data.company,
      domain: resolvedDomain,
      website_url: resolvedDomain,
      role_title: payload.role_title ?? (data.company?.role_title || null),
    };
    // Update local cache immediately so it's always in sync
    try {
      const local = getLocalPortfolio();
      const existingIdx = local.companies.findIndex((c) => c.id === finalComp.id);
      if (existingIdx >= 0) {
        local.companies[existingIdx] = {
          ...local.companies[existingIdx],
          ...finalComp,
          products: finalComp.products || local.companies[existingIdx].products || [],
        };
      } else {
        local.companies.unshift(finalComp);
      }
      saveLocalPortfolio(local);
    } catch {}
    return finalComp;
  }

  // Local fallback
  const local = getLocalPortfolio();
  const id = company.id || `comp_${Date.now()}`;
  if (id) {
    setStoredCompanyRole(id, payload.role_title);
  }
  const existingIdx = local.companies.findIndex((c) => c.id === id);
  const now = new Date().toISOString();

  const record: PortfolioCompany = {
    id,
    name: payload.name,
    domain: payload.domain || null,
    role_title: payload.role_title || null,
    start_date: payload.start_date || null,
    end_date: payload.end_date || null,
    is_current: !!payload.is_current,
    location: payload.location || null,
    display_order: payload.display_order ?? local.companies.length,
    products: existingIdx >= 0 ? local.companies[existingIdx].products : [],
    created_at: existingIdx >= 0 ? local.companies[existingIdx].created_at : now,
    updated_at: now,
  };

  if (existingIdx >= 0) {
    local.companies[existingIdx] = record;
  } else {
    local.companies.unshift(record);
  }
  saveLocalPortfolio(local);
  return record;
}

/**
 * Delete a Company
 */
export async function deleteCompany(id: string): Promise<void> {
  const headers = await authHeaders();
  if (headers.Authorization) {
    const res = await fetch(`${API_URL}/api/portfolio/companies/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(humanizePortfolioError(errJson.error, 'Failed to delete company.'));
    }
  }

  deleteStoredCompanyRole(id);
  const local = getLocalPortfolio();
  local.companies = local.companies.filter((c) => c.id !== id);
  saveLocalPortfolio(local);
}

/**
 * Save / Update a Product
 */
export async function saveProduct(
  product: Partial<PortfolioProduct> & { company_id: string; name: string; role_title?: string; title?: string }
): Promise<PortfolioProduct> {
  const local = getLocalPortfolio();
  const parentCompany = local.companies.find((c) => c.id === product.company_id);
  const resolvedRole = product.role_title?.trim() || parentCompany?.role_title?.trim() || 'Software Engineer';
  const resolvedTitle = product.name?.trim() || product.title?.trim() || '';

  const payload: any = {
    ...product,
    company_id: product.company_id,
    title: resolvedTitle,
    name: resolvedTitle,
    role_title: resolvedRole,
    description: (product as any).description || (product.live_url ? `Live: ${product.live_url}` : null),
    architectural_notes: product.architecture_type || null,
    tech_stack: Array.isArray(product.tech_stack) ? product.tech_stack : [],
    repo_links: product.repo_url ? [{ name: resolvedTitle, provider: 'github', url: product.repo_url }] : [],
  };

  const headers = await authHeaders();
  if (headers.Authorization) {
    const res = await fetch(`${API_URL}/api/portfolio/products`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(humanizePortfolioError(errJson.error, 'Failed to save product.'));
    }
    const data = await res.json();
    const prod = data.product;
    return {
      ...prod,
      name: prod?.title || prod?.name || resolvedTitle,
      architecture_type: prod?.architectural_notes || product.architecture_type || null,
      live_url: product.live_url || null,
      repo_url: product.repo_url || null,
      tech_stack: Array.isArray(prod?.tech_stack) ? prod.tech_stack : (product.tech_stack || []),
    };
  }

  // Local fallback
  const company = local.companies.find((c) => c.id === product.company_id);
  if (!company) throw new Error('Company not found.');
  if (!company.products) company.products = [];

  const id = product.id || `prod_${Date.now()}`;
  const existingIdx = company.products.findIndex((p) => p.id === id);
  const now = new Date().toISOString();

  const record: PortfolioProduct = {
    id,
    company_id: product.company_id,
    name: product.name,
    architecture_type: product.architecture_type || null,
    repo_url: product.repo_url || null,
    live_url: product.live_url || null,
    tech_stack: Array.isArray(product.tech_stack) ? product.tech_stack : [],
    display_order: product.display_order ?? company.products.length,
    bullets: existingIdx >= 0 ? company.products[existingIdx].bullets : [],
    created_at: existingIdx >= 0 ? company.products[existingIdx].created_at : now,
    updated_at: now,
  };

  if (existingIdx >= 0) {
    company.products[existingIdx] = record;
  } else {
    company.products.push(record);
  }
  saveLocalPortfolio(local);
  return record;
}

/**
 * Delete a Product
 */
export async function deleteProduct(id: string): Promise<void> {
  const headers = await authHeaders();
  if (headers.Authorization) {
    const res = await fetch(`${API_URL}/api/portfolio/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(humanizePortfolioError(errJson.error, 'Failed to delete product.'));
    }
  }

  const local = getLocalPortfolio();
  for (const c of local.companies) {
    if (c.products) {
      c.products = c.products.filter((p) => p.id !== id);
    }
  }
  saveLocalPortfolio(local);
}

/**
 * Save / Update a Standalone Project
 */
export async function saveProject(
  project: Partial<PortfolioProject> & { name: string }
): Promise<PortfolioProject> {
  const headers = await authHeaders();
  if (headers.Authorization) {
    const res = await fetch(`${API_URL}/api/portfolio/projects`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(project),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(humanizePortfolioError(errJson.error, 'Failed to save project.'));
    }
    const data = await res.json();
    return data.project;
  }

  // Local fallback
  const local = getLocalPortfolio();
  const id = project.id || `proj_${Date.now()}`;
  const existingIdx = local.standalone_projects.findIndex((p) => p.id === id);
  const now = new Date().toISOString();

  const record: PortfolioProject = {
    id,
    name: project.name,
    headline: project.headline || null,
    repo_url: project.repo_url || null,
    live_url: project.live_url || null,
    tech_stack: Array.isArray(project.tech_stack) ? project.tech_stack : [],
    display_order: project.display_order ?? local.standalone_projects.length,
    bullets: existingIdx >= 0 ? local.standalone_projects[existingIdx].bullets : [],
    created_at: existingIdx >= 0 ? local.standalone_projects[existingIdx].created_at : now,
    updated_at: now,
  };

  if (existingIdx >= 0) {
    local.standalone_projects[existingIdx] = record;
  } else {
    local.standalone_projects.push(record);
  }
  saveLocalPortfolio(local);
  return record;
}

/**
 * Delete a Standalone Project
 */
export async function deleteProject(id: string): Promise<void> {
  const headers = await authHeaders();
  if (headers.Authorization) {
    const res = await fetch(`${API_URL}/api/portfolio/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(humanizePortfolioError(errJson.error, 'Failed to delete project.'));
    }
  }

  const local = getLocalPortfolio();
  local.standalone_projects = local.standalone_projects.filter((p) => p.id !== id);
  saveLocalPortfolio(local);
}

/**
 * Save / Update a Master Bullet
 */
export async function saveBullet(
  bullet: Partial<MasterBullet> & { bullet_text: string }
): Promise<MasterBullet> {
  const headers = await authHeaders();
  if (headers.Authorization) {
    const res = await fetch(`${API_URL}/api/portfolio/bullets`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(bullet),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(humanizePortfolioError(errJson.error, 'Failed to save bullet.'));
    }
    const data = await res.json();
    return data.bullet;
  }

  // Local fallback
  const local = getLocalPortfolio();
  const id = bullet.id || `bullet_${Date.now()}`;
  const now = new Date().toISOString();

  const record: MasterBullet = {
    id,
    product_id: bullet.product_id || null,
    project_id: bullet.project_id || null,
    bullet_text: bullet.bullet_text,
    action_verb: bullet.action_verb || null,
    metric_primary: bullet.metric_primary || null,
    tech_stack: bullet.tech_stack || [],
    context_challenge: bullet.context_challenge || null,
    defense_notes: bullet.defense_notes || null,
    source_type: bullet.source_type || 'manual',
    review_status: bullet.review_status || 'approved',
    git_commit_sha: bullet.git_commit_sha || null,
    created_at: now,
    updated_at: now,
  };

  if (bullet.product_id) {
    for (const c of local.companies) {
      const prod = c.products?.find((p) => p.id === bullet.product_id);
      if (prod) {
        if (!prod.bullets) prod.bullets = [];
        const bIdx = prod.bullets.findIndex((b) => b.id === id);
        if (bIdx >= 0) prod.bullets[bIdx] = record;
        else prod.bullets.push(record);
      }
    }
  } else if (bullet.project_id) {
    const proj = local.standalone_projects.find((p) => p.id === bullet.project_id);
    if (proj) {
      if (!proj.bullets) proj.bullets = [];
      const bIdx = proj.bullets.findIndex((b) => b.id === id);
      if (bIdx >= 0) proj.bullets[bIdx] = record;
      else proj.bullets.push(record);
    }
  } else {
    const bIdx = local.unattached_bullets.findIndex((b) => b.id === id);
    if (bIdx >= 0) local.unattached_bullets[bIdx] = record;
    else local.unattached_bullets.push(record);
  }

  saveLocalPortfolio(local);
  return record;
}

/**
 * Delete a Master Bullet
 */
export async function deleteBullet(id: string): Promise<void> {
  const headers = await authHeaders();
  if (headers.Authorization) {
    const res = await fetch(`${API_URL}/api/portfolio/bullets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to delete bullet.');
    }
  }

  const local = getLocalPortfolio();
  for (const c of local.companies) {
    if (c.products) {
      for (const p of c.products) {
        if (p.bullets) p.bullets = p.bullets.filter((b) => b.id !== id);
      }
    }
  }
  for (const proj of local.standalone_projects) {
    if (proj.bullets) proj.bullets = proj.bullets.filter((b) => b.id !== id);
  }
  local.unattached_bullets = local.unattached_bullets.filter((b) => b.id !== id);
  saveLocalPortfolio(local);
}

/**
 * 1-Click Bootstrap from existing parsed resume profile
 */
export async function bootstrapPortfolioFromResume(
  experience: any[],
  projects: any[]
): Promise<{ ok: boolean; imported: { companies: number; products: number; projects: number; bullets: number } }> {
  const headers = await authHeaders();
  if (headers.Authorization) {
    const res = await fetch(`${API_URL}/api/portfolio/bootstrap-from-resume`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ experience, projects }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(humanizePortfolioError(errJson.error, 'Failed to bootstrap portfolio.'));
    }
    return await res.json();
  }

  // Local bootstrap simulation
  const local = getLocalPortfolio();
  let compCount = 0;
  let prodCount = 0;
  let projCount = 0;
  let bulletCount = 0;

  if (Array.isArray(experience)) {
    for (let i = 0; i < experience.length; i++) {
      const exp = experience[i];
      if (!exp.company) continue;
      const compId = `comp_${Date.now()}_${i}`;
      const prodId = `prod_${Date.now()}_${i}`;

      const bullets: MasterBullet[] = Array.isArray(exp.bullets)
        ? exp.bullets.map((b: string, bIdx: number) => ({
            id: `bullet_${Date.now()}_${i}_${bIdx}`,
            product_id: prodId,
            bullet_text: b,
            source_type: 'docx_import',
            review_status: 'approved',
          }))
        : [];

      const product: PortfolioProduct = {
        id: prodId,
        company_id: compId,
        name: 'Core System & Product Line',
        architecture_type: 'monolith_to_microservices',
        bullets,
      };

      const company: PortfolioCompany = {
        id: compId,
        name: exp.company,
        role_title: exp.role || null,
        location: exp.location || null,
        display_order: i,
        products: [product],
      };

      local.companies.push(company);
      compCount++;
      prodCount++;
      bulletCount += bullets.length;
    }
  }

  if (Array.isArray(projects)) {
    for (let j = 0; j < projects.length; j++) {
      const p = projects[j];
      if (!p.name) continue;
      const projId = `proj_${Date.now()}_${j}`;

      const bullets: MasterBullet[] = Array.isArray(p.bullets)
        ? p.bullets.map((b: string, bIdx: number) => ({
            id: `bullet_proj_${Date.now()}_${j}_${bIdx}`,
            project_id: projId,
            bullet_text: b,
            source_type: 'docx_import',
            review_status: 'approved',
          }))
        : [];

      local.standalone_projects.push({
        id: projId,
        name: p.name,
        headline: p.description || null,
        live_url: p.link || null,
        display_order: j,
        bullets,
      });

      projCount++;
      bulletCount += bullets.length;
    }
  }

  saveLocalPortfolio(local);
  return {
    ok: true,
    imported: {
      companies: compCount,
      products: prodCount,
      projects: projCount,
      bullets: bulletCount,
    },
  };
}
