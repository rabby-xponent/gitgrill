/**
 * Portfolio SSOT Routes (Developer CareerOS)
 *
 * Provides CRUD operations for the Living Portfolio Single Source of Truth:
 * - Companies & Organizations worked at
 * - Products & Sub-systems owned within each company
 * - Standalone & Open-Source Projects
 * - Atomic Master Bullets & Provenance
 * - One-click resume bootstrap import
 */

import { Router, Request, Response } from 'express';
import { getAdmin, isDbConfigured } from '../db/supabase';
import { requireAuth } from '../auth/middleware';

const router = Router();

function serviceUnavailable(res: Response): void {
  res.status(503).json({ error: 'Portfolio database is not configured on this deployment yet.' });
}

// ---------------------------------------------------------------------------
// 1. GET /api/portfolio — Fetch complete structured portfolio hierarchy
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;

  try {
    const [companiesRes, productsRes, projectsRes, bulletsRes] = await Promise.all([
      admin.from('portfolio_companies').select('*').eq('user_id', userId).order('start_date', { ascending: false }),
      admin.from('portfolio_products').select('*').eq('user_id', userId).order('display_order', { ascending: true }),
      admin.from('portfolio_projects').select('*').eq('user_id', userId).order('display_order', { ascending: true }),
      admin.from('master_bullets').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    ]);

    if (companiesRes.error) throw new Error(companiesRes.error.message);
    if (productsRes.error) throw new Error(productsRes.error.message);
    if (projectsRes.error) throw new Error(projectsRes.error.message);
    if (bulletsRes.error) throw new Error(bulletsRes.error.message);

    const bullets = bulletsRes.data ?? [];
    const products = productsRes.data ?? [];
    const projects = projectsRes.data ?? [];
    const companies = companiesRes.data ?? [];

    // Map bullets by product_id and project_id
    const bulletsByProduct = new Map<string, any[]>();
    const bulletsByProject = new Map<string, any[]>();
    const unattachedBullets: any[] = [];

    for (const b of bullets) {
      if (b.product_id) {
        if (!bulletsByProduct.has(b.product_id)) bulletsByProduct.set(b.product_id, []);
        bulletsByProduct.get(b.product_id)!.push(b);
      } else if (b.project_id) {
        if (!bulletsByProject.has(b.project_id)) bulletsByProject.set(b.project_id, []);
        bulletsByProject.get(b.project_id)!.push(b);
      } else {
        unattachedBullets.push(b);
      }
    }

    // Map products to companies
    const productsByCompany = new Map<string, any[]>();
    for (const p of products) {
      const enrichedProduct = {
        ...p,
        name: p.title || p.name,
        architecture_type: p.architectural_notes || p.architecture_type,
        live_url: p.live_url || (typeof p.description === 'string' && p.description.startsWith('Live: ') ? p.description.slice(6) : null),
        repo_url: p.repo_url || (Array.isArray(p.repo_links) && p.repo_links[0]?.url ? p.repo_links[0].url : null),
        bullets: bulletsByProduct.get(p.id) || [],
      };
      if (!productsByCompany.has(p.company_id)) productsByCompany.set(p.company_id, []);
      productsByCompany.get(p.company_id)!.push(enrichedProduct);
    }

    // Fetch user preferences for metadata (role_title, company_domains, identity, summary, skills, education)
    let userCompanyRoles: Record<string, string> = {};
    let userCompanyDomains: Record<string, string> = {};
    let userIdentity: any = null;
    let userSummary = '';
    let userSkills: any[] = [];
    let userEducation: any[] = [];
    try {
      const { data: userRow } = await admin
        .from('users')
        .select('preferences')
        .eq('id', userId)
        .single();
      if (userRow?.preferences && typeof userRow.preferences === 'object') {
        const p = userRow.preferences as Record<string, any>;
        userCompanyRoles = p.company_roles || {};
        userCompanyDomains = p.company_domains || {};
        userIdentity = p.portfolio_identity || null;
        userSummary = typeof p.portfolio_summary === 'string' ? p.portfolio_summary : '';
        userSkills = Array.isArray(p.portfolio_skills) ? p.portfolio_skills : [];
        userEducation = Array.isArray(p.portfolio_education) ? p.portfolio_education : [];
      }
    } catch (errPrefs) {
      console.warn('[portfolio] Error reading user preferences for portfolio metadata:', errPrefs);
    }

    const structuredCompanies = companies.map((c: any) => {
      const compProducts = productsByCompany.get(c.id) || [];
      const inferredRole = c.role_title || userCompanyRoles[c.id] || compProducts.find((p: any) => p.role_title)?.role_title || null;
      const resolvedDomain = c.domain || c.website_url || userCompanyDomains[c.id] || null;
      return {
        ...c,
        role_title: inferredRole,
        domain: resolvedDomain,
        website_url: resolvedDomain,
        products: compProducts,
      };
    });

    const structuredProjects = projects.map((p: any) => ({
      ...p,
      bullets: bulletsByProject.get(p.id) || [],
    }));

    res.json({
      ok: true,
      identity: userIdentity,
      summary_text: userSummary,
      profile_summary: userSummary,
      skills: userSkills,
      education: userEducation,
      companies: structuredCompanies,
      projects: structuredProjects,
      standalone_projects: structuredProjects,
      unattachedBullets,
      unattached_bullets: unattachedBullets,
      summary: {
        totalCompanies: companies.length,
        totalProducts: products.length,
        totalProjects: projects.length,
        totalBullets: bullets.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch portfolio data.' });
  }
});

function normalizeDateToISO(val: string | null | undefined): string | null {
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

  // If Month Year (e.g. "Jun 2026", "June 2026", "Jan 2022", "Jul '19")
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

  const nameMatch = s.match(/^([a-zA-Z]+)\.?\s*['’]?(\d{2,4})$/);
  if (nameMatch) {
    const mStr = nameMatch[1].toLowerCase();
    let year = nameMatch[2];
    if (year.length === 2) year = `20${year}`;
    const mNum = monthMap[mStr];
    if (mNum) return `${year}-${mNum}-01`;
  }

  // If Year only: "2026"
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;

  // Fallback: try JS Date
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

function parsePeriodRange(period: string | null | undefined): {
  start_date: string;
  end_date: string | null;
  is_current: boolean;
} {
  const fallbackStart = new Date().toISOString().slice(0, 10);
  if (!period || typeof period !== 'string' || !period.trim()) {
    return { start_date: fallbackStart, end_date: null, is_current: false };
  }
  const parts = period.split(/\s*(?:[-—–―]+|to)\s*/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const start_date = normalizeDateToISO(parts[0]) || fallbackStart;
    const is_current = /^(present|current|now|ongoing)$/i.test(parts[1]);
    const end_date = is_current ? null : normalizeDateToISO(parts[1]);
    return { start_date, end_date, is_current };
  }
  const single = normalizeDateToISO(period) || fallbackStart;
  return { start_date: single, end_date: null, is_current: false };
}

async function ensureUserRow(admin: any, auth: { userId: string; email?: string | null; handle?: string | null }): Promise<void> {
  try {
    const { data } = await admin
      .from('users')
      .select('id')
      .eq('id', auth.userId)
      .maybeSingle();

    if (!data) {
      await admin.from('users').upsert({
        id: auth.userId,
        email: auth.email || null,
        github_handle: auth.handle || null,
        role: 'developer',
      }, { onConflict: 'id' });
    }
  } catch (err) {
    console.warn('[portfolio] ensureUserRow warning:', err);
  }
}

function formatPortfolioError(err: any, fallbackMessage: string): string {
  const msg = err?.message || '';
  if (msg.includes('portfolio_companies_user_id_fkey') || msg.includes('violates foreign key constraint') || msg.includes('users_id_fkey') || msg.includes('user_id')) {
    return 'User profile could not be synchronized. Please try saving again.';
  }
  if (msg.includes('invalid input syntax for type date')) {
    return 'Invalid date format. Accepted formats: Jun 2026, 2026-06, or Jan 2022.';
  }
  if (msg.includes('unique constraint') || msg.includes('duplicate key')) {
    return 'An entry with this name already exists.';
  }
  if (msg.includes('relation ') || msg.includes('syntax error') || msg.includes('violates')) {
    return fallbackMessage;
  }
  return msg || fallbackMessage;
}

// ---------------------------------------------------------------------------
// 2. Company CRUD
// ---------------------------------------------------------------------------
router.post('/companies', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { id, name, location, website_url, domain, role_title, start_date, end_date, is_current, display_order } = req.body || {};

  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Company name is required.' });
    return;
  }

  try {
    await ensureUserRow(admin, req.auth!);

    const normalizedStart = normalizeDateToISO(start_date) || new Date().toISOString().slice(0, 10);
    const normalizedEnd = is_current ? null : normalizeDateToISO(end_date);

    const payload: any = {
      user_id: userId,
      name: name.trim(),
      location: location?.trim() || null,
      website_url: (website_url || domain)?.trim() || null,
      start_date: normalizedStart,
      end_date: normalizedEnd,
      is_current: Boolean(is_current),
      display_order: typeof display_order === 'number' ? display_order : 0,
      updated_at: new Date().toISOString(),
    };
    if (role_title !== undefined) {
      payload.role_title = role_title?.trim() || null;
    }
    if (id) payload.id = id;

    let savedCompany: any = null;
    const { data, error } = await admin
      .from('portfolio_companies')
      .upsert(payload)
      .select()
      .single();

    if (error) {
      if (error.message?.includes('role_title') || (error as any).code === '42703') {
        delete payload.role_title;
        const retry = await admin
          .from('portfolio_companies')
          .upsert(payload)
          .select()
          .single();
        if (retry.error) throw new Error(retry.error.message);
        savedCompany = { ...retry.data, role_title: role_title?.trim() || null };
      } else {
        throw new Error(error.message);
      }
    } else {
      savedCompany = data;
    }

    // Sync role_title to child products
    if (role_title?.trim() && savedCompany?.id) {
      try {
        await admin
          .from('portfolio_products')
          .update({ role_title: role_title.trim() })
          .eq('company_id', savedCompany.id)
          .eq('user_id', userId);
      } catch {}
    }

    // Persist company metadata (role_title & company_domains) directly in user preferences
    const domainVal = (website_url || domain)?.trim() || null;
    if (savedCompany?.id) {
      try {
        const { data: userRow } = await admin
          .from('users')
          .select('preferences')
          .eq('id', userId)
          .single();
        const prefs = (userRow?.preferences && typeof userRow.preferences === 'object')
          ? (userRow.preferences as Record<string, any>)
          : {};
        const companyRoles = { ...(prefs.company_roles || {}) };
        const companyDomains = { ...(prefs.company_domains || {}) };

        if (role_title !== undefined) {
          companyRoles[savedCompany.id] = role_title?.trim() || null;
        }
        if (domainVal !== undefined) {
          companyDomains[savedCompany.id] = domainVal;
        }

        await admin
          .from('users')
          .update({
            preferences: {
              ...prefs,
              company_roles: companyRoles,
              company_domains: companyDomains,
            },
          })
          .eq('id', userId);
      } catch (errPref) {
        console.warn('[portfolio] Error persisting company meta to users.preferences:', errPref);
      }
    }

    const finalRole = role_title?.trim() || savedCompany?.role_title || null;
    const finalDomain = domainVal || savedCompany?.website_url || null;

    res.json({
      ok: true,
      company: {
        ...savedCompany,
        role_title: finalRole,
        domain: finalDomain,
        website_url: finalDomain,
      },
    });
  } catch (err: any) {
    console.error('[Portfolio] Company save error:', err);
    res.status(500).json({ error: formatPortfolioError(err, 'Failed to save company.') });
  }
});

router.delete('/companies/:id', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { id } = req.params;

  try {
    const { error } = await admin
      .from('portfolio_companies')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) throw new Error(error.message);

    // Clean up role and domain from user preferences
    try {
      const { data: userRow } = await admin
        .from('users')
        .select('preferences')
        .eq('id', userId)
        .single();
      if (userRow?.preferences && typeof userRow.preferences === 'object') {
        const prefs = userRow.preferences as Record<string, any>;
        const companyRoles = { ...(prefs.company_roles || {}) };
        const companyDomains = { ...(prefs.company_domains || {}) };
        delete companyRoles[id];
        delete companyDomains[id];
        await admin
          .from('users')
          .update({
            preferences: {
              ...prefs,
              company_roles: companyRoles,
              company_domains: companyDomains,
            },
          })
          .eq('id', userId);
      }
    } catch {}

    res.json({ ok: true, deleted: id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete company.' });
  }
});

// ---------------------------------------------------------------------------
// 3. Product / Sub-system CRUD
// ---------------------------------------------------------------------------
router.post('/products', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { id, company_id, title, name, role_title, description, tech_stack, architectural_notes, architecture_type, repo_links, display_order } = req.body || {};

  const resolvedTitle = (title || name)?.trim();
  if (!company_id || !resolvedTitle) {
    res.status(400).json({ error: 'Product name and company reference are required.' });
    return;
  }

  try {
    await ensureUserRow(admin, req.auth!);

    let resolvedRole = role_title?.trim();
    if (!resolvedRole) {
      const { data: comp } = await admin
        .from('portfolio_companies')
        .select('role_title')
        .eq('id', company_id)
        .maybeSingle();
      resolvedRole = comp?.role_title || 'Software Engineer';
    }

    const payload: any = {
      user_id: userId,
      company_id,
      title: resolvedTitle,
      role_title: resolvedRole,
      description: description?.trim() || null,
      tech_stack: Array.isArray(tech_stack) ? tech_stack : [],
      architectural_notes: (architectural_notes || architecture_type)?.trim() || null,
      repo_links: Array.isArray(repo_links) ? repo_links : [],
      display_order: typeof display_order === 'number' ? display_order : 0,
      updated_at: new Date().toISOString(),
    };
    if (id) payload.id = id;

    const { data, error } = await admin
      .from('portfolio_products')
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.json({ ok: true, product: data });
  } catch (err: any) {
    console.error('[Portfolio] Product save error:', err);
    res.status(500).json({ error: formatPortfolioError(err, 'Failed to save product.') });
  }
});

router.delete('/products/:id', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { id } = req.params;

  try {
    const { error } = await admin
      .from('portfolio_products')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) throw new Error(error.message);
    res.json({ ok: true, deleted: id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete product.' });
  }
});

// ---------------------------------------------------------------------------
// 4. Standalone Project CRUD
// ---------------------------------------------------------------------------
router.post('/projects', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { id, name, headline, live_url, repo_url, is_private, tech_stack, architectural_highlights, display_order } = req.body || {};

  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Project name is required.' });
    return;
  }

  try {
    await ensureUserRow(admin, req.auth!);

    const payload: any = {
      user_id: userId,
      name: name.trim(),
      headline: headline?.trim() || null,
      live_url: live_url?.trim() || null,
      repo_url: repo_url?.trim() || null,
      is_private: Boolean(is_private),
      tech_stack: Array.isArray(tech_stack) ? tech_stack : [],
      architectural_highlights: architectural_highlights?.trim() || null,
      display_order: typeof display_order === 'number' ? display_order : 0,
      updated_at: new Date().toISOString(),
    };
    if (id) payload.id = id;

    const { data, error } = await admin
      .from('portfolio_projects')
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.json({ ok: true, project: data });
  } catch (err: any) {
    console.error('[Portfolio] Project save error:', err);
    res.status(500).json({ error: formatPortfolioError(err, 'Failed to save project.') });
  }
});

router.delete('/projects/:id', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { id } = req.params;

  try {
    const { error } = await admin
      .from('portfolio_projects')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) throw new Error(error.message);
    res.json({ ok: true, deleted: id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete project.' });
  }
});

// ---------------------------------------------------------------------------
// 5. Master Bullet CRUD
// ---------------------------------------------------------------------------
router.post('/bullets', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { id, product_id, project_id, bullet_text, action_verb, impact_metric, primary_skills, source_type, source_evidence, review_status, interview_rubric } = req.body || {};

  if (!bullet_text || !bullet_text.trim()) {
    res.status(400).json({ error: 'bullet_text is required.' });
    return;
  }

  try {
    await ensureUserRow(admin, req.auth!);

    const payload: any = {
      user_id: userId,
      product_id: product_id || null,
      project_id: project_id || null,
      bullet_text: bullet_text.trim(),
      action_verb: action_verb?.trim() || null,
      impact_metric: impact_metric?.trim() || null,
      primary_skills: Array.isArray(primary_skills) ? primary_skills : [],
      source_type: source_type || 'manual',
      source_evidence: source_evidence || null,
      review_status: review_status || 'approved',
      interview_rubric: interview_rubric || null,
      updated_at: new Date().toISOString(),
    };
    if (id) payload.id = id;

    const { data, error } = await admin
      .from('master_bullets')
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.json({ ok: true, bullet: data });
  } catch (err: any) {
    console.error('[Portfolio] Bullet save error:', err);
    res.status(500).json({ error: formatPortfolioError(err, 'Failed to save bullet.') });
  }
});

router.delete('/bullets/:id', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { id } = req.params;

  try {
    const { error } = await admin
      .from('master_bullets')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) throw new Error(error.message);
    res.json({ ok: true, deleted: id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete bullet.' });
  }
});

// ---------------------------------------------------------------------------
// Defensive Server-Side Resume Experience & Bullet Normalizer
// ---------------------------------------------------------------------------
const SERVER_ROLE_REGEX =
  /\b(software|hardware|systems?|backend|frontend|full[\s-]*stack|cloud|devops|site\s+reliability|sre|data|machine\s+learning|ml|ai|security|qa|test|quality|platform|infrastructure|mobile|ios|android|web|application|network|database|embedded|firmware|principal|staff|senior|lead|junior|associate|chief|vp|director|head|manager|engineer|engineering|developer|architect|intern|internship|trainee|apprentice|consultant|analyst|specialist|administrator|designer|founder|co-founder|cto|ceo|member\s+of\s+technical\s+staff|mts|sde|sdet|r&d|research\s+and\s+development|researcher)\b/i;

const SERVER_DEGREE_REGEX =
  /\b(bachelor(?:'?s)?|master(?:'?s)?|b\.?\s?s\.?(?:\s+in\b|$)|m\.?\s?s\.?(?:\s+in\b|$)|b\.?\s?tech\.?|m\.?\s?tech\.?|b\.?\s?e\.?(?:\s+in\b|$)|m\.?\s?e\.?(?:\s+in\b|$)|b\.?\s?sc\.?|m\.?\s?sc\.?|ph\.?\s?d\.?|b\.?\s?a\.?(?:\s+in\b|$)|m\.?\s?b\.?\s?a\.?|m\.?\s?c\.?\s?a\.?|b\.?\s?c\.?\s?a\.?|associate(?:'?s)?\s+degree|diploma\s+in|gpa\s*[:=]|cgpa\s*[:=])\b/i;

const SERVER_INSTITUTION_REGEX =
  /\b(university|institute\s+of\s+technology|indian\s+institute|national\s+institute|college\s+of|school\s+of\s+(?:engineering|computer|business|computing|information|sciences?)|polytechnic|high\s+school|secondary\s+school|iit\b|nit\b|bits\b|iiit\b)\b/i;

const SERVER_ACTION_VERB_REGEX =
  /^(built|developed|engineered|led|designed|implemented|created|architected|reduced|increased|transformed|solved|extended|released|enhanced|collaborated|innovated|strategized|contributed|mentored|mentoring|managed|optimized|refactored|automated|spearheaded|launched|delivered|maintained|migrated|integrated|scaled|established|owned|drove|authored|deployed|configured|debugged|resolved|streamlined|accelerated|orchestrated|modernized|conducted|analyzed|tested|validated|supported|assisted|worked|participated|expertise\s+in|extensive\s+contributions)\b/i;

function isServerBulletLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^[•●▪▫◆◇▸▹►▻➢➣➤⁃∙◦○◌*+»›]\s*/.test(t)) return true;
  if (/^[-–—]\s+(?=[A-Za-z0-9"'])/.test(t)) return true;
  if (/^[oO]\s+(?=[A-Z0-9"'])/.test(t)) return true;
  if (/^(?:\d{1,2}[.)]|\([a-z\d]\))\s+(?=[A-Z0-9"'])/.test(t)) return true;
  return false;
}

function stripServerBulletPrefix(line: string): string {
  let clean = line.trim();
  let prev = '';
  while (clean !== prev) {
    prev = clean;
    clean = clean
      .replace(/^[•●▪▫◆◇▸▹►▻➢➣➤⁃∙◦○◌*+»›]\s*/, '')
      .replace(/^[-–—]\s+(?=[A-Za-z0-9"'])/, '')
      .replace(/^[oO]\s+(?=[A-Z0-9"'])/, '')
      .replace(/^(?:\d{1,2}[.)]|\([a-z\d]\))\s+(?=[A-Z0-9"'])/, '')
      .trim();
  }
  return clean;
}

function isServerCategorySubheader(line: string): boolean {
  const clean = stripServerBulletPrefix(line);
  if (!clean.endsWith(':') || clean.length > 65) return false;
  if (clean.includes('http://') || clean.includes('https://')) return false;
  const words = clean.slice(0, -1).trim().split(/\s+/).length;
  return words >= 1 && words <= 6;
}

function stitchServerBullets(rawBullets: any[]): { bullets: string[]; subtitle?: string } {
  const bullets: string[] = [];
  let subtitle: string | undefined;

  for (const item of rawBullets) {
    if (typeof item !== 'string' || !item.trim()) continue;
    const raw = item.trim();

    if (isServerCategorySubheader(raw)) {
      continue;
    }

    const explicit = isServerBulletLine(raw);
    const cleaned = stripServerBulletPrefix(raw);
    if (!cleaned || cleaned.length < 2) continue;

    if (
      bullets.length === 0 &&
      !subtitle &&
      !explicit &&
      (!SERVER_ACTION_VERB_REGEX.test(cleaned) || /https?:\/\//i.test(cleaned) || /\bteam\s+for\b/i.test(cleaned))
    ) {
      subtitle = cleaned;
      continue;
    }

    if (explicit) {
      bullets.push(cleaned);
      continue;
    }

    if (bullets.length > 0) {
      const prev = bullets[bullets.length - 1];
      const startsLowerOrPunct = /^[a-z,;:)&\d]/.test(cleaned);
      const prevEndsConnector =
        /[,;:\-–—/(]\s*$/.test(prev) ||
        /\b(and|or|to|for|with|in|on|of|by|from|that|which|as|into|across|through|using|via|including|between|within|fellow|multiple|the|a|an|such|both)\s*$/i.test(prev);

      const isActionStart = SERVER_ACTION_VERB_REGEX.test(cleaned);
      const isContinuation =
        startsLowerOrPunct ||
        prevEndsConnector ||
        (!isActionStart && cleaned.split(/\s+/).length < 12);

      if (isContinuation) {
        bullets[bullets.length - 1] = `${prev} ${cleaned}`.replace(/\s+/g, ' ').trim();
        continue;
      }
    }

    bullets.push(cleaned);
  }

  return {
    bullets: bullets.filter((b) => b.length > 5 && !isServerCategorySubheader(b)),
    subtitle,
  };
}

function splitServerHeaderIfMerged(exp: any): {
  company: string;
  role: string;
  productTitle?: string;
  location?: string;
} {
  let company = (exp.company || '').trim();
  let role = (exp.role || 'Software Engineer').trim();
  let location = exp.location?.trim() || undefined;
  let productTitle = exp.productTitle?.trim() || undefined;

  // Extract trailing dash location e.g. "– Seattle, Washington, USA" or "- Chicago, Illinois, USA"
  const dashLocMatch = company.match(/^(.*?)\s*[–—-]\s*([A-Z][A-Za-z.\s-]{1,28}(?:,\s*[A-Z][A-Za-z.\s-]{1,28}){1,2}|Remote|Hybrid)\s*$/);
  if (dashLocMatch && !SERVER_ROLE_REGEX.test(dashLocMatch[2])) {
    company = dashLocMatch[1].trim();
    if (!location) location = dashLocMatch[2].trim();
  }

  if (company.includes(',')) {
    const parts = company.split(',').map((p: string) => p.trim()).filter(Boolean);
    if (parts.length >= 3 && SERVER_ROLE_REGEX.test(parts[0])) {
      role = parts[0];
      company = parts[parts.length - 1];
      productTitle = parts.slice(1, -1).join(', ');
    } else if (parts.length === 2) {
      if (SERVER_ROLE_REGEX.test(parts[0]) && !SERVER_ROLE_REGEX.test(parts[1])) {
        role = parts[0];
        company = parts[1];
      } else if (SERVER_ROLE_REGEX.test(parts[1]) && !SERVER_ROLE_REGEX.test(parts[0])) {
        company = parts[0];
        role = parts[1];
      }
    }
  }

  return { company, role, productTitle, location };
}

// ---------------------------------------------------------------------------
// 6. POST /api/portfolio/import-resume (and alias /bootstrap-from-resume)
// ---------------------------------------------------------------------------
const handleImportResume = async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { experience, projects, education, skills, summary, identity, replaceExisting } = req.body || {};

  if (!Array.isArray(experience) && !Array.isArray(projects) && !Array.isArray(education) && !Array.isArray(skills) && !summary && !identity) {
    res.status(400).json({ error: 'At least one resume section is required for portfolio bootstrap.' });
    return;
  }

  let importedCompanies = 0;
  let importedProducts = 0;
  let importedProjects = 0;
  let importedBullets = 0;

  try {
    await ensureUserRow(admin, req.auth!);

    // If replaceExisting is requested, clear old companies/projects/bullets for a clean SSOT slate
    if (replaceExisting) {
      await Promise.all([
        admin.from('portfolio_companies').delete().eq('user_id', userId),
        admin.from('portfolio_projects').delete().eq('user_id', userId),
        admin.from('master_bullets').delete().eq('user_id', userId),
      ]);
    }

    const newCompanyRolesMap: Record<string, string> = {};

    // 1. Import Experience -> Company + Product + Bullets
    if (Array.isArray(experience)) {
      for (let i = 0; i < experience.length; i++) {
        const exp = experience[i];
        if (!exp || !exp.company) continue;

        // Guardrail: skip Education / University entries that leaked into experience
        const combinedCheck = `${exp.company} ${exp.role || ''}`;
        if (
          SERVER_DEGREE_REGEX.test(combinedCheck) ||
          (SERVER_INSTITUTION_REGEX.test(exp.company) && !SERVER_ROLE_REGEX.test(combinedCheck))
        ) {
          continue;
        }

        const decomposed = splitServerHeaderIfMerged(exp);
        const parsedDates = parsePeriodRange(exp.period);
        const { bullets: cleanBullets, subtitle } = stitchServerBullets(
          Array.isArray(exp.bullets) ? exp.bullets : []
        );

        // Create Company
        const { data: comp, error: cErr } = await admin
          .from('portfolio_companies')
          .insert({
            user_id: userId,
            name: decomposed.company,
            location: decomposed.location || null,
            start_date: parsedDates.start_date,
            end_date: parsedDates.end_date,
            is_current: parsedDates.is_current,
            display_order: i,
          })
          .select()
          .single();

        if (cErr) continue;
        importedCompanies++;
        if (decomposed.role && comp?.id) {
          newCompanyRolesMap[comp.id] = decomposed.role;
        }

        const prodTitle = decomposed.productTitle
          ? decomposed.productTitle
          : decomposed.role
          ? `${decomposed.role} Initiatives`
          : `${decomposed.company} Core Systems`;

        const prodDescription = [
          subtitle || exp.teamDescription,
          exp.period && exp.period !== 'Recent' ? `Tenure: ${exp.period}` : null,
        ]
          .filter(Boolean)
          .join(' · ') || null;

        // Create Product / Sub-system entry for this role
        const { data: prod, error: pErr } = await admin
          .from('portfolio_products')
          .insert({
            user_id: userId,
            company_id: comp.id,
            title: prodTitle,
            role_title: decomposed.role || 'Software Engineer',
            description: prodDescription,
            display_order: 0,
          })
          .select()
          .single();

        if (pErr) continue;
        importedProducts++;

        // Insert Atomic Master Bullets
        if (cleanBullets.length > 0) {
          const bulletRows = cleanBullets.map((b: string) => {
            const firstWord = b.split(/\s+/)[0]?.replace(/[^a-zA-Z]/g, '') || null;
            const metricMatch = b.match(/\b(\d+(?:\.\d+)?%|\d+x|\$\d+[kKmMbB]?|\d+\s*(?:ms|seconds|minutes|hours|days|req\/s|rps|users|clients|microservices|pipelines))\b/i);
            return {
              user_id: userId,
              product_id: prod.id,
              bullet_text: b,
              action_verb: firstWord,
              impact_metric: metricMatch ? metricMatch[0] : null,
              source_type: 'docx_import',
              review_status: 'approved',
            };
          });

          const { error: bErr } = await admin.from('master_bullets').insert(bulletRows);
          if (!bErr) importedBullets += bulletRows.length;
        }
      }
    }

    // Persist company role titles in users.preferences
    if (Object.keys(newCompanyRolesMap).length > 0) {
      try {
        const { data: userRow } = await admin
          .from('users')
          .select('preferences')
          .eq('id', userId)
          .single();
        const prefs = (userRow?.preferences && typeof userRow.preferences === 'object')
          ? (userRow.preferences as Record<string, any>)
          : {};
        const mergedRoles = replaceExisting
          ? newCompanyRolesMap
          : { ...(prefs.company_roles || {}), ...newCompanyRolesMap };
        await admin
          .from('users')
          .update({
            preferences: {
              ...prefs,
              company_roles: mergedRoles,
            },
          })
          .eq('id', userId);
      } catch {}
    }

    // 2. Import Standalone Projects + Bullets
    if (Array.isArray(projects)) {
      for (let j = 0; j < projects.length; j++) {
        const proj = projects[j];
        if (!proj || !proj.name) continue;

        const { data: projectRow, error: prErr } = await admin
          .from('portfolio_projects')
          .insert({
            user_id: userId,
            name: proj.name.trim(),
            headline: proj.description?.trim() || null,
            live_url: proj.link?.trim() || null,
            display_order: j,
          })
          .select()
          .single();

        if (prErr) continue;
        importedProjects++;

        const { bullets: cleanProjBullets } = stitchServerBullets(
          Array.isArray(proj.bullets) ? proj.bullets : []
        );

        if (cleanProjBullets.length > 0) {
          const projectBullets = cleanProjBullets.map((b: string) => ({
            user_id: userId,
            project_id: projectRow.id,
            bullet_text: b,
            source_type: 'docx_import',
            review_status: 'approved',
          }));

          const { error: pbErr } = await admin.from('master_bullets').insert(projectBullets);
          if (!pbErr) importedBullets += projectBullets.length;
        }
      }
    }

    // 3. Persist 6-Pillar SSOT metadata (Identity, Summary, Skills, Education, Company Roles) to user preferences
    try {
      const { data: userRow } = await admin
        .from('users')
        .select('preferences')
        .eq('id', userId)
        .single();
      const currentPrefs = (userRow?.preferences as Record<string, any>) || {};
      const updatedPrefs: Record<string, any> = {
        ...currentPrefs,
        company_roles: {
          ...(replaceExisting ? {} : (currentPrefs.company_roles || {})),
          ...newCompanyRolesMap,
        },
      };

      if (identity && typeof identity === 'object') {
        updatedPrefs.portfolio_identity = {
          ...(replaceExisting ? {} : (currentPrefs.portfolio_identity || {})),
          ...identity,
        };
      }
      if (typeof summary === 'string' && summary.trim()) {
        updatedPrefs.portfolio_summary = summary.trim();
      }
      if (Array.isArray(skills) && skills.length > 0) {
        updatedPrefs.portfolio_skills = skills;
      }
      if (Array.isArray(education) && education.length > 0) {
        updatedPrefs.portfolio_education = education;
      }

      await admin
        .from('users')
        .update({ preferences: updatedPrefs })
        .eq('id', userId);
    } catch (prefErr) {
      console.warn('[portfolio] Error updating user preferences in bootstrap:', prefErr);
    }

    res.json({
      ok: true,
      imported: {
        companies: importedCompanies,
        products: importedProducts,
        projects: importedProjects,
        bullets: importedBullets,
      },
    });
  } catch (err: any) {
    console.error('[Portfolio] Import resume error:', err);
    res.status(500).json({ error: formatPortfolioError(err, 'Failed to import resume into portfolio.') });
  }
};

// ---------------------------------------------------------------------------
// 7. Identity & Summary CRUD Routes
// ---------------------------------------------------------------------------
router.post('/identity', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { identity } = req.body || {};

  try {
    await ensureUserRow(admin, req.auth!);
    const { data: userRow } = await admin.from('users').select('preferences').eq('id', userId).single();
    const currentPrefs = (userRow?.preferences as Record<string, any>) || {};
    const updatedPrefs = {
      ...currentPrefs,
      portfolio_identity: {
        ...(currentPrefs.portfolio_identity || {}),
        ...(identity || {}),
      },
    };
    await admin.from('users').update({ preferences: updatedPrefs }).eq('id', userId);
    res.json({ ok: true, identity: updatedPrefs.portfolio_identity });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update identity.' });
  }
});

router.post('/summary', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { summary } = req.body || {};

  try {
    await ensureUserRow(admin, req.auth!);
    const { data: userRow } = await admin.from('users').select('preferences').eq('id', userId).single();
    const currentPrefs = (userRow?.preferences as Record<string, any>) || {};
    const updatedPrefs = {
      ...currentPrefs,
      portfolio_summary: typeof summary === 'string' ? summary.trim() : '',
    };
    await admin.from('users').update({ preferences: updatedPrefs }).eq('id', userId);
    res.json({ ok: true, summary: updatedPrefs.portfolio_summary });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update summary.' });
  }
});

// ---------------------------------------------------------------------------
// 8. Categorized Skills Matrix CRUD Routes
// ---------------------------------------------------------------------------
router.post('/skills', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { skills } = req.body || {};

  try {
    await ensureUserRow(admin, req.auth!);
    const { data: userRow } = await admin.from('users').select('preferences').eq('id', userId).single();
    const currentPrefs = (userRow?.preferences as Record<string, any>) || {};
    const updatedPrefs = {
      ...currentPrefs,
      portfolio_skills: Array.isArray(skills) ? skills : [],
    };
    await admin.from('users').update({ preferences: updatedPrefs }).eq('id', userId);
    res.json({ ok: true, skills: updatedPrefs.portfolio_skills });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update skills.' });
  }
});

// ---------------------------------------------------------------------------
// 9. Education & Credentials CRUD Routes
// ---------------------------------------------------------------------------
router.post('/education', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const edu = req.body || {};

  try {
    await ensureUserRow(admin, req.auth!);
    const { data: userRow } = await admin.from('users').select('preferences').eq('id', userId).single();
    const currentPrefs = (userRow?.preferences as Record<string, any>) || {};
    const existingList: any[] = Array.isArray(currentPrefs.portfolio_education) ? [...currentPrefs.portfolio_education] : [];

    const id = edu.id || `edu_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const record = {
      id,
      institution: edu.institution?.trim() || '',
      degree: edu.degree?.trim() || '',
      field_of_study: edu.field_of_study?.trim() || undefined,
      start_date: edu.start_date || null,
      end_date: edu.end_date || null,
      grade_or_gpa: edu.grade_or_gpa?.trim() || undefined,
      location: edu.location?.trim() || undefined,
      bullets: Array.isArray(edu.bullets) ? edu.bullets : [],
    };

    const idx = existingList.findIndex((item) => item.id === id);
    if (idx >= 0) {
      existingList[idx] = record;
    } else {
      existingList.push(record);
    }

    const updatedPrefs = {
      ...currentPrefs,
      portfolio_education: existingList,
    };
    await admin.from('users').update({ preferences: updatedPrefs }).eq('id', userId);
    res.json({ ok: true, education: record, allEducation: existingList });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to update education.' });
  }
});

router.delete('/education/:id', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const eduId = req.params.id;

  try {
    const { data: userRow } = await admin.from('users').select('preferences').eq('id', userId).single();
    const currentPrefs = (userRow?.preferences as Record<string, any>) || {};
    const existingList: any[] = Array.isArray(currentPrefs.portfolio_education) ? currentPrefs.portfolio_education : [];
    const filtered = existingList.filter((e) => e.id !== eduId);

    const updatedPrefs = {
      ...currentPrefs,
      portfolio_education: filtered,
    };
    await admin.from('users').update({ preferences: updatedPrefs }).eq('id', userId);
    res.json({ ok: true, deletedId: eduId });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete education.' });
  }
});

router.post('/import-resume', requireAuth, handleImportResume);
router.post('/bootstrap-from-resume', requireAuth, handleImportResume);

export default router;
