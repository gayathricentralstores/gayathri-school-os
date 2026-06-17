-- =========================================================
-- Gayathri School OS — Batch 21
-- Parent-app-first setup, Super Admin CRUD RLS fix, demo parent phones,
-- and transport assignment data-integrity guardrails.
-- Safe to run multiple times.
-- =========================================================

-- 1) Super Admin CRUD permissions for real management screens

grant select, insert, update, delete on public.students to authenticated;
grant select, insert, update, delete on public.parents to authenticated;
grant select, insert, update, delete on public.student_parent_links to authenticated;
grant select, insert, update, delete on public.transport_routes to authenticated;
grant select, insert, update, delete on public.transport_stops to authenticated;
grant select, insert, update, delete on public.vehicles to authenticated;
grant select, insert, update, delete on public.student_transport_assignments to authenticated;
grant select, insert on public.audit_logs to authenticated;

drop policy if exists "super_admin_crud_students_batch21" on public.students;
create policy "super_admin_crud_students_batch21"
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

drop policy if exists "super_admin_crud_parents_batch21" on public.parents;
create policy "super_admin_crud_parents_batch21"
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

drop policy if exists "super_admin_crud_parent_links_batch21" on public.student_parent_links;
create policy "super_admin_crud_parent_links_batch21"
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

drop policy if exists "super_admin_crud_routes_batch21" on public.transport_routes;
create policy "super_admin_crud_routes_batch21"
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

drop policy if exists "super_admin_crud_stops_batch21" on public.transport_stops;
create policy "super_admin_crud_stops_batch21"
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

drop policy if exists "super_admin_crud_vehicles_batch21" on public.vehicles;
create policy "super_admin_crud_vehicles_batch21"
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

drop policy if exists "super_admin_crud_transport_assignments_batch21" on public.student_transport_assignments;
create policy "super_admin_crud_transport_assignments_batch21"
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

drop policy if exists "authenticated_insert_audit_logs_batch21" on public.audit_logs;
create policy "authenticated_insert_audit_logs_batch21"
on public.audit_logs
for insert
to authenticated
with check (
  school_id = public.current_user_school_id()
);

-- 2) Transport assignment integrity: one active assignment row per student,
-- and stop_id must belong to the selected route_id.

with ranked as (
  select
    id,
    row_number() over (
      partition by school_id, student_id
      order by updated_at desc nulls last, id desc
    ) as rn
  from public.student_transport_assignments
)
delete from public.student_transport_assignments sta
using ranked r
where sta.id = r.id
and r.rn > 1;

create unique index if not exists student_transport_assignments_one_row_per_student
on public.student_transport_assignments (school_id, student_id);

alter table public.student_transport_assignments
add column if not exists pickup_time time,
add column if not exists drop_time time,
add column if not exists opted boolean not null default true,
add column if not exists active boolean not null default true,
add column if not exists updated_at timestamptz not null default now();

alter table public.student_transport_assignments
drop constraint if exists student_transport_assignments_stop_id_fkey;

alter table public.student_transport_assignments
add constraint student_transport_assignments_stop_id_fkey
foreign key (stop_id)
references public.transport_stops(id)
on delete set null;

create or replace function public.validate_transport_assignment_stop()
returns trigger
language plpgsql
as $$
begin
  if new.stop_id is not null and new.route_id is not null then
    if not exists (
      select 1
      from public.transport_stops ts
      where ts.id = new.stop_id
        and ts.route_id = new.route_id
        and ts.school_id = new.school_id
    ) then
      raise exception 'Selected bus stop does not belong to selected bus route';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_transport_assignment_stop on public.student_transport_assignments;
create trigger trg_validate_transport_assignment_stop
before insert or update on public.student_transport_assignments
for each row execute function public.validate_transport_assignment_stop();

-- 3) Demo parent phones: assign each phone to one student from every class.
-- These become parent-app test accounts with multiple linked children.

with ranked_students as (
  select
    s.*,
    row_number() over (
      partition by s.school_id, s.class_label
      order by md5(s.admission_no)
    ) as rn
  from public.students s
  join public.schools sch on sch.id = s.school_id
  where sch.code = 'GCS'
    and s.status = 'active'
), chosen as (
  select
    id as student_id,
    school_id,
    case rn
      when 1 then '8129431344'
      when 2 then '9446727735'
      when 3 then '7510506202'
    end as phone,
    case rn
      when 1 then 'Demo Parent 8129'
      when 2 then 'Demo Parent 9446'
      when 3 then 'Demo Parent 7510'
    end as parent_name
  from ranked_students
  where rn in (1,2,3)
), upsert_parents as (
  insert into public.parents (school_id, parent_name, phone, relation, status, created_at, updated_at)
  select distinct school_id, parent_name, phone, 'Parent', 'active', now(), now()
  from chosen
  where phone is not null
  on conflict (school_id, phone) do update set
    parent_name = excluded.parent_name,
    relation = excluded.relation,
    status = 'active',
    updated_at = now()
  returning id, school_id, phone
), update_students as (
  update public.students s
  set
    parent_name = c.parent_name,
    parent_phone = c.phone,
    updated_at = now()
  from chosen c
  where s.id = c.student_id
  returning s.id, s.school_id
), remove_old_links as (
  delete from public.student_parent_links spl
  using chosen c
  where spl.student_id = c.student_id
    and spl.school_id = c.school_id
)
insert into public.student_parent_links (school_id, student_id, parent_id, relation, is_primary, created_at)
select c.school_id, c.student_id, p.id, 'Parent', true, now()
from chosen c
join public.parents p on p.school_id = c.school_id and p.phone = c.phone
on conflict (school_id, student_id, parent_id) do update set
  relation = excluded.relation,
  is_primary = true;

-- 4) Parent-role read policies prepared for later real parent login.
-- Current demo still runs through Super Admin, but this keeps the model safe.

drop policy if exists "parent_read_linked_students_batch21" on public.students;
create policy "parent_read_linked_students_batch21"
on public.students
for select
to authenticated
using (
  public.current_user_role_key() = 'parent'
  and exists (
    select 1
    from public.parents p
    join public.student_parent_links spl on spl.parent_id = p.id
    join public.user_profiles up on up.school_id = p.school_id
    where spl.student_id = students.id
      and up.id = auth.uid()
      and up.phone = p.phone
      and up.status = 'active'
  )
);

drop policy if exists "parent_read_linked_fee_summaries_batch21" on public.fee_summaries;
create policy "parent_read_linked_fee_summaries_batch21"
on public.fee_summaries
for select
to authenticated
using (
  public.current_user_role_key() = 'parent'
  and exists (
    select 1
    from public.parents p
    join public.student_parent_links spl on spl.parent_id = p.id
    join public.user_profiles up on up.school_id = p.school_id
    where spl.student_id = fee_summaries.student_id
      and up.id = auth.uid()
      and up.phone = p.phone
      and up.status = 'active'
  )
);

notify pgrst, 'reload schema';

-- Verification
select 'students_with_8129431344' as check_name, count(*) from public.students where parent_phone = '8129431344'
union all
select 'students_with_9446727735', count(*) from public.students where parent_phone = '9446727735'
union all
select 'students_with_7510506202', count(*) from public.students where parent_phone = '7510506202'
union all
select 'transport_assignments', count(*) from public.student_transport_assignments;
