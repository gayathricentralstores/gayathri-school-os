# Gayathri School OS — Production Batch 1

This is the restart build for the real product foundation. It is not a pitch-only prototype.

## What Batch 1 includes

- Supabase production schema starter
- Row Level Security policies
- School/tenant table
- Roles and permissions system
- Super Admin-ready role matrix
- Students table matching the generated `students_1000.csv`
- Parents and student-parent linking
- Fee summary seed table
- Transport routes/stops/assignments for stop-level bus tracking
- Import job and import error logs
- Audit log table
- React/Vite app connected to Supabase
- Student database browser/editor
- Transport stop-timeline UI
- Import status viewer

## Files you should use

```text
supabase/001_production_foundation.sql
scripts/import-batch1-seed.mjs
data/seed/students_1000.csv
data/seed/transport_routes_stops.csv
data/seed/role_permissions_seed.csv
src/lib/supabase.js
src/main.jsx
src/index.css
```

## Step-by-step setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create Supabase project

Create a fresh Supabase project for development/staging first. Example name:

```text
gayathri-school-os-dev
```

### 3. Run SQL schema

Open Supabase Dashboard → SQL Editor → New Query.

Paste and run:

```text
supabase/001_production_foundation.sql
```

### 4. Create `.env`

Copy:

```bash
cp .env.example .env
```

Fill these values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GCS_SCHOOL_CODE=GCS
GCS_SCHOOL_NAME=Gayathri Central School
```

Never place `SUPABASE_SERVICE_ROLE_KEY` inside frontend code or deploy it to the browser.
It is used only by the local import script.

### 5. Run the import script

In PowerShell, load env manually or use Git Bash. Easiest cross-platform method:

```bash
npm run import:seed
```

If your shell does not load `.env` automatically, run it like this with Node 20+:

```bash
node --env-file=.env scripts/import-batch1-seed.mjs
```

The script imports:

- 1000 students
- Parent records
- Student-parent links
- Fee summaries
- Vehicles
- Transport routes
- Route stops
- Student transport assignments
- Roles
- Role permissions
- Import job log

### 6. Create your first Super Admin auth user

Supabase Dashboard → Authentication → Users → Add user.

Example:

```text
admin@gayathri.school
```

After creating the auth user, copy the user's UUID.

Then run this SQL, replacing the UUID and email:

```sql
insert into public.user_profiles (
  id,
  school_id,
  full_name,
  email,
  role_id,
  role_key,
  status
)
select
  'PASTE_AUTH_USER_UUID_HERE'::uuid,
  s.id,
  'ERP Owner',
  'admin@gayathri.school',
  r.id,
  'super_admin',
  'active'
from public.schools s
join public.roles r on r.school_id = s.id and r.role_key = 'super_admin'
where s.code = 'GCS'
on conflict (id) do update set
  school_id = excluded.school_id,
  full_name = excluded.full_name,
  email = excluded.email,
  role_id = excluded.role_id,
  role_key = excluded.role_key,
  status = excluded.status;
```

### 7. Run the app

```bash
npm run dev
```

Login using the Supabase Auth user you created.

## Production rule

Do not import actual school data until these pass:

- RLS test for parent
- RLS test for teacher
- RLS test for bus helper
- RLS test for accountant
- Audit log checks
- Import rollback strategy
- Backup restore test

Batch 1 uses the generated 1000-student synthetic dataset as the production-shaped development database.
