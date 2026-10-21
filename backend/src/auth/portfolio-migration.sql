-- ==============================================================================
-- GitGrill Developer CareerOS: Living Portfolio & Resume Studio Migration
-- 
-- SAFETY CONTRACT:
-- 1. 100% Non-Breaking & Additive: Layered on top of existing users & target_roles.
-- 2. ZERO destructive statements (No DROP TABLE, No ALTER COLUMN TYPE).
-- 3. Preserves existing accounts (c4062671-... golamrabby821@gmail.com) and all live data.
-- 4. Idempotent: Can be run multiple times safely via Supabase SQL Editor.
-- ==============================================================================

-- 1. Companies / Organizations worked at
create table if not exists public.portfolio_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  location text,
  website_url text,
  start_date date not null,
  end_date date, -- null indicates current employer
  is_current boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Products / Sub-systems owned within a company
create table if not exists public.portfolio_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.portfolio_companies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null, -- e.g. "Core Settlement Engine" or "Realtime Feed Service"
  role_title text not null, -- e.g. "Senior Backend Engineer"
  description text,
  tech_stack text[] not null default '{}',
  architectural_notes text, -- Context on trade-offs, scale, latency requirements
  repo_links jsonb not null default '[]'::jsonb, -- [{ "name": "org/repo", "provider": "github", "is_private": true }]
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Standalone / Open-Source / Client Projects
create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  headline text,
  live_url text,
  repo_url text,
  is_private boolean not null default false,
  tech_stack text[] not null default '{}',
  architectural_highlights text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Atomic Master Bullets (The SSOT Contribution Ledger)
create table if not exists public.master_bullets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid references public.portfolio_products(id) on delete cascade,
  project_id uuid references public.portfolio_projects(id) on delete cascade,
  
  bullet_text text not null,
  action_verb text,
  impact_metric text, -- e.g. "reduced p99 latency by 34%"
  primary_skills text[] not null default '{}',
  
  -- Provenance & Human Review
  source_type text not null default 'manual' check (source_type in ('manual', 'git_digest', 'docx_import', 'ai_synthesized')),
  source_evidence jsonb, -- { "pr_number": 42, "rationale": "Extracted from Redis caching implementation" }
  review_status text not null default 'approved' check (review_status in ('pending_review', 'approved', 'rejected', 'archived')),
  
  -- Defensibility context for technical interviews
  interview_rubric jsonb, -- { "likely_probe": "How did you prevent cache stampedes?", "defense_key": "Implemented singleflight mutex locks" }
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_bullet_parent check (
    (product_id is not null and project_id is null) or
    (product_id is null and project_id is not null) or
    (product_id is null and project_id is null)
  )
);

-- 5. Multi-Resume Document Registry
create table if not exists public.resume_documents (
  id text primary key, -- e.g. "res_backend_staff_v1"
  user_id uuid not null references public.users(id) on delete cascade,
  target_role_id text references public.target_roles(id) on delete set null,
  
  title text not null, -- e.g. "Distributed Systems Master (v2.1)"
  variant_tag text not null default 'general' check (variant_tag in ('general', 'backend', 'fullstack', 'platform', 'lead', 'tailored')),
  is_master_template boolean not null default false,
  
  -- Header & Contact Information
  full_name text not null,
  headline text,
  contact_email text not null,
  phone text,
  location text,
  github_url text,
  linkedin_url text,
  portfolio_url text,
  summary text,
  
  -- Render Configuration
  layout_config jsonb not null default '{"show_metrics_first": true, "bullets_per_job": 4}'::jsonb,
  ats_score integer,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Resume Sections & Ordered Item Placements
create table if not exists public.resume_sections (
  id uuid primary key default gen_random_uuid(),
  resume_id text not null references public.resume_documents(id) on delete cascade,
  section_type text not null check (section_type in ('summary', 'experience', 'projects', 'skills', 'education', 'custom')),
  title text not null,
  display_order integer not null,
  custom_content text
);

create table if not exists public.resume_section_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.resume_sections(id) on delete cascade,
  bullet_id uuid references public.master_bullets(id) on delete set null,
  tailored_bullet_text text,
  display_order integer not null,
  is_included boolean not null default true
);

-- === Indexes for high-throughput lookups ===
create index if not exists idx_portfolio_companies_user on public.portfolio_companies (user_id);
create index if not exists idx_portfolio_products_company on public.portfolio_products (company_id);
create index if not exists idx_master_bullets_user on public.master_bullets (user_id);
create index if not exists idx_master_bullets_skills on public.master_bullets using gin(primary_skills);
create index if not exists idx_resume_documents_user on public.resume_documents (user_id);
create index if not exists idx_resume_documents_role on public.resume_documents (target_role_id);

-- === Row Level Security (RLS) Policies ===
alter table public.portfolio_companies enable row level security;
alter table public.portfolio_products enable row level security;
alter table public.portfolio_projects enable row level security;
alter table public.master_bullets enable row level security;
alter table public.resume_documents enable row level security;
alter table public.resume_sections enable row level security;
alter table public.resume_section_items enable row level security;

-- Owner data isolation (User <-> User Red Line)
drop policy if exists "portfolio_companies_owner_all" on public.portfolio_companies;
create policy "portfolio_companies_owner_all" on public.portfolio_companies for all using (auth.uid() = user_id);

drop policy if exists "portfolio_products_owner_all" on public.portfolio_products;
create policy "portfolio_products_owner_all" on public.portfolio_products for all using (auth.uid() = user_id);

drop policy if exists "portfolio_projects_owner_all" on public.portfolio_projects;
create policy "portfolio_projects_owner_all" on public.portfolio_projects for all using (auth.uid() = user_id);

drop policy if exists "master_bullets_owner_all" on public.master_bullets;
create policy "master_bullets_owner_all" on public.master_bullets for all using (auth.uid() = user_id);

drop policy if exists "resume_documents_owner_all" on public.resume_documents;
create policy "resume_documents_owner_all" on public.resume_documents for all using (auth.uid() = user_id);

drop policy if exists "resume_sections_owner_all" on public.resume_sections;
create policy "resume_sections_owner_all" on public.resume_sections for all using (
  exists (select 1 from public.resume_documents r where r.id = resume_sections.resume_id and r.user_id = auth.uid())
);

drop policy if exists "resume_section_items_owner_all" on public.resume_section_items;
create policy "resume_section_items_owner_all" on public.resume_section_items for all using (
  exists (
    select 1 from public.resume_sections s
    join public.resume_documents r on r.id = s.resume_id
    where s.id = resume_section_items.section_id and r.user_id = auth.uid()
  )
);
