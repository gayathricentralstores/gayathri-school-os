-- Gayathri School OS Batch 13 - Production Controls
-- Safe to run multiple times.

alter table public.role_tab_access
add column if not exists production_controls boolean default false;

update public.role_tab_access
set production_controls = true,
    updated_at = now()
where role_key = 'super_admin';

create table if not exists public.production_exports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  export_type text not null,
  export_status text not null default 'queued',
  requested_by uuid,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  file_url text,
  notes text
);

create table if not exists public.production_health_checks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  check_key text not null,
  check_status text not null default 'pending',
  checked_at timestamptz not null default now(),
  notes text,
  unique (school_id, check_key)
);

alter table public.production_exports enable row level security;
alter table public.production_health_checks enable row level security;

grant select, insert, update, delete on public.production_exports to service_role;
grant select, insert, update, delete on public.production_health_checks to service_role;
grant select, insert, update on public.production_exports to authenticated;
grant select, insert, update on public.production_health_checks to authenticated;

drop policy if exists "super_admin_manage_production_exports" on public.production_exports;
create policy "super_admin_manage_production_exports"
on public.production_exports
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role_key() = 'super_admin'
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role_key() = 'super_admin'
);

drop policy if exists "super_admin_manage_production_health_checks" on public.production_health_checks;
create policy "super_admin_manage_production_health_checks"
on public.production_health_checks
for all
to authenticated
using (
  school_id = public.current_user_school_id()
  and public.current_user_role_key() = 'super_admin'
)
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role_key() = 'super_admin'
);

insert into public.production_health_checks (school_id, check_key, check_status, notes)
select id, 'rls_enabled', 'required', 'RLS must remain enabled on all private tables.' from public.schools
on conflict (school_id, check_key) do nothing;

insert into public.production_health_checks (school_id, check_key, check_status, notes)
select id, 'backup_restore_test', 'pending', 'Run a restore drill before real school data rollout.' from public.schools
on conflict (school_id, check_key) do nothing;

insert into public.production_health_checks (school_id, check_key, check_status, notes)
select id, 'payment_webhook_test', 'pending', 'Verify payment webhooks before live fee collection.' from public.schools
on conflict (school_id, check_key) do nothing;
