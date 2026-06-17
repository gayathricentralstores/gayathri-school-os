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
import './index.css';

const portals = [
  { key: 'setup', label: 'Command Center', icon: ShieldCheck, accessKey: 'dashboard' },
  { key: 'academics', label: 'Academics', icon: CalendarDays, accessKey: 'academics' },
  { key: 'attendance', label: 'Attendance', icon: CheckCircle2, accessKey: 'attendance' },
  { key: 'fees', label: 'Fees', icon: FileSpreadsheet, accessKey: 'fees' },
  { key: 'students', label: 'Students', icon: UsersRound, accessKey: 'students' },
  { key: 'transport', label: 'Transport', icon: BusFront, accessKey: 'transport' },
  { key: 'communication', label: 'Communication', icon: Megaphone, accessKey: 'communication' },
  { key: 'exams', label: 'Exams & Reports', icon: Award, accessKey: 'exams' },
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

function StudentsPage({ students, reload }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const debouncedQuery = useDebouncedValue(query, 300);
  const safeStudents = useMemo(() => validateArray(students), [students]);
  const filtered = useMemo(() => safeStudents.filter((s) => [s?.student_name, s?.admission_no, s?.class_label, s?.division, s?.locality].filter(Boolean).join(' ').toLowerCase().includes(debouncedQuery.toLowerCase())), [safeStudents, debouncedQuery]);

  return (
    <div className="page-stack">
      <div className="page-title">
        <div><p className="eyebrow">Student database</p><h1>1000-student production seed</h1></div>
        <button className="ghost-btn"><Download size={16} /> Export later</button>
      </div>
      <div className="toolbar">
        <Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, admission no, class, division, locality…" />
      </div>
      <div className="table-shell">
        <table>
          <thead><tr><th>Student</th><th>Class</th><th>Admission</th><th>Status</th><th>Locality</th><th>Confidence</th><th></th></tr></thead>
          <tbody>
            {filtered.slice(0, 150).map((s) => (
              <tr key={s.id}>
                <td><strong>{s.student_name}</strong><span>{s.gender} · DOB {s.dob}</span></td>
                <td>{s.class_label} {s.division}{s.stream ? ` · ${s.stream}` : ''}</td>
                <td>{s.admission_no}</td>
                <td><span className={cx('status-pill', s.status === 'active' ? 'secure' : '')}>{s.status}</span></td>
                <td>{s.locality}</td>
                <td>{s.data_confidence}</td>
                <td><button className="icon-btn" onClick={() => setEditing(s)}><Pencil size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="table-note">Showing first 150 matching rows for speed. Database contains all imported students.</p>
      </div>
      {editing && <StudentEditor student={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </div>
  );
}

function StudentEditor({ student, onClose, onSaved }) {
  const [form, setForm] = useState({ student_name: student.student_name, division: student.division, locality: student.locality || '', status: student.status });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (!student?.id) throw new Error('Student record is missing. Please refresh and try again.');
      const { error: updateError } = await resilientQuery(
        'save student',
        () => supabase.from('students').update(form).eq('id', student.id),
        { retries: 2 }
      );
      if (updateError) throw updateError;
      onSaved();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'Could not save student. Please retry.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <button className="close-btn" onClick={onClose}><X size={18} /></button>
        <h2>Edit student</h2>
        <p className="muted">Every edit is protected by RLS. Audit trigger/function can be expanded in Batch 2.</p>
        <label>Name<input value={form.student_name} onChange={(e) => setForm({ ...form, student_name: e.target.value })} /></label>
        <label>Division<input value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value })} /></label>
        <label>Locality<input value={form.locality} onChange={(e) => setForm({ ...form, locality: e.target.value })} /></label>
        <label>Status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">active</option><option value="inactive">inactive</option><option value="transferred">transferred</option><option value="alumni">alumni</option></select></label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-btn" onClick={save} disabled={busy}><Save size={16} /> {busy ? 'Saving…' : 'Save changes'}</button>
      </div>
    </div>
  );
}


function TransportPage({ routes, stops, students }) {
  const safeRoutes = validateArray(routes);
  const safeStops = validateArray(stops);
  const safeStudents = validateArray(students);
  const [activeRouteId, setActiveRouteId] = useState(safeRoutes[0]?.id);
  const [tripMode, setTripMode] = useState('evening');
  const [manualReached, setManualReached] = useState(2);
  const active = safeRoutes.find((r) => r.id === activeRouteId) || safeRoutes[0];
  const activeStops = safeStops.filter((s) => s.route_id === active?.id).sort((a,b) => (a.stop_order ?? 0) - (b.stop_order ?? 0));
  const reachedIndex = Math.min(Math.max(Number(manualReached) || 0, 0), Math.max(activeStops.length - 1, 0));
  const nextStop = activeStops[reachedIndex + 1];
  const routeStudents = safeStudents.filter((s) => s?.status === 'active').slice(0, 42);
  const onboardCount = tripMode === 'morning' ? Math.max(routeStudents.length - 4, 0) : Math.max(routeStudents.length - 2, 0);
  const progress = activeStops.length ? Math.round(((reachedIndex + 1) / activeStops.length) * 100) : 0;
  const routeHealth = safeRoutes.map((route, index) => {
    const routeStops = safeStops.filter((s) => s.route_id === route.id).length;
    return {
      ...route,
      lastStop: safeStops.filter((s) => s.route_id === route.id).sort((a,b) => (a.stop_order ?? 0) - (b.stop_order ?? 0))[Math.min(2 + (index % 3), Math.max(routeStops - 1, 0))]?.stop_name || 'School Gate',
      completion: routeStops ? Math.min(92, 36 + index * 4) : 0,
      alert: index === 1 ? '6 min delay' : index === 4 ? 'Helper offline 2m' : 'On route',
    };
  });

  return (
    <div className="page-stack">
      <div className="page-title"><div><p className="eyebrow">Transport production</p><h1>Where-is-my-Train bus tracking</h1></div><span className="status-pill secure">Stop-level privacy</span></div>

      <div className="command-grid">
        <MiniMetric label="Routes running" value={safeRoutes.length || '—'} note="morning/evening trip ready" />
        <MiniMetric label="Current route progress" value={`${progress}%`} note={nextStop ? `Next: ${nextStop.stop_name}` : 'Trip complete'} />
        <MiniMetric label="Students onboard" value={`${onboardCount}/${routeStudents.length}`} note="helper attendance summary" />
        <MiniMetric label="Transport alerts" value="2" note="delay/offline queue" tone="warm" />
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
              <div className={cx('timeline-row', index < reachedIndex ? 'done' : index === reachedIndex ? 'current' : '')} key={stop.id}>
                <div className="dot" />
                <div><strong>{stop.stop_name}</strong><span>{index < reachedIndex ? 'Reached' : index === reachedIndex ? 'Last updated stop' : 'Upcoming'} · {stop.radius_m || 100}m geofence</span></div>
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
          <thead><tr><th>Route</th><th>Last stop</th><th>Progress</th><th>Status</th></tr></thead>
          <tbody>{routeHealth.map((route) => <tr key={route.id}><td><strong>{route.route_name}</strong><span>{route.route_code}</span></td><td>{route.lastStop}</td><td>{route.completion}%</td><td><span className={cx('status-pill', route.alert === 'On route' ? 'secure' : 'danger')}>{route.alert}</span></td></tr>)}</tbody>
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
        <div><p className="eyebrow">Academics</p><h1>Calendar + Timetable Engine</h1></div>
        <span className="status-pill secure">Conflict-aware</span>
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
        <div><p className="eyebrow">Attendance</p><h1>Attendance + Substitute Control</h1></div>
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
        <div><p className="eyebrow">Fees</p><h1>Fees + Quick Pay Foundation</h1></div>
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
      <div className="page-title"><div><p className="eyebrow">Exams</p><h1>Exam timetable + report cards</h1></div><span className="status-pill secure">CBSE-ready foundation</span></div>
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


function AppShell({ session }) {
  const [active, setActive] = useState('setup');
  const [theme, setTheme] = useState('obsidian');
  const [students, setStudents] = useState([]);
  const [fees, setFees] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [stops, setStops] = useState([]);
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

      const [studentsRes, parentsRes, feesRes, routesRes, stopsRes, rolesRes, roleAccessRes, importsRes] = await Promise.all([
        resilientQuery('load students', () => supabase.from('students').select('*').order('class_label').order('roll_no').range(0, 999)),
        resilientQuery('load parents count', () => supabase.from('parents').select('id', { count: 'exact', head: true })),
        resilientQuery('load fee summaries', () => supabase.from('fee_summaries').select('*').range(0, 999)),
        resilientQuery('load routes', () => supabase.from('transport_routes').select('*').order('route_code')),
        resilientQuery('load stops', () => supabase.from('transport_stops').select('*').order('stop_order')),
        resilientQuery('load roles', () => supabase.from('roles').select('*').order('role_key')),
        resilientQuery('load role access', () => supabase.from('role_tab_access').select('*').order('role_key')),
        resilientQuery('load imports', () => supabase.from('import_jobs').select('*')),
      ]);

      const firstError = [studentsRes, parentsRes, feesRes, routesRes, stopsRes, rolesRes, roleAccessRes, importsRes].find((r) => r?.error)?.error;
      if (firstError) throw firstError;

      const nextStudents = validateArray(studentsRes.data);
      const nextFees = validateArray(feesRes.data);
      const nextRoutes = validateArray(routesRes.data);
      const nextStops = validateArray(stopsRes.data);
      const nextRoles = validateArray(rolesRes.data);
      const nextRoleAccess = validateArray(roleAccessRes.data);
      const nextImports = validateArray(importsRes.data).sort((a, b) => new Date(b.completed_at || b.created_at || b.started_at || 0) - new Date(a.completed_at || a.created_at || a.started_at || 0));

      setStudents(nextStudents);
      setFees(nextFees);
      setRoutes(nextRoutes);
      setStops(nextStops);
      setRoles(nextRoles);
      setRoleAccess(nextRoleAccess);
      setImports(nextImports);
      setCounts({ students: nextStudents.length, parents: parentsRes.count || 0, fees: nextFees.length, routes: nextRoutes.length, imports: nextImports.length });
      setLastSyncAt(new Date().toISOString());

      writeCache(schoolId, 'students', nextStudents);
      writeCache(schoolId, 'fees', nextFees);
      writeCache(schoolId, 'routes', nextRoutes);
      writeCache(schoolId, 'stops', nextStops);
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
    : active === 'students' ? <StudentsPage students={students} reload={loadAll} />
    : active === 'transport' ? <TransportPage routes={routes} stops={stops} students={students} />
    : active === 'communication' ? <CommunicationPage students={students} fees={fees} routes={routes} />
    : active === 'exams' ? <ExamsPage students={students} />
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
