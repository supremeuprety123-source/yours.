import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAll, addRecord, updateRecord, removeRecord } from '../lib/store';
import type { Transaction, Category } from '../lib/types';
import { formatCurrency, formatDate, todayISO } from '../lib/utils';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { Plus, Edit2, Trash2, Wallet, TrendingUp, TrendingDown, Search, PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, Legend } from 'recharts';

type FinView = 'dashboard' | 'transactions' | 'reports';

export default function Finance() {
  const { profile, refreshKey, refreshAll } = useApp();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<FinView>('dashboard');
  const [txModal, setTxModal] = useState(false);
  const [catModal, setCatModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'tx' | 'cat'; id: string; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [period, setPeriod] = useState<'all' | 'month' | '3months' | 'year'>('all');

  const loadData = async () => {
    const [t, c] = await Promise.all([getAll<Transaction>('transactions'), getAll<Category>('categories')]);
    setTransactions(t.sort((a,b) => b.date.localeCompare(a.date)));
    setCategories(c);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [refreshKey]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#C8A96E] border-t-transparent" /></div>;
  }

  const sym = profile?.currency_symbol || 'रू';

  const filteredTx = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!t.description.toLowerCase().includes(s) && !t.category.toLowerCase().includes(s) && !t.from_to.toLowerCase().includes(s)) return false;
    }
    if (period !== 'all') {
      const now = new Date();
      const txDate = new Date(t.date + 'T00:00');
      if (period === 'month') { if (txDate.getMonth() !== now.getMonth() || txDate.getFullYear() !== now.getFullYear()) return false; }
      if (period === '3months') { if ((now.getTime() - txDate.getTime()) > 90 * 86400000) return false; }
      if (period === 'year') { if (txDate.getFullYear() !== now.getFullYear()) return false; }
    }
    return true;
  });

  const income = filteredTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = filteredTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  // Expense by category for donut
  const expenseByCat: Record<string, number> = {};
  filteredTx.filter(t => t.type === 'expense').forEach(t => {
    expenseByCat[t.category] = (expenseByCat[t.category] || 0) + t.amount;
  });
  const donutData = Object.entries(expenseByCat).map(([name, value]) => ({ name, value }));
  const COLORS = ['#C8A96E', '#E07B39', '#C0392B', '#4CAF7D', '#8B5CF6', '#3B82F6', '#EC4899', '#F59E0B'];

  // Budget bars
  const expenseCats = categories.filter(c => c.type === 'expense');
  const budgetBars = expenseCats.map(c => {
    const spent = expenseByCat[c.name] || 0;
    const pct = c.budget > 0 ? (spent / c.budget) * 100 : 0;
    return { name: c.name, spent, budget: c.budget, pct };
  });

  // 6-month trend
  const trendData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const monthTx = transactions.filter(t => {
      const td = new Date(t.date + 'T00:00');
      return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
    });
    return {
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      income: monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    };
  });

  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;
  const topCat = Object.entries(expenseByCat).sort((a,b) => b[1] - a[1])[0];
  const topSource = filteredTx.filter(t => t.type === 'income').reduce<Record<string, number>>((acc, t) => { acc[t.from_to] = (acc[t.from_to] || 0) + t.amount; return acc; }, {});
  const topSourceEntry = Object.entries(topSource).sort((a,b) => b[1] - a[1])[0];
  const dailyAvg = expense > 0 ? Math.round(expense / new Set(filteredTx.map(t => t.date)).size) : 0;

  // Group transactions by date
  const grouped: Record<string, Transaction[]> = {};
  filteredTx.forEach(t => {
    if (!grouped[t.date]) grouped[t.date] = [];
    grouped[t.date].push(t);
  });
  const sortedDates = Object.keys(grouped).sort((a,b) => b.localeCompare(a));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'tx') await removeRecord('transactions', deleteTarget.id);
    else await removeRecord('categories', deleteTarget.id);
    setDeleteTarget(null);
    loadData();
    refreshAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Finance</h1>
          <p className="text-sm text-zinc-500 mt-1">Balance: <span className={balance >= 0 ? 'text-[#4CAF7D] font-semibold' : 'text-[#C0392B] font-semibold'}>{formatCurrency(balance, sym)}</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditingCat(null); setCatModal(true); }} className="rounded-xl border border-zinc-700 px-3 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800">Categories</button>
          <button onClick={() => { setEditingTx(null); setTxModal(true); }} className="flex items-center gap-2 rounded-xl bg-[#C8A96E] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f]"><Plus size={18} /> Add Transaction</button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 rounded-xl border border-zinc-800 bg-[#1A1A1A] p-1 w-fit">
        {(['dashboard','transactions','reports'] as FinView[]).map(v => (
          <button key={v} onClick={() => setView(v)} className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${view === v ? 'bg-[#C8A96E] text-black' : 'text-zinc-400 hover:text-zinc-200'}`}>{v}</button>
        ))}
      </div>

      {/* Period filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all','month','3months','year'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`rounded-lg px-3 py-1 text-xs font-medium ${period === p ? 'bg-[#C8A96E]/10 text-[#C8A96E]' : 'text-zinc-500 hover:text-zinc-300'}`}>{p === '3months' ? '3M' : p === 'all' ? 'All Time' : p === 'month' ? 'This Month' : 'This Year'}</button>
        ))}
      </div>

      {view === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
              <div className="flex items-center gap-2 text-zinc-400 mb-2"><Wallet size={16} /><span className="text-xs">Balance</span></div>
              <div className={`text-3xl font-bold ${balance >= 0 ? 'text-zinc-100' : 'text-[#C0392B]'}`}>{formatCurrency(balance, sym)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
              <div className="flex items-center gap-2 text-[#4CAF7D] mb-2"><TrendingUp size={16} /><span className="text-xs">Income</span></div>
              <div className="text-3xl font-bold text-[#4CAF7D]">{formatCurrency(income, sym)}</div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
              <div className="flex items-center gap-2 text-[#C0392B] mb-2"><TrendingDown size={16} /><span className="text-xs">Expense</span></div>
              <div className="text-3xl font-bold text-[#C0392B]">{formatCurrency(expense, sym)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Expense Donut */}
            <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Expense Breakdown</h3>
              {donutData.length === 0 ? (
                <EmptyState icon={<PieIcon size={32} />} message="No expenses recorded yet." />
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                        {donutData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {donutData.slice(0, 5).map((d, i) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-zinc-400 flex-1 truncate">{d.name}</span>
                        <span className="text-zinc-300">{formatCurrency(d.value, sym)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Budget Bars */}
            <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Budget Tracking</h3>
              {budgetBars.length === 0 ? (
                <EmptyState message="Set up expense categories with budgets to track spending." />
              ) : (
                <div className="space-y-3">
                  {budgetBars.map(b => (
                    <div key={b.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-zinc-400">{b.name}</span>
                        <span className={b.pct >= 100 ? 'text-[#C0392B]' : b.pct >= 75 ? 'text-[#E07B39]' : 'text-zinc-500'}>{formatCurrency(b.spent, sym)} / {formatCurrency(b.budget, sym)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${b.pct >= 100 ? 'bg-[#C0392B]' : b.pct >= 75 ? 'bg-[#E07B39]' : 'bg-[#4CAF7D]'}`} style={{ width: `${Math.min(b.pct, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'transactions' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..." className="w-full rounded-xl border border-zinc-700 bg-[#1A1A1A] pl-9 pr-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-[#C8A96E]" />
            </div>
            <div className="flex gap-1">
              {(['all','income','expense'] as const).map(f => (
                <button key={f} onClick={() => setFilterType(f)} className={`rounded-lg px-3 py-2 text-xs font-medium capitalize ${filterType === f ? 'bg-[#C8A96E]/10 text-[#C8A96E]' : 'text-zinc-500'}`}>{f}</button>
              ))}
            </div>
          </div>

          {sortedDates.length === 0 ? (
            <EmptyState icon={<Wallet size={36} />} message="No transactions yet. Add your first transaction to start tracking." />
          ) : (
            <div className="space-y-4">
              {sortedDates.map(date => (
                <div key={date}>
                  <div className="text-xs font-medium text-zinc-500 mb-2 sticky top-0 bg-[#0D0D0D] py-1">{formatDate(date)}</div>
                  <div className="space-y-1.5">
                    {grouped[date].map(t => (
                      <div key={t.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-[#1A1A1A] px-4 py-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-[#4CAF7D]/10' : 'bg-[#C0392B]/10'}`}>
                          {t.type === 'income' ? <TrendingUp size={16} className="text-[#4CAF7D]" /> : <TrendingDown size={16} className="text-[#C0392B]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-200 truncate">{t.description || t.category}</div>
                          <div className="text-xs text-zinc-500">{t.category}{t.from_to && ` · ${t.from_to}`}{t.payment_method && ` · ${t.payment_method}`}</div>
                        </div>
                        <div className={`text-sm font-semibold ${t.type === 'income' ? 'text-[#4CAF7D]' : 'text-[#C0392B]'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, sym)}</div>
                        <button onClick={() => { setEditingTx(t); setTxModal(true); }} className="text-zinc-500 hover:text-zinc-300"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteTarget({ type: 'tx', id: t.id, name: t.description || t.category })} className="text-zinc-500 hover:text-[#C0392B]"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'reports' && (
        <div className="space-y-4">
          {transactions.length === 0 ? (
            <EmptyState icon={<BarChart3 size={36} />} message="No data to report yet. Add transactions first." />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ReportCard label="Savings Rate" value={`${savingsRate}%`} color={savingsRate >= 20 ? '#4CAF7D' : '#E07B39'} />
                <ReportCard label="Top Category" value={topCat ? topCat[0] : '—'} sub={topCat ? formatCurrency(topCat[1], sym) : ''} color="#C8A96E" />
                <ReportCard label="Top Source" value={topSourceEntry ? topSourceEntry[0] : '—'} sub={topSourceEntry ? formatCurrency(topSourceEntry[1], sym) : ''} color="#4CAF7D" />
                <ReportCard label="Daily Average" value={formatCurrency(dailyAvg, sym)} color="#E07B39" />
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Income vs Expense (6 months)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={trendData}>
                    <XAxis dataKey="month" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="income" fill="#4CAF7D" radius={[4,4,0,0]} />
                    <Bar dataKey="expense" fill="#C0392B" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-[#1A1A1A] p-5">
                <h3 className="text-sm font-semibold text-zinc-300 mb-4">Savings Trend</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={trendData.map(d => ({ month: d.month, savings: d.income - d.expense }))}>
                    <XAxis dataKey="month" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="savings" stroke="#C8A96E" strokeWidth={2} dot={{ fill: '#C8A96E', r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {/* Transaction Modal */}
      {txModal && (
        <TxModal open={txModal} editing={editingTx} categories={categories} sym={sym} onClose={() => setTxModal(false)} onSaved={() => { setTxModal(false); loadData(); refreshAll(); }} />
      )}

      {/* Category Modal */}
      {catModal && (
        <CatModal open={catModal} editing={editingCat} categories={categories} onClose={() => setCatModal(false)} onSaved={() => { setCatModal(false); loadData(); }} onDelete={(cat: Category) => setDeleteTarget({ type: 'cat', id: cat.id, name: cat.name })} />
      )}

      <ConfirmDialog open={!!deleteTarget} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

function ReportCard({ label, value, sub, color }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#1A1A1A] p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-lg font-bold truncate" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function TxModal({ open, editing, categories, sym, onClose, onSaved }: any) {
  const [type, setType] = useState(editing?.type || 'expense');
  const [amount, setAmount] = useState(editing?.amount || '');
  const [category, setCategory] = useState(editing?.category || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [date, setDate] = useState(editing?.date || todayISO());
  const [fromTo, setFromTo] = useState(editing?.from_to || '');
  const [paymentMethod, setPaymentMethod] = useState(editing?.payment_method || 'Cash');
  const [notes, setNotes] = useState(editing?.notes || '');

  useEffect(() => {
    if (open) {
      setType(editing?.type || 'expense');
      setAmount(editing?.amount || '');
      setCategory(editing?.category || '');
      setDescription(editing?.description || '');
      setDate(editing?.date || todayISO());
      setFromTo(editing?.from_to || '');
      setPaymentMethod(editing?.payment_method || 'Cash');
      setNotes(editing?.notes || '');
    }
  }, [open, editing]);

  const relevantCats = categories.filter((c: Category) => c.type === type);

  const save = async () => {
    if (!amount || +amount <= 0) return;
    const data = {
      type, amount: +amount, currency: sym, category: category || 'Uncategorized',
      description: description.trim(), date, from_to: fromTo.trim(), payment_method: paymentMethod, notes: notes.trim(),
    };
    if (editing) await updateRecord('transactions', editing.id, data);
    else await addRecord('transactions', { ...data, created_at: new Date().toISOString() });
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Transaction' : 'Add Transaction'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { setType('income'); setCategory(''); }} className={`rounded-xl border py-2.5 text-sm font-medium ${type === 'income' ? 'border-[#4CAF7D] bg-[#4CAF7D]/10 text-[#4CAF7D]' : 'border-zinc-700 text-zinc-400'}`}>Income</button>
          <button onClick={() => { setType('expense'); setCategory(''); }} className={`rounded-xl border py-2.5 text-sm font-medium ${type === 'expense' ? 'border-[#C0392B] bg-[#C0392B]/10 text-[#C0392B]' : 'border-zinc-700 text-zinc-400'}`}>Expense</button>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Amount ({sym})</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Category</label>
          {relevantCats.length > 0 ? (
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-200 outline-none focus:border-[#C8A96E]">
              <option value="">Select category</option>
              {relevantCats.map((c: Category) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          ) : (
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Type a category name" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this for?" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">{type === 'income' ? 'From' : 'To'}</label>
            <input value={fromTo} onChange={e => setFromTo(e.target.value)} placeholder={type === 'income' ? 'Source' : 'Recipient'} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Payment Method</label>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-200 outline-none focus:border-[#C8A96E]">
            {['Cash','Bank Transfer','Card','Esewa','Khalti','Mobile Banking','Other'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E] resize-none" />
        </div>
        <button onClick={save} disabled={!amount || +amount <= 0} className="w-full rounded-xl bg-[#C8A96E] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f] disabled:opacity-40">{editing ? 'Save Changes' : 'Add Transaction'}</button>
      </div>
    </Modal>
  );
}

function CatModal({ open, editing, categories, onClose, onSaved, onDelete }: any) {
  const [name, setName] = useState(editing?.name || '');
  const [type, setType] = useState(editing?.type || 'expense');
  const [budget, setBudget] = useState(editing?.budget || '');

  useEffect(() => {
    if (open) { setName(editing?.name || ''); setType(editing?.type || 'expense'); setBudget(editing?.budget || ''); }
  }, [open, editing]);

  const save = async () => {
    if (!name.trim()) return;
    if (editing) await updateRecord('categories', editing.id, { name: name.trim(), type, budget: +budget || 0 });
    else await addRecord('categories', { name: name.trim(), type, budget: +budget || 0 });
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title="Categories">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setType('expense')} className={`rounded-xl border py-2 text-sm font-medium ${type === 'expense' ? 'border-[#C0392B] bg-[#C0392B]/10 text-[#C0392B]' : 'border-zinc-700 text-zinc-400'}`}>Expense</button>
          <button onClick={() => setType('income')} className={`rounded-xl border py-2 text-sm font-medium ${type === 'income' ? 'border-[#4CAF7D] bg-[#4CAF7D]/10 text-[#4CAF7D]' : 'border-zinc-700 text-zinc-400'}`}>Income</button>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-300">Category Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Food & Dining" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
        </div>
        {type === 'expense' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-zinc-300">Monthly Budget</label>
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0" className="w-full rounded-xl border border-zinc-700 bg-[#0D0D0D] px-4 py-2.5 text-zinc-100 outline-none focus:border-[#C8A96E]" />
          </div>
        )}
        <button onClick={save} disabled={!name.trim()} className="w-full rounded-xl bg-[#C8A96E] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#d4b87f] disabled:opacity-40">{editing ? 'Save Changes' : 'Add Category'}</button>

        <div className="border-t border-zinc-800 pt-4">
          <div className="text-xs font-medium text-zinc-500 mb-2">Existing Categories</div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {categories.length === 0 ? <p className="text-xs text-zinc-600">No categories yet.</p> : categories.map((c: Category) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg bg-zinc-900/50 px-3 py-2">
                <span className={`h-2 w-2 rounded-full ${c.type === 'income' ? 'bg-[#4CAF7D]' : 'bg-[#C0392B]'}`} />
                <span className="text-sm text-zinc-300 flex-1">{c.name}</span>
                {c.budget > 0 && <span className="text-xs text-zinc-500">{c.budget}</span>}
                <button onClick={() => onDelete(c)} className="text-zinc-500 hover:text-[#C0392B]"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
