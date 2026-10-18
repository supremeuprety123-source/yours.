import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAll, addRecord, updateRecord, removeRecord } from '../lib/store';
import type { Chapter, MockScore, DayLog, FocusSession, PlanBlock, Paper } from '../lib/types';
import { EXAM_DATE } from '../lib/revisionPlan';
import { todayISO, formatDate, daysUntil, formatTime, addDays, toLocalISO } from '../lib/utils';
import Modal from './Modal';
import {
  Target, Flame, Plus, Trash2, Edit2, Calendar,
  Award, ChevronLeft, ChevronRight, BarChart3, Zap,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

type PlanTab = 'overview' | 'planner' | 'habits';

const PAPER_COLORS: Record<string, string> = {
  Acc: '#3B82F6',
  Laws: '#A78BFA',
  QA: '#F97316',
  Econ: '#22C55E',
};

function minutesBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + (em || 0) - (sh * 60 + (sm || 0));
  if (mins < 0) mins += 24 * 60;
  return Math.max(0, mins);
}

function fmtClock(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const am = h < 12;
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${am ? 'am' : 'pm'}`;
}

function dayPct(blocks: PlanBlock[]): number {
  const target = blocks.reduce((s, b) => s + (b.target_min || 0), 0);
  if (target <= 0) return 0;
  const done = blocks.reduce((s, b) => s + (b.completed_min || 0), 0);
  return Math.min(100, Math.round((done / target) * 100));
}

interface Props {
  routines: unknown[];
  chapters: Chapter[];
  onRoutinesChanged: () => void;
}

export default function RevisionPlanView({ chapters, onRoutinesChanged }: Props) {
  const { refreshAll, refreshKey } = useApp();
  const [tab, setTab] = useState<PlanTab>('planner');
  const [blocks, setBlocks] = useState<PlanBlock[]>([]);
  const [mocks, setMocks] = useState<MockScore[]>([]);
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [dayView, setDayView] = useState<'list' | 'clock'>('list');
  const [blockModal, setBlockModal] = useState(false);
  const [editing, setEditing] = useState<PlanBlock | null>(null);

  const load = async () => {
    const [b, m, l, s, p] = await Promise.all([
      getAll<PlanBlock>('plan_blocks'),
      getAll<MockScore>('mock_scores'),
      getAll<DayLog>('day_logs'),
      getAll<FocusSession>('focus_sessions'),
      getAll<Paper>('papers'),
    ]);
    setBlocks(b);
    setMocks(m.sort((a, c) => c.date.localeCompare(a.date)));
    setLogs(l);
    setSessions(s);
    setPapers(p);
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const today = todayISO();
  const examDays = EXAM_DATE ? Math.max(0, daysUntil(EXAM_DATE)) : 0;

  const blocksForDate = useMemo(
    () =>
      blocks
        .filter(b => b.date === selectedDate)
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
    [blocks, selectedDate]
  );

  const blocksByDate = useMemo(() => {
    const map: Record<string, PlanBlock[]> = {};
    for (const b of blocks) {
      (map[b.date] ||= []).push(b);
    }
    return map;
  }, [blocks]);

  const todayBlocks = blocksByDate[today] || [];
  const todayTarget = todayBlocks.reduce((s, b) => s + (b.target_min || 0), 0);
  const todayDone = todayBlocks.reduce((s, b) => s + (b.completed_min || 0), 0);

  const studiedTodayMin = useMemo(() => {
    const fromLogs = logs
      .filter(l => l.date === today && (l.category === 'Study' || l.category === 'Coaching'))
      .reduce((s, l) => s + (l.duration_min || 0), 0);
    const fromFocus = sessions
      .filter(s => s.completed_at.startsWith(today))
      .reduce((s, sess) => s + sess.duration, 0);
    return fromLogs + fromFocus + todayDone;
  }, [logs, sessions, today, todayDone]);

  const streak = useMemo(() => {
    let n = 0;
    for (let i = 0; i < 365; i++) {
      const d = addDays(today, -i);
      const has =
        (blocksByDate[d] || []).some(b => (b.completed_min || 0) > 0) ||
        logs.some(l => l.date === d && (l.duration_min || 0) > 0) ||
        sessions.some(s => s.completed_at.startsWith(d));
      if (has) n++;
      else if (i > 0) break;
    }
    return n;
  }, [blocksByDate, logs, sessions, today]);

  const studyNext = useMemo(() => {
    return [...chapters]
      .filter(c => c.status !== 'completed' || (c.completion || 0) < 100)
      .sort((a, b) => (a.completion || 0) - (b.completion || 0))
      .slice(0, 5)
      .map(c => {
        const paper = papers.find(p => p.id === c.paper_id);
        const short =
          paper?.name?.includes('Law') ? 'Laws' :
          paper?.name?.includes('Account') ? 'Acc' :
          paper?.name?.includes('Quant') || paper?.name?.includes('Math') ? 'QA' :
          paper?.name?.includes('Eco') ? 'Econ' : 'Acc';
        return {
          id: c.id,
          title: c.name,
          paper: short,
          solvedHint: `${c.completion || 0}% · ${c.status === 'not_started' ? 'Not started' : c.status === 'in_progress' ? 'In progress' : 'Done'}`,
          status: c.status,
        };
      });
  }, [chapters, papers]);

  const setBlockStatus = async (b: PlanBlock, status: 'full' | 'half' | 'none') => {
    const completed =
      status === 'full' ? b.target_min || minutesBetween(b.start_time, b.end_time) :
      status === 'half' ? Math.round((b.target_min || minutesBetween(b.start_time, b.end_time)) / 2) :
      0;
    await updateRecord('plan_blocks', b.id, { status, completed_min: completed });
    await load();
    refreshAll();
    onRoutinesChanged();
  };

  const saveBlock = async (data: Partial<PlanBlock>) => {
    const start = data.start_time || '09:00';
    const end = data.end_time || '10:00';
    const target = data.target_min ?? minutesBetween(start, end);
    const payload = {
      date: data.date || selectedDate,
      start_time: start,
      end_time: end,
      title: (data.title || '').trim() || 'Study block',
      paper: data.paper || 'Acc',
      target_min: target,
      completed_min: data.completed_min ?? 0,
      status: data.status || '',
      notes: data.notes || '',
    };
    if (editing) await updateRecord('plan_blocks', editing.id, payload);
    else await addRecord('plan_blocks', { ...payload, created_at: new Date().toISOString() });
    setBlockModal(false);
    setEditing(null);
    await load();
    refreshAll();
  };

  const deleteBlock = async (id: string) => {
    await removeRecord('plan_blocks', id);
    await load();
    refreshAll();
  };

  const calCells = useMemo(() => {
    const y = calMonth.getFullYear();
    const m = calMonth.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const monFirst = (firstDow + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: { dateStr: string; day: number; inMonth: boolean }[] = [];
    for (let i = 0; i < monFirst; i++) {
      const d = new Date(y, m, 1 - (monFirst - i));
      cells.push({ dateStr: toLocalISO(d), day: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ dateStr: toLocalISO(new Date(y, m, d)), day: d, inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1];
      const [yy, mm, dd] = last.dateStr.split('-').map(Number);
      const n = new Date(yy, mm - 1, dd + 1);
      cells.push({ dateStr: toLocalISO(n), day: n.getDate(), inMonth: false });
    }
    return cells;
  }, [calMonth]);

  const greenDays = useMemo(() => {
    return Object.entries(blocksByDate).filter(([, bs]) => dayPct(bs) >= 90).length;
  }, [blocksByDate]);

  return (
    <div className="sc-plan space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#F8FAFC] tracking-tight">Your plan</h2>
          <p className="text-sm text-[#94A3B8] mt-0.5">4 subjects · CA Foundation · Jan 2027</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-[#1E293B] border border-white/10 p-1 w-fit">
          {([
            ['overview', 'Overview'],
            ['planner', 'Planner'],
            ['habits', 'Habits'],
          ] as [PlanTab, string][]).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                tab === k ? 'bg-[#3B82F6] text-white' : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <OverviewTab
          studiedMin={studiedTodayMin}
          streak={streak}
          examDays={examDays}
          studyNext={studyNext}
          chapters={chapters}
          papers={papers}
          mocks={mocks}
          onOpenPlanner={() => setTab('planner')}
        />
      )}

      {tab === 'planner' && (
        <PlannerTab
          calMonth={calMonth}
          setCalMonth={setCalMonth}
          calCells={calCells}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          blocksByDate={blocksByDate}
          blocksForDate={blocksForDate}
          dayView={dayView}
          setDayView={setDayView}
          todayPct={dayPct(blocksForDate)}
          todayTarget={blocksForDate.reduce((s, b) => s + (b.target_min || 0), 0)}
          todayDone={blocksForDate.reduce((s, b) => s + (b.completed_min || 0), 0)}
          greenDays={greenDays}
          examDays={examDays}
          onAdd={() => { setEditing(null); setBlockModal(true); }}
          onEdit={b => { setEditing(b); setBlockModal(true); }}
          onDelete={deleteBlock}
          onStatus={setBlockStatus}
        />
      )}

      {tab === 'habits' && (
        <HabitsTab
          calMonth={calMonth}
          setCalMonth={setCalMonth}
          calCells={calCells}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          blocksByDate={blocksByDate}
          logs={logs}
          sessions={sessions}
          mocks={mocks}
          streak={streak}
          studiedTodayMin={studiedTodayMin}
        />
      )}

      {blockModal && (
        <BlockModal
          open={blockModal}
          editing={editing}
          defaultDate={selectedDate}
          onClose={() => { setBlockModal(false); setEditing(null); }}
          onSave={saveBlock}
        />
      )}
    </div>
  );
}

function OverviewTab({
  studiedMin, streak, examDays, studyNext, chapters, papers, mocks, onOpenPlanner,
}: {
  studiedMin: number;
  streak: number;
  examDays: number;
  studyNext: { id: string; title: string; paper: string; solvedHint: string; status: string }[];
  chapters: Chapter[];
  papers: Paper[];
  mocks: MockScore[];
  onOpenPlanner: () => void;
}) {
  const byPaper = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    for (const c of chapters) {
      const paper = papers.find(p => p.id === c.paper_id);
      const key =
        paper?.name?.includes('Law') ? 'Laws' :
        paper?.name?.includes('Account') ? 'Acc' :
        paper?.name?.includes('Quant') || paper?.name?.includes('Math') ? 'QA' :
        paper?.name?.includes('Eco') ? 'Econ' : (paper?.name || 'Other');
      if (!map[key]) map[key] = { total: 0, done: 0 };
      map[key].total++;
      if (c.status === 'completed' || (c.completion || 0) >= 100) map[key].done++;
    }
    return map;
  }, [chapters, papers]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Solved today', value: '0', sub: 'questions', hint: 'Keep going' },
          { label: 'Studied today', value: formatTime(studiedMin), sub: 'active time', hint: 'Logs + focus + plan' },
          { label: 'Streak', value: String(streak), sub: streak === 1 ? 'day' : 'days', hint: streak > 0 ? 'Your best yet' : 'Start today' },
          { label: 'Revisions due', value: String(chapters.filter(c => c.confidence === 'red' || c.confidence === 'yellow').length), sub: 'today', hint: 'Mark in Study' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-[#1E293B] p-4">
            <div className="text-sm text-[#94A3B8]">{s.label}</div>
            <div className="text-3xl font-bold text-[#F8FAFC] mt-1">{s.value}</div>
            <div className="text-xs text-[#64748B] mt-0.5">{s.sub}</div>
            <div className="text-xs text-[#94A3B8] mt-2">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#1E293B] p-5">
          <h3 className="text-lg font-semibold text-[#F8FAFC]">What to study next</h3>
          <p className="text-xs text-[#64748B] mt-0.5 mb-3">From your Study chapters.</p>
          {studyNext.length === 0 ? (
            <p className="text-sm text-[#64748B] py-6 text-center">No chapters yet — add them in Study.</p>
          ) : (
            <div className="space-y-1">
              {studyNext.map((item, i) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl p-3 hover:bg-white/5">
                  <div className="flex gap-3 min-w-0">
                    <span className="text-xs text-[#64748B] w-4 shrink-0 pt-1">{i + 1}</span>
                    <span
                      className="shrink-0 self-start rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        background: (PAPER_COLORS[item.paper] || '#3B82F6') + '22',
                        color: PAPER_COLORS[item.paper] || '#3B82F6',
                      }}
                    >
                      {item.paper}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#F8FAFC] truncate">{item.title}</div>
                      <div className="text-xs text-[#94A3B8] mt-0.5">{item.solvedHint}</div>
                      <span className="inline-block mt-1 rounded-full bg-[#F97316]/15 text-[#F97316] px-2 py-0.5 text-[10px] font-medium">
                        {item.status === 'not_started' ? 'Not started' : item.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onOpenPlanner}
                    className="shrink-0 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white"
                  >
                    Start
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1E293B] p-5 flex flex-col">
          <h3 className="text-lg font-semibold text-[#F8FAFC]">Exam pace</h3>
          <div className="text-3xl font-bold text-[#F8FAFC] mt-3">Exam in {examDays} days.</div>
          <p className="text-sm text-[#94A3B8] mt-2 flex-1">
            {EXAM_DATE ? `Target exam ${formatDate(EXAM_DATE)}. Plan daily blocks and mark completion to stay on pace.` : 'Set an official exam date in Settings.'}
          </p>
          <button
            onClick={onOpenPlanner}
            className="mt-4 w-full rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] py-2.5 text-sm font-medium text-white"
          >
            Open my plan
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#1E293B] p-5">
          <h3 className="text-lg font-semibold text-[#F8FAFC] mb-3">Readiness by subject</h3>
          {Object.keys(byPaper).length === 0 ? (
            <p className="text-sm text-[#64748B]">Add chapters in Study to unlock readiness.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(byPaper).map(([name, v]) => {
                const pct = v.total ? Math.round((v.done / v.total) * 100) : 0;
                return (
                  <div key={name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-[#F8FAFC] font-medium">{name}</span>
                      <span className="text-[#94A3B8]">{v.done}/{v.total} chapters</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#334155] overflow-hidden">
                      <div className="h-full rounded-full bg-[#3B82F6] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1E293B] p-5">
          <h3 className="text-lg font-semibold text-[#F8FAFC] mb-1">Syllabus coverage</h3>
          <p className="text-xs text-[#64748B] mb-4">Chapters completed · mocks logged</p>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[#94A3B8]">Chapters done</span>
                <span className="text-[#F8FAFC]">{chapters.filter(c => c.status === 'completed').length}/{chapters.length || 0}</span>
              </div>
              <div className="h-2 rounded-full bg-[#334155] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#22C55E]"
                  style={{ width: `${chapters.length ? (100 * chapters.filter(c => c.status === 'completed').length) / chapters.length : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-[#94A3B8]">Mocks logged</span>
                <span className="text-[#F8FAFC]">{mocks.length}</span>
              </div>
              <div className="h-2 rounded-full bg-[#334155] overflow-hidden">
                <div className="h-full rounded-full bg-[#3B82F6]" style={{ width: `${Math.min(100, mocks.length * 10)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlannerTab({
  calMonth, setCalMonth, calCells, selectedDate, setSelectedDate, blocksByDate, blocksForDate,
  dayView, setDayView, todayPct, todayTarget, todayDone, greenDays, examDays,
  onAdd, onEdit, onDelete, onStatus,
}: {
  calMonth: Date;
  setCalMonth: (d: Date) => void;
  calCells: { dateStr: string; day: number; inMonth: boolean }[];
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  blocksByDate: Record<string, PlanBlock[]>;
  blocksForDate: PlanBlock[];
  dayView: 'list' | 'clock';
  setDayView: (v: 'list' | 'clock') => void;
  todayPct: number;
  todayTarget: number;
  todayDone: number;
  greenDays: number;
  examDays: number;
  onAdd: () => void;
  onEdit: (b: PlanBlock) => void;
  onDelete: (id: string) => void;
  onStatus: (b: PlanBlock, s: 'full' | 'half' | 'none') => void;
}) {
  const monthLabel = calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const remaining = Math.max(0, todayTarget - todayDone);

  return (
    <div className="grid lg:grid-cols-[minmax(260px,340px)_1fr] gap-4">
      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[#1E293B] p-4">
          <div className="flex items-center justify-between mb-1">
            <div>
              <div className="text-sm font-semibold text-[#F8FAFC]">{monthLabel}</div>
              <div className="text-[11px] text-[#64748B]">Exam · {examDays} days</div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
                className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/5"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
                className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/5"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#64748B] mb-1 mt-3">
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map(d => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calCells.map(c => {
              const pct = dayPct(blocksByDate[c.dateStr] || []);
              const selected = c.dateStr === selectedDate;
              const has = (blocksByDate[c.dateStr] || []).length > 0;
              let tone = 'text-[#64748B]';
              if (c.inMonth && has) {
                if (pct >= 90) tone = 'text-[#22C55E]';
                else if (pct >= 50) tone = 'text-[#EAB308]';
                else tone = 'text-[#F97316]';
              } else if (c.inMonth) tone = 'text-[#F8FAFC]';
              return (
                <button
                  key={c.dateStr + String(c.inMonth)}
                  onClick={() => setSelectedDate(c.dateStr)}
                  className={`aspect-square rounded-lg text-xs font-medium flex flex-col items-center justify-center ${
                    selected ? 'ring-2 ring-[#3B82F6] bg-[#3B82F6]/15' : c.inMonth ? 'hover:bg-white/5' : 'opacity-30'
                  } ${tone}`}
                >
                  <span>{c.day}</span>
                  {has && c.inMonth && <span className="text-[9px] opacity-80">{pct}%</span>}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-[#64748B]">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#22C55E]" /> 90%+</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#EAB308]" /> 50–89%</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#F97316]" /> Under 50%</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { v: String(greenDays), l: 'green days' },
            { v: '0', l: 'day streak' },
            { v: '—', l: 'last 14 days' },
          ].map(s => (
            <div key={s.l} className="rounded-xl border border-white/10 bg-[#1E293B] px-2 py-3 text-center">
              <div className="text-lg font-bold text-[#F8FAFC]">{s.v}</div>
              <div className="text-[10px] text-[#64748B]">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#1E293B] p-4 sm:p-5 min-h-[420px]">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <div className="text-xs text-[#64748B]">Selected day</div>
            <div className="text-lg font-semibold text-[#F8FAFC]">
              {new Date(selectedDate + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="text-xs text-[#94A3B8] mt-1">
              Target {formatTime(todayTarget)} · Completed {formatTime(todayDone)}
              <span className="ml-2 text-[#3B82F6] font-medium">{todayPct}%</span>
            </div>
          </div>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] px-3 py-2 text-xs font-medium text-white"
          >
            <Plus size={14} /> Add a block
          </button>
        </div>

        {remaining > 0 && todayTarget > 0 && (
          <div className="mb-3 rounded-xl border border-[#22C55E]/25 bg-[#22C55E]/10 px-3 py-2 text-xs text-[#86EFAC]">
            {formatTime(remaining)} left in this day&apos;s plan.
          </div>
        )}

        <div className="flex gap-1 rounded-xl bg-[#0B1120]/60 p-1 w-fit mb-4">
          {(['list', 'clock'] as const).map(v => (
            <button
              key={v}
              onClick={() => setDayView(v)}
              className={`rounded-lg px-3 py-1 text-xs font-medium capitalize ${
                dayView === v ? 'bg-[#3B82F6] text-white' : 'text-[#94A3B8]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {dayView === 'list' ? (
          blocksForDate.length === 0 ? (
            <div className="py-16 text-center">
              <Calendar size={32} className="mx-auto text-[#334155] mb-2" />
              <p className="text-sm text-[#94A3B8]">No blocks for this day</p>
              <p className="text-xs text-[#64748B] mt-1">Tap “Add a block” to plan topics and target times.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {blocksForDate.map(b => (
                <div key={b.id} className="rounded-xl border border-white/5 bg-[#0B1120]/40 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-[#94A3B8]">
                        {fmtClock(b.start_time)} – {fmtClock(b.end_time)}
                      </div>
                      <div className="text-sm font-medium text-[#F8FAFC] mt-0.5">{b.title}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            background: (PAPER_COLORS[b.paper] || '#3B82F6') + '22',
                            color: PAPER_COLORS[b.paper] || '#3B82F6',
                          }}
                        >
                          {b.paper}
                        </span>
                        <span className="text-xs text-[#64748B]">
                          Target {formatTime(b.target_min)} · Completed {formatTime(b.completed_min)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => onEdit(b)} className="p-1.5 text-[#64748B] hover:text-white"><Edit2 size={14} /></button>
                      <button onClick={() => onDelete(b.id)} className="p-1.5 text-[#64748B] hover:text-[#F97316]"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(['full', 'half', 'none'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => onStatus(b, s)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize border transition-colors ${
                          b.status === s
                            ? s === 'full' ? 'border-[#22C55E]/40 bg-[#22C55E]/15 text-[#22C55E]'
                              : s === 'half' ? 'border-[#EAB308]/40 bg-[#EAB308]/15 text-[#EAB308]'
                              : 'border-white/20 bg-white/5 text-[#94A3B8]'
                            : 'border-white/10 text-[#94A3B8] hover:bg-white/5'
                        }`}
                      >
                        {s === 'full' ? 'Full' : s === 'half' ? 'Half' : 'None'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <ClockView blocks={blocksForDate} pct={todayPct} />
        )}
      </div>
    </div>
  );
}

function ClockView({ blocks, pct }: { blocks: PlanBlock[]; pct: number }) {
  const r = 70;
  const circ = 2 * Math.PI * r;
  const planned = blocks.length ? 100 : 0;
  const done = pct;

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative h-48 w-48">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
          <circle cx="90" cy="90" r={r} fill="none" stroke="#334155" strokeWidth="12" />
          <circle
            cx="90" cy="90" r={r} fill="none" stroke="#475569" strokeWidth="12"
            strokeDasharray={`${(planned / 100) * circ} ${circ}`}
            strokeLinecap="round"
          />
          <circle
            cx="90" cy="90" r={r} fill="none" stroke="#22C55E" strokeWidth="12"
            strokeDasharray={`${(done / 100) * circ} ${circ}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold text-[#F8FAFC]">{pct}%</div>
          <div className="text-xs text-[#64748B]">done</div>
        </div>
      </div>
      <div className="flex gap-4 mt-4 text-[11px] text-[#94A3B8]">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#475569]" /> Planned</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#22C55E]" /> Completed</span>
      </div>
      <p className="text-[11px] text-[#64748B] mt-3 text-center max-w-xs">
        {blocks.length} block{blocks.length === 1 ? '' : 's'} · switch to List to mark Full / Half / None
      </p>
    </div>
  );
}

function HabitsTab({
  calMonth, setCalMonth, calCells, selectedDate, setSelectedDate, blocksByDate,
  logs, sessions, mocks, streak, studiedTodayMin,
}: {
  calMonth: Date;
  setCalMonth: (d: Date) => void;
  calCells: { dateStr: string; day: number; inMonth: boolean }[];
  selectedDate: string;
  setSelectedDate: (d: string) => void;
  blocksByDate: Record<string, PlanBlock[]>;
  logs: DayLog[];
  sessions: FocusSession[];
  mocks: MockScore[];
  streak: number;
  studiedTodayMin: number;
}) {
  const monthLabel = calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const selectedBlocks = blocksByDate[selectedDate] || [];
  const selectedMin =
    selectedBlocks.reduce((s, b) => s + (b.completed_min || 0), 0) +
    logs.filter(l => l.date === selectedDate).reduce((s, l) => s + (l.duration_min || 0), 0) +
    sessions.filter(s => s.completed_at.startsWith(selectedDate)).reduce((s, sess) => s + sess.duration, 0);

  const weekBars = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const ds = toLocalISO(d);
      const mins =
        (blocksByDate[ds] || []).reduce((s, b) => s + (b.completed_min || 0), 0) +
        logs.filter(l => l.date === ds).reduce((s, l) => s + (l.duration_min || 0), 0);
      return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), mins };
    });
  }, [blocksByDate, logs]);

  const bestMock = mocks.length ? Math.max(...mocks.map(m => m.score)) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-[#1E293B] p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-[#F8FAFC]">Study calendar</div>
                <div className="text-[11px] text-[#64748B]">{streak}-day streak</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="p-1 text-[#94A3B8]"><ChevronLeft size={16} /></button>
                <span className="text-xs text-[#F8FAFC] min-w-[100px] text-center">{monthLabel}</span>
                <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="p-1 text-[#94A3B8]"><ChevronRight size={16} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[#64748B] mb-1">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calCells.map(c => {
                const mins =
                  (blocksByDate[c.dateStr] || []).reduce((s, b) => s + (b.completed_min || 0), 0) +
                  logs.filter(l => l.date === c.dateStr).reduce((s, l) => s + (l.duration_min || 0), 0);
                const intensity = mins === 0 ? 0 : mins < 60 ? 1 : mins < 180 ? 2 : 3;
                const bg = ['bg-transparent', 'bg-[#3B82F6]/25', 'bg-[#3B82F6]/50', 'bg-[#3B82F6]'][intensity];
                return (
                  <button
                    key={c.dateStr + String(c.inMonth)}
                    onClick={() => setSelectedDate(c.dateStr)}
                    className={`aspect-square rounded-md text-[11px] ${c.inMonth ? 'text-[#F8FAFC]' : 'text-[#334155]'} ${bg} ${
                      c.dateStr === selectedDate ? 'ring-2 ring-[#3B82F6]' : ''
                    }`}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="lg:w-72 rounded-xl border border-white/5 bg-[#0B1120]/50 p-4">
            <div className="text-xs text-[#64748B]">
              {new Date(selectedDate + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="text-2xl font-bold text-[#F8FAFC] mt-2">{formatTime(selectedMin)}</div>
            <div className="text-xs text-[#94A3B8]">study time tracked</div>
            <div className="mt-3 text-xs text-[#64748B]">
              Plan blocks: {selectedBlocks.length} · {dayPct(selectedBlocks)}% of targets
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[#1E293B] p-5">
          <h3 className="text-sm font-semibold text-[#F8FAFC] mb-3 flex items-center gap-2">
            <BarChart3 size={16} className="text-[#3B82F6]" /> Study time this week
          </h3>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekBars}>
                <XAxis dataKey="day" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                  labelStyle={{ color: '#94A3B8' }}
                  formatter={(v) => [formatTime(Number(v ?? 0)), 'Studied']}
                />
                <Bar dataKey="mins" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1E293B] p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[#F8FAFC] mb-1">Personal bests</h3>
          {[
            { icon: <Flame size={16} className="text-[#F97316]" />, label: 'Longest streak', value: `${streak} day${streak === 1 ? '' : 's'}` },
            { icon: <Zap size={16} className="text-[#EAB308]" />, label: 'Study today', value: formatTime(studiedTodayMin) },
            { icon: <Award size={16} className="text-[#3B82F6]" />, label: 'Best mock score', value: bestMock != null ? String(bestMock) : 'None yet' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#0B1120]/40 px-3 py-2.5">
              {item.icon}
              <div>
                <div className="text-xs text-[#64748B]">{item.label}</div>
                <div className="text-sm font-semibold text-[#F8FAFC]">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BlockModal({
  open, editing, defaultDate, onClose, onSave,
}: {
  open: boolean;
  editing: PlanBlock | null;
  defaultDate: string;
  onClose: () => void;
  onSave: (d: Partial<PlanBlock>) => void;
}) {
  const [title, setTitle] = useState('');
  const [paper, setPaper] = useState('Laws');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [target, setTarget] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(editing?.title || '');
      setPaper(editing?.paper || 'Laws');
      setStart(editing?.start_time || '09:00');
      setEnd(editing?.end_time || '10:00');
      setTarget(editing ? String(editing.target_min) : '');
      setNotes(editing?.notes || '');
    }
  }, [open, editing]);

  const auto = minutesBetween(start, end);
  const targetMin = target !== '' ? Math.max(0, +target || 0) : auto;

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit block' : 'Add a block'}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#94A3B8]">Topic</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. The Limited Liability Partnership Act, 2008"
            className="w-full rounded-xl border border-white/10 bg-[#0B1120] px-3 py-2.5 text-sm text-[#F8FAFC] outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#94A3B8]">Subject</label>
          <div className="flex flex-wrap gap-1.5">
            {['Acc', 'Laws', 'QA', 'Econ'].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPaper(p)}
                className={`rounded-full px-3 py-1 text-xs font-medium border ${
                  paper === p ? 'border-[#3B82F6] bg-[#3B82F6]/20 text-[#3B82F6]' : 'border-white/10 text-[#94A3B8]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#94A3B8]">Start</label>
            <input type="time" value={start} onChange={e => { setStart(e.target.value); setTarget(''); }} className="w-full rounded-xl border border-white/10 bg-[#0B1120] px-3 py-2.5 text-sm text-[#F8FAFC] outline-none focus:border-[#3B82F6]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#94A3B8]">End</label>
            <input type="time" value={end} onChange={e => { setEnd(e.target.value); setTarget(''); }} className="w-full rounded-xl border border-white/10 bg-[#0B1120] px-3 py-2.5 text-sm text-[#F8FAFC] outline-none focus:border-[#3B82F6]" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#94A3B8]">Target (minutes)</label>
          <input
            type="number"
            value={target !== '' ? target : auto}
            onChange={e => setTarget(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#0B1120] px-3 py-2.5 text-sm text-[#F8FAFC] outline-none focus:border-[#3B82F6]"
          />
          <p className="text-[10px] text-[#64748B] mt-1">From times: {formatTime(auto)}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#94A3B8]">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-white/10 bg-[#0B1120] px-3 py-2 text-sm text-[#F8FAFC] outline-none focus:border-[#3B82F6] resize-none" />
        </div>
        <button
          onClick={() => onSave({
            date: editing?.date || defaultDate,
            title, paper, start_time: start, end_time: end, target_min: targetMin, notes,
            completed_min: editing?.completed_min || 0,
            status: editing?.status || '',
          })}
          disabled={!title.trim()}
          className="w-full rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {editing ? 'Save changes' : 'Add block'}
        </button>
      </div>
    </Modal>
  );
}
