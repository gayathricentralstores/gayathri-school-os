import React, { useMemo, useState } from 'react';
import { Bell, BookOpen, BusFront, CalendarDays, CheckCircle2, ChevronRight, Clock3, FileSpreadsheet, MapPin, MessageSquare, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { buildClassName, formatMoney, initials, safeArray, statusTone } from '../shared/erpUtils';

function ParentMetric({ label, value, note, tone = '' }) {
  return (
    <div className={buildClassName('parent-metric', tone)}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <p>{note}</p> : null}
    </div>
  );
}

function ParentTimeline({ activeStop, nextStop }) {
  const items = [
    { label: 'School Gate', status: 'Departed', time: '3:35 PM' },
    { label: activeStop?.stop_name || 'Last updated stop', status: 'Reached', time: '4:02 PM', active: true },
    { label: nextStop?.stop_name || 'Next stop', status: 'Next stop', time: 'ETA 4:10 PM' },
    { label: 'Parent stop', status: 'Expected', time: 'ETA 4:18 PM' },
  ];

  return (
    <div className="parent-timeline">
      {items.map((item, index) => (
        <div className={buildClassName('parent-timeline-row', item.active && 'current')} key={`${item.label}-${index}`}>
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

export default function ParentPortalPage({ students, fees, routes, stops }) {
  const safeStudents = safeArray(students);
  const safeFees = safeArray(fees);
  const safeRoutes = safeArray(routes);
  const safeStops = safeArray(stops);
  const [selectedStudentId, setSelectedStudentId] = useState(safeStudents[0]?.id || '');

  const student = useMemo(() => safeStudents.find((item) => item.id === selectedStudentId) || safeStudents[0] || null, [safeStudents, selectedStudentId]);
  const fee = useMemo(() => safeFees.find((item) => item.student_id === student?.id) || safeFees[0] || null, [safeFees, student?.id]);
  const route = safeRoutes[0] || null;
  const routeStops = useMemo(() => safeStops.filter((stop) => stop.route_id === route?.id).sort((a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0)), [safeStops, route?.id]);
  const activeStop = routeStops[Math.min(2, Math.max(routeStops.length - 1, 0))];
  const nextStop = routeStops[Math.min(3, Math.max(routeStops.length - 1, 0))];

  const pendingAmount = Number(fee?.pending_amount ?? 0);
  const attendancePercent = Math.max(82, Math.min(99, Number(student?.data_confidence ?? 91)));
  const circulars = [
    { title: 'Unit test timetable published', tag: 'Exam', icon: CalendarDays },
    { title: 'Gayathri Central Stores order ready', tag: 'Store', icon: CheckCircle2 },
    { title: 'Fee reminder window starts next week', tag: 'Fees', icon: Bell },
  ];

  return (
    <div className="page-stack parent-os-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">Parent App</p>
          <h1>Parent mobile experience</h1>
        </div>
        <span className="status-pill secure">Offline-safe shell</span>
      </div>

      <div className="parent-layout">
        <section className="parent-phone-shell">
          <div className="parent-phone-top">
            <div>
              <p>Gayathri School OS</p>
              <strong>Today</strong>
            </div>
            <div className="parent-avatar">{initials(student?.student_name)}</div>
          </div>

          <div className="parent-child-card">
            <div>
              <span>Selected child</span>
              <h2>{student?.student_name || 'Student'}</h2>
              <p>{student?.class_label || '—'} {student?.division || ''} · {student?.admission_no || 'No admission no'}</p>
            </div>
            <select value={student?.id || ''} onChange={(e) => setSelectedStudentId(e.target.value)}>
              {safeStudents.slice(0, 30).map((item) => (
                <option key={item.id} value={item.id}>{item.student_name} · {item.class_label} {item.division}</option>
              ))}
            </select>
          </div>

          <div className="parent-card-grid">
            <ParentMetric label="Attendance" value={`${attendancePercent}%`} note="This month" />
            <ParentMetric label="Fee due" value={formatMoney(pendingAmount)} note={pendingAmount > 0 ? 'Reminder enabled' : 'No dues'} tone={pendingAmount > 0 ? 'warm' : 'secure'} />
          </div>

          <div className="parent-section-card">
            <div className="parent-section-head"><BusFront /><div><strong>{route?.route_name || 'Bus route'}</strong><span>Where-is-my-Train style stop timeline</span></div></div>
            <ParentTimeline activeStop={activeStop} nextStop={nextStop} />
            <div className="parent-actions">
              <button className="ghost-btn"><Phone size={15} /> Call helper</button>
              <button className="ghost-btn"><MapPin size={15} /> Not using bus today</button>
            </div>
          </div>

          <div className="parent-section-card">
            <div className="parent-section-head"><BookOpen /><div><strong>Timetable & notes</strong><span>Today’s learning cards</span></div></div>
            <div className="compact-list">
              <div className="compact-row"><div><strong>Mathematics</strong><span>Revision worksheet · Algebra basics</span></div><ChevronRight size={18} /></div>
              <div className="compact-row"><div><strong>English</strong><span>Homework note from class teacher</span></div><ChevronRight size={18} /></div>
            </div>
          </div>
        </section>

        <section className="page-stack">
          <div className="command-grid">
            <ParentMetric label="Linked students" value={safeStudents.length || '—'} note="Demo selector uses first 30" />
            <ParentMetric label="Transport stops" value={routeStops.length || '—'} note="Stop-level tracking only" />
            <ParentMetric label="Receipts" value="Ready" note="PDF workflow foundation" />
            <ParentMetric label="Security" value="Scoped" note="Parent RLS comes after account linking" />
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
            <div className="panel">
              <h2>Latest circulars</h2>
              <div className="compact-list">
                {circulars.map(({ title, tag, icon: Icon }) => (
                  <div className="compact-row" key={title}>
                    <div><strong>{title}</strong><span>{tag} · parent-visible</span></div>
                    <Icon size={18} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel accent-panel">
            <ShieldCheck />
            <h2>Production note</h2>
            <p>Parent accounts must be linked through OTP + child verification before real parents use this. This page is the polished app foundation without exposing other children’s data.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
