import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Minus, PieChart as PieIcon } from 'lucide-react';

const COLORS = ['#00A86B', '#1A237E', '#D4AF37', '#82EEFD', '#E53935', '#3B3B98', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

const CATEGORY_ICONS: Record<string, string> = {
  'Food': '🍔', 'Transport': '🚗', 'Shopping': '🛍️', 'Bills': '⚡',
  'Entertainment': '🎬', 'Salary': '💰', 'Transfer': '💸', 'Groceries': '🛒',
  'Health': '💊', 'Education': '📚', 'Housing': '🏠', 'Travel': '✈️',
  'Investment': '📈', 'Loan': '🏦', 'Other': '📝',
};

export default function Summary() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'pie' | 'bar'>('pie');

  const transactions = useLiveQuery(() => db.transactions.toArray(), [user?.uid]) || [];

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

  const expensesByCategory = expenses.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(expensesByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Last 6 months bar data
  const barData = Array.from({ length: 6 }, (_, i) => {
    const m = subMonths(new Date(), 5 - i);
    const ms = startOfMonth(m);
    const me = endOfMonth(m);
    const txs = transactions.filter(tx => isWithinInterval(new Date(tx.dateTime), { start: ms, end: me }));
    return {
      month: format(m, 'MMM'),
      income: txs.filter(tx => tx.type === 'CREDIT' && tx.category !== 'Transfer').reduce((s, tx) => s + tx.amount, 0),
      expenses: txs.filter(tx => tx.type === 'DEBIT' && tx.category !== 'Transfer').reduce((s, tx) => s + tx.amount, 0),
    };
  });

  const isCurrentMonth = format(currentMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-heading font-semibold text-brand-blue dark:text-[#F7F7F7] tracking-tight">Summary</h1>
        <div className="flex items-center gap-2 bg-white dark:bg-[#111111] px-4 py-2 rounded-2xl shadow-sm border border-brand-blue/5 dark:border-[#222222]">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="p-1 hover:text-brand-green text-brand-blue/40 dark:text-[#A0A0A0] transition-colors rounded-lg hover:bg-brand-green/5 active:scale-90">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-brand-blue dark:text-[#F7F7F7] text-[11px] uppercase tracking-[0.2em] min-w-[100px] text-center">
            {format(currentMonth, 'MMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(m => { const next = new Date(m.getFullYear(), m.getMonth() + 1, 1); return next > new Date() ? m : next; })}
            disabled={isCurrentMonth}
            className="p-1 hover:text-brand-green text-brand-blue/40 dark:text-[#A0A0A0] transition-colors rounded-lg hover:bg-brand-green/5 active:scale-90 disabled:opacity-30 disabled:pointer-events-none">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Income */}
        <div className="bg-white dark:bg-[#111111] p-4 rounded-[24px] border border-brand-blue/5 dark:border-[#222222] shadow-sm col-span-1 flex flex-col gap-1">
          <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Income</p>
          <p className="text-base font-heading font-black text-brand-blue dark:text-white tracking-tighter leading-none">
            ₹{totalIncome.toLocaleString('en-IN')}
          </p>
          {incomeChange !== null && (
            <div className={`flex items-center gap-0.5 text-[8px] font-bold ${parseFloat(incomeChange) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {parseFloat(incomeChange) >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {Math.abs(parseFloat(incomeChange))}% vs last
            </div>
          )}
        </div>

        {/* Expenses */}
        <div className="bg-white dark:bg-[#111111] p-4 rounded-[24px] border border-brand-blue/5 dark:border-[#222222] shadow-sm col-span-1 flex flex-col gap-1">
          <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Spent</p>
          <p className="text-base font-heading font-black text-brand-blue dark:text-white tracking-tighter leading-none">
            ₹{totalExpense.toLocaleString('en-IN')}
          </p>
          {expenseChange !== null && (
            <div className={`flex items-center gap-0.5 text-[8px] font-bold ${parseFloat(expenseChange) <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {parseFloat(expenseChange) <= 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
              {Math.abs(parseFloat(expenseChange))}% vs last
            </div>
          )}
        </div>

        {/* Savings */}
        <div className={`p-4 rounded-[24px] border shadow-sm col-span-1 flex flex-col gap-1 ${
          savings >= 0
            ? 'bg-brand-green/5 border-brand-green/10'
            : 'bg-rose-500/5 border-rose-500/10'
        }`}>
          <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Saved</p>
          <p className={`text-base font-heading font-black tracking-tighter leading-none ${savings >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
            {savings >= 0 ? '+' : ''}₹{Math.abs(savings).toLocaleString('en-IN')}
          </p>
          <div className={`flex items-center gap-0.5 text-[8px] font-bold ${savings >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
            {savings >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
            {savingsRate}% rate
          </div>
        </div>
      </div>

      {/* Chart Toggle */}
      <div className="bg-white dark:bg-[#111111] rounded-[28px] border border-brand-blue/5 dark:border-[#222222] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 pb-0">
          <h2 className="text-sm font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tight">Analysis</h2>
          <div className="flex bg-neutral-100 dark:bg-[#1A1A1A] p-0.5 rounded-xl">
            <button onClick={() => setActiveTab('pie')}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'pie' ? 'bg-white dark:bg-[#222222] text-brand-green shadow-sm' : 'text-neutral-400'}`}>
              Category
            </button>
            <button onClick={() => setActiveTab('bar')}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'bar' ? 'bg-white dark:bg-[#222222] text-brand-green shadow-sm' : 'text-neutral-400'}`}>
              6 Months
            </button>
          </div>
        </div>

        {activeTab === 'pie' ? (
          pieData.length > 0 ? (
            <div className="p-4">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" paddingAngle={2} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#111111', border: '1px solid #222', borderRadius: 12, fontSize: 11 }}
                      formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="space-y-2 mt-2">
                {pieData.slice(0, 6).map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-[11px] font-semibold text-brand-blue/60 dark:text-[#A0A0A0] flex items-center gap-1">
                        {CATEGORY_ICONS[d.name] || '📦'} {d.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-neutral-400">{((d.value / totalExpense) * 100).toFixed(0)}%</span>
                      <span className="text-[11px] font-black text-brand-blue dark:text-white">₹{d.value.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <PieIcon className="w-10 h-10 text-neutral-200 dark:text-neutral-700 mb-3" />
              <p className="text-sm font-bold text-neutral-400">No expenses this month</p>
              <p className="text-xs text-neutral-300 dark:text-neutral-600 mt-1">Add transactions to see your spending breakdown</p>
            </div>
          )
        ) : (
          <div className="p-4">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barSize={8} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#A0A0A0', fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#A0A0A0' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#111111', border: '1px solid #222', borderRadius: 12, fontSize: 11 }}
                    formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']}
                  />
                  <Bar dataKey="income" fill="#00A86B" radius={[4,4,0,0]} />
                  <Bar dataKey="expenses" fill="#E53935" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 justify-center">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-green" /><span className="text-[10px] text-neutral-400 font-bold">Income</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-red" /><span className="text-[10px] text-neutral-400 font-bold">Expenses</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Top spending categories */}
      {pieData.length > 0 && (
        <div className="bg-white dark:bg-[#111111] rounded-[28px] border border-brand-blue/5 dark:border-[#222222] shadow-sm p-4">
          <h2 className="text-sm font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tight mb-4">Top Spends</h2>
          <div className="space-y-3">
            {pieData.slice(0, 5).map((d, i) => {
              const pct = totalExpense > 0 ? (d.value / totalExpense) * 100 : 0;
              return (
                <div key={d.name} className="stagger-item">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-brand-blue dark:text-[#F7F7F7] flex items-center gap-1.5">
                      {CATEGORY_ICONS[d.name] || '📦'} {d.name}
                    </span>
                    <span className="text-[11px] font-black text-brand-blue dark:text-white">₹{d.value.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="h-1.5 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
