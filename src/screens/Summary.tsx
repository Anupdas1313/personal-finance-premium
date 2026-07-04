import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useState, useMemo, Component, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, PieChart as PieIcon, Tag, Store, Layers, AlertTriangle } from 'lucide-react';
import { CATEGORY_ICONS } from '../constants';
import { useCurrency } from '../hooks/useCurrency';
import { cn } from '../logic/utils';

// Cleaner, modern color palette
const COLORS = ['#00A86B', '#34D399', '#6EE7B7', '#A7F3D0', '#10B981', '#059669', '#047857', '#064E3B'];

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
          <AlertTriangle className="w-10 h-10 text-rose-500 mb-3" />
          <h2 className="text-lg font-bold text-neutral-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-neutral-500 mb-4 max-w-xs">{this.state.error}</p>
          <button onClick={() => this.setState({ hasError: false, error: '' })}
            className="px-5 py-2.5 bg-brand-green text-white rounded-xl text-sm font-semibold shadow-sm">
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
  const innerR = r * 0.65;
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

    return <path key={i} d={pathD} fill={colors[i % colors.length]} stroke="#ffffff" strokeWidth="2" strokeLinejoin="round" />;
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
  const barW = 14;
  const gap = 4;
  const groupW = barW * 2 + gap;
  const chartH = 140;
  const chartW = data.length * (groupW + 16);

  return (
    <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
      <svg width={chartW} height={chartH + 30} viewBox={`0 0 ${chartW} ${chartH + 30}`} className="mx-auto block">
        {data.map((d, i) => {
          const x = i * (groupW + 16) + 8;
          const incH = (d.income / maxVal) * chartH;
          const expH = (d.expenses / maxVal) * chartH;
          return (
            <g key={i}>
              <rect x={x} y={chartH - incH} width={barW} height={incH} rx={4} fill="#00A86B" opacity={0.8} />
              <rect x={x + barW + gap} y={chartH - expH} width={barW} height={expH} rx={4} fill="#F43F5E" opacity={0.9} />
              <text x={x + groupW / 2} y={chartH + 20} textAnchor="middle" fontSize={11} fontWeight={600} fill="#737373">{d.month}</text>
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
          const pName = tx.party.trim();
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

  const fmtAmt = (n: number) => `{currency}${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const currencySymbol = useCurrency();

  const formatWithCurrency = (n: number) => `${currencySymbol}${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-24 px-4 bg-neutral-50 min-h-screen pt-4">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight leading-none">Analytics</h1>
          <p className="text-[14px] font-medium text-neutral-500 mt-1">Financial Insights</p>
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-2xl shadow-sm border border-neutral-200">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="w-8 h-8 flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 text-neutral-600 rounded-xl transition-all active:scale-95">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-neutral-800 text-[14px] min-w-[70px] text-center">
            {format(currentMonth, 'MMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(m => { const next = new Date(m.getFullYear(), m.getMonth() + 1, 1); return next > new Date() ? m : next; })}
            disabled={isCurrentMonth}
            className="w-8 h-8 flex items-center justify-center bg-neutral-50 hover:bg-neutral-100 text-neutral-600 rounded-xl transition-all active:scale-95 disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── 1. AT A GLANCE ── */}
      <div className="bg-brand-green rounded-3xl p-6 shadow-md relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <h2 className="text-white/90 font-medium text-[15px] leading-relaxed mb-6">
            In {monthName}, you earned <span className="font-bold text-white">{formatWithCurrency(totalIncome)}</span> and spent <span className="font-bold text-white">{formatWithCurrency(totalExpense)}</span>, leaving you with <span className="font-bold text-white">{savings >= 0 ? '+' : '-'}{formatWithCurrency(savings)}</span>.
          </h2>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-end">
              <span className="text-[13px] font-semibold text-white/80">Savings Rate</span>
              <span className="text-2xl font-extrabold text-white">{savingsRate}%</span>
            </div>
            <div className="h-3 bg-black/20 rounded-full overflow-hidden flex">
              <div className="h-full bg-white transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, savingsRate))}%` }} />
              <div className="h-full bg-white/30 transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, 100 - savingsRate))}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm flex flex-col justify-center">
          <p className="text-[13px] font-semibold text-neutral-500 mb-1">Income</p>
          <p className="text-[18px] font-bold text-neutral-900 tracking-tight">{formatWithCurrency(totalIncome)}</p>
          {incomeChangePct !== null && (
            <div className={`flex items-center gap-1 text-[12px] font-semibold mt-1 ${incomeChangePct >= 0 ? 'text-brand-green' : 'text-rose-500'}`}>
              {incomeChangePct >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {Math.abs(Math.round(incomeChangePct))}%
            </div>
          )}
        </div>
        <div className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-sm flex flex-col justify-center">
          <p className="text-[13px] font-semibold text-neutral-500 mb-1">Spent</p>
          <p className="text-[18px] font-bold text-neutral-900 tracking-tight">{formatWithCurrency(totalExpense)}</p>
          {expenseChangePct !== null && (
            <div className={`flex items-center gap-1 text-[12px] font-semibold mt-1 ${expenseChangePct <= 0 ? 'text-brand-green' : 'text-rose-500'}`}>
              {expenseChangePct <= 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
              {Math.abs(Math.round(expenseChangePct))}%
            </div>
          )}
        </div>
        <div className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-center ${savings >= 0 ? 'bg-brand-green/5 border-brand-green/10' : 'bg-rose-50 border-rose-100'}`}>
          <p className="text-[13px] font-semibold text-neutral-500 mb-1">Saved</p>
          <p className={`text-[18px] font-bold tracking-tight ${savings >= 0 ? 'text-brand-green' : 'text-rose-600'}`}>{savings >= 0 ? '+' : '-'}{formatWithCurrency(savings)}</p>
          <div className={`text-[12px] font-semibold mt-1 ${savings >= 0 ? 'text-brand-green' : 'text-rose-500'}`}>{savingsRate}% rate</div>
        </div>
      </div>

      {/* ── 2. CATEGORIES DONUT ── */}
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green"><PieIcon className="w-5 h-5" /></div>
          <h2 className="text-[16px] font-bold text-neutral-900">Spending by Category</h2>
        </div>
        {pieData.length > 0 ? (
          <div className="flex flex-col items-center">
            <div className="relative mb-6">
              <MiniDonut data={pieData} colors={COLORS} size={180} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[12px] font-medium text-neutral-400">Total</span>
                <span className="text-[18px] font-bold text-neutral-900 tracking-tight">{formatWithCurrency(totalExpense)}</span>
              </div>
            </div>
            <div className="w-full space-y-3">
              {pieData.slice(0, 5).map((d, i) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-[14px] font-semibold text-neutral-700">{CATEGORY_ICONS[d.name] || '📦'} {d.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-medium text-neutral-400">{totalExpense > 0 ? Math.round((d.value / totalExpense) * 100) : 0}%</span>
                    <span className="text-[14px] font-bold text-neutral-900">{formatWithCurrency(d.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-50 py-12">
            <PieIcon className="w-10 h-10 mb-3 text-neutral-400" />
            <p className="text-[14px] font-medium text-neutral-500">No spending data</p>
          </div>
        )}
      </div>

      {/* ── 3. ACCOUNTS ── */}
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center text-brand-green"><Layers className="w-5 h-5" /></div>
          <h2 className="text-[16px] font-bold text-neutral-900">Spending by Account</h2>
        </div>
        {accData.length > 0 ? (
          <div className="space-y-4">
            {accData.map((d) => {
              const pct = totalExpense > 0 ? (d.value / totalExpense) * 100 : 0;
              return (
                <div key={d.name} className="bg-neutral-50 p-4 rounded-2xl">
                  <div className="flex justify-between items-end mb-3">
                    <span className="text-[14px] font-semibold text-neutral-800 truncate pr-2">{d.name}</span>
                    <span className="text-[14px] font-bold text-neutral-900 tracking-tight shrink-0">{formatWithCurrency(d.value)}</span>
                  </div>
                  <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-green rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-50 py-12">
            <Layers className="w-10 h-10 mb-3 text-neutral-400" />
            <p className="text-[14px] font-medium text-neutral-500">No account data</p>
          </div>
        )}
      </div>

      {/* ── 4. TOP TAGS ── */}
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500"><Tag className="w-5 h-5" /></div>
          <h2 className="text-[16px] font-bold text-neutral-900">Top Tags</h2>
        </div>
        {tagData.length > 0 ? (
          <div className="space-y-3">
            {tagData.map((d) => (
              <div key={d.name} className="flex items-center justify-between w-full bg-neutral-50 p-3.5 rounded-2xl">
                <span className="text-[13px] font-semibold text-neutral-600 bg-white px-2 py-1 rounded-lg border border-neutral-200 shadow-sm">#{d.name}</span>
                <span className="text-[14px] font-bold text-neutral-900">{formatWithCurrency(d.value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-50 py-12">
            <Tag className="w-10 h-10 mb-3 text-neutral-400" />
            <p className="text-[14px] font-medium text-neutral-500">No tags used</p>
          </div>
        )}
      </div>

      {/* ── 5. TOP PAYEES ── */}
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500"><Store className="w-5 h-5" /></div>
          <h2 className="text-[16px] font-bold text-neutral-900">Top Payees</h2>
        </div>
        {partyData.length > 0 ? (
          <div className="space-y-3">
            {partyData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between w-full p-3 bg-neutral-50 rounded-2xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-white text-rose-500 border border-neutral-200 flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm">{i + 1}</div>
                  <span className="text-[14px] font-semibold text-neutral-700 truncate pr-2">{d.name}</span>
                </div>
                <span className="text-[14px] font-bold text-neutral-900 shrink-0">{formatWithCurrency(d.value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center opacity-50 py-12">
            <Store className="w-10 h-10 mb-3 text-neutral-400" />
            <p className="text-[14px] font-medium text-neutral-500">No payee data</p>
          </div>
        )}
      </div>

      {/* ── 6. TRENDS ── */}
      <div className="bg-white rounded-3xl border border-neutral-100 shadow-sm p-6">
        <h2 className="text-[16px] font-bold text-neutral-900 mb-2">6-Month Big Picture</h2>
        <p className="text-[14px] font-medium text-neutral-500 mb-6 leading-relaxed">{trendInsight}</p>
        {barData.length > 0 && <MiniBarChart data={barData} />}
        <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-neutral-100">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#00A86B]" /><span className="text-[13px] font-semibold text-neutral-600">Income</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-[#F43F5E]" /><span className="text-[13px] font-semibold text-neutral-600">Expenses</span></div>
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
