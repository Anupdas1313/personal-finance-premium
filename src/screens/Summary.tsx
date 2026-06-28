import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Minus, PieChart as PieIcon, Tag, Store, CreditCard, Layers } from 'lucide-react';
import { CATEGORY_ICONS } from '../constants';

const COLORS = ['#00A86B', '#1A237E', '#D4AF37', '#82EEFD', '#E53935', '#3B3B98', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export default function Summary() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const transactions = useLiveQuery(() => db.transactions.toArray(), [user?.uid]) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), [user?.uid]) || [];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const prevMonthStart = startOfMonth(subMonths(currentMonth, 1));
  const prevMonthEnd = endOfMonth(subMonths(currentMonth, 1));

  const monthTxs = transactions.filter(tx =>
    isWithinInterval(new Date(tx.dateTime), { start: monthStart, end: monthEnd })
  );
  const prevMonthTxs = transactions.filter(tx =>
    isWithinInterval(new Date(tx.dateTime), { start: prevMonthStart, end: prevMonthEnd })
  );

  const expenses = monthTxs.filter(tx => tx.type === 'DEBIT' && tx.category !== 'Transfer');
  const income = monthTxs.filter(tx => tx.type === 'CREDIT' && tx.category !== 'Transfer');
  const prevExpenses = prevMonthTxs.filter(tx => tx.type === 'DEBIT' && tx.category !== 'Transfer');
  const prevIncome = prevMonthTxs.filter(tx => tx.type === 'CREDIT' && tx.category !== 'Transfer');

  const totalExpense = expenses.reduce((s, tx) => s + tx.amount, 0);
  const totalIncome = income.reduce((s, tx) => s + tx.amount, 0);
  const prevTotalExpense = prevExpenses.reduce((s, tx) => s + tx.amount, 0);
  const prevTotalIncome = prevIncome.reduce((s, tx) => s + tx.amount, 0);
  const savings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((savings / totalIncome) * 100).toFixed(0) : '0';

  const expenseChange = prevTotalExpense > 0
    ? (((totalExpense - prevTotalExpense) / prevTotalExpense) * 100).toFixed(1)
    : null;
  const incomeChange = prevTotalIncome > 0
    ? (((totalIncome - prevTotalIncome) / prevTotalIncome) * 100).toFixed(1)
    : null;

  // ── Aggregations ──────────────────────────────────────────────────────────

  const { expensesByCategory, expensesByTag, expensesByAccount, expensesByParty } = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const byTag: Record<string, number> = {};
    const byAccount: Record<string, number> = {};
    const byParty: Record<string, number> = {};

    expenses.forEach(tx => {
      // Category
      byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount;
      
      // Tag
      if (tx.expenseType) {
        byTag[tx.expenseType] = (byTag[tx.expenseType] || 0) + tx.amount;
      }
      
      // Account
      const accName = accounts.find(a => a.id === tx.accountId)?.bankName || 'Unknown';
      byAccount[accName] = (byAccount[accName] || 0) + tx.amount;

      // Party (Merchants)
      if (tx.party) {
        const partyName = tx.party.toUpperCase().trim();
        byParty[partyName] = (byParty[partyName] || 0) + tx.amount;
      }
    });

    return { byCategory, byTag, byAccount, byParty };
  }, [expenses, accounts]);

  // Sort them to arrays
  const pieData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const tagData = Object.entries(expensesByTag).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  const accData = Object.entries(expensesByAccount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const partyData = Object.entries(expensesByParty).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  // Last 6 months bar data
  const barData = Array.from({ length: 6 }, (_, i) => {
    const m = subMonths(new Date(), 5 - i);
    const ms = startOfMonth(m);
    const me = endOfMonth(m);
    const txs = transactions.filter(tx => isWithinInterval(new Date(tx.dateTime), { start: ms, end: me }));
    const e = txs.filter(tx => tx.type === 'DEBIT' && tx.category !== 'Transfer').reduce((s, tx) => s + tx.amount, 0);
    const iAmt = txs.filter(tx => tx.type === 'CREDIT' && tx.category !== 'Transfer').reduce((s, tx) => s + tx.amount, 0);
    return {
      month: format(m, 'MMM'),
      income: iAmt,
      expenses: e,
    };
  });

  const avg6MonthExpense = barData.reduce((s, d) => s + d.expenses, 0) / 6;
  const isCurrentMonth = format(currentMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
  const monthName = format(currentMonth, 'MMMM');

  // Trend Insight
  let trendInsight = "Keep tracking your expenses to see long-term trends.";
  if (totalExpense > avg6MonthExpense) {
    const pct = (((totalExpense - avg6MonthExpense) / avg6MonthExpense) * 100).toFixed(0);
    trendInsight = `You've spent ${pct}% more this month compared to your 6-month average.`;
  } else if (totalExpense < avg6MonthExpense && avg6MonthExpense > 0) {
    const pct = (((avg6MonthExpense - totalExpense) / avg6MonthExpense) * 100).toFixed(0);
    trendInsight = `Great job! Your spending is ${pct}% lower than your 6-month average.`;
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-24 px-2 md:px-0">
      
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between pt-2 pb-1">
        <div>
          <h1 className="text-2xl font-heading font-black text-brand-blue dark:text-white tracking-tight leading-none">Analytics</h1>
          <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-1">Financial Insights</p>
        </div>
        
        {/* Month Selector */}
        <div className="flex items-center gap-2 bg-white dark:bg-white/5 px-2.5 py-1.5 rounded-2xl shadow-sm border border-neutral-100 dark:border-white/5">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="w-7 h-7 flex items-center justify-center bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-500 rounded-xl transition-all active:scale-95">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-black text-brand-blue dark:text-white text-[11px] uppercase tracking-widest min-w-[90px] text-center">
            {format(currentMonth, 'MMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(m => { const next = new Date(m.getFullYear(), m.getMonth() + 1, 1); return next > new Date() ? m : next; })}
            disabled={isCurrentMonth}
            className="w-7 h-7 flex items-center justify-center bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-500 rounded-xl transition-all active:scale-95 disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 1. AT A GLANCE STRIP ── */}
      <div className="bg-gradient-to-br from-brand-blue to-indigo-900 rounded-[28px] p-5 shadow-lg shadow-brand-blue/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10">
          <h2 className="text-white/80 font-bold text-[13px] tracking-tight mb-4">
            In {monthName}, you earned <span className="text-emerald-400 font-black">₹{totalIncome.toLocaleString()}</span> and spent <span className="text-rose-400 font-black">₹{totalExpense.toLocaleString()}</span>, leaving you with a net savings of <span className="text-white font-black">₹{savings.toLocaleString()}</span>.
          </h2>
          
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Savings Rate</span>
              <span className="text-lg font-heading font-black text-white">{savingsRate}%</span>
            </div>
            <div className="h-2.5 bg-black/20 rounded-full overflow-hidden flex">
              {totalIncome > 0 ? (
                <>
                  <div className="h-full bg-emerald-400 transition-all duration-1000" style={{ width: `${Math.max(0, savingsRate as any)}%` }} />
                  <div className="h-full bg-rose-400 transition-all duration-1000" style={{ width: `${Math.max(0, 100 - (savingsRate as any))}%` }} />
                </>
              ) : (
                <div className="h-full w-full bg-rose-400" />
              )}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] font-bold text-emerald-400/80 uppercase tracking-wider">Saved</span>
              <span className="text-[8px] font-bold text-rose-400/80 uppercase tracking-wider">Spent</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── GRID LAYOUT ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* ── 2. WHERE DID YOUR MONEY GO? (CATEGORIES) ── */}
        <div className="bg-white dark:bg-[#0C0C0F] rounded-[28px] border border-neutral-100 dark:border-white/5 shadow-sm p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500"><PieIcon className="w-3.5 h-3.5" /></div>
            <h2 className="text-[11px] font-black text-neutral-800 dark:text-white uppercase tracking-widest">Spends by Category</h2>
          </div>
          
          {pieData.length > 0 ? (
            <div className="flex-1 flex flex-col">
              <div className="h-[180px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" paddingAngle={4} dataKey="value" stroke="none">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ background: '#111', border: 'none', borderRadius: 12, color: '#fff', fontSize: 12, fontWeight: 'bold' }}
                      itemStyle={{ color: '#fff' }}
                      formatter={(val: number) => `₹${val.toLocaleString()}`}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Total Spent</span>
                  <span className="text-lg font-heading font-black text-brand-blue dark:text-white tracking-tighter -mt-1">₹{totalExpense.toLocaleString()}</span>
                </div>
              </div>

              {/* Legend List */}
              <div className="space-y-2.5 mt-4">
                {pieData.slice(0, 4).map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">
                        {CATEGORY_ICONS[d.name] || '📦'} {d.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black text-neutral-400">{((d.value / totalExpense) * 100).toFixed(0)}%</span>
                      <span className="text-[11px] font-black text-brand-blue dark:text-white min-w-[50px] text-right">₹{d.value.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-40 py-10">
              <PieIcon className="w-8 h-8 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">No spending data</p>
            </div>
          )}
        </div>

        {/* ── 3. WHICH ACCOUNT DID YOU USE? ── */}
        <div className="bg-white dark:bg-[#0C0C0F] rounded-[28px] border border-neutral-100 dark:border-white/5 shadow-sm p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500"><Layers className="w-3.5 h-3.5" /></div>
            <h2 className="text-[11px] font-black text-neutral-800 dark:text-white uppercase tracking-widest">Spends by Account</h2>
          </div>

          {accData.length > 0 ? (
            <div className="space-y-3">
              {accData.map((d, i) => {
                const pct = (d.value / totalExpense) * 100;
                return (
                  <div key={d.name} className="bg-neutral-50 dark:bg-white/[0.02] p-3 rounded-2xl">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-[11px] font-black text-neutral-800 dark:text-white truncate pr-2">{d.name}</span>
                      <span className="text-[12px] font-heading font-black text-brand-blue dark:text-emerald-400 tracking-tight shrink-0">
                        ₹{d.value.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-40 py-10">
              <Layers className="w-8 h-8 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">No account data</p>
            </div>
          )}
        </div>

        {/* ── 4. TOP CLASSIFICATIONS (TAGS) ── */}
        <div className="bg-white dark:bg-[#0C0C0F] rounded-[28px] border border-neutral-100 dark:border-white/5 shadow-sm p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500"><Tag className="w-3.5 h-3.5" /></div>
            <h2 className="text-[11px] font-black text-neutral-800 dark:text-white uppercase tracking-widest">Top Tags</h2>
          </div>
          
          {tagData.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tagData.map((d) => (
                <div key={d.name} className="flex items-center justify-between w-full bg-neutral-50 dark:bg-white/[0.02] p-2.5 rounded-xl">
                  <span className="text-[10px] font-black text-neutral-600 dark:text-neutral-300 uppercase tracking-widest">#{d.name}</span>
                  <span className="text-[11px] font-black text-brand-blue dark:text-amber-400">₹{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-40 py-10">
              <Tag className="w-8 h-8 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">No tags used</p>
            </div>
          )}
        </div>

        {/* ── 5. TOP MERCHANTS / PAYEES ── */}
        <div className="bg-white dark:bg-[#0C0C0F] rounded-[28px] border border-neutral-100 dark:border-white/5 shadow-sm p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500"><Store className="w-3.5 h-3.5" /></div>
            <h2 className="text-[11px] font-black text-neutral-800 dark:text-white uppercase tracking-widest">Top Payees</h2>
          </div>

          {partyData.length > 0 ? (
            <div className="space-y-2">
              {partyData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between w-full p-2 border-b border-neutral-50 dark:border-white/5 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-5 h-5 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center text-[9px] font-black shrink-0">{i+1}</div>
                    <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-200 truncate pr-2">{d.name}</span>
                  </div>
                  <span className="text-[11px] font-black text-brand-blue dark:text-rose-400 shrink-0">₹{d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-40 py-10">
              <Store className="w-8 h-8 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">No payee data</p>
            </div>
          )}
        </div>

      </div>

      {/* ── 6. SPENDING TRENDS (BIG PICTURE) ── */}
      <div className="bg-white dark:bg-[#0C0C0F] rounded-[28px] border border-neutral-100 dark:border-white/5 shadow-sm p-4 md:col-span-2">
        <h2 className="text-[11px] font-black text-neutral-800 dark:text-white uppercase tracking-widest mb-1">6-Month Big Picture</h2>
        <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-5">{trendInsight}</p>
        
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} barSize={10} barGap={4} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#888" strokeOpacity={0.1} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#888', fontWeight: 800 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fontSize: 9, fill: '#888', fontWeight: 800 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip
                cursor={{ fill: '#888', opacity: 0.05 }}
                contentStyle={{ background: '#111', border: 'none', borderRadius: 16, color: '#fff', fontSize: 12, fontWeight: 'bold' }}
                itemStyle={{ color: '#fff' }}
                formatter={(val: number) => `₹${val.toLocaleString()}`}
              />
              <Bar dataKey="income" fill="#34D399" radius={[4,4,0,0]} name="Income" />
              <Bar dataKey="expenses" fill="#FB7185" radius={[4,4,0,0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-neutral-100 dark:border-white/5">
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" /><span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Income</span></div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#FB7185]" /><span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Expenses</span></div>
        </div>
      </div>

    </div>
  );
}
