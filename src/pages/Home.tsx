import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAll } from '../lib/store';
import type { Paper, Chapter, Routine, Transaction, Exam, MockScore, FocusSession, DiaryEntry, Lesson } from '../lib/types';
import { chapterProgressScore, paperProgressScore, levelProgressScore, getGreeting, getCurriculumTree, formatCurrency, daysUntil, formatTime, todayISO } from '../lib/utils';
import { CheckCircle2, Lock, Circle, Flame, Clock, TrendingUp, Calendar, BookOpen, Target, Award, FileText } from 'lucide-react';

const LEVELS: ('Foundation' | 'Intermediate' | 'Final')[] = ['Foundation', 'Intermediate', 'Final'];

export default function Home() {
  const { profile, refreshKey } = useApp();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [mocks, setMocks] = useState<MockScore[]>([]);
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [diary, setDiary] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [p, c, l, r, t, e, s, d, m] = await Promise.all([
        getAll<Paper>('papers'),
        getAll<Chapter>('chapters'),
        getAll<Lesson>('lessons'),
        getAll<Routine>('routines'),
        getAll<Transaction>('transactions'),
        getAll<Exam>('exams'),
        getAll<FocusSession>('focus_sessions'),
        getAll<DiaryEntry>('diary_entries'),
        getAll<MockScore>('mock_scores'),
      ]);
      setPapers(p); setChapters(c); setLessons(l); setRoutines(r); setTransactions(t);
      setExams(e); setSessions(s); setDiary(d); setMocks(m.sort((a, b) => b.date.localeCompare(a.date)));
      setLoading(false);
    })();
  }, [refreshKey]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8B86D] border-t-transparent" /></div>;
  }

  const currentLevel = profile?.ca_level || 'Foundation';
  const currentLevelIdx = LEVELS.indexOf(currentLevel);

  // Current level stats
  const levelPapers = papers.filter(p => p.level === currentLevel);
  const levelChapters = chapters.filter(c => levelPapers.some(p => p.id === c.paper_id));
  const levelLessons = lessons.filter(l => levelChapters.some(c => c.id === l.chapter_id));
  const levelScore = levelProgressScore(levelPapers, chapters);
  const completedChapters = levelChapters.filter(c => c.status === 'completed').length;
  const inProgressChapters = levelChapters.filter(c => c.status === 'in_progress').length;
  const completedLessons = levelLessons.filter(l => l.completion >= 100).length;
  const totalRevisions = levelChapters.reduce((s, c) => s + c.revision_count, 0);
  const totalTime = levelChapters.reduce((s, c) => s + c.time_spent, 0) + levelLessons.reduce((s, l) => s + l.time_spent, 0);

  // Check if current level is "complete" (all chapters completed, or score >= 80)
  const isLevelComplete = levelChapters.length > 0 && levelChapters.every(c => c.status === 'completed');

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

  const upcomingExams = exams.filter(ex => daysUntil(ex.date) >= 0).sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
  const nextExam = upcomingExams[0];
  const examDaysLeft = nextExam ? daysUntil(nextExam.date) : null;
  const examLabel = nextExam ? nextExam.name : 'No exam date';
  const examDateLabel = nextExam ? nextExam.date : null;
  const recentMocks = mocks.slice(0, 6);

  const todaySessions = sessions.filter(s => s.completed_at.startsWith(today));
  const todayFocusMin = todaySessions.reduce((s, sess) => s + sess.duration, 0);
  const todayDiary = diary.find(d => d.date === today);

  const curriculum = getCurriculumTree(currentLevel);

  const ringSize = 120;
  const ringStroke = 10;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (levelScore / 100) * ringCirc;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="y-page-title">
          {getGreeting()}, {profile?.name} 👋
        </h1>
        <p className="text-sm text-[#F7F1E7]0 mt-1">
          ICAI CA {currentLevel} · {levelPapers.length} papers · {levelChapters.length} chapters · {levelLessons.length} lessons
        </p>
      </div>

      {/* Current Level Progress Overview */}
      <div className="y-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-[#E8B86D]" />
            <h3 className="text-sm font-semibold text-[#EDE6DA]">CA {currentLevel} — Current Level Progress</h3>
          </div>
          {isLevelComplete && (
            <span className="rounded-full bg-[#8FBC8F]/10 px-3 py-1 text-xs font-medium text-[#8FBC8F] flex items-center gap-1">
              <CheckCircle2 size={12} /> Ready to advance
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Progress Ring */}
          <div className="flex flex-col items-center justify-center rounded-xl bg-black/25 p-4">
            <div className="relative" style={{ width: ringSize, height: ringSize }}>
              <svg width={ringSize} height={ringSize} className="-rotate-90">
                <circle cx={ringSize/2} cy={ringSize/2} r={ringRadius} fill="none" stroke="#27272a" strokeWidth={ringStroke} />
                <circle cx={ringSize/2} cy={ringSize/2} r={ringRadius} fill="none" stroke="#E8B86D" strokeWidth={ringStroke} strokeDasharray={ringCirc} strokeDashoffset={ringOffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-[#E8B86D]">{levelScore}</span>
                <span className="text-[10px] text-[#F7F1E7]0">progress</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-[#F7F1E7]0">Overall Score</p>
          </div>

          {/* Papers & Chapters */}
          <div className="rounded-xl bg-black/25 p-4 space-y-3">
            <LevelStat icon={<BookOpen size={14} />} label="Papers" value={levelPapers.length} color="#E8B86D" />
            <LevelStat icon={<FileText size={14} />} label="Chapters" value={`${completedChapters}/${levelChapters.length}`} sub={`${inProgressChapters} in progress`} color="#E07A5F" />
            <LevelStat icon={<CheckCircle2 size={14} />} label="Lessons Done" value={`${completedLessons}/${levelLessons.length}`} color="#8FBC8F" />
          </div>

          {/* Time & Revisions */}
          <div className="rounded-xl bg-black/25 p-4 space-y-3">
            <LevelStat icon={<Clock size={14} />} label="Total Study Time" value={formatTime(totalTime)} color="#E07A5F" />
            <LevelStat icon={<Target size={14} />} label="Total Revisions" value={totalRevisions} color="#8FBC8F" />
            <LevelStat icon={<Award size={14} />} label="Avg Chapter Score" value={`${levelChapters.length > 0 ? Math.round(levelChapters.reduce((s, c) => s + chapterProgressScore(c), 0) / levelChapters.length) : 0}%`} color="#E8B86D" />
          </div>

          {/* Next Exam */}
          <div className="rounded-xl bg-black/25 p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-[#A8A29A]">
              <Calendar size={14} className="text-[#E8B86D]" />
              <span className="text-xs font-medium">Next Exam</span>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-bold text-[#E8B86D]">{examDaysLeft != null ? Math.max(0, examDaysLeft) : '—'}</div>
              <div className="text-xs text-[#8A8478]">{examDaysLeft != null ? `days to ${examLabel}` : 'Add exam in Settings'}</div>
              <div className="text-[10px] text-[#6B6560] mt-0.5">{examDateLabel || 'No date set'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mock results — shared with Settings + Planner */}
      {recentMocks.length > 0 && (
        <div className="y-panel p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-[#E8B86D]" />
            <h3 className="text-sm font-semibold text-[#D6CFC4]">Recent Mocks</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentMocks.map(m => {
              const pct = m.max_score > 0 ? Math.round((m.score / m.max_score) * 100) : 0;
              const neg = (m.wrong_guesses || 0) * 0.25;
              return (
                <div key={m.id} className="rounded-xl bg-black/25 p-3">
                  <div className="text-sm font-medium text-[#EDE6DA] truncate">{m.paper}</div>
                  <div className="text-[10px] text-[#8A8478] mt-0.5">{m.date}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-[#8A8478]">{m.score}/{m.max_score}</span>
                    <span className={`text-sm font-bold ${pct >= 70 ? 'text-[#8FBC8F]' : pct >= 40 ? 'text-[#E8B86D]' : 'text-[#E07A5F]'}`}>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-[#2A261F] overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 70 ? 'bg-[#8FBC8F]' : pct >= 40 ? 'bg-[#E8B86D]' : 'bg-[#E07A5F]'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  {neg > 0 && <div className="mt-1 text-[10px] text-[#E07A5F]">−{neg} from wrong guesses</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Curriculum Tree — with lock/unlock logic */}
      <div className="y-panel p-5">
        <h3 className="text-sm font-semibold text-[#D6CFC4] mb-1">ICAI CA Curriculum Path</h3>
        <p className="text-xs text-[#F7F1E7]0 mb-4">
          {isLevelComplete
            ? `✅ CA ${currentLevel} complete! Go to Settings to advance to the next level.`
            : `Complete all chapters in CA ${currentLevel} to unlock the next level.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {curriculum.map((node, i) => {
            const nodeLevelIdx = LEVELS.indexOf(node.level);
            const isLocked = nodeLevelIdx > currentLevelIdx;
            const isCompleted = nodeLevelIdx < currentLevelIdx;
            const isCurrent = nodeLevelIdx === currentLevelIdx;
            // Check if this specific node can be unlocked
            const canUnlock = isCurrent && isLevelComplete && nodeLevelIdx === currentLevelIdx;
            return (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
                    isCompleted
                      ? 'border-[#8FBC8F]/40 bg-[#8FBC8F]/10 text-[#8FBC8F]'
                      : isCurrent
                      ? 'border-[#E8B86D] bg-[#E8B86D]/10 text-[#E8B86D]'
                      : isLocked
                      ? 'border-[rgba(255,236,200,0.07)] bg-black/25 text-[#6B6560]'
                      : 'border-[rgba(255,236,200,0.07)] text-[#F7F1E7]0'
                  }`}
                  style={isCurrent ? { boxShadow: '0 0 12px rgba(200,169,110,0.3)' } : {}}
                >
                  {isCompleted && <CheckCircle2 size={14} />}
                  {isLocked && <Lock size={14} />}
                  {isCurrent && <Circle size={14} className="fill-[#E8B86D]" />}
                  {node.label}
                  {isLocked && <span className="text-[9px] text-[#5C574F]">locked</span>}
                </div>
                {i < curriculum.length - 1 && <div className="text-[#5C574F]">→</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Routines + Finance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="y-panel p-5">
          <h3 className="text-sm font-semibold text-[#D6CFC4] mb-3">Today's Routines</h3>
          {todayRoutines.length === 0 ? (
            <p className="text-sm text-[#6B6560] py-4">No routines scheduled for today.</p>
          ) : (
            <div className="space-y-2">
              {todayRoutines.slice(0, 5).map(r => {
                const done = r.completed_dates?.includes(today);
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2">
                    <div className={`h-2 w-2 rounded-full ${done ? 'bg-[#8FBC8F]' : 'bg-zinc-600'}`} />
                    <span className={`text-sm flex-1 ${done ? 'text-[#F7F1E7]0 line-through' : 'text-[#D6CFC4]'}`}>{r.title}</span>
                    <span className="text-xs text-[#F7F1E7]0">{r.start_time}</span>
                  </div>
                );
              })}
              {todayRoutines.length > 5 && <p className="text-xs text-[#F7F1E7]0 pt-1">+{todayRoutines.length - 5} more</p>}
            </div>
          )}
        </div>

        <div className="y-panel p-5">
          <h3 className="text-sm font-semibold text-[#D6CFC4] mb-3">Finance Snapshot</h3>
          <div className="text-3xl font-bold text-[#F5F0E8]">{formatCurrency(balance, profile?.currency_symbol || 'रू')}</div>
          <p className="text-xs text-[#F7F1E7]0 mt-1">Current Balance</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[#8FBC8F]/10 px-3 py-2">
              <div className="text-xs text-[#8FBC8F]">Income</div>
              <div className="text-sm font-semibold text-[#EDE6DA]">{formatCurrency(income, profile?.currency_symbol || 'रू')}</div>
            </div>
            <div className="rounded-lg bg-[#E07A5F]/10 px-3 py-2">
              <div className="text-xs text-[#E07A5F]">Expense</div>
              <div className="text-sm font-semibold text-[#EDE6DA]">{formatCurrency(expense, profile?.currency_symbol || 'रू')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={<Clock size={16} />} label="Focus Today" value={formatTime(todayFocusMin)} color="#E07A5F" />
        <MiniStat icon={<Flame size={16} />} label="Diary Mood" value={todayDiary ? ['😢','😕','😐','🙂','😊'][todayDiary.mood-1] : '—'} color="#E8B86D" />
        <MiniStat icon={<TrendingUp size={16} />} label="Diary Rating" value={todayDiary ? `${todayDiary.performance_rating}/5` : '—'} color="#8FBC8F" />
        <MiniStat icon={<BookOpen size={16} />} label="Total Papers" value={papers.length} color="#E8B86D" />
      </div>
    </div>
  );
}

function LevelStat({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${color}15` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div className="text-xs text-[#F7F1E7]0">{label}</div>
        <div className="text-sm font-bold text-[#F5F0E8]">{value}</div>
        {sub && <div className="text-[10px] text-[#6B6560]">{sub}</div>}
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl border border-[rgba(255,236,200,0.07)] bg-[#1E1B16]/90 p-3">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] text-[#F7F1E7]0">{label}</span>
      </div>
      <div className="text-lg font-bold text-[#F5F0E8]">{value}</div>
    </div>
  );
}
