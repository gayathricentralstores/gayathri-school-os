import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, FileText, GraduationCap, LockKeyhole, Sparkles, Upload } from 'lucide-react';
import { buildClassName, safeArray } from '../shared/erpUtils';

const subjectMap = {
  Mathematics: ['Algebra', 'Linear Equations', 'Mensuration', 'Statistics', 'Coordinate Geometry'],
  Science: ['Electricity', 'Light', 'Acids and Bases', 'Life Processes', 'Motion'],
  English: ['Reading comprehension', 'Grammar', 'Letter writing', 'Literature extract'],
  'Social Science': ['Indian Constitution', 'Nationalism', 'Resources', 'Map work'],
};

function generateBlueprint({ subject, difficulty, questionCount }) {
  const chapters = subjectMap[subject] || subjectMap.Mathematics;
  const count = Math.max(5, Math.min(Number(questionCount) || 10, 40));
  return Array.from({ length: count }).map((_, index) => {
    const chapter = chapters[index % chapters.length];
    const marks = index % 5 === 0 ? 5 : index % 3 === 0 ? 3 : 2;
    return {
      id: `${chapter}-${index}`,
      title: `${subject} ${difficulty} practice ${index + 1}`,
      chapter,
      marks,
      status: index % 4 === 0 ? 'Teacher review' : 'Draft',
    };
  });
}

export default function AIAssistantPage({ students }) {
  const safeStudents = safeArray(students);
  const [subject, setSubject] = useState('Mathematics');
  const [classLabel, setClassLabel] = useState('10 Diamond');
  const [difficulty, setDifficulty] = useState('CBSE standard');
  const [questionCount, setQuestionCount] = useState(12);
  const [mode, setMode] = useState('practice-paper');

  const classGroups = useMemo(() => [...new Set(safeStudents.map((s) => `${s?.class_label || ''} ${s?.division || ''}`.trim()).filter(Boolean))].slice(0, 30), [safeStudents]);
  const blueprint = useMemo(() => generateBlueprint({ subject, difficulty, questionCount }), [subject, difficulty, questionCount]);
  const totalMarks = blueprint.reduce((sum, item) => sum + item.marks, 0);

  return (
    <div className="page-stack ai-os-page">
      <div className="page-title">
        <div>
          <p className="eyebrow">AI Academic Assistant</p>
          <h1>Practice paper + revision generator</h1>
        </div>
        <span className="status-pill secure">Teacher-approved only</span>
      </div>

      <div className="command-grid">
        <div className="mini-metric"><span>Mode</span><strong>{mode === 'practice-paper' ? 'Paper' : 'Revision'}</strong><p>Academic content only</p></div>
        <div className="mini-metric"><span>Questions</span><strong>{blueprint.length}</strong><p>bounded for speed</p></div>
        <div className="mini-metric"><span>Total marks</span><strong>{totalMarks}</strong><p>auto blueprint</p></div>
        <div className="mini-metric"><span>Privacy</span><strong>No PII</strong><p>AI cannot see fees/phones</p></div>
      </div>

      <div className="grid two">
        <div className="panel ai-control-panel">
          <h2>Generator controls</h2>
          <p className="muted">This is an approval-first AI shell. It generates from approved question-bank data, not private student records.</p>
          <div className="form-grid">
            <label>Mode<select value={mode} onChange={(e) => setMode(e.target.value)}><option value="practice-paper">Practice paper</option><option value="math-revision">Math revision</option><option value="chapter-quiz">Chapter quiz</option></select></label>
            <label>Class<select value={classLabel} onChange={(e) => setClassLabel(e.target.value)}>{(classGroups.length ? classGroups : ['10 Diamond']).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Subject<select value={subject} onChange={(e) => setSubject(e.target.value)}>{Object.keys(subjectMap).map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Difficulty<select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}><option>CBSE standard</option><option>Easy revision</option><option>Exam oriented</option><option>Higher order thinking</option></select></label>
            <label>Questions<input type="number" min="5" max="40" value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} /></label>
          </div>
          <div className="drawer-actions">
            <button className="primary-btn"><Sparkles size={16} /> Generate draft</button>
            <button className="ghost-btn"><Upload size={16} /> Upload past paper</button>
          </div>
        </div>

        <div className="panel">
          <h2>Safety guardrails</h2>
          <div className="ops-list">
            <span><LockKeyhole /> AI cannot access fee records, parent phone numbers or payment data</span>
            <span><CheckCircle2 /> Teacher approval required before publishing to students</span>
            <span><BookOpen /> Use only approved notes, syllabus, question bank and past papers</span>
            <span><FileText /> Export as draft PDF after review batch</span>
          </div>
        </div>
      </div>

      <div className="table-shell">
        <table>
          <thead><tr><th>Question draft</th><th>Chapter</th><th>Marks</th><th>Status</th></tr></thead>
          <tbody>
            {blueprint.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.title}</strong><span>{classLabel} · {subject}</span></td>
                <td>{item.chapter}</td>
                <td>{item.marks}</td>
                <td><span className={buildClassName('status-pill', item.status === 'Teacher review' ? 'warm' : 'secure')}>{item.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="table-note">This is the AI module foundation. Real generation should be connected only after question-bank storage and teacher approval workflow are finalized.</p>
      </div>
    </div>
  );
}
