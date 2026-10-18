import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAll, addRecord, updateRecord, removeRecord } from '../lib/store';
import { doSync, pullFromCloud, markAllPending } from '../lib/sync';
import { supabase, supabaseUrl, supabaseKey } from '../lib/supabase';
import { db } from '../lib/db';
import type { Profile, Exam, MockScore, CALevel } from '../lib/types';
import { formatDate, daysUntil, todayISO } from '../lib/utils';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { User, Calendar, Lock, DollarSign, Timer, Bell, RefreshCw, Download, Info, Plus, Edit2, Trash2, Check, AlertCircle, Award } from 'lucide-react';

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
  { key: 'exams', label: 'Exam Dates' },
  { key: 'mock_scores', label: 'Mock Scores' },
  { key: 'day_logs', label: 'Day Logs' },
  { key: 'plan_blocks', label: 'Plan Blocks' },
];

export default function Settings() {
  const { profile, refreshProfile, refreshAll, online, syncStatus, forceSync } = useApp();
  const [exams, setExams] = useState<Exam[]>([]);
  const [examModal, setExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [deleteExam, setDeleteExam] = useState<Exam | null>(null);
  const [mocks, setMocks] = useState<MockScore[]>([]);
  const [mockModal, setMockModal] = useState(false);
  const [editingMock, setEditingMock] = useState<MockScore | null>(null);
  const [deleteMock, setDeleteMock] = useState<MockScore | null>(null);
  const [pinChange, setPinChange] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [exportModal, setExportModal] = useState(false);
  const [exportSections, setExportSections] = useState<Record<string, boolean>>({});
  const [exportResult, setExportResult] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [diagResult, setDiagResult] = useState<string>('');
  const [diagRunning, setDiagRunning] = useState(false);

  const loadExamAndMocks = async () => {
    const [e, m] = await Promise.all([
      getAll<Exam>('exams'),
      getAll<MockScore>('mock_scores'),
    ]);
    setExams(e.sort((a, b) => a.date.localeCompare(b.date)));
    setMocks(m.sort((a, b) => b.date.localeCompare(a.date)));
  };

  useEffect(() => { loadExamAndMocks(); }, []);

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

  const handleSaveExam = async (name: string, date: string) => {
    if (editingExam) {
      await updateRecord('exams', editingExam.id, { name, date });
    } else {
      await addRecord('exams', { name, date, marks_obtained: 0, marks_total: 0 });
    }
    setExamModal(false);
    setEditingExam(null);
    await loadExamAndMocks();
    refreshAll();
  };

  const handleDeleteExam = async () => {
    if (!deleteExam) return;
    await removeRecord('exams', deleteExam.id);
    setDeleteExam(null);
    await loadExamAndMocks();
    refreshAll();
  };

  const handleSaveMock = async (data: Partial<MockScore>) => {
    const payload = {
      date: data.date || todayISO(),
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
    setMockModal(false);
    setEditingMock(null);
    await loadExamAndMocks();
    refreshAll();
  };

  const handleDeleteMock = async () => {
    if (!deleteMock) return;
    await removeRecord('mock_scores', deleteMock.id);
    setDeleteMock(null);
    await loadExamAndMocks();
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
        <h1 className="y-page-title">Settings</h1>
        <p className="text-sm text-[#F7F1E7]0 mt-1">Customize YOURS to fit your life</p>
      </div>

      {savedMsg && <div className="fixed top-4 right-4 z-50 rounded-xl bg-[#8FBC8F] px-4 py-2 text-sm font-medium text-black">{savedMsg}</div>}

      {/* Profile */}
      <SettingsCard icon={<User size={18} />} title="Profile">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-[#F7F1E7]0">Name</label>
            <input value={profile.name} onChange={e => updateProfile({ name: e.target.value })} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#F7F1E7]0">CA Level</label>
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
                        ? 'border-[#E8B86D] bg-[#E8B86D]/10 text-[#E8B86D]'
                        : isLocked
                        ? 'border-[rgba(255,236,200,0.07)] text-[#6B6560] cursor-not-allowed'
                        : isPast
                        ? 'border-[#8FBC8F]/30 text-[#8FBC8F]'
                        : 'border-[rgba(255,236,200,0.1)] text-[#A8A29A] hover:border-[#4A453C]'
                    }`}
                  >
                    {isLocked && <Lock size={12} />}
                    {isPast && <Check size={12} />}
                    {l}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-[#6B6560] mt-1">
              {profile.ca_level === 'Final'
                ? 'You are at the final level — CA Final. All the best! 🎯'
                : 'Complete all chapters in your current level to unlock the next. Switching preserves all data — papers are filtered by level.'}
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* Official exam dates — Home countdown */}
      <SettingsCard icon={<Calendar size={18} />} title="Official Exam Dates">
        <p className="text-xs text-[#8A8478] mb-3">Shown as countdown on Home. Syncs with Supabase.</p>
        <div className="space-y-2">
          {exams.length === 0 ? (
            <p className="text-sm text-[#6B6560] py-1">No exam dates yet.</p>
          ) : (
            exams.map(ex => (
              <div key={ex.id} className="flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#EDE6DA]">{ex.name}</div>
                  <div className="text-xs text-[#8A8478]">
                    {formatDate(ex.date)} · {daysUntil(ex.date) >= 0 ? `${daysUntil(ex.date)} days left` : 'past'}
                  </div>
                </div>
                <button onClick={() => { setEditingExam(ex); setExamModal(true); }} className="text-[#8A8478] hover:text-[#D6CFC4]"><Edit2 size={14} /></button>
                <button onClick={() => setDeleteExam(ex)} className="text-[#8A8478] hover:text-[#E07A5F]"><Trash2 size={14} /></button>
              </div>
            ))
          )}
          <button onClick={() => { setEditingExam(null); setExamModal(true); }} className="flex items-center gap-1.5 text-sm text-[#E8B86D] hover:underline pt-1">
            <Plus size={16} /> Add exam date
          </button>
        </div>
      </SettingsCard>

      {/* Mock Score Log — same data as Planner → Plan */}
      <SettingsCard icon={<Award size={18} />} title="Mock Score Log">
        <p className="text-xs text-[#8A8478] mb-3">Same log as Planner → Plan. Syncs to Supabase.</p>
        <div className="space-y-2">
          {mocks.length === 0 ? (
            <p className="text-sm text-[#6B6560] py-1">No mocks logged yet.</p>
          ) : (
            mocks.map(m => {
              const negCost = (m.wrong_guesses || 0) * 0.25;
              return (
                <div key={m.id} className="rounded-xl border border-[rgba(255,236,200,0.07)] bg-black/25 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#EDE6DA]">{m.paper}</div>
                      <div className="text-[10px] text-[#8A8478]">{formatDate(m.date)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-[#E8B86D]">{m.score}<span className="text-xs text-[#8A8478]">/{m.max_score}</span></div>
                      <div className="flex items-center justify-end gap-2 mt-0.5">
                        <button onClick={() => { setEditingMock(m); setMockModal(true); }} className="text-[#8A8478] hover:text-[#D6CFC4]"><Edit2 size={12} /></button>
                        <button onClick={() => setDeleteMock(m)} className="text-[#6B6560] hover:text-[#E07A5F]"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-[#8A8478]">
                    <span>Confident: {m.confident_attempts}</span>
                    <span>Guessed: {m.guessed_attempts}</span>
                    <span>Wrong guesses: {m.wrong_guesses}</span>
                    {m.wrong_guesses > 0 && <span className="text-[#E07A5F]">−{negCost} marks risk</span>}
                  </div>
                  {m.notes && <p className="mt-1 text-[11px] text-[#A8A29A]">{m.notes}</p>}
                </div>
              );
            })
          )}
          <button onClick={() => { setEditingMock(null); setMockModal(true); }} className="flex items-center gap-1.5 text-sm text-[#E8B86D] hover:underline pt-1">
            <Plus size={16} /> Log mock
          </button>
        </div>
      </SettingsCard>

      {/* Security */}
      <SettingsCard icon={<Lock size={18} />} title="Security">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[#EDE6DA]">PIN Lock</div>
              <div className="text-xs text-[#F7F1E7]0">Require PIN to open the app</div>
            </div>
            <Toggle on={profile.pin_enabled} onToggle={() => updateProfile({ pin_enabled: !profile.pin_enabled, pin: !profile.pin_enabled ? profile.pin || '0000' : profile.pin })} />
          </div>
          {profile.pin_enabled && (
            <button onClick={() => setPinChange(true)} className="text-sm text-[#E8B86D] hover:underline">Change PIN</button>
          )}
        </div>
      </SettingsCard>

      {/* Currency */}
      <SettingsCard icon={<DollarSign size={18} />} title="Currency">
        <div className="grid grid-cols-3 gap-2">
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => updateProfile({ currency_code: c.code, currency_symbol: c.symbol })} className={`rounded-xl border px-3 py-2 text-sm font-medium ${profile.currency_code === c.code ? 'border-[#E8B86D] bg-[#E8B86D]/10 text-[#E8B86D]' : 'border-[rgba(255,236,200,0.1)] text-[#A8A29A]'}`}>
              <span className="text-base">{c.symbol}</span> {c.code}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[#6B6560] mt-2">Display-only change. Existing transactions keep their original amounts.</p>
      </SettingsCard>

      {/* Focus Timer */}
      <SettingsCard icon={<Timer size={18} />} title="Focus Timer Durations">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-[#F7F1E7]0">Pomodoro (min)</label>
            <input type="number" value={profile.focus_pomodoro} onChange={e => updateProfile({ focus_pomodoro: +e.target.value })} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-3 py-2 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#F7F1E7]0">Short Break (min)</label>
            <input type="number" value={profile.focus_short_break} onChange={e => updateProfile({ focus_short_break: +e.target.value })} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-3 py-2 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#F7F1E7]0">Long Break (min)</label>
            <input type="number" value={profile.focus_long_break} onChange={e => updateProfile({ focus_long_break: +e.target.value })} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-3 py-2 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#F7F1E7]0">Daily Target (min)</label>
            <input type="number" value={profile.focus_target} onChange={e => updateProfile({ focus_target: +e.target.value })} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-3 py-2 text-sm text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
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
                <div className="text-sm text-[#EDE6DA]">{n.label}</div>
                <div className="text-xs text-[#F7F1E7]0">{n.desc}</div>
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
            <span className="text-sm text-[#D6CFC4]">Connection</span>
            <span className={`text-sm font-medium ${online ? 'text-[#8FBC8F]' : 'text-[#E07A5F]'}`}>{online ? 'Online' : 'Offline'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#D6CFC4]">Sync Status</span>
            <span className={`text-sm font-medium capitalize ${syncStatus === 'error' ? 'text-[#E07A5F]' : syncStatus === 'synced' ? 'text-[#8FBC8F]' : 'text-[#A8A29A]'}`}>{syncStatus}</span>
          </div>
          {syncStatus === 'error' && (
            <div className="rounded-xl border border-[#E07A5F]/30 bg-[#E07A5F]/5 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-[#E07A5F] mt-0.5 flex-shrink-0" />
                <div className="text-xs text-[#A8A29A]">
                  <p className="font-medium text-[#E07A5F] mb-1">Sync failed — run diagnostic below</p>
                  <p>Click "Run Diagnostic" to see the exact error and fix it.</p>
                </div>
              </div>
            </div>
          )}
          <button onClick={() => forceSync()} disabled={!online} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] py-2.5 text-sm font-medium text-[#D6CFC4] hover:bg-[#2A261F] disabled:opacity-40">
            Sync Now
          </button>
          <button
            onClick={async () => {
              if (!online) return;
              await markAllPending();
              await forceSync();
            }}
            disabled={!online}
            className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] py-2.5 text-sm font-medium text-[#A8A29A] hover:bg-[#2A261F] disabled:opacity-40"
          >
            Re-upload all data to cloud
          </button>
          <p className="text-[10px] text-[#6B6560]">
            Use on your main device once so every table (routines, diary, exams, mocks, day logs, finance, life notes) is on Supabase for other devices.
          </p>
          <button onClick={runDiagnostic} disabled={diagRunning} className="w-full rounded-xl bg-[#2A261F] py-2.5 text-sm font-medium text-[#D6CFC4] hover:bg-zinc-700 disabled:opacity-40">
            {diagRunning ? 'Running...' : 'Run Diagnostic'}
          </button>
          {diagResult && (
            <pre className="mt-2 rounded-xl border border-[rgba(255,236,200,0.07)] bg-[#0F0E0C] p-3 text-[11px] text-[#A8A29A] whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">{diagResult}</pre>
          )}
        </div>
      </SettingsCard>

      {/* Export */}
      <SettingsCard icon={<Download size={18} />} title="Data Export">
        <p className="text-xs text-[#F7F1E7]0 mb-3">Export selected sections as a single JSON file.</p>
        <button onClick={() => { setExportSections(Object.fromEntries(SECTIONS.map(s => [s.key, true]))); setExportModal(true); }} className="w-full rounded-xl bg-[#E8B86D] py-2.5 text-sm font-semibold text-black hover:bg-[#F0C98A]">
          Export Data
        </button>
      </SettingsCard>

      {/* About */}
      <SettingsCard icon={<Info size={18} />} title="About">
        <div className="space-y-1 text-sm text-[#A8A29A]">
          <div className="flex justify-between"><span>App</span><span className="text-[#D6CFC4]">YOURS — Personal Life OS</span></div>
          <div className="flex justify-between"><span>Built for</span><span className="text-[#D6CFC4]">Supreme Uprety</span></div>
          <div className="flex justify-between"><span>Version</span><span className="text-[#D6CFC4]">1.0.0</span></div>
          <div className="flex justify-between"><span>Storage</span><span className="text-[#D6CFC4]">IndexedDB + Supabase</span></div>
          <p className="text-xs text-[#6B6560] pt-2 border-t border-[rgba(255,236,200,0.07)] mt-2">One app, one life, no excuses.</p>
        </div>
      </SettingsCard>

      {examModal && (
        <ExamDateModal
          open={examModal}
          editing={editingExam}
          onClose={() => { setExamModal(false); setEditingExam(null); }}
          onSave={handleSaveExam}
        />
      )}

      {mockModal && (
        <SettingsMockModal
          open={mockModal}
          editing={editingMock}
          onClose={() => { setMockModal(false); setEditingMock(null); }}
          onSave={handleSaveMock}
        />
      )}

      {/* PIN Change Modal */}
      {pinChange && (
        <Modal open={pinChange} onClose={() => setPinChange(false)} title="Change PIN" maxWidth="max-w-sm">
          <div className="space-y-4">
            <input type="tel" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="New 4-digit PIN" className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-3 text-center text-2xl tracking-[0.5em] text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
            <button onClick={handlePinChange} disabled={newPin.length !== 4} className="w-full rounded-xl bg-[#E8B86D] py-2.5 text-sm font-semibold text-black hover:bg-[#F0C98A] disabled:opacity-40">Update PIN</button>
          </div>
        </Modal>
      )}

      {/* Export Modal */}
      {exportModal && (
        <Modal open={exportModal} onClose={() => setExportModal(false)} title="Export Data" maxWidth="max-w-md">
          <div className="space-y-3">
            <p className="text-sm text-[#A8A29A]">Select sections to export:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {SECTIONS.map(s => (
                <label key={s.key} className="flex items-center gap-3 rounded-lg bg-black/25 px-3 py-2 cursor-pointer">
                  <input type="checkbox" checked={exportSections[s.key] || false} onChange={e => setExportSections(prev => ({ ...prev, [s.key]: e.target.checked }))} className="accent-[#E8B86D]" />
                  <span className="text-sm text-[#D6CFC4]">{s.label}</span>
                </label>
              ))}
            </div>
            {exportResult && <p className="text-sm text-[#8FBC8F] flex items-center gap-1"><Check size={16} /> {exportResult}</p>}
            <button onClick={handleExport} className="w-full rounded-xl bg-[#E8B86D] py-2.5 text-sm font-semibold text-black hover:bg-[#F0C98A]">Download JSON</button>
          </div>
        </Modal>
      )}

      <ConfirmDialog open={!!deleteExam} title="Delete Exam Date" message={`Delete "${deleteExam?.name}"?`} onConfirm={handleDeleteExam} onCancel={() => setDeleteExam(null)} />
      <ConfirmDialog open={!!deleteMock} title="Delete Mock" message={`Delete mock for "${deleteMock?.paper}" on ${deleteMock ? formatDate(deleteMock.date) : ''}?`} onConfirm={handleDeleteMock} onCancel={() => setDeleteMock(null)} />
    </div>
  );
}

function SettingsCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="y-panel p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#E8B86D]">{icon}</span>
        <h3 className="text-sm font-semibold text-[#EDE6DA]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-[#E8B86D]' : 'bg-zinc-700'}`}>
      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function ExamDateModal({ open, editing, onClose, onSave }: {
  open: boolean;
  editing: Exam | null;
  onClose: () => void;
  onSave: (name: string, date: string) => void;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [date, setDate] = useState(editing?.date || '');

  useEffect(() => {
    if (open) {
      setName(editing?.name || '');
      setDate(editing?.date || '');
    }
  }, [open, editing]);

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Exam Date' : 'Add Exam Date'} maxWidth="max-w-sm">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Exam name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. CA Foundation Jan 2027" className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
        </div>
        <p className="text-xs text-[#8A8478]">Used for Home countdown. Mock scores are logged separately below.</p>
        <button onClick={() => name.trim() && date && onSave(name.trim(), date)} disabled={!name.trim() || !date} className="y-btn y-btn-primary w-full disabled:opacity-40">
          {editing ? 'Save' : 'Add date'}
        </button>
      </div>
    </Modal>
  );
}

function SettingsMockModal({ open, editing, onClose, onSave }: {
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
          className="y-btn y-btn-primary w-full"
        >
          {editing ? 'Save Changes' : 'Save Mock'}
        </button>
      </div>
    </Modal>
  );
}
