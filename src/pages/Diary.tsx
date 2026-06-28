import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAll, addRecord, updateRecord, removeRecord } from '../lib/store';
import type { DiaryEntry, LifeNote } from '../lib/types';
import { formatDate, todayISO } from '../lib/utils';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { Plus, Edit2, Trash2, Pin, Search, BookHeart, StickyNote, Calendar, Save } from 'lucide-react';

type DiaryView = 'log' | 'notes';

const MOODS = ['😢', '😕', '😐', '🙂', '😊'];
const MOOD_LABELS = ['Terrible', 'Low', 'Okay', 'Good', 'Great'];
const MENTAL_TAGS = ['Focused', 'Tired', 'Motivated', 'Anxious', 'Calm', 'Stressed', 'Confident', 'Distracted', 'Grateful', 'Frustrated'];

export default function Diary() {
  const { refreshKey, refreshAll } = useApp();
  const [view, setView] = useState<DiaryView>('log');
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [notes, setNotes] = useState<LifeNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [noteModal, setNoteModal] = useState(false);
  const [editingNote, setEditingNote] = useState<LifeNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'entry' | 'note'; id: string; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');

  const loadData = async () => {
    const [e, n] = await Promise.all([getAll<DiaryEntry>('diary_entries'), getAll<LifeNote>('life_notes')]);
    setEntries(e.sort((a,b) => b.date.localeCompare(a.date)));
    setNotes(n.sort((a,b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated_at.localeCompare(a.updated_at)));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [refreshKey]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C8A96E] border-t-transparent" /></div>;
  }

  const todayEntry = entries.find(e => e.date === selectedDate);
  const noteCats = [...new Set(notes.map(n => n.category).filter(Boolean))];
  const filteredNotes = notes.filter(n => {
    if (filterCat !== 'all' && n.category !== filterCat) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!n.title.toLowerCase().includes(s) && !n.content.toLowerCase().includes(s) && !n.tags.some(t => t.toLowerCase().includes(s))) return false;
    }
    return true;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'entry') await removeRecord('diary_entries', deleteTarget.id);
    else await removeRecord('life_notes', deleteTarget.id);
    setDeleteTarget(null);
    loadData();
    refreshAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Diary</h1>
          <p className="text-sm text-zinc-500 mt-1">Your thoughts, your journey</p>
        </div>
        {view === 'notes' && (
          <button onClick={() => { setEditingNote(null); setNoteModal(true); }} className="flex items-center gap-2 rounded-xl bg-[#C8A96E] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f]"><Plus size={18} /> Add Note</button>
        )}
      </div>

      <div className="flex gap-1 rounded-xl border border-zinc-800 bg-[#1A1A1A] p-1 w-fit">
        {(['log','notes'] as DiaryView[]).map(v => (
          <button key={v} onClick={() => setView(v)} className={`rounded-lg px-5 py-1.5 text-sm font-medium capitalize transition-colors ${view === v ? 'bg-[#C8A96E] text-black' : 'text-zinc-400 hover:text-zinc-200'}`}>{v === 'log' ? 'Daily Log' : 'Life Notes'}</button>
        ))}
      </div>

      {view === 'log' && (
        <DailyLog
          entries={entries}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          todayEntry={todayEntry}
          onChanged={() => { loadData(); refreshAll(); }}
          onDelete={(entry: DiaryEntry) => setDeleteTarget({ type: 'entry', id: entry.id, name: entry.date })}
        />
      )}

      {view === 'notes' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..." className="w-full rounded-xl border border-zinc-700 bg-[#1A1A1A] pl-9 pr-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-[#C8A96E]" />
            </div>
            {noteCats.length > 0 && (
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="rounded-xl border border-zinc-700 bg-[#1A1A1A] px-3 py-2.5 text-sm text-zinc-200 outline-none">
                <option value="all">All Categories</option>
                {noteCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          {filteredNotes.length === 0 ? (
            <EmptyState icon={<StickyNote size={36} />} message="No life notes yet. Capture your thoughts, ideas, and reflections." action={<button onClick={() => setNoteModal(true)} className="rounded-xl bg-[#C8A96E] px-4 py-2 text-sm font-semibold text-black hover:bg-[#d4b87f]">Add Note</button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredNotes.map(note => (
                <div key={note.id} className={`rounded-2xl border bg-[#1A1A1A] p-4 flex flex-col ${note.pinned ? 'border-[#C8A96E]/40' : 'border-zinc-800'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-zinc-100 flex-1 line-clamp-2">{note.title}</h3>
                    {note.pinned && <Pin size={14} className="text-[#C8A96E] fill-[#C8A96E]" />}
                  </div>
                  <p className="text-xs text-zinc-400 flex-1 line-clamp-4 mb-3 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {note.category && <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{note.category}</span>}
                      {note.tags.slice(0, 2).map(t => <span key={t} className="rounded-md bg-[#C8A96E]/10 px-1.5 py-0.5 text-[10px] text-[#C8A96E]">#{t}</span>)}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingNote(note); setNoteModal(true); }} className="text-zinc-500 hover:text-zinc-300"><Edit2 size={13} /></button>
                      <button onClick={() => setDeleteTarget({ type: 'note', id: note.id, name: note.title })} className="text-zinc-500 hover:text-[#C0392B]"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {noteModal && (
        <NoteModal open={noteModal} editing={editingNote} onClose={() => setNoteModal(false)} onSaved={() => { setNoteModal(false); loadData(); refreshAll(); }} />
      )}

      <ConfirmDialog open={!!deleteTarget} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

function DailyLog({ entries, selectedDate, setSelectedDate, todayEntry, onChanged, onDelete }: any) {
  const [mood, setMood] = useState(todayEntry?.mood || 3);
  const [tags, setTags] = useState<string[]>(todayEntry?.mental_tags || []);
  const [rating, setRating] = useState(todayEntry?.performance_rating || 3);
  const [journal, setJournal] = useState(todayEntry?.journal_text || '');
  const [learned, setLearned] = useState(todayEntry?.learned || '');
  const [planned, setPlanned] = useState(todayEntry?.planned || '');
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const entryId = useRef(todayEntry?.id || null);
  const isSaving = useRef(false);

  // Reset form when date changes or entry changes
  useEffect(() => {
    setMood(todayEntry?.mood || 3);
    setTags(todayEntry?.mental_tags || []);
    setRating(todayEntry?.performance_rating || 3);
    setJournal(todayEntry?.journal_text || '');
    setLearned(todayEntry?.learned || '');
    setPlanned(todayEntry?.planned || '');
    entryId.current = todayEntry?.id || null;
    setDirty(false);
  }, [todayEntry?.id, selectedDate]);

  const doSave = useCallback(async () => {
    if (isSaving.current) return;
    // Don't save if nothing meaningful has been entered and no existing entry
    if (!journal && !learned && !planned && mood === 3 && tags.length === 0 && rating === 3 && !entryId.current) {
      return;
    }
    isSaving.current = true;
    const data = { date: selectedDate, mood, mental_tags: tags, performance_rating: rating, journal_text: journal, learned, planned };
    try {
      if (entryId.current) {
        await updateRecord('diary_entries', entryId.current, data);
      } else {
        const rec = await addRecord('diary_entries', data);
        entryId.current = rec.id;
      }
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2000);
      onChanged();
    } finally {
      isSaving.current = false;
    }
  }, [selectedDate, mood, tags, rating, journal, learned, planned, onChanged]);

  // Auto-save every 15 seconds if dirty
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      doSave();
    }, 15000);
    return () => clearTimeout(timer);
  }, [dirty, doSave]);

  // Save on unmount (when navigating away)
  useEffect(() => {
    return () => {
      if (dirty) {
        doSave();
      }
    };
  }, [dirty, doSave]);

  const markDirty = () => { if (!dirty) setDirty(true); };

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    markDirty();
  };

  // Mood calendar
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const entryMap: Record<string, DiaryEntry> = {};
  entries.forEach((e: DiaryEntry) => { entryMap[e.date] = e; });

  return (
    <div className="space-y-4">
      {/* Date selector + Save */}
      <div className="flex items-center gap-3 flex-wrap">
        <Calendar size={18} className="text-[#C8A96E]" />
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="rounded-lg border border-zinc-700 bg-[#1A1A1A] px-3 py-1.5 text-sm text-zinc-200 outline-none focus:border-[#C8A96E]" />
        <button
          onClick={doSave}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            dirty ? 'bg-[#C8A96E] text-black hover:bg-[#d4b87f]' : 'bg-zinc-800 text-zinc-500'
          }`}
        >
          <Save size={13} /> Save
        </button>
        {saved && <span className="text-xs text-[#4CAF7D]">Saved ✓</span>}
        {dirty && <span className="text-xs text-[#E07B39]">Unsaved changes</span>}
        {todayEntry && <button onClick={() => onDelete(todayEntry)} className="ml-auto text-xs text-zinc-500 hover:text-[#C0392B]">Delete entry</button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Mood + Tags + Rating */}
        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Mood</label>
            <div className="flex justify-between">
              {MOODS.map((emoji, i) => (
                <button key={i} onClick={() => { setMood(i + 1); markDirty(); }} className={`flex flex-col items-center gap-1 rounded-xl p-2 transition-all ${mood === i + 1 ? 'bg-[#C8A96E]/10 scale-110' : ''}`}>
                  <span className="text-2xl">{emoji}</span>
                  <span className={`text-[9px] ${mood === i + 1 ? 'text-[#C8A96E]' : 'text-zinc-600'}`}>{MOOD_LABELS[i]}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Mental State</label>
            <div className="flex flex-wrap gap-1.5">
              {MENTAL_TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)} className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${tags.includes(tag) ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]' : 'border-zinc-700 text-zinc-500'}`}>{tag}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">Performance Rating</label>
            <div className="flex gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => { setRating(n); markDirty(); }} className="text-2xl">
                  <span className={n <= rating ? 'text-[#C8A96E]' : 'text-zinc-700'}>★</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Journal entries */}
        <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5 space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Journal</label>
            <textarea value={journal} onChange={e => { setJournal(e.target.value); markDirty(); }} rows={4} placeholder="How was your day?" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-[#C8A96E] resize-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">What I Learned</label>
            <textarea value={learned} onChange={e => { setLearned(e.target.value); markDirty(); }} rows={2} placeholder="Today's key learning..." className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-[#C8A96E] resize-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">What I Planned</label>
            <textarea value={planned} onChange={e => { setPlanned(e.target.value); markDirty(); }} rows={2} placeholder="Tomorrow's plan..." className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-[#C8A96E] resize-none" />
          </div>
          <p className="text-[10px] text-zinc-600 text-right">Auto-saves every 15s · Click Save to save now</p>
        </div>
      </div>

      {/* Mood Calendar */}
      <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Mood Calendar — {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['S','M','T','W','T','F','S'].map((d, i) => <div key={i} className="text-center text-[10px] text-zinc-600 py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const entry = entryMap[dateStr];
            const isToday = dateStr === todayISO();
            const isSelected = dateStr === selectedDate;
            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all hover:ring-1 hover:ring-[#C8A96E]/40 ${isSelected ? 'ring-2 ring-[#C8A96E]' : isToday ? 'border border-[#C8A96E]/40' : ''} ${entry ? '' : 'bg-zinc-900/30'}`}
                style={entry ? { background: `${['#C0392B','#E07B39','#71717a','#4CAF7D','#C8A96E'][entry.mood - 1]}20` } : {}}
              >
                <span className={isToday ? 'text-[#C8A96E] font-bold' : 'text-zinc-500'}>{day}</span>
                {entry && <span className="text-sm leading-none">{MOODS[entry.mood - 1]}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NoteModal({ open, editing, onClose, onSaved }: any) {
  const [title, setTitle] = useState(editing?.title || '');
  const [content, setContent] = useState(editing?.content || '');
  const [category, setCategory] = useState(editing?.category || '');
  const [tagsStr, setTagsStr] = useState(editing?.tags?.join(', ') || '');
  const [pinned, setPinned] = useState(editing?.pinned || false);

  useEffect(() => {
    if (open) {
      setTitle(editing?.title || '');
      setContent(editing?.content || '');
      setCategory(editing?.category || '');
      setTagsStr(editing?.tags?.join(', ') || '');
      setPinned(editing?.pinned || false);
    }
  }, [open, editing]);

  const save = async () => {
    if (!title.trim()) return;
    const data = {
      title: title.trim(),
      content: content.trim(),
      category: category.trim(),
      tags: tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean),
      pinned,
    };
    if (editing) await updateRecord('life_notes', editing.id, data);
    else await addRecord('life_notes', { ...data, created_at: new Date().toISOString() });
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Note' : 'Add Note'}>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Note title" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Content</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={6} placeholder="Write your thoughts..." className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-[#C8A96E] resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Category</label>
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Ideas" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Tags (comma-separated)</label>
            <input value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="tag1, tag2" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
        </div>
        <button onClick={() => setPinned(!pinned)} className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium ${pinned ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]' : 'border-zinc-700 text-zinc-400'}`}>
          <Pin size={16} className={pinned ? 'fill-[#C8A96E]' : ''} /> {pinned ? 'Pinned' : 'Pin note'}
        </button>
        <button onClick={save} disabled={!title.trim()} className="w-full rounded-xl bg-[#C8A96E] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f] disabled:opacity-40">{editing ? 'Save Changes' : 'Add Note'}</button>
      </div>
    </Modal>
  );
}
