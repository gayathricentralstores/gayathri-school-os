-- Gayathri School OS — Batch 1 Production Foundation
-- Run in Supabase SQL Editor before running scripts/import-batch1-seed.mjs

create extension if not exists pgcrypto;

-- ---------- ENUMS ----------
do $$ begin
  create type public.student_status as enum ('active','inactive','transferred','alumni');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.import_status as enum ('draft','validating','validated','importing','completed','failed','rolled_back');
exception when duplicate_object then null; end $$;

-- ---------- CORE TENANCY ----------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  address text,
  city text,
  state text default 'Kerala',
  pincode text,
  logo_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  role_key text not null,
  role_name text not null,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique(school_id, role_key)
);

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text unique not null,
  module text not null,
  label text not null,
  description text
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(school_id, role_id, permission_id)
);

-- maps Supabase auth users to ERP profile/role.
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  role_id uuid references public.roles(id),
  role_key text not null default 'parent',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- MASTER DATA ----------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_label text not null,
  division text not null,
  stream text,
  academic_year text not null,
  active boolean not null default true
);

create unique index if not exists classes_unique_school_class_division_stream_year
on public.classes (
  school_id,
  class_label,
  division,
  coalesce(stream, ''),
  academic_year
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id text not null,
  admission_no text not null,
  student_name text not null,
  gender text,
  dob date,
  class_label text not null,
  division text not null,
  stream text,
  roll_no int,
  academic_year text not null,
  status public.student_status not null default 'active',
  date_of_joining date,
  blood_group text,
  house text,
  locality text,
  pincode text,
  attendance_percent numeric(5,2),
  phone_verification text,
  dob_verification text,
  data_confidence text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.user_profiles(id),
  updated_by uuid references public.user_profiles(id),
  deleted_at timestamptz,
  unique(school_id, student_id),
  unique(school_id, admission_no)
);

create table if not exists public.parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_name text not null,
  relation text,
  phone text not null,
  alternate_phone text,
  email text,
  phone_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id, phone)
);

create table if not exists public.student_parent_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  parent_id uuid not null references public.parents(id) on delete cascade,
  is_primary boolean not null default true,
  created_at timestamptz not null default now(),
  unique(school_id, student_id, parent_id)
);

-- ---------- FEES STARTER ----------
create table if not exists public.fee_summaries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  tuition_fee_annual numeric(10,2) not null default 0,
  transport_fee_annual numeric(10,2) not null default 0,
  total_fee_annual numeric(10,2) not null default 0,
  fee_status text not null default 'Pending',
  amount_due numeric(10,2) not null default 0,
  updated_at timestamptz not null default now(),
  unique(school_id, student_id)
);

-- ---------- TRANSPORT ----------
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  bus_no text not null,
  driver_name text,
  attendant_name text,
  active boolean not null default true,
  unique(school_id, bus_no)
);

create table if not exists public.transport_routes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  route_code text not null,
  route_name text not null,
  vehicle_id uuid references public.vehicles(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(school_id, route_code)
);

create table if not exists public.transport_stops (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  route_id uuid not null references public.transport_routes(id) on delete cascade,
  stop_order int not null,
  stop_name text not null,
  latitude numeric(10,7),
  longitude numeric(10,7),
  geofence_radius_m int not null default 100,
  parent_visible_status text default 'Stop-level timeline only',
  active boolean not null default true,
  unique(route_id, stop_order),
  unique(route_id, stop_name)
);

create table if not exists public.student_transport_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  route_id uuid references public.transport_routes(id),
  stop_id uuid references public.transport_stops(id),
  pickup_time text,
  drop_time text,
  opted boolean not null default false,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(school_id, student_id)
);

create table if not exists public.transport_trips (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  route_id uuid not null references public.transport_routes(id),
  trip_type text not null check (trip_type in ('morning','evening')),
  trip_date date not null default current_date,
  status text not null default 'scheduled',
  started_at timestamptz,
  ended_at timestamptz,
  helper_user_id uuid references public.user_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.trip_stop_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  trip_id uuid not null references public.transport_trips(id) on delete cascade,
  route_stop_id uuid not null references public.transport_stops(id),
  event_type text not null check (event_type in ('reached_auto','reached_manual','skipped','delayed')),
  reached_at timestamptz not null default now(),
  gps_confidence text,
  manual_reason text,
  created_by uuid references public.user_profiles(id)
);

-- ---------- AUDIT + IMPORTS ----------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete cascade,
  actor_id uuid references public.user_profiles(id),
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  import_type text not null,
  source_file text not null,
  status public.import_status not null default 'draft',
  total_rows int not null default 0,
  success_rows int not null default 0,
  failed_rows int not null default 0,
  summary jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.import_errors (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  row_number int not null,
  source_key text,
  error_message text not null,
  row_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  setting_key text not null,
  setting_value jsonb not null,
  updated_at timestamptz not null default now(),
  unique(school_id, setting_key)
);

-- ---------- UPDATED AT TRIGGER ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$ declare r record; begin
  for r in select unnest(array['schools','user_profiles','role_permissions','students','parents','fee_summaries','student_transport_assignments','app_settings']) as t loop
    execute format('drop trigger if exists trg_touch_%I on public.%I', r.t, r.t);
    execute format('create trigger trg_touch_%I before update on public.%I for each row execute function public.touch_updated_at()', r.t, r.t);
  end loop;
end $$;

-- ---------- PERMISSION HELPERS ----------
create or replace function public.current_school_id()
returns uuid language sql stable security definer set search_path = public as $$
  select school_id from public.user_profiles where id = auth.uid() limit 1;
$$;

create or replace function public.current_role_key()
returns text language sql stable security definer set search_path = public as $$
  select role_key from public.user_profiles where id = auth.uid() limit 1;
$$;

create or replace function public.has_permission(required_permission text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_profiles up
    join public.roles r on r.id = up.role_id
    join public.role_permissions rp on rp.role_id = r.id and rp.school_id = up.school_id and rp.enabled
    join public.permissions p on p.id = rp.permission_id
    where up.id = auth.uid()
      and p.permission_key = required_permission
      and up.status = 'active'
  ) or exists (
    select 1 from public.user_profiles up where up.id = auth.uid() and up.role_key = 'super_admin' and up.status = 'active'
  );
$$;

-- ---------- RLS ----------
alter table public.schools enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_profiles enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.student_parent_links enable row level security;
alter table public.fee_summaries enable row level security;
alter table public.vehicles enable row level security;
alter table public.transport_routes enable row level security;
alter table public.transport_stops enable row level security;
alter table public.student_transport_assignments enable row level security;
alter table public.transport_trips enable row level security;
alter table public.trip_stop_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_errors enable row level security;
alter table public.app_settings enable row level security;

-- Drop old policies to make script rerunnable.
do $$ declare pol record; begin
  for pol in select schemaname, tablename, policyname from pg_policies where schemaname='public' loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- Schools/profile visibility.
create policy schools_same_school_select on public.schools for select using (id = public.current_school_id() or public.current_role_key() = 'super_admin');
create policy own_profile_select on public.user_profiles for select using (id = auth.uid() or school_id = public.current_school_id() and public.has_permission('users.view'));
create policy user_profile_manage on public.user_profiles for all using (public.has_permission('users.manage') and school_id = public.current_school_id()) with check (public.has_permission('users.manage') and school_id = public.current_school_id());

-- Public permissions are readable to signed-in users in same project; role grants are school-scoped.
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy roles_read on public.roles for select using (school_id = public.current_school_id());
create policy roles_manage on public.roles for all using (public.has_permission('roles.manage') and school_id = public.current_school_id()) with check (public.has_permission('roles.manage') and school_id = public.current_school_id());
create policy role_permissions_read on public.role_permissions for select using (school_id = public.current_school_id());
create policy role_permissions_manage on public.role_permissions for all using (public.has_permission('roles.manage') and school_id = public.current_school_id()) with check (public.has_permission('roles.manage') and school_id = public.current_school_id());

-- Students: school staff by permission; parents only linked children.
create policy students_select on public.students for select using (
  (school_id = public.current_school_id() and public.has_permission('students.view'))
  or exists (
    select 1 from public.student_parent_links spl
    join public.parents p on p.id = spl.parent_id
    join public.user_profiles up on up.phone = p.phone
    where spl.student_id = students.id and up.id = auth.uid()
  )
);
create policy students_insert on public.students for insert with check (school_id = public.current_school_id() and public.has_permission('students.create'));
create policy students_update on public.students for update using (school_id = public.current_school_id() and public.has_permission('students.edit')) with check (school_id = public.current_school_id() and public.has_permission('students.edit'));

-- Parents and links.
create policy parents_select on public.parents for select using (school_id = public.current_school_id() and (public.has_permission('students.view') or public.has_permission('parents.view')));
create policy parents_manage on public.parents for all using (school_id = public.current_school_id() and public.has_permission('students.edit')) with check (school_id = public.current_school_id() and public.has_permission('students.edit'));
create policy links_select on public.student_parent_links for select using (school_id = public.current_school_id());
create policy links_manage on public.student_parent_links for all using (school_id = public.current_school_id() and public.has_permission('students.edit')) with check (school_id = public.current_school_id() and public.has_permission('students.edit'));

-- Generic module policies.
create policy classes_rw on public.classes for all using (school_id = public.current_school_id() and public.has_permission('academics.manage')) with check (school_id = public.current_school_id() and public.has_permission('academics.manage'));
create policy classes_read on public.classes for select using (school_id = public.current_school_id());

create policy fees_select on public.fee_summaries for select using (school_id = public.current_school_id() and (public.has_permission('fees.view') or public.current_role_key()='parent'));
create policy fees_manage on public.fee_summaries for all using (school_id = public.current_school_id() and public.has_permission('fees.manage')) with check (school_id = public.current_school_id() and public.has_permission('fees.manage'));

create policy transport_select_routes on public.vehicles for select using (school_id = public.current_school_id() and public.has_permission('transport.view'));
create policy transport_manage_vehicles on public.vehicles for all using (school_id = public.current_school_id() and public.has_permission('transport.manage')) with check (school_id = public.current_school_id() and public.has_permission('transport.manage'));
create policy transport_routes_select on public.transport_routes for select using (school_id = public.current_school_id() and public.has_permission('transport.view'));
create policy transport_routes_manage on public.transport_routes for all using (school_id = public.current_school_id() and public.has_permission('transport.manage')) with check (school_id = public.current_school_id() and public.has_permission('transport.manage'));
create policy transport_stops_select on public.transport_stops for select using (school_id = public.current_school_id() and public.has_permission('transport.view'));
create policy transport_stops_manage on public.transport_stops for all using (school_id = public.current_school_id() and public.has_permission('transport.manage')) with check (school_id = public.current_school_id() and public.has_permission('transport.manage'));
create policy student_transport_select on public.student_transport_assignments for select using (school_id = public.current_school_id() and (public.has_permission('transport.view') or public.current_role_key()='parent'));
create policy student_transport_manage on public.student_transport_assignments for all using (school_id = public.current_school_id() and public.has_permission('transport.manage')) with check (school_id = public.current_school_id() and public.has_permission('transport.manage'));
create policy trips_select on public.transport_trips for select using (school_id = public.current_school_id() and public.has_permission('transport.view'));
create policy trips_manage on public.transport_trips for all using (school_id = public.current_school_id() and public.has_permission('transport.trip.manage')) with check (school_id = public.current_school_id() and public.has_permission('transport.trip.manage'));
create policy trip_events_select on public.trip_stop_events for select using (school_id = public.current_school_id() and public.has_permission('transport.view'));
create policy trip_events_manage on public.trip_stop_events for all using (school_id = public.current_school_id() and public.has_permission('transport.trip.manage')) with check (school_id = public.current_school_id() and public.has_permission('transport.trip.manage'));

create policy audit_select on public.audit_logs for select using (school_id = public.current_school_id() and public.has_permission('audit.view'));
create policy audit_insert on public.audit_logs for insert with check (school_id = public.current_school_id());
create policy imports_select on public.import_jobs for select using (school_id = public.current_school_id() and public.has_permission('imports.view'));
create policy imports_errors_select on public.import_errors for select using (school_id = public.current_school_id() and public.has_permission('imports.view'));
create policy settings_read on public.app_settings for select using (school_id = public.current_school_id());
create policy settings_manage on public.app_settings for all using (school_id = public.current_school_id() and public.has_permission('settings.manage')) with check (school_id = public.current_school_id() and public.has_permission('settings.manage'));

-- ---------- PERMISSION SEED ----------
insert into public.permissions(permission_key,module,label,description) values
('dashboard.view','Core','View Dashboard','Open role dashboard'),
('students.view','Students','View Students','Read student records'),
('students.create','Students','Create Students','Add new students'),
('students.edit','Students','Edit Students','Update student data and status'),
('students.export','Students','Export Students','Download student reports'),
('parents.view','Parents','View Parents','Read parent records'),
('fees.view','Fees','View Fees','Read fee records'),
('fees.manage','Fees','Manage Fees','Create invoices and update fee summaries'),
('fees.export','Fees','Export Fees','Download fee reports'),
('transport.view','Transport','View Transport','See routes, stops, assignments and timelines'),
('transport.manage','Transport','Manage Transport','Edit routes, vehicles, stops and assignments'),
('transport.trip.manage','Transport','Manage Trips','Start trips and create stop events'),
('attendance.view','Attendance','View Attendance','Read attendance records'),
('attendance.manage','Attendance','Manage Attendance','Mark/edit attendance'),
('academics.view','Academics','View Academics','View calendar/timetable/exams'),
('academics.manage','Academics','Manage Academics','Edit calendar/timetable/exams'),
('communication.view','Communication','View Communication','Read notices/circulars'),
('communication.manage','Communication','Manage Communication','Send notices/circulars'),
('reports.view','Reports','View Reports','Open reports'),
('reports.export','Reports','Export Reports','Export reports'),
('roles.manage','Security','Manage Roles','Edit role permissions'),
('users.view','Security','View Users','Read staff/parent users'),
('users.manage','Security','Manage Users','Create and manage users'),
('design.manage','Design','Manage Design Portal','Theme and brand settings'),
('imports.view','Imports','View Imports','See import jobs and validation errors'),
('imports.manage','Imports','Manage Imports','Run and rollback imports'),
('audit.view','Security','View Audit Logs','Read audit logs'),
('settings.manage','Settings','Manage Settings','Edit school/system settings')
on conflict(permission_key) do update set label=excluded.label, module=excluded.module, description=excluded.description;
