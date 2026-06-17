-- =========================================================
-- Gayathri School OS - Batch 15-20 Foundation
-- Parent access, payments, attendance, timetable, exams, notifications
-- Safe to run multiple times. Keeps RLS ON.
-- =========================================================

create extension if not exists "pgcrypto";

do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='role_tab_access' and column_name='production_controls') then
    alter table public.role_tab_access add column production_controls boolean default false;
  end if;
end $$;

-- Parent login/linking foundation
create table if not exists public.parent_access_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  parent_phone text not null,
  admission_no text,
  dob date,
  status text not null default 'pending',
  verified_parent_id uuid references public.parents(id) on delete set null,
  verified_student_id uuid references public.students(id) on delete set null,
  requested_at timestamptz not null default now(),
  verified_at timestamptz,
  notes text
);

-- Payment gateway/counter foundation
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  fee_summary_id uuid references public.fee_summaries(id) on delete set null,
  provider text not null default 'counter',
  provider_order_id text,
  provider_payment_id text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'INR',
  status text not null default 'created',
  payment_mode text,
  collected_by uuid,
  receipt_no text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, provider, provider_order_id)
);

create table if not exists public.fee_receipts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  payment_transaction_id uuid references public.payment_transactions(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  receipt_no text not null,
  amount numeric(12,2) not null default 0,
  issued_at timestamptz not null default now(),
  issued_by uuid,
  receipt_status text not null default 'issued',
  pdf_url text,
  unique (school_id, receipt_no)
);

-- Attendance foundation
create table if not exists public.student_attendance (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  attendance_date date not null default current_date,
  session text not null default 'full_day',
  status text not null default 'present',
  marked_by uuid,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_id, attendance_date, session)
);

create table if not exists public.staff_attendance_imports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  source_file text,
  import_date date not null default current_date,
  status text not null default 'uploaded',
  total_rows integer not null default 0,
  processed_rows integer not null default 0,
  uploaded_by uuid,
  created_at timestamptz not null default now(),
  notes text
);

create table if not exists public.substitution_assignments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  absent_teacher_name text not null,
  substitute_teacher_name text,
  class_label text,
  division text,
  period_no integer,
  subject text,
  assignment_date date not null default current_date,
  status text not null default 'suggested',
  assigned_by uuid,
  created_at timestamptz not null default now()
);

-- Timetable backend foundation
create table if not exists public.timetable_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  academic_year text not null default '2026-27',
  class_label text not null,
  division text not null,
  stream text not null default '',
  periods_per_day integer not null default 7,
  working_days text[] not null default array['Mon','Tue','Wed','Thu','Fri'],
  status text not null default 'draft',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, academic_year, class_label, division, stream)
);

create table if not exists public.timetable_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  timetable_template_id uuid references public.timetable_templates(id) on delete cascade,
  day_name text not null,
  period_no integer not null,
  subject text not null,
  teacher_name text,
  room_name text,
  conflict_status text not null default 'clear',
  created_at timestamptz not null default now(),
  unique (timetable_template_id, day_name, period_no)
);

-- Exam/report card foundation
create table if not exists public.exam_results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year text not null default '2026-27',
  exam_name text not null,
  subject text not null,
  max_marks numeric(8,2) not null default 100,
  marks_obtained numeric(8,2),
  grade text,
  status text not null default 'draft',
  entered_by uuid,
  verified_by uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, student_id, academic_year, exam_name, subject)
);

-- Notification/reminder queue
create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  audience_type text not null,
  audience_ref text,
  channel text not null default 'in_app',
  template_key text not null,
  title text not null,
  body text not null,
  priority text not null default 'normal',
  status text not null default 'queued',
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivery_meta jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Grants
alter table public.parent_access_requests enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.fee_receipts enable row level security;
alter table public.student_attendance enable row level security;
alter table public.staff_attendance_imports enable row level security;
alter table public.substitution_assignments enable row level security;
alter table public.timetable_templates enable row level security;
alter table public.timetable_periods enable row level security;
alter table public.exam_results enable row level security;
alter table public.notification_queue enable row level security;

grant select, insert, update, delete on public.parent_access_requests to service_role, authenticated;
grant select, insert, update, delete on public.payment_transactions to service_role, authenticated;
grant select, insert, update, delete on public.fee_receipts to service_role, authenticated;
grant select, insert, update, delete on public.student_attendance to service_role, authenticated;
grant select, insert, update, delete on public.staff_attendance_imports to service_role, authenticated;
grant select, insert, update, delete on public.substitution_assignments to service_role, authenticated;
grant select, insert, update, delete on public.timetable_templates to service_role, authenticated;
grant select, insert, update, delete on public.timetable_periods to service_role, authenticated;
grant select, insert, update, delete on public.exam_results to service_role, authenticated;
grant select, insert, update, delete on public.notification_queue to service_role, authenticated;

-- Super admin can manage all new foundation tables for own school.
do $$
declare t text;
begin
  foreach t in array array[
    'parent_access_requests','payment_transactions','fee_receipts','student_attendance','staff_attendance_imports',
    'substitution_assignments','timetable_templates','timetable_periods','exam_results','notification_queue'
  ] loop
    execute format('drop policy if exists super_admin_all_%I on public.%I', t, t);
    execute format($p$
      create policy super_admin_all_%I
      on public.%I
      for all
      to authenticated
      using (school_id = public.current_user_school_id() and public.current_user_role_key() = 'super_admin')
      with check (school_id = public.current_user_school_id() and public.current_user_role_key() = 'super_admin')
    $p$, t, t);
  end loop;
end $$;

notify pgrst, 'reload schema';
