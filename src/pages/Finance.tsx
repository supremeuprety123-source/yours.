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
  const [period, setPeriod] = useState<'all' | 'month' | '3months' | 'year' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const loadData = async () => {
    const [t, c] = await Promise.all([getAll<Transaction>('transactions'), getAll<Category>('categories')]);
    setTransactions(t.sort((a,b) => b.date.localeCompare(a.date)));
    setCategories(c);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [refreshKey]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8B86D] border-t-transparent" /></div>;
  }

  const sym = profile?.currency_symbol || 'रू';

  const filteredTx = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!t.description.toLowerCase().includes(s) && !t.category.toLowerCase().includes(s) && !t.from_to.toLowerCase().includes(s)) return false;
    }
    if (period === 'custom') {
      if (customFrom && t.date < customFrom) return false;
      if (customTo && t.date > customTo) return false;
    } else if (period !== 'all') {
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
  const COLORS = ['#E8B86D', '#E07A5F', '#E07A5F', '#8FBC8F', '#8B5CF6', '#3B82F6', '#EC4899', '#F59E0B'];

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
  const dailyAvg = expense > 0 ? Math.round(expense / Math.max(1, new Set(filteredTx.map(t => t.date)).size)) : 0;

  // Payment method breakdown (Cash, Esewa, etc.)
  const methodMap: Record<string, { income: number; expense: number }> = {};
  filteredTx.forEach(t => {
    const m = (t.payment_method || 'Other').trim() || 'Other';
    if (!methodMap[m]) methodMap[m] = { income: 0, expense: 0 };
    if (t.type === 'income') methodMap[m].income += t.amount;
    else methodMap[m].expense += t.amount;
  });
  // Prefer common methods first, then any others used
  const METHOD_ORDER = ['Cash', 'Esewa', 'Khalti', 'Bank Transfer', 'Card', 'Mobile Banking', 'Other'];
  const usedMethods = Object.keys(methodMap);
  const orderedMethods = [
    ...METHOD_ORDER.filter(m => usedMethods.includes(m)),
    ...usedMethods.filter(m => !METHOD_ORDER.includes(m)).sort(),
  ];
  const methodStats = orderedMethods.map(name => {
    const { income: inc, expense: exp } = methodMap[name];
    return { name, income: inc, expense: exp, balance: inc - exp };
  });

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
          <h1 className="y-page-title">Finance</h1>
          <p className="text-sm text-[#F7F1E7]0 mt-1">Balance: <span className={balance >= 0 ? 'text-[#8FBC8F] font-semibold' : 'text-[#E07A5F] font-semibold'}>{formatCurrency(balance, sym)}</span></p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditingCat(null); setCatModal(true); }} className="rounded-xl border border-[rgba(255,236,200,0.1)] px-3 py-2.5 text-sm font-medium text-[#D6CFC4] hover:bg-[#2A261F]">Categories</button>
          <button onClick={() => { setEditingTx(null); setTxModal(true); }} className="y-btn y-btn-primary flex items-center gap-2"><Plus size={18} /> Add Transaction</button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 rounded-xl border border-[rgba(255,236,200,0.07)] bg-[#1E1B16]/90 p-1 w-fit">
        {(['dashboard','transactions','reports'] as FinView[]).map(v => (
          <button key={v} onClick={() => setView(v)} className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-colors ${view === v ? 'bg-[#E8B86D] text-black' : 'text-[#A8A29A] hover:text-[#EDE6DA]'}`}>{v}</button>
        ))}
      </div>

      {/* Period filter */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {([
            { key: 'all', label: 'All Time' },
            { key: 'month', label: 'This Month' },
            { key: '3months', label: '3M' },
            { key: 'year', label: 'This Year' },
            { key: 'custom', label: 'Custom' },
          ] as const).map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${period === p.key ? 'bg-[#E8B86D]/10 text-[#E8B86D]' : 'text-[#8A8478] hover:text-[#D6CFC4]'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-[#8A8478]">From</label>
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="rounded-lg border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-2.5 py-1.5 text-xs text-[#F5F0E8] outline-none focus:border-[#E8B86D]"
            />
            <label className="text-xs text-[#8A8478]">To</label>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="rounded-lg border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-2.5 py-1.5 text-xs text-[#F5F0E8] outline-none focus:border-[#E8B86D]"
            />
            {(customFrom || customTo) && (
              <button
                onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                className="text-xs text-[#8A8478] hover:text-[#E8B86D]"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {view === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="y-panel p-5">
              <div className="flex items-center gap-2 text-[#A8A29A] mb-2"><Wallet size={16} /><span className="text-xs">Balance</span></div>
              <div className={`text-3xl font-bold ${balance >= 0 ? 'text-[#F5F0E8]' : 'text-[#E07A5F]'}`}>{formatCurrency(balance, sym)}</div>
            </div>
            <div className="y-panel p-5">
              <div className="flex items-center gap-2 text-[#8FBC8F] mb-2"><TrendingUp size={16} /><span className="text-xs">Income</span></div>
              <div className="text-3xl font-bold text-[#8FBC8F]">{formatCurrency(income, sym)}</div>
            </div>
            <div className="y-panel p-5">
              <div className="flex items-center gap-2 text-[#E07A5F] mb-2"><TrendingDown size={16} /><span className="text-xs">Expense</span></div>
              <div className="text-3xl font-bold text-[#E07A5F]">{formatCurrency(expense, sym)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Expense Donut */}
            <div className="y-panel p-5">
              <h3 className="text-sm font-semibold text-[#D6CFC4] mb-3">Expense Breakdown</h3>
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
                        <span className="text-[#A8A29A] flex-1 truncate">{d.name}</span>
                        <span className="text-[#D6CFC4]">{formatCurrency(d.value, sym)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Budget Bars */}
            <div className="y-panel p-5">
              <h3 className="text-sm font-semibold text-[#D6CFC4] mb-3">Budget Tracking</h3>
              {budgetBars.length === 0 ? (
                <EmptyState message="Set up expense categories with budgets to track spending." />
              ) : (
                <div className="space-y-3">
                  {budgetBars.map(b => (
                    <div key={b.name}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[#A8A29A]">{b.name}</span>
                        <span className={b.pct >= 100 ? 'text-[#E07A5F]' : b.pct >= 75 ? 'text-[#E07A5F]' : 'text-[#F7F1E7]0'}>{formatCurrency(b.spent, sym)} / {formatCurrency(b.budget, sym)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#2A261F] overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${b.pct >= 100 ? 'bg-[#E07A5F]' : b.pct >= 75 ? 'bg-[#E07A5F]' : 'bg-[#8FBC8F]'}`} style={{ width: `${Math.min(b.pct, 100)}%` }} />
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
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#F7F1E7]0" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..." className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#1E1B16]/90 pl-9 pr-4 py-2.5 text-sm text-[#EDE6DA] outline-none focus:border-[#E8B86D]" />
            </div>
            <div className="flex gap-1">
              {(['all','income','expense'] as const).map(f => (
                <button key={f} onClick={() => setFilterType(f)} className={`rounded-lg px-3 py-2 text-xs font-medium capitalize ${filterType === f ? 'bg-[#E8B86D]/10 text-[#E8B86D]' : 'text-[#F7F1E7]0'}`}>{f}</button>
              ))}
            </div>
          </div>

          {sortedDates.length === 0 ? (
            <EmptyState icon={<Wallet size={36} />} message="No transactions yet. Add your first transaction to start tracking." />
          ) : (
            <div className="space-y-4">
              {sortedDates.map(date => (
                <div key={date}>
                  <div className="text-xs font-medium text-[#F7F1E7]0 mb-2 sticky top-0 bg-[#0F0E0C] py-1">{formatDate(date)}</div>
                  <div className="space-y-1.5">
                    {grouped[date].map(t => (
                      <div key={t.id} className="flex items-center gap-3 rounded-xl border border-[rgba(255,236,200,0.07)] bg-[#1E1B16]/90 px-4 py-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${t.type === 'income' ? 'bg-[#8FBC8F]/10' : 'bg-[#E07A5F]/10'}`}>
                          {t.type === 'income' ? <TrendingUp size={16} className="text-[#8FBC8F]" /> : <TrendingDown size={16} className="text-[#E07A5F]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[#EDE6DA] truncate">{t.description || t.category}</div>
                          <div className="text-xs text-[#F7F1E7]0">{t.category}{t.from_to && ` · ${t.from_to}`}{t.payment_method && ` · ${t.payment_method}`}</div>
                        </div>
                        <div className={`text-sm font-semibold ${t.type === 'income' ? 'text-[#8FBC8F]' : 'text-[#E07A5F]'}`}>{t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, sym)}</div>
                        <button onClick={() => { setEditingTx(t); setTxModal(true); }} className="text-[#F7F1E7]0 hover:text-[#D6CFC4]"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteTarget({ type: 'tx', id: t.id, name: t.description || t.category })} className="text-[#F7F1E7]0 hover:text-[#E07A5F]"><Trash2 size={14} /></button>
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
              <div className="y-panel p-4">
                <p className="text-xs text-[#8A8478]">
                  Showing{' '}
                  <span className="text-[#D6CFC4] font-medium">
                    {period === 'custom'
                      ? `${customFrom || '…'} → ${customTo || '…'}`
                      : period === 'all'
                      ? 'all time'
                      : period === 'month'
                      ? 'this month'
                      : period === '3months'
                      ? 'last 3 months'
                      : 'this year'}
                  </span>
                  {' · '}
                  {filteredTx.length} transaction{filteredTx.length === 1 ? '' : 's'}
                </p>
              </div>

              {/* Summary for selected range */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="y-panel p-4">
                  <div className="text-xs text-[#8A8478] mb-1">Net balance</div>
                  <div className={`text-2xl font-bold ${balance >= 0 ? 'text-[#F5F0E8]' : 'text-[#E07A5F]'}`}>{formatCurrency(balance, sym)}</div>
                </div>
                <div className="y-panel p-4">
                  <div className="text-xs text-[#8FBC8F] mb-1">Income</div>
                  <div className="text-2xl font-bold text-[#8FBC8F]">{formatCurrency(income, sym)}</div>
                </div>
                <div className="y-panel p-4">
                  <div className="text-xs text-[#E07A5F] mb-1">Expense</div>
                  <div className="text-2xl font-bold text-[#E07A5F]">{formatCurrency(expense, sym)}</div>
                </div>
              </div>

              {/* By payment method: Cash, Esewa, etc. */}
              <div className="y-panel p-5">
                <h3 className="text-sm font-semibold text-[#D6CFC4] mb-1">By payment method</h3>
                <p className="text-xs text-[#8A8478] mb-4">Current net amount, income and expense for each wallet / method in this period.</p>
                {methodStats.length === 0 ? (
                  <p className="text-sm text-[#6B6560] py-2">No transactions in this period.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {methodStats.map(m => (
                      <div key={m.name} className="rounded-xl border border-[rgba(255,236,200,0.07)] bg-black/25 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-[#EDE6DA]">{m.name}</span>
                          <span className={`text-sm font-bold ${m.balance >= 0 ? 'text-[#8FBC8F]' : 'text-[#E07A5F]'}`}>
                            {formatCurrency(m.balance, sym)}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-[#8A8478]">Income</span>
                            <span className="text-[#8FBC8F] font-medium">{formatCurrency(m.income, sym)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8A8478]">Expense</span>
                            <span className="text-[#E07A5F] font-medium">{formatCurrency(m.expense, sym)}</span>
                          </div>
                        </div>
                        {(m.income + m.expense) > 0 && (
                          <div className="mt-3 h-1.5 rounded-full bg-[#2A261F] overflow-hidden flex">
                            <div
                              className="h-full bg-[#8FBC8F]"
                              style={{ width: `${(m.income / (m.income + m.expense)) * 100}%` }}
                            />
                            <div
                              className="h-full bg-[#E07A5F]"
                              style={{ width: `${(m.expense / (m.income + m.expense)) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <ReportCard label="Savings Rate" value={`${savingsRate}%`} color={savingsRate >= 20 ? '#8FBC8F' : '#E07A5F'} />
                <ReportCard label="Top Category" value={topCat ? topCat[0] : '—'} sub={topCat ? formatCurrency(topCat[1], sym) : ''} color="#E8B86D" />
                <ReportCard label="Top Source" value={topSourceEntry ? topSourceEntry[0] : '—'} sub={topSourceEntry ? formatCurrency(topSourceEntry[1], sym) : ''} color="#8FBC8F" />
                <ReportCard label="Daily Average" value={formatCurrency(dailyAvg, sym)} color="#E07A5F" />
              </div>

              <div className="y-panel p-5">
                <h3 className="text-sm font-semibold text-[#D6CFC4] mb-4">Income vs Expense (6 months)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={trendData}>
                    <XAxis dataKey="month" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="income" fill="#8FBC8F" radius={[4,4,0,0]} />
                    <Bar dataKey="expense" fill="#E07A5F" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="y-panel p-5">
                <h3 className="text-sm font-semibold text-[#D6CFC4] mb-4">Savings Trend</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={trendData.map(d => ({ month: d.month, savings: d.income - d.expense }))}>
                    <XAxis dataKey="month" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#1A1A1A', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="savings" stroke="#E8B86D" strokeWidth={2} dot={{ fill: '#E8B86D', r: 3 }} />
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
    <div className="rounded-xl border border-[rgba(255,236,200,0.07)] bg-[#1E1B16]/90 p-4">
      <div className="text-xs text-[#F7F1E7]0 mb-1">{label}</div>
      <div className="text-lg font-bold truncate" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-[#F7F1E7]0 mt-0.5">{sub}</div>}
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
          <button onClick={() => { setType('income'); setCategory(''); }} className={`rounded-xl border py-2.5 text-sm font-medium ${type === 'income' ? 'border-[#8FBC8F] bg-[#8FBC8F]/10 text-[#8FBC8F]' : 'border-[rgba(255,236,200,0.1)] text-[#A8A29A]'}`}>Income</button>
          <button onClick={() => { setType('expense'); setCategory(''); }} className={`rounded-xl border py-2.5 text-sm font-medium ${type === 'expense' ? 'border-[#E07A5F] bg-[#E07A5F]/10 text-[#E07A5F]' : 'border-[rgba(255,236,200,0.1)] text-[#A8A29A]'}`}>Expense</button>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Amount ({sym})</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Category</label>
          {relevantCats.length > 0 ? (
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#EDE6DA] outline-none focus:border-[#E8B86D]">
              <option value="">Select category</option>
              {relevantCats.map((c: Category) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          ) : (
            <input value={category} onChange={e => setCategory(e.target.value)} placeholder="Type a category name" className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this for?" className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">{type === 'income' ? 'From' : 'To'}</label>
            <input value={fromTo} onChange={e => setFromTo(e.target.value)} placeholder={type === 'income' ? 'Source' : 'Recipient'} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Payment Method</label>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#EDE6DA] outline-none focus:border-[#E8B86D]">
            {['Cash','Bank Transfer','Card','Esewa','Khalti','Mobile Banking','Other'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D] resize-none" />
        </div>
        <button onClick={save} disabled={!amount || +amount <= 0} className="y-btn y-btn-primary w-full disabled:opacity-40">{editing ? 'Save Changes' : 'Add Transaction'}</button>
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
          <button onClick={() => setType('expense')} className={`rounded-xl border py-2 text-sm font-medium ${type === 'expense' ? 'border-[#E07A5F] bg-[#E07A5F]/10 text-[#E07A5F]' : 'border-[rgba(255,236,200,0.1)] text-[#A8A29A]'}`}>Expense</button>
          <button onClick={() => setType('income')} className={`rounded-xl border py-2 text-sm font-medium ${type === 'income' ? 'border-[#8FBC8F] bg-[#8FBC8F]/10 text-[#8FBC8F]' : 'border-[rgba(255,236,200,0.1)] text-[#A8A29A]'}`}>Income</button>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Category Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Food & Dining" className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
        </div>
        {type === 'expense' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#D6CFC4]">Monthly Budget</label>
            <input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0" className="w-full rounded-xl border border-[rgba(255,236,200,0.1)] bg-[#0F0E0C] px-4 py-2.5 text-[#F5F0E8] outline-none focus:border-[#E8B86D]" />
          </div>
        )}
        <button onClick={save} disabled={!name.trim()} className="y-btn y-btn-primary w-full disabled:opacity-40">{editing ? 'Save Changes' : 'Add Category'}</button>

        <div className="border-t border-[rgba(255,236,200,0.07)] pt-4">
          <div className="text-xs font-medium text-[#F7F1E7]0 mb-2">Existing Categories</div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {categories.length === 0 ? <p className="text-xs text-[#6B6560]">No categories yet.</p> : categories.map((c: Category) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg bg-black/25 px-3 py-2">
                <span className={`h-2 w-2 rounded-full ${c.type === 'income' ? 'bg-[#8FBC8F]' : 'bg-[#E07A5F]'}`} />
                <span className="text-sm text-[#D6CFC4] flex-1">{c.name}</span>
                {c.budget > 0 && <span className="text-xs text-[#F7F1E7]0">{c.budget}</span>}
                <button onClick={() => onDelete(c)} className="text-[#F7F1E7]0 hover:text-[#E07A5F]"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
