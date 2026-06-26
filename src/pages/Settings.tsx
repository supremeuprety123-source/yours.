import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAll, addRecord, updateRecord, removeRecord } from '../lib/store';
import { doSync, pullFromCloud } from '../lib/sync';
import { supabase, supabaseUrl, supabaseKey } from '../lib/supabase';
import { db } from '../lib/db';
import type { Profile, Exam, CALevel } from '../lib/types';
import { formatDate, daysUntil } from '../lib/utils';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { User, Calendar, Lock, DollarSign, Timer, Bell, RefreshCw, Download, Info, Plus, Edit2, Trash2, Check, AlertCircle } from 'lucide-react';

const CURRENCIES = [
  { code: 'NPR', symbol: 'रू' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'INR', symbol: '₹' },
  { code: 'JPY', symbol: '¥' },
];

const SECTIONS = [
  { key: 'profile', label: 'Profile' },
  { key: 'papers', label: 'Papers & Study' },
  { key: 'chapters', label: 'Chapters' },
  { key: 'lessons', label: 'Lessons' },
  { key: 'routines', label: 'Routines' },
  { key: 'focus_sessions', label: 'Focus Sessions' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'categories', label: 'Finance Categories' },
  { key: 'diary_entries', label: 'Diary Entries' },
  { key: 'life_notes', label: 'Life Notes' },
  { key: 'exams', label: 'Exams' },
];

export default function Settings() {
  const { profile, refreshProfile, refreshAll, online, syncStatus } = useApp();
  const [exams, setExams] = useState<Exam[]>([]);
  const [examModal, setExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [deleteExam, setDeleteExam] = useState<Exam | null>(null);
  const [pinChange, setPinChange] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [exportModal, setExportModal] = useState(false);
  const [exportSections, setExportSections] = useState<Record<string, boolean>>({});
  const [exportResult, setExportResult] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [diagResult, setDiagResult] = useState<string>('');
  const [diagRunning, setDiagRunning] = useState(false);

  useEffect(() => {
    getAll<Exam>('exams').then(e => setExams(e.sort((a,b) => a.date.localeCompare(b.date))));
  }, []);

  if (!profile) return null;

  const showSaved = (msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const updateProfile = async (changes: Partial<Profile>) => {
    await updateRecord('profile', profile.id, changes);
    await refreshProfile();
    refreshAll();
    showSaved('Saved');
  };

  const handleSaveExam = async (name: string, date: string, marksObtained: number, marksTotal: number) => {
    if (editingExam) {
      await updateRecord('exams', editingExam.id, { name, date, marks_obtained: marksObtained, marks_total: marksTotal });
    } else {
      await addRecord('exams', { name, date, marks_obtained: marksObtained, marks_total: marksTotal });
    }
    setExamModal(false);
    setEditingExam(null);
    getAll<Exam>('exams').then(e => setExams(e.sort((a,b) => a.date.localeCompare(b.date))));
    refreshAll();
  };

  const handleDeleteExam = async () => {
    if (!deleteExam) return;
    await removeRecord('exams', deleteExam.id);
    setDeleteExam(null);
    getAll<Exam>('exams').then(e => setExams(e.sort((a,b) => a.date.localeCompare(b.date))));
    refreshAll();
  };

  const handlePinChange = async () => {
    if (newPin.length !== 4) return;
    await updateProfile({ pin: newPin });
    setPinChange(false);
    setNewPin('');
    showSaved('PIN updated');
  };

  const runDiagnostic = async () => {
    setDiagRunning(true);
    setDiagResult('Running diagnostics...\n');
    const log: string[] = [];

    // Step 1: Check env vars
    log.push(`1. Supabase URL: ${supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING!'}`);
    log.push(`2. Anon Key: ${supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'MISSING!'}`);
    
    if (!supabaseUrl || !supabaseKey) {
      log.push('\n❌ Environment variables are missing!');
      setDiagResult(log.join('\n'));
      setDiagRunning(false);
      return;
    }

    // Step 2: Test basic connection — try to select from profile table
    log.push('\n3. Testing connection to Supabase...');
    try {
      const { data, error } = await supabase.from('profile').select('*').limit(1);
      if (error) {
        log.push(`❌ Query failed: ${error.message}`);
        log.push(`   Code: ${error.code}`);
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          log.push('   → The tables do not exist. Run the SQL in Supabase SQL Editor.');
        }
        if (error.message.includes('permission') || error.message.includes('RLS') || error.message.includes('policy')) {
          log.push('   → RLS is blocking access. Run: ALTER TABLE profile DISABLE ROW LEVEL SECURITY;');
        }
      } else {
        log.push(`✅ Connection works! Profile table returned ${data.length} rows.`);
      }
    } catch (err: any) {
      log.push(`❌ Network error: ${err.message}`);
    }

    // Step 3: Test insert into profile
    log.push('\n4. Testing write access...');
    try {
      const testId = 'diag-test-' + Date.now();
      const { error: insertError } = await supabase.from('profile').upsert({
        id: testId,
        name: 'Diagnostic Test',
        ca_level: 'Foundation',
        pin_enabled: false,
        pin: '',
        currency_code: 'NPR',
        currency_symbol: 'रू',
        focus_pomodoro: 25,
        focus_short_break: 5,
        focus_long_break: 15,
        focus_target: 120,
        notifications: {},
      });
      if (insertError) {
        log.push(`❌ Write failed: ${insertError.message}`);
      } else {
        log.push('✅ Write works!');
        // Clean up
        await supabase.from('profile').delete().eq('id', testId);
        log.push('✅ Cleanup done.');
      }
    } catch (err: any) {
      log.push(`❌ Write error: ${err.message}`);
    }

    // Step 4: Check pending records in IndexedDB
    log.push('\n5. Checking local pending records...');
    try {
      const pendingProfile = await db.profile.where('sync_status').equals('pending').toArray();
      log.push(`   Pending profile records: ${pendingProfile.length}`);
      const pendingPapers = await db.papers.where('sync_status').equals('pending').toArray();
      log.push(`   Pending papers: ${pendingPapers.length}`);
      const pendingRoutines = await db.routines.where('sync_status').equals('pending').toArray();
      log.push(`   Pending routines: ${pendingRoutines.length}`);
    } catch (err: any) {
      log.push(`   Error checking pending: ${err.message}`);
    }

    log.push('\n--- Diagnostic complete ---');
    setDiagResult(log.join('\n'));
    setDiagRunning(false);
  };

  const handleExport = async () => {
    const data: Record<string, any> = {};
    for (const section of SECTIONS) {
      if (exportSections[section.key]) {
        data[section.key] = await db.table(section.key).toArray();
      }
    }
    const json = JSON.stringify({ exported_at: new Date().toISOString(), app: 'YOURS', data }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yours-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportResult('Exported successfully!');
    setTimeout(() => { setExportResult(''); setExportModal(false); }, 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Customize YOURS to fit your life</p>
      </div>

      {savedMsg && <div className="fixed top-4 right-4 z-50 rounded-xl bg-[#4CAF7D] px-4 py-2 text-sm font-medium text-black">{savedMsg}</div>}

      {/* Profile */}
      <SettingsCard icon={<User size={18} />} title="Profile">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Name</label>
            <input value={profile.name} onChange={e => updateProfile({ name: e.target.value })} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">CA Level</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Foundation','Intermediate','Final'] as CALevel[]).map(l => {
                const levelIdx = (['Foundation','Intermediate','Final'] as CALevel[]).indexOf(l);
                const currentIdx = (['Foundation','Intermediate','Final'] as CALevel[]).indexOf(profile.ca_level as CALevel);
                const isLocked = levelIdx > currentIdx;
                const isPast = levelIdx < currentIdx;
                return (
                  <button
                    key={l}
                    onClick={() => {
                      if (isLocked) return;
                      updateProfile({ ca_level: l });
                    }}
                    disabled={isLocked}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium flex items-center justify-center gap-1.5 ${
                      profile.ca_level === l
                        ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]'
                        : isLocked
                        ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                        : isPast
                        ? 'border-[#4CAF7D]/30 text-[#4CAF7D]'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {isLocked && <Lock size={12} />}
                    {isPast && <Check size={12} />}
                    {l}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-zinc-600 mt-1">
              {profile.ca_level === 'Final'
                ? 'You are at the final level — CA Final. All the best! 🎯'
                : 'Complete all chapters in your current level to unlock the next. Switching preserves all data — papers are filtered by level.'}
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* Exams */}
      <SettingsCard icon={<Calendar size={18} />} title="Exams">
        <div className="space-y-2">
          {exams.length === 0 ? (
            <p className="text-sm text-zinc-600 py-2">No exams added yet.</p>
          ) : (
            exams.map(ex => (
              <div key={ex.id} className="flex items-center gap-3 rounded-lg bg-zinc-900/50 px-3 py-2">
                <div className="flex-1">
                  <div className="text-sm text-zinc-200">{ex.name}</div>
                  <div className="text-xs text-zinc-500">{formatDate(ex.date)} · {daysUntil(ex.date) >= 0 ? `${daysUntil(ex.date)} days left` : 'past'}{ex.marks_total > 0 ? ` · Scored ${ex.marks_obtained}/${ex.marks_total} (${Math.round(ex.marks_obtained/ex.marks_total*100)}%)` : ''}</div>
                </div>
                <button onClick={() => { setEditingExam(ex); setExamModal(true); }} className="text-zinc-500 hover:text-zinc-300"><Edit2 size={14} /></button>
                <button onClick={() => setDeleteExam(ex)} className="text-zinc-500 hover:text-[#C0392B]"><Trash2 size={14} /></button>
              </div>
            ))
          )}
          <button onClick={() => { setEditingExam(null); setExamModal(true); }} className="flex items-center gap-1.5 text-sm text-[#C8A96E] hover:underline pt-1"><Plus size={16} /> Add Exam</button>
        </div>
      </SettingsCard>

      {/* Security */}
      <SettingsCard icon={<Lock size={18} />} title="Security">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-zinc-200">PIN Lock</div>
              <div className="text-xs text-zinc-500">Require PIN to open the app</div>
            </div>
            <Toggle on={profile.pin_enabled} onToggle={() => updateProfile({ pin_enabled: !profile.pin_enabled, pin: !profile.pin_enabled ? profile.pin || '0000' : profile.pin })} />
          </div>
          {profile.pin_enabled && (
            <button onClick={() => setPinChange(true)} className="text-sm text-[#C8A96E] hover:underline">Change PIN</button>
          )}
        </div>
      </SettingsCard>

      {/* Currency */}
      <SettingsCard icon={<DollarSign size={18} />} title="Currency">
        <div className="grid grid-cols-3 gap-2">
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => updateProfile({ currency_code: c.code, currency_symbol: c.symbol })} className={`rounded-xl border px-3 py-2 text-sm font-medium ${profile.currency_code === c.code ? 'border-[#C8A96E] bg-[#C8A96E]/10 text-[#C8A96E]' : 'border-zinc-700 text-zinc-400'}`}>
              <span className="text-base">{c.symbol}</span> {c.code}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-zinc-600 mt-2">Display-only change. Existing transactions keep their original amounts.</p>
      </SettingsCard>

      {/* Focus Timer */}
      <SettingsCard icon={<Timer size={18} />} title="Focus Timer Durations">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Pomodoro (min)</label>
            <input type="number" value={profile.focus_pomodoro} onChange={e => updateProfile({ focus_pomodoro: +e.target.value })} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Short Break (min)</label>
            <input type="number" value={profile.focus_short_break} onChange={e => updateProfile({ focus_short_break: +e.target.value })} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Long Break (min)</label>
            <input type="number" value={profile.focus_long_break} onChange={e => updateProfile({ focus_long_break: +e.target.value })} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-500">Daily Target (min)</label>
            <input type="number" value={profile.focus_target} onChange={e => updateProfile({ focus_target: +e.target.value })} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
        </div>
      </SettingsCard>

      {/* Notifications */}
      <SettingsCard icon={<Bell size={18} />} title="Notifications">
        <div className="space-y-3">
          {[
            { key: 'morning', label: 'Morning Reminder', desc: 'Daily check-in at 8 AM' },
            { key: 'streak', label: 'Study Streak', desc: 'Alert when streak is at risk' },
            { key: 'routine', label: 'Routine Alerts', desc: 'Remind upcoming routines' },
            { key: 'budget', label: 'Budget Alerts', desc: 'Warn when budget exceeds 75%' },
          ].map(n => (
            <div key={n.key} className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-200">{n.label}</div>
                <div className="text-xs text-zinc-500">{n.desc}</div>
              </div>
              <Toggle on={profile.notifications[n.key as keyof typeof profile.notifications]} onToggle={() => updateProfile({ notifications: { ...profile.notifications, [n.key]: !profile.notifications[n.key as keyof typeof profile.notifications] } })} />
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Sync */}
      <SettingsCard icon={<RefreshCw size={18} />} title="Sync Status">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Connection</span>
            <span className={`text-sm font-medium ${online ? 'text-[#4CAF7D]' : 'text-[#C0392B]'}`}>{online ? 'Online' : 'Offline'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">Sync Status</span>
            <span className={`text-sm font-medium capitalize ${syncStatus === 'error' ? 'text-[#C0392B]' : syncStatus === 'synced' ? 'text-[#4CAF7D]' : 'text-zinc-400'}`}>{syncStatus}</span>
          </div>
          {syncStatus === 'error' && (
            <div className="rounded-xl border border-[#C0392B]/30 bg-[#C0392B]/5 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-[#C0392B] mt-0.5 flex-shrink-0" />
                <div className="text-xs text-zinc-400">
                  <p className="font-medium text-[#C0392B] mb-1">Sync failed — run diagnostic below</p>
                  <p>Click "Run Diagnostic" to see the exact error and fix it.</p>
                </div>
              </div>
            </div>
          )}
          <button onClick={() => { pullFromCloud().then(() => doSync()); }} disabled={!online} className="w-full rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40">
            Sync Now
          </button>
          <button onClick={runDiagnostic} disabled={diagRunning} className="w-full rounded-xl bg-zinc-800 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-40">
            {diagRunning ? 'Running...' : 'Run Diagnostic'}
          </button>
          {diagResult && (
            <pre className="mt-2 rounded-xl border border-zinc-800 bg-[#0D0D0D] p-3 text-[11px] text-zinc-400 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">{diagResult}</pre>
          )}
        </div>
      </SettingsCard>

      {/* Export */}
      <SettingsCard icon={<Download size={18} />} title="Data Export">
        <p className="text-xs text-zinc-500 mb-3">Export selected sections as a single JSON file.</p>
        <button onClick={() => { setExportSections(Object.fromEntries(SECTIONS.map(s => [s.key, true]))); setExportModal(true); }} className="w-full rounded-xl bg-[#C8A96E] py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f]">
          Export Data
        </button>
      </SettingsCard>

      {/* About */}
      <SettingsCard icon={<Info size={18} />} title="About">
        <div className="space-y-1 text-sm text-zinc-400">
          <div className="flex justify-between"><span>App</span><span className="text-zinc-300">YOURS — Personal Life OS</span></div>
          <div className="flex justify-between"><span>Built for</span><span className="text-zinc-300">Supreme Uprety</span></div>
          <div className="flex justify-between"><span>Version</span><span className="text-zinc-300">1.0.0</span></div>
          <div className="flex justify-between"><span>Storage</span><span className="text-zinc-300">IndexedDB + Supabase</span></div>
          <p className="text-xs text-zinc-600 pt-2 border-t border-zinc-800 mt-2">One app, one life, no excuses.</p>
        </div>
      </SettingsCard>

      {/* Exam Modal */}
      {examModal && <ExamModal open={examModal} editing={editingExam} onClose={() => { setExamModal(false); setEditingExam(null); }} onSave={handleSaveExam} />}

      {/* PIN Change Modal */}
      {pinChange && (
        <Modal open={pinChange} onClose={() => setPinChange(false)} title="Change PIN" maxWidth="max-w-sm">
          <div className="space-y-4">
            <input type="tel" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="New 4-digit PIN" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-3 text-center text-2xl tracking-[0.5em] text-zinc-100 outline-none focus:border-[#C8A96E]" />
            <button onClick={handlePinChange} disabled={newPin.length !== 4} className="w-full rounded-xl bg-[#C8A96E] py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f] disabled:opacity-40">Update PIN</button>
          </div>
        </Modal>
      )}

      {/* Export Modal */}
      {exportModal && (
        <Modal open={exportModal} onClose={() => setExportModal(false)} title="Export Data" maxWidth="max-w-md">
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">Select sections to export:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {SECTIONS.map(s => (
                <label key={s.key} className="flex items-center gap-3 rounded-lg bg-zinc-900/50 px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={exportSections[s.key] || false} onChange={e => setExportSections(prev => ({ ...prev, [s.key]: e.target.checked }))} className="accent-[#C8A96E]" />
                  <span className="text-sm text-zinc-300">{s.label}</span>
                </label>
              ))}
            </div>
            {exportResult && <p className="text-sm text-[#4CAF7D] flex items-center gap-1"><Check size={16} /> {exportResult}</p>}
            <button onClick={handleExport} className="w-full rounded-xl bg-[#C8A96E] py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f]">Download JSON</button>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteExam} title="Delete Exam" message={`Delete "${deleteExam?.name}"?`} onConfirm={handleDeleteExam} onCancel={() => setDeleteExam(null)} />
    </div>
  );
}

function SettingsCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#C8A96E]">{icon}</span>
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-[#C8A96E]' : 'bg-zinc-700'}`}>
      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function ExamModal({ open, editing, onClose, onSave }: { open: boolean; editing: Exam | null; onClose: () => void; onSave: (name: string, date: string, marksObtained: number, marksTotal: number) => void }) {
  const [name, setName] = useState(editing?.name || '');
  const [date, setDate] = useState(editing?.date || '');
  const [marksObtained, setMarksObtained] = useState(editing?.marks_obtained || '');
  const [marksTotal, setMarksTotal] = useState(editing?.marks_total || '');

  useEffect(() => {
    if (open) { setName(editing?.name || ''); setDate(editing?.date || ''); setMarksObtained(editing?.marks_obtained || ''); setMarksTotal(editing?.marks_total || ''); }
  }, [open, editing]);

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Exam' : 'Add Exam'} maxWidth="max-w-sm">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Exam Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CA Inter Group I Exam" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Exam Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Marks Obtained</label>
            <input type="number" value={marksObtained} onChange={e => setMarksObtained(+e.target.value)} placeholder="—" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Marks Total</label>
            <input type="number" value={marksTotal} onChange={e => setMarksTotal(+e.target.value)} placeholder="—" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
        </div>
        <p className="text-xs text-zinc-500">Leave marks blank until results are out, then fill them in.</p>
        <button onClick={() => name.trim() && onSave(name.trim(), date, +marksObtained || 0, +marksTotal || 0)} disabled={!name.trim() || !date} className="w-full rounded-xl bg-[#C8A96E] py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f] disabled:opacity-40">{editing ? 'Save Changes' : 'Add Exam'}</button>
      </div>
    </Modal>
  );
}
