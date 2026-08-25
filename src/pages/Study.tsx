import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAll, addRecord, updateRecord, removeRecord, removeWithChildren } from '../lib/store';
import type { Paper, Chapter, Lesson, RevisionHistory, ConfidenceLevel } from '../lib/types';
import { chapterProgressScore, paperProgressScore, levelProgressScore, formatTime, formatDate } from '../lib/utils';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { Plus, Edit2, Trash2, Star, Clock, RotateCw, BookOpen, Award, CheckCircle2, Circle, ChevronRight, ArrowUp, ArrowDown, Target } from 'lucide-react';

export default function Study() {
  const { profile, refreshKey, refreshAll } = useApp();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [revisions, setRevisions] = useState<RevisionHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<'list' | 'paper' | 'chapter'>('list');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  const [paperModal, setPaperModal] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [chapterModal, setChapterModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterPaperId, setChapterPaperId] = useState<string>('');
  const [lessonModal, setLessonModal] = useState(false);
  const [lessonChapterId, setLessonChapterId] = useState<string>('');
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  const loadData = async () => {
    const [p, c, l, r] = await Promise.all([
      getAll<Paper>('papers'),
      getAll<Chapter>('chapters'),
      getAll<Lesson>('lessons'),
      getAll<RevisionHistory>('revision_history'),
    ]);
    setPapers(p.sort((a, b) => a.number - b.number));
    setChapters(c.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));
    setLessons(l.sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));
    setRevisions(r);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [refreshKey]);

  // ── Reorder helpers ──────────────────────────────────────────
  const reorderChapters = async (paperId: string, fromIdx: number, toIdx: number) => {
    const paperChaps = chapters
      .filter(c => c.paper_id === paperId)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    const reordered = [...paperChaps];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    // assign new sort_order values 1..n
    await Promise.all(reordered.map((ch, i) => updateRecord('chapters', ch.id, { sort_order: i + 1 })));
    await loadData();
  };

  const reorderLessons = async (chapterId: string, fromIdx: number, toIdx: number) => {
    const chLess = lessons
      .filter(l => l.chapter_id === chapterId)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    const reordered = [...chLess];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    await Promise.all(reordered.map((l, i) => updateRecord('lessons', l.id, { sort_order: i + 1 })));
    await loadData();
  };
  // ────────────────────────────────────────────────────────────

  const levelPapers = papers.filter(p => p.level === profile?.ca_level);
  const levelScore = levelProgressScore(levelPapers, chapters);
  const selectedPaper = papers.find(p => p.id === selectedPaperId);
  const selectedChapter = chapters.find(c => c.id === selectedChapterId);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8B86D] border-t-transparent" /></div>;
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'paper') {
      await removeWithChildren('papers', deleteTarget.id, [
        { table: 'chapters', fk: 'paper_id', grandChildren: [{ table: 'lessons', fk: 'chapter_id' }, { table: 'revision_history', fk: 'chapter_id' }] },
      ]);
      if (selectedPaperId === deleteTarget.id) { setSelectedPaperId(null); setView('list'); }
    } else if (deleteTarget.type === 'chapter') {
      await removeWithChildren('chapters', deleteTarget.id, [
        { table: 'lessons', fk: 'chapter_id' },
        { table: 'revision_history', fk: 'chapter_id' },
      ]);
      if (selectedChapterId === deleteTarget.id) { setSelectedChapterId(null); setView('paper'); }
    } else {
      await removeRecord(deleteTarget.type === 'lesson' ? 'lessons' : 'papers', deleteTarget.id);
    }
    setDeleteTarget(null);
    loadData();
    refreshAll();
  };

  // ─── CHAPTER DETAIL VIEW ───
  if (view === 'chapter' && selectedChapter) {
    const chLessons = lessons
      .filter(l => l.chapter_id === selectedChapter.id)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    const chRevisions = revisions
      .filter(r => r.chapter_id === selectedChapter.id)
      .sort((a, b) => b.revised_at.localeCompare(a.revised_at));
    const chScore = chapterProgressScore(selectedChapter);

    return (
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setView('list')} className="text-[#F7F1E7]0 hover:text-[#D6CFC4]">Study</button>
          <ChevronRight size={14} className="text-[#5C574F]" />
          <button onClick={() => setView('paper')} className="text-[#F7F1E7]0 hover:text-[#D6CFC4]">{selectedPaper?.name || 'Paper'}</button>
          <ChevronRight size={14} className="text-[#5C574F]" />
          <span className="text-[#D6CFC4]">{selectedChapter.name}</span>
        </div>

        {/* Chapter Header */}
        <div className="y-panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                  selectedChapter.status === 'completed' ? 'bg-[#8FBC8F]/10 text-[#8FBC8F]' :
                  selectedChapter.status === 'in_progress' ? 'bg-[#E07A5F]/10 text-[#E07A5F]' :
                  'bg-[#2A261F] text-[#F7F1E7]0'
                }`}>{selectedChapter.status.replace('_', ' ')}</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={12} className={i < selectedChapter.difficulty ? 'fill-[#E8B86D] text-[#E8B86D]' : 'text-[#5C574F]'} />
                  ))}
                </div>
              </div>
              <h2 className="text-xl font-bold text-[#F5F0E8]">{selectedChapter.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-2xl font-bold text-[#E8B86D]">{chScore}%</div>
                <div className="text-[10px] text-[#F7F1E7]0">progress</div>
              </div>
              <button onClick={() => { setEditingChapter(selectedChapter); setChapterModal(true); }} className="rounded-lg p-2 text-[#F7F1E7]0 hover:text-[#D6CFC4] hover:bg-[#2A261F]"><Edit2 size={16} /></button>
              <button onClick={() => setDeleteTarget({ type: 'chapter', id: selectedChapter.id, name: selectedChapter.name })} className="rounded-lg p-2 text-[#F7F1E7]0 hover:text-[#E07A5F] hover:bg-[#2A261F]"><Trash2 size={16} /></button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <ChapterStat icon={<Circle size={14} />} label="Completion" value={`${selectedChapter.completion}%`} color="#E8B86D" />
            <ChapterStat icon={<Clock size={14} />} label="Time Spent" value={formatTime(selectedChapter.time_spent)} color="#E07A5F" />
            <ChapterStat icon={<RotateCw size={14} />} label="Revisions" value={selectedChapter.revision_count} color="#8FBC8F" />
            <ChapterStat icon={<Award size={14} />} label="Marks" value={selectedChapter.marks_total > 0 ? `${selectedChapter.marks_obtained}/${selectedChapter.marks_total}` : '—'} color="#E8B86D" />
          </div>

          {/* Confidence + Phase tracking */}
          <div className="mt-4 rounded-xl border border-[rgba(255,236,200,0.07)] bg-black/25 p-3 space-y-3">
            <div>
              <div className="text-[10px] font-medium text-[#F7F1E7]0 mb-1.5">Confidence (after revision)</div>
              <div className="flex gap-2">
                {([
                  { key: 'red' as ConfidenceLevel, label: '🔴 Weak', color: '#E07A5F' },
                  { key: 'yellow' as ConfidenceLevel, label: '🟡 OK', color: '#E07A5F' },
                  { key: 'green' as ConfidenceLevel, label: '🟢 Solid', color: '#8FBC8F' },
                ]).map(c => (
                  <button
                    key={String(c.key)}
                    onClick={async () => {
                      const next = selectedChapter.confidence === c.key ? null : c.key;
                      await updateRecord('chapters', selectedChapter.id, { confidence: next });
                      loadData(); refreshAll();
                    }}
                    className={`flex-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition-all ${
                      selectedChapter.confidence === c.key
                        ? 'border-current bg-opacity-10'
                        : 'border-[rgba(255,236,200,0.1)] text-[#F7F1E7]0'
                    }`}
                    style={selectedChapter.confidence === c.key ? { borderColor: c.color, color: c.color, background: c.color + '15' } : {}}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await updateRecord('chapters', selectedChapter.id, { phase1_done: !selectedChapter.phase1_done });
                  loadData(); refreshAll();
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium ${
                  selectedChapter.phase1_done
                    ? 'border-[#E8B86D] bg-[#E8B86D]/10 text-[#E8B86D]'
                    : 'border-[rgba(255,236,200,0.1)] text-[#F7F1E7]0'
                }`}
              >
                {selectedChapter.phase1_done ? <CheckCircle2 size={12} /> : <Circle size={12} />} Phase 1
              </button>
              <button
                onClick={async () => {
                  await updateRecord('chapters', selectedChapter.id, { phase2_done: !selectedChapter.phase2_done });
                  loadData(); refreshAll();
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium ${
                  selectedChapter.phase2_done
                    ? 'border-[#8FBC8F] bg-[#8FBC8F]/10 text-[#8FBC8F]'
                    : 'border-[rgba(255,236,200,0.1)] text-[#F7F1E7]0'
                }`}
              >
                {selectedChapter.phase2_done ? <CheckCircle2 size={12} /> : <Circle size={12} />} Phase 2
              </button>
            </div>
            {selectedChapter.phase1_done && selectedChapter.phase2_done && selectedChapter.confidence === 'green' && (
              <div className="flex items-center gap-1.5 text-[11px] text-[#8FBC8F]">
                <Target size={12} /> Exam-ready
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-[#F7F1E7]0">Completion</span>
              <span className="text-[#E8B86D] font-medium">{selectedChapter.completion}%</span>
            </div>
            <div className="h-2 rounded-full bg-[#2A261F] overflow-hidden">
              <div className="h-full bg-[#E8B86D] rounded-full transition-all" style={{ width: `${selectedChapter.completion}%` }} />
            </div>
          </div>

          {selectedChapter.last_revised && (
            <div className="mt-3 text-xs text-[#F7F1E7]0">Last revised: {formatDate(selectedChapter.last_revised)}</div>
          )}
          {selectedChapter.notes && (
            <div className="mt-4 rounded-xl bg-black/25 p-3">
              <div className="text-xs font-medium text-[#F7F1E7]0 mb-1">Notes</div>
              <p className="text-sm text-[#A8A29A] whitespace-pre-wrap">{selectedChapter.notes}</p>
            </div>
          )}
        </div>

        {/* Lessons */}
        <div className="y-panel p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#D6CFC4]">Lessons ({chLessons.length})</h3>
            <button onClick={() => { setLessonChapterId(selectedChapter.id); setLessonModal(true); }} className="flex items-center gap-1 text-xs text-[#E8B86D] hover:underline"><Plus size={14} /> Add Lesson</button>
          </div>
          {chLessons.length === 0 ? (
            <p className="text-sm text-[#6B6560] py-3">No lessons yet. Add your first lesson for this chapter.</p>
          ) : (
            <div className="space-y-2">
              {chLessons.map((l, idx) => (
                <div key={l.id} className="rounded-xl border border-[rgba(255,236,200,0.05)] bg-black/20 px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* Up/Down reorder buttons */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        disabled={idx === 0}
                        onClick={() => reorderLessons(selectedChapter.id, idx, idx - 1)}
                        className="rounded p-0.5 text-[#6B6560] hover:text-[#E8B86D] disabled:opacity-20 disabled:cursor-not-allowed"
                      ><ArrowUp size={12} /></button>
                      <button
                        disabled={idx === chLessons.length - 1}
                        onClick={() => reorderLessons(selectedChapter.id, idx, idx + 1)}
                        className="rounded p-0.5 text-[#6B6560] hover:text-[#E8B86D] disabled:opacity-20 disabled:cursor-not-allowed"
                      ><ArrowDown size={12} /></button>
                    </div>

                    <div className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${l.completion >= 100 ? 'bg-[#8FBC8F]/10' : l.completion > 0 ? 'bg-[#E07A5F]/10' : 'bg-[#2A261F]'}`}>
                      {l.completion >= 100
                        ? <CheckCircle2 size={15} className="text-[#8FBC8F]" />
                        : <span className="text-[10px] font-bold text-[#F7F1E7]0">{idx + 1}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#EDE6DA]">{l.name}</div>
                      <div className="text-xs text-[#F7F1E7]0">{l.completion}% complete · {formatTime(l.time_spent)}</div>
                    </div>
                    <div className="w-20 h-1.5 rounded-full bg-[#2A261F] overflow-hidden">
                      <div className={`h-full rounded-full ${l.completion >= 100 ? 'bg-[#8FBC8F]' : 'bg-[#E07A5F]'}`} style={{ width: `${l.completion}%` }} />
                    </div>
                    <button onClick={() => { setEditingLesson(l); setLessonModal(true); }} className="text-[#F7F1E7]0 hover:text-[#D6CFC4]"><Edit2 size={14} /></button>
                    <button onClick={() => setDeleteTarget({ type: 'lesson', id: l.id, name: l.name })} className="text-[#6B6560] hover:text-[#E07A5F]"><Trash2 size={14} /></button>
                  </div>
                  {l.notes && (
                    <div className="mt-2 ml-10 rounded-lg bg-[#2A261F]/30 p-2 text-xs text-[#A8A29A] whitespace-pre-wrap">{l.notes}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revision History */}
        <div className="y-panel p-5">
          <h3 className="text-sm font-semibold text-[#D6CFC4] mb-3">Revision History ({chRevisions.length})</h3>
          {chRevisions.length === 0 ? (
            <p className="text-sm text-[#6B6560] py-3">No revisions recorded yet.</p>
          ) : (
            <div className="space-y-1.5">
              {chRevisions.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2">
                  <span className="text-xs text-[#6B6560] w-6">#{chRevisions.length - i}</span>
                  <RotateCw size={12} className="text-[#8FBC8F]" />
                  <span className="text-sm text-[#D6CFC4]">{formatDate(r.revised_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {chapterModal && (
          <ChapterModal open={chapterModal} editing={editingChapter} paperId={editingChapter?.paper_id || chapterPaperId} onClose={() => setChapterModal(false)} onSaved={() => { setChapterModal(false); loadData(); refreshAll(); }} />
        )}
        {lessonModal && (
          <LessonModal open={lessonModal} editing={editingLesson} chapterId={editingLesson?.chapter_id || lessonChapterId} onClose={() => { setLessonModal(false); setEditingLesson(null); }} onSaved={() => { setLessonModal(false); setEditingLesson(null); loadData(); refreshAll(); }} />
        )}
        <ConfirmDialog open={!!deleteTarget} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      </div>
    );
  }

  // ─── PAPER DETAIL VIEW ───
  if (view === 'paper' && selectedPaper) {
    const paperChapters = chapters
      .filter(c => c.paper_id === selectedPaper.id)
      .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    const score = paperProgressScore(paperChapters);

    return (
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setView('list')} className="text-[#F7F1E7]0 hover:text-[#D6CFC4]">Study</button>
          <ChevronRight size={14} className="text-[#5C574F]" />
          <span className="text-[#D6CFC4]">{selectedPaper.name}</span>
        </div>

        {/* Paper Header */}
        <div className="y-panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-md bg-[#E8B86D]/10 px-2 py-0.5 text-xs font-medium text-[#E8B86D]">Paper {selectedPaper.number}</span>
                {selectedPaper.group && <span className="rounded-md bg-[#2A261F] px-2 py-0.5 text-xs text-[#A8A29A]">{selectedPaper.group}</span>}
              </div>
              <h2 className="text-xl font-bold text-[#F5F0E8]">{selectedPaper.name}</h2>
              <p className="text-xs text-[#F7F1E7]0 mt-1">ICAI CA {selectedPaper.level} · {paperChapters.length} chapters · {formatTime(paperChapters.reduce((s, c) => s + c.time_spent, 0))}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-2xl font-bold text-[#E8B86D]">{score}%</div>
                <div className="text-[10px] text-[#F7F1E7]0">progress</div>
              </div>
              <button onClick={() => { setEditingPaper(selectedPaper); setPaperModal(true); }} className="rounded-lg p-2 text-[#F7F1E7]0 hover:text-[#D6CFC4] hover:bg-[#2A261F]"><Edit2 size={16} /></button>
              <button onClick={() => setDeleteTarget({ type: 'paper', id: selectedPaper.id, name: selectedPaper.name })} className="rounded-lg p-2 text-[#F7F1E7]0 hover:text-[#E07A5F] hover:bg-[#2A261F]"><Trash2 size={16} /></button>
            </div>
          </div>
        </div>

        {/* Chapters */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#D6CFC4]">Chapters</h3>
            <button onClick={() => { setEditingChapter(null); setChapterPaperId(selectedPaper.id); setChapterModal(true); }} className="flex items-center gap-1.5 rounded-xl bg-[#E8B86D] px-3 py-2 text-sm font-semibold text-black hover:bg-[#F0C98A]"><Plus size={16} /> Add Chapter</button>
          </div>
          {paperChapters.length === 0 ? (
            <EmptyState icon={<BookOpen size={36} />} message="No chapters yet. Add your first chapter to start tracking progress." />
          ) : (
            <div className="space-y-2">
              {paperChapters.map((ch, idx) => {
                const chScore = chapterProgressScore(ch);
                return (
                  <div key={ch.id} className="flex items-center gap-2">
                    {/* Up/Down reorder buttons */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        disabled={idx === 0}
                        onClick={() => reorderChapters(selectedPaper.id, idx, idx - 1)}
                        className="rounded p-1 text-[#6B6560] hover:text-[#E8B86D] disabled:opacity-20 disabled:cursor-not-allowed"
                      ><ArrowUp size={14} /></button>
                      <button
                        disabled={idx === paperChapters.length - 1}
                        onClick={() => reorderChapters(selectedPaper.id, idx, idx + 1)}
                        className="rounded p-1 text-[#6B6560] hover:text-[#E8B86D] disabled:opacity-20 disabled:cursor-not-allowed"
                      ><ArrowDown size={14} /></button>
                    </div>

                    <button
                      onClick={() => { setSelectedChapterId(ch.id); setView('chapter'); }}
                      className="flex-1 flex items-center gap-3 y-panel px-5 py-4 hover:border-[#E8B86D]/30 hover:bg-black/20 transition-all text-left"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2A261F] text-xs font-bold text-[#A8A29A] shrink-0">
                        {idx + 1}
                      </div>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                        ch.status === 'completed' ? 'bg-[#8FBC8F]/10' : ch.status === 'in_progress' ? 'bg-[#E07A5F]/10' : 'bg-[#2A261F]'
                      }`}>
                        {ch.status === 'completed' ? <CheckCircle2 size={18} className="text-[#8FBC8F]" /> : <BookOpen size={18} className="text-[#F7F1E7]0" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#EDE6DA]">{ch.name}</div>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-[#F7F1E7]0">
                          <span className="flex items-center gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={8} className={i < ch.difficulty ? 'fill-[#E8B86D] text-[#E8B86D]' : 'text-[#5C574F]'} />)}
                          </span>
                          <span>{ch.completion}%</span>
                          <span>{ch.revision_count} rev</span>
                          <span>{formatTime(ch.time_spent)}</span>
                          <span className={`px-1.5 rounded ${ch.status === 'completed' ? 'text-[#8FBC8F]' : ch.status === 'in_progress' ? 'text-[#E07A5F]' : 'text-[#F7F1E7]0'}`}>{ch.status.replace('_', ' ')}</span>
                          {ch.confidence === 'red' && <span className="text-[10px]">🔴</span>}
                          {ch.confidence === 'yellow' && <span className="text-[10px]">🟡</span>}
                          {ch.confidence === 'green' && <span className="text-[10px]">🟢</span>}
                          {ch.phase1_done && <span className="text-[9px] text-[#E8B86D]">P1</span>}
                          {ch.phase2_done && <span className="text-[9px] text-[#8FBC8F]">P2</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-[#E8B86D]">{chScore}%</div>
                      </div>
                      <ChevronRight size={18} className="text-[#5C574F] shrink-0" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {paperModal && (
          <PaperModal open={paperModal} editing={editingPaper} level={profile?.ca_level || 'Foundation'} onClose={() => setPaperModal(false)} onSaved={() => { setPaperModal(false); loadData(); refreshAll(); }} />
        )}
        {chapterModal && (
          <ChapterModal open={chapterModal} editing={editingChapter} paperId={chapterPaperId || editingChapter?.paper_id || ''} onClose={() => setChapterModal(false)} onSaved={() => { setChapterModal(false); loadData(); refreshAll(); }} />
        )}
        <ConfirmDialog open={!!deleteTarget} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"? This will also delete all chapters and lessons inside. This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      </div>
    );
  }

  // ─── PAPER LIST VIEW ───
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="y-page-title">Study</h1>
          <p className="text-sm text-[#F7F1E7]0 mt-1">ICAI CA {profile?.ca_level} · Level progress: <span className="text-[#E8B86D] font-semibold">{levelScore}%</span></p>
        </div>
        <button onClick={() => { setEditingPaper(null); setPaperModal(true); }} className="y-btn y-btn-primary flex items-center gap-2 transition-colors">
          <Plus size={18} /> Add Paper
        </button>
      </div>

      {levelPapers.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={40} />}
          message="No papers yet. Add your first ICAI CA paper to start tracking."
          action={<button onClick={() => setPaperModal(true)} className="rounded-xl bg-[#E8B86D] px-4 py-2 text-sm font-semibold text-black hover:bg-[#F0C98A]">Add Paper</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {levelPapers.map(paper => {
            const paperChapters = chapters
              .filter(c => c.paper_id === paper.id)
              .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
            const score = paperProgressScore(paperChapters);
            const completed = paperChapters.filter(c => c.status === 'completed').length;
            return (
              <button
                key={paper.id}
                onClick={() => { setSelectedPaperId(paper.id); setView('paper'); }}
                className="text-left y-panel p-5 hover:border-[#E8B86D]/30 hover:bg-black/20 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded-md bg-[#E8B86D]/10 px-2 py-0.5 text-xs font-medium text-[#E8B86D]">P{paper.number}</span>
                      {paper.group && <span className="rounded-md bg-[#2A261F] px-2 py-0.5 text-xs text-[#A8A29A]">{paper.group}</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-[#F5F0E8]">{paper.name}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-[#E8B86D]">{score}%</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#F7F1E7]0">
                  <span className="flex items-center gap-1"><BookOpen size={12} /> {paperChapters.length} chapters</span>
                  <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {completed} done</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(paperChapters.reduce((s, c) => s + c.time_spent, 0))}</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-[#2A261F] overflow-hidden">
                  <div className="h-full bg-[#E8B86D] rounded-full transition-all" style={{ width: `${score}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {paperModal && (
        <PaperModal open={paperModal} editing={editingPaper} level={profile?.ca_level || 'Foundation'} onClose={() => setPaperModal(false)} onSaved={() => { setPaperModal(false); loadData(); refreshAll(); }} />
      )}
      {chapterModal && (
        <ChapterModal open={chapterModal} editing={editingChapter} paperId={chapterPaperId || editingChapter?.paper_id || ''} onClose={() => setChapterModal(false)} onSaved={() => { setChapterModal(false); loadData(); refreshAll(); }} />
      )}
      {lessonModal && (
        <LessonModal open={lessonModal} editing={editingLesson} chapterId={editingLesson?.chapter_id || lessonChapterId} onClose={() => { setLessonModal(false); setEditingLesson(null); }} onSaved={() => { setLessonModal(false); setEditingLesson(null); loadData(); refreshAll(); }} />
      )}
      <ConfirmDialog open={!!deleteTarget} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

function ChapterStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl bg-black/25 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] text-[#F7F1E7]0">{label}</span>
      </div>
      <div className="text-sm font-bold text-[#F5F0E8]">{value}</div>
    </div>
  );
}

function PaperModal({ open, editing, level, onClose, onSaved }: { open: boolean; editing: Paper | null; level: string; onClose: () => void; onSaved: () => void }) {
  const [number, setNumber] = useState(editing?.number || 1);
  const [name, setName] = useState(editing?.name || '');
  const [grp, setGrp] = useState<string>(editing?.group || 'G1');

  useEffect(() => {
    if (open) {
      setNumber(editing?.number || 1);
      setName(editing?.name || '');
      setGrp(editing?.group || (level === 'Foundation' ? '' : 'G1'));
    }
  }, [open, editing, level]);

  const save = async () => {
    if (!name.trim()) return;
    if (editing) {
      await updateRecord('papers', editing.id, { number, name: name.trim(), group: grp });
    } else {
      await addRecord('papers', { number, name: name.trim(), level: level as any, group: grp, created_at: new Date().toISOString() });
    }
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Paper' : 'Add Paper'}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Paper Number</label>
          <input type="number" min={1} value={number} onChange={e => setNumber(+e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Paper Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Principles of Accounting" className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
        </div>
        {level !== 'Foundation' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Group</label>
            <div className="grid grid-cols-2 gap-2">
              {['G1', 'G2'].map(g => (
                <button key={g} onClick={() => setGrp(g)} className={`rounded-xl border px-3 py-2 text-sm font-medium ${grp === g ? 'border-[#E8B86D] bg-[#E8B86D]/10 text-[#E8B86D]' : 'border-[rgba(255,236,200,0.1)] text-[#A8A29A]'}`}>{g}</button>
              ))}
            </div>
          </div>
        )}
        <button onClick={save} disabled={!name.trim()} className="y-btn y-btn-primary w-full disabled:opacity-40">{editing ? 'Save Changes' : 'Add Paper'}</button>
      </div>
    </Modal>
  );
}

function ChapterModal({ open, editing, paperId, onClose, onSaved }: { open: boolean; editing: Chapter | null; paperId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(editing?.name || '');
  const [difficulty, setDifficulty] = useState(editing?.difficulty || 3);
  const [status, setStatus] = useState(editing?.status || 'not_started');
  const [completion, setCompletion] = useState(editing?.completion || 0);
  const [timeSpent, setTimeSpent] = useState(editing?.time_spent || 0);
  const [revisionCount, setRevisionCount] = useState(editing?.revision_count || 0);
  const [marksObtained, setMarksObtained] = useState(editing?.marks_obtained || 0);
  const [marksTotal, setMarksTotal] = useState(editing?.marks_total || 0);
  const [notes, setNotes] = useState(editing?.notes || '');

  useEffect(() => {
    if (open) {
      setName(editing?.name || '');
      setDifficulty(editing?.difficulty || 3);
      setStatus(editing?.status || 'not_started');
      setCompletion(editing?.completion || 0);
      setTimeSpent(editing?.time_spent || 0);
      setRevisionCount(editing?.revision_count || 0);
      setMarksObtained(editing?.marks_obtained || 0);
      setMarksTotal(editing?.marks_total || 0);
      setNotes(editing?.notes || '');
    }
  }, [open, editing]);

  const save = async () => {
    if (!name.trim()) return;
    const data = {
      paper_id: paperId, name: name.trim(), difficulty, status, completion,
      time_spent: timeSpent, revision_count: revisionCount,
      marks_obtained: marksObtained, marks_total: marksTotal,
      notes, last_revised: editing?.last_revised || null,
    };
    if (editing) {
      await updateRecord('chapters', editing.id, data);
    } else {
      await addRecord('chapters', { ...data, created_at: new Date().toISOString() });
    }
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Chapter' : 'Add Chapter'}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Chapter Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Partnership Accounts" className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Difficulty</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setDifficulty(n)} className="p-1">
                <Star size={22} className={n <= difficulty ? 'fill-[#E8B86D] text-[#E8B86D]' : 'text-[#5C574F]'} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Status</label>
          <div className="grid grid-cols-3 gap-2">
            {(['not_started', 'in_progress', 'completed'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)} className={`rounded-xl border px-3 py-2 text-xs font-medium capitalize ${status === s ? 'border-[#E8B86D] bg-[#E8B86D]/10 text-[#E8B86D]' : 'border-[rgba(255,236,200,0.1)] text-[#A8A29A]'}`}>{s.replace('_', ' ')}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Completion: {completion}%</label>
          <input type="range" min={0} max={100} value={completion} onChange={e => setCompletion(+e.target.value)} className="w-full accent-[#E8B86D]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Time Spent (min)</label>
            <input type="number" value={timeSpent} onChange={e => setTimeSpent(+e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-3 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Revisions</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setRevisionCount(Math.max(0, revisionCount - 1))} className="rounded-lg border border-[rgba(255,236,200,0.1)] px-3 py-2 text-[#D6CFC4]">-</button>
              <span className="flex-1 text-center text-[#F5F0E8]">{revisionCount}</span>
              <button onClick={() => setRevisionCount(revisionCount + 1)} className="rounded-lg border border-[rgba(255,236,200,0.1)] px-3 py-2 text-[#D6CFC4]">+</button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Marks Obtained</label>
            <input type="number" value={marksObtained} onChange={e => setMarksObtained(+e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-3 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Marks Total</label>
            <input type="number" value={marksTotal} onChange={e => setMarksTotal(+e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-3 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Chapter notes..." className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D] resize-none" />
        </div>
        <button onClick={save} disabled={!name.trim()} className="y-btn y-btn-primary w-full disabled:opacity-40">{editing ? 'Save Changes' : 'Add Chapter'}</button>
      </div>
    </Modal>
  );
}

function LessonModal({ open, editing, chapterId, onClose, onSaved }: { open: boolean; editing: Lesson | null; chapterId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [completion, setCompletion] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      setName(editing?.name || '');
      setCompletion(editing?.completion || 0);
      setTimeSpent(editing?.time_spent || 0);
      setNotes(editing?.notes || '');
    }
  }, [open, editing]);

  const save = async () => {
    if (!name.trim()) return;
    if (editing) {
      await updateRecord('lessons', editing.id, { name: name.trim(), completion, time_spent: timeSpent, notes });
    } else {
      await addRecord('lessons', { chapter_id: chapterId, name: name.trim(), completion, time_spent: timeSpent, notes, created_at: new Date().toISOString() });
    }
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Lesson' : 'Add Lesson'} maxWidth="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Lesson Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Goodwill Valuation" className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Completion: {completion}%</label>
          <input type="range" min={0} max={100} value={completion} onChange={e => setCompletion(+e.target.value)} className="w-full accent-[#E8B86D]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Time Spent (minutes)</label>
          <input type="number" min={0} value={timeSpent} onChange={e => setTimeSpent(+e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Lesson notes..." className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-sm text-[#EDE6DA] outline-none focus:border-[#E8B86D] resize-none" />
        </div>
        <button onClick={save} disabled={!name.trim()} className="y-btn y-btn-primary w-full disabled:opacity-40">{editing ? 'Save Changes' : 'Add Lesson'}</button>
      </div>
    </Modal>
  );
}