import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { format, startOfMonth, endOfMonth, subMonths, differenceInDays, getDaysInMonth } from 'date-fns';
import { useState, useMemo, useRef, useCallback, Component, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, PieChart as PieIcon, Tag, Store, Layers, AlertTriangle, CreditCard, Wallet, ArrowUpRight, ArrowDownRight, Minus, RefreshCw, Zap } from 'lucide-react';
import { CATEGORY_ICONS } from '../constants';
import { useCurrency } from '../hooks/useCurrency';
import { cn } from '../logic/utils';

// ── Color palette ─────────────────────────────────────────────────────────────
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
function MiniDonut({ data, colors, size = 120 }: { data: { name: string; value: number }[]; colors: string[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = size / 2;
  const innerR = r * 0.65;
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

// ── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  { key: 'category', label: 'Category', icon: <PieIcon className="w-3.5 h-3.5" /> },
  { key: 'tags', label: 'Tags', icon: <Tag className="w-3.5 h-3.5" /> },
  { key: 'accounts', label: 'Accounts', icon: <Layers className="w-3.5 h-3.5" /> },
  { key: 'methods', label: 'Methods', icon: <CreditCard className="w-3.5 h-3.5" /> },
  { key: 'payees', label: 'Payees', icon: <Store className="w-3.5 h-3.5" /> },
] as const;

type TabKey = typeof TABS[number]['key'];

// ── Main Summary Component ────────────────────────────────────────────────────
function SummaryContent() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<TabKey>('category');
  const navigate = useNavigate();

  // ── Pull-to-refresh state ──────────────────────────────────────────────
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePullStart = useCallback((e: React.TouchEvent) => {
    const scrollTop = containerRef.current?.closest('main')?.scrollTop || 0;
    if (scrollTop <= 0) {
      pullStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handlePullMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current) return;
    const diff = e.touches[0].clientY - pullStartY.current;
    if (diff > 0) {
      setPullDistance(Math.min(diff * 0.4, 80));
    }
  }, []);

  const handlePullEnd = useCallback(() => {
    if (pullDistance > 50) {
      setIsRefreshing(true);
      setPullDistance(50);
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 1200);
    } else {
      setPullDistance(0);
    }
    isPulling.current = false;
  }, [pullDistance]);

  // ── Swipe-between-months gesture ───────────────────────────────────────
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const isSwiping = useRef(false);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    isSwiping.current = true;
  }, []);

  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - swipeStartX.current;
    const diffY = Math.abs(endY - swipeStartY.current);
    // Only trigger if horizontal swipe is dominant and significant
    if (Math.abs(diffX) > 60 && diffY < Math.abs(diffX) * 0.7) {
      if (diffX > 0) {
        // Swiped right → previous month
        setCurrentMonth(m => subMonths(m, 1));
      } else {
        // Swiped left → next month
        setCurrentMonth(m => {
          const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
          return next > new Date() ? m : next;
        });
      }
    }
  }, []);

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

  // ── Average daily spend ────────────────────────────────────────────────
  const avgDailySpend = useMemo(() => {
    const now = new Date();
    const isThisMonth = format(currentMonth, 'yyyy-MM') === format(now, 'yyyy-MM');
    const daysElapsed = isThisMonth
      ? Math.max(differenceInDays(now, monthStart) + 1, 1)
      : getDaysInMonth(currentMonth);
    return totalExpense / daysElapsed;
  }, [totalExpense, currentMonth, monthStart]);

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
        partyData: toSorted(byParty).slice(0, 8),
        payMethodData: toSorted(byPayMethod),
      };
    } catch {
      return { pieData: [], tagData: [], accData: [], partyData: [], payMethodData: [] };
    }
  }, [expenses, accounts]);

  const isCurrentMonth = format(currentMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  const currencySymbol = useCurrency();
  const fmt = (n: number) => `${currencySymbol}${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const TrendBadge = ({ pct, good }: { pct: number | null; good: (p: number) => boolean }) => {
    if (pct === null) return null;
    const isGood = good(pct);
    return (
      <span className={cn('inline-flex items-center gap-0.5 text-[9px] font-bold', isGood ? 'text-emerald-500' : 'text-rose-500')}>
        {isGood ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
        {Math.abs(Math.round(pct))}%
      </span>
    );
  };

  // ── Render Active Tab Content ─────────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case 'category':
        return pieData.length > 0 ? (
          <div className="space-y-4">
            {/* Donut centered above list */}
            <div className="flex justify-center">
              <div className="relative">
                <MiniDonut data={pieData} colors={CAT_COLORS} size={120} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Spent</span>
                  <span className="text-sm font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">{fmt(totalExpense)}</span>
                </div>
              </div>
            </div>
            {/* Category rows */}
            <div className="space-y-2">
              {pieData.map((d, i) => {
                const pct = totalExpense > 0 ? (d.value / totalExpense) * 100 : 0;
                const color = CAT_COLORS[i % CAT_COLORS.length];
                return (
                  <div
                    key={d.name}
                    onClick={() => navigate(`/transactions?category=${encodeURIComponent(d.name)}&month=${format(currentMonth, 'yyyy-MM')}`)}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/[0.04] transition-colors"
                  >
                    {/* Color accent + icon */}
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-base shrink-0">{CATEGORY_ICONS[d.name] || '📦'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-brand-blue dark:text-white truncate">{d.name}</p>
                      <div className="w-full bg-neutral-100 dark:bg-white/5 rounded-full h-1 mt-1 overflow-hidden">
                        <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-brand-blue dark:text-white">{fmt(d.value)}</p>
                      <p className="text-[9px] font-bold text-neutral-400">{Math.round(pct)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : <EmptyState icon={<PieIcon className="w-6 h-6 text-neutral-400" />} msg="No spending data this month" />;

      case 'tags':
        return tagData.length > 0 ? (
          <div className="space-y-2">
            {tagData.map((d, i) => {
              const pct = totalExpense > 0 ? (d.value / totalExpense) * 100 : 0;
              const color = TAG_COLORS[i % TAG_COLORS.length];
              return (
                <div
                  key={d.name}
                  onClick={() => navigate(`/transactions?tag=${encodeURIComponent(d.name)}&month=${format(currentMonth, 'yyyy-MM')}`)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    #{d.name}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="w-full bg-neutral-100 dark:bg-white/5 rounded-full h-1 overflow-hidden">
                      <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-brand-blue dark:text-white">{fmt(d.value)}</p>
                    <p className="text-[9px] font-bold text-neutral-400">{Math.round(pct)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyState icon={<Tag className="w-6 h-6 text-neutral-400" />} msg="No tags used this month" />;

      case 'accounts':
        return accData.length > 0 ? (
          <div className="space-y-2">
            {accData.map((d, i) => {
              const pct = totalExpense > 0 ? (d.value / totalExpense) * 100 : 0;
              const color = CAT_COLORS[(i + 1) % CAT_COLORS.length];
              return (
                <div
                  key={d.name}
                  onClick={() => {
                    const acc = accounts.find(a => a.bankName === d.name);
                    if (acc) navigate(`/transactions?account=${acc.id}&month=${format(currentMonth, 'yyyy-MM')}`);
                  }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div className="p-1.5 bg-white dark:bg-[#1A1A1A] rounded-lg border border-neutral-100 dark:border-white/5 shrink-0">
                    <Wallet className="w-3.5 h-3.5 text-neutral-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-brand-blue dark:text-white truncate">{d.name}</p>
                    <div className="w-full bg-neutral-100 dark:bg-white/5 rounded-full h-1 mt-1 overflow-hidden">
                      <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-brand-blue dark:text-white">{fmt(d.value)}</p>
                    <p className="text-[9px] font-bold text-neutral-400">{Math.round(pct)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyState icon={<Layers className="w-6 h-6 text-neutral-400" />} msg="No account data this month" />;

      case 'methods':
        return payMethodData.length > 0 ? (
          <div className="space-y-2">
            {payMethodData.map((d) => {
              const pct = totalExpense > 0 ? (d.value / totalExpense) * 100 : 0;
              const color = PAY_COLORS[d.name] || '#1A237E';
              return (
                <div
                  key={d.name}
                  onClick={() => navigate(`/transactions?method=${encodeURIComponent(d.name)}&month=${format(currentMonth, 'yyyy-MM')}`)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/[0.04] transition-colors"
                >
                  <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div className="p-1.5 rounded-lg shrink-0" style={{ backgroundColor: `${color}15` }}>
                    <CreditCard className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-brand-blue dark:text-white truncate">{d.name}</p>
                    <div className="w-full bg-neutral-100 dark:bg-white/5 rounded-full h-1 mt-1 overflow-hidden">
                      <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-brand-blue dark:text-white">{fmt(d.value)}</p>
                    <p className="text-[9px] font-bold text-neutral-400">{Math.round(pct)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyState icon={<CreditCard className="w-6 h-6 text-neutral-400" />} msg="No payment data this month" />;

      case 'payees':
        return partyData.length > 0 ? (
          <div className="space-y-2">
            {partyData.map((d, i) => {
              const pct = totalExpense > 0 ? (d.value / totalExpense) * 100 : 0;
              const initials = d.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
              const avatarColors = ['#00A86B', '#1A237E', '#E53935', '#6366F1', '#F59E0B', '#EC4899', '#14B8A6', '#D4AF37'];
              const avatarColor = avatarColors[i % avatarColors.length];
              return (
                <div
                  key={d.name}
                  onClick={() => navigate(`/transactions?search=${encodeURIComponent(d.name)}&month=${format(currentMonth, 'yyyy-MM')}`)}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 cursor-pointer hover:bg-neutral-100 dark:hover:bg-white/[0.04] transition-colors"
                >
                  {/* Rank */}
                  <span className="w-5 h-5 rounded-full bg-neutral-100 dark:bg-white/10 text-neutral-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  {/* Avatar initials */}
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black text-white shrink-0"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-brand-blue dark:text-white truncate">{d.name}</p>
                    <div className="w-full bg-neutral-100 dark:bg-white/5 rounded-full h-1 mt-1 overflow-hidden">
                      <div className="h-1 rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: avatarColor }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-brand-blue dark:text-white">{fmt(d.value)}</p>
                    <p className="text-[9px] font-bold text-neutral-400">{Math.round(pct)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyState icon={<Store className="w-6 h-6 text-neutral-400" />} msg="No payee data this month" />;
    }
  };

  return (
    <div
      ref={containerRef}
      className="space-y-4 max-w-2xl mx-auto pb-16"
      onTouchStart={(e) => { handlePullStart(e); handleSwipeStart(e); }}
      onTouchMove={handlePullMove}
      onTouchEnd={(e) => { handlePullEnd(); handleSwipeEnd(e); }}
    >

      {/* ── PULL-TO-REFRESH INDICATOR ── */}
      <div
        className="flex justify-center overflow-hidden transition-all duration-300"
        style={{ height: pullDistance > 0 ? pullDistance : 0, opacity: pullDistance > 10 ? 1 : 0 }}
      >
        <div className="flex items-center gap-2 text-neutral-400">
          <RefreshCw className={cn('w-4 h-4 transition-transform duration-300', isRefreshing && 'animate-spin', pullDistance > 50 && !isRefreshing && 'rotate-180')} />
          <span className="text-[9px] font-bold uppercase tracking-widest">
            {isRefreshing ? 'Refreshing…' : pullDistance > 50 ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        </div>
      </div>

      {/* ── COMPACT HEADER + MONTH NAVIGATOR ── */}
      <div className="flex items-center justify-between gap-3 px-1">
        <h1 className="text-xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter leading-none">
          Analytics
        </h1>
        <div className="flex items-center gap-2 bg-white dark:bg-[#111111] px-3 py-1.5 rounded-full shadow-sm border border-neutral-100 dark:border-white/5">
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-brand-blue dark:text-[#F7F7F7] min-w-[90px] text-center text-[10px] uppercase tracking-widest">
            {format(currentMonth, 'MMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(m => { const next = new Date(m.getFullYear(), m.getMonth() + 1, 1); return next > new Date() ? m : next; })}
            disabled={isCurrentMonth}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── HERO STATS CARD ── */}
      <div className="bg-brand-green rounded-[24px] p-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {/* Income */}
          <div className="text-center">
            <p className="text-white/50 text-[8px] font-bold uppercase tracking-widest mb-1">Income</p>
            <p className="text-white font-heading font-black text-sm tracking-tight leading-none">{fmt(totalIncome)}</p>
            {incomeChangePct !== null && (
              <span className={cn('inline-flex items-center gap-0.5 text-[8px] font-bold mt-1', incomeChangePct >= 0 ? 'text-white/80' : 'text-rose-200')}>
                {incomeChangePct >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {Math.abs(Math.round(incomeChangePct))}%
              </span>
            )}
          </div>
          {/* Spent */}
          <div className="text-center border-x border-white/10">
            <p className="text-white/50 text-[8px] font-bold uppercase tracking-widest mb-1">Spent</p>
            <p className="text-white font-heading font-black text-sm tracking-tight leading-none">{fmt(totalExpense)}</p>
            {expenseChangePct !== null && (
              <span className={cn('inline-flex items-center gap-0.5 text-[8px] font-bold mt-1', expenseChangePct <= 0 ? 'text-white/80' : 'text-rose-200')}>
                {expenseChangePct <= 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
                {Math.abs(Math.round(expenseChangePct))}%
              </span>
            )}
          </div>
          {/* Saved */}
          <div className="text-center">
            <p className="text-white/50 text-[8px] font-bold uppercase tracking-widest mb-1">Saved</p>
            <p className={cn('font-heading font-black text-sm tracking-tight leading-none', savings >= 0 ? 'text-white' : 'text-rose-200')}>
              {savings >= 0 ? fmt(savings) : `-${fmt(Math.abs(savings))}`}
            </p>
            {savingsRate !== 0 && (
              <span className="text-[8px] font-bold text-white/60 mt-1 inline-block">
                {savingsRate}% rate
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── AVG DAILY SPEND PILL ── */}
      {totalExpense > 0 && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#111111] rounded-full shadow-sm border border-neutral-100 dark:border-white/5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400">Avg Daily Spend</span>
            <span className="text-xs font-heading font-black text-brand-blue dark:text-white tracking-tight">
              {fmt(Math.round(avgDailySpend))}
            </span>
            <span className="text-[9px] font-bold text-neutral-400">/day</span>
          </div>
        </div>
      )}

      {/* ── TAB BAR ── */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide no-scrollbar pb-1 -mx-1 px-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border shrink-0',
              activeTab === tab.key
                ? 'bg-brand-blue dark:bg-white text-white dark:text-brand-blue border-brand-blue dark:border-white shadow-sm'
                : 'bg-white dark:bg-[#111111] text-neutral-500 dark:text-neutral-400 border-neutral-100 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-white/[0.04]'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="bg-white dark:bg-[#111111] p-4 rounded-[24px] border border-neutral-100 dark:border-white/5 shadow-sm">
        {renderTabContent()}
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
