-- =========================================================
-- Gayathri School OS - Batch 2 Role Access Engine
-- Run with RLS ON. Safe to rerun.
-- =========================================================

create extension if not exists "pgcrypto";

create table if not exists public.role_tab_access (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  role_key text not null,

  dashboard boolean not null default false,
  students boolean not null default false,
  parents boolean not null default false,
  fees boolean not null default false,
  transport boolean not null default false,
  attendance boolean not null default false,
  academics boolean not null default false,
  timetable boolean not null default false,
  exams boolean not null default false,
  circulars boolean not null default false,
  communication boolean not null default false,
  reports boolean not null default false,
  audit_logs boolean not null default false,
  design_portal boolean not null default false,

  updated_at timestamptz not null default now(),

  unique (school_id, role_key)
);

create or replace function public.current_user_school_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select school_id
  from public.user_profiles
  where id = auth.uid()
    and status = 'active'
  limit 1;
$$;

create or replace function public.current_user_role_key()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role_key
  from public.user_profiles
  where id = auth.uid()
    and status = 'active'
  limit 1;
$$;

grant execute on function public.current_user_school_id() to authenticated;
grant execute on function public.current_user_role_key() to authenticated;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.role_tab_access to service_role;
grant select, update on public.role_tab_access to authenticated;
grant select on public.roles to authenticated;
grant select on public.user_profiles to authenticated;
grant select, insert on public.audit_logs to authenticated;

alter table public.role_tab_access enable row level security;

drop policy if exists "role_tab_access_select" on public.role_tab_access;
create policy "role_tab_access_select"
on public.role_tab_access
for select
to authenticated
using (
  school_id = public.current_user_school_id()
  and (
    public.current_user_role_key() = 'super_admin'
    or role_key = public.current_user_role_key()
  )
);

drop policy if exists "role_tab_access_super_admin_manage" on public.role_tab_access;
create policy "role_tab_access_super_admin_manage"
on public.role_tab_access
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

-- Allow Super Admin UI to write audit entries for role-access changes.
alter table public.audit_logs enable row level security;

drop policy if exists "super_admin_insert_audit_logs" on public.audit_logs;
create policy "super_admin_insert_audit_logs"
on public.audit_logs
for insert
to authenticated
with check (
  school_id = public.current_user_school_id()
  and public.current_user_role_key() = 'super_admin'
);

-- Seed access rows.
insert into public.role_tab_access
(school_id, role_key, dashboard, students, parents, fees, transport, attendance, academics, timetable, exams, circulars, communication, reports, audit_logs, design_portal)
select id, 'super_admin', true,true,true,true,true,true,true,true,true,true,true,true,true,true from public.schools
on conflict (school_id, role_key) do update set
  dashboard = excluded.dashboard,
  students = excluded.students,
  parents = excluded.parents,
  fees = excluded.fees,
  transport = excluded.transport,
  attendance = excluded.attendance,
  academics = excluded.academics,
  timetable = excluded.timetable,
  exams = excluded.exams,
  circulars = excluded.circulars,
  communication = excluded.communication,
  reports = excluded.reports,
  audit_logs = excluded.audit_logs,
  design_portal = excluded.design_portal,
  updated_at = now();

insert into public.role_tab_access
(school_id, role_key, dashboard, students, parents, fees, transport, attendance, academics, timetable, exams, circulars, communication, reports, audit_logs, design_portal)
select id, 'school_admin', true,true,true,true,true,true,true,true,true,true,true,true,true,false from public.schools
on conflict (school_id, role_key) do nothing;

insert into public.role_tab_access
(school_id, role_key, dashboard, students, parents, fees, transport, attendance, academics, timetable, exams, circulars, communication, reports, audit_logs, design_portal)
select id, 'principal', true,true,true,true,true,true,true,true,true,true,true,true,true,false from public.schools
on conflict (school_id, role_key) do nothing;

insert into public.role_tab_access
(school_id, role_key, dashboard, students, parents, fees, transport, attendance, academics, timetable, exams, circulars, communication, reports, audit_logs, design_portal)
select id, 'accountant', true,true,false,true,false,false,false,false,false,false,false,true,false,false from public.schools
on conflict (school_id, role_key) do nothing;

insert into public.role_tab_access
(school_id, role_key, dashboard, students, parents, fees, transport, attendance, academics, timetable, exams, circulars, communication, reports, audit_logs, design_portal)
select id, 'teacher', true,true,false,false,false,true,true,true,true,true,true,false,false,false from public.schools
on conflict (school_id, role_key) do nothing;

insert into public.role_tab_access
(school_id, role_key, dashboard, students, parents, fees, transport, attendance, academics, timetable, exams, circulars, communication, reports, audit_logs, design_portal)
select id, 'class_teacher', true,true,true,false,false,true,true,true,true,true,true,true,false,false from public.schools
on conflict (school_id, role_key) do nothing;

insert into public.role_tab_access
(school_id, role_key, dashboard, students, parents, fees, transport, attendance, academics, timetable, exams, circulars, communication, reports, audit_logs, design_portal)
select id, 'transport_head', true,true,false,false,true,false,false,false,false,false,true,true,false,false from public.schools
on conflict (school_id, role_key) do nothing;

insert into public.role_tab_access
(school_id, role_key, dashboard, students, parents, fees, transport, attendance, academics, timetable, exams, circulars, communication, reports, audit_logs, design_portal)
select id, 'bus_helper', true,false,false,false,true,false,false,false,false,false,false,false,false,false from public.schools
on conflict (school_id, role_key) do nothing;

insert into public.role_tab_access
(school_id, role_key, dashboard, students, parents, fees, transport, attendance, academics, timetable, exams, circulars, communication, reports, audit_logs, design_portal)
select id, 'parent', true,false,false,true,true,true,true,true,true,true,true,false,false,false from public.schools
on conflict (school_id, role_key) do nothing;

notify pgrst, 'reload schema';

select role_key, dashboard, students, fees, transport, academics, design_portal
from public.role_tab_access
order by role_key;
