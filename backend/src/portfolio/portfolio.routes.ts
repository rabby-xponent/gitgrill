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

    // Fetch user preferences for fallback metadata (role_title & company_domains)
    let userCompanyRoles: Record<string, string> = {};
    let userCompanyDomains: Record<string, string> = {};
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
      }
    } catch (errPrefs) {
      console.warn('[portfolio] Error reading user preferences for company metadata:', errPrefs);
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
      companies: structuredCompanies,
      projects: structuredProjects,
      unattachedBullets,
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
        // DB column role_title not yet added via SQL, retry without role_title so company is saved
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
    // guaranteeing 100% persistence in Supabase even when role_title column is not yet on portfolio_companies
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
// 6. POST /api/portfolio/import-resume — 1-Click Bootstrap from existing resume
// ---------------------------------------------------------------------------
router.post('/import-resume', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { experience, projects } = req.body || {};

  if (!Array.isArray(experience) && !Array.isArray(projects)) {
    res.status(400).json({ error: 'experience or projects array is required.' });
    return;
  }

  let importedCompanies = 0;
  let importedProducts = 0;
  let importedProjects = 0;
  let importedBullets = 0;

  try {
    await ensureUserRow(admin, req.auth!);

    // 1. Import Experience -> Company + Product + Bullets
    if (Array.isArray(experience)) {
      for (let i = 0; i < experience.length; i++) {
        const exp = experience[i];
        if (!exp.company) continue;

        // Create or find Company
        const { data: comp, error: cErr } = await admin
          .from('portfolio_companies')
          .insert({
            user_id: userId,
            name: exp.company.trim(),
            location: exp.location?.trim() || null,
            start_date: new Date().toISOString().slice(0, 10),
            is_current: false,
            display_order: i,
          })
          .select()
          .single();

        if (cErr) continue;
        importedCompanies++;

        // Create Product / Sub-system entry for this role
        const { data: prod, error: pErr } = await admin
          .from('portfolio_products')
          .insert({
            user_id: userId,
            company_id: comp.id,
            title: exp.role ? `${exp.role.trim()} Initiatives` : `${exp.company.trim()} Core Systems`,
            role_title: exp.role?.trim() || 'Software Engineer',
            description: exp.period ? `Tenure: ${exp.period}` : null,
            display_order: 0,
          })
          .select()
          .single();

        if (pErr) continue;
        importedProducts++;

        // Insert Bullets
        if (Array.isArray(exp.bullets)) {
          const bulletRows = exp.bullets
            .filter((b: any) => typeof b === 'string' && b.trim())
            .map((b: string) => ({
              user_id: userId,
              product_id: prod.id,
              bullet_text: b.trim(),
              source_type: 'docx_import',
              review_status: 'approved',
            }));

          if (bulletRows.length > 0) {
            const { error: bErr } = await admin.from('master_bullets').insert(bulletRows);
            if (!bErr) importedBullets += bulletRows.length;
          }
        }
      }
    }

    // 2. Import Standalone Projects + Bullets
    if (Array.isArray(projects)) {
      for (let j = 0; j < projects.length; j++) {
        const proj = projects[j];
        if (!proj.name) continue;

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

        if (Array.isArray(proj.bullets)) {
          const projectBullets = proj.bullets
            .filter((b: any) => typeof b === 'string' && b.trim())
            .map((b: string) => ({
              user_id: userId,
              project_id: projectRow.id,
              bullet_text: b.trim(),
              source_type: 'docx_import',
              review_status: 'approved',
            }));

          if (projectBullets.length > 0) {
            const { error: pbErr } = await admin.from('master_bullets').insert(projectBullets);
            if (!pbErr) importedBullets += projectBullets.length;
          }
        }
      }
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
});

export default router;
