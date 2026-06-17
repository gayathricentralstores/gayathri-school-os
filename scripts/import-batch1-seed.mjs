import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const csvPath = (...parts) => path.join(root, 'data', 'seed', ...parts);
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schoolCode = process.env.GCS_SCHOOL_CODE || 'GCS';
const schoolName = process.env.GCS_SCHOOL_NAME || 'Gayathri Central School';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  console.error('Run with: node --env-file=.env scripts/import-batch1-seed.mjs');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function readCsv(file) {
  const fullPath = csvPath(file);
  if (!fs.existsSync(fullPath)) {
    console.error(`CSV file not found: ${fullPath}`);
    process.exit(1);
  }
  return parse(fs.readFileSync(fullPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function clean(value) {
  const v = String(value ?? '').trim();
  return v.length ? v : null;
}

function text(value, fallback = '') {
  const v = clean(value);
  return v ?? fallback;
}

function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('transfer')) return 'transferred';
  if (s.includes('inactive')) return 'inactive';
  if (s.includes('alumni')) return 'alumni';
  return 'active';
}

function uniqueBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

function chunk(rows, size = 500) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) chunks.push(rows.slice(i, i + size));
  return chunks;
}

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) {
    console.error(`\n${label} failed:`);
    console.error(error);
    process.exit(1);
  }
  return data;
}

async function tryQuery(label, promise) {
  const { data, error } = await promise;
  if (error) {
    console.warn(`\n${label} skipped/failed:`);
    console.warn(`${error.code || ''} ${error.message || error}`);
    return { data: null, error };
  }
  return { data, error: null };
}

async function upsertAndFetch(table, rows, onConflict, select = '*', size = 500) {
  if (!rows.length) return [];
  const all = [];
  for (const part of chunk(rows, size)) {
    const data = await must(
      `upsert ${table}`,
      supabase.from(table).upsert(part, { onConflict }).select(select)
    );
    all.push(...(data || []));
  }
  return all;
}

async function tryUpsertAndFetch(label, table, rows, onConflict, select = '*', size = 500) {
  if (!rows.length) return { data: [], error: null };
  const all = [];
  for (const part of chunk(rows, size)) {
    const { data, error } = await supabase.from(table).upsert(part, { onConflict }).select(select);
    if (error) {
      console.warn(`\n${label} failed:`);
      console.warn(`${error.code || ''} ${error.message || error}`);
      return { data: null, error };
    }
    all.push(...(data || []));
  }
  return { data: all, error: null };
}

function validateStudents(rows) {
  const errors = [];
  const seenAdmission = new Set();
  const required = ['student_id', 'admission_no', 'student_name', 'class', 'division', 'academic_year', 'parent_name', 'parent_phone'];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    for (const field of required) {
      if (!clean(row[field])) errors.push({ rowNumber, sourceKey: row.admission_no || row.student_id || '', message: `Missing ${field}`, row });
    }
    if (seenAdmission.has(row.admission_no)) errors.push({ rowNumber, sourceKey: row.admission_no, message: 'Duplicate admission_no inside CSV', row });
    seenAdmission.add(row.admission_no);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.dob || ''))) errors.push({ rowNumber, sourceKey: row.admission_no, message: 'DOB must be YYYY-MM-DD', row });
    if (!/^\d{10}$/.test(String(row.parent_phone || ''))) errors.push({ rowNumber, sourceKey: row.admission_no, message: 'Parent phone must be 10 digits', row });
  });

  return errors;
}

const permissionGrants = {
  super_admin: [
    'dashboard.view', 'students.view', 'students.create', 'students.edit', 'students.export',
    'parents.view', 'fees.view', 'fees.manage', 'fees.export', 'transport.view', 'transport.manage',
    'transport.trip.manage', 'attendance.view', 'attendance.manage', 'academics.view', 'academics.manage',
    'communication.view', 'communication.manage', 'reports.view', 'reports.export', 'roles.manage',
    'users.view', 'users.manage', 'design.manage', 'imports.view', 'imports.manage', 'audit.view', 'settings.manage',
  ],
  school_admin: ['dashboard.view', 'students.view', 'students.create', 'students.edit', 'students.export', 'parents.view', 'fees.view', 'transport.view', 'transport.manage', 'attendance.view', 'academics.view', 'academics.manage', 'communication.view', 'communication.manage', 'reports.view', 'reports.export', 'imports.view', 'audit.view'],
  principal: ['dashboard.view', 'students.view', 'students.export', 'parents.view', 'fees.view', 'fees.export', 'transport.view', 'attendance.view', 'academics.view', 'communication.view', 'communication.manage', 'reports.view', 'reports.export', 'audit.view'],
  accountant: ['dashboard.view', 'students.view', 'parents.view', 'fees.view', 'fees.manage', 'fees.export', 'reports.view', 'reports.export'],
  teacher: ['dashboard.view', 'students.view', 'attendance.view', 'attendance.manage', 'academics.view', 'communication.view'],
  class_teacher: ['dashboard.view', 'students.view', 'students.edit', 'parents.view', 'attendance.view', 'attendance.manage', 'academics.view', 'communication.view', 'communication.manage', 'reports.view'],
  transport_head: ['dashboard.view', 'students.view', 'transport.view', 'transport.manage', 'transport.trip.manage', 'reports.view', 'reports.export'],
  bus_helper: ['dashboard.view', 'transport.view', 'transport.trip.manage'],
  parent: ['dashboard.view', 'fees.view', 'transport.view', 'attendance.view', 'academics.view', 'communication.view'],
  student: ['dashboard.view', 'academics.view', 'communication.view'],
};

function permissionModule(permissionKey) {
  return permissionKey.split('.')[0] || 'system';
}

function permissionLabel(permissionKey) {
  return permissionKey.split('.').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

async function createImportJob(schoolId, totalRows, errors) {
  const result = await tryQuery(
    'create import job',
    supabase.from('import_jobs').insert({
      school_id: schoolId,
      import_type: 'batch1_seed_students_transport_roles',
      source_file: 'data/seed/*.csv',
      status: errors.length ? 'failed' : 'validating',
      total_rows: totalRows,
      failed_rows: errors.length,
      summary: { files: ['students_1000.csv', 'transport_routes_stops.csv', 'role_permissions_seed.csv'] },
    }).select('*').single()
  );

  if (!result.error) return result.data;

  return await must(
    'create import job using job_type fallback',
    supabase.from('import_jobs').insert({
      school_id: schoolId,
      job_type: 'batch1_seed_students_transport_roles',
      source_file: 'data/seed/*.csv',
      status: errors.length ? 'failed' : 'validating',
      total_rows: totalRows,
      failed_rows: errors.length,
      notes: JSON.stringify({ files: ['students_1000.csv', 'transport_routes_stops.csv', 'role_permissions_seed.csv'] }),
    }).select('*').single()
  );
}

async function updateImportJob(job, fieldsLegacy, fieldsProduction) {
  const first = await tryQuery('update import job', supabase.from('import_jobs').update(fieldsLegacy).eq('id', job.id));
  if (!first.error) return;
  await must('update import job using production fallback', supabase.from('import_jobs').update(fieldsProduction).eq('id', job.id));
}

async function seedRolesAndPermissions(schoolId) {
  const roleRows = Object.keys(permissionGrants).map((roleKey) => ({
    school_id: schoolId,
    role_key: roleKey,
    role_name: roleKey.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
    is_system: true,
  }));

  const roleResult = await tryUpsertAndFetch('upsert roles', 'roles', roleRows, 'school_id,role_key');
  if (roleResult.error) {
    const roleRowsAlt = roleRows.map(({ is_system, ...r }) => ({ ...r, is_system_role: true }));
    const alt = await tryUpsertAndFetch('upsert roles with is_system_role', 'roles', roleRowsAlt, 'school_id,role_key');
    if (alt.error) process.exit(1);
    return await seedPermissionsFromRoles(schoolId, alt.data || []);
  }
  return await seedPermissionsFromRoles(schoolId, roleResult.data || []);
}

async function seedPermissionsFromRoles(schoolId, roles) {
  const roleByKey = new Map(roles.map((r) => [r.role_key, r]));
  const allPermissionKeys = [...new Set(Object.values(permissionGrants).flat())];
  const permissionRows = allPermissionKeys.map((permissionKey) => ({
    permission_key: permissionKey,
    module: permissionModule(permissionKey),
    label: permissionLabel(permissionKey),
    description: permissionLabel(permissionKey),
  }));
  const permissions = await upsertAndFetch('permissions', permissionRows, 'permission_key');
  const rolePermissionRows = [];
  for (const [roleKey, grants] of Object.entries(permissionGrants)) {
    for (const permission of permissions) {
      rolePermissionRows.push({
        school_id: schoolId,
        role_id: roleByKey.get(roleKey)?.id,
        permission_id: permission.id,
        enabled: grants.includes(permission.permission_key),
      });
    }
  }
  await upsertAndFetch('role_permissions', rolePermissionRows.filter((r) => r.role_id), 'school_id,role_id,permission_id', 'id');
  return roles;
}

async function main() {
  console.log('Gayathri School OS Batch 1 import starting...');

  const studentsCsv = readCsv('students_1000.csv');
  const stopsCsv = readCsv('transport_routes_stops.csv');
  const errors = validateStudents(studentsCsv);

  const schoolResult = await tryUpsertAndFetch('upsert schools', 'schools', [{
    code: schoolCode,
    name: schoolName,
    address: 'South Monkuzhy, Pullikkanakku P.O',
    city: 'Kayamkulam',
    state: 'Kerala',
    pincode: '690537',
    logo_path: '/gayathri-logo.png',
    active: true,
  }], 'code');

  if (schoolResult.error) process.exit(1);
  const school = schoolResult.data[0];
  const schoolId = school.id;

  const job = await createImportJob(schoolId, studentsCsv.length, errors);

  if (errors.length) {
    await tryQuery(
      'insert import errors',
      supabase.from('import_errors').insert(errors.slice(0, 500).map((e) => ({
        school_id: schoolId,
        import_job_id: job.id,
        row_number: e.rowNumber,
        source_key: e.sourceKey,
        error_message: e.message,
        row_data: e.row,
      })))
    );
    throw new Error(`${errors.length} validation errors found. See import_errors table.`);
  }

  await updateImportJob(job, { status: 'importing' }, { status: 'importing' });

  await seedRolesAndPermissions(schoolId);

  const classRows = uniqueBy(studentsCsv.map((s) => ({
    school_id: schoolId,
    class_label: String(s.class),
    division: s.division,
    stream: text(s.stream, ''),
    academic_year: s.academic_year,
    active: true,
  })), (r) => `${r.class_label}|${r.division}|${r.stream}|${r.academic_year}`);
  await upsertAndFetch('classes', classRows, 'school_id,class_label,division,stream,academic_year', 'id');

  const vehicleRows = uniqueBy(stopsCsv.map((s) => ({
    school_id: schoolId,
    bus_no: s.bus_no,
    driver_name: s.driver,
    attendant_name: s.female_attendant,
    active: true,
  })), (r) => r.bus_no);
  const vehicles = await upsertAndFetch('vehicles', vehicleRows, 'school_id,bus_no');
  const vehicleByBus = new Map(vehicles.map((v) => [v.bus_no, v]));

  const routeRows = uniqueBy(stopsCsv.map((s) => ({
    school_id: schoolId,
    route_code: s.route_id,
    route_name: s.route_name,
    vehicle_id: vehicleByBus.get(s.bus_no)?.id || null,
    active: true,
  })), (r) => r.route_code);
  const routes = await upsertAndFetch('transport_routes', routeRows, 'school_id,route_code');
  const routeByCode = new Map(routes.map((r) => [r.route_code, r]));

  const stopRowsWithGeofence = stopsCsv.map((s) => ({
    school_id: schoolId,
    route_id: routeByCode.get(s.route_id)?.id,
    stop_order: toNumber(s.stop_order),
    stop_name: s.stop_name,
    latitude: toNumber(s.latitude_mock, null),
    longitude: toNumber(s.longitude_mock, null),
    geofence_radius_m: toNumber(s.geofence_radius_m, 100),
    parent_visible_status: s.parent_visible_status || 'Stop-level timeline only',
    active: true,
  })).filter((s) => s.route_id);

  let stopsResult = await tryUpsertAndFetch('upsert transport_stops with geofence_radius_m', 'transport_stops', stopRowsWithGeofence, 'route_id,stop_order');
  if (stopsResult.error) {
    const stopRowsWithRadius = stopRowsWithGeofence.map(({ geofence_radius_m, parent_visible_status, active, ...s }) => ({
      ...s,
      radius_m: geofence_radius_m,
      status: active ? 'active' : 'inactive',
    }));
    stopsResult = await tryUpsertAndFetch('upsert transport_stops with radius_m', 'transport_stops', stopRowsWithRadius, 'route_id,stop_order');
  }
  if (stopsResult.error) process.exit(1);
  const stops = stopsResult.data || [];

  const stopKey = (routeId, stopName) => `${routeId}|${String(stopName || '').trim().toLowerCase()}`;
  const stopByRouteStop = new Map(stops.map((s) => [stopKey(s.route_id, s.stop_name), s]));

  const studentRows = studentsCsv.map((s) => ({
    school_id: schoolId,
    student_id: s.student_id,
    admission_no: s.admission_no,
    student_name: s.student_name,
    gender: clean(s.gender),
    dob: clean(s.dob),
    class_label: String(s.class),
    division: s.division,
    stream: text(s.stream, ''),
    roll_no: toNumber(s.roll_no, null),
    academic_year: s.academic_year,
    status: normalizeStatus(s.status),
    date_of_joining: clean(s.date_of_joining),
    blood_group: clean(s.blood_group),
    house: clean(s.house),
    locality: clean(s.locality),
    pincode: clean(s.pincode),
    attendance_percent: toNumber(s.attendance_percent, null),
    phone_verification: clean(s.phone_verification),
    dob_verification: clean(s.dob_verification),
    data_confidence: clean(s.data_confidence),
  }));
  const students = await upsertAndFetch('students', studentRows, 'school_id,admission_no');
  const studentByAdmission = new Map(students.map((s) => [s.admission_no, s]));

  const parentRows = uniqueBy(studentsCsv.map((s) => ({
    school_id: schoolId,
    parent_name: s.parent_name,
    relation: clean(s.parent_relation),
    phone: s.parent_phone,
    alternate_phone: clean(s.alternate_phone),
    email: clean(s.parent_email),
    phone_verified: s.phone_verification === 'Verified',
  })), (r) => r.phone);
  const parents = await upsertAndFetch('parents', parentRows, 'school_id,phone');
  const parentByPhone = new Map(parents.map((p) => [p.phone, p]));

  const linkRows = studentsCsv.map((s) => ({
    school_id: schoolId,
    student_id: studentByAdmission.get(s.admission_no)?.id,
    parent_id: parentByPhone.get(s.parent_phone)?.id,
    is_primary: true,
  })).filter((r) => r.student_id && r.parent_id);
  await upsertAndFetch('student_parent_links', linkRows, 'school_id,student_id,parent_id', 'id');

  const feeRowsWithNewColumns = studentsCsv.map((s) => {
    const totalDue = toNumber(s.total_fee_annual);
    const pendingAmount = toNumber(s.amount_due);
    const totalPaid = Math.max(totalDue - pendingAmount, 0);
    return {
      school_id: schoolId,
      student_id: studentByAdmission.get(s.admission_no)?.id,
      academic_year: s.academic_year || '2026-27',
      tuition_fee: toNumber(s.tuition_fee_annual),
      transport_fee: toNumber(s.transport_fee_annual),
      store_balance: 0,
      total_due: totalDue,
      total_paid: totalPaid,
      pending_amount: pendingAmount,
      payment_status: String(s.fee_status || 'Pending').toLowerCase(),
      next_due_date: '2026-07-10',
    };
  }).filter((r) => r.student_id);

  let feesResult = await tryUpsertAndFetch('upsert fee_summaries with production columns', 'fee_summaries', feeRowsWithNewColumns, 'school_id,student_id,academic_year', 'id');
  if (feesResult.error) {
    const feeRowsLegacyColumns = studentsCsv.map((s) => ({
      school_id: schoolId,
      student_id: studentByAdmission.get(s.admission_no)?.id,
      tuition_fee_annual: toNumber(s.tuition_fee_annual),
      transport_fee_annual: toNumber(s.transport_fee_annual),
      total_fee_annual: toNumber(s.total_fee_annual),
      fee_status: s.fee_status || 'Pending',
      amount_due: toNumber(s.amount_due),
    })).filter((r) => r.student_id);
    feesResult = await tryUpsertAndFetch('upsert fee_summaries with legacy columns', 'fee_summaries', feeRowsLegacyColumns, 'school_id,student_id', 'id');
  }
  if (feesResult.error) process.exit(1);

  const transportRowsProduction = studentsCsv.map((s) => {
    const route = routeByCode.get(s.route_id);
    const stop = route ? stopByRouteStop.get(stopKey(route.id, s.bus_stop)) : null;
    const opted = s.transport_opted === 'Yes';
    return {
      school_id: schoolId,
      student_id: studentByAdmission.get(s.admission_no)?.id,
      route_id: opted ? route?.id || null : null,
      stop_id: opted ? stop?.id || null : null,
      morning_enabled: opted,
      evening_enabled: opted,
      transport_status: opted ? 'active' : 'not_opted',
    };
  }).filter((r) => r.student_id);

  let transportAssignmentResult = await tryUpsertAndFetch('upsert student_transport_assignments production columns', 'student_transport_assignments', transportRowsProduction, 'school_id,student_id', 'id');
  if (transportAssignmentResult.error) {
    const transportRowsLegacy = studentsCsv.map((s) => {
      const route = routeByCode.get(s.route_id);
      const stop = route ? stopByRouteStop.get(stopKey(route.id, s.bus_stop)) : null;
      const opted = s.transport_opted === 'Yes';
      return {
        school_id: schoolId,
        student_id: studentByAdmission.get(s.admission_no)?.id,
        route_id: opted ? route?.id || null : null,
        stop_id: opted ? stop?.id || null : null,
        pickup_time: clean(s.pickup_time),
        drop_time: clean(s.drop_time),
        opted,
        active: true,
      };
    }).filter((r) => r.student_id);
    transportAssignmentResult = await tryUpsertAndFetch('upsert student_transport_assignments legacy columns', 'student_transport_assignments', transportRowsLegacy, 'school_id,student_id', 'id');
  }
  if (transportAssignmentResult.error) process.exit(1);

  await tryQuery('insert audit log', supabase.from('audit_logs').insert({
    school_id: schoolId,
    actor_role: 'system_import_script',
    action: 'batch1_seed_import_completed',
    entity_type: 'import_job',
    entity_id: String(job.id),
    new_data: {
      students: students.length,
      parents: parents.length,
      routes: routes.length,
      transport_stops: stops.length,
      vehicles: vehicles.length,
      fee_summaries: feesResult.data?.length || 0,
    },
  }));

  await updateImportJob(
    job,
    {
      status: 'completed',
      success_rows: studentsCsv.length,
      failed_rows: 0,
      completed_at: new Date().toISOString(),
      summary: {
        students: students.length,
        parents: parents.length,
        routes: routes.length,
        transport_stops: stops.length,
        vehicles: vehicles.length,
        classes: classRows.length,
        fee_summaries: feesResult.data?.length || 0,
      },
    },
    {
      status: 'completed',
      success_rows: studentsCsv.length,
      failed_rows: 0,
      completed_at: new Date().toISOString(),
      notes: JSON.stringify({
        students: students.length,
        parents: parents.length,
        routes: routes.length,
        transport_stops: stops.length,
        vehicles: vehicles.length,
        classes: classRows.length,
        fee_summaries: feesResult.data?.length || 0,
      }),
    }
  );

  console.log('\nImport complete.');
  console.log(`School: ${schoolName} (${schoolId})`);
  console.log(`Students imported/upserted: ${students.length}`);
  console.log(`Parents imported/upserted: ${parents.length}`);
  console.log(`Routes: ${routes.length}`);
  console.log(`Vehicles: ${vehicles.length}`);
  console.log(`transport_stops imported/upserted: ${stops.length}`);
  console.log(`fee_summaries imported/upserted: ${feesResult.data?.length || 0}`);
  console.log(`Student transport assignments: ${transportAssignmentResult.data?.length || 0}`);
}

main().catch((err) => {
  console.error('\nImport failed:', err.message);
  process.exit(1);
});
