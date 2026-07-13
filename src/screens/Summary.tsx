import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useState, useMemo, Component, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, PieChart as PieIcon, Tag, Store, Layers, AlertTriangle, CreditCard, BarChart2 } from 'lucide-react';
import { CATEGORY_ICONS } from '../constants';
import { useCurrency } from '../hooks/useCurrency';
import { cn } from '../logic/utils';

// ── Color palette matching the app's brand-green primary ─────────────────────
const CAT_COLORS = [
  '#00A86B', '#1A237E', '#D4AF37', '#E53935', '#82EEFD',
  '#6366F1', '#F59E0B', '#EC4899', '#14B8A6', '#84CC16',
];

const TAG_COLORS = [
  '#1A237E', '#00A86B', '#D4AF37', '#E53935', '#6366F1',
];

const PAY_COLORS: Record<string, string> = {
  UPI: '#6366F1',
  Bank: '#00A86B',
  'Credit Card': '#E53935',
  Cash: '#D4AF37',
  'Bank Transfer': '#1A237E',
};

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
          <AlertTriangle className="w-10 h-10 text-brand-red mb-3" />
          <h2 className="text-sm font-bold text-brand-blue dark:text-[#F7F7F7] mb-2">Something went wrong</h2>
          <p className="text-[10px] text-neutral-400 mb-4 max-w-xs">{this.state.error}</p>
          <button onClick={() => this.setState({ hasError: false, error: '' })}
            className="px-5 py-2.5 bg-brand-green text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-md shadow-brand-green/10">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getTxTimestamp(dateTime: any): number {
  try {
    if (!dateTime) return 0;
    if (typeof dateTime === 'number') return dateTime;
    if (dateTime instanceof Date) { const t = dateTime.getTime(); return isNaN(t) ? 0 : t; }
    if (typeof dateTime === 'string') { const d = new Date(dateTime.trim().replace(' ', 'T')); const t = d.getTime(); return isNaN(t) ? 0 : t; }
    return 0;
  } catch { return 0; }
}

function safeNum(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

// ── Mini Donut (pure SVG) ─────────────────────────────────────────────────────
function MiniDonut({ data, colors, size = 140 }: { data: { name: string; value: number }[]; colors: string[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = size / 2;
  const innerR = r * 0.62;
  const cx = r; const cy = r;
  let cumAngle = -90;

  const arcs = data.map((d, i) => {
    const angle = (d.value / total) * 360;
    const startAngle = cumAngle;
    cumAngle += angle;
    const endAngle = cumAngle;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const largeArc = angle > 180 ? 1 : 0;
    const x1 = cx + r * Math.cos(startRad); const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad); const y2 = cy + r * Math.sin(endRad);
    const ix1 = cx + innerR * Math.cos(endRad); const iy1 = cy + innerR * Math.sin(endRad);
    const ix2 = cx + innerR * Math.cos(startRad); const iy2 = cy + innerR * Math.sin(startRad);
    const pathD = [`M ${x1} ${y1}`, `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`, `L ${ix1} ${iy1}`, `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`, 'Z'].join(' ');
    return <path key={i} d={pathD} fill={colors[i % colors.length]} stroke="transparent" strokeWidth="1.5" />;
  });

  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{arcs}</svg>;
}

// ── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ icon, msg }: { icon: ReactNode; msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 opacity-40">
      <div className="w-12 h-12 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{msg}</p>
    </div>
  );
}

// ── Section Card wrapper ──────────────────────────────────────────────────────
function SectionCard({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white dark:bg-[#111111] p-5 rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm">
      {children}
    </div>
  );
}

// ── Section title ─────────────────────────────────────────────────────────────
function SectionTitle({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="p-2 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
        <span className="text-brand-blue dark:text-[#F7F7F7]">{icon}</span>
      </div>
      <div>
        <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">{label}</p>
      </div>
    </div>
  );
}

// ── Progress row ─────────────────────────────────────────────────────────────
function ProgressRow({ label, amount, pct, color, icon, rank, fmt }:
  { label: string; amount: number; pct: number; color: string; icon?: string; rank?: number; fmt: (n: number) => string }) {
  return (
    <div className="p-3.5 rounded-2xl border border-neutral-100 dark:border-[#222222] bg-neutral-50 dark:bg-[#1A1A1A]/50">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {rank !== undefined && (
            <span className="w-5 h-5 rounded-full bg-brand-blue/5 dark:bg-white/10 text-neutral-400 text-[10px] font-bold flex items-center justify-center shrink-0">{rank}</span>
          )}
          {icon && <span className="text-[13px] shrink-0">{icon}</span>}
          <span className="text-xs font-bold text-brand-blue dark:text-[#F7F7F7] truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0 ml-3">
          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{Math.round(pct)}%</span>
          <span className="text-xs font-bold text-brand-blue dark:text-[#F7F7F7]">{fmt(amount)}</span>
        </div>
      </div>
      <div className="w-full bg-neutral-100 dark:bg-[#222222] rounded-full h-1.5 overflow-hidden">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
        />
      </div>
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
    try { return transactions.filter(tx => { const t = getTxTimestamp(tx.dateTime); return t >= monthStartTs && t <= monthEndTs; }); }
    catch { return []; }
  }, [transactions, monthStartTs, monthEndTs]);

  const prevMonthTxs = useMemo(() => {
    try { return transactions.filter(tx => { const t = getTxTimestamp(tx.dateTime); return t >= prevMonthStartTs && t <= prevMonthEndTs; }); }
    catch { return []; }
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
  const savingsRateRaw = totalIncome > 0 ? Math.round((savings / totalIncome) * 100) : 0;
  const savingsRate = isNaN(savingsRateRaw) ? 0 : savingsRateRaw;

  const expenseChangePct = prevTotalExpense > 0 ? ((totalExpense - prevTotalExpense) / prevTotalExpense) * 100 : null;
  const incomeChangePct = prevTotalIncome > 0 ? ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100 : null;

  // ── Aggregations ──────────────────────────────────────────────────────────
  const { pieData, tagData, accData, partyData, payMethodData } = useMemo(() => {
    try {
      const byCategory: Record<string, number> = {};
      const byTag: Record<string, number> = {};
      const byAccount: Record<string, number> = {};
      const byParty: Record<string, number> = {};
      const byPayMethod: Record<string, number> = {};

      for (const tx of expenses) {
        const amt = safeNum(tx.amount);
        if (tx.category) byCategory[tx.category] = (byCategory[tx.category] || 0) + amt;
        if (tx.expenseType) byTag[tx.expenseType] = (byTag[tx.expenseType] || 0) + amt;
        const accName = accounts.find(a => a.id === tx.accountId)?.bankName || 'Unknown';
        byAccount[accName] = (byAccount[accName] || 0) + amt;
        if (tx.party && typeof tx.party === 'string') { const p = tx.party.trim(); if (p) byParty[p] = (byParty[p] || 0) + amt; }
        if (tx.paymentMethod) byPayMethod[tx.paymentMethod] = (byPayMethod[tx.paymentMethod] || 0) + amt;
      }

      const toSorted = (obj: Record<string, number>) =>
        Object.entries(obj).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

      return {
        pieData: toSorted(byCategory),
        tagData: toSorted(byTag).slice(0, 6),
        accData: toSorted(byAccount),
        partyData: toSorted(byParty).slice(0, 6),
        payMethodData: toSorted(byPayMethod),
      };
    } catch {
      return { pieData: [], tagData: [], accData: [], partyData: [], payMethodData: [] };
    }
  }, [expenses, accounts]);

  const isCurrentMonth = format(currentMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
  const monthName = format(currentMonth, 'MMMM');

  const currencySymbol = useCurrency();
  const fmt = (n: number) => `${currencySymbol}${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-green/5 dark:bg-[#111612] text-brand-green dark:text-brand-cyan rounded-2xl border border-brand-green/10 dark:border-brand-green/5">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-3xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">Analytics</h1>
            <p className="text-neutral-400 font-bold mt-0.5 uppercase tracking-widest text-[8px]">Monthly Insights & Visual Breakdown</p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-white dark:bg-[#111111] px-4 py-2 rounded-[20px] shadow-sm border border-neutral-100 dark:border-[#222222] w-full sm:w-auto justify-between sm:justify-start">
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-[#F7F7F7] font-bold px-1 transition-colors"
          >&lt;</button>
          <span className="font-bold text-brand-blue dark:text-[#F7F7F7] min-w-[120px] text-center uppercase tracking-widest text-[9px]">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(m => { const next = new Date(m.getFullYear(), m.getMonth() + 1, 1); return next > new Date() ? m : next; })}
            disabled={isCurrentMonth}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-[#F7F7F7] font-bold px-1 transition-colors disabled:opacity-30"
          >&gt;</button>
        </div>
      </div>

      {/* ── HERO BANNER ── */}
      <div className="bg-brand-green rounded-[24px] p-5 shadow-sm relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest mb-2">{monthName} Overview</p>
          <h2 className="text-white font-heading font-bold text-[20px] leading-snug tracking-tight">
            Earned <span className="font-extrabold">{fmt(totalIncome)}</span>
            <span className="text-white/50 font-normal"> · </span>
            Spent <span className="font-extrabold">{fmt(totalExpense)}</span>
          </h2>
          <p className="text-white/80 font-semibold text-[12px] mt-1">
            {savings >= 0 ? `Saved ${fmt(savings)}` : `Deficit ${fmt(Math.abs(savings))}`}
            {savingsRate !== 0 && <span className="ml-1 text-white/60">· {savingsRate}% rate</span>}
          </p>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Income', value: totalIncome, pct: incomeChangePct, good: (p: number) => p >= 0 },
          { label: 'Spent', value: totalExpense, pct: expenseChangePct, good: (p: number) => p <= 0 },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-[#111111] p-4 rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm">
            <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1">{kpi.label}</p>
            <p className="text-[20px] font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">{fmt(kpi.value)}</p>
            {kpi.pct !== null && (
              <div className={cn('flex items-center gap-1 text-[10px] font-semibold mt-1', kpi.good(kpi.pct) ? 'text-brand-green' : 'text-brand-red')}>
                {kpi.good(kpi.pct) ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(Math.round(kpi.pct))}% vs last month
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── 1. SPENDING BY CATEGORY ── */}
      <SectionCard>
        <SectionTitle icon={<PieIcon className="w-4 h-4" />} label="Spending by Category" />
        {pieData.length > 0 ? (
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Donut */}
            <div className="relative shrink-0">
              <MiniDonut data={pieData} colors={CAT_COLORS} size={140} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Total</span>
                <span className="text-[15px] font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">{fmt(totalExpense)}</span>
              </div>
            </div>
            {/* Rows */}
            <div className="flex-1 w-full space-y-2.5">
              {pieData.map((d, i) => (
                <ProgressRow
                  key={d.name}
                  label={d.name}
                  amount={d.value}
                  pct={totalExpense > 0 ? (d.value / totalExpense) * 100 : 0}
                  color={CAT_COLORS[i % CAT_COLORS.length]}
                  icon={CATEGORY_ICONS[d.name] || '📦'}
                  fmt={fmt}
                />
              ))}
            </div>
          </div>
        ) : <EmptyState icon={<PieIcon className="w-6 h-6 text-neutral-400" />} msg="No spending data this month" />}
      </SectionCard>

      {/* ── 2. SPENDING BY TAG ── */}
      <SectionCard>
        <SectionTitle icon={<Tag className="w-4 h-4" />} label="Spending by Tag" />
        {tagData.length > 0 ? (
          <div className="space-y-2.5">
            {tagData.map((d, i) => (
              <div key={d.name} className="p-3.5 rounded-2xl border border-neutral-100 dark:border-[#222222] bg-neutral-50 dark:bg-[#1A1A1A]/50">
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                    style={{ backgroundColor: `${TAG_COLORS[i % TAG_COLORS.length]}15`, color: TAG_COLORS[i % TAG_COLORS.length] }}
                  >
                    #{d.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">
                      {totalExpense > 0 ? Math.round((d.value / totalExpense) * 100) : 0}%
                    </span>
                    <span className="text-xs font-bold text-brand-blue dark:text-[#F7F7F7]">{fmt(d.value)}</span>
                  </div>
                </div>
                <div className="w-full bg-neutral-100 dark:bg-[#222222] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${totalExpense > 0 ? Math.min((d.value / totalExpense) * 100, 100) : 0}%`, backgroundColor: TAG_COLORS[i % TAG_COLORS.length] }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={<Tag className="w-6 h-6 text-neutral-400" />} msg="No tags used this month" />}
      </SectionCard>

      {/* ── 3. SPENDING BY ACCOUNT ── */}
      <SectionCard>
        <SectionTitle icon={<Layers className="w-4 h-4" />} label="Spending by Account" />
        {accData.length > 0 ? (
          <div className="space-y-2.5">
            {accData.map((d, i) => (
              <ProgressRow
                key={d.name}
                label={d.name}
                amount={d.value}
                pct={totalExpense > 0 ? (d.value / totalExpense) * 100 : 0}
                color={CAT_COLORS[(i + 1) % CAT_COLORS.length]}
                fmt={fmt}
              />
            ))}
          </div>
        ) : <EmptyState icon={<Layers className="w-6 h-6 text-neutral-400" />} msg="No account data this month" />}
      </SectionCard>

      {/* ── 4. PAYMENT METHOD ── */}
      {payMethodData.length > 0 && (
        <SectionCard>
          <SectionTitle icon={<CreditCard className="w-4 h-4" />} label="Payment Methods" />
          <div className="space-y-2.5">
            {payMethodData.map((d) => (
              <ProgressRow
                key={d.name}
                label={d.name}
                amount={d.value}
                pct={totalExpense > 0 ? (d.value / totalExpense) * 100 : 0}
                color={PAY_COLORS[d.name] || '#1A237E'}
                fmt={fmt}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── 5. TOP PAYEES ── */}
      <SectionCard>
        <SectionTitle icon={<Store className="w-4 h-4" />} label="Top Payees" />
        {partyData.length > 0 ? (
          <div className="space-y-2.5">
            {partyData.map((d, i) => (
              <ProgressRow
                key={d.name}
                label={d.name}
                amount={d.value}
                pct={totalExpense > 0 ? (d.value / totalExpense) * 100 : 0}
                color="#E53935"
                rank={i + 1}
                fmt={fmt}
              />
            ))}
          </div>
        ) : <EmptyState icon={<Store className="w-6 h-6 text-neutral-400" />} msg="No payee data this month" />}
      </SectionCard>

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
