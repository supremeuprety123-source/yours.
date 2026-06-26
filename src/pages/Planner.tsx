import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAll, addRecord, updateRecord, removeRecord } from '../lib/store';
import type { Routine, FocusSession, DiaryEntry, Chapter } from '../lib/types';
import { todayISO, formatTime, formatDate, addDays } from '../lib/utils';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { Plus, Edit2, Trash2, Play, Pause, Square, Timer, Clock, Flame, TrendingUp, Calendar, Check, ChevronLeft, ChevronRight, Target, Milestone, CalendarX, XCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

type ViewMode = 'day' | 'week' | 'month' | 'life';
type TimerMode = 'stopwatch' | 'countdown' | 'pomodoro';

const CATEGORY_COLORS: Record<string, string> = {
  Study: '#C8A96E',
  Health: '#4CAF7D',
  Work: '#3B82F6',
  Personal: '#8B5CF6',
  Break: '#E07B39',
  Other: '#71717a',
};

export default function Planner() {
  const { profile, refreshKey, refreshAll } = useApp();
  const [view, setView] = useState<ViewMode>('day');
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [routineModal, setRoutineModal] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [milestoneModal, setMilestoneModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Routine | null>(null);

  const loadData = async () => {
    const [r, s, d, c] = await Promise.all([
      getAll<Routine>('routines'),
      getAll<FocusSession>('focus_sessions'),
      getAll<DiaryEntry>('diary_entries'),
      getAll<Chapter>('chapters'),
    ]);
    setRoutines(r); setSessions(s); setDiary(d); setChapters(c);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [refreshKey]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C8A96E] border-t-transparent" /></div>;
  }

  const getRoutinesForDate = (date: string) => {
    const dow = new Date(date + 'T00:00').getDay();
    return routines.filter(r => {
      if (r.date === date) return true;
      if (r.repeat_type === 'daily') return !r.repeat_exceptions?.includes(date);
      if (r.repeat_type === 'weekly') return r.repeat_days?.includes(dow) && !r.repeat_exceptions?.includes(date);
      if (r.repeat_type === 'monthly') return new Date(date + 'T00:00').getDate() === 1;
      return false;
    }).sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const todayRoutines = getRoutinesForDate(selectedDate);
  const todayDone = todayRoutines.filter(r => r.completed_dates?.includes(selectedDate));

  const todaySessions = sessions.filter(s => s.completed_at.startsWith(selectedDate));
  const todayFocusMin = todaySessions.reduce((s, sess) => s + sess.duration, 0);
  const focusTarget = profile?.focus_target || 120;
  const routineScore = todayRoutines.length > 0 ? (todayDone.length / todayRoutines.length) * 60 : 0;
  const focusScore = Math.min(todayFocusMin / focusTarget, 1) * 40;
  const productivityScore = Math.round(routineScore + focusScore);

  const weekData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayRoutines = getRoutinesForDate(dateStr);
    const dayDone = dayRoutines.filter(r => r.completed_dates?.includes(dateStr));
    const daySessions = sessions.filter(s => s.completed_at.startsWith(dateStr));
    const dayFocus = daySessions.reduce((s, sess) => s + sess.duration, 0);
    const rScore = dayRoutines.length > 0 ? (dayDone.length / dayRoutines.length) * 60 : 0;
    const fScore = Math.min(dayFocus / focusTarget, 1) * 40;
    return { day: d.toLocaleDateString('en-US', { weekday: 'short' }), score: Math.round(rScore + fScore) };
  });

  const monthData = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayRoutines = getRoutinesForDate(dateStr);
    const dayDone = dayRoutines.filter(r => r.completed_dates?.includes(dateStr));
    const daySessions = sessions.filter(s => s.completed_at.startsWith(dateStr));
    const dayFocus = daySessions.reduce((s, sess) => s + sess.duration, 0);
    const rScore = dayRoutines.length > 0 ? (dayDone.length / dayRoutines.length) * 60 : 0;
    const fScore = Math.min(dayFocus / focusTarget, 1) * 40;
    return { day: `${d.getDate()}`, score: Math.round(rScore + fScore) };
  });

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayRoutines = getRoutinesForDate(dateStr);
    const dayDone = dayRoutines.filter(r => r.completed_dates?.includes(dateStr));
    const daySessions = sessions.filter(s => s.completed_at.startsWith(dateStr));
    if (dayDone.length > 0 || daySessions.length > 0) {
      streak++;
    } else if (i > 0) break;
  }

  const toggleRoutineDone = async (r: Routine) => {
    const dates = r.completed_dates || [];
    const newDates = dates.includes(selectedDate)
      ? dates.filter(d => d !== selectedDate)
      : [...dates, selectedDate];
    await updateRecord('routines', r.id, { completed_dates: newDates });
    loadData();
    refreshAll();
  };

  const handleDelete = async (mode: 'all' | 'today') => {
    if (!deleteTarget) return;
    if (mode === 'today') {
      // Add selectedDate to repeat_exceptions so it's skipped on that day only
      const exceptions = deleteTarget.repeat_exceptions || [];
      if (!exceptions.includes(selectedDate)) {
        await updateRecord('routines', deleteTarget.id, { repeat_exceptions: [...exceptions, selectedDate] });
      }
    } else {
      await removeRecord('routines', deleteTarget.id);
    }
    setDeleteTarget(null);
    loadData();
    refreshAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Planner</h1>
          <p className="text-sm text-zinc-500 mt-1">Productivity: <span className="text-[#C8A96E] font-semibold">{productivityScore}/100</span> · Streak: <span className="text-[#E07B39] font-semibold">{streak} days</span> {streak >= 7 && <Flame size={14} className="inline text-[#E07B39]" />}</p>
        </div>
        <button onClick={() => { setEditingRoutine(null); setRoutineModal(true); }} className="flex items-center gap-2 rounded-xl bg-[#C8A96E] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f]">
          <Plus size={18} /> Add Routine
        </button>
      </div>

      <div className="flex gap-1 rounded-xl border border-zinc-800 bg-[#1A1A1A] p-1 w-fit">
        {(['day','week','month','life'] as ViewMode[]).map(v => (
          <button key={v} onClick={() => setView(v)} className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${view === v ? 'bg-[#C8A96E] text-black' : 'text-zinc-400 hover:text-zinc-200'}`}>{v}</button>
        ))}
      </div>

      {/* Day View */}
      {view === 'day' && (
        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 hover:text-zinc-200"><ChevronLeft size={16} /></button>
              <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="rounded-lg border border-zinc-700 bg-[#0D0D0D] px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-[#C8A96E]" />
              <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="rounded-lg border border-zinc-700 p-1.5 text-zinc-400 hover:text-zinc-200"><ChevronRight size={16} /></button>
              <button onClick={() => setSelectedDate(todayISO())} className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">Today</button>
            </div>
            <span className="text-xs text-zinc-500">{todayRoutines.length} routines · {todayDone.length} done</span>
          </div>
          {todayRoutines.length === 0 ? (
            <EmptyState icon={<Calendar size={36} />} message="No routines for this day. Tap 'Add Routine' to create one." />
          ) : (
            <div className="space-y-1.5">
              {todayRoutines.map(r => {
                const done = r.completed_dates?.includes(selectedDate);
                const color = CATEGORY_COLORS[r.category] || '#71717a';
                return (
                  <div key={r.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${done ? 'border-[#4CAF7D]/30 bg-[#4CAF7D]/5' : 'border-zinc-800 bg-zinc-900/30'}`}>
                    <button onClick={() => toggleRoutineDone(r)} className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${done ? 'border-[#4CAF7D] bg-[#4CAF7D]' : 'border-zinc-600'}`}>
                      {done && <Check size={14} className="text-black" />}
                    </button>
                    <div className="w-1 h-8 rounded-full" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${done ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>{r.title}</div>
                      <div className="text-xs text-zinc-500">{r.start_time}–{r.end_time}{r.linked_subject && ` · ${r.linked_subject}`}</div>
                    </div>
                    <span className="rounded-md px-2 py-0.5 text-[10px] font-medium" style={{ background: `${color}20`, color }}>{r.category}</span>
                    <button onClick={() => { setEditingRoutine(r); setRoutineModal(true); }} className="text-zinc-500 hover:text-zinc-300"><Edit2 size={14} /></button>
                    <button onClick={() => setDeleteTarget(r)} className="text-zinc-500 hover:text-[#C0392B]"><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Week View */}
      {view === 'week' && (
        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-4">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - d.getDay() + i);
              const dateStr = d.toISOString().split('T')[0];
              const dayRoutines = getRoutinesForDate(dateStr);
              const dayDone = dayRoutines.filter(r => r.completed_dates?.includes(dateStr));
              const isToday = dateStr === todayISO();
              return (
                <div key={i} className={`rounded-xl border p-2 min-h-[120px] flex flex-col ${isToday ? 'border-[#C8A96E]/40 bg-[#C8A96E]/5' : 'border-zinc-800 bg-zinc-900/30'}`}>
                  <div className="text-[10px] text-zinc-500 text-center">{d.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className={`text-sm font-semibold text-center mt-0.5 ${isToday ? 'text-[#C8A96E]' : 'text-zinc-300'}`}>{d.getDate()}</div>
                  <div className="mt-1 flex-1 space-y-1 overflow-hidden">
                    {dayRoutines.slice(0, 3).map(r => (
                      <div key={r.id} className="rounded px-1.5 py-0.5 text-[9px] truncate" style={{ background: `${CATEGORY_COLORS[r.category] || '#71717a'}20`, color: CATEGORY_COLORS[r.category] || '#71717a' }}>
                        {r.start_time} {r.title}
                      </div>
                    ))}
                    {dayRoutines.length > 3 && <div className="text-[9px] text-zinc-600">+{dayRoutines.length - 3} more</div>}
                  </div>
                  <div className="text-[10px] text-zinc-500 text-center mt-1">{dayDone.length}/{dayRoutines.length}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Month View — Google Calendar style */}
      {view === 'month' && (
        <GoogleCalendarMonth
          routines={routines}
          getRoutinesForDate={getRoutinesForDate}
          calendarDate={calendarDate}
          setCalendarDate={setCalendarDate}
          selectedDate={selectedDate}
          onSelectDate={(d: string) => { setSelectedDate(d); setView('day'); }}
          onEditRoutine={(r: Routine) => { setEditingRoutine(r); setRoutineModal(true); }}
          onDeleteRoutine={(r: Routine) => setDeleteTarget(r)}
          onAddRoutineForDate={(d: string) => { setEditingRoutine(null); setRoutineModal(true); }}
        />
      )}

      {/* Life View */}
      {view === 'life' && (
        <LifeTimeline 
          routines={routines} 
          onEdit={(r: Routine) => { setEditingMilestone(r); setMilestoneModal(true); }} 
          onDelete={(r: Routine) => setDeleteTarget(r)} 
          onAdd={() => { setEditingMilestone(null); setMilestoneModal(true); }} 
        />
      )}

      {/* Focus Timer + Productivity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FocusTimerWidget profile={profile} chapters={chapters} onSessionComplete={() => { loadData(); refreshAll(); }} />
        <ProductivityWidget weekData={weekData} monthData={monthData} streak={streak} productivityScore={productivityScore} todayDiary={diary.find(d => d.date === selectedDate)} />
      </div>

      {routineModal && (
        <RoutineModal
          open={routineModal}
          editing={editingRoutine}
          chapters={chapters}
          onClose={() => setRoutineModal(false)}
          onSaved={() => { setRoutineModal(false); loadData(); refreshAll(); }}
        />
      )}

      {milestoneModal && (
        <LifeMilestoneModal
          open={milestoneModal}
          editing={editingMilestone}
          onClose={() => setMilestoneModal(false)}
          onSaved={() => { setMilestoneModal(false); loadData(); refreshAll(); }}
        />
      )}

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Routine" maxWidth="max-w-sm">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">Choose how to delete <span className="font-medium text-zinc-200">"{deleteTarget.title}"</span>:</p>
            
            {deleteTarget.repeat_type !== 'custom' && deleteTarget.repeat_type !== 'life' ? (
              <>
                <button
                  onClick={() => handleDelete('today')}
                  className="w-full flex items-start gap-3 rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 hover:border-[#E07B39]/40 hover:bg-[#E07B39]/5 transition-colors text-left"
                >
                  <CalendarX size={20} className="text-[#E07B39] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Delete for this day only</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Removes "{deleteTarget.title}" from {formatDate(selectedDate)} only. All other days keep the routine.</div>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete('all')}
                  className="w-full flex items-start gap-3 rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 hover:border-[#C0392B]/40 hover:bg-[#C0392B]/5 transition-colors text-left"
                >
                  <XCircle size={20} className="text-[#C0392B] mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Delete all occurrences</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Permanently deletes this routine from every day. This cannot be undone.</div>
                  </div>
                </button>
              </>
            ) : (
              <button
                onClick={() => handleDelete('all')}
                className="w-full flex items-start gap-3 rounded-xl border border-[#C0392B]/30 bg-[#C0392B]/5 p-4 hover:bg-[#C0392B]/10 transition-colors text-left"
              >
                <XCircle size={20} className="text-[#C0392B] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium text-zinc-200">Delete permanently</div>
                  <div className="text-xs text-zinc-500 mt-0.5">This is a one-time routine. It will be permanently deleted.</div>
                </div>
              </button>
            )}
            
            <button onClick={() => setDeleteTarget(null)} className="w-full rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800">
              Cancel
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ═══ Google Calendar-style Month View ═══
function GoogleCalendarMonth({ routines, getRoutinesForDate, calendarDate, setCalendarDate, selectedDate, onSelectDate, onEditRoutine, onDeleteRoutine, onAddRoutineForDate }: any) {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const monthName = calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));
  const goToday = () => setCalendarDate(new Date());

  // Build 6 weeks (42 cells) like Google Calendar
  const cells: { day: number; month: 'prev' | 'curr' | 'next'; dateStr: string }[] = [];
  for (let i = 0; i < firstDay; i++) {
    const day = prevMonthDays - firstDay + i + 1;
    const d = new Date(year, month - 1, day);
    cells.push({ day, month: 'prev', dateStr: d.toISOString().split('T')[0] });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    cells.push({ day: i, month: 'curr', dateStr: d.toISOString().split('T')[0] });
  }
  while (cells.length < 42) {
    const day = cells.length - daysInMonth - firstDay + 1;
    const d = new Date(year, month + 1, day);
    cells.push({ day, month: 'next', dateStr: d.toISOString().split('T')[0] });
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-semibold text-zinc-100">{monthName}</h3>
          <button onClick={goToday} className="rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200">Today</button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={prevMonth} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"><ChevronLeft size={18} /></button>
          <button onClick={nextMonth} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-zinc-800/50">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-medium text-zinc-500">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const dayRoutines = getRoutinesForDate(cell.dateStr);
          const isToday = cell.dateStr === todayISO();
          const isSelected = cell.dateStr === selectedDate;
          const isOtherMonth = cell.month !== 'curr';
          return (
            <div
              key={i}
              onClick={() => onSelectDate(cell.dateStr)}
              className={`min-h-[80px] md:min-h-[110px] border-r border-b border-zinc-800/30 p-1 cursor-pointer hover:bg-zinc-800/30 transition-colors ${isOtherMonth ? 'opacity-40' : ''} ${isSelected ? 'bg-[#C8A96E]/5' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${isToday ? 'flex h-5 w-5 items-center justify-center rounded-full bg-[#C8A96E] text-black' : 'text-zinc-400'}`}>{cell.day}</span>
                {dayRoutines.length > 0 && !isOtherMonth && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAddRoutineForDate(cell.dateStr); }}
                    className="opacity-0 hover:opacity-100 group-hover:opacity-100 text-zinc-600 hover:text-[#C8A96E] transition-opacity"
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {dayRoutines.slice(0, 3).map((r: Routine) => {
                  const color = CATEGORY_COLORS[r.category] || '#71717a';
                  const done = r.completed_dates?.includes(cell.dateStr);
                  return (
                    <div
                      key={r.id}
                      onClick={(e) => { e.stopPropagation(); onEditRoutine(r); }}
                      className="flex items-center gap-1 rounded px-1 py-0.5 text-[9px] md:text-[10px] truncate cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ background: `${color}20`, color }}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${done ? 'bg-[#4CAF7D]' : ''}`} style={{ background: done ? '#4CAF7D' : color }} />
                      <span className={`truncate ${done ? 'line-through opacity-60' : ''}`}>{r.start_time} {r.title}</span>
                    </div>
                  );
                })}
                {dayRoutines.length > 3 && (
                  <div className="text-[9px] text-zinc-600 px-1">+{dayRoutines.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══ Life Timeline View ═══
function LifeTimeline({ routines, onEdit, onDelete, onAdd }: { routines: Routine[]; onEdit: (r: Routine) => void; onDelete: (r: Routine) => void; onAdd: () => void }) {
  const lifeRoutines = routines.filter(r => r.repeat_type === 'life');

  // Group by decade
  const decades = [
    { label: 'Teens (13-19)', start: 13, end: 19 },
    { label: 'Twenties (20-29)', start: 20, end: 29 },
    { label: 'Thirties (30-39)', start: 30, end: 39 },
    { label: 'Forties (40-49)', start: 40, end: 49 },
    { label: 'Fifties (50-59)', start: 50, end: 59 },
    { label: 'Sixties (60-69)', start: 60, end: 69 },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Milestone size={18} className="text-[#C8A96E]" />
            <h3 className="text-sm font-semibold text-zinc-300">Life Milestones</h3>
          </div>
          <button onClick={onAdd} className="flex items-center gap-1 text-xs text-[#C8A96E] hover:underline"><Plus size={14} /> Add Milestone</button>
        </div>

        {lifeRoutines.length === 0 ? (
          <EmptyState icon={<Milestone size={36} />} message="No life milestones yet. Map your future — add your first milestone with an age range." />
        ) : (
          <div className="space-y-6">
            {/* Vertical timeline */}
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-zinc-800" />

              {lifeRoutines.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(r => {
                const color = CATEGORY_COLORS[r.category] || '#C8A96E';
                return (
                  <div key={r.id} className="relative mb-4">
                    {/* Dot */}
                    <div className="absolute -left-[18px] top-1 h-3 w-3 rounded-full border-2 border-[#0D0D0D]" style={{ background: color }} />
                    {/* Card */}
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="rounded-md px-2 py-0.5 text-[10px] font-medium" style={{ background: `${color}20`, color }}>{r.category}</span>
                            <span className="text-[10px] text-zinc-500">Age {r.start_time}–{r.end_time}</span>
                          </div>
                          <h4 className="text-sm font-semibold text-zinc-100">{r.title}</h4>
                          {r.linked_subject && <p className="text-xs text-zinc-400 mt-1">{r.linked_subject}</p>}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => onEdit(r)} className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"><Edit2 size={14} /></button>
                          <button onClick={() => onDelete(r)} className="rounded-lg p-1.5 text-zinc-500 hover:text-[#C0392B] hover:bg-zinc-800"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Decade overview */}
      <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Life Decades Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {decades.map(dec => {
            const count = lifeRoutines.filter(r => {
              const start = parseInt(r.start_time) || 0;
              return start >= dec.start && start <= dec.end;
            }).length;
            return (
              <div key={dec.label} className={`rounded-xl border p-3 ${count > 0 ? 'border-[#C8A96E]/30 bg-[#C8A96E]/5' : 'border-zinc-800 bg-zinc-900/30'}`}>
                <div className="text-xs font-medium text-zinc-400">{dec.label}</div>
                <div className="text-lg font-bold text-zinc-100 mt-1">{count} {count === 1 ? 'milestone' : 'milestones'}</div>
                {count > 0 && (
                  <div className="mt-2 flex gap-1">
                    {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
                      <div key={i} className="h-1.5 w-1.5 rounded-full bg-[#C8A96E]" />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FocusTimerWidget({ profile, chapters, onSessionComplete }: { profile: any; chapters: Chapter[]; onSessionComplete: () => void }) {
  const [mode, setMode] = useState<TimerMode>('pomodoro');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [target, setTarget] = useState(profile?.focus_pomodoro || 25);
  const [subject, setSubject] = useState('');
  const [phase, setPhase] = useState<'work' | 'break'>('work');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const defaultTarget = mode === 'pomodoro' ? (profile?.focus_pomodoro || 25) : mode === 'countdown' ? 30 : 0;

  useEffect(() => {
    setTarget(defaultTarget);
    setElapsed(0);
    setRunning(false);
    setPhase('work');
  }, [mode]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => { setElapsed(e => e + 1); }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const displaySeconds = mode === 'stopwatch' ? elapsed : Math.max(0, target * 60 - elapsed);
  const progress = mode === 'stopwatch' ? 0 : (elapsed / (target * 60)) * 100;

  useEffect(() => {
    if (mode !== 'stopwatch' && running && elapsed >= target * 60) {
      completeSession();
    }
  }, [elapsed, running, mode, target]);

  const completeSession = useCallback(async () => {
    setRunning(false);
    const minutes = mode === 'stopwatch' ? Math.round(elapsed / 60) : target;
    await addRecord('focus_sessions', { type: mode, duration: minutes, subject, completed_at: new Date().toISOString() });

    if (subject) {
      const chapter = chapters.find(c => c.name === subject);
      if (chapter) {
        await updateRecord('chapters', chapter.id, {
          time_spent: chapter.time_spent + minutes,
          last_revised: new Date().toISOString(),
          revision_count: chapter.revision_count + 1,
        });
        await addRecord('revision_history', { chapter_id: chapter.id, revised_at: new Date().toISOString() });
      }
    }

    if (mode === 'pomodoro' && phase === 'work') {
      setPhase('break');
      setTarget(profile?.focus_short_break || 5);
      setElapsed(0);
    } else if (mode === 'pomodoro' && phase === 'break') {
      setPhase('work');
      setTarget(profile?.focus_pomodoro || 25);
      setElapsed(0);
    }
    onSessionComplete();
  }, [mode, elapsed, target, subject, chapters, phase, profile, onSessionComplete]);

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    setPhase('work');
    setTarget(mode === 'pomodoro' ? (profile?.focus_pomodoro || 25) : mode === 'countdown' ? 30 : 0);
  };

  const mins = Math.floor(displaySeconds / 60);
  const secs = displaySeconds % 60;

  const ringSize = 140;
  const ringStroke = 8;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (progress / 100) * ringCirc;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Focus Timer</h3>
      <div className="flex gap-1 rounded-xl border border-zinc-800 p-1 mb-4">
        {([['pomodoro', Timer], ['countdown', Clock], ['stopwatch', Clock]] as [TimerMode, any][]).map(([m, Icon]) => (
          <button key={m} onClick={() => setMode(m)} className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium capitalize transition-colors ${mode === m ? 'bg-[#C8A96E] text-black' : 'text-zinc-400'}`}>
            <Icon size={14} /> {m}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="relative" style={{ width: ringSize, height: ringSize }}>
          {mode !== 'stopwatch' && (
            <svg width={ringSize} height={ringSize} className="-rotate-90">
              <circle cx={ringSize/2} cy={ringSize/2} r={ringRadius} fill="none" stroke="#27272a" strokeWidth={ringStroke} />
              <circle cx={ringSize/2} cy={ringSize/2} r={ringRadius} fill="none" stroke={phase === 'break' ? '#4CAF7D' : '#C8A96E'} strokeWidth={ringStroke} strokeDasharray={ringCirc} strokeDashoffset={ringOffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s linear' }} />
            </svg>
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-zinc-100 tabular-nums">{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}</span>
            <span className="text-[10px] text-zinc-500 mt-1">{phase === 'break' ? 'break' : mode}</span>
          </div>
        </div>

        {mode === 'countdown' && !running && (
          <div className="flex items-center gap-2">
            <button onClick={() => setTarget(Math.max(1, target - 5))} className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300">-5</button>
            <span className="text-sm text-zinc-400">{target} min</span>
            <button onClick={() => setTarget(target + 5)} className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300">+5</button>
          </div>
        )}

        <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full max-w-xs rounded-xl border border-zinc-700 bg-[#0D0D0D] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#C8A96E]">
          <option value="">No subject linked</option>
          {chapters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>

        <div className="flex gap-2">
          <button onClick={() => setRunning(!running)} className="flex items-center gap-2 rounded-xl bg-[#C8A96E] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f]">
            {running ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Start</>}
          </button>
          <button onClick={reset} className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800">
            <Square size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductivityWidget({ weekData, monthData, streak, productivityScore, todayDiary }: any) {
  const insights: string[] = [];
  const avgScore = Math.round(weekData.reduce((s: number, d: any) => s + d.score, 0) / 7);
  if (avgScore >= 80) insights.push("Excellent week! You're on fire. 🔥");
  else if (avgScore >= 50) insights.push("Good progress. Keep the momentum going.");
  else insights.push("Let's step it up — small wins compound.");
  if (streak >= 7) insights.push(`${streak}-day streak! The flame burns bright.`);
  if (todayDiary) insights.push(`Diary mood: ${['😢','😕','😐','🙂','😊'][todayDiary.mood-1]}, rating ${todayDiary.performance_rating}/5`);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Productivity</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-[#C8A96E]">{productivityScore}</div>
          <div className="text-[10px] text-zinc-500">Today</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-[#4CAF7D]">{avgScore}</div>
          <div className="text-[10px] text-zinc-500">Week Avg</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-[#E07B39] flex items-center justify-center gap-1">{streak}{streak >= 7 && <Flame size={16} />}</div>
          <div className="text-[10px] text-zinc-500">Streak</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs text-zinc-500 mb-2">Weekly Score</div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={weekData}>
            <XAxis dataKey="day" tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="score" fill="#C8A96E" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-4">
        <div className="text-xs text-zinc-500 mb-2">Monthly Trend</div>
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={monthData}>
            <XAxis dataKey="day" tick={{ fill: '#52525b', fontSize: 9 }} axisLine={false} tickLine={false} interval={5} />
            <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="score" stroke="#4CAF7D" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-1.5">
        {insights.map((tip, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg bg-zinc-900/50 px-3 py-2 text-xs text-zinc-400">
            <TrendingUp size={14} className="text-[#C8A96E] mt-0.5 flex-shrink-0" />
            {tip}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoutineModal({ open, editing, chapters, onClose, onSaved }: any) {
  const [title, setTitle] = useState(editing?.title || '');
  const [category, setCategory] = useState(editing?.category || 'Study');
  const [startTime, setStartTime] = useState(editing?.start_time || '08:00');
  const [endTime, setEndTime] = useState(editing?.end_time || '09:00');
  const [linkedSubject, setLinkedSubject] = useState(editing?.linked_subject || '');
  const [repeatType, setRepeatType] = useState(editing?.repeat_type || 'daily');
  const [repeatDays, setRepeatDays] = useState<number[]>(editing?.repeat_days || [0,1,2,3,4,5,6]);
  const [repeatUntil, setRepeatUntil] = useState(editing?.repeat_until || '');
  const [date, setDate] = useState(editing?.date || todayISO());

  useEffect(() => {
    if (open) {
      setTitle(editing?.title || '');
      setCategory(editing?.category || 'Study');
      setStartTime(editing?.start_time || '08:00');
      setEndTime(editing?.end_time || '09:00');
      setLinkedSubject(editing?.linked_subject || '');
      setRepeatType(editing?.repeat_type || 'daily');
      setRepeatDays(editing?.repeat_days || [0,1,2,3,4,5,6]);
      setRepeatUntil(editing?.repeat_until || '');
      setDate(editing?.date || todayISO());
    }
  }, [open, editing]);

  const save = async () => {
    if (!title.trim()) return;
    const data: any = {
      title: title.trim(),
      category,
      start_time: startTime,
      end_time: endTime,
      linked_subject: linkedSubject,
      repeat_type: repeatType,
      repeat_days: repeatDays,
      repeat_exceptions: editing?.repeat_exceptions || [],
      repeat_until: repeatUntil || null,
      completed_dates: editing?.completed_dates || [],
      date: repeatType === 'custom' ? date : null,
    };
    if (editing) {
      await updateRecord('routines', editing.id, data);
    } else {
      await addRecord('routines', { ...data, created_at: new Date().toISOString() });
    }
    onSaved();
  };

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const categories = ['Study','Health','Work','Personal','Break','Other'];

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Routine' : 'Add Routine'}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Morning Study Session" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${category === c ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]' : 'border-zinc-700 text-zinc-400'}`}>{c}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Start Time</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">End Time</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Linked Subject (optional)</label>
          <select value={linkedSubject} onChange={e => setLinkedSubject(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-3 py-2.5 text-zinc-200 outline-none focus:border-[#C8A96E]">
            <option value="">None</option>
            {chapters.map((c: Chapter) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Repeat</label>
          <div className="grid grid-cols-5 gap-2">
            {(['daily','weekly','monthly','custom','life'] as const).map(r => (
              <button key={r} onClick={() => setRepeatType(r)} className={`rounded-lg border px-2 py-1.5 text-xs font-medium capitalize ${repeatType === r ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]' : 'border-zinc-700 text-zinc-400'}`}>{r}</button>
            ))}
          </div>
        </div>
        {repeatType === 'daily' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Repeat On</label>
            <div className="flex gap-1.5">
              {days.map((d, i) => (
                <button key={d} onClick={() => setRepeatDays(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])} className={`h-8 w-8 rounded-lg text-xs font-medium ${repeatDays.includes(i) ? 'bg-[#C8A96E] text-black' : 'bg-zinc-800 text-zinc-500'}`}>{d[0]}</button>
              ))}
            </div>
          </div>
        )}
        {repeatType === 'custom' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
        )}
        {repeatType === 'life' && (
          <p className="text-xs text-zinc-500 rounded-lg bg-zinc-900/50 p-3">Life milestones appear in the Life view as a readable timeline. Use start/end time as age range (e.g. 20-25).</p>
        )}
        {repeatType !== 'life' && repeatType !== 'custom' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Repeat Until (optional)</label>
            <input type="date" value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
        )}
        <button onClick={save} disabled={!title.trim()} className="w-full rounded-xl bg-[#C8A96E] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f] disabled:opacity-40">{editing ? 'Save Changes' : 'Add Routine'}</button>
      </div>
    </Modal>
  );
}

// ═══ Life Milestone Modal ═══
function LifeMilestoneModal({ open, editing, onClose, onSaved }: { open: boolean; editing: Routine | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(editing?.title || '');
  const [category, setCategory] = useState(editing?.category || 'Personal');
  const [startAge, setStartAge] = useState(editing?.start_time || '');
  const [endAge, setEndAge] = useState(editing?.end_time || '');
  const [description, setDescription] = useState(editing?.linked_subject || '');

  useEffect(() => {
    if (open) {
      setTitle(editing?.title || '');
      setCategory(editing?.category || 'Personal');
      setStartAge(editing?.start_time || '');
      setEndAge(editing?.end_time || '');
      setDescription(editing?.linked_subject || '');
    }
  }, [open, editing]);

  const categories = ['Study','Career','Health','Personal','Finance','Family','Travel','Other'];

  const save = async () => {
    if (!title.trim()) return;
    const data: any = {
      title: title.trim(),
      category,
      start_time: String(startAge),
      end_time: String(endAge),
      linked_subject: description.trim(),
      repeat_type: 'life',
      repeat_days: [],
      repeat_exceptions: [],
      repeat_until: null,
      completed_dates: editing?.completed_dates || [],
      date: null,
    };
    if (editing) {
      await updateRecord('routines', editing.id, data);
    } else {
      await addRecord('routines', { ...data, created_at: new Date().toISOString() });
    }
    onSaved();
  };

  // Preset age ranges
  const presets = [
    { label: 'Teens', start: 13, end: 19 },
    { label: 'Early 20s', start: 20, end: 24 },
    { label: 'Mid 20s', start: 25, end: 29 },
    { label: '30s', start: 30, end: 39 },
    { label: '40s', start: 40, end: 49 },
    { label: '50s+', start: 50, end: 60 },
  ];

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Milestone' : 'Add Life Milestone'}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Milestone Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Become a Chartered Accountant" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${category === c ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]' : 'border-zinc-700 text-zinc-400'}`}>{c}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Age Range</label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input type="number" min={0} max={100} value={startAge} onChange={e => setStartAge(e.target.value)} placeholder="From" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
              <span className="text-[10px] text-zinc-500 mt-1 block">Start age</span>
            </div>
            <span className="text-zinc-500 pt-2.5">→</span>
            <div className="flex-1">
              <input type="number" min={0} max={100} value={endAge} onChange={e => setEndAge(e.target.value)} placeholder="To" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
              <span className="text-[10px] text-zinc-500 mt-1 block">End age</span>
            </div>
          </div>
          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => { setStartAge(String(p.start)); setEndAge(String(p.end)); }}
                className="rounded-lg bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
              >
                {p.label} ({p.start}-{p.end})
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Description (optional)</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What does this milestone mean to you?" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-[#C8A96E] resize-none" />
        </div>

        <button onClick={save} disabled={!title.trim()} className="w-full rounded-xl bg-[#C8A96E] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f] disabled:opacity-40">
          {editing ? 'Save Changes' : 'Add Milestone'}
        </button>
      </div>
    </Modal>
  );
}
