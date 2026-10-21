-- GitGrill: Supabase User Roles & Workspace Decoupling Migration
-- Safe & idempotent: Designed to be run safely in the Supabase SQL Editor
-- without breaking or overwriting any existing data, accounts, or tables.

-- 1. Ensure `role` column exists on `public.users` table
alter table public.users
  add column if not exists role text not null default 'developer';

-- Ensure role constraint exists
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'users_role_check' and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_role_check check (role in ('developer', 'recruiter', 'admin'));
  end if;
end $$;

-- 2. Create index on role for fast lookups
create index if not exists users_role_idx on public.users (role);

-- 3. Default any unspecified user roles to 'developer' (never changes existing 'admin' or 'recruiter')
update public.users
set role = 'developer'
where role is null;

-- 4. Helper trigger function: when a user signs up via Supabase Auth,
-- automatically copy their `raw_user_meta_data->>'role'` into `public.users.role`.
create or replace function public.handle_new_user_role()
returns trigger
language plpgsql
security definer
as $$
declare
  assigned_role text;
begin
  assigned_role := coalesce(new.raw_user_meta_data->>'role', 'developer');
  if assigned_role not in ('developer', 'recruiter', 'admin') then
    assigned_role := 'developer';
  end if;

  insert into public.users (id, email, role, created_at)
  values (
    new.id,
    new.email,
    assigned_role,
    now()
  )
  on conflict (id) do update
  set
    email = excluded.email,
    role = case
      when public.users.role = 'admin' then 'admin' -- prevent demoting admins
      else excluded.role
    end;

  return new;
end;
$$;

-- 5. Attach trigger to auth.users (runs on insert)
drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- 6. Automatic Sync: When `role` is updated in `public.users` table,
-- immediately reflect it into `auth.users.raw_app_meta_data` so the JWT token automatically has role: admin.
create or replace function public.sync_user_role_to_auth()
returns trigger
language plpgsql
security definer
as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new.role)
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_public_user_role_updated on public.users;
create trigger on_public_user_role_updated
  after insert or update of role on public.users
  for each row execute function public.sync_user_role_to_auth();

-- 7. One-time sync for existing users: populate role into auth.users metadata for current accounts
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', u.role)
from public.users u
where auth.users.id = u.id and u.role is not null;

-- 8. Target Roles & Defense Cards Cloud Sync (M24D)
-- Safe table creation
create table if not exists public.target_roles (
  id text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- In case target_roles was previously created with uuid id, safely alter to text:
alter table public.target_roles alter column id drop default;
alter table public.target_roles alter column id type text using id::text;
alter table public.target_roles add column if not exists created_at timestamptz not null default now();
alter table public.target_roles add column if not exists updated_at timestamptz not null default now();
create index if not exists target_roles_user_idx on public.target_roles (user_id);

create table if not exists public.defense_cards (
  id text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- In case defense_cards was previously created with uuid id, safely alter to text:
alter table public.defense_cards alter column id drop default;
alter table public.defense_cards alter column id type text using id::text;
alter table public.defense_cards add column if not exists created_at timestamptz not null default now();
alter table public.defense_cards add column if not exists updated_at timestamptz not null default now();
create index if not exists defense_cards_user_idx on public.defense_cards (user_id);

-- 9. Permanent Published Proof Pages (M24D / M25)
create table if not exists public.proofs (
  id text primary key,
  username text not null,
  role_id text not null,
  role_title text not null,
  version integer not null default 1,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  branded boolean not null default true,
  note text,
  data jsonb not null
);

create index if not exists proofs_username_idx on public.proofs (username);

-- 10. Row Level Security (RLS)
alter table public.target_roles enable row level security;
alter table public.defense_cards enable row level security;
alter table public.proofs enable row level security;

-- Per-user data isolation for candidate target roles & defense cards
drop policy if exists "target_roles owner all" on public.target_roles;
create policy "target_roles owner all" on public.target_roles
  for all using (auth.uid() = user_id);

drop policy if exists "defense_cards owner all" on public.defense_cards;
create policy "defense_cards owner all" on public.defense_cards
  for all using (auth.uid() = user_id);

-- Public can read published proofs (shared with recruiters)
drop policy if exists "Public read for proofs" on public.proofs;
create policy "Public read for proofs" on public.proofs
  for select using (true);



