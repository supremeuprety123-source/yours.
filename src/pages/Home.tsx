import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAll } from '../lib/store';
import type { Paper, Chapter, Routine, Transaction, Exam, FocusSession, DiaryEntry } from '../lib/types';
import { chapterProgressScore, paperProgressScore, levelProgressScore, getGreeting, getCurriculumTree, formatCurrency, daysUntil, formatTime, todayISO } from '../lib/utils';
import { CheckCircle2, Lock, Circle, Flame, Clock, TrendingUp, Calendar, BookOpen, Target, Award } from 'lucide-react';

export default function Home() {
  const { profile, refreshKey } = useApp();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, c, r, t, e, s, d] = await Promise.all([
        getAll<Paper>('papers'),
        getAll<Chapter>('chapters'),
        getAll<Routine>('routines'),
        getAll<Transaction>('transactions'),
        getAll<Exam>('exams'),
        getAll<FocusSession>('focus_sessions'),
        getAll<DiaryEntry>('diary_entries'),
      ]);
      setPapers(p); setChapters(c); setRoutines(r); setTransactions(t);
      setExams(e); setSessions(s); setDiary(d);
      setLoading(false);
    })();
  }, [refreshKey]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C8A96E] border-t-transparent" /></div>;
  }

  const levelPapers = papers.filter(p => p.level === profile?.ca_level);
  const levelScore = levelProgressScore(levelPapers, chapters);
  const totalChapters = chapters.length;
  const completedChapters = chapters.filter(c => c.status === 'completed').length;
  const totalRevisions = chapters.reduce((s, c) => s + c.revision_count, 0);

  const today = todayISO();
  const dayOfWeek = new Date().getDay();
  const todayRoutines = routines.filter(r => {
    if (r.date === today) return true;
    if (r.repeat_type === 'daily') return !r.repeat_exceptions?.includes(today);
    if (r.repeat_type === 'weekly') return r.repeat_days?.includes(dayOfWeek) && !r.repeat_exceptions?.includes(today);
    return false;
  }).sort((a, b) => a.start_time.localeCompare(b.start_time));

  const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const upcomingExams = exams.filter(e => daysUntil(e.date) >= 0).sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
  const nextExam = upcomingExams[0];
  const pastExamsWithResults = exams.filter(e => e.marks_total > 0).sort((a, b) => b.date.localeCompare(a.date));

  const todaySessions = sessions.filter(s => s.completed_at.startsWith(today));
  const todayFocusMin = todaySessions.reduce((s, sess) => s + sess.duration, 0);
  const todayDiary = diary.find(d => d.date === today);

  const curriculum = getCurriculumTree(profile?.ca_level || 'Foundation');

  const ringSize = 120;
  const ringStroke = 10;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (levelScore / 100) * ringCirc;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">
          {getGreeting()}, {profile?.name} 👋
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          ICAI CA {profile?.ca_level} · {levelPapers.length} papers · {totalChapters} chapters
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5 flex flex-col items-center justify-center">
          <div className="relative" style={{ width: ringSize, height: ringSize }}>
            <svg width={ringSize} height={ringSize} className="-rotate-90">
              <circle cx={ringSize/2} cy={ringSize/2} r={ringRadius} fill="none" stroke="#27272a" strokeWidth={ringStroke} />
              <circle cx={ringSize/2} cy={ringSize/2} r={ringRadius} fill="none" stroke="#C8A96E" strokeWidth={ringStroke} strokeDasharray={ringCirc} strokeDashoffset={ringOffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[#C8A96E]">{levelScore}</span>
              <span className="text-[10px] text-zinc-500">progress</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-zinc-400">Study Progress · ICAI CA {profile?.ca_level}</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5 grid grid-cols-3 gap-3">
          <StatBox icon={<BookOpen size={16} />} value={`${completedChapters}/${totalChapters}`} label="Chapters" color="#C8A96E" />
          <StatBox icon={<Target size={16} />} value={totalRevisions} label="Revisions" color="#4CAF7D" />
          <StatBox icon={<Clock size={16} />} value={formatTime(chapters.reduce((s,c)=>s+c.time_spent,0))} label="Hours" color="#E07B39" />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 text-zinc-400">
            <Calendar size={16} className="text-[#C8A96E]" />
            <span className="text-xs font-medium">Next Exam</span>
          </div>
          {nextExam ? (
            <div className="mt-2">
              <div className="text-3xl font-bold text-[#C8A96E]">{daysUntil(nextExam.date)}</div>
              <div className="text-xs text-zinc-500">days to {nextExam.name}</div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">No exams scheduled</p>
          )}
        </div>
      </div>

      {/* Exam Results */}
      {pastExamsWithResults.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-[#C8A96E]" />
            <h3 className="text-sm font-semibold text-zinc-300">Exam Results</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pastExamsWithResults.map(ex => {
              const pct = ex.marks_total > 0 ? Math.round((ex.marks_obtained / ex.marks_total) * 100) : 0;
              return (
                <div key={ex.id} className="rounded-xl bg-zinc-900/50 p-3">
                  <div className="text-sm font-medium text-zinc-200 truncate">{ex.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-zinc-500">{ex.marks_obtained}/{ex.marks_total}</span>
                    <span className={`text-sm font-bold ${pct >= 40 ? 'text-[#4CAF7D]' : 'text-[#C0392B]'}`}>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 40 ? 'bg-[#4CAF7D]' : 'bg-[#C0392B]'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Curriculum Tree */}
      <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">ICAI CA Curriculum Path</h3>
        <div className="flex flex-wrap items-center gap-2">
          {curriculum.map((node, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                  node.status === 'completed'
                    ? 'border-[#4CAF7D]/40 bg-[#4CAF7D]/10 text-[#4CAF7D]'
                    : node.status === 'current'
                    ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-600'
                }`}
                style={node.status === 'current' ? { boxShadow: '0 0 12px rgba(200,169,110,0.3)' } : {}}
              >
                {node.status === 'completed' && <CheckCircle2 size={14} />}
                {node.status === 'locked' && <Lock size={14} />}
                {node.status === 'current' && <Circle size={14} className="fill-[#C8A96E]" />}
                {node.label}
              </div>
              {i < curriculum.length - 1 && <div className="text-zinc-700">→</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Today's Routines</h3>
          {todayRoutines.length === 0 ? (
            <p className="text-sm text-zinc-600 py-4">No routines scheduled for today.</p>
          ) : (
            <div className="space-y-2">
              {todayRoutines.slice(0, 5).map(r => {
                const done = r.completed_dates?.includes(today);
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg bg-zinc-900/50 px-3 py-2">
                    <div className={`h-2 w-2 rounded-full ${done ? 'bg-[#4CAF7D]' : 'bg-zinc-600'}`} />
                    <span className={`text-sm flex-1 ${done ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>{r.title}</span>
                    <span className="text-xs text-zinc-500">{r.start_time}</span>
                  </div>
                );
              })}
              {todayRoutines.length > 5 && <p className="text-xs text-zinc-500 pt-1">+{todayRoutines.length - 5} more</p>}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Finance Snapshot</h3>
          <div className="text-3xl font-bold text-zinc-100">{formatCurrency(balance, profile?.currency_symbol || 'रू')}</div>
          <p className="text-xs text-zinc-500 mt-1">Current Balance</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[#4CAF7D]/10 px-3 py-2">
              <div className="text-xs text-[#4CAF7D]">Income</div>
              <div className="text-sm font-semibold text-zinc-200">{formatCurrency(income, profile?.currency_symbol || 'रू')}</div>
            </div>
            <div className="rounded-lg bg-[#C0392B]/10 px-3 py-2">
              <div className="text-xs text-[#C0392B]">Expense</div>
              <div className="text-sm font-semibold text-zinc-200">{formatCurrency(expense, profile?.currency_symbol || 'रू')}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={<Clock size={16} />} label="Focus Today" value={formatTime(todayFocusMin)} color="#E07B39" />
        <MiniStat icon={<Flame size={16} />} label="Diary Mood" value={todayDiary ? ['😢','😕','😐','🙂','😊'][todayDiary.mood-1] : '—'} color="#C8A96E" />
        <MiniStat icon={<TrendingUp size={16} />} label="Diary Rating" value={todayDiary ? `${todayDiary.performance_rating}/5` : '—'} color="#4CAF7D" />
        <MiniStat icon={<BookOpen size={16} />} label="Papers" value={papers.length} color="#C8A96E" />
      </div>
    </div>
  );
}

function StatBox({ icon, value, label, color }: { icon: React.ReactNode; value: React.ReactNode; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-1" style={{ color }}>{icon}</div>
      <div className="text-sm font-bold text-zinc-100">{value}</div>
      <div className="text-[10px] text-zinc-500">{label}</div>
    </div>
  );
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#1A1A1A] p-3">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] text-zinc-500">{label}</span>
      </div>
      <div className="text-lg font-bold text-zinc-100">{value}</div>
    </div>
  );
}
