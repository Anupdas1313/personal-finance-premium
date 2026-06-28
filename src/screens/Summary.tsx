import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useState, useMemo, Component, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, PieChart as PieIcon, Tag, Store, Layers, AlertTriangle } from 'lucide-react';
import { CATEGORY_ICONS } from '../constants';

const COLORS = ['#00A86B', '#6366F1', '#D4AF37', '#06B6D4', '#E53935', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#14B8A6'];

// ── Error Boundary ──────────────────────────────────────────────────────────
class SummaryErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || 'Unknown error' };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
          <h2 className="text-lg font-bold text-neutral-800 dark:text-white mb-2">Something went wrong</h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 max-w-xs">{this.state.error}</p>
          <button onClick={() => this.setState({ hasError: false, error: '' })}
            className="px-4 py-2 bg-brand-green text-white rounded-xl text-xs font-bold">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Helper: safe timestamp extraction ────────────────────────────────────────
function getTxTimestamp(dateTime: any): number {
  try {
    if (!dateTime) return 0;
    if (typeof dateTime === 'number') return dateTime;
    if (dateTime instanceof Date) {
      const t = dateTime.getTime();
      return isNaN(t) ? 0 : t;
    }
    if (typeof dateTime === 'string') {
      const d = new Date(dateTime.trim().replace(' ', 'T'));
      const t = d.getTime();
      return isNaN(t) ? 0 : t;
    }
    return 0;
  } catch {
    return 0;
  }
}

function safeNum(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

// ── Mini Donut (pure SVG, no recharts) ───────────────────────────────────────
function MiniDonut({ data, colors, size = 160 }: { data: { name: string; value: number }[]; colors: string[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = size / 2;
  const innerR = r * 0.62;
  const cx = r;
  const cy = r;
  let cumAngle = -90;

  const arcs = data.map((d, i) => {
    const pct = d.value / total;
    const angle = pct * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const ix1 = cx + innerR * Math.cos(endRad);
    const iy1 = cy + innerR * Math.sin(endRad);
    const ix2 = cx + innerR * Math.cos(startRad);
    const iy2 = cy + innerR * Math.sin(startRad);

    const pathD = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ');

    return <path key={i} d={pathD} fill={colors[i % colors.length]} />;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs}
    </svg>
  );
}

// ── Mini Bar Chart (pure SVG, no recharts) ───────────────────────────────────
function MiniBarChart({ data }: { data: { month: string; income: number; expenses: number }[] }) {
  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expenses)), 1);
  const barW = 12;
  const gap = 4;
  const groupW = barW * 2 + gap;
  const chartH = 140;
  const chartW = data.length * (groupW + 16);

  return (
    <div className="w-full overflow-x-auto">
      <svg width={chartW} height={chartH + 30} viewBox={`0 0 ${chartW} ${chartH + 30}`} className="mx-auto block">
        {data.map((d, i) => {
          const x = i * (groupW + 16) + 8;
          const incH = (d.income / maxVal) * chartH;
          const expH = (d.expenses / maxVal) * chartH;
          return (
            <g key={i}>
              <rect x={x} y={chartH - incH} width={barW} height={incH} rx={3} fill="#34D399" />
              <rect x={x + barW + gap} y={chartH - expH} width={barW} height={expH} rx={3} fill="#FB7185" />
              <text x={x + groupW / 2} y={chartH + 18} textAnchor="middle" fontSize={9} fontWeight={800} fill="#888">{d.month}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Main Summary Component ────────────────────────────────────────────────────
function SummaryContent() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const transactions = useLiveQuery(() => db.transactions.toArray(), [user?.uid]) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), [user?.uid]) || [];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const prevMonthStart = startOfMonth(subMonths(currentMonth, 1));
  const prevMonthEnd = endOfMonth(subMonths(currentMonth, 1));

  const monthStartTs = monthStart.getTime();
  const monthEndTs = monthEnd.getTime();
  const prevMonthStartTs = prevMonthStart.getTime();
  const prevMonthEndTs = prevMonthEnd.getTime();

  const monthTxs = useMemo(() => {
    try {
      return transactions.filter(tx => {
        const t = getTxTimestamp(tx.dateTime);
        return t >= monthStartTs && t <= monthEndTs;
      });
    } catch { return []; }
  }, [transactions, monthStartTs, monthEndTs]);

  const prevMonthTxs = useMemo(() => {
    try {
      return transactions.filter(tx => {
        const t = getTxTimestamp(tx.dateTime);
        return t >= prevMonthStartTs && t <= prevMonthEndTs;
      });
    } catch { return []; }
  }, [transactions, prevMonthStartTs, prevMonthEndTs]);

  const expenses = useMemo(() => monthTxs.filter(tx => tx.type === 'DEBIT' && tx.category !== 'Transfer'), [monthTxs]);
  const income = useMemo(() => monthTxs.filter(tx => tx.type === 'CREDIT' && tx.category !== 'Transfer'), [monthTxs]);
  const prevExpenses = useMemo(() => prevMonthTxs.filter(tx => tx.type === 'DEBIT' && tx.category !== 'Transfer'), [prevMonthTxs]);
  const prevIncome = useMemo(() => prevMonthTxs.filter(tx => tx.type === 'CREDIT' && tx.category !== 'Transfer'), [prevMonthTxs]);

  const totalExpense = useMemo(() => expenses.reduce((s, tx) => s + safeNum(tx.amount), 0), [expenses]);
  const totalIncome = useMemo(() => income.reduce((s, tx) => s + safeNum(tx.amount), 0), [income]);
  const prevTotalExpense = useMemo(() => prevExpenses.reduce((s, tx) => s + safeNum(tx.amount), 0), [prevExpenses]);
  const prevTotalIncome = useMemo(() => prevIncome.reduce((s, tx) => s + safeNum(tx.amount), 0), [prevIncome]);

  const savings = totalIncome - totalExpense;
  const savingsRateNum = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;
  const savingsRate = isNaN(savingsRateNum) ? 0 : savingsRateNum;

  const expenseChangePct = prevTotalExpense > 0 ? ((totalExpense - prevTotalExpense) / prevTotalExpense) * 100 : null;
  const incomeChangePct = prevTotalIncome > 0 ? ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100 : null;

  // ── Aggregations ──
  const { pieData, tagData, accData, partyData } = useMemo(() => {
    try {
      const byCategory: Record<string, number> = {};
      const byTag: Record<string, number> = {};
      const byAccount: Record<string, number> = {};
      const byParty: Record<string, number> = {};

      for (const tx of expenses) {
        const amt = safeNum(tx.amount);
        if (tx.category) byCategory[tx.category] = (byCategory[tx.category] || 0) + amt;
        if (tx.expenseType) byTag[tx.expenseType] = (byTag[tx.expenseType] || 0) + amt;
        const accName = accounts.find(a => a.id === tx.accountId)?.bankName || 'Unknown';
        byAccount[accName] = (byAccount[accName] || 0) + amt;
        if (tx.party && typeof tx.party === 'string') {
          const pName = tx.party.toUpperCase().trim();
          if (pName) byParty[pName] = (byParty[pName] || 0) + amt;
        }
      }

      const toSorted = (obj: Record<string, number>) =>
        Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

      return {
        pieData: toSorted(byCategory),
        tagData: toSorted(byTag).slice(0, 5),
        accData: toSorted(byAccount),
        partyData: toSorted(byParty).slice(0, 5),
      };
    } catch {
      return { pieData: [], tagData: [], accData: [], partyData: [] };
    }
  }, [expenses, accounts]);

  // ── 6-month bar data ──
  const barData = useMemo(() => {
    try {
      return Array.from({ length: 6 }, (_, i) => {
        const m = subMonths(new Date(), 5 - i);
        const msTs = startOfMonth(m).getTime();
        const meTs = endOfMonth(m).getTime();
        const txs = transactions.filter(tx => {
          const t = getTxTimestamp(tx.dateTime);
          return t >= msTs && t <= meTs;
        });
        return {
          month: format(m, 'MMM'),
          income: txs.filter(tx => tx.type === 'CREDIT' && tx.category !== 'Transfer').reduce((s, tx) => s + safeNum(tx.amount), 0),
          expenses: txs.filter(tx => tx.type === 'DEBIT' && tx.category !== 'Transfer').reduce((s, tx) => s + safeNum(tx.amount), 0),
        };
      });
    } catch {
      return [];
    }
  }, [transactions]);

  const avg6MonthExpense = barData.length > 0 ? barData.reduce((s, d) => s + d.expenses, 0) / barData.length : 0;
  const isCurrentMonth = format(currentMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
  const monthName = format(currentMonth, 'MMMM');

  let trendInsight = 'Keep tracking your expenses to see long-term trends.';
  if (avg6MonthExpense > 0 && totalExpense > avg6MonthExpense) {
    trendInsight = `You've spent ${Math.round(((totalExpense - avg6MonthExpense) / avg6MonthExpense) * 100)}% more this month compared to your 6-month average.`;
  } else if (avg6MonthExpense > 0 && totalExpense < avg6MonthExpense) {
    trendInsight = `Great job! Your spending is ${Math.round(((avg6MonthExpense - totalExpense) / avg6MonthExpense) * 100)}% lower than your 6-month average.`;
  }

  const fmtAmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-24 px-3">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between pt-2 pb-1">
        <div>
          <h1 className="text-2xl font-heading font-black text-brand-blue dark:text-white tracking-tight leading-none">Analytics</h1>
          <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-1">Financial Insights</p>
        </div>
        <div className="flex items-center gap-1.5 bg-white dark:bg-white/5 px-2 py-1.5 rounded-2xl shadow-sm border border-neutral-100 dark:border-white/5">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="w-7 h-7 flex items-center justify-center bg-neutral-50 dark:bg-white/5 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-500 rounded-xl transition-all active:scale-95">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-black text-brand-blue dark:text-white text-[11px] uppercase tracking-widest min-w-[80px] text-center">
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

      {/* ── 1. AT A GLANCE ── */}
      <div className="bg-gradient-to-br from-brand-blue to-indigo-900 rounded-[28px] p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <h2 className="text-white/80 font-bold text-[13px] tracking-tight mb-4">
            In {monthName}, you earned <span className="text-emerald-400 font-black">{fmtAmt(totalIncome)}</span> and spent <span className="text-rose-400 font-black">{fmtAmt(totalExpense)}</span>, leaving you with <span className="text-white font-black">{savings >= 0 ? '+' : '-'}{fmtAmt(savings)}</span>.
          </h2>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Savings Rate</span>
              <span className="text-lg font-heading font-black text-white">{savingsRate}%</span>
            </div>
            <div className="h-2.5 bg-black/20 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-400 transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, savingsRate))}%` }} />
              <div className="h-full bg-rose-400 transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, 100 - savingsRate))}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] font-bold text-emerald-400/80 uppercase tracking-wider">Saved</span>
              <span className="text-[8px] font-bold text-rose-400/80 uppercase tracking-wider">Spent</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white dark:bg-[#0C0C0F] p-3 rounded-2xl border border-neutral-100 dark:border-white/5 shadow-sm">
          <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Income</p>
          <p className="text-sm font-heading font-black text-brand-blue dark:text-white tracking-tighter">{fmtAmt(totalIncome)}</p>
          {incomeChangePct !== null && (
            <div className={`flex items-center gap-0.5 text-[8px] font-bold mt-0.5 ${incomeChangePct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {incomeChangePct >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {Math.abs(Math.round(incomeChangePct))}% vs last
            </div>
          )}
        </div>
        <div className="bg-white dark:bg-[#0C0C0F] p-3 rounded-2xl border border-neutral-100 dark:border-white/5 shadow-sm">
          <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest mb-1">Spent</p>
          <p className="text-sm font-heading font-black text-brand-blue dark:text-white tracking-tighter">{fmtAmt(totalExpense)}</p>
          {expenseChangePct !== null && (
            <div className={`flex items-center gap-0.5 text-[8px] font-bold mt-0.5 ${expenseChangePct <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {expenseChangePct <= 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
              {Math.abs(Math.round(expenseChangePct))}% vs last
            </div>
          )}
        </div>
        <div className={`p-3 rounded-2xl border shadow-sm ${savings >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/10'}`}>
          <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-1">Saved</p>
          <p className={`text-sm font-heading font-black tracking-tighter ${savings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{savings >= 0 ? '+' : '-'}{fmtAmt(savings)}</p>
          <div className={`text-[8px] font-bold mt-0.5 ${savings >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{savingsRate}% rate</div>
        </div>
      </div>

      {/* ── 2. CATEGORIES DONUT ── */}
      <div className="bg-white dark:bg-[#0C0C0F] rounded-[28px] border border-neutral-100 dark:border-white/5 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500"><PieIcon className="w-3.5 h-3.5" /></div>
          <h2 className="text-[11px] font-black text-neutral-800 dark:text-white uppercase tracking-widest">Spends by Category</h2>
        </div>
        {pieData.length > 0 ? (
          <div className="flex flex-col items-center">
            <div className="relative">
              <MiniDonut data={pieData} colors={COLORS} size={160} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[8px] font-black text-neutral-400 uppercase tracking-widest">Total</span>
                <span className="text-base font-heading font-black text-brand-blue dark:text-white tracking-tighter">{fmtAmt(totalExpense)}</span>
              </div>
            </div>
            <div className="w-full space-y-2 mt-4">
              {pieData.slice(0, 5).map((d, i) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300">{CATEGORY_ICONS[d.name] || '📦'} {d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-neutral-400">{totalExpense > 0 ? Math.round((d.value / totalExpense) * 100) : 0}%</span>
                    <span className="text-[11px] font-black text-brand-blue dark:text-white">{fmtAmt(d.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-40 py-10">
            <PieIcon className="w-8 h-8 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">No spending data</p>
          </div>
        )}
      </div>

      {/* ── 3. ACCOUNTS ── */}
      <div className="bg-white dark:bg-[#0C0C0F] rounded-[28px] border border-neutral-100 dark:border-white/5 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500"><Layers className="w-3.5 h-3.5" /></div>
          <h2 className="text-[11px] font-black text-neutral-800 dark:text-white uppercase tracking-widest">Spends by Account</h2>
        </div>
        {accData.length > 0 ? (
          <div className="space-y-3">
            {accData.map((d) => {
              const pct = totalExpense > 0 ? (d.value / totalExpense) * 100 : 0;
              return (
                <div key={d.name} className="bg-neutral-50 dark:bg-white/[0.02] p-3 rounded-2xl">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[11px] font-black text-neutral-800 dark:text-white truncate pr-2">{d.name}</span>
                    <span className="text-[12px] font-heading font-black text-brand-blue dark:text-emerald-400 tracking-tight shrink-0">{fmtAmt(d.value)}</span>
                  </div>
                  <div className="h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-40 py-10">
            <Layers className="w-8 h-8 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">No account data</p>
          </div>
        )}
      </div>

      {/* ── 4. TOP TAGS ── */}
      <div className="bg-white dark:bg-[#0C0C0F] rounded-[28px] border border-neutral-100 dark:border-white/5 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500"><Tag className="w-3.5 h-3.5" /></div>
          <h2 className="text-[11px] font-black text-neutral-800 dark:text-white uppercase tracking-widest">Top Tags</h2>
        </div>
        {tagData.length > 0 ? (
          <div className="space-y-2">
            {tagData.map((d) => (
              <div key={d.name} className="flex items-center justify-between w-full bg-neutral-50 dark:bg-white/[0.02] p-2.5 rounded-xl">
                <span className="text-[10px] font-black text-neutral-600 dark:text-neutral-300 uppercase tracking-widest">#{d.name}</span>
                <span className="text-[11px] font-black text-brand-blue dark:text-amber-400">{fmtAmt(d.value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-40 py-10">
            <Tag className="w-8 h-8 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">No tags used</p>
          </div>
        )}
      </div>

      {/* ── 5. TOP PAYEES ── */}
      <div className="bg-white dark:bg-[#0C0C0F] rounded-[28px] border border-neutral-100 dark:border-white/5 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500"><Store className="w-3.5 h-3.5" /></div>
          <h2 className="text-[11px] font-black text-neutral-800 dark:text-white uppercase tracking-widest">Top Payees</h2>
        </div>
        {partyData.length > 0 ? (
          <div className="space-y-2">
            {partyData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between w-full p-2 border-b border-neutral-50 dark:border-white/5 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-5 h-5 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-500 flex items-center justify-center text-[9px] font-black shrink-0">{i + 1}</div>
                  <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-200 truncate pr-2">{d.name}</span>
                </div>
                <span className="text-[11px] font-black text-brand-blue dark:text-rose-400 shrink-0">{fmtAmt(d.value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-40 py-10">
            <Store className="w-8 h-8 mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest">No payee data</p>
          </div>
        )}
      </div>

      {/* ── 6. TRENDS ── */}
      <div className="bg-white dark:bg-[#0C0C0F] rounded-[28px] border border-neutral-100 dark:border-white/5 shadow-sm p-4">
        <h2 className="text-[11px] font-black text-neutral-800 dark:text-white uppercase tracking-widest mb-1">6-Month Big Picture</h2>
        <p className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 mb-4">{trendInsight}</p>
        {barData.length > 0 && <MiniBarChart data={barData} />}
        <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-neutral-100 dark:border-white/5">
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" /><span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Income</span></div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#FB7185]" /><span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Expenses</span></div>
        </div>
      </div>

    </div>
  );
}

// ── Export with Error Boundary ────────────────────────────────────────────────
export default function Summary() {
  return (
    <SummaryErrorBoundary>
      <SummaryContent />
    </SummaryErrorBoundary>
  );
}
