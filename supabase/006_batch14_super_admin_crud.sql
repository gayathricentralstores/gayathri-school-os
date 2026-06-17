-- =========================================================
-- Gayathri School OS - Batch 14 Super Admin CRUD permissions
-- Adds safe Super Admin write access for student and transport management.
-- Keep RLS ON. This grants table-level access, then restricts writes through RLS.
-- =========================================================

-- Required grants for authenticated browser users. RLS still decides row access.
grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.parents to authenticated;
grant select, insert, update, delete on public.student_parent_links to authenticated;
grant select, insert, update, delete on public.transport_routes to authenticated;
grant select, insert, update, delete on public.transport_stops to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update, delete on public.student_transport_assignments to authenticated;
grant select, insert on public.audit_logs to authenticated;

grant select, insert, update, delete on public.students to service_role;
grant select, insert, update, delete on public.parents to service_role;
grant select, insert, update, delete on public.student_parent_links to service_role;
grant select, insert, update, delete on public.transport_routes to service_role;
grant select, insert, update, delete on public.transport_stops to service_role;
grant select, insert, update, delete on public.vehicles to service_role;
grant select, insert, update, delete on public.student_transport_assignments to service_role;
grant select, insert, update, delete on public.audit_logs to service_role;

alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.student_parent_links enable row level security;
alter table public.transport_routes enable row level security;
alter table public.transport_stops enable row level security;
alter table public.vehicles enable row level security;
alter table public.student_transport_assignments enable row level security;
alter table public.audit_logs enable row level security;

-- Students
drop policy if exists "super_admin_write_students_batch14" on public.students;

create policy "super_admin_write_students_batch14"
on public.students
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

-- Parents
drop policy if exists "super_admin_write_parents_batch14" on public.parents;

create policy "super_admin_write_parents_batch14"
on public.parents
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

-- Student-parent links
drop policy if exists "super_admin_write_student_parent_links_batch14" on public.student_parent_links;

create policy "super_admin_write_student_parent_links_batch14"
on public.student_parent_links
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

-- Transport routes
drop policy if exists "super_admin_write_transport_routes_batch14" on public.transport_routes;

create policy "super_admin_write_transport_routes_batch14"
on public.transport_routes
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

-- Transport stops
drop policy if exists "super_admin_write_transport_stops_batch14" on public.transport_stops;

create policy "super_admin_write_transport_stops_batch14"
on public.transport_stops
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

-- Vehicles
drop policy if exists "super_admin_write_vehicles_batch14" on public.vehicles;

create policy "super_admin_write_vehicles_batch14"
on public.vehicles
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

-- Student transport assignments
drop policy if exists "super_admin_write_student_transport_assignments_batch14" on public.student_transport_assignments;

create policy "super_admin_write_student_transport_assignments_batch14"
on public.student_transport_assignments
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

-- Audit log insert by same-school authenticated users. Read policies already exist for Super Admin.
drop policy if exists "authenticated_insert_audit_logs_batch14" on public.audit_logs;

create policy "authenticated_insert_audit_logs_batch14"
on public.audit_logs
for insert
to authenticated
with check (
  school_id = public.current_user_school_id()
);

notify pgrst, 'reload schema';
