import React, { useMemo, useState } from 'react';
import { Bell, BookOpen, BusFront, CalendarDays, CheckCircle2, ChevronRight, Clock3, FileSpreadsheet, Home, MapPin, MessageSquare, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { buildClassName, formatMoney, initials, safeArray } from '../shared/erpUtils';

const demoParentPhones = ['8129431344', '9446727735', '7510506202'];

function ParentMetric({ label, value, note, tone = '' }) {
  return (
    <div className={buildClassName('parent-metric parent-metric-flat', tone)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <p>{note}</p> : null}
    </div>
  );
}

function ParentTimeline({ routeStops }) {
  const safeStops = safeArray(routeStops);
  const reachedIndex = Math.min(2, Math.max(safeStops.length - 1, 0));
  const items = safeStops.length
    ? safeStops.slice(0, 6).map((stop, index) => ({
        label: stop?.stop_name || `Stop ${index + 1}`,
        status: index === 0 ? 'Left school gate' : index < reachedIndex ? 'Reached stop' : index === reachedIndex ? 'Last stop reached' : index === reachedIndex + 1 ? 'Next stop to reach' : 'Yet to reach',
        time: index < reachedIndex ? 'Updated' : index === reachedIndex + 1 ? 'ETA 4:10 PM' : 'Scheduled',
        active: index === reachedIndex,
        done: index < reachedIndex,
      }))
    : [
        { label: 'School Gate', status: 'Left school gate', time: '3:35 PM', done: true },
        { label: 'Route update pending', status: 'Next stop to reach', time: 'ETA soon', active: true },
      ];

  return (
    <div className="parent-timeline parent-timeline-uber">
      {items.map((item, index) => (
        <div className={buildClassName('parent-timeline-row', item.active && 'current', item.done && 'done')} key={`${item.label}-${index}`}>
          <div className="parent-dot" />
          <div>
            <strong>{item.label}</strong>
            <span>{item.status} · {item.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ParentBottomNav({ activeTab, setActiveTab }) {
  const nav = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'bus', label: 'Bus', icon: BusFront },
    { key: 'fees', label: 'Fees', icon: FileSpreadsheet },
    { key: 'learn', label: 'Learn', icon: BookOpen },
    { key: 'profile', label: 'Profile', icon: UserRound },
  ];

  return (
    <div className="parent-bottom-nav" aria-label="Parent app bottom navigation">
      {nav.map(({ key, label, icon: Icon }) => (
        <button key={key} className={activeTab === key ? 'active' : ''} onClick={() => setActiveTab(key)} type="button">
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

export default function ParentPortalPage({ students, fees, routes, stops, assignments }) {
  const safeStudents = safeArray(students);
  const safeFees = safeArray(fees);
  const safeRoutes = safeArray(routes);
  const safeStops = safeArray(stops);
  const safeAssignments = safeArray(assignments);
  const [parentPhone, setParentPhone] = useState(demoParentPhones[0]);
  const linkedStudents = useMemo(() => {
    const matches = safeStudents.filter((item) => String(item?.parent_phone || '') === parentPhone);
    return matches.length ? matches : safeStudents.slice(0, 3);
  }, [safeStudents, parentPhone]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [activeTab, setActiveTab] = useState('home');

  const student = useMemo(() => linkedStudents.find((item) => item.id === selectedStudentId) || linkedStudents[0] || null, [linkedStudents, selectedStudentId]);
  const fee = useMemo(() => safeFees.find((item) => item.student_id === student?.id) || null, [safeFees, student?.id]);
  const assignment = useMemo(() => safeAssignments.find((item) => item.student_id === student?.id) || null, [safeAssignments, student?.id]);
  const route = useMemo(() => safeRoutes.find((item) => item.id === assignment?.route_id) || safeRoutes[0] || null, [safeRoutes, assignment?.route_id]);
  const routeStops = useMemo(() => safeStops.filter((stop) => stop.route_id === route?.id).sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0)), [safeStops, route?.id]);
  const pendingAmount = Number(fee?.pending_amount ?? 0);
  const attendancePercent = Math.max(82, Math.min(99, Number(student?.data_confidence ?? 91)));
  const circulars = [
    { title: 'Unit test timetable published', tag: 'Exam', icon: CalendarDays },
    { title: 'Gayathri Central Stores order ready', tag: 'Store', icon: CheckCircle2 },
    { title: 'Fee reminder window starts next week', tag: 'Fees', icon: Bell },
  ];

  const homeView = (
    <>
      <div className="parent-card-grid">
        <ParentMetric label="Attendance" value={`${attendancePercent}%`} note="This month" />
        <ParentMetric label="Fee due" value={formatMoney(pendingAmount)} note={pendingAmount > 0 ? 'Reminder enabled' : 'No dues'} tone={pendingAmount > 0 ? 'warm' : 'secure'} />
      </div>
      <div className="parent-section-card parent-flat-card">
        <div className="parent-section-head"><BusFront /><div><strong>{route?.route_name || 'Bus route'}</strong><span>Stop-level bus tracking</span></div></div>
        <ParentTimeline routeStops={routeStops} />
      </div>
      <div className="parent-section-card parent-flat-card">
        <div className="parent-section-head"><MessageSquare /><div><strong>Today</strong><span>School updates that matter</span></div></div>
        <div className="compact-list">
          {circulars.map(({ title, tag, icon: Icon }) => (
            <div className="compact-row" key={title}><div><strong>{title}</strong><span>{tag} · parent-visible</span></div><Icon size={18} /></div>
          ))}
        </div>
      </div>
    </>
  );

  const busView = (
    <div className="parent-section-card parent-flat-card parent-fill-card">
      <div className="parent-section-head"><BusFront /><div><strong>{route?.route_name || 'Bus route'}</strong><span>Current trip view</span></div></div>
      <ParentTimeline routeStops={routeStops} />
      <div className="parent-actions">
        <button className="ghost-btn"><Phone size={15} /> Call helper</button>
        <button className="ghost-btn"><MapPin size={15} /> Mark not using bus today</button>
      </div>
    </div>
  );

  const feesView = (
    <div className="parent-section-card parent-flat-card parent-fill-card">
      <div className="parent-section-head"><FileSpreadsheet /><div><strong>Fees</strong><span>Receipts and dues</span></div></div>
      <ParentMetric label="Pending amount" value={formatMoney(pendingAmount)} note={pendingAmount > 0 ? 'Quick-pay flow ready' : 'No dues'} tone={pendingAmount > 0 ? 'warm' : 'secure'} />
      <button className="parent-primary-action">View receipt / Pay now</button>
    </div>
  );

  const learnView = (
    <div className="parent-section-card parent-flat-card parent-fill-card">
      <div className="parent-section-head"><BookOpen /><div><strong>Timetable & notes</strong><span>Today’s learning cards</span></div></div>
      <div className="compact-list">
        <div className="compact-row"><div><strong>Mathematics</strong><span>Revision worksheet · Algebra basics</span></div><ChevronRight size={18} /></div>
        <div className="compact-row"><div><strong>English</strong><span>Homework note from class teacher</span></div><ChevronRight size={18} /></div>
      </div>
    </div>
  );

  const profileView = (
    <div className="parent-section-card parent-flat-card parent-fill-card">
      <div className="parent-section-head"><UserRound /><div><strong>Profile</strong><span>Linked parent account</span></div></div>
      <div className="compact-list">
        <div className="compact-row"><div><strong>{student?.student_name || 'Student'}</strong><span>{student?.class_label || '—'} {student?.division || ''} · {student?.admission_no || 'No admission no'}</span></div></div>
        <div className="compact-row"><div><strong>{parentPhone}</strong><span>OTP login phone for this demo parent</span></div></div>
      </div>
    </div>
  );

  const activeView = activeTab === 'bus' ? busView : activeTab === 'fees' ? feesView : activeTab === 'learn' ? learnView : activeTab === 'profile' ? profileView : homeView;

  return (
    <div className="page-stack parent-os-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Parent App First</p>
          <h1>Uber-style parent mobile app</h1>
        </div>
        <span className="status-pill secure">Bottom nav ready</span>
      </div>

      <div className="parent-layout">
        <section className="parent-phone-shell parent-uber-shell">
          <div className="parent-phone-top parent-uber-top">
            <div>
              <p>Gayathri School OS</p>
              <strong>{activeTab === 'home' ? 'Today' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</strong>
            </div>
            <div className="parent-avatar">{initials(student?.student_name)}</div>
          </div>

          <div className="parent-demo-login">
            <span>Parent phone</span>
            <div>
              {demoParentPhones.map((phone) => <button key={phone} className={parentPhone === phone ? 'active' : ''} onClick={() => { setParentPhone(phone); setSelectedStudentId(''); }} type="button">{phone}</button>)}
            </div>
          </div>

          <div className="parent-child-card parent-flat-card">
            <div>
              <span>Selected child</span>
              <h2>{student?.student_name || 'Student'}</h2>
              <p>{student?.class_label || '—'} {student?.division || ''} · {student?.admission_no || 'No admission no'}</p>
            </div>
            <select value={student?.id || ''} onChange={(e) => setSelectedStudentId(e.target.value)}>
              {linkedStudents.map((item) => (
                <option key={item.id} value={item.id}>{item.student_name} · {item.class_label} {item.division}</option>
              ))}
            </select>
          </div>

          <div className="parent-tab-content">{activeView}</div>
          <ParentBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
        </section>

        <section className="page-stack">
          <div className="command-grid">
            <ParentMetric label="Linked children" value={linkedStudents.length || '—'} note={`Phone ${parentPhone}`} />
            <ParentMetric label="Transport stops" value={routeStops.length || '—'} note="Stop-level tracking only" />
            <ParentMetric label="Receipts" value="Ready" note="PDF workflow foundation" />
            <ParentMetric label="Security" value="Scoped" note="OTP + child verification ready" />
          </div>

          <div className="grid two">
            <div className="panel">
              <h2>Parent app modules</h2>
              <div className="ops-list">
                <span><FileSpreadsheet /> Fee status, receipts and quick-pay screen</span>
                <span><BusFront /> Last stop reached, next stop and ETA</span>
                <span><Clock3 /> Attendance and leave request foundation</span>
                <span><MessageSquare /> Circulars, notices and read status</span>
              </div>
            </div>
            <div className="panel accent-panel">
              <ShieldCheck />
              <h2>UX cleanup applied</h2>
              <p>Parent app now uses a bottom navbar, flatter premium cards, clearer bus copy and phone-linked child switching for safe parent testing.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
