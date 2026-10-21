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

function getLocalPortfolio(): PortfolioSSOT {
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
        const ssot: PortfolioSSOT = {
          companies: data.companies || [],
          standalone_projects: data.standalone_projects || [],
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
 * Save / Update a Company
 */
export async function saveCompany(
  company: Partial<PortfolioCompany> & { name: string }
): Promise<PortfolioCompany> {
  const headers = await authHeaders();
  if (headers.Authorization) {
    const res = await fetch(`${API_URL}/api/portfolio/companies`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(company),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to save company.');
    }
    const data = await res.json();
    return data.company;
  }

  // Local fallback
  const local = getLocalPortfolio();
  const id = company.id || `comp_${Date.now()}`;
  const existingIdx = local.companies.findIndex((c) => c.id === id);
  const now = new Date().toISOString();

  const record: PortfolioCompany = {
    id,
    name: company.name,
    domain: company.domain || null,
    role_title: company.role_title || null,
    start_date: company.start_date || null,
    end_date: company.end_date || null,
    is_current: !!company.is_current,
    location: company.location || null,
    display_order: company.display_order ?? local.companies.length,
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
      throw new Error(errJson.error || 'Failed to delete company.');
    }
  }

  const local = getLocalPortfolio();
  local.companies = local.companies.filter((c) => c.id !== id);
  saveLocalPortfolio(local);
}

/**
 * Save / Update a Product
 */
export async function saveProduct(
  product: Partial<PortfolioProduct> & { company_id: string; name: string }
): Promise<PortfolioProduct> {
  const headers = await authHeaders();
  if (headers.Authorization) {
    const res = await fetch(`${API_URL}/api/portfolio/products`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(product),
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Failed to save product.');
    }
    const data = await res.json();
    return data.product;
  }

  // Local fallback
  const local = getLocalPortfolio();
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
      throw new Error(errJson.error || 'Failed to delete product.');
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
      throw new Error(errJson.error || 'Failed to save project.');
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
      throw new Error(errJson.error || 'Failed to delete project.');
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
      throw new Error(errJson.error || 'Failed to save bullet.');
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
      throw new Error(errJson.error || 'Failed to bootstrap portfolio.');
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
