import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAll, addRecord, updateRecord, removeRecord } from '../lib/store';
import type { Routine, Chapter, MockScore, Paper } from '../lib/types';
import { todayISO, formatDate, daysUntil } from '../lib/utils';
import {
  REVISION_PLAN, PLAN_START, PLAN_END, EXAM_DATE, PHASE1_END,
  DAILY_FIXED_SLOTS, getPlanDay, type PlanDay
} from '../lib/revisionPlan';
import Modal from './Modal';
import EmptyState from './EmptyState';
import {
  Target, Flame, CheckCircle2, Circle, Plus, Trash2, Edit2, Calendar,
  BookOpen, Award, ChevronLeft, ChevronRight, Download, AlertTriangle
} from 'lucide-react';

const PAPER_COLORS: Record<string, string> = {
  'P1 Accounting': '#3B82F6',
  'P2 Business Laws': '#8B5CF6',
  'P3 Quant Aptitude': '#E07A5F',
  'P4 Business Economics': '#8FBC8F',
  'All Papers': '#E8B86D',
};

interface Props {
  routines: Routine[];
  chapters: Chapter[];
  onRoutinesChanged: () => void;
}

export default function RevisionPlanView({ routines, chapters, onRoutinesChanged }: Props) {
  const { refreshAll } = useApp();
  const [mocks, setMocks] = useState<MockScore[]>([]);
  const [mockModal, setMockModal] = useState(false);
  const [editingMock, setEditingMock] = useState<MockScore | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [filterPhase, setFilterPhase] = useState<'all' | 1 | 2>('all');
  const [selectedDate, setSelectedDate] = useState(todayISO());

  useEffect(() => {
    getAll<MockScore>('mock_scores').then(m => setMocks(m.sort((a, b) => b.date.localeCompare(a.date))));
  }, [routines]);

  const today = todayISO();
  const todayPlan = getPlanDay(today);
  const daysLeft = daysUntil(PLAN_END);
  const examDays = daysUntil(EXAM_DATE);

  const planRoutines = useMemo(
    () => routines.filter(r => r.plan_tag === 'ca-foundation-2026'),
    [routines]
  );
  const seeded = planRoutines.length > 0;

  const completedPlanDays = useMemo(() => {
    const set = new Set<string>();
    for (const r of planRoutines) {
      if (r.date && r.completed_dates?.includes(r.date)) set.add(r.date);
    }
    return set;
  }, [planRoutines]);

  const filteredPlan = useMemo(() => {
    if (filterPhase === 'all') return REVISION_PLAN;
    return REVISION_PLAN.filter(d => d.phase === filterPhase);
  }, [filterPhase]);

  const confStats = useMemo(() => {
    const red = chapters.filter(c => c.confidence === 'red').length;
    const yellow = chapters.filter(c => c.confidence === 'yellow').length;
    const green = chapters.filter(c => c.confidence === 'green').length;
    const p1 = chapters.filter(c => c.phase1_done).length;
    const p2 = chapters.filter(c => c.phase2_done).length;
    const ready = chapters.filter(c => c.phase1_done && c.phase2_done && c.confidence === 'green').length;
    return { red, yellow, green, p1, p2, ready, total: chapters.length };
  }, [chapters]);

  const seedPlan = async () => {
    setSeeding(true);
    setSeedMsg('');
    try {
      // Remove previous plan-tagged routines only
      const existing = await getAll<Routine>('routines');
      for (const r of existing.filter(x => x.plan_tag === 'ca-foundation-2026')) {
        await removeRecord('routines', r.id);
      }

      // One custom routine per plan day
      for (const day of REVISION_PLAN) {
        await addRecord('routines', {
          title: day.title,
          category: 'Study',
          start_time: '13:00',
          end_time: '16:00',
          linked_subject: day.paper,
          repeat_type: 'custom',
          repeat_days: [],
          repeat_exceptions: [],
          repeat_until: null,
          completed_dates: [],
          date: day.date,
          notes: day.focus,
          plan_tag: 'ca-foundation-2026',
          created_at: new Date().toISOString(),
        });
      }

      // Fixed daily slots (only if not already present with same title)
      for (const slot of DAILY_FIXED_SLOTS) {
        const has = existing.some(r => r.title === slot.title && r.repeat_type === 'daily' && r.plan_tag === 'ca-daily-fixed');
        if (!has) {
          await addRecord('routines', {
            title: slot.title,
            category: slot.category,
            start_time: slot.start_time,
            end_time: slot.end_time,
            linked_subject: '',
            repeat_type: 'daily',
            repeat_days: [0, 1, 2, 3, 4, 5, 6],
            repeat_exceptions: [],
            repeat_until: PLAN_END,
            completed_dates: [],
            date: null,
            notes: slot.notes,
            plan_tag: 'ca-daily-fixed',
            created_at: new Date().toISOString(),
          });
        }
      }

      setSeedMsg(`Loaded ${REVISION_PLAN.length} plan days + daily slots`);
      onRoutinesChanged();
      refreshAll();
    } catch (e: any) {
      setSeedMsg('Error: ' + (e?.message || 'failed'));
    } finally {
      setSeeding(false);
    }
  };

  const toggleDayDone = async (date: string) => {
    const r = planRoutines.find(x => x.date === date);
    if (!r) return;
    const dates = r.completed_dates || [];
    const next = dates.includes(date) ? dates.filter(d => d !== date) : [...dates, date];
    await updateRecord('routines', r.id, { completed_dates: next });
    onRoutinesChanged();
    refreshAll();
  };

  const saveMock = async (data: Partial<MockScore>) => {
    const payload = {
      date: data.date || today,
      paper: data.paper || '',
      score: data.score ?? 0,
      max_score: data.max_score ?? 100,
      confident_attempts: data.confident_attempts ?? 0,
      guessed_attempts: data.guessed_attempts ?? 0,
      wrong_guesses: data.wrong_guesses ?? 0,
      notes: data.notes || '',
    };
    if (editingMock) {
      await updateRecord('mock_scores', editingMock.id, payload);
    } else {
      await addRecord('mock_scores', { ...payload, created_at: new Date().toISOString() });
    }
    const m = await getAll<MockScore>('mock_scores');
    setMocks(m.sort((a, b) => b.date.localeCompare(a.date)));
    setMockModal(false);
    setEditingMock(null);
    refreshAll();
  };

  const deleteMock = async (id: string) => {
    await removeRecord('mock_scores', id);
    setMocks(prev => prev.filter(m => m.id !== id));
    refreshAll();
  };

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="y-panel p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Target size={18} className="text-[#E8B86D]" />
              <h2 className="text-base font-bold text-[#F5F0E8]">CA Foundation Plan</h2>
            </div>
            <p className="text-xs text-[#F7F1E7]0">
              Aug 25 → Oct 17 · Target AIR 1 · Exam {formatDate(EXAM_DATE)}
            </p>
          </div>
          <div className="flex gap-2 text-center">
            <div className="rounded-xl bg-zinc-900/60 px-3 py-2 min-w-[64px]">
              <div className="text-lg font-bold text-[#E8B86D]">{Math.max(0, daysLeft)}</div>
              <div className="text-[9px] text-[#F7F1E7]0">days left</div>
            </div>
            <div className="rounded-xl bg-zinc-900/60 px-3 py-2 min-w-[64px]">
              <div className="text-lg font-bold text-[#E07A5F]">{Math.max(0, examDays)}</div>
              <div className="text-[9px] text-[#F7F1E7]0">to exam</div>
            </div>
          </div>
        </div>

        {/* Progress bars */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#F7F1E7]0">Phase 1 days</span>
              <span className="text-[#A8A29A]">{[...completedPlanDays].filter(d => d <= PHASE1_END).length}/{REVISION_PLAN.filter(d => d.phase === 1).length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#2A261F] overflow-hidden">
              <div className="h-full bg-[#E8B86D] rounded-full" style={{
                width: `${(100 * [...completedPlanDays].filter(d => d <= PHASE1_END).length) / Math.max(1, REVISION_PLAN.filter(d => d.phase === 1).length)}%`
              }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-[#F7F1E7]0">Phase 2 days</span>
              <span className="text-[#A8A29A]">{[...completedPlanDays].filter(d => d > PHASE1_END).length}/{REVISION_PLAN.filter(d => d.phase === 2).length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#2A261F] overflow-hidden">
              <div className="h-full bg-[#8FBC8F] rounded-full" style={{
                width: `${(100 * [...completedPlanDays].filter(d => d > PHASE1_END).length) / Math.max(1, REVISION_PLAN.filter(d => d.phase === 2).length)}%`
              }} />
            </div>
          </div>
        </div>

        {/* Confidence summary from Study chapters */}
        {chapters.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
            <span className="rounded-full bg-[#E07A5F]/15 text-[#E07A5F] px-2 py-0.5">🔴 {confStats.red}</span>
            <span className="rounded-full bg-[#E07A5F]/15 text-[#E07A5F] px-2 py-0.5">🟡 {confStats.yellow}</span>
            <span className="rounded-full bg-[#8FBC8F]/15 text-[#8FBC8F] px-2 py-0.5">🟢 {confStats.green}</span>
            <span className="rounded-full bg-[#2A261F] text-[#A8A29A] px-2 py-0.5">P1 {confStats.p1}/{confStats.total}</span>
            <span className="rounded-full bg-[#2A261F] text-[#A8A29A] px-2 py-0.5">P2 {confStats.p2}/{confStats.total}</span>
            <span className="rounded-full bg-[#8FBC8F]/15 text-[#8FBC8F] px-2 py-0.5">Ready {confStats.ready}</span>
          </div>
        )}

        <button
          onClick={seedPlan}
          disabled={seeding}
          className="y-btn y-btn-primary mt-4 w-full disabled:opacity-50"
        >
          <Download size={16} />
          {seeding ? 'Loading…' : seeded ? 'Reload Plan into Calendar' : 'Load Plan into Calendar'}
        </button>
        {seedMsg && <p className="mt-2 text-xs text-center text-[#A8A29A]">{seedMsg}</p>}
        <p className="mt-1.5 text-[10px] text-[#6B6560] text-center">
          Only adds/updates plan-tagged routines. Your other routines stay untouched.
        </p>
      </div>

      {/* Today's focus */}
      {todayPlan && (
        <div className="rounded-2xl border border-[#E8B86D]/30 bg-[#E8B86D]/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flame size={16} className="text-[#E8B86D]" />
            <span className="text-xs font-semibold text-[#E8B86D]">Today · {todayPlan.day}</span>
            <span className="ml-auto text-[10px] rounded-md px-2 py-0.5" style={{
              background: (PAPER_COLORS[todayPlan.paper] || '#71717a') + '25',
              color: PAPER_COLORS[todayPlan.paper] || '#71717a',
            }}>{todayPlan.paper}</span>
          </div>
          <h3 className="text-sm font-semibold text-[#F5F0E8]">{todayPlan.title}</h3>
          <p className="text-xs text-[#A8A29A] mt-1">{todayPlan.focus}</p>
          {todayPlan.isMock && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-[#E07A5F]">
              <AlertTriangle size={12} /> Timed mock day
            </div>
          )}
          <button
            onClick={() => toggleDayDone(today)}
            className={`mt-3 w-full flex items-center justify-center gap-2 rounded-xl border py-2 text-sm font-medium ${
              completedPlanDays.has(today)
                ? 'border-[#8FBC8F] bg-[#8FBC8F]/10 text-[#8FBC8F]'
                : 'border-[rgba(255,236,200,0.1)] text-[#D6CFC4] hover:border-[#E8B86D]'
            }`}
          >
            {completedPlanDays.has(today) ? <><CheckCircle2 size={16} /> Done for today</> : <><Circle size={16} /> Mark day complete</>}
          </button>
        </div>
      )}

      {/* Phase filter */}
      <div className="flex gap-1 rounded-xl border border-[rgba(255,236,200,0.07)] bg-[#1E1B16]/90 p-1 w-fit">
        {(['all', 1, 2] as const).map(p => (
          <button
            key={String(p)}
            onClick={() => setFilterPhase(p)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
              filterPhase === p ? 'bg-[#E8B86D] text-black' : 'text-[#A8A29A]'
            }`}
          >
            {p === 'all' ? 'All days' : `Phase ${p}`}
          </button>
        ))}
      </div>

      {/* Day list */}
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
        {filteredPlan.map(day => {
          const done = completedPlanDays.has(day.date);
          const isToday = day.date === today;
          const color = PAPER_COLORS[day.paper] || '#71717a';
          return (
            <button
              key={day.date}
              onClick={() => toggleDayDone(day.date)}
              className={`w-full text-left flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                isToday
                  ? 'border-[#E8B86D]/40 bg-[#E8B86D]/5'
                  : done
                  ? 'border-[#8FBC8F]/20 bg-[#8FBC8F]/5'
                  : 'border-[rgba(255,236,200,0.07)] bg-black/20'
              }`}
            >
              <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                done ? 'border-[#8FBC8F] bg-[#8FBC8F]' : 'border-[#4A453C]'
              }`}>
                {done && <CheckCircle2 size={12} className="text-black" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-[#F7F1E7]0 font-medium">{day.date.slice(5)} · {day.day}</span>
                  <span className="text-[9px] rounded px-1.5 py-0.5 font-medium" style={{ background: color + '20', color }}>{day.paper}</span>
                  {day.isMock && <span className="text-[9px] rounded bg-[#E07A5F]/15 text-[#E07A5F] px-1.5 py-0.5">MOCK</span>}
                  <span className="text-[9px] text-[#6B6560]">P{day.phase}</span>
                </div>
                <div className={`text-sm font-medium mt-0.5 ${done ? 'text-[#F7F1E7]0 line-through' : 'text-[#EDE6DA]'}`}>{day.title}</div>
                <div className="text-[11px] text-[#F7F1E7]0 mt-0.5 line-clamp-2">{day.focus}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Mock scores */}
      <div className="y-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-[#E8B86D]" />
            <h3 className="text-sm font-semibold text-[#D6CFC4]">Mock Score Log</h3>
          </div>
          <button
            onClick={() => { setEditingMock(null); setMockModal(true); }}
            className="flex items-center gap-1 text-xs text-[#E8B86D] hover:underline"
          >
            <Plus size={14} /> Log mock
          </button>
        </div>
        {mocks.length === 0 ? (
          <p className="text-xs text-[#6B6560] py-2">No mocks logged yet. After each timed mock, record score + confident vs guessed attempts.</p>
        ) : (
          <div className="space-y-2">
            {mocks.map(m => {
              const negCost = (m.wrong_guesses || 0) * 0.25;
              return (
                <div key={m.id} className="rounded-xl border border-[rgba(255,236,200,0.07)] bg-black/25 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-[#EDE6DA]">{m.paper}</div>
                      <div className="text-[10px] text-[#F7F1E7]0">{formatDate(m.date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#E8B86D]">{m.score}<span className="text-xs text-[#8A8478]">/{m.max_score}</span></div>
                      <div className="flex items-center justify-end gap-2 mt-0.5">
                        <button onClick={() => { setEditingMock(m); setMockModal(true); }} className="text-[#8A8478] hover:text-[#D6CFC4]"><Edit2 size={12} /></button>
                        <button onClick={() => deleteMock(m.id)} className="text-[#6B6560] hover:text-[#E07A5F]"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-[#F7F1E7]0">
                    <span>Confident: {m.confident_attempts}</span>
                    <span>Guessed: {m.guessed_attempts}</span>
                    <span>Wrong guesses: {m.wrong_guesses}</span>
                    {m.wrong_guesses > 0 && <span className="text-[#E07A5F]">−{negCost} marks risk</span>}
                  </div>
                  {m.notes && <p className="mt-1 text-[11px] text-[#A8A29A]">{m.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {mockModal && (
        <MockScoreModal
          open={mockModal}
          editing={editingMock}
          onClose={() => { setMockModal(false); setEditingMock(null); }}
          onSave={saveMock}
        />
      )}
    </div>
  );
}

function MockScoreModal({ open, editing, onClose, onSave }: {
  open: boolean;
  editing: MockScore | null;
  onClose: () => void;
  onSave: (d: Partial<MockScore>) => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [paper, setPaper] = useState('Paper 1 Accounting');
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(100);
  const [confident, setConfident] = useState(0);
  const [guessed, setGuessed] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setDate(editing?.date || todayISO());
      setPaper(editing?.paper || 'Paper 1 Accounting');
      setScore(editing?.score ?? 0);
      setMaxScore(editing?.max_score ?? 100);
      setConfident(editing?.confident_attempts ?? 0);
      setGuessed(editing?.guessed_attempts ?? 0);
      setWrong(editing?.wrong_guesses ?? 0);
      setNotes(editing?.notes || '');
    }
  }, [open, editing]);

  const papers = [
    'Paper 1 Accounting',
    'Paper 2 Business Laws',
    'Paper 3 Quant Aptitude',
    'Paper 4 Business Economics',
  ];

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Mock Score' : 'Log Mock Score'}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#A8A29A]">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-3 py-2.5 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#A8A29A]">Paper</label>
          <select value={paper} onChange={e => setPaper(e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-3 py-2.5 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D]">
            {papers.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#A8A29A]">Score</label>
            <input type="number" value={score} onChange={e => setScore(+e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-3 py-2.5 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#A8A29A]">Max</label>
            <input type="number" value={maxScore} onChange={e => setMaxScore(+e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-3 py-2.5 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#A8A29A]">Confident</label>
            <input type="number" value={confident} onChange={e => setConfident(+e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-2 py-2 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#A8A29A]">Guessed</label>
            <input type="number" value={guessed} onChange={e => setGuessed(+e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-2 py-2 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#A8A29A]">Wrong guess</label>
            <input type="number" value={wrong} onChange={e => setWrong(+e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-2 py-2 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[#A8A29A]">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-3 py-2 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D] resize-none" />
        </div>
        <button
          onClick={() => onSave({ date, paper, score, max_score: maxScore, confident_attempts: confident, guessed_attempts: guessed, wrong_guesses: wrong, notes })}
          className="w-full rounded-xl bg-[#E8B86D] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#F0C98A]"
        >
          {editing ? 'Save Changes' : 'Save Mock'}
        </button>
      </div>
    </Modal>
  );
}
