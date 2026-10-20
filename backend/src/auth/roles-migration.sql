-- GitGrill: Supabase User Roles & Workspace Decoupling Migration
-- Run this in the Supabase SQL Editor to support distinct Developer, Recruiter, and Admin roles.

-- 1. Add `role` column to `public.users` table
alter table public.users
  add column if not exists role text not null default 'developer'
  check (role in ('developer', 'recruiter', 'admin'));

-- 2. Create index on role for fast lookups
create index if not exists users_role_idx on public.users (role);

-- 3. Sync existing users: default to 'developer' unless specified
update public.users
set role = 'developer'
where role is null;

-- 4. Mark platform super-admin (adjust email to your admin address)
update public.users
set role = 'admin'
where email in ('admin@gitgrill.com', 'rabby.xponent@gmail.com');

-- 5. Helper trigger function: when a user signs up via Supabase Auth,
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

-- 6. Attach trigger to auth.users (runs on insert)
drop trigger if exists on_auth_user_created_role on auth.users;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- 7. Automatic Sync: When `role` is updated in `public.users` table (via Table Editor),
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

