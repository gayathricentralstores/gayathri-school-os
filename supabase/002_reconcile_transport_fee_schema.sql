import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const seedPath = (...p) => path.join(root, 'data', 'seed', ...p);

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const schoolCode = process.env.GCS_SCHOOL_CODE || 'GCS';
const schoolName = process.env.GCS_SCHOOL_NAME || 'Gayathri Central School';

function readCsv(file) {
  const filePath = seedPath(file);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing CSV: ${filePath}`);
    process.exit(1);
  }

  return parse(fs.readFileSync(filePath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function clean(v) {
  const value = String(v ?? '').trim();
  return value || null;
}

function num(v, fallback = 0) {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function boolYes(v) {
  return String(v || '').trim().toLowerCase() === 'yes';
}

function uniqueBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

function chunks(rows, size = 500) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function must(label, query) {
  const { data, error } = await query;
  if (error) {
    console.error(`\n${label} failed:`);
    console.error(error);
    process.exit(1);
  }
  return data;
}

async function upsert(table, rows, onConflict, select = '*') {
  if (!rows.length) return [];
  const all = [];

  for (const part of chunks(rows)) {
    const data = await must(
      `upsert ${table}`,
      supabase.from(table).upsert(part, { onConflict }).select(select)
    );
    all.push(...(data || []));
  }

  return all;
}

function paymentStatus(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('paid') && !s.includes('partial')) return 'paid';
  if (s.includes('partial')) return 'partial';
  if (s.includes('overdue')) return 'overdue';
  return 'pending';
}

function studentStatus(v) {
  const s = String(v || '').toLowerCase();
  if (s.includes('transfer')) return 'transferred';
  if (s.includes('inactive')) return 'inactive';
  if (s.includes('alumni')) return 'alumni';
  return 'active';
}

const rolePermissions = {
  super_admin: [
    'dashboard.view',
    'students.view',
    'students.create',
    'students.edit',
    'students.export',
    'parents.view',
    'fees.view',
    'fees.manage',
    'fees.export',
    'transport.view',
    'transport.manage',
    'attendance.view',
    'attendance.manage',
    'academics.view',
    'academics.manage',
    'communication.view',
    'communication.manage',
    'reports.view',
    'reports.export',
    'roles.manage',
    'design.manage',
    'imports.manage',
    'audit.view',
    'settings.manage',
  ],
  school_admin: [
    'dashboard.view',
    'students.view',
    'students.edit',
    'parents.view',
    'fees.view',
    'transport.view',
    'attendance.view',
    'academics.view',
    'communication.view',
    'reports.view',
  ],
  principal: [
    'dashboard.view',
    'students.view',
    'fees.view',
    'transport.view',
    'attendance.view',
    'academics.view',
    'communication.view',
    'reports.view',
  ],
  accountant: ['dashboard.view', 'students.view', 'fees.view', 'fees.manage', 'fees.export'],
  teacher: ['dashboard.view', 'students.view', 'attendance.view', 'attendance.manage', 'academics.view'],
  class_teacher: ['dashboard.view', 'students.view', 'students.edit', 'attendance.view', 'attendance.manage', 'academics.view'],
  transport_head: ['dashboard.view', 'students.view', 'transport.view', 'transport.manage'],
  bus_helper: ['dashboard.view', 'transport.view'],
  parent: ['dashboard.view', 'fees.view', 'transport.view', 'attendance.view', 'academics.view', 'communication.view'],
  student: ['dashboard.view', 'academics.view', 'communication.view'],
};

async function main() {
  console.log('Gayathri School OS Batch 1 import starting...');

  const studentsCsv = readCsv('students_1000.csv');
  const stopsCsv = readCsv('transport_routes_stops.csv');

  const [school] = await upsert(
    'schools',
    [{
      code: schoolCode,
      name: schoolName,
      address: 'South Monkuzhy, Pullikkanakku P.O',
      city: 'Kayamkulam',
      state: 'Kerala',
      status: 'active',
    }],
    'code'
  );

  const schoolId = school.id;

  const importJob = await must(
    'create import job',
    supabase.from('import_jobs').insert({
      school_id: schoolId,
      job_type: 'batch1_seed_import',
      source_file: 'students_1000.csv + transport_routes_stops.csv',
      status: 'importing',
      total_rows: studentsCsv.length,
      success_rows: 0,
      failed_rows: 0,
      notes: 'Production Batch 1 import',
    }).select('*').single()
  );

  const roleRows = Object.keys(rolePermissions).map((roleKey) => ({
    school_id: schoolId,
    role_key: roleKey,
    role_name: roleKey.split('_').map((x) => x[0].toUpperCase() + x.slice(1)).join(' '),
    is_system_role: true,
  }));

  const roles = await upsert('roles', roleRows, 'school_id,role_key');
  const roleByKey = new Map(roles.map((r) => [r.role_key, r]));

  const permissionRows = [];
  for (const [roleKey, permissions] of Object.entries(rolePermissions)) {
    for (const permissionKey of permissions) {
      permissionRows.push({
        school_id: schoolId,
        role_id: roleByKey.get(roleKey)?.id || null,
        role_key: roleKey,
        permission_key: permissionKey,
        enabled: true,
      });
    }
  }

  await upsert('role_permissions', permissionRows, 'school_id,role_key,permission_key', 'id');

  const classRows = uniqueBy(studentsCsv.map((s) => ({
    school_id: schoolId,
    class_label: String(s.class),
    division: s.division,
    stream: clean(s.stream) || '',
    academic_year: s.academic_year || '2026-27',
    active: true,
  })), (r) => `${r.class_label}|${r.division}|${r.stream}|${r.academic_year}`);

  await upsert('classes', classRows, 'school_id,class_label,division,stream,academic_year', 'id');

  const vehicleRows = uniqueBy(stopsCsv.map((s) => ({
    school_id: schoolId,
    vehicle_no: s.bus_no,
    vehicle_name: s.bus_no,
    driver_name: s.driver,
    helper_name: s.female_attendant,
    status: 'active',
  })), (r) => r.vehicle_no);

  const vehicles = await upsert('vehicles', vehicleRows, 'school_id,vehicle_no');
  const vehicleByNo = new Map(vehicles.map((v) => [v.vehicle_no, v]));

  const routeRows = uniqueBy(stopsCsv.map((s) => ({
    school_id: schoolId,
    route_code: s.route_id,
    route_name: s.route_name,
    vehicle_id: vehicleByNo.get(s.bus_no)?.id || null,
    direction: 'both',
    status: 'active',
  })), (r) => r.route_code);

  const routes = await upsert('transport_routes', routeRows, 'school_id,route_code');
  const routeByCode = new Map(routes.map((r) => [r.route_code, r]));

  const stopRows = stopsCsv.map((s) => ({
    school_id: schoolId,
    route_id: routeByCode.get(s.route_id)?.id,
    stop_order: num(s.stop_order),
    stop_name: s.stop_name,
    latitude: num(s.latitude_mock, null),
    longitude: num(s.longitude_mock, null),
    radius_m: num(s.geofence_radius_m, 100),
    status: 'active',
  })).filter((s) => s.route_id);

  await upsert('transport_stops', stopRows, 'route_id,stop_order');

  const freshStops = await must(
    'fetch fresh transport_stops',
    supabase
      .from('transport_stops')
      .select('*')
      .eq('school_id', schoolId)
  );

  const stopKey = (routeId, stopName) =>
    `${routeId}|${String(stopName || '').trim().toLowerCase()}`;

  const stopByRouteStop = new Map(
    freshStops.map((s) => [stopKey(s.route_id, s.stop_name), s])
  );

  const studentRows = studentsCsv.map((s) => ({
    school_id: schoolId,
    admission_no: s.admission_no,
    student_name: s.student_name,
    gender: clean(s.gender),
    dob: clean(s.dob),
    class_label: String(s.class),
    division: s.division,
    stream: clean(s.stream) || '',
    roll_no: num(s.roll_no, null),
    academic_year: s.academic_year || '2026-27',
    status: studentStatus(s.status),
    parent_name: clean(s.parent_name),
    parent_phone: clean(s.parent_phone),
    parent_email: clean(s.parent_email),
    address: [clean(s.locality), clean(s.pincode)].filter(Boolean).join(', ') || null,
    blood_group: clean(s.blood_group),
    house_name: clean(s.house),
    data_confidence: num(s.data_confidence, 70),
  }));

  const students = await upsert('students', studentRows, 'school_id,admission_no');
  const studentByAdmission = new Map(students.map((s) => [s.admission_no, s]));

  const parentRows = uniqueBy(studentsCsv.map((s) => ({
    school_id: schoolId,
    parent_name: s.parent_name,
    phone: s.parent_phone,
    email: clean(s.parent_email),
    relation: clean(s.parent_relation) || 'Parent',
    address: [clean(s.locality), clean(s.pincode)].filter(Boolean).join(', ') || null,
    status: 'active',
  })), (r) => r.phone);

  const parents = await upsert('parents', parentRows, 'school_id,phone');
  const parentByPhone = new Map(parents.map((p) => [p.phone, p]));

  const linkRows = studentsCsv.map((s) => ({
    school_id: schoolId,
    student_id: studentByAdmission.get(s.admission_no)?.id,
    parent_id: parentByPhone.get(s.parent_phone)?.id,
    relation: clean(s.parent_relation) || 'Parent',
    is_primary: true,
  })).filter((r) => r.student_id && r.parent_id);

  await upsert('student_parent_links', linkRows, 'school_id,student_id,parent_id', 'id');

  const feeRows = studentsCsv.map((s) => {
    const totalDue = num(s.total_fee_annual);
    const pending = num(s.amount_due);
    const paid = Math.max(totalDue - pending, 0);

    return {
      school_id: schoolId,
      student_id: studentByAdmission.get(s.admission_no)?.id,
      academic_year: s.academic_year || '2026-27',
      tuition_fee: num(s.tuition_fee_annual),
      transport_fee: num(s.transport_fee_annual),
      store_balance: 0,
      total_due: totalDue,
      total_paid: paid,
      pending_amount: pending,
      payment_status: paymentStatus(s.fee_status),
      next_due_date: '2026-07-10',
    };
  }).filter((r) => r.student_id);

  await upsert('fee_summaries', feeRows, 'school_id,student_id,academic_year', 'id');

  await must(
    'clear old student transport assignments',
    supabase
      .from('student_transport_assignments')
      .delete()
      .eq('school_id', schoolId)
  );

  const transportRows = studentsCsv.map((s) => {
    const opted = boolYes(s.transport_opted);
    const route = routeByCode.get(s.route_id);
    const stop = route ? stopByRouteStop.get(stopKey(route.id, s.bus_stop)) : null;

    return {
      school_id: schoolId,
      student_id: studentByAdmission.get(s.admission_no)?.id,
      route_id: opted ? route?.id || null : null,
      stop_id: opted ? stop?.id || null : null,
      pickup_time: clean(s.pickup_time),
      drop_time: clean(s.drop_time),
      opted,
      active: true,
      updated_at: new Date().toISOString(),
    };
  }).filter((r) => r.student_id);

  await upsert('student_transport_assignments', transportRows, 'school_id,student_id', 'id');

  await must(
    'insert audit log',
    supabase.from('audit_logs').insert({
      school_id: schoolId,
      actor_role: 'system_import_script',
      action: 'batch1_seed_import_completed',
      entity_table: 'import_jobs',
      entity_id: importJob.id,
      new_data: {
        students: students.length,
        parents: parents.length,
        routes: routes.length,
        stops: freshStops.length,
        fees: feeRows.length,
        assignments: transportRows.length,
      },
    })
  );

  await must(
    'complete import job',
    supabase.from('import_jobs').update({
      status: 'completed',
      success_rows: studentsCsv.length,
      failed_rows: 0,
      completed_at: new Date().toISOString(),
      notes: JSON.stringify({
        students: students.length,
        parents: parents.length,
        routes: routes.length,
        stops: freshStops.length,
        fees: feeRows.length,
        assignments: transportRows.length,
      }),
    }).eq('id', importJob.id)
  );

  console.log('\nImport complete.');
  console.log(`Students: ${students.length}`);
  console.log(`Parents: ${parents.length}`);
  console.log(`Routes: ${routes.length}`);
  console.log(`Transport stops: ${freshStops.length}`);
  console.log(`Fee summaries: ${feeRows.length}`);
  console.log(`Transport assignments: ${transportRows.length}`);
}

main().catch((err) => {
  console.error('\nImport failed:');
  console.error(err);
  process.exit(1);
});