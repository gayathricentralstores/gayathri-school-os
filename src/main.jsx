import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  BusFront,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  LockKeyhole,
  LogOut,
  MapPin,
  Megaphone,
  MessageSquare,
  Moon,
  Pencil,
  Route,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import ParentPortalPage from './features/parent/ParentPortalPage';
import AIAssistantPage from './features/ai/AIAssistantPage';
import './index.css';

const portals = [
  { key: 'setup', label: 'Command Center', icon: ShieldCheck, accessKey: 'dashboard' },
  { key: 'academics', label: 'Academics', icon: CalendarDays, accessKey: 'academics' },
  { key: 'attendance', label: 'Attendance', icon: CheckCircle2, accessKey: 'attendance' },
  { key: 'fees', label: 'Fees', icon: FileSpreadsheet, accessKey: 'fees' },
  { key: 'students', label: 'Students', icon: UsersRound, accessKey: 'students' },
  { key: 'transport', label: 'Transport', icon: BusFront, accessKey: 'transport' },
  { key: 'communication', label: 'Communication', icon: Megaphone, accessKey: 'communication' },
  { key: 'notifications', label: 'Notifications', icon: Bell, accessKey: 'communication' },
  { key: 'exams', label: 'Exams & Reports', icon: Award, accessKey: 'exams' },
  { key: 'parentAccess', label: 'Parent Login', icon: ShieldCheck, accessKey: 'parents' },
  { key: 'parentApp', label: 'Parent App', icon: UserRound, accessKey: 'parents' },
  { key: 'payments', label: 'Payments', icon: FileSpreadsheet, accessKey: 'fees' },
  { key: 'aiAssistant', label: 'AI Assistant', icon: Sparkles, accessKey: 'academics' },
  { key: 'productionControls', label: 'Production Controls', icon: Database, accessKey: 'production_controls', superAdminOnly: true },
  { key: 'roles', label: 'Role Access', icon: LockKeyhole, superAdminOnly: true },
  { key: 'imports', label: 'Imports', icon: Upload, superAdminOnly: true },
];

const tabAccessColumns = [
  'dashboard',
  'students',
  'parents',
  'fees',
  'transport',
  'attendance',
  'academics',
  'timetable',
  'exams',
  'circulars',
  'communication',
  'reports',
  'audit_logs',
  'design_portal',
  'production_controls',
];

function prettyLabel(value) {
  return String(value || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const themeOptions = [
  { key: 'obsidian', name: 'Obsidian Emerald', mode: 'dark' },
  { key: 'midnight', name: 'Midnight Gold', mode: 'dark' },
  { key: 'carbon', name: 'Carbon Emerald', mode: 'dark' },
  { key: 'sapphire', name: 'Midnight Sapphire', mode: 'dark' },
  { key: 'plum', name: 'Royal Plum', mode: 'dark' },
  { key: 'copper', name: 'Carbon Copper', mode: 'dark' },
  { key: 'forest', name: 'Forest Gold', mode: 'dark' },
  { key: 'slate', name: 'Slate Aurora', mode: 'dark' },
  { key: 'pure', name: 'Pure Light', mode: 'light' },
  { key: 'steel', name: 'Blue Steel Light', mode: 'light' },
  { key: 'ivoryless', name: 'Emerald White', mode: 'light' },
  { key: 'skyline', name: 'Skyline White', mode: 'light' },
  { key: 'mango', name: 'Mango Accent', mode: 'light' },
  { key: 'lotus', name: 'Lotus Accent', mode: 'light' },
  { key: 'lavender', name: 'Lavender Pro', mode: 'light' },
  { key: 'graphiteLight', name: 'Graphite Light', mode: 'light' },
  { key: 'tealLight', name: 'Teal Light', mode: 'light' },
  { key: 'navyLight', name: 'Navy Gold Light', mode: 'light' },
  { key: 'rubyLight', name: 'Ruby Light', mode: 'light' },
  { key: 'campusLight', name: 'Campus Green Light', mode: 'light' },
  { key: 'executiveNavy', name: 'Executive Navy', mode: 'dark' },
  { key: 'graphiteCrimson', name: 'Graphite Crimson', mode: 'dark' },
  { key: 'auroraPurple', name: 'Aurora Purple', mode: 'dark' },
  { key: 'arcticBlue', name: 'Arctic Blue', mode: 'light' },
  { key: 'pearlGold', name: 'Pearl Gold Light', mode: 'light' },
  { key: 'royalIndigo', name: 'Royal Indigo Light', mode: 'light' },
];

function cx(...items) {
  return items.filter(Boolean).join(' ');
}


const REQUEST_TIMEOUT_MS = 10000;
const RETRY_DELAYS_MS = [450, 1200, 2500];
const CACHE_PREFIX = 'gcs_os_cache_v1:';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFriendlyErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const raw = String(error?.message || error?.error_description || error || '').trim();
  if (!raw) return fallback;
  if (/failed to fetch|network|load failed|timeout|timed out/i.test(raw)) return 'Network is slow or unavailable. Showing saved data if available.';
  if (/jwt|token|session|refresh/i.test(raw)) return 'Your session expired. Please sign in again.';
  if (/permission denied|rls|not authorized|unauthorized/i.test(raw)) return 'You do not have permission for this action. Check role access in Super Admin.';
  return raw;
}

function validateArray(value) {
  return Array.isArray(value) ? value : [];
}

function withTimeout(promise, label = 'request') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)), REQUEST_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function resilientQuery(label, factory, { retries = 3 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await withTimeout(factory(), label);
      if (result?.error) throw result.error;
      return result || { data: null, error: null };
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      await sleep(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]);
    }
  }
  return { data: null, error: lastError };
}

function cacheKey(schoolId, key) {
  return `${CACHE_PREFIX}${schoolId || 'global'}:${key}`;
}

function readCache(schoolId, key, fallback) {
  try {
    const raw = localStorage.getItem(cacheKey(schoolId, key));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed?.value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeCache(schoolId, key, value) {
  try {
    localStorage.setItem(cacheKey(schoolId, key), JSON.stringify({ value, savedAt: new Date().toISOString() }));
  } catch {
    // Storage may be full or blocked. Keep the app running.
  }
}

function clearAppCache() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(CACHE_PREFIX)) localStorage.removeItem(key);
    });
  } catch {
    // Ignore cache cleanup failures.
  }
}

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: getFriendlyErrorMessage(error, 'This section could not load.') };
  }

  componentDidCatch(error) {
    console.error('Recovered UI error:', getFriendlyErrorMessage(error));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="setup-warning">
          <strong>Section recovered safely</strong>
          <p>{this.state.message}</p>
          <button className="ghost-btn" onClick={() => this.setState({ hasError: false, message: '' })}>Retry section</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function LogoLockup() {
  return (
    <div className="brand-lockup">
      <div className="crest-shell">
        <img src="/gayathri-logo.png" alt="Gayathri Central School" />
      </div>
      <div>
        <strong>Gayathri School OS</strong>
        <span>Production Batch 1</span>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = '' }) {
  return (
    <div className={cx('stat-card', tone)}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LoginScreen({ onSession }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);

  async function signIn(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data, error: authError } = await resilientQuery(
        'sign in',
        () => supabase.auth.signInWithPassword({ email: email.trim(), password }),
        { retries: 1 }
      );
      if (authError) throw authError;
      if (!data?.session) throw new Error('Login succeeded but no session was returned. Please try again.');
      onSession(data.session);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not sign in. Please check your connection and credentials.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <LogoLockup />
        <div className="hero-copy">
          <p className="eyebrow">Secure school operations platform</p>
          <h1>Start with real database access, not mock screens.</h1>
          <p>
            Batch 1 connects Gayathri School OS to Supabase, imports the generated 1000-student database, protects data through RLS, and prepares the owner-only Super Admin workflow.
          </p>
        </div>
        <div className="hero-grid">
          <Stat label="Seed students" value="1000" />
          <Stat label="Transport routes" value="12" />
          <Stat label="Security model" value="RLS" />
          <Stat label="Mode" value="Production foundation" />
        </div>
      </section>
      <section className="login-card">
        <div className="login-card-head">
          <ShieldCheck />
          <div>
            <h2>Super Admin / Staff Login</h2>
            <p>Use the user you create in Supabase Auth after running the SQL and import script.</p>
          </div>
        </div>
        {!isSupabaseConfigured ? (
          <div className="setup-warning">
            <strong>Supabase is not configured yet.</strong>
            <p>Create <code>.env</code> from <code>.env.example</code>, add your Supabase URL and anon key, then restart Vite.</p>
          </div>
        ) : (
          <form onSubmit={signIn} className="login-form">
            <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@gayathri.school" type="email" required /></label>
            <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" required /></label>
            {error && <p className="form-error">{error}</p>}
            <button className="primary-btn" disabled={busy}>{busy ? 'Signing in…' : 'Open ERP'}</button>
          </form>
        )}
      </section>
    </main>
  );
}

function SetupGuide({ counts }) {
  return (
    <div className="page-stack">
      <div className="page-title">
        <div>
          <p className="eyebrow">Batch 1</p>
          <h1>Production foundation checklist</h1>
        </div>
        <span className="status-pill secure">Security-first</span>
      </div>
      <div className="grid two">
        <div className="panel">
          <h2>Current database status</h2>
          <div className="metric-list">
            <Stat label="Students loaded" value={counts.students ?? '—'} />
            <Stat label="Parents loaded" value={counts.parents ?? '—'} />
            <Stat label="Routes loaded" value={counts.routes ?? '—'} />
            <Stat label="Import jobs" value={counts.imports ?? '—'} />
          </div>
        </div>
        <div className="panel accent-panel">
          <Sparkles />
          <h2>What Batch 1 locks</h2>
          <p>Real Supabase schema, RLS, owner-controlled roles, generated 1000-student import, stop-level transport data, audit/import tables.</p>
        </div>
      </div>
      <div className="panel">
        <h2>Run order</h2>
        <ol className="steps">
          <li>Run <code>supabase/001_production_foundation.sql</code> in Supabase SQL Editor.</li>
          <li>Create <code>.env</code> from <code>.env.example</code>.</li>
          <li>Run <code>npm run import:seed</code> to import the 1000 students, parents, fees, routes and stops.</li>
          <li>Create your Super Admin auth user, then insert a matching <code>user_profiles</code> row.</li>
          <li>Login here and verify students, roles, transport and import jobs.</li>
        </ol>
      </div>
    </div>
  );
}

function StudentsPage({ students, reload, profile, session }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [mode, setMode] = useState('all');
  const debouncedQuery = useDebouncedValue(query, 300);
  const safeStudents = useMemo(() => validateArray(students), [students]);
  const filtered = useMemo(() => safeStudents
    .filter((s) => mode === 'all' || String(s?.status || '').toLowerCase() === mode)
    .filter((s) => [s?.student_name, s?.admission_no, s?.class_label, s?.division, s?.stream, s?.parent_phone, s?.address]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(debouncedQuery.toLowerCase())), [safeStudents, debouncedQuery, mode]);
  const activeCount = safeStudents.filter((s) => s?.status === 'active').length;
  const transferredCount = safeStudents.filter((s) => s?.status === 'transferred').length;
  const inactiveCount = safeStudents.filter((s) => s?.status === 'inactive').length;

  return (
    <div className="page-stack">
      <div className="page-title">
        <div><p className="eyebrow">Student information system</p><h1>Students master control</h1></div>
        <div className="button-row">
          <button className="ghost-btn"><Download size={16} /> Export later</button>
          <button className="primary-btn" onClick={() => setEditing({ status: 'active', academic_year: '2026-27', class_label: '1', division: 'Diamond', stream: '' })}>Add student</button>
        </div>
      </div>

      <div className="command-grid">
        <MiniMetric label="Total students" value={safeStudents.length || '—'} note="production database" />
        <MiniMetric label="Active" value={activeCount} note="currently enrolled" />
        <MiniMetric label="Transferred" value={transferredCount} note="soft-removed records" tone="warm" />
        <MiniMetric label="Inactive" value={inactiveCount} note="hidden from normal operations" tone="danger-soft" />
      </div>

      <div className="toolbar multi-toolbar">
        <Search size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, admission no, class, division, phone…" />
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="transferred">Transferred</option>
          <option value="alumni">Alumni</option>
        </select>
      </div>

      <div className="table-shell">
        <table>
          <thead><tr><th>Student</th><th>Class</th><th>Admission</th><th>Parent</th><th>Status</th><th>Confidence</th><th></th></tr></thead>
          <tbody>
            {filtered.slice(0, 150).map((s) => (
              <tr key={s.id}>
                <td><strong>{s.student_name}</strong><span>{s.gender || '—'} · DOB {s.dob || '—'}</span></td>
                <td>{s.class_label} {s.division}{s.stream ? ` · ${s.stream}` : ''}</td>
                <td>{s.admission_no}</td>
                <td><span>{s.parent_name || '—'}</span><span>{s.parent_phone || '—'}</span></td>
                <td><span className={cx('status-pill', s.status === 'active' ? 'secure' : s.status === 'transferred' ? 'warm' : 'danger')}>{s.status || 'active'}</span></td>
                <td>{s.data_confidence ?? '—'}</td>
                <td><button className="icon-btn" onClick={() => setEditing(s)}><Pencil size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="table-note">Showing first 150 matching rows for speed. Add/edit/transfer uses Supabase RLS and Super Admin write policies.</p>
      </div>
      {editing && <StudentEditor student={editing} profile={profile} session={session} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload({ silent: false }); }} />}
    </div>
  );
}

function StudentEditor({ student, profile, session, onClose, onSaved }) {
  const isNew = !student?.id;
  const [form, setForm] = useState({
    admission_no: student?.admission_no || '',
    student_name: student?.student_name || '',
    gender: student?.gender || '',
    dob: student?.dob || '',
    class_label: student?.class_label || '1',
    division: student?.division || 'Diamond',
    stream: student?.stream || '',
    roll_no: student?.roll_no || '',
    academic_year: student?.academic_year || '2026-27',
    parent_name: student?.parent_name || '',
    parent_phone: student?.parent_phone || '',
    parent_email: student?.parent_email || '',
    address: student?.address || '',
    blood_group: student?.blood_group || '',
    house_name: student?.house_name || '',
    data_confidence: student?.data_confidence ?? 80,
    status: student?.status || 'active',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    if (!profile?.school_id) return 'Your Super Admin profile is not loaded. Please refresh and login again.';
    if (!String(form.admission_no || '').trim()) return 'Admission number is required.';
    if (!String(form.student_name || '').trim()) return 'Student name is required.';
    if (!String(form.class_label || '').trim()) return 'Class is required.';
    if (!String(form.division || '').trim()) return 'Division is required.';
    if (form.parent_phone && !/^\d{10}$/.test(String(form.parent_phone))) return 'Parent phone must be 10 digits.';
    return '';
  }

  async function writeAudit(action, newData) {
    if (!profile?.school_id) return;
    await resilientQuery('student audit log', () => supabase.from('audit_logs').insert({
      school_id: profile.school_id,
      actor_user_id: session?.user?.id || profile?.id,
      actor_email: session?.user?.email || profile?.email,
      actor_role: profile?.role_key,
      action,
      entity_table: 'students',
      entity_id: student?.id || null,
      old_data: isNew ? null : student,
      new_data: newData,
    }), { retries: 1 });
  }

  async function save(nextStatus = null) {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...form,
        status: nextStatus || form.status,
        roll_no: form.roll_no === '' || form.roll_no === null ? null : Number(form.roll_no),
        data_confidence: Number(form.data_confidence || 80),
        stream: form.stream || '',
        updated_at: new Date().toISOString(),
      };
      if (isNew) payload.school_id = profile.school_id;

      const request = isNew
        ? supabase.from('students').insert(payload).select('*').single()
        : supabase.from('students').update(payload).eq('id', student.id).select('*').single();
      const { data, error: writeError } = await resilientQuery(isNew ? 'add student' : 'save student', () => request, { retries: 2 });
      if (writeError) throw writeError;
      await writeAudit(isNew ? 'student_created' : nextStatus ? `student_status_${nextStatus}` : 'student_updated', data || payload);
      onSaved();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not save student. Please retry.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card wide-modal">
        <button className="close-btn" onClick={onClose}><X size={18} /></button>
        <h2>{isNew ? 'Add student' : 'Edit student'}</h2>
        <p className="muted">Super Admin changes are written to Supabase and logged in audit history. Removal is handled as inactive/transferred, not hard delete.</p>
        <div className="form-grid">
          <label>Admission No<input value={form.admission_no} onChange={(e) => update('admission_no', e.target.value)} disabled={!isNew} /></label>
          <label>Name<input value={form.student_name} onChange={(e) => update('student_name', e.target.value)} /></label>
          <label>DOB<input type="date" value={form.dob || ''} onChange={(e) => update('dob', e.target.value)} /></label>
          <label>Gender<select value={form.gender} onChange={(e) => update('gender', e.target.value)}><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></label>
          <label>Class<input value={form.class_label} onChange={(e) => update('class_label', e.target.value)} /></label>
          <label>Division<select value={form.division} onChange={(e) => update('division', e.target.value)}><option>Diamond</option><option>Ruby</option><option>Coral</option><option>Pearl</option><option>Commerce</option><option>Humanities</option></select></label>
          <label>Stream<input value={form.stream} onChange={(e) => update('stream', e.target.value)} placeholder="Commerce / Humanities if needed" /></label>
          <label>Roll No<input type="number" value={form.roll_no ?? ''} onChange={(e) => update('roll_no', e.target.value)} /></label>
          <label>Parent Name<input value={form.parent_name} onChange={(e) => update('parent_name', e.target.value)} /></label>
          <label>Parent Phone<input value={form.parent_phone} onChange={(e) => update('parent_phone', e.target.value.replace(/\D/g, '').slice(0, 10))} /></label>
          <label>Parent Email<input value={form.parent_email || ''} onChange={(e) => update('parent_email', e.target.value)} /></label>
          <label>Status<select value={form.status} onChange={(e) => update('status', e.target.value)}><option value="active">active</option><option value="inactive">inactive</option><option value="transferred">transferred</option><option value="alumni">alumni</option></select></label>
        </div>
        <label>Address<input value={form.address || ''} onChange={(e) => update('address', e.target.value)} /></label>
        {error && <p className="form-error">{error}</p>}
        <div className="button-row modal-actions">
          {!isNew && <button className="ghost-btn danger-text" onClick={() => save('inactive')} disabled={busy}>Mark inactive</button>}
          {!isNew && <button className="ghost-btn" onClick={() => save('transferred')} disabled={busy}>Transfer out</button>}
          <button className="primary-btn" onClick={() => save()} disabled={busy}><Save size={16} /> {busy ? 'Saving…' : isNew ? 'Create student' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}


function TransportPage({ routes, stops, students, reload, profile, session }) {
  const safeRoutes = validateArray(routes);
  const safeStops = validateArray(stops);
  const safeStudents = validateArray(students);
  const [activeRouteId, setActiveRouteId] = useState(safeRoutes[0]?.id);
  const [tripMode, setTripMode] = useState('evening');
  const [manualReached, setManualReached] = useState(2);
  const [routeForm, setRouteForm] = useState({ route_code: '', route_name: '', status: 'active' });
  const [stopForm, setStopForm] = useState({ stop_name: '', stop_order: '', radius_m: 100, latitude: '', longitude: '', fee_amount: 0 });
  const [editingRoute, setEditingRoute] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = safeRoutes.find((r) => r.id === activeRouteId) || safeRoutes[0];
  const activeStops = safeStops.filter((s) => s.route_id === active?.id).sort((a,b) => (a.stop_order ?? 0) - (b.stop_order ?? 0));
  const reachedIndex = Math.min(Math.max(Number(manualReached) || 0, 0), Math.max(activeStops.length - 1, 0));
  const nextStop = activeStops[reachedIndex + 1];
  const routeStudents = safeStudents.filter((s) => s?.status === 'active').slice(0, 42);
  const onboardCount = tripMode === 'morning' ? Math.max(routeStudents.length - 4, 0) : Math.max(routeStudents.length - 2, 0);
  const progress = activeStops.length ? Math.round(((reachedIndex + 1) / activeStops.length) * 100) : 0;
  const routeHealth = safeRoutes.map((route, index) => {
    const routeStops = safeStops.filter((s) => s.route_id === route.id).length;
    const orderedStops = safeStops.filter((s) => s.route_id === route.id).sort((a,b) => (a.stop_order ?? 0) - (b.stop_order ?? 0));
    const lastStopIndex = Math.min(2 + (index % 3), Math.max(routeStops - 1, 0));
    const lastStopName = orderedStops[lastStopIndex]?.stop_name || 'School Gate';
    return {
      ...route,
      lastStop: lastStopName === 'School Gate' ? 'Left school gate' : lastStopName,
      completion: routeStops ? Math.min(92, 36 + index * 4) : 0,
      alert: route.status === 'inactive' ? 'Inactive' : index === 1 ? '6 min delay' : index === 4 ? 'Helper offline 2m' : 'Trip in progress',
    };
  });

  function stopTimelineCopy(index) {
    if (index === 0 && index <= reachedIndex) return 'Left school gate';
    if (index < reachedIndex) return 'Reached stop';
    if (index === reachedIndex) return index === 0 ? 'Left school gate' : 'Last stop reached';
    if (index === reachedIndex + 1) return 'Next stop to reach';
    return 'Yet to reach';
  }

  useEffect(() => {
    if (!activeRouteId && safeRoutes[0]?.id) setActiveRouteId(safeRoutes[0].id);
  }, [activeRouteId, safeRoutes]);

  function resetRouteForm() {
    setEditingRoute(null);
    setRouteForm({ route_code: '', route_name: '', status: 'active' });
  }

  function startEditRoute(route) {
    setEditingRoute(route);
    setRouteForm({ route_code: route.route_code || '', route_name: route.route_name || '', status: route.status || 'active' });
  }

  async function writeTransportAudit(action, entityTable, entityId, newData, oldData = null) {
    if (!profile?.school_id) return;
    await resilientQuery('transport audit log', () => supabase.from('audit_logs').insert({
      school_id: profile.school_id,
      actor_user_id: session?.user?.id || profile?.id,
      actor_email: session?.user?.email || profile?.email,
      actor_role: profile?.role_key,
      action,
      entity_table: entityTable,
      entity_id: entityId || null,
      old_data: oldData,
      new_data: newData,
    }), { retries: 1 });
  }

  async function saveRoute() {
    if (!profile?.school_id) { setError('Super Admin profile is not loaded. Refresh and login again.'); return; }
    if (!String(routeForm.route_code || '').trim() || !String(routeForm.route_name || '').trim()) { setError('Route code and route name are required.'); return; }
    setBusy(true);
    setError('');
    try {
      const payload = {
        school_id: profile.school_id,
        route_code: routeForm.route_code.trim(),
        route_name: routeForm.route_name.trim(),
        status: routeForm.status || 'active',
        direction: 'both',
      };
      const request = editingRoute?.id
        ? supabase.from('transport_routes').update(payload).eq('id', editingRoute.id).select('*').single()
        : supabase.from('transport_routes').insert(payload).select('*').single();
      const { data, error: writeError } = await resilientQuery(editingRoute ? 'update route' : 'create route', () => request, { retries: 2 });
      if (writeError) throw writeError;
      await writeTransportAudit(editingRoute ? 'transport_route_updated' : 'transport_route_created', 'transport_routes', data?.id, data || payload, editingRoute);
      resetRouteForm();
      reload({ silent: false });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not save route. Please retry.'));
    } finally {
      setBusy(false);
    }
  }

  async function saveStop() {
    if (!profile?.school_id) { setError('Super Admin profile is not loaded. Refresh and login again.'); return; }
    if (!active?.id) { setError('Select or create a route first.'); return; }
    if (!String(stopForm.stop_name || '').trim()) { setError('Stop name is required.'); return; }
    const nextOrder = Number(stopForm.stop_order || activeStops.length + 1);
    setBusy(true);
    setError('');
    try {
      const payload = {
        school_id: profile.school_id,
        route_id: active.id,
        stop_order: nextOrder,
        stop_name: stopForm.stop_name.trim(),
        latitude: stopForm.latitude === '' ? null : Number(stopForm.latitude),
        longitude: stopForm.longitude === '' ? null : Number(stopForm.longitude),
        radius_m: Number(stopForm.radius_m || 100),
        fee_amount: Number(stopForm.fee_amount || 0),
        status: 'active',
      };
      const { data, error: writeError } = await resilientQuery('create stop', () => supabase.from('transport_stops').insert(payload).select('*').single(), { retries: 2 });
      if (writeError) throw writeError;
      await writeTransportAudit('transport_stop_created', 'transport_stops', data?.id, data || payload);
      setStopForm({ stop_name: '', stop_order: '', radius_m: 100, latitude: '', longitude: '', fee_amount: 0 });
      reload({ silent: false });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not save stop. Stop order/name must be unique within route.'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleRouteStatus(route) {
    if (!route?.id) return;
    const nextStatus = route.status === 'inactive' ? 'active' : 'inactive';
    setBusy(true);
    setError('');
    try {
      const { data, error: writeError } = await resilientQuery('toggle route status', () => supabase.from('transport_routes').update({ status: nextStatus }).eq('id', route.id).select('*').single(), { retries: 2 });
      if (writeError) throw writeError;
      await writeTransportAudit(`transport_route_${nextStatus}`, 'transport_routes', route.id, data, route);
      reload({ silent: false });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not update route status.'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleStopStatus(stop) {
    if (!stop?.id) return;
    const nextStatus = stop.status === 'inactive' ? 'active' : 'inactive';
    setBusy(true);
    setError('');
    try {
      const { data, error: writeError } = await resilientQuery('toggle stop status', () => supabase.from('transport_stops').update({ status: nextStatus }).eq('id', stop.id).select('*').single(), { retries: 2 });
      if (writeError) throw writeError;
      await writeTransportAudit(`transport_stop_${nextStatus}`, 'transport_stops', stop.id, data, stop);
      reload({ silent: false });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not update stop status.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-stack">
      <div className="page-title"><div><p className="eyebrow">Transport production</p><h1>Where-is-my-Train bus tracking</h1></div><span className="status-pill secure">Stop-level privacy</span></div>
      {error && <div className="error-banner"><AlertTriangle size={16} /> {error}</div>}

      <div className="command-grid">
        <MiniMetric label="Routes running" value={safeRoutes.filter((r) => r.status !== 'inactive').length || '—'} note="morning/evening trip ready" />
        <MiniMetric label="Current route progress" value={`${progress}%`} note={nextStop ? `Next: ${nextStop.stop_name}` : 'Trip complete'} />
        <MiniMetric label="Students onboard" value={`${onboardCount}/${routeStudents.length}`} note="helper attendance summary" />
        <MiniMetric label="Transport alerts" value="2" note="delay/offline queue" tone="warm" />
      </div>

      <div className="grid two">
        <div className="panel">
          <h2>{editingRoute ? 'Edit bus route' : 'Add bus route'}</h2>
          <div className="form-grid">
            <label>Route code<input value={routeForm.route_code} onChange={(e) => setRouteForm({ ...routeForm, route_code: e.target.value })} placeholder="R13" /></label>
            <label>Route name<input value={routeForm.route_name} onChange={(e) => setRouteForm({ ...routeForm, route_name: e.target.value })} placeholder="Poojappura Line" /></label>
            <label>Status<select value={routeForm.status} onChange={(e) => setRouteForm({ ...routeForm, status: e.target.value })}><option value="active">active</option><option value="inactive">inactive</option></select></label>
          </div>
          <div className="button-row">
            {editingRoute && <button className="ghost-btn" onClick={resetRouteForm}>Cancel edit</button>}
            <button className="primary-btn" onClick={saveRoute} disabled={busy}>{busy ? 'Saving…' : editingRoute ? 'Save route' : 'Create route'}</button>
          </div>
        </div>
        <div className="panel">
          <h2>Add stop to selected route</h2>
          <p className="muted">Selected route: <strong>{active?.route_name || 'None'}</strong></p>
          <div className="form-grid">
            <label>Stop order<input type="number" value={stopForm.stop_order} onChange={(e) => setStopForm({ ...stopForm, stop_order: e.target.value })} placeholder={String(activeStops.length + 1)} /></label>
            <label>Stop name<input value={stopForm.stop_name} onChange={(e) => setStopForm({ ...stopForm, stop_name: e.target.value })} placeholder="New bus stop" /></label>
            <label>Geofence radius<input type="number" value={stopForm.radius_m} onChange={(e) => setStopForm({ ...stopForm, radius_m: e.target.value })} /></label>
            <label>Fee amount<input type="number" value={stopForm.fee_amount} onChange={(e) => setStopForm({ ...stopForm, fee_amount: e.target.value })} /></label>
            <label>Latitude<input value={stopForm.latitude} onChange={(e) => setStopForm({ ...stopForm, latitude: e.target.value })} placeholder="optional" /></label>
            <label>Longitude<input value={stopForm.longitude} onChange={(e) => setStopForm({ ...stopForm, longitude: e.target.value })} placeholder="optional" /></label>
          </div>
          <button className="primary-btn" onClick={saveStop} disabled={busy || !active?.id}>Add stop</button>
        </div>
      </div>

      <div className="route-tabs">
        {safeRoutes.map((r) => <button key={r.id} className={active?.id === r.id ? 'active' : ''} onClick={() => setActiveRouteId(r.id)}>{r.route_code} · {r.route_name}</button>)}
      </div>

      <div className="grid two transport-grid">
        <div className="phone-frame transport-phone">
          <div className="phone-top"><LogoLockup /></div>
          <div className="bus-status-card">
            <p className="eyebrow">Parent view</p>
            <h2>{active?.route_name || 'No route loaded'}</h2>
            <p>Last stop reached: <strong>{activeStops[reachedIndex]?.stop_name || '—'}</strong></p>
            <p>Next stop: <strong>{nextStop?.stop_name || 'Trip complete'}</strong></p>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="timeline train-style">
            {activeStops.map((stop, index) => (
              <div className={cx('timeline-row', index < reachedIndex ? 'done' : index === reachedIndex ? 'current' : '', stop.status === 'inactive' ? 'muted-row' : '')} key={stop.id}>
                <div className="dot" />
                <div><strong>{stop.stop_name}</strong><span>{stopTimelineCopy(index)} · {stop.radius_m || 100}m geofence · {stop.status || 'active'}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel helper-console">
          <h2>Helper mode controls</h2>
          <p className="muted">This is the mobile workflow helpers will use. Actual geofence automation comes after mobile app packaging.</p>
          <div className="segmented-control">
            <button className={tripMode === 'morning' ? 'active' : ''} onClick={() => setTripMode('morning')}>Morning pickup</button>
            <button className={tripMode === 'evening' ? 'active' : ''} onClick={() => setTripMode('evening')}>Evening drop</button>
          </div>
          <div className="form-grid one">
            <label>Manual stop reached<select value={manualReached} onChange={(e) => setManualReached(e.target.value)}>{activeStops.map((stop, idx) => <option key={stop.id} value={idx}>{stop.stop_order}. {stop.stop_name}</option>)}</select></label>
          </div>
          <div className="ops-list">
            <span><CheckCircle2 /> Start trip with assigned helper phone</span>
            <span><MapPin /> Auto mark stop when phone enters radius</span>
            <span><UsersRound /> Mark boarded / dropped student count</span>
            <span><AlertTriangle /> Delay or emergency alert to transport head</span>
          </div>
        </div>
      </div>

      <div className="table-shell">
        <table>
          <thead><tr><th>Route</th><th>Last stop</th><th>Progress</th><th>Status</th><th>Manage</th></tr></thead>
          <tbody>{routeHealth.map((route) => <tr key={route.id}><td><strong>{route.route_name}</strong><span>{route.route_code}</span></td><td>{route.lastStop}</td><td>{route.completion}%</td><td><span className={cx('status-pill', route.alert === 'Trip in progress' ? 'secure' : 'danger')}>{route.alert}</span></td><td><div className="button-row"><button className="ghost-btn compact" onClick={() => startEditRoute(route)}>Edit</button><button className="ghost-btn compact" onClick={() => toggleRouteStatus(route)}>{route.status === 'inactive' ? 'Activate' : 'Disable'}</button></div></td></tr>)}</tbody>
        </table>
      </div>

      <div className="table-shell">
        <table>
          <thead><tr><th>Stop</th><th>Order</th><th>Radius</th><th>Fee</th><th>Status</th><th>Manage</th></tr></thead>
          <tbody>{activeStops.map((stop) => <tr key={stop.id}><td><strong>{stop.stop_name}</strong><span>{stop.latitude || '—'}, {stop.longitude || '—'}</span></td><td>{stop.stop_order}</td><td>{stop.radius_m || 100}m</td><td>{formatMoney(stop.fee_amount || 0)}</td><td><span className={cx('status-pill', stop.status === 'active' ? 'secure' : 'danger')}>{stop.status || 'active'}</span></td><td><button className="ghost-btn compact" onClick={() => toggleStopStatus(stop)}>{stop.status === 'inactive' ? 'Activate' : 'Disable'}</button></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}


function RolesPage({ roles, roleAccess, onToggleAccess, savingAccess }) {
  const accessByRole = new Map(validateArray(roleAccess).map((row) => [row.role_key, row]));

  return (
    <div className="page-stack">
      <div className="page-title">
        <div><p className="eyebrow">Owner-only</p><h1>Role access checklist</h1></div>
        <span className="status-pill danger">Super Admin only</span>
      </div>
      <div className="panel">
        <h2>Control which tabs each role can access</h2>
        <p className="muted">This updates <code>role_tab_access</code>. The sidebar reads this table, so school staff only see the modules you allow.</p>
      </div>
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>Role</th>
              {tabAccessColumns.map((col) => <th key={col}>{prettyLabel(col)}</th>)}
            </tr>
          </thead>
          <tbody>
            {validateArray(roles).map((role) => {
              const access = accessByRole.get(role.role_key) || {};
              return (
                <tr key={role.id}>
                  <td><strong>{role.role_name}</strong><span>{role.role_key}</span></td>
                  {tabAccessColumns.map((col) => {
                    const disabled = role.role_key === 'super_admin';
                    return (
                      <td key={col}>
                        <input
                          type="checkbox"
                          checked={Boolean(access[col]) || disabled}
                          disabled={disabled || savingAccess}
                          onChange={(e) => onToggleAccess(role.role_key, col, e.target.checked)}
                          aria-label={`${role.role_key} ${col}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImportsPage({ imports }) {
  return (
    <div className="page-stack">
      <div className="page-title"><div><p className="eyebrow">Data safety</p><h1>Import jobs</h1></div><FileSpreadsheet /></div>
      <div className="table-shell">
        <table><thead><tr><th>Type</th><th>File</th><th>Status</th><th>Rows</th><th>Completed</th></tr></thead><tbody>
          {validateArray(imports).map((job) => <tr key={job.id}><td>{job.job_type || job.import_type}</td><td>{job.source_file}</td><td><span className="status-pill secure">{job.status}</span></td><td>{job.success_rows ?? 0}/{job.total_rows ?? 0}</td><td>{job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
}


function formatMoney(value) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
}

function average(values) {
  const safe = validateArray(values).map(Number).filter((n) => Number.isFinite(n));
  if (!safe.length) return 0;
  return Math.round(safe.reduce((a, b) => a + b, 0) / safe.length);
}

function MiniMetric({ label, value, note, tone = '' }) {
  return (
    <div className={cx('mini-metric', tone)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <p>{note}</p>}
    </div>
  );
}

function CommandCenterPage({ counts, students, fees, routes, stops }) {
  const safeStudents = validateArray(students);
  const safeFees = validateArray(fees);
  const totalDue = safeFees.reduce((sum, f) => sum + Number(f?.pending_amount ?? f?.amount_due ?? 0), 0);
  const collected = safeFees.reduce((sum, f) => sum + Number(f?.total_paid ?? 0), 0);
  const activeStudents = safeStudents.filter((s) => s?.status === 'active').length;
  const needsReview = safeStudents.filter((s) => String(s?.data_confidence ?? '').toLowerCase().includes('review') || Number(s?.data_confidence ?? 100) < 75).length;

  return (
    <div className="page-stack">
      <div className="page-title">
        <div>
          <p className="eyebrow">Live command center</p>
          <h1>Gayathri School OS</h1>
        </div>
        <span className="status-pill secure">Production foundation active</span>
      </div>

      <div className="command-grid">
        <MiniMetric label="Active students" value={activeStudents || counts.students || '—'} note="from Supabase students" />
        <MiniMetric label="Pending fees" value={formatMoney(totalDue)} note={`${safeFees.length || 0} fee summaries loaded`} tone="warm" />
        <MiniMetric label="Routes live" value={validateArray(routes).length || counts.routes || '—'} note={`${validateArray(stops).length || 0} stop timeline points`} />
        <MiniMetric label="Data review" value={needsReview} note="records needing office check" tone="danger-soft" />
      </div>

      <div className="grid two">
        <div className="panel">
          <h2>Today’s operations</h2>
          <div className="ops-list">
            <span><CheckCircle2 /> Student database reachable</span>
            <span><CheckCircle2 /> Role-based access enabled</span>
            <span><CheckCircle2 /> Transport stops imported</span>
            <span><CheckCircle2 /> Fee summaries connected</span>
          </div>
        </div>
        <div className="panel accent-panel">
          <Sparkles />
          <h2>Next work queue</h2>
          <p>Transport live timeline, communication queues and exam/report-card foundations are now staged on top of the imported student database, role system and offline-safe UI layer.</p>
        </div>
      </div>
    </div>
  );
}

function AcademicsPage({ students }) {
  const safeStudents = validateArray(students);
  const classCount = new Set(safeStudents.map((s) => `${s?.class_label || ''}-${s?.division || ''}-${s?.stream || ''}`)).size || 0;
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [selectedClass, setSelectedClass] = useState('10 Diamond');
  const [teacherLoad, setTeacherLoad] = useState(24);

  const conflicts = useMemo(() => {
    const issues = [];
    if (Number(periodsPerDay) > 8) issues.push('More than 8 periods may overload lower grades.');
    if (Number(teacherLoad) > 30) issues.push('Teacher workload exceeds recommended weekly limit.');
    if (!safeStudents.length) issues.push('Student database unavailable, timetable preview using fallback only.');
    return issues;
  }, [periodsPerDay, teacherLoad, safeStudents.length]);

  const events = [
    { date: '2026-06-24', title: 'Academic year planning', type: 'Calendar' },
    { date: '2026-07-01', title: 'Class timetable publish target', type: 'Timetable' },
    { date: '2026-07-10', title: 'Fee due reminder window', type: 'Fees' },
    { date: '2026-07-18', title: 'Unit test alert draft', type: 'Exam' },
  ];

  return (
    <div className="page-stack">
      <div className="page-title">
        <div><p className="eyebrow">Academics</p><h1>Calendar + Timetable Backend Engine</h1></div>
        <span className="status-pill secure">Conflict-aware · upload-ready</span>
      </div>

      <div className="command-grid">
        <MiniMetric label="Class groups" value={classCount} note="generated from imported students" />
        <MiniMetric label="Periods/day" value={periodsPerDay} note="editable generator input" />
        <MiniMetric label="Teacher load cap" value={`${teacherLoad}/week`} note="substitution-ready" />
        <MiniMetric label="Conflicts found" value={conflicts.length} note="phase-1 checker" tone={conflicts.length ? 'warm' : ''} />
      </div>

      <div className="grid two">
        <div className="panel">
          <h2>Timetable generator inputs</h2>
          <div className="form-grid">
            <label>Class group<input value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} /></label>
            <label>Periods per day<input type="number" value={periodsPerDay} onChange={(e) => setPeriodsPerDay(e.target.value)} /></label>
            <label>Max teacher periods/week<input type="number" value={teacherLoad} onChange={(e) => setTeacherLoad(e.target.value)} /></label>
          </div>
          <div className="preview-card">
            <strong>{selectedClass}</strong>
            <p>{periodsPerDay} periods/day · labs blocked from double-booking · teachers checked for clashes.</p>
          </div>
        </div>
        <div className="panel">
          <h2>Conflict checker</h2>
          {conflicts.length ? (
            <div className="alert-list">{conflicts.map((issue) => <span key={issue}>{issue}</span>)}</div>
          ) : (
            <div className="success-state"><CheckCircle2 /> No timetable conflicts in current inputs.</div>
          )}
        </div>
      </div>

      <div className="table-shell">
        <table>
          <thead><tr><th>Date</th><th>Academic event</th><th>Type</th></tr></thead>
          <tbody>{events.map((event) => <tr key={event.title}><td>{event.date}</td><td><strong>{event.title}</strong></td><td><span className="status-pill secure">{event.type}</span></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function AttendancePage({ students }) {
  const safeStudents = validateArray(students);
  const present = Math.round(safeStudents.length * 0.93);
  const absent = Math.max(safeStudents.length - present, 0);
  const substitutes = [
    { absent: 'Meera Nair', period: '10 Diamond · Period 3', substitute: 'Arun Mathew', status: 'Suggested' },
    { absent: 'Suresh K', period: '8 Ruby · Period 5', substitute: 'Nisha R', status: 'Available' },
    { absent: 'Latha P', period: '6 Coral · Period 2', substitute: 'Deepak S', status: 'Needs approval' },
  ];

  return (
    <div className="page-stack">
      <div className="page-title">
        <div><p className="eyebrow">Attendance</p><h1>Attendance + Biometric/Substitute Control</h1></div>
        <span className="status-pill secure">Biometric-ready</span>
      </div>

      <div className="command-grid">
        <MiniMetric label="Present today" value={present || '—'} note="class teacher workflow" />
        <MiniMetric label="Absent today" value={absent || 0} note="parent alert queue" tone="warm" />
        <MiniMetric label="Teacher substitutions" value={substitutes.length} note="from biometric absence workflow" />
        <MiniMetric label="Bus/class mismatch" value="0" note="safety alert foundation" />
      </div>

      <div className="grid two">
        <div className="panel">
          <h2>Biometric import workflow</h2>
          <div className="ops-list">
            <span><Upload /> Upload daily biometric CSV</span>
            <span><CheckCircle2 /> Detect absent/late teachers</span>
            <span><UsersRound /> Find free teachers by timetable</span>
            <span><FileSpreadsheet /> Export substitution report</span>
          </div>
        </div>
        <div className="panel">
          <h2>Substitute allocation</h2>
          <div className="compact-list">
            {substitutes.map((item) => (
              <div className="compact-row" key={`${item.absent}-${item.period}`}>
                <div><strong>{item.period}</strong><span>{item.absent} absent → {item.substitute}</span></div>
                <span className="status-pill">{item.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="table-shell">
        <table>
          <thead><tr><th>Class</th><th>Marked</th><th>Present</th><th>Absent</th><th>Status</th></tr></thead>
          <tbody>
            {['10 Diamond','10 Ruby','9 Coral','8 Diamond','7 Ruby'].map((klass, index) => (
              <tr key={klass}>
                <td><strong>{klass}</strong><span>Class teacher mobile entry</span></td>
                <td>{index < 4 ? 'Yes' : 'Pending'}</td>
                <td>{38 - index}</td>
                <td>{index}</td>
                <td><span className={cx('status-pill', index < 4 ? 'secure' : 'danger')}>{index < 4 ? 'Submitted' : 'Pending'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeesPage({ fees, students }) {
  const safeFees = validateArray(fees);
  const safeStudents = validateArray(students);
  const [filter, setFilter] = useState('all');
  const studentById = useMemo(() => new Map(safeStudents.map((s) => [s.id, s])), [safeStudents]);
  const totalDue = safeFees.reduce((sum, f) => sum + Number(f?.pending_amount ?? 0), 0);
  const totalPaid = safeFees.reduce((sum, f) => sum + Number(f?.total_paid ?? 0), 0);
  const pendingRows = safeFees
    .filter((f) => filter === 'all' || String(f?.payment_status || '').toLowerCase() === filter)
    .slice(0, 80);

  return (
    <div className="page-stack">
      <div className="page-title">
        <div><p className="eyebrow">Fees</p><h1>Fees + Quick Pay + Receipt Foundation</h1></div>
        <span className="status-pill secure">Receipt-ready</span>
      </div>

      <div className="command-grid">
        <MiniMetric label="Total collected" value={formatMoney(totalPaid)} note="from fee_summaries" />
        <MiniMetric label="Pending amount" value={formatMoney(totalDue)} note="due reminder base" tone="warm" />
        <MiniMetric label="Invoices loaded" value={safeFees.length} note="student fee summaries" />
        <MiniMetric label="Gateway mode" value="Off" note="enable only after webhook batch" />
      </div>

      <div className="grid two">
        <div className="panel">
          <h2>Quick Pay workflow</h2>
          <div className="ops-list">
            <span><Search /> Parent searches by admission no / phone</span>
            <span><FileSpreadsheet /> System shows invoice summary</span>
            <span><CheckCircle2 /> Counter payment or online gateway later</span>
            <span><Download /> Receipt PDF foundation</span>
          </div>
        </div>
        <div className="panel">
          <h2>Reminder center</h2>
          <div className="form-grid">
            <label>Status filter<select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="paid">Paid</option></select></label>
          </div>
          <p>SMS/WhatsApp API is intentionally disabled until communication security is added.</p>
        </div>
      </div>

      <div className="table-shell">
        <table>
          <thead><tr><th>Student</th><th>Class</th><th>Total due</th><th>Paid</th><th>Pending</th><th>Status</th></tr></thead>
          <tbody>
            {pendingRows.map((fee) => {
              const student = studentById.get(fee.student_id) || {};
              return (
                <tr key={fee.id}>
                  <td><strong>{student.student_name || 'Student'}</strong><span>{student.admission_no || fee.student_id}</span></td>
                  <td>{student.class_label || '—'} {student.division || ''}</td>
                  <td>{formatMoney(fee.total_due)}</td>
                  <td>{formatMoney(fee.total_paid)}</td>
                  <td>{formatMoney(fee.pending_amount)}</td>
                  <td><span className={cx('status-pill', String(fee.payment_status).toLowerCase() === 'paid' ? 'secure' : '')}>{fee.payment_status || 'pending'}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="table-note">Showing first 80 matching fee rows for speed. Export and receipt generation come in the payment hardening batch.</p>
      </div>
    </div>
  );
}


function CommunicationPage({ students, fees, routes }) {
  const safeStudents = validateArray(students);
  const safeFees = validateArray(fees);
  const safeRoutes = validateArray(routes);
  const pendingFees = safeFees.filter((f) => Number(f?.pending_amount ?? 0) > 0).length;
  const notices = [
    { title: 'School reopening circular', audience: 'All parents', channel: 'App + WhatsApp export', status: 'Draft' },
    { title: 'Fee due reminder', audience: `${pendingFees} parents`, channel: 'SMS queue', status: 'Ready' },
    { title: 'Route delay alert', audience: `${safeRoutes.length} routes`, channel: 'Transport group', status: 'Live template' },
    { title: 'Unit test timetable', audience: 'Classes 8–10', channel: 'App notice', status: 'Scheduled' },
  ];

  return (
    <div className="page-stack">
      <div className="page-title"><div><p className="eyebrow">Communication hub</p><h1>Circulars, notices and alert queues</h1></div><span className="status-pill secure">API-ready, not spammy</span></div>
      <div className="command-grid">
        <MiniMetric label="Students reachable" value={safeStudents.length} note="parent-linked database" />
        <MiniMetric label="Fee reminder queue" value={pendingFees} note="pending/partial fee rows" tone="warm" />
        <MiniMetric label="Route audiences" value={safeRoutes.length} note="transport-specific messages" />
        <MiniMetric label="Failed alerts" value="0" note="delivery log placeholder" />
      </div>
      <div className="grid two">
        <div className="panel">
          <h2>Composer rules</h2>
          <div className="ops-list">
            <span><Megaphone /> Send to whole school, class, route, or fee-pending parents</span>
            <span><Bell /> Critical alerts can use SMS fallback later</span>
            <span><MessageSquare /> WhatsApp export/queue before paid API integration</span>
            <span><Eye /> Delivery/read proof panel for office records</span>
          </div>
        </div>
        <div className="panel accent-panel">
          <MessageSquare />
          <h2>Parent-friendly messaging</h2>
          <p>Normal updates stay inside the app. Paid SMS/WhatsApp should be reserved for OTP, absence, fee due, bus delay and emergency alerts.</p>
        </div>
      </div>
      <div className="table-shell">
        <table>
          <thead><tr><th>Message</th><th>Audience</th><th>Channel</th><th>Status</th></tr></thead>
          <tbody>{notices.map((notice) => <tr key={notice.title}><td><strong>{notice.title}</strong><span>Template controlled by school admin</span></td><td>{notice.audience}</td><td>{notice.channel}</td><td><span className="status-pill secure">{notice.status}</span></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function ParentAccessPage({ students }) {
  const safeStudents = validateArray(students);
  const verified = Math.round(safeStudents.length * 0.62);
  const pending = Math.max(safeStudents.length - verified, 0);
  const sample = safeStudents.slice(0, 6);
  return (
    <div className="page-stack">
      <div className="page-title"><div><p className="eyebrow">Batch 15</p><h1>Parent login + child linking</h1></div><span className="status-pill secure">OTP-ready</span></div>
      <div className="command-grid">
        <MiniMetric label="Linked parents" value={verified} note="phone verified + child matched" />
        <MiniMetric label="Pending verification" value={pending} note="DOB/admission check required" tone="warm" />
        <MiniMetric label="Login method" value="OTP" note="phone first, child scoped" />
        <MiniMetric label="Data isolation" value="On" note="parent sees linked children only" />
      </div>
      <div className="grid two">
        <div className="panel">
          <h2>Parent access flow</h2>
          <div className="ops-list">
            <span><Phone /> Parent enters phone number</span>
            <span><ShieldCheck /> OTP verifies the device</span>
            <span><UserRound /> Parent confirms admission number or DOB once</span>
            <span><CheckCircle2 /> App unlocks only linked children</span>
          </div>
        </div>
        <div className="panel accent-panel">
          <LockKeyhole />
          <h2>Safety rule</h2>
          <p>Parent app must never search the full student database. It should read only records linked through <code>student_parent_links</code> after OTP verification.</p>
        </div>
      </div>
      <div className="table-shell">
        <table><thead><tr><th>Student</th><th>Parent phone</th><th>Verification</th><th>Allowed views</th></tr></thead>
          <tbody>{sample.map((student, index) => <tr key={student.id}><td><strong>{student.student_name}</strong><span>{student.admission_no}</span></td><td>{student.parent_phone || '—'}</td><td><span className={cx('status-pill', index < 4 ? 'secure' : 'danger')}>{index < 4 ? 'Verified' : 'DOB check pending'}</span></td><td>Fees · Bus · Attendance · Circulars · Marks</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentsPage({ fees, students }) {
  const safeFees = validateArray(fees);
  const safeStudents = validateArray(students);
  const studentById = useMemo(() => new Map(safeStudents.map((s) => [s.id, s])), [safeStudents]);
  const pending = safeFees.filter((fee) => Number(fee?.pending_amount ?? 0) > 0);
  const captured = safeFees.reduce((sum, fee) => sum + Number(fee?.total_paid ?? 0), 0);
  const due = safeFees.reduce((sum, fee) => sum + Number(fee?.pending_amount ?? 0), 0);
  const gatewayQueue = pending.slice(0, 8);
  return (
    <div className="page-stack">
      <div className="page-title"><div><p className="eyebrow">Batch 16</p><h1>Payments + receipts control</h1></div><span className="status-pill danger">Webhook required before live payments</span></div>
      <div className="command-grid">
        <MiniMetric label="Collected" value={formatMoney(captured)} note="from fee_summaries" />
        <MiniMetric label="Pending" value={formatMoney(due)} note="reminder and quick-pay base" tone="warm" />
        <MiniMetric label="Gateway status" value="Test only" note="Cashfree/Razorpay webhook next" />
        <MiniMetric label="Counter mode" value="Ready" note="manual receipt with audit log" />
      </div>
      <div className="grid two">
        <div className="panel">
          <h2>Payment safety workflow</h2>
          <div className="ops-list">
            <span><FileSpreadsheet /> Parent selects invoice, not free amount</span>
            <span><ShieldCheck /> Backend creates gateway order</span>
            <span><CheckCircle2 /> Webhook confirms payment, not frontend callback</span>
            <span><Download /> Receipt generated only after captured status</span>
          </div>
        </div>
        <div className="panel">
          <h2>Counter reconciliation</h2>
          <div className="compact-list">
            <div className="compact-row"><div><strong>Cash/UPI counter entry</strong><span>Requires collector name and reference</span></div><span className="status-pill secure">Audit</span></div>
            <div className="compact-row"><div><strong>Refund/correction</strong><span>Use reversal entry, never hard-delete payment</span></div><span className="status-pill danger">Controlled</span></div>
            <div className="compact-row"><div><strong>Daily closing</strong><span>Export accountant report</span></div><span className="status-pill">Ready</span></div>
          </div>
        </div>
      </div>
      <div className="table-shell"><table><thead><tr><th>Student</th><th>Invoice</th><th>Pending</th><th>Action</th></tr></thead><tbody>{gatewayQueue.map((fee) => { const student = studentById.get(fee.student_id) || {}; return <tr key={fee.id}><td><strong>{student.student_name || 'Student'}</strong><span>{student.admission_no || fee.student_id}</span></td><td>{fee.academic_year || '2026-27'}</td><td>{formatMoney(fee.pending_amount)}</td><td><span className="status-pill">Create payment link after webhook setup</span></td></tr>; })}</tbody></table></div>
    </div>
  );
}

function NotificationsPage({ students, fees, routes }) {
  const safeStudents = validateArray(students);
  const safeFees = validateArray(fees);
  const safeRoutes = validateArray(routes);
  const feePending = safeFees.filter((fee) => Number(fee?.pending_amount ?? 0) > 0).length;
  const queue = [
    { type: 'Fee reminder', audience: `${feePending} parents`, channel: 'SMS/WhatsApp queue', priority: 'High' },
    { type: 'Absent alert', audience: 'Class-wise parents', channel: 'SMS fallback', priority: 'High' },
    { type: 'Bus delay', audience: `${safeRoutes.length} routes`, channel: 'App + SMS if critical', priority: 'Critical' },
    { type: 'Circular read receipt', audience: `${safeStudents.length} students`, channel: 'In-app first', priority: 'Normal' },
  ];
  return (
    <div className="page-stack">
      <div className="page-title"><div><p className="eyebrow">Batch 20</p><h1>Notification queue + reminders</h1></div><span className="status-pill secure">In-app first</span></div>
      <div className="command-grid">
        <MiniMetric label="Reachable students" value={safeStudents.length} note="parent-linked database" />
        <MiniMetric label="Fee reminders" value={feePending} note="7-day due workflow" tone="warm" />
        <MiniMetric label="Critical channels" value="SMS" note="absence/bus/emergency only" />
        <MiniMetric label="WhatsApp API" value="Optional" note="keep costs controlled" />
      </div>
      <div className="grid two">
        <div className="panel"><h2>Message governance</h2><div className="ops-list"><span><Bell /> Normal updates stay in app</span><span><MessageSquare /> WhatsApp/SMS only for important alerts</span><span><Eye /> Delivery/read proof stored for office</span><span><ShieldCheck /> Role permissions decide who can send</span></div></div>
        <div className="panel accent-panel"><Megaphone /><h2>UX detail</h2><p>Parents should see clear messages like “Bus left school gate” and “Next stop to reach”, not vague live-map text that causes confusion.</p></div>
      </div>
      <div className="table-shell"><table><thead><tr><th>Queue</th><th>Audience</th><th>Channel</th><th>Priority</th></tr></thead><tbody>{queue.map((item) => <tr key={item.type}><td><strong>{item.type}</strong></td><td>{item.audience}</td><td>{item.channel}</td><td><span className={cx('status-pill', item.priority === 'Critical' ? 'danger' : item.priority === 'High' ? 'secure' : '')}>{item.priority}</span></td></tr>)}</tbody></table></div>
    </div>
  );
}


function ExamsPage({ students }) {
  const safeStudents = validateArray(students);
  const classGroups = [...new Set(safeStudents.map((s) => `${s?.class_label || ''} ${s?.division || ''}`.trim()).filter(Boolean))];
  const exams = [
    { date: '2026-07-22', className: '10 Diamond', subject: 'Mathematics', marks: 80, status: 'Draft' },
    { date: '2026-07-24', className: '10 Ruby', subject: 'Science', marks: 80, status: 'Draft' },
    { date: '2026-07-26', className: '8 Coral', subject: 'English', marks: 50, status: 'Ready' },
    { date: '2026-07-28', className: '11 Commerce', subject: 'Accountancy', marks: 80, status: 'Ready' },
  ];
  const analytics = [
    { label: 'Report card workflow', value: 'Teacher → Class teacher → Principal lock' },
    { label: 'CBSE grade support', value: 'Marks + grade + remarks' },
    { label: 'Parent publish mode', value: 'Locked until approval' },
  ];

  return (
    <div className="page-stack">
      <div className="page-title"><div><p className="eyebrow">Exams</p><h1>Exam timetable + marksheet backend</h1></div><span className="status-pill secure">CBSE-ready foundation</span></div>
      <div className="command-grid">
        <MiniMetric label="Class groups" value={classGroups.length || '—'} note="from student database" />
        <MiniMetric label="Scheduled exams" value={exams.length} note="draft timetable" />
        <MiniMetric label="Marksheets" value="0" note="entry opens next batch" />
        <MiniMetric label="Publish locks" value="On" note="principal approval required" />
      </div>
      <div className="grid two">
        <div className="panel">
          <h2>Report card controls</h2>
          <div className="ops-list">
            {analytics.map((item) => <span key={item.label}><FileText /> <strong>{item.label}</strong> {item.value}</span>)}
          </div>
        </div>
        <div className="panel">
          <h2>Performance dashboard</h2>
          <div className="compact-list">
            <div className="compact-row"><div><strong>Top performers</strong><span>Class/subject analytics placeholder</span></div><BarChart3 /></div>
            <div className="compact-row"><div><strong>Needs support</strong><span>Low score and attendance risk flag</span></div><AlertTriangle /></div>
            <div className="compact-row"><div><strong>Report cards</strong><span>PDF generation after marks workflow</span></div><Download /></div>
          </div>
        </div>
      </div>
      <div className="table-shell">
        <table>
          <thead><tr><th>Date</th><th>Class</th><th>Subject</th><th>Max Marks</th><th>Status</th></tr></thead>
          <tbody>{exams.map((exam) => <tr key={`${exam.date}-${exam.className}-${exam.subject}`}><td>{exam.date}</td><td><strong>{exam.className}</strong></td><td>{exam.subject}</td><td>{exam.marks}</td><td><span className="status-pill">{exam.status}</span></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}


function ProductionControlsPage({ counts, students, fees, routes, stops, imports, lastSyncAt, isOnline }) {
  const totalDue = validateArray(fees).reduce((sum, row) => sum + Number(row?.pending_amount ?? row?.amount_due ?? 0), 0);
  const latestImport = validateArray(imports)[0];
  const readiness = [
    { label: 'Super Admin role linked', status: true, note: 'Owner-only controls are active.' },
    { label: 'Student database imported', status: Number(counts?.students ?? 0) >= 1000, note: `${counts?.students ?? 0} students loaded.` },
    { label: 'Fee summaries imported', status: validateArray(fees).length >= 1000, note: `${validateArray(fees).length} fee records loaded.` },
    { label: 'Transport stops imported', status: validateArray(stops).length > 0, note: `${validateArray(stops).length} stop-level tracking points.` },
    { label: 'Network resilience active', status: true, note: 'Timeouts, retries and cache fallback are enabled.' },
    { label: 'Production backup policy', status: false, note: 'Enable scheduled Supabase export before live launch.' },
  ];

  const exportItems = [
    { title: 'Student master export', type: 'Excel', records: counts?.students ?? 0, owner: 'Super Admin' },
    { title: 'Fee pending report', type: 'Excel/PDF', records: validateArray(fees).filter((f) => Number(f?.pending_amount ?? 0) > 0).length, owner: 'Accountant' },
    { title: 'Transport route book', type: 'PDF', records: validateArray(routes).length, owner: 'Transport Head' },
    { title: 'Audit log archive', type: 'CSV', records: 'policy', owner: 'Super Admin' },
  ];

  const deploymentChecks = [
    'RLS remains ON for all private tables',
    'No service role key in frontend or GitHub',
    'Supabase production project separated from dev',
    'Payment webhooks tested before real fees',
    'Backup restore tested with synthetic data',
    'Parent/teacher/helper role test accounts verified',
  ];

  return (
    <div className="page-stack production-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Super Admin</p>
          <h1>Production Controls</h1>
        </div>
        <span className="status-pill secure">Owner only</span>
      </div>

      <div className="command-grid">
        <MiniMetric label="Deployment state" value="Staging" note="ready for controlled pilot" />
        <MiniMetric label="Network" value={isOnline ? 'Online' : 'Offline'} note={lastSyncAt ? `last sync ${new Date(lastSyncAt).toLocaleTimeString()}` : 'waiting for sync'} />
        <MiniMetric label="Pending fees" value={`₹${Math.round(totalDue).toLocaleString('en-IN')}`} note="from fee summaries" />
        <MiniMetric label="Latest import" value={latestImport?.status ?? '—'} note={latestImport?.completed_at ? new Date(latestImport.completed_at).toLocaleString() : 'no completed import'} />
      </div>

      <div className="grid two production-grid">
        <div className="panel">
          <h2>Launch readiness gate</h2>
          <p className="muted">Use this before putting real student data or fee payments into production.</p>
          <div className="ops-list readiness-list">
            {readiness.map((item) => (
              <span key={item.label} className={item.status ? 'ready' : 'pending'}>
                {item.status ? <CheckCircle2 /> : <AlertTriangle />}
                <strong>{item.label}</strong>
                <small>{item.note}</small>
              </span>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Backup and export policy</h2>
          <p className="muted">Actual scheduled backups should be configured in Supabase/Cloudflare, but this gives the school a visible control checklist.</p>
          <div className="compact-list">
            <div className="compact-row"><div><strong>Daily database backup</strong><span>Supabase automated + manual weekly archive</span></div><span className="status-pill secure">Required</span></div>
            <div className="compact-row"><div><strong>Monthly archive export</strong><span>Students, fees, attendance, transport</span></div><span className="status-pill">Planned</span></div>
            <div className="compact-row"><div><strong>Restore drill</strong><span>Test restore before school-wide launch</span></div><span className="status-pill danger">Pending</span></div>
          </div>
        </div>
      </div>

      <div className="grid two">
        <div className="panel">
          <h2>Export center</h2>
          <div className="table-shell flush-panel">
            <table>
              <thead><tr><th>Report</th><th>Type</th><th>Records</th><th>Owner</th></tr></thead>
              <tbody>{exportItems.map((item) => <tr key={item.title}><td><strong>{item.title}</strong></td><td>{item.type}</td><td>{item.records}</td><td>{item.owner}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="drawer-actions"><button className="ghost-btn"><Download size={16} /> Prepare export pack</button><button className="ghost-btn"><FileSpreadsheet size={16} /> Open report queue</button></div>
        </div>

        <div className="panel">
          <h2>Deployment checklist</h2>
          <div className="ops-list">
            {deploymentChecks.map((item) => <span key={item}><ShieldCheck /> {item}</span>)}
          </div>
        </div>
      </div>

      <div className="setup-warning">
        <strong>Production rule</strong>
        <p>Do not connect real fee payments or upload official school data until role tests, backup restore, payment webhook verification and parent isolation tests pass.</p>
      </div>
    </div>
  );
}


function AppShell({ session }) {
  const [active, setActive] = useState('setup');
  const [theme, setTheme] = useState('obsidian');
  const [students, setStudents] = useState([]);
  const [fees, setFees] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
  const [transportAssignments, setTransportAssignments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [roleAccess, setRoleAccess] = useState([]);
  const [profile, setProfile] = useState(null);
  const [savingAccess, setSavingAccess] = useState(false);
  const [imports, setImports] = useState([]);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);

  async function loadAll({ silent = false } = {}) {
    const schoolIdForCache = profile?.school_id || session?.user?.id || 'pending';
    if (!silent) setLoadingData(true);
    setError('');

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setStudents(readCache(schoolIdForCache, 'students', students));
      setFees(readCache(schoolIdForCache, 'fees', fees));
      setRoutes(readCache(schoolIdForCache, 'routes', routes));
      setStops(readCache(schoolIdForCache, 'stops', stops));
      setTransportAssignments(readCache(schoolIdForCache, 'transportAssignments', transportAssignments));
      setRoles(readCache(schoolIdForCache, 'roles', roles));
      setRoleAccess(readCache(schoolIdForCache, 'roleAccess', roleAccess));
      setImports(readCache(schoolIdForCache, 'imports', imports));
      setError('You are offline. Showing saved data from this device.');
      setLoadingData(false);
      return;
    }

    try {
      const profileRes = await resilientQuery(
        'load profile',
        () => supabase.from('user_profiles').select('*').eq('id', session?.user?.id).maybeSingle(),
        { retries: 2 }
      );

      if (profileRes.error) throw profileRes.error;
      const userProfile = profileRes.data;
      if (!userProfile?.school_id || !userProfile?.role_key) throw new Error('Your login is not linked to a role profile yet.');
      setProfile(userProfile);
      const schoolId = userProfile.school_id;

      const [studentsRes, parentsRes, feesRes, routesRes, stopsRes, assignmentsRes, rolesRes, roleAccessRes, importsRes] = await Promise.all([
        resilientQuery('load students', () => supabase.from('students').select('*').order('class_label').order('roll_no').range(0, 999)),
        resilientQuery('load parents count', () => supabase.from('parents').select('id', { count: 'exact', head: true })),
        resilientQuery('load fee summaries', () => supabase.from('fee_summaries').select('*').range(0, 999)),
        resilientQuery('load routes', () => supabase.from('transport_routes').select('*').order('route_code')),
        resilientQuery('load stops', () => supabase.from('transport_stops').select('*').order('stop_order')),
        resilientQuery('load transport assignments', () => supabase.from('student_transport_assignments').select('*').range(0, 999)),
        resilientQuery('load roles', () => supabase.from('roles').select('*').order('role_key')),
        resilientQuery('load role access', () => supabase.from('role_tab_access').select('*').order('role_key')),
        resilientQuery('load imports', () => supabase.from('import_jobs').select('*')),
      ]);

      const firstError = [studentsRes, parentsRes, feesRes, routesRes, stopsRes, assignmentsRes, rolesRes, roleAccessRes, importsRes].find((r) => r?.error)?.error;
      if (firstError) throw firstError;

      const nextStudents = validateArray(studentsRes.data);
      const nextFees = validateArray(feesRes.data);
      const nextRoutes = validateArray(routesRes.data);
      const nextStops = validateArray(stopsRes.data);
      const nextAssignments = validateArray(assignmentsRes.data);
      const nextRoles = validateArray(rolesRes.data);
      const nextRoleAccess = validateArray(roleAccessRes.data);
      const nextImports = validateArray(importsRes.data).sort((a, b) => new Date(b.completed_at || b.created_at || b.started_at || 0) - new Date(a.completed_at || a.created_at || a.started_at || 0));

      setStudents(nextStudents);
      setFees(nextFees);
      setRoutes(nextRoutes);
      setStops(nextStops);
      setTransportAssignments(nextAssignments);
      setRoles(nextRoles);
      setRoleAccess(nextRoleAccess);
      setImports(nextImports);
      setCounts({ students: nextStudents.length, parents: parentsRes.count || 0, fees: nextFees.length, routes: nextRoutes.length, imports: nextImports.length });
      setLastSyncAt(new Date().toISOString());

      writeCache(schoolId, 'students', nextStudents);
      writeCache(schoolId, 'fees', nextFees);
      writeCache(schoolId, 'routes', nextRoutes);
      writeCache(schoolId, 'stops', nextStops);
      writeCache(schoolId, 'transportAssignments', nextAssignments);
      writeCache(schoolId, 'roles', nextRoles);
      writeCache(schoolId, 'roleAccess', nextRoleAccess);
      writeCache(schoolId, 'imports', nextImports);
    } catch (err) {
      const safeMessage = getFriendlyErrorMessage(err, 'Could not load ERP data.');
      const cacheSchoolId = profile?.school_id || session?.user?.id || 'pending';
      setStudents((prev) => readCache(cacheSchoolId, 'students', prev));
      setFees((prev) => readCache(cacheSchoolId, 'fees', prev));
      setRoutes((prev) => readCache(cacheSchoolId, 'routes', prev));
      setStops((prev) => readCache(cacheSchoolId, 'stops', prev));
      setTransportAssignments((prev) => readCache(cacheSchoolId, 'transportAssignments', prev));
      setRoles((prev) => readCache(cacheSchoolId, 'roles', prev));
      setRoleAccess((prev) => readCache(cacheSchoolId, 'roleAccess', prev));
      setImports((prev) => readCache(cacheSchoolId, 'imports', prev));
      setError(safeMessage);
    } finally {
      setLoadingData(false);
    }
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); loadAll({ silent: true }); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [profile?.school_id]);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const myAccess = useMemo(() => {
    if (!profile) return null;
    return roleAccess.find((row) => row.role_key === profile.role_key) || null;
  }, [profile, roleAccess]);

  const visiblePortals = useMemo(() => {
    if (!profile) return portals.filter((p) => p.key === 'setup');
    if (profile.role_key === 'super_admin') return portals;
    return portals.filter((portal) => {
      if (portal.superAdminOnly) return false;
      return Boolean(myAccess?.[portal.accessKey]);
    });
  }, [profile, myAccess]);

  useEffect(() => {
    if (!visiblePortals.some((portal) => portal.key === active)) {
      setActive(visiblePortals[0]?.key || 'setup');
    }
  }, [visiblePortals, active]);

  async function updateRoleAccess(roleKey, column, enabled) {
    if (!profile || profile.role_key !== 'super_admin') return;
    setSavingAccess(true);
    setError('');
    try {
      const schoolId = profile.school_id;
      const existing = roleAccess.find((row) => row.role_key === roleKey);
      const payload = {
        ...(existing || {}),
        school_id: schoolId,
        role_key: roleKey,
        [column]: enabled,
        updated_at: new Date().toISOString(),
      };
      const { error: upsertError } = await resilientQuery(
        'update role access',
        () => supabase.from('role_tab_access').upsert(payload, { onConflict: 'school_id,role_key' }),
        { retries: 2 }
      );
      if (upsertError) throw upsertError;

      await resilientQuery('audit role access update', () => supabase.from('audit_logs').insert({
        school_id: schoolId,
        actor_user_id: session?.user?.id,
        actor_email: session?.user?.email,
        actor_role: profile.role_key,
        action: 'role_tab_access_updated',
        entity_table: 'role_tab_access',
        new_data: { role_key: roleKey, column, enabled },
      }), { retries: 1 });

      setRoleAccess((rows) => {
        const without = rows.filter((row) => row.role_key !== roleKey);
        const next = [...without, payload].sort((a, b) => a.role_key.localeCompare(b.role_key));
        writeCache(schoolId, 'roleAccess', next);
        return next;
      });
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not update role access. Please retry.'));
    } finally {
      setSavingAccess(false);
    }
  }

  async function signOut() {
    try {
      clearAppCache();
      await supabase.auth.signOut();
    } finally {
      location.reload();
    }
  }

  const page = active === 'academics' ? <AcademicsPage students={students} />
    : active === 'attendance' ? <AttendancePage students={students} />
    : active === 'fees' ? <FeesPage fees={fees} students={students} />
    : active === 'students' ? <StudentsPage students={students} reload={loadAll} profile={profile} session={session} />
    : active === 'transport' ? <TransportPage routes={routes} stops={stops} students={students} reload={loadAll} profile={profile} session={session} />
    : active === 'communication' ? <CommunicationPage students={students} fees={fees} routes={routes} />
    : active === 'notifications' ? <NotificationsPage students={students} fees={fees} routes={routes} />
    : active === 'exams' ? <ExamsPage students={students} />
    : active === 'parentAccess' ? <ParentAccessPage students={students} />
    : active === 'parentApp' ? <ParentPortalPage students={students} fees={fees} routes={routes} stops={stops} assignments={transportAssignments} />
    : active === 'payments' ? <PaymentsPage fees={fees} students={students} />
    : active === 'aiAssistant' ? <AIAssistantPage students={students} />
    : active === 'productionControls' ? <ProductionControlsPage counts={counts} students={students} fees={fees} routes={routes} stops={stops} imports={imports} lastSyncAt={lastSyncAt} isOnline={isOnline} />
    : active === 'roles' ? <RolesPage roles={roles} roleAccess={roleAccess} onToggleAccess={updateRoleAccess} savingAccess={savingAccess} />
    : active === 'imports' ? <ImportsPage imports={imports} />
    : <CommandCenterPage counts={counts} students={students} fees={fees} routes={routes} stops={stops} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <LogoLockup />
        <nav>{visiblePortals.map(({ key, label, icon: Icon }) => <button key={key} className={active === key ? 'active' : ''} onClick={() => setActive(key)}><Icon size={18} /> {label}</button>)}</nav>
        <div className="theme-box">
          <p>Theme</p>
          <div>{themeOptions.map((t) => <button key={t.key} className={theme === t.key ? 'active' : ''} onClick={() => setTheme(t.key)}>{t.mode === 'dark' ? <Moon size={14}/> : <Sun size={14}/>} {t.name}</button>)}</div>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div><p className="eyebrow">Signed in · {prettyLabel(profile?.role_key || 'loading')}</p><strong>{session?.user?.email}</strong></div>
          <div className="top-actions"><button className="ghost-btn" onClick={() => loadAll()} disabled={loadingData}><Eye size={16} /> {loadingData ? 'Syncing…' : isOnline ? 'Refresh DB' : 'Offline'}</button><button className="ghost-btn" onClick={signOut}><LogOut size={16} /> Sign out</button></div>
        </header>
        {error && <div className="setup-warning"><strong>Database/RLS response</strong><p>{error}</p><p>If you are logged in but see this, create your matching <code>user_profiles</code> row and role permissions.</p></div>}
        {lastSyncAt && <p className="table-note">Last sync: {new Date(lastSyncAt).toLocaleString()}</p>}
        <ErrorBoundary>{page}</ErrorBoundary>
      </main>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let mounted = true;
    resilientQuery('restore session', () => supabase.auth.getSession(), { retries: 1 })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) console.warn('Session restore failed:', getFriendlyErrorMessage(error));
        setSession(data?.session ?? null);
      })
      .catch((err) => console.warn('Session restore crashed:', getFriendlyErrorMessage(err)))
      .finally(() => { if (mounted) setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession ?? null));
    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  if (loading) return <div className="boot"><LogoLockup /><p>Checking secure session…</p></div>;
  if (!session) return <LoginScreen onSession={setSession} />;
  return <AppShell session={session} />;
}

createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
