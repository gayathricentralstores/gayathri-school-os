-- Gayathri School OS - Batch 12 Production Controls
-- Optional migration for production export/backup readiness.
-- Safe to run multiple times.

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  backup_type text not null default 'manual',
  status text not null default 'scheduled',
  storage_path text,
  notes text,
  started_at timestamptz default now(),
  completed_at timestamptz,
  created_by uuid
);

create table if not exists public.system_health_checks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  check_key text not null,
  status text not null default 'pending',
  severity text not null default 'info',
  details jsonb default '{}'::jsonb,
  checked_at timestamptz default now(),
  unique (school_id, check_key)
);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  flag_key text not null,
  enabled boolean not null default false,
  notes text,
  updated_at timestamptz default now(),
  unique (school_id, flag_key)
);

alter table public.backup_runs enable row level security;
alter table public.system_health_checks enable row level security;
alter table public.feature_flags enable row level security;

grant select, insert, update, delete on public.backup_runs to service_role;
grant select, insert, update, delete on public.system_health_checks to service_role;
grant select, insert, update, delete on public.feature_flags to service_role;

grant select on public.backup_runs to authenticated;
grant select on public.system_health_checks to authenticated;
grant select on public.feature_flags to authenticated;

drop policy if exists "super_admin_read_backup_runs" on public.backup_runs;
create policy "super_admin_read_backup_runs"
on public.backup_runs
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role_key() = 'super_admin'
);

drop policy if exists "super_admin_read_health_checks" on public.system_health_checks;
create policy "super_admin_read_health_checks"
on public.system_health_checks
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role_key() = 'super_admin'
);

drop policy if exists "super_admin_read_feature_flags" on public.feature_flags;
create policy "super_admin_read_feature_flags"
on public.feature_flags
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role_key() = 'super_admin'
);

insert into public.feature_flags (school_id, flag_key, enabled, notes)
select id, 'live_payments_enabled', false, 'Keep disabled until payment webhook verification is complete.'
from public.schools
on conflict (school_id, flag_key) do nothing;

insert into public.feature_flags (school_id, flag_key, enabled, notes)
select id, 'parent_app_public_launch', false, 'Enable only after parent login and RLS tests pass.'
from public.schools
on conflict (school_id, flag_key) do nothing;

insert into public.feature_flags (school_id, flag_key, enabled, notes)
select id, 'multi_school_shared_tenant', false, 'Enable only after cross-school RLS tests are complete.'
from public.schools
on conflict (school_id, flag_key) do nothing;
