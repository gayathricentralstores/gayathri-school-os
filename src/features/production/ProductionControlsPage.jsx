import React, { useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Cloud,
  Database,
  Download,
  FileSpreadsheet,
  Gauge,
  HardDrive,
  LockKeyhole,
  RefreshCcw,
  School,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { formatMoney, safeArray, statusTone } from '../shared/erpUtils';

function downloadJson(filename, payload) {
  try {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.warn('Export failed', error);
  }
}

function csvEscape(value) {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function downloadCsv(filename, rows) {
  try {
    const safeRows = safeArray(rows);
    const columns = Array.from(new Set(safeRows.flatMap((row) => Object.keys(row || {}))));
    const csv = [
      columns.join(','),
      ...safeRows.map((row) => columns.map((column) => csvEscape(row?.[column])).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    console.warn('CSV export failed', error);
  }
}

function ControlCard({ icon: Icon, title, value, note, tone = 'secure' }) {
  return (
    <div className="panel production-control-card">
      <div className={`production-icon ${tone}`}>
        <Icon size={19} />
      </div>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

function ChecklistItem({ label, status = 'Ready', tone = 'secure' }) {
  return (
    <div className="production-check-row">
      <div>
        <CheckCircle2 size={17} />
        <span>{label}</span>
      </div>
      <span className={`status-pill ${tone}`}>{status}</span>
    </div>
  );
}

export default function ProductionControlsPage({
  students,
  fees,
  routes,
  stops,
  imports,
  counts,
  profile,
  lastSyncAt,
  isOnline,
}) {
  const [exportMessage, setExportMessage] = useState('');

  const safeStudents = safeArray(students);
  const safeFees = safeArray(fees);
  const safeRoutes = safeArray(routes);
  const safeStops = safeArray(stops);
  const safeImports = safeArray(imports);

  const productionSummary = useMemo(() => {
    const totalDue = safeFees.reduce((sum, row) => sum + Number(row?.pending_amount ?? row?.amount_due ?? 0), 0);
    const activeStudents = safeStudents.filter((student) => String(student?.status || '').toLowerCase() === 'active').length;
    const transportAssigned = safeStudents.filter((student) => student?.transport_opted === 'Yes').length;
    const lastImport = safeImports[0]?.completed_at || safeImports[0]?.started_at || null;

    return {
      activeStudents,
      totalDue,
      transportAssigned,
      lastImport,
    };
  }, [safeStudents, safeFees, safeImports]);

  const backupPayload = useMemo(() => ({
    exported_at: new Date().toISOString(),
    school: profile?.school_id || 'current-school',
    counts: {
      students: safeStudents.length,
      fees: safeFees.length,
      routes: safeRoutes.length,
      stops: safeStops.length,
      imports: safeImports.length,
      ...counts,
    },
    sample_only_notice: 'This browser export is for admin review. Production backups should be generated server-side on a schedule.',
    students_preview: safeStudents.slice(0, 20),
    fee_preview: safeFees.slice(0, 20),
    routes: safeRoutes,
    stops: safeStops,
  }), [profile?.school_id, safeStudents, safeFees, safeRoutes, safeStops, safeImports, counts]);

  function handleJsonExport() {
    downloadJson(`gayathri-school-os-control-export-${Date.now()}.json`, backupPayload);
    setExportMessage('Control export downloaded from cached dashboard data.');
  }

  function handleStudentCsvExport() {
    downloadCsv(`gayathri-students-export-${Date.now()}.csv`, safeStudents);
    setExportMessage('Student CSV export prepared from the currently loaded records.');
  }

  const healthItems = [
    { label: 'RLS-backed Super Admin session', status: profile?.role_key === 'super_admin' ? 'Ready' : 'Check', tone: profile?.role_key === 'super_admin' ? 'secure' : 'warm' },
    { label: 'Student database loaded', status: safeStudents.length ? `${safeStudents.length} rows` : 'Empty', tone: safeStudents.length ? 'secure' : 'warm' },
    { label: 'Fee summaries loaded', status: safeFees.length ? `${safeFees.length} rows` : 'Empty', tone: safeFees.length ? 'secure' : 'warm' },
    { label: 'Transport stop timeline loaded', status: safeStops.length ? `${safeStops.length} stops` : 'Empty', tone: safeStops.length ? 'secure' : 'warm' },
    { label: 'Network status', status: isOnline ? 'Online' : 'Offline cache', tone: isOnline ? 'secure' : 'warm' },
  ];

  return (
    <div className="grid production-controls">
      <section className="panel accent-panel production-hero">
        <div>
          <p className="eyebrow">Batch 12 · Production Controls</p>
          <h1>Operations, backups and launch readiness.</h1>
          <p>
            A Super Admin-only control room for export readiness, backup planning, health checks,
            multi-school rollout preparation and deployment safety.
          </p>
        </div>
        <div className="production-hero-badge">
          <ShieldCheck size={28} />
          <span>Current Role</span>
          <strong>{profile?.role_key || 'Not linked'}</strong>
        </div>
      </section>

      <div className="hero-grid">
        <ControlCard icon={School} title="Active Students" value={productionSummary.activeStudents || safeStudents.length} note="Loaded from the live student table." />
        <ControlCard icon={FileSpreadsheet} title="Pending Fee Ledger" value={formatMoney(productionSummary.totalDue)} note="Computed from fee_summaries." tone="warm" />
        <ControlCard icon={Database} title="Transport Stops" value={safeStops.length} note={`${safeRoutes.length} routes currently available.`} />
        <ControlCard icon={Cloud} title="Last Sync" value={lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'Not synced'} note={lastSyncAt ? new Date(lastSyncAt).toLocaleDateString() : 'Refresh DB to sync.'} />
      </div>

      <div className="grid two">
        <section className="panel">
          <div className="section-title">
            <p className="eyebrow">Export Center</p>
            <h2>Safe admin exports</h2>
          </div>
          <p className="soft-copy">
            These exports use the records already loaded through the authenticated dashboard. They are useful for
            validation and handover checks. Full automated backups should run server-side after deployment.
          </p>
          <div className="production-actions">
            <button className="primary-btn" onClick={handleStudentCsvExport}>
              <Download size={16} /> Export students CSV
            </button>
            <button className="ghost-btn" onClick={handleJsonExport}>
              <Archive size={16} /> Export control JSON
            </button>
          </div>
          {exportMessage && <p className="table-note">{exportMessage}</p>}
        </section>

        <section className="panel">
          <div className="section-title">
            <p className="eyebrow">Health Check</p>
            <h2>Production readiness</h2>
          </div>
          <div className="production-checklist">
            {healthItems.map((item) => (
              <ChecklistItem key={item.label} label={item.label} status={item.status} tone={item.tone} />
            ))}
          </div>
        </section>
      </div>

      <div className="grid two">
        <section className="panel">
          <div className="section-title">
            <p className="eyebrow">Backup Policy</p>
            <h2>Recommended launch schedule</h2>
          </div>
          <div className="backup-timeline">
            <div><HardDrive size={18} /><strong>Daily</strong><span>Database snapshot and import audit review.</span></div>
            <div><UploadCloud size={18} /><strong>Weekly</strong><span>Encrypted export of students, fees, transport and attendance.</span></div>
            <div><LockKeyhole size={18} /><strong>Monthly</strong><span>Restore test using staging database before full rollout.</span></div>
          </div>
        </section>

        <section className="panel">
          <div className="section-title">
            <p className="eyebrow">Multi-school Readiness</p>
            <h2>SaaS foundation checklist</h2>
          </div>
          <div className="production-checklist">
            <ChecklistItem label="school_id present in core tables" status="Required" tone="secure" />
            <ChecklistItem label="Dedicated project for premium schools" status="Recommended" tone="warm" />
            <ChecklistItem label="Shared tenant mode only after RLS tests" status="Guarded" tone="warm" />
            <ChecklistItem label="Per-school exports and audit logs" status="Required" tone="secure" />
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="section-title">
          <p className="eyebrow">Deployment Gate</p>
          <h2>Before real student data rollout</h2>
        </div>
        <div className="production-gate-grid">
          {[
            ['RLS role test', 'Parent/teacher/helper/accountant access must be verified.'],
            ['Payment test mode', 'No live gateway until webhook verification passes.'],
            ['Backup restore test', 'Restore a staging database from export before launch.'],
            ['Import rollback', 'Excel import should preview, validate and rollback safely.'],
            ['Staff training', 'Office, teachers and transport helpers need role-specific practice.'],
            ['Support channel', 'Define who handles parent login/payment issues.'],
          ].map(([title, note]) => (
            <div key={title} className="production-gate-card">
              <Gauge size={17} />
              <strong>{title}</strong>
              <span>{note}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
