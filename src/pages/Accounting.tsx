import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths } from 'date-fns';
import { Lock, Unlock, TrendingUp, TrendingDown, Wallet, AlertCircle, BarChart3, PieChart as PieChartIcon, ArrowUpRight, ArrowDownLeft, ChevronDown, ChevronUp, Eye, CreditCard, Activity, Calendar, Layers } from 'lucide-react';
import { useState, useMemo } from 'react';

import { IndusIndLogo } from '../components/IndusIndLogo';
import { UnionBankLogo } from '../components/UnionBankLogo';

const CATEGORY_COLORS_MAP: Record<string, string> = {
  'Food': '#f97316', 'Transport': '#3b82f6', 'Rent': '#8b5cf6', 'Shopping': '#ec4899',
  'Bills': '#eab308', 'Entertainment': '#ef4444', 'Salary': '#10b981', 'Transfer': '#6b7280', 'Other': '#94a3b8'
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS_MAP[cat] || '#6b7280';
}

// Simple horizontal bar component
function HBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full h-2 bg-neutral-100 dark:bg-[#222222] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function Accounting() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.orderBy('dateTime').toArray()) || [];
  const monthlyClosings = useLiveQuery(() => db.monthlyClosings.orderBy('month').reverse().toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];

  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'periods'>('overview');

  // ─── Derived Data ───
  const now = new Date();
  const thisMonthStr = format(now, 'yyyy-MM');
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);

  const thisMonthTxs = transactions.filter(tx => isWithinInterval(tx.dateTime, { start: thisMonthStart, end: thisMonthEnd }));
  const thisMonthIncome = thisMonthTxs.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
  const thisMonthExpense = thisMonthTxs.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0);
  const thisMonthSavings = thisMonthIncome - thisMonthExpense;
  const savingsRate = thisMonthIncome > 0 ? (thisMonthSavings / thisMonthIncome) * 100 : 0;

  // All-time stats
  const totalAllIncome = transactions.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
  const totalAllExpense = transactions.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0);
  const totalTxCount = transactions.length;

  // Current total balance across all accounts (starting + all txns)
  const currentNetWorth = useMemo(() => {
    let total = accounts.reduce((s, a) => s + a.startingBalance, 0);
    transactions.forEach(tx => {
      if (tx.type === 'CREDIT') total += tx.amount;
      else total -= tx.amount;
    });
    return total;
  }, [accounts, transactions]);

  // Last month comparison
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));
  const lastMonthTxs = transactions.filter(tx => isWithinInterval(tx.dateTime, { start: lastMonthStart, end: lastMonthEnd }));
  const lastMonthExpense = lastMonthTxs.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0);
  const lastMonthIncome = lastMonthTxs.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
  const expenseChangePercent = lastMonthExpense > 0 ? ((thisMonthExpense - lastMonthExpense) / lastMonthExpense) * 100 : 0;
  const incomeChangePercent = lastMonthIncome > 0 ? ((thisMonthIncome - lastMonthIncome) / lastMonthIncome) * 100 : 0;

  // Category breakdown for this month
  const categoryBreakdown = useMemo(() => {
    const byCategory: Record<string, number> = {};
    thisMonthTxs.filter(t => t.type === 'DEBIT').forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    });
    return Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [thisMonthTxs]);

  const maxCategoryValue = categoryBreakdown.length > 0 ? categoryBreakdown[0].value : 1;

  // Top merchants/parties
  const topParties = useMemo(() => {
    const byParty: Record<string, { total: number; count: number }> = {};
    thisMonthTxs.filter(t => t.type === 'DEBIT' && t.party).forEach(t => {
      if (!byParty[t.party!]) byParty[t.party!] = { total: 0, count: 0 };
      byParty[t.party!].total += t.amount;
      byParty[t.party!].count++;
    });
    return Object.entries(byParty)
      .map(([name, { total, count }]) => ({ name, total, count }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [thisMonthTxs]);

  // Monthly trend (last 6 months)
  const monthlyTrend = useMemo(() => {
    const months: { month: string; label: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      const ms = startOfMonth(m);
      const me = endOfMonth(m);
      const mtxs = transactions.filter(tx => isWithinInterval(tx.dateTime, { start: ms, end: me }));
      months.push({
        month: format(m, 'yyyy-MM'),
        label: format(m, 'MMM'),
        income: mtxs.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0),
        expense: mtxs.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0),
      });
    }
    return months;
  }, [transactions]);

  const maxTrendValue = Math.max(...monthlyTrend.map(m => Math.max(m.income, m.expense)), 1);

  // Account-wise current balance
  const accountBalances = useMemo(() => {
    const balances: Record<number, number> = {};
    accounts.forEach(a => { balances[a.id!] = a.startingBalance; });
    transactions.forEach(tx => {
      if (balances[tx.accountId] === undefined) balances[tx.accountId] = 0;
      if (tx.type === 'CREDIT') balances[tx.accountId] += tx.amount;
      else balances[tx.accountId] -= tx.amount;
    });
    return balances;
  }, [accounts, transactions]);

  // ─── Period Close Logic ───
  const earliestTx = transactions[0];
  const startMonth = earliestTx ? startOfMonth(earliestTx.dateTime) : startOfMonth(now);
  const endMonth = startOfMonth(now);
  const allMonths: string[] = [];
  let current = startMonth;
  while (current <= endMonth) {
    allMonths.push(format(current, 'yyyy-MM'));
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }

  let currentAccountBalances: Record<number, number> = {};
  accounts.forEach(acc => { currentAccountBalances[acc.id!] = acc.startingBalance; });
  let currentTotalBalance = accounts.reduce((sum, acc) => sum + acc.startingBalance, 0);
  const chronologicalMonths = [...allMonths];

  const monthlyData: Record<string, any> = {};
  chronologicalMonths.forEach(monthStr => {
    const closedRecord = monthlyClosings.find(c => c.month === monthStr);
    const monthTxs = transactions.filter(tx => format(tx.dateTime, 'yyyy-MM') === monthStr);
    const income = monthTxs.filter(t => t.type === 'CREDIT').reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'DEBIT').reduce((sum, t) => sum + t.amount, 0);
    const openingBalance = currentTotalBalance;
    monthTxs.forEach(tx => {
      if (currentAccountBalances[tx.accountId] === undefined) currentAccountBalances[tx.accountId] = 0;
      if (tx.type === 'CREDIT') currentAccountBalances[tx.accountId] += tx.amount;
      if (tx.type === 'DEBIT') currentAccountBalances[tx.accountId] -= tx.amount;
    });
    const dynamicClosingBalance = openingBalance + income - expense;
    monthlyData[monthStr] = {
      month: monthStr, openingBalance, totalIncome: income, totalExpense: expense,
      closingBalance: closedRecord ? closedRecord.closingBalance : dynamicClosingBalance,
      dynamicClosingBalance, isClosed: !!closedRecord, closedAt: closedRecord?.closedAt,
      accountBalances: closedRecord ? closedRecord.accountBalances : { ...currentAccountBalances },
      txCount: monthTxs.length,
    };
    currentTotalBalance = monthlyData[monthStr].closingBalance;
    if (closedRecord) currentAccountBalances = { ...closedRecord.accountBalances };
  });

  const displayMonths = [...allMonths].reverse();

  const handleCloseMonth = async (monthStr: string) => {
    if (!window.confirm(`Close the accounting period for ${format(new Date(monthStr + '-01'), 'MMMM yyyy')}? This will lock the balances.`)) return;
    const data = monthlyData[monthStr];
    try {
      await db.monthlyClosings.add({ month: monthStr, closedAt: new Date(), accountBalances: data.accountBalances, totalIncome: data.totalIncome, totalExpense: data.totalExpense, closingBalance: data.closingBalance });
    } catch (error) { alert('Failed to close month.'); }
  };

  const handleReopenMonth = async (monthStr: string) => {
    if (!window.confirm(`Reopen ${format(new Date(monthStr + '-01'), 'MMMM yyyy')}? Balances will be recalculated.`)) return;
    try {
      const record = monthlyClosings.find(c => c.month === monthStr);
      if (record?.id) await db.monthlyClosings.delete(record.id);
    } catch (error) { alert('Failed to reopen month.'); }
  };

  const getBankLogo = (account: any) => {
    const name = account.bankName.toLowerCase();
    if (name.includes('canara')) return <img src="https://crystalpng.com/wp-content/uploads/2025/11/Canara-Bank-Logo.png" alt="Canara" className="w-full h-full object-contain" referrerPolicy="no-referrer" />;
    if (name.includes('indus') || name.includes('insus')) return <IndusIndLogo className="w-full h-full object-contain" />;
    if (name.includes('union')) return <UnionBankLogo className="w-full h-full object-contain" />;
    return <span className="text-xs font-bold">{account.bankName.charAt(0).toUpperCase()}</span>;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#222222] dark:text-[#F7F7F7]">Financial Overview</h1>
        <p className="text-[#717171] dark:text-[#A0A0A0] mt-1">Bird's eye view of your complete financial health</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-neutral-100 dark:bg-[#1A1A1A] p-1.5 rounded-2xl">
        <button onClick={() => setActiveTab('overview')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'overview' ? 'bg-white dark:bg-[#333333] shadow-sm text-[#222222] dark:text-[#F7F7F7]' : 'text-[#717171] dark:text-[#A0A0A0]'}`}>
          <BarChart3 className="w-4 h-4" /> Overview
        </button>
        <button onClick={() => setActiveTab('periods')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'periods' ? 'bg-white dark:bg-[#333333] shadow-sm text-[#222222] dark:text-[#F7F7F7]' : 'text-[#717171] dark:text-[#A0A0A0]'}`}>
          <Calendar className="w-4 h-4" /> Period Close
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* ═══════════════════════════════════════════  OVERVIEW TAB  ═══════════════════════════════════════════ */}

          {/* Net Worth Hero Card */}
          <div className="bg-gradient-to-br from-[#222222] to-[#444444] dark:from-[#1A1A1A] dark:to-[#111111] rounded-3xl p-6 text-white border border-[#333333] dark:border-[#222222] shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-white/60" />
              <span className="text-sm font-bold text-white/60 uppercase tracking-wider">Current Net Worth</span>
            </div>
            <p className="text-4xl sm:text-5xl font-black tracking-tight">
              ₹{currentNetWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-white/50 font-bold">Total Earned</p>
                <p className="text-lg font-bold text-emerald-400">₹{totalAllIncome.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-white/50 font-bold">Total Spent</p>
                <p className="text-lg font-bold text-rose-400">₹{totalAllExpense.toLocaleString('en-IN')}</p>
              </div>
              <div>
                <p className="text-xs text-white/50 font-bold">Transactions</p>
                <p className="text-lg font-bold">{totalTxCount}</p>
              </div>
            </div>
          </div>

          {/* This Month KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-[#111111] rounded-2xl border border-[#EBEBEB] dark:border-[#222222] p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] font-bold text-[#717171] dark:text-[#A0A0A0] uppercase tracking-wider">Income</span>
              </div>
              <p className="text-xl font-black text-emerald-600">₹{thisMonthIncome.toLocaleString('en-IN')}</p>
              {incomeChangePercent !== 0 && (
                <p className={`text-[10px] font-bold mt-1 ${incomeChangePercent > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {incomeChangePercent > 0 ? '↑' : '↓'} {Math.abs(incomeChangePercent).toFixed(0)}% vs last month
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-[#111111] rounded-2xl border border-[#EBEBEB] dark:border-[#222222] p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowDownLeft className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-[11px] font-bold text-[#717171] dark:text-[#A0A0A0] uppercase tracking-wider">Expenses</span>
              </div>
              <p className="text-xl font-black text-rose-600">₹{thisMonthExpense.toLocaleString('en-IN')}</p>
              {expenseChangePercent !== 0 && (
                <p className={`text-[10px] font-bold mt-1 ${expenseChangePercent < 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {expenseChangePercent > 0 ? '↑' : '↓'} {Math.abs(expenseChangePercent).toFixed(0)}% vs last month
                </p>
              )}
            </div>
            <div className="bg-white dark:bg-[#111111] rounded-2xl border border-[#EBEBEB] dark:border-[#222222] p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="w-3.5 h-3.5 text-[#717171] dark:text-[#A0A0A0]" />
                <span className="text-[11px] font-bold text-[#717171] dark:text-[#A0A0A0] uppercase tracking-wider">Savings</span>
              </div>
              <p className={`text-xl font-black ${thisMonthSavings >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {thisMonthSavings >= 0 ? '+' : '-'}₹{Math.abs(thisMonthSavings).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-white dark:bg-[#111111] rounded-2xl border border-[#EBEBEB] dark:border-[#222222] p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                <PieChartIcon className="w-3.5 h-3.5 text-[#717171] dark:text-[#A0A0A0]" />
                <span className="text-[11px] font-bold text-[#717171] dark:text-[#A0A0A0] uppercase tracking-wider">Savings Rate</span>
              </div>
              <p className={`text-xl font-black ${savingsRate >= 20 ? 'text-emerald-600' : savingsRate >= 0 ? 'text-amber-500' : 'text-rose-600'}`}>
                {savingsRate.toFixed(0)}%
              </p>
              <p className="text-[10px] font-bold mt-1 text-[#B0B0B0] dark:text-[#666666]">
                {savingsRate >= 20 ? 'Great!' : savingsRate >= 0 ? 'Moderate' : 'Overspending'}
              </p>
            </div>
          </div>

          {/* 6-Month Trend (Pure CSS bars) */}
          <div className="bg-white dark:bg-[#111111] rounded-3xl border border-[#EBEBEB] dark:border-[#222222] shadow-sm p-6">
            <h2 className="text-lg font-bold text-[#222222] dark:text-[#F7F7F7] mb-1 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#717171] dark:text-[#A0A0A0]" />
              6-Month Trend
            </h2>
            <p className="text-xs font-medium text-[#B0B0B0] dark:text-[#666666] mb-5">Income vs Expenses over the last 6 months</p>
            
            <div className="flex items-end gap-2 sm:gap-4 h-48">
              {monthlyTrend.map(m => {
                const incH = maxTrendValue > 0 ? (m.income / maxTrendValue) * 100 : 0;
                const expH = maxTrendValue > 0 ? (m.expense / maxTrendValue) * 100 : 0;
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                    <div className="flex items-end gap-0.5 w-full h-full justify-center">
                      <div className="w-[45%] bg-emerald-500 rounded-t-md transition-all duration-500 group-hover:opacity-80 min-h-[2px]" style={{ height: `${Math.max(incH, 1)}%` }} title={`Income: ₹${m.income.toLocaleString('en-IN')}`} />
                      <div className="w-[45%] bg-rose-500 rounded-t-md transition-all duration-500 group-hover:opacity-80 min-h-[2px]" style={{ height: `${Math.max(expH, 1)}%` }} title={`Expense: ₹${m.expense.toLocaleString('en-IN')}`} />
                    </div>
                    <span className="text-[10px] font-bold text-[#717171] dark:text-[#A0A0A0] mt-1">{m.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-4 justify-center">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-emerald-500 rounded-sm" /><span className="text-xs font-bold text-[#717171] dark:text-[#A0A0A0]">Income</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-rose-500 rounded-sm" /><span className="text-xs font-bold text-[#717171] dark:text-[#A0A0A0]">Expense</span></div>
            </div>
          </div>

          {/* Account-wise Balances */}
          <div className="bg-white dark:bg-[#111111] rounded-3xl border border-[#EBEBEB] dark:border-[#222222] shadow-sm p-6">
            <h2 className="text-lg font-bold text-[#222222] dark:text-[#F7F7F7] mb-1 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#717171] dark:text-[#A0A0A0]" />
              Account Balances
            </h2>
            <p className="text-xs font-medium text-[#B0B0B0] dark:text-[#666666] mb-4">Current balance across all your accounts</p>

            {accounts.length === 0 ? (
              <p className="text-center text-[#717171] dark:text-[#A0A0A0] py-6 font-medium">No accounts yet.</p>
            ) : (
              <div className="space-y-3">
                {accounts.map(acc => {
                  const bal = accountBalances[acc.id!] ?? 0;
                  return (
                    <div key={acc.id} className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-[#1A1A1A] rounded-xl border border-[#EBEBEB] dark:border-[#222222]">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white dark:bg-[#111111] rounded-full flex items-center justify-center border border-[#EBEBEB] dark:border-[#222222] overflow-hidden p-1">
                          {getBankLogo(acc)}
                        </div>
                        <div>
                          <p className="font-bold text-[#222222] dark:text-[#F7F7F7] text-sm">{acc.bankName}</p>
                          {acc.accountLast4 && <p className="text-xs text-[#B0B0B0] dark:text-[#666666]">••••{acc.accountLast4}</p>}
                        </div>
                      </div>
                      <p className={`font-black text-lg ${bal >= 0 ? 'text-[#222222] dark:text-[#F7F7F7]' : 'text-rose-600'}`}>
                        ₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Two-column: Category Breakdown + Top Merchants */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <div className="bg-white dark:bg-[#111111] rounded-3xl border border-[#EBEBEB] dark:border-[#222222] shadow-sm p-6">
              <h2 className="text-lg font-bold text-[#222222] dark:text-[#F7F7F7] mb-1 flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#717171] dark:text-[#A0A0A0]" />
                Spending by Category
              </h2>
              <p className="text-xs font-medium text-[#B0B0B0] dark:text-[#666666] mb-4">{format(now, 'MMMM yyyy')}</p>
              {categoryBreakdown.length === 0 ? (
                <p className="text-center text-[#717171] dark:text-[#A0A0A0] py-6 font-medium">No expenses this month.</p>
              ) : (
                <div className="space-y-3">
                  {categoryBreakdown.map(cat => (
                    <div key={cat.name}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-[#222222] dark:text-[#F7F7F7]">{cat.name}</span>
                        <span className="text-sm font-black text-[#222222] dark:text-[#F7F7F7]">₹{cat.value.toLocaleString('en-IN')}</span>
                      </div>
                      <HBar value={cat.value} max={maxCategoryValue} color={getCategoryColor(cat.name)} />
                      <p className="text-[10px] font-bold text-[#B0B0B0] dark:text-[#666666] mt-0.5">{thisMonthExpense > 0 ? ((cat.value / thisMonthExpense) * 100).toFixed(1) : 0}% of total</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Merchants */}
            <div className="bg-white dark:bg-[#111111] rounded-3xl border border-[#EBEBEB] dark:border-[#222222] shadow-sm p-6">
              <h2 className="text-lg font-bold text-[#222222] dark:text-[#F7F7F7] mb-1 flex items-center gap-2">
                <Eye className="w-5 h-5 text-[#717171] dark:text-[#A0A0A0]" />
                Top Merchants
              </h2>
              <p className="text-xs font-medium text-[#B0B0B0] dark:text-[#666666] mb-4">Who you spent the most with this month</p>
              {topParties.length === 0 ? (
                <p className="text-center text-[#717171] dark:text-[#A0A0A0] py-6 font-medium">No merchant data yet.</p>
              ) : (
                <div className="space-y-3">
                  {topParties.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-[#1A1A1A] rounded-xl border border-[#EBEBEB] dark:border-[#222222]">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-[#222222] flex items-center justify-center text-xs font-black text-[#717171] dark:text-[#A0A0A0]">
                        #{i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#222222] dark:text-[#F7F7F7] truncate">{p.name}</p>
                        <p className="text-[10px] font-bold text-[#B0B0B0] dark:text-[#666666]">{p.count} transaction{p.count > 1 ? 's' : ''}</p>
                      </div>
                      <p className="font-black text-rose-600 text-sm shrink-0">₹{p.total.toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ══════════════════════════════════  PERIOD CLOSE TAB  ═══════════════════════════════════════════ */}
          <div className="space-y-4">
            {displayMonths.map(monthStr => {
              const data = monthlyData[monthStr];
              const monthDate = new Date(monthStr + '-01');
              const isDiscrepancy = data.isClosed && Math.abs(data.closingBalance - data.dynamicClosingBalance) > 0.01;
              const isExpanded = expandedMonth === monthStr;

              return (
                <div key={monthStr} className={`bg-white dark:bg-[#111111] rounded-3xl shadow-sm border overflow-hidden transition-colors ${data.isClosed ? 'border-[#EBEBEB] dark:border-[#222222]' : 'border-neutral-200 dark:border-[#333333]'}`}>
                  {/* Month Header Row */}
                  <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer" onClick={() => setExpandedMonth(isExpanded ? null : monthStr)}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${data.isClosed ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' : 'bg-neutral-100 dark:bg-[#1A1A1A] text-[#222222] dark:text-[#F7F7F7]'}`}>
                        {data.isClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-[#222222] dark:text-[#F7F7F7]">{format(monthDate, 'MMMM yyyy')}</h2>
                          {isDiscrepancy && <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-[#717171] dark:text-[#A0A0A0] font-medium">
                          {data.isClosed ? `Closed on ${format(data.closedAt!, 'MMM dd, yyyy')}` : 'Open Period'} • {data.txCount} txns
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="flex-1 sm:flex-none text-right sm:text-left mr-2">
                        <p className="text-xs text-[#B0B0B0] dark:text-[#666666] font-bold">Closing</p>
                        <p className="text-lg font-black text-[#222222] dark:text-[#F7F7F7]">₹{data.closingBalance.toLocaleString('en-IN')}</p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-[#717171] dark:text-[#A0A0A0]" /> : <ChevronDown className="w-5 h-5 text-[#717171] dark:text-[#A0A0A0]" />}
                    </div>
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-[#EBEBEB] dark:border-[#222222]">
                      {isDiscrepancy && (
                        <div className="mx-6 mt-4 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-start gap-3 text-amber-800 dark:text-amber-400">
                          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-sm">Balance Discrepancy</p>
                            <p className="text-xs mt-1">Locked: ₹{data.closingBalance.toLocaleString('en-IN')} | Dynamic: ₹{data.dynamicClosingBalance.toLocaleString('en-IN')} — Reopen and close to sync.</p>
                          </div>
                        </div>
                      )}

                      <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs font-bold text-[#717171] dark:text-[#A0A0A0] mb-1">Opening Balance</p>
                          <p className="text-xl font-bold text-[#222222] dark:text-[#F7F7F7]">₹{data.openingBalance.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#717171] dark:text-[#A0A0A0] mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Income</p>
                          <p className="text-xl font-bold text-emerald-600">+₹{data.totalIncome.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#717171] dark:text-[#A0A0A0] mb-1 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5 text-rose-500" /> Expense</p>
                          <p className="text-xl font-bold text-rose-600">-₹{data.totalExpense.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#717171] dark:text-[#A0A0A0] mb-1 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Closing</p>
                          <p className="text-2xl font-black text-[#222222] dark:text-[#F7F7F7]">₹{data.closingBalance.toLocaleString('en-IN')}</p>
                        </div>
                      </div>

                      {/* Account Balances */}
                      {data.isClosed && (
                        <div className="px-6 pb-4">
                          <h3 className="text-xs font-bold text-[#717171] dark:text-[#A0A0A0] uppercase tracking-wider mb-3">Account Balances at Close</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.entries(data.accountBalances).map(([accountId, balance]) => {
                              const account = accounts.find(a => a.id === Number(accountId));
                              if (!account) return null;
                              return (
                                <div key={accountId} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-[#1A1A1A] rounded-xl border border-[#EBEBEB] dark:border-[#222222]">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-white dark:bg-[#111111] rounded-full flex items-center justify-center border border-[#EBEBEB] dark:border-[#222222] overflow-hidden p-0.5">
                                      {getBankLogo(account)}
                                    </div>
                                    <span className="text-sm font-bold text-[#222222] dark:text-[#F7F7F7]">{account.bankName}</span>
                                  </div>
                                  <span className="text-sm font-bold text-[#222222] dark:text-[#F7F7F7]">₹{(balance as number).toLocaleString('en-IN')}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Action button */}
                      <div className="px-6 pb-5 flex justify-end">
                        {data.isClosed ? (
                          <button onClick={() => handleReopenMonth(monthStr)} className="px-5 py-2.5 text-sm font-bold text-[#222222] dark:text-[#F7F7F7] bg-white dark:bg-[#111111] border border-[#EBEBEB] dark:border-[#222222] rounded-xl hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors">
                            Reopen Month
                          </button>
                        ) : (
                          <button onClick={() => handleCloseMonth(monthStr)} className="px-5 py-2.5 text-sm font-bold text-white dark:text-[#111111] bg-[#222222] dark:bg-[#F7F7F7] rounded-xl hover:bg-black dark:hover:bg-neutral-200 transition-colors">
                            Close Month
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {displayMonths.length === 0 && (
              <div className="text-center py-12 bg-white dark:bg-[#111111] rounded-3xl border border-[#EBEBEB] dark:border-[#222222]">
                <Wallet className="w-12 h-12 text-[#B0B0B0] dark:text-[#666666] mx-auto mb-3" />
                <h3 className="text-lg font-bold text-[#222222] dark:text-[#F7F7F7]">No accounting periods yet</h3>
                <p className="text-[#717171] dark:text-[#A0A0A0] mt-1">Add some transactions to see your monthly analysis.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
