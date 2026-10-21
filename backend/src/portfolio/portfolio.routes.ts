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
        bullets: bulletsByProduct.get(p.id) || [],
      };
      if (!productsByCompany.has(p.company_id)) productsByCompany.set(p.company_id, []);
      productsByCompany.get(p.company_id)!.push(enrichedProduct);
    }

    const structuredCompanies = companies.map((c: any) => ({
      ...c,
      products: productsByCompany.get(c.id) || [],
    }));

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

// ---------------------------------------------------------------------------
// 2. Company CRUD
// ---------------------------------------------------------------------------
router.post('/companies', requireAuth, async (req: Request, res: Response) => {
  if (!isDbConfigured()) return serviceUnavailable(res);
  const admin = getAdmin()!;
  const userId = req.auth!.userId;
  const { id, name, location, website_url, start_date, end_date, is_current, display_order } = req.body || {};

  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Company name is required.' });
    return;
  }

  try {
    const payload: any = {
      user_id: userId,
      name: name.trim(),
      location: location?.trim() || null,
      website_url: website_url?.trim() || null,
      start_date: start_date || new Date().toISOString().slice(0, 10),
      end_date: is_current ? null : (end_date || null),
      is_current: Boolean(is_current),
      display_order: typeof display_order === 'number' ? display_order : 0,
      updated_at: new Date().toISOString(),
    };
    if (id) payload.id = id;

    const { data, error } = await admin
      .from('portfolio_companies')
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    res.json({ ok: true, company: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save company.' });
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
  const { id, company_id, title, role_title, description, tech_stack, architectural_notes, repo_links, display_order } = req.body || {};

  if (!company_id || !title?.trim() || !role_title?.trim()) {
    res.status(400).json({ error: 'company_id, title, and role_title are required.' });
    return;
  }

  try {
    const payload: any = {
      user_id: userId,
      company_id,
      title: title.trim(),
      role_title: role_title.trim(),
      description: description?.trim() || null,
      tech_stack: Array.isArray(tech_stack) ? tech_stack : [],
      architectural_notes: architectural_notes?.trim() || null,
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
    res.status(500).json({ error: err?.message || 'Failed to save product.' });
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
    res.status(500).json({ error: err?.message || 'Failed to save project.' });
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
    res.status(500).json({ error: err?.message || 'Failed to save bullet.' });
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
    res.status(500).json({ error: err?.message || 'Failed to import resume into portfolio.' });
  }
});

export default router;
