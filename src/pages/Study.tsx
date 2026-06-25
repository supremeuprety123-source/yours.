import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAll, addRecord, updateRecord, removeRecord, removeWithChildren } from '../lib/store';
import type { Paper, Chapter, Lesson, RevisionHistory } from '../lib/types';
import { chapterProgressScore, paperProgressScore, levelProgressScore, formatTime, formatDate } from '../lib/utils';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { Plus, ChevronLeft, Edit2, Trash2, Star, Clock, RotateCw, BookOpen, Target, Award, FileText, CheckCircle2, Circle, ChevronRight } from 'lucide-react';

export default function Study() {
  const { profile, refreshKey, refreshAll } = useApp();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [revisions, setRevisions] = useState<RevisionHistory[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation state
  const [view, setView] = useState<'list' | 'paper' | 'chapter'>('list');
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  // Modals
  const [paperModal, setPaperModal] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [chapterModal, setChapterModal] = useState(false);
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [chapterPaperId, setChapterPaperId] = useState<string>('');
  const [lessonModal, setLessonModal] = useState(false);
  const [lessonChapterId, setLessonChapterId] = useState<string>('');
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string; name: string } | null>(null);

  const loadData = async () => {
    const [p, c, l, r] = await Promise.all([
      getAll<Paper>('papers'),
      getAll<Chapter>('chapters'),
      getAll<Lesson>('lessons'),
      getAll<RevisionHistory>('revision_history'),
    ]);
    setPapers(p.sort((a,b) => a.number - b.number));
    setChapters(c);
    setLessons(l);
    setRevisions(r);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [refreshKey]);

  const levelPapers = papers.filter(p => p.level === profile?.ca_level);
  const levelScore = levelProgressScore(levelPapers, chapters);
  const selectedPaper = papers.find(p => p.id === selectedPaperId);
  const selectedChapter = chapters.find(c => c.id === selectedChapterId);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C8A96E] border-t-transparent" /></div>;
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
    const chLessons = lessons.filter(l => l.chapter_id === selectedChapter.id);
    const chRevisions = revisions.filter(r => r.chapter_id === selectedChapter.id).sort((a,b) => b.revised_at.localeCompare(a.revised_at));
    const chScore = chapterProgressScore(selectedChapter);

    return (
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setView('list')} className="text-zinc-500 hover:text-zinc-300">Study</button>
          <ChevronRight size={14} className="text-zinc-700" />
          <button onClick={() => setView('paper')} className="text-zinc-500 hover:text-zinc-300">{selectedPaper?.name || 'Paper'}</button>
          <ChevronRight size={14} className="text-zinc-700" />
          <span className="text-zinc-300">{selectedChapter.name}</span>
        </div>

        {/* Chapter Header */}
        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                  selectedChapter.status === 'completed' ? 'bg-[#4CAF7D]/10 text-[#4CAF7D]' :
                  selectedChapter.status === 'in_progress' ? 'bg-[#E07B39]/10 text-[#E07B39]' :
                  'bg-zinc-800 text-zinc-500'
                }`}>{selectedChapter.status.replace('_',' ')}</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({length:5}).map((_,i) => (
                    <Star key={i} size={12} className={i < selectedChapter.difficulty ? 'fill-[#C8A96E] text-[#C8A96E]' : 'text-zinc-700'} />
                  ))}
                </div>
              </div>
              <h2 className="text-xl font-bold text-zinc-100">{selectedChapter.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-2xl font-bold text-[#C8A96E]">{chScore}%</div>
                <div className="text-[10px] text-zinc-500">progress</div>
              </div>
              <button onClick={() => { setEditingChapter(selectedChapter); setChapterModal(true); }} className="rounded-lg p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"><Edit2 size={16} /></button>
              <button onClick={() => setDeleteTarget({ type: 'chapter', id: selectedChapter.id, name: selectedChapter.name })} className="rounded-lg p-2 text-zinc-500 hover:text-[#C0392B] hover:bg-zinc-800"><Trash2 size={16} /></button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <ChapterStat icon={<Circle size={14} />} label="Completion" value={`${selectedChapter.completion}%`} color="#C8A96E" />
            <ChapterStat icon={<Clock size={14} />} label="Time Spent" value={formatTime(selectedChapter.time_spent)} color="#E07B39" />
            <ChapterStat icon={<RotateCw size={14} />} label="Revisions" value={selectedChapter.revision_count} color="#4CAF7D" />
            <ChapterStat icon={<Award size={14} />} label="Marks" value={selectedChapter.marks_total > 0 ? `${selectedChapter.marks_obtained}/${selectedChapter.marks_total}` : '—'} color="#C8A96E" />
          </div>

          {/* Completion Slider */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-zinc-500">Completion</span>
              <span className="text-[#C8A96E] font-medium">{selectedChapter.completion}%</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-[#C8A96E] rounded-full transition-all" style={{ width: `${selectedChapter.completion}%` }} />
            </div>
          </div>

          {selectedChapter.last_revised && (
            <div className="mt-3 text-xs text-zinc-500">Last revised: {formatDate(selectedChapter.last_revised)}</div>
          )}

          {selectedChapter.notes && (
            <div className="mt-4 rounded-xl bg-zinc-900/50 p-3">
              <div className="text-xs font-medium text-zinc-500 mb-1">Notes</div>
              <p className="text-sm text-zinc-400 whitespace-pre-wrap">{selectedChapter.notes}</p>
            </div>
          )}
        </div>

        {/* Lessons */}
        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-300">Lessons ({chLessons.length})</h3>
            <button onClick={() => { setLessonChapterId(selectedChapter.id); setLessonModal(true); }} className="flex items-center gap-1 text-xs text-[#C8A96E] hover:underline"><Plus size={14} /> Add Lesson</button>
          </div>
          {chLessons.length === 0 ? (
            <p className="text-sm text-zinc-600 py-3">No lessons yet. Add your first lesson for this chapter.</p>
          ) : (
            <div className="space-y-2">
              {chLessons.map(l => (
                <div key={l.id} className="flex items-center gap-3 rounded-xl border border-zinc-800/50 bg-zinc-900/30 px-4 py-3">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${l.completion >= 100 ? 'bg-[#4CAF7D]/10' : l.completion > 0 ? 'bg-[#E07B39]/10' : 'bg-zinc-800'}`}>
                    {l.completion >= 100 ? <CheckCircle2 size={15} className="text-[#4CAF7D]" /> : <Circle size={15} className="text-zinc-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-200">{l.name}</div>
                    <div className="text-xs text-zinc-500">{l.completion}% complete · {formatTime(l.time_spent)}</div>
                  </div>
                  <div className="w-20 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full ${l.completion >= 100 ? 'bg-[#4CAF7D]' : 'bg-[#E07B39]'}`} style={{ width: `${l.completion}%` }} />
                  </div>
                  <button onClick={() => setDeleteTarget({ type: 'lesson', id: l.id, name: l.name })} className="text-zinc-600 hover:text-[#C0392B]"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revision History */}
        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Revision History ({chRevisions.length})</h3>
          {chRevisions.length === 0 ? (
            <p className="text-sm text-zinc-600 py-3">No revisions recorded yet. Use the Focus Timer with this chapter linked to auto-log revisions.</p>
          ) : (
            <div className="space-y-1.5">
              {chRevisions.map((r, i) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg bg-zinc-900/50 px-3 py-2">
                  <span className="text-xs text-zinc-600 w-6">#{chRevisions.length - i}</span>
                  <RotateCw size={12} className="text-[#4CAF7D]" />
                  <span className="text-sm text-zinc-300">{formatDate(r.revised_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modals */}
        {chapterModal && (
          <ChapterModal open={chapterModal} editing={editingChapter} paperId={editingChapter?.paper_id || chapterPaperId} onClose={() => setChapterModal(false)} onSaved={() => { setChapterModal(false); loadData(); refreshAll(); }} />
        )}
        {lessonModal && (
          <LessonModal open={lessonModal} chapterId={lessonChapterId} onClose={() => setLessonModal(false)} onSaved={() => { setLessonModal(false); loadData(); refreshAll(); }} />
        )}
        <ConfirmDialog open={!!deleteTarget} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      </div>
    );
  }

  // ─── PAPER DETAIL VIEW ───
  if (view === 'paper' && selectedPaper) {
    const paperChapters = chapters.filter(c => c.paper_id === selectedPaper.id);
    const score = paperProgressScore(paperChapters);

    return (
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => setView('list')} className="text-zinc-500 hover:text-zinc-300">Study</button>
          <ChevronRight size={14} className="text-zinc-700" />
          <span className="text-zinc-300">{selectedPaper.name}</span>
        </div>

        {/* Paper Header */}
        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-md bg-[#C8A96E]/10 px-2 py-0.5 text-xs font-medium text-[#C8A96E]">Paper {selectedPaper.number}</span>
                {selectedPaper.group && <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{selectedPaper.group}</span>}
              </div>
              <h2 className="text-xl font-bold text-zinc-100">{selectedPaper.name}</h2>
              <p className="text-xs text-zinc-500 mt-1">ICAI CA {selectedPaper.level} · {paperChapters.length} chapters · {formatTime(paperChapters.reduce((s,c)=>s+c.time_spent,0))}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-2xl font-bold text-[#C8A96E]">{score}%</div>
                <div className="text-[10px] text-zinc-500">progress</div>
              </div>
              <button onClick={() => { setEditingPaper(selectedPaper); setPaperModal(true); }} className="rounded-lg p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"><Edit2 size={16} /></button>
              <button onClick={() => setDeleteTarget({ type: 'paper', id: selectedPaper.id, name: selectedPaper.name })} className="rounded-lg p-2 text-zinc-500 hover:text-[#C0392B] hover:bg-zinc-800"><Trash2 size={16} /></button>
            </div>
          </div>
        </div>

        {/* Chapters */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-300">Chapters</h3>
            <button onClick={() => { setEditingChapter(null); setChapterPaperId(selectedPaper.id); setChapterModal(true); }} className="flex items-center gap-1.5 rounded-xl bg-[#C8A96E] px-3 py-2 text-sm font-semibold text-black hover:bg-[#d4b87f]"><Plus size={16} /> Add Chapter</button>
          </div>
          {paperChapters.length === 0 ? (
            <EmptyState icon={<BookOpen size={36} />} message="No chapters yet. Add your first chapter to start tracking progress." />
          ) : (
            <div className="space-y-2">
              {paperChapters.map(ch => {
                const chScore = chapterProgressScore(ch);
                return (
                  <button
                    key={ch.id}
                    onClick={() => { setSelectedChapterId(ch.id); setView('chapter'); }}
                    className="w-full flex items-center gap-3 rounded-2xl border border-zinc-800 bg-[#1A1A1A] px-5 py-4 hover:border-[#C8A96E]/30 hover:bg-zinc-900/30 transition-all text-left"
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      ch.status === 'completed' ? 'bg-[#4CAF7D]/10' : ch.status === 'in_progress' ? 'bg-[#E07B39]/10' : 'bg-zinc-800'
                    }`}>
                      {ch.status === 'completed' ? <CheckCircle2 size={18} className="text-[#4CAF7D]" /> : <BookOpen size={18} className="text-zinc-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-200">{ch.name}</div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-zinc-500">
                        <span className="flex items-center gap-0.5">
                          {Array.from({length:5}).map((_,i) => <Star key={i} size={8} className={i < ch.difficulty ? 'fill-[#C8A96E] text-[#C8A96E]' : 'text-zinc-700'} />)}
                        </span>
                        <span>{ch.completion}%</span>
                        <span>{ch.revision_count} rev</span>
                        <span>{formatTime(ch.time_spent)}</span>
                        <span className={`px-1.5 rounded ${ch.status === 'completed' ? 'text-[#4CAF7D]' : ch.status === 'in_progress' ? 'text-[#E07B39]' : 'text-zinc-500'}`}>{ch.status.replace('_',' ')}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-[#C8A96E]">{chScore}%</div>
                    </div>
                    <ChevronRight size={18} className="text-zinc-700" />
                  </button>
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

  // ─── PAPER LIST VIEW (default) ───
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Study</h1>
          <p className="text-sm text-zinc-500 mt-1">ICAI CA {profile?.ca_level} · Level progress: <span className="text-[#C8A96E] font-semibold">{levelScore}%</span></p>
        </div>
        <button onClick={() => { setEditingPaper(null); setPaperModal(true); }} className="flex items-center gap-2 rounded-xl bg-[#C8A96E] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f] transition-colors">
          <Plus size={18} /> Add Paper
        </button>
      </div>

      {levelPapers.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={40} />}
          message="No papers yet. Add your first ICAI CA paper to start tracking."
          action={<button onClick={() => setPaperModal(true)} className="rounded-xl bg-[#C8A96E] px-4 py-2 text-sm font-semibold text-black hover:bg-[#d4b87f]">Add Paper</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {levelPapers.map(paper => {
            const paperChapters = chapters.filter(c => c.paper_id === paper.id);
            const score = paperProgressScore(paperChapters);
            const completed = paperChapters.filter(c => c.status === 'completed').length;
            return (
              <button
                key={paper.id}
                onClick={() => { setSelectedPaperId(paper.id); setView('paper'); }}
                className="text-left rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5 hover:border-[#C8A96E]/30 hover:bg-zinc-900/30 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded-md bg-[#C8A96E]/10 px-2 py-0.5 text-xs font-medium text-[#C8A96E]">P{paper.number}</span>
                      {paper.group && <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{paper.group}</span>}
                    </div>
                    <h3 className="text-sm font-semibold text-zinc-100">{paper.name}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-[#C8A96E]">{score}%</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span className="flex items-center gap-1"><BookOpen size={12} /> {paperChapters.length} chapters</span>
                  <span className="flex items-center gap-1"><CheckCircle2 size={12} /> {completed} done</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatTime(paperChapters.reduce((s,c)=>s+c.time_spent,0))}</span>
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-[#C8A96E] rounded-full transition-all" style={{ width: `${score}%` }} />
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
        <LessonModal open={lessonModal} chapterId={lessonChapterId} onClose={() => setLessonModal(false)} onSaved={() => { setLessonModal(false); loadData(); refreshAll(); }} />
      )}
      <ConfirmDialog open={!!deleteTarget} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

function ChapterStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string }) {
  return (
    <div className="rounded-xl bg-zinc-900/50 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-[10px] text-zinc-500">{label}</span>
      </div>
      <div className="text-sm font-bold text-zinc-100">{value}</div>
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
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Paper Number</label>
          <input type="number" min={1} value={number} onChange={e => setNumber(+e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Paper Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Principles of Accounting" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
        </div>
        {level !== 'Foundation' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Group</label>
            <div className="grid grid-cols-2 gap-2">
              {['G1', 'G2'].map(g => (
                <button key={g} onClick={() => setGrp(g)} className={`rounded-xl border px-3 py-2 text-sm font-medium ${grp === g ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]' : 'border-zinc-700 text-zinc-400'}`}>{g}</button>
              ))}
            </div>
          </div>
        )}
        <button onClick={save} disabled={!name.trim()} className="w-full rounded-xl bg-[#C8A96E] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f] disabled:opacity-40">{editing ? 'Save Changes' : 'Add Paper'}</button>
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
      paper_id: paperId,
      name: name.trim(),
      difficulty,
      status,
      completion,
      time_spent: timeSpent,
      revision_count: revisionCount,
      marks_obtained: marksObtained,
      marks_total: marksTotal,
      notes,
      last_revised: editing?.last_revised || null,
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
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Chapter Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Partnership Accounts" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Difficulty</label>
          <div className="flex gap-1">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => setDifficulty(n)} className="p-1">
                <Star size={22} className={n <= difficulty ? 'fill-[#C8A96E] text-[#C8A96E]' : 'text-zinc-700'} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Status</label>
          <div className="grid grid-cols-3 gap-2">
            {(['not_started','in_progress','completed'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)} className={`rounded-xl border px-3 py-2 text-xs font-medium capitalize ${status === s ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]' : 'border-zinc-700 text-zinc-400'}`}>{s.replace('_',' ')}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Completion: {completion}%</label>
          <input type="range" min={0} max={100} value={completion} onChange={e => setCompletion(+e.target.value)} className="w-full accent-[#C8A96E]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Time Spent (min)</label>
            <input type="number" value={timeSpent} onChange={e => setTimeSpent(+e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-3 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Revisions</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setRevisionCount(Math.max(0, revisionCount-1))} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300">-</button>
              <span className="flex-1 text-center text-zinc-100">{revisionCount}</span>
              <button onClick={() => setRevisionCount(revisionCount+1)} className="rounded-lg border border-zinc-700 px-3 py-2 text-zinc-300">+</button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Marks Obtained</label>
            <input type="number" value={marksObtained} onChange={e => setMarksObtained(+e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-3 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Marks Total</label>
            <input type="number" value={marksTotal} onChange={e => setMarksTotal(+e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-3 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Chapter notes..." className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E] resize-none" />
        </div>
        <button onClick={save} disabled={!name.trim()} className="w-full rounded-xl bg-[#C8A96E] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f] disabled:opacity-40">{editing ? 'Save Changes' : 'Add Chapter'}</button>
      </div>
    </Modal>
  );
}

function LessonModal({ open, chapterId, onClose, onSaved }: { open: boolean; chapterId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [completion, setCompletion] = useState(0);

  useEffect(() => { if (open) { setName(''); setCompletion(0); } }, [open]);

  const save = async () => {
    if (!name.trim()) return;
    await addRecord('lessons', { chapter_id: chapterId, name: name.trim(), completion, time_spent: 0, created_at: new Date().toISOString() });
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Lesson" maxWidth="max-w-md">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Lesson Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Goodwill Valuation" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Completion: {completion}%</label>
          <input type="range" min={0} max={100} value={completion} onChange={e => setCompletion(+e.target.value)} className="w-full accent-[#C8A96E]" />
        </div>
        <button onClick={save} disabled={!name.trim()} className="w-full rounded-xl bg-[#C8A96E] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f] disabled:opacity-40">Add Lesson</button>
      </div>
    </Modal>
  );
}
