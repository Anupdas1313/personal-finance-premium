import { useState, useMemo } from 'react';
import { db, Budget } from '../models/db';
import { Plus, Pencil, Trash2, AlertTriangle, Target, Briefcase, Wallet, Star, Settings, Copy, Sparkles, ArrowRight } from 'lucide-react';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';
import { format, startOfMonth, addMonths, subMonths } from 'date-fns';
import { useCurrency } from '../hooks/useCurrency';
import { useBudgets, getNextBudgetMonth, getPrevBudgetMonth, BudgetCardData } from '../hooks/useBudgets';
import { cn } from '../logic/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// ── Native UI Components ──────────────────────────────────────────────────────
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white dark:bg-[#111111] p-5 rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm", className)}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, label, action }: { icon: React.ReactNode; label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
          <span className="text-brand-blue dark:text-[#F7F7F7]">{icon}</span>
        </div>
        <div>
          <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">{label}</p>
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Donut Chart Component ──────────────────────────────────────────────────────
function DonutChart({ spent, allocatedUnspent, unallocated, size = 120 }: { spent: number; allocatedUnspent: number; unallocated: number; size?: number }) {
  const total = spent + allocatedUnspent + Math.max(unallocated, 0);
  if (total === 0) return null;

  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const spentPct = (spent / total) * 100;
  const allocPct = (allocatedUnspent / total) * 100;
  const unallocPct = (Math.max(unallocated, 0) / total) * 100;

  const spentDash = (spentPct / 100) * circumference;
  const allocDash = (allocPct / 100) * circumference;
  const unallocDash = (unallocPct / 100) * circumference;

  const spentOffset = 0;
  const allocOffset = -(spentDash);
  const unallocOffset = -(spentDash + allocDash);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Unallocated — grey */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="currentColor"
          className="text-neutral-100 dark:text-[#222222]"
          strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${unallocDash} ${circumference - unallocDash}`}
          strokeDashoffset={unallocOffset}
          style={{ transition: 'stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease' }}
        />
        {/* Allocated but unspent — blue */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="currentColor"
          className="text-brand-blue/30 dark:text-brand-blue/40"
          strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${allocDash} ${circumference - allocDash}`}
          strokeDashoffset={allocOffset}
          style={{ transition: 'stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease' }}
        />
        {/* Spent — green */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="currentColor"
          className="text-brand-green"
          strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${spentDash} ${circumference - spentDash}`}
          strokeDashoffset={spentOffset}
          style={{ transition: 'stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Spent</span>
        <span className="text-sm font-black text-brand-blue dark:text-[#F7F7F7] tracking-tight">{Math.round(total > 0 ? (spent / total) * 100 : 0)}%</span>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Budgets() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const monthStr = format(currentMonth, 'yyyy-MM');
  const monthName = format(currentMonth, 'MMMM yyyy');

  // Swipeable Tab State
  const [activeTab, setActiveTab] = useState<'POOL' | 'CUSTOM'>('POOL');

  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [poolInput, setPoolInput] = useState('');

  // Standard Envelope Modal
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [editingEnvId, setEditingEnvId] = useState<number | null>(null);
  const [envCategory, setEnvCategory] = useState(CATEGORIES[0]);
  const [envAmount, setEnvAmount] = useState('');

  // Custom Budget Modal
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customName, setCustomName] = useState('');

  // Copy status
  const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'exists'>('idle');

  // ── Use the extracted hook ───────────────────────────────────────────────────
  const {
    masterPool, masterBudgetAmt,
    envelopeBudgets, customBudgets,
    linkedAccountIds, linkedTags,
    totalAllocated, unallocated, totalSpent,
    monthTxs, expenses,
    getCardData, budgetStartDay,
    periodStart, periodEnd, daysRemainingInPeriod,
  } = useBudgets(monthStr, currentMonth);

  const currencySymbol = useCurrency();
  const fmt = (n: number) => `${currencySymbol}${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSavePool = async () => {
    const amt = Number(poolInput);
    if (isNaN(amt) || amt < 0) return;
    
    if (masterPool && masterPool.id) {
      await db.monthlyBudgets.update(masterPool.id, { totalAmount: amt });
    } else {
      await db.monthlyBudgets.add({ month: monthStr, totalAmount: amt, linkedAccountIds: [], linkedTags: [] });
    }
    setIsPoolModalOpen(false);
  };

  const handleDeletePool = async () => {
    if (!masterPool || !masterPool.id) return;
    const confirmation = window.prompt(
      "To delete this monthly pool, type 'DELETE'.\n\nNote: This will reset your total monthly pool to 0, but your category envelopes will not be deleted."
    );
    if (confirmation?.trim().toUpperCase() === 'DELETE') {
      await db.monthlyBudgets.delete(masterPool.id);
      setIsPoolModalOpen(false);
    }
  };

  const handleSaveEnvelope = async () => {
    const amt = Number(envAmount);
    if (!envCategory || isNaN(amt) || amt <= 0) return;

    if (editingEnvId) {
      await db.budgets.update(editingEnvId, { category: envCategory, amount: amt, type: 'ENVELOPE' });
    } else {
      const existing = envelopeBudgets.find(b => b.category === envCategory);
      if (existing && existing.id) {
        await db.budgets.update(existing.id, { amount: amt });
      } else {
        await db.budgets.add({ month: monthStr, category: envCategory, amount: amt, type: 'ENVELOPE' });
      }
    }
    setIsEnvModalOpen(false);
  };

  const handleSaveCustom = async () => {
    const amt = Number(envAmount);
    const name = customName.trim();
    if (!name || isNaN(amt) || amt <= 0) return;

    if (editingEnvId) {
      await db.budgets.update(editingEnvId, { category: name, amount: amt, type: 'CUSTOM' });
    } else {
      await db.budgets.add({ month: monthStr, category: name, amount: amt, type: 'CUSTOM' });
    }
    setIsCustomModalOpen(false);
  };

  const handleDeleteBudget = async (id: number) => {
    if (window.confirm('Delete this budget?')) {
      await db.budgets.delete(id);
    }
  };

  const openNewEnvelope = () => {
    setEditingEnvId(null);
    const unbudgetedCats = CATEGORIES.filter(c => !envelopeBudgets.find(b => b.category === c));
    setEnvCategory(unbudgetedCats[0] || CATEGORIES[0]);
    setEnvAmount(unallocated > 0 ? unallocated.toString() : '');
    setIsEnvModalOpen(true);
  };

  const openNewCustom = () => {
    setEditingEnvId(null);
    setCustomName('');
    setEnvAmount('');
    setIsCustomModalOpen(true);
  };

  const openEditBudget = (b: Budget) => {
    setEditingEnvId(b.id || null);
    setEnvAmount(b.amount.toString());
    
    if (b.type === 'CUSTOM') {
      setCustomName(b.category);
      setIsCustomModalOpen(true);
    } else {
      setEnvCategory(b.category);
      setIsEnvModalOpen(true);
    }
  };

  // ── Copy to Next Month Handler ────────────────────────────────────────────
  const handleCopyToNextMonth = async () => {
    const nextMonth = addMonths(currentMonth, 1);
    const nextMonthStr = format(nextMonth, 'yyyy-MM');

    // Check if budgets already exist for next month
    const existingBudgets = await db.budgets.where('month').equals(nextMonthStr).toArray();
    const existingPool = await db.monthlyBudgets.where('month').equals(nextMonthStr).toArray();

    if (existingBudgets.length > 0 || existingPool.length > 0) {
      if (!window.confirm(`Budgets already exist for ${format(nextMonth, 'MMMM yyyy')}. Replace them?`)) {
        setCopyStatus('exists');
        setTimeout(() => setCopyStatus('idle'), 2000);
        return;
      }
      // Delete existing budgets for next month
      await Promise.all(existingBudgets.map(b => b.id && db.budgets.delete(b.id)));
      await Promise.all(existingPool.map(p => p.id && db.monthlyBudgets.delete(p.id)));
    }

    // Copy envelope + custom budgets
    const allBudgets = [...envelopeBudgets, ...customBudgets];
    for (const b of allBudgets) {
      await db.budgets.add({
        month: nextMonthStr,
        category: b.category,
        amount: b.amount,
        type: b.type,
      });
    }

    // Copy pool configuration
    if (masterPool) {
      await db.monthlyBudgets.add({
        month: nextMonthStr,
        totalAmount: masterPool.totalAmount,
        linkedAccountIds: masterPool.linkedAccountIds || [],
        linkedTags: masterPool.linkedTags || [],
      });
    }

    setCopyStatus('success');
    setTimeout(() => setCopyStatus('idle'), 2500);
  };

  // ── Swipe Handlers ────────────────────────────────────────────────────────
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && activeTab === 'POOL') setActiveTab('CUSTOM');
    if (isRightSwipe && activeTab === 'CUSTOM') setActiveTab('POOL');
    
    setTouchStart(0);
    setTouchEnd(0);
  };

  const variants = {
    enter: (direction: number) => ({ x: direction > 0 ? 100 : -100, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? 100 : -100, opacity: 0 })
  };

  const slideDirection = activeTab === 'POOL' ? -1 : 1;

  // ── Check for empty state ─────────────────────────────────────────────────
  const isEmpty = masterBudgetAmt === 0 && envelopeBudgets.length === 0 && customBudgets.length === 0;

  // ── Render Helpers ────────────────────────────────────────────────────────
  const renderBudgetCard = (b: Budget, isCustom: boolean) => {
    const card = getCardData(b, isCustom);
    const { spent, available, pct, isOver, isWarning, barColor, daysRemaining, perDay } = card;
    const allocated = Number(b.amount);

    return (
      <div key={b.id} className="p-4 rounded-2xl border border-neutral-100 dark:border-[#222222] bg-neutral-50 dark:bg-[#1A1A1E]/50 group relative">
        <div className="absolute top-3 right-3 flex gap-2">
          <button onClick={() => openEditBudget(b)} className="p-1.5 text-brand-blue/40 dark:text-white/40 hover:text-brand-blue dark:hover:text-white transition-colors bg-transparent rounded-lg">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => b.id && handleDeleteBudget(b.id)} className="p-1.5 text-brand-red/40 hover:text-brand-red transition-colors bg-transparent rounded-lg">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-[20px]">{isCustom ? '🎯' : (CATEGORY_ICONS[b.category] || '📦')}</span>
          <div>
            <h3 className="text-xs font-bold text-brand-blue dark:text-[#F7F7F7]">{b.category}</h3>
            <p className="text-[9px] uppercase tracking-wider text-neutral-400 font-bold mt-0.5">
              {isOver ? 'Over budget by ' + fmt(Math.abs(available)) : fmt(available) + ' available'}
            </p>
          </div>
        </div>

        <div className="flex justify-between items-end mb-2">
          <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">{Math.round(pct)}% spent</span>
          <div className="text-right flex items-center gap-1">
            <span className="text-xs font-bold text-brand-blue dark:text-[#F7F7F7]">{fmt(spent)}</span>
            <span className="text-[10px] text-neutral-300 dark:text-neutral-600 font-bold">/</span>
            <span className="text-xs text-neutral-400 dark:text-[#CCCCCC] font-bold">{fmt(allocated)}</span>
          </div>
        </div>

        <div className="w-full bg-neutral-100 dark:bg-[#222222] rounded-full h-1.5 overflow-hidden">
          <div className="h-1.5 rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: barColor }} />
        </div>

        {/* Per-day remaining indicator */}
        {!isOver && available > 0 && daysRemaining > 0 && (
          <p className="text-[9px] font-bold text-neutral-400 mt-2 flex items-center gap-1">
            <span className="text-brand-green">{fmt(Math.round(perDay))}</span>
            <span>/ day for {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining</span>
          </p>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700 overflow-hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>

      {/* ── HEADER & NAVIGATION ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-blue/5 dark:bg-brand-blue/10 text-brand-blue dark:text-brand-cyan rounded-2xl border border-brand-blue/10 dark:border-brand-blue/5">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-3xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">Budgets</h1>
            <p className="text-neutral-400 font-bold mt-0.5 uppercase tracking-widest text-[8px]">Zero-Based Envelope & Custom Goals</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Month Navigation */}
          <div className="flex items-center gap-4 bg-white dark:bg-[#111111] px-4 py-2 rounded-[24px] shadow-sm border border-brand-blue/5 dark:border-[#222222] flex-1 sm:flex-none justify-between sm:justify-start">
            <button onClick={() => setCurrentMonth(m => budgetStartDay === 1 ? subMonths(m, 1) : getPrevBudgetMonth(m, budgetStartDay))} className="text-brand-blue/40 dark:text-[#A0A0A0] hover:text-brand-blue dark:hover:text-[#F7F7F7] font-semibold px-1 transition-colors">&lt;</button>
            <span className="font-semibold text-brand-blue dark:text-[#F7F7F7] min-w-[120px] text-center uppercase tracking-[0.2em] text-[10px]">
              {monthName}
            </span>
            <button onClick={() => setCurrentMonth(m => budgetStartDay === 1 ? addMonths(m, 1) : getNextBudgetMonth(m, budgetStartDay))} className="text-brand-blue/40 dark:text-[#A0A0A0] hover:text-brand-blue dark:hover:text-[#F7F7F7] font-semibold px-1 transition-colors">&gt;</button>
          </div>
        </div>
      </div>

      {/* ── EMPTY STATE ONBOARDING ── */}
      {isEmpty && (
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-blue/5 via-brand-green/5 to-brand-cyan/5 dark:from-brand-blue/10 dark:via-brand-green/10 dark:to-brand-cyan/10 border border-brand-green/10 dark:border-brand-green/5 p-6 sm:p-8">
          <div className="absolute top-0 right-0 w-40 h-40 bg-brand-green/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 bg-brand-green/10 rounded-xl">
                <Sparkles className="w-5 h-5 text-brand-green" />
              </div>
              <div>
                <h2 className="text-base font-black text-brand-blue dark:text-[#F7F7F7] tracking-tight">Start Envelope Budgeting</h2>
                <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">3 simple steps to budget mastery</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              {[
                { step: '1', title: 'Set your monthly pool', desc: 'Enter your total available funds for the month — think of it as your paycheck.' },
                { step: '2', title: 'Create envelopes', desc: 'Allocate money to categories like Groceries, Rent, or Entertainment.' },
                { step: '3', title: 'Track as you spend', desc: 'Each transaction auto-deducts from the right envelope. Stay on budget effortlessly.' },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-brand-green text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm shadow-brand-green/20">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-brand-blue dark:text-[#F7F7F7]">{item.title}</p>
                    <p className="text-[10px] text-neutral-400 font-medium leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => { setPoolInput(''); setIsPoolModalOpen(true); }}
              className="flex items-center gap-2 px-5 py-3 bg-brand-green text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-brand-green/20"
            >
              Get Started <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── SWIPEABLE TABS ── */}
      {!isEmpty && (
        <>
          <div className="flex border-b border-neutral-100 dark:border-[#222222] overflow-x-auto whitespace-nowrap scrollbar-none gap-2 px-1">
            {(['POOL', 'CUSTOM'] as const).map(tab => {
              const isActive = activeTab === tab;
              const label = tab === 'POOL' ? 'Monthly Pool' : 'Custom Budgets';
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all rounded-t-xl cursor-pointer",
                    isActive
                      ? "border-brand-green text-brand-green bg-brand-green/5 dark:bg-brand-green/10"
                      : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* ── TAB CONTENT (ANIMATED) ── */}
          <div className="relative">
            <AnimatePresence custom={slideDirection} mode="wait">
              
              {/* TAB A: MONTHLY POOL */}
              {activeTab === 'POOL' && (
                <motion.div
                  key="POOL"
                  custom={slideDirection}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-6"
                >
                  {/* 1. MASTER POOL OVERVIEW WITH DONUT */}
                  <SectionCard>
                    <SectionTitle 
                      icon={<Wallet className="w-4 h-4" />} 
                      label="Monthly Pool" 
                      action={
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => navigate(`/budgets/customize/${monthStr}`)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-neutral-50 dark:bg-[#1C1C24] text-brand-blue/60 dark:text-[#CCCCCC] hover:text-brand-blue dark:hover:text-white rounded-xl border border-brand-blue/5 dark:border-white/5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all active:scale-95"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            Filters
                          </button>
                          <button 
                            onClick={() => { setPoolInput(masterBudgetAmt ? masterBudgetAmt.toString() : ''); setIsPoolModalOpen(true); }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-neutral-50 dark:bg-[#1C1C24] text-brand-blue/60 dark:text-[#CCCCCC] hover:text-brand-blue dark:hover:text-white rounded-xl border border-brand-blue/5 dark:border-white/5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all active:scale-95"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                        </div>
                      } 
                    />
                    
                    <div className="flex flex-col gap-4">
                      {/* Pool amount + Donut side by side */}
                      <div className="flex items-center gap-6">
                        <div className="flex-1">
                          <div className="flex items-end gap-3 mb-3 px-1">
                            <h2 className="text-3xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">{fmt(masterBudgetAmt)}</h2>
                            <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">Total Funds</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-neutral-50 dark:bg-[#1A1A1E]/50 p-3 rounded-2xl border border-neutral-100 dark:border-[#222222]">
                              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Allocated</p>
                              <p className="text-base font-black text-brand-blue dark:text-[#F7F7F7] tracking-tight">{fmt(totalAllocated)}</p>
                            </div>
                            
                            <div className={cn("p-3 rounded-2xl border", unallocated < 0 ? "bg-brand-red/5 border-brand-red/20" : "bg-neutral-50 dark:bg-[#1A1A1E]/50 border-neutral-100 dark:border-[#222222]")}>
                              <p className={cn("text-[9px] font-bold uppercase tracking-widest mb-1", unallocated < 0 ? "text-brand-red" : "text-neutral-400")}>
                                Unallocated
                              </p>
                              <p className={cn("text-base font-black tracking-tight", unallocated < 0 ? "text-brand-red" : "text-brand-green")}>
                                {unallocated < 0 ? '-' : ''}{fmt(Math.abs(unallocated))}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Donut Chart */}
                        {masterBudgetAmt > 0 && (
                          <div className="shrink-0 hidden sm:block">
                            <DonutChart
                              spent={totalSpent}
                              allocatedUnspent={Math.max(totalAllocated - totalSpent, 0)}
                              unallocated={Math.max(unallocated, 0)}
                              size={110}
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Mobile donut — shown on small screens */}
                      {masterBudgetAmt > 0 && (
                        <div className="flex justify-center sm:hidden">
                          <DonutChart
                            spent={totalSpent}
                            allocatedUnspent={Math.max(totalAllocated - totalSpent, 0)}
                            unallocated={Math.max(unallocated, 0)}
                            size={100}
                          />
                        </div>
                      )}

                      {/* Donut Legend */}
                      {masterBudgetAmt > 0 && (
                        <div className="flex items-center justify-center gap-4 pt-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-brand-green" />
                            <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Spent</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-brand-blue/30 dark:bg-brand-blue/40" />
                            <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Allocated</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-neutral-200 dark:bg-[#222222]" />
                            <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Free</span>
                          </div>
                        </div>
                      )}

                      {unallocated < 0 && (
                        <div className="flex items-center gap-2 text-brand-red text-[10px] font-bold bg-brand-red/5 p-3 rounded-xl border border-brand-red/10 mt-1">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          Over-allocated by {fmt(Math.abs(unallocated))}.
                        </div>
                      )}
                    </div>
                  </SectionCard>

                  {/* 2. ENVELOPES (CATEGORIES) */}
                  <SectionCard>
                    <SectionTitle 
                      icon={<Briefcase className="w-4 h-4" />} 
                      label="Envelopes" 
                      action={
                        <button onClick={openNewEnvelope} className="flex items-center gap-1.5 px-4 py-2 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-xl hover:bg-brand-green/90 transition-all font-semibold text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-brand-green/10">
                          <Plus className="w-4 h-4" /> Define
                        </button>
                      }
                    />

                    {envelopeBudgets.length === 0 ? (
                      <div className="text-center py-10 opacity-40 flex flex-col items-center">
                        <div className="w-12 h-12 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                          <Target className="w-6 h-6 text-neutral-400" />
                        </div>
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">No envelopes allocated</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {envelopeBudgets.map(b => renderBudgetCard(b, false))}
                      </div>
                    )}
                  </SectionCard>
                </motion.div>
              )}

              {/* TAB B: CUSTOM BUDGETS */}
              {activeTab === 'CUSTOM' && (
                <motion.div
                  key="CUSTOM"
                  custom={slideDirection}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="space-y-6"
                >
                  <SectionCard>
                    <SectionTitle 
                      icon={<Star className="w-4 h-4" />} 
                      label="Custom Goals & Budgets" 
                      action={
                        <button onClick={openNewCustom} className="flex items-center gap-1.5 px-4 py-2 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-xl hover:bg-brand-green/90 transition-all font-semibold text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-brand-green/10">
                          <Plus className="w-4 h-4" /> Define
                        </button>
                      }
                    />
                    
                    <p className="text-[10px] font-semibold text-neutral-400/80 leading-relaxed mb-5 px-1">
                      These independent budgets do not subtract from your Monthly Pool. 
                      To track spending against them, use the custom name as a <span className="font-bold text-brand-blue dark:text-white">Tag</span> or <span className="font-bold text-brand-blue dark:text-white">Category</span> on your transactions.
                    </p>

                    {customBudgets.length === 0 ? (
                      <div className="text-center py-10 opacity-40 flex flex-col items-center border border-dashed border-neutral-200 dark:border-white/10 rounded-[20px]">
                        <div className="w-12 h-12 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3">
                          <Star className="w-6 h-6 text-neutral-400" />
                        </div>
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">No custom budgets</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {customBudgets.map(b => renderBudgetCard(b, true))}
                      </div>
                    )}
                  </SectionCard>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </>
      )}

      {/* ── MODALS ── */}
      
      {/* Pool Modal */}
      {isPoolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111111] w-full max-w-sm rounded-[24px] p-6 shadow-xl border border-neutral-200 dark:border-[#222222] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-brand-blue dark:text-[#F7F7F7] mb-1">Monthly Pool</h3>
            <p className="text-[9px] font-bold text-neutral-400 mb-5 uppercase tracking-widest">Set available funds for {monthName}</p>
            
            <div className="relative mb-6">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">{currencySymbol}</span>
              <input type="number" value={poolInput} onChange={e => setPoolInput(e.target.value)} className="w-full bg-neutral-50 dark:bg-[#1A1A1E] border border-neutral-100 dark:border-[#222222] rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-brand-blue dark:text-[#F7F7F7] focus:outline-none focus:border-brand-green transition-colors" placeholder="0" autoFocus />
            </div>
            
            <div className="mt-8 flex items-center justify-between pt-6 border-t border-brand-blue/5 dark:border-white/5">
              {masterPool && masterPool.id ? (
                <button
                  type="button"
                  onClick={handleDeletePool}
                  className="px-4 py-3 text-brand-red/60 hover:text-brand-red font-semibold rounded-xl transition-colors uppercase text-[10px] tracking-[0.2em]"
                >
                  Delete
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-3">
                <button onClick={() => setIsPoolModalOpen(false)} className="px-6 py-3 text-brand-blue/40 hover:text-brand-blue dark:text-white/40 dark:hover:text-white font-semibold rounded-xl transition-colors uppercase text-[10px] tracking-[0.2em]">Cancel</button>
                <button onClick={handleSavePool} className="px-6 py-3 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] font-semibold rounded-xl hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20 uppercase text-[10px] tracking-[0.2em]">Commit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Envelope Modal (Standard) */}
      {isEnvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111111] w-full max-w-sm rounded-[24px] p-6 shadow-xl border border-neutral-200 dark:border-[#222222] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-brand-blue dark:text-[#F7F7F7] mb-5">{editingEnvId ? 'Edit Envelope' : 'New Envelope'}</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[8px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5 ml-1">Category</label>
                <select value={envCategory} onChange={e => setEnvCategory(e.target.value)} className="w-full bg-neutral-50 dark:bg-[#1A1A1E] border border-neutral-100 dark:border-[#222222] rounded-xl px-4 py-3 text-xs font-bold text-brand-blue dark:text-[#F7F7F7] focus:outline-none focus:border-brand-green transition-colors appearance-none">
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c] || ''} {c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[8px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5 ml-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">{currencySymbol}</span>
                  <input type="number" value={envAmount} onChange={e => setEnvAmount(e.target.value)} className="w-full bg-neutral-50 dark:bg-[#1A1A1E] border border-neutral-100 dark:border-[#222222] rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-brand-blue dark:text-[#F7F7F7] focus:outline-none focus:border-brand-green transition-colors" placeholder="0" />
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-brand-blue/5 dark:border-white/5">
              <button onClick={() => setIsEnvModalOpen(false)} className="px-6 py-3 text-brand-blue/40 hover:text-brand-blue dark:text-white/40 dark:hover:text-white font-semibold rounded-xl transition-colors uppercase text-[10px] tracking-[0.2em]">Cancel</button>
              <button onClick={handleSaveEnvelope} className="px-6 py-3 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] font-semibold rounded-xl hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20 uppercase text-[10px] tracking-[0.2em]">{editingEnvId ? 'Update' : 'Commit'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Budget Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#111111] w-full max-w-sm rounded-[24px] p-6 shadow-xl border border-neutral-200 dark:border-[#222222] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-brand-blue dark:text-[#F7F7F7] mb-5">{editingEnvId ? 'Edit Custom Budget' : 'New Custom Budget'}</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[8px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5 ml-1">Budget Name</label>
                <input type="text" value={customName} onChange={e => setCustomName(e.target.value)} className="w-full bg-neutral-50 dark:bg-[#1A1A1E] border border-neutral-100 dark:border-[#222222] rounded-xl py-3 px-4 text-xs font-bold text-brand-blue dark:text-[#F7F7F7] focus:outline-none focus:border-brand-green transition-colors" placeholder="e.g., Vacation Fund, Sneaker Goal" />
              </div>

              <div>
                <label className="block text-[8px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5 ml-1">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold">{currencySymbol}</span>
                  <input type="number" value={envAmount} onChange={e => setEnvAmount(e.target.value)} className="w-full bg-neutral-50 dark:bg-[#1A1A1E] border border-neutral-100 dark:border-[#222222] rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-brand-blue dark:text-[#F7F7F7] focus:outline-none focus:border-brand-green transition-colors" placeholder="0" />
                </div>
              </div>
            </div>
            
            <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-brand-blue/5 dark:border-white/5">
              <button onClick={() => setIsCustomModalOpen(false)} className="px-6 py-3 text-brand-blue/40 hover:text-brand-blue dark:text-white/40 dark:hover:text-white font-semibold rounded-xl transition-colors uppercase text-[10px] tracking-[0.2em]">Cancel</button>
              <button onClick={handleSaveCustom} className="px-6 py-3 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] font-semibold rounded-xl hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20 uppercase text-[10px] tracking-[0.2em]">{editingEnvId ? 'Update' : 'Commit'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
