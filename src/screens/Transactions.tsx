import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction, normalizeType } from '../models/db';
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay, addMonths, subMonths, startOfYear, endOfYear, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, parseISO } from 'date-fns';
import { X, Trash2, Filter, Search, Edit3, Download, FileText, Plus, CheckSquare, Calendar,
  ChevronLeft, ChevronRight, ListOrdered, ArrowDownLeft, ArrowUpRight,
  Layers, Tag as TagIcon, Landmark, Smartphone, Hash,
  BookOpen, CheckCircle2, ChevronDown, Wallet, CreditCard, Check
} from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../hooks/useCurrency';
import { useToast } from '../context/ToastContext';

import { CATEGORY_ICONS } from '../constants';

const CATEGORY_COLORS: Record<string, string> = {
  'Food': 'bg-orange-50 text-orange-600 border-orange-100',
  'Transport': 'bg-blue-50 text-blue-600 border-blue-100',
  'Rent': 'bg-purple-50 text-purple-600 border-purple-100',
  'Shopping': 'bg-pink-50 text-pink-600 border-pink-100',
  'Bills': 'bg-amber-50 text-amber-600 border-amber-100',
  'Entertainment': 'bg-indigo-50 text-indigo-600 border-indigo-100',
  'Salary': 'bg-emerald-50 text-emerald-600 border-emerald-100',
  'Transfer': 'bg-cyan-50 text-cyan-600 border-cyan-100',
  'Other': 'bg-neutral-50 text-neutral-600 border-neutral-100'
};

// ─── Portal helper ────────────────────────────────────────────────
const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  createPortal(children, document.body);



// ─── Custom Date Picker ───────────────────────────────────────────
const AppDatePicker = ({ value, onChange, label, isOpen, onToggle }: { value: string, onChange: (val: string) => void, label: string, isOpen: boolean, onToggle: () => void }) => {
  const [currentMonth, setCurrentMonth] = useState(value ? parseISO(value) : new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  return (
    <div className="flex-1 flex flex-col">
      <div 
        onClick={onToggle}
        className={`bg-neutral-50 dark:bg-white/5 border p-2 rounded-xl transition-all cursor-pointer ${isOpen ? 'border-brand-blue dark:border-brand-cyan shadow-sm' : 'border-neutral-200/80 dark:border-white/10'}`}
      >
        <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1">{label}</span>
        <div className="text-[11px] font-semibold text-neutral-800 dark:text-white flex justify-between items-center">
          {value ? format(parseISO(value), 'dd MMM yyyy') : 'Select Date'}
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 bg-neutral-50 dark:bg-white/5 border border-neutral-200/80 dark:border-white/10 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                <button onClick={(e) => { e.stopPropagation(); setCurrentMonth(subMonths(currentMonth, 1)); }} className="p-1 hover:bg-white dark:hover:bg-white/10 rounded-lg shadow-sm border border-transparent hover:border-neutral-200 dark:hover:border-white/10 transition-all">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-black text-brand-blue dark:text-white uppercase tracking-widest">{format(currentMonth, 'MMM yyyy')}</span>
                <button onClick={(e) => { e.stopPropagation(); setCurrentMonth(addMonths(currentMonth, 1)); }} className="p-1 hover:bg-white dark:hover:bg-white/10 rounded-lg shadow-sm border border-transparent hover:border-neutral-200 dark:hover:border-white/10 transition-all">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d} className="text-[8px] font-bold text-neutral-400 uppercase">{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isSelected = value === dateStr;
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={(e) => { e.stopPropagation(); onChange(dateStr); onToggle(); }}
                      className={`aspect-square flex items-center justify-center text-[10px] font-bold rounded-xl transition-all
                        ${isSelected ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/30 scale-105' : 
                          isCurrentMonth ? 'text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-neutral-200 dark:hover:border-white/10' : 
                          'text-neutral-300 dark:text-neutral-700 opacity-50'
                        }
                        ${isToday(day) && !isSelected ? 'text-brand-blue border-brand-blue/30 bg-brand-blue/5' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════
// Main Transactions Screen
// ═════════════════════════════════════════════════════════════════
export default function Transactions() {
  const currency = useCurrency();
  const { user } = useAuth();
  const { categories: appCategories } = useCategories();
  const { tags } = useTags();
  const navigate = useNavigate();
  const { confirm, success } = useToast();

  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'ALL';
  const initialSearch = searchParams.get('search') || '';
  const initialGranularity = (searchParams.get('granularity') as 'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM') || 'MONTH';
  
  const initialDate = useMemo(() => {
    const monthParam = searchParams.get('month'); // 'YYYY-MM'
    if (monthParam) {
      const parts = monthParam.split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, 15);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  }, [searchParams]);

  // ── View ──────────────────────────────────────────────────────
  const [granularity, setGranularity] = useState<'MONTH' | 'LAST_MONTH' | 'YEAR' | 'ALL' | 'CUSTOM'>(initialGranularity);
  const [referenceDate, setReferenceDate] = useState(initialDate);
  const [customRange, setCustomRange] = useState({ 
    start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [openDatePicker, setOpenDatePicker] = useState<'start' | 'end' | null>(null);

  // ── Filters ───────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const initialType = (searchParams.get('type') as any) || 'ALL';
  const [typeFilter, setTypeFilter] = useState<string[]>(initialType !== 'ALL' ? [initialType] : []);
  const [accountTypeFilter, setAccountTypeFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>(initialCategory !== 'ALL' ? [initialCategory] : []);
  const initialTag = searchParams.get('tag') || 'ALL';
  const initialAccount = searchParams.has('account') ? Number(searchParams.get('account')) : 'ALL';
  const initialMethod = searchParams.get('method') || 'ALL';

  const [accountFilter, setAccountFilter] = useState<number[]>(initialAccount !== 'ALL' ? [Number(initialAccount)] : []);
  const [tagFilter, setTagFilter] = useState<string[]>(initialTag !== 'ALL' ? [initialTag] : []);
  const [methodFilter, setMethodFilter] = useState<string[]>(initialMethod !== 'ALL' ? [initialMethod] : []);

  const toggleCategory = (c: string) => setCategoryFilter(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleAccount = (a: number) => setAccountFilter(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  const toggleType = (t: string) => setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const toggleTag = (tg: string) => setTagFilter(prev => prev.includes(tg) ? prev.filter(x => x !== tg) : [...prev, tg]);
  const toggleAccountType = (at: string) => setAccountTypeFilter(prev => prev.includes(at) ? prev.filter(x => x !== at) : [...prev, at]);
  const toggleMethod = (m: string) => setMethodFilter(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const togglePopover = (popover: string) => setActivePopover(prev => prev === popover ? null : popover);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: 'date' | 'amount'; direction: 'asc' | 'desc'}>({ key: 'date', direction: 'desc' });

  // ── Detail drawer ─────────────────────────────────────────────
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Bulk Select ─────────────────────────────────────────────


  // ── Data ──────────────────────────────────────────────────────
  const accounts = useLiveQuery(async () => {
    const arr = await db.accounts.toArray();
    return [...arr].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [user?.uid]) || [];

  const accountsMap = useMemo(() => {
    const map: Record<string, any> = {};
    accounts.forEach(a => { map[String(a.id)] = a; });
    return map;
  }, [accounts]);

  const dateLimits = useMemo(() => {
    let start: Date | number = 0;
    let end: Date | number = new Date(8640000000000000);
    if (granularity === 'MONTH') { start = startOfMonth(referenceDate); end = endOfMonth(referenceDate); }
    else if (granularity === 'LAST_MONTH') { start = startOfMonth(subMonths(referenceDate, 1)); end = endOfMonth(subMonths(referenceDate, 1)); }
    else if (granularity === 'YEAR') { start = startOfYear(referenceDate); end = endOfYear(referenceDate); }
    else if (granularity === 'CUSTOM') { start = startOfDay(new Date(customRange.start + 'T00:00:00')); end = endOfDay(new Date(customRange.end + 'T00:00:00')); }
    return { start, end };
  }, [granularity, referenceDate, customRange]);

  const allTxs = useLiveQuery(() => {
    if (granularity === 'ALL') return db.transactions.reverse().toArray();
    return db.transactions.where('dateTime').between(dateLimits.start, dateLimits.end, true, true).reverse().toArray();
  }, [granularity, dateLimits.start, dateLimits.end, user?.uid]);

  const isLoading  = allTxs === undefined;
  const currentTxs = allTxs || [];

  const filteredTxs = useMemo(() => {
    return currentTxs.filter(tx => {
      const txAccount = accounts.find(a => a.id === Number(tx.accountId));
      const txSourceType = txAccount?.type || 'BANK';
      if (accountTypeFilter.length > 0) {
        const acc = accountsMap[String(tx.accountId)];
        if (!acc || !accountTypeFilter.includes(acc.type)) return false;
      }
      if (methodFilter.length > 0) {
        const pm = (tx.paymentMethod || '').toLowerCase();
        const upi = ((tx as any).upiApp || '').toLowerCase();
        const match = methodFilter.some(m => pm.includes(m.toLowerCase()) || upi.includes(m.toLowerCase()));
        if (!match) return false;
      }
      if (typeFilter.length > 0 && !typeFilter.includes(tx.type)) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(tx.category || 'Other')) return false;
      if (accountFilter.length > 0 && !accountFilter.includes(Number(tx.accountId))) return false;
      if (tagFilter.length > 0 && !tagFilter.some(t => t.toLowerCase() === (tx.expenseType || '').toLowerCase())) return false;
      
      const budgetIdParam = searchParams.get('budgetId');
      if (budgetIdParam) {
        const targetBudgetId = Number(budgetIdParam);
        if (tx.linkedBudgetId) {
          if (tx.linkedBudgetId !== targetBudgetId) return false;
        } else {
          const budgetCategory = searchParams.get('category');
          if (budgetCategory && tx.category !== budgetCategory) return false;
        }
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!tx.note?.toLowerCase().includes(q) && !tx.party?.toLowerCase().includes(q) && !tx.category?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    
    result.sort((a, b) => {
      if (sortConfig.key === 'date') {
        const dateA = new Date(a.dateTime).getTime();
        const dateB = new Date(b.dateTime).getTime();
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortConfig.key === 'amount') {
        const amountA = Number(a.amount) || 0;
        const amountB = Number(b.amount) || 0;
        return sortConfig.direction === 'asc' ? amountA - amountB : amountB - amountA;
      }
      return 0;
    });
    return result;
  }, [currentTxs, accountTypeFilter, typeFilter, categoryFilter, accountFilter, tagFilter, methodFilter, searchTerm, accounts, searchParams, sortConfig]);

  const totals = useMemo(() =>
    filteredTxs.reduce((acc, tx) => {
      const amt = Number(tx.amount) || 0;
      if (normalizeType(tx.type) === 'CREDIT') acc.income += amt; else acc.expense += amt;
      return acc;
    }, { income: 0, expense: 0 }),
    [filteredTxs]
  );

  const deleteTransaction = async (id: number) => {
    if (!await confirm('Permanently remove this financial record?')) return;
    setIsDeleting(true);
    try {
      const tx = await db.transactions.get(id);
      if (tx?.linkedTransactionId) await db.transactions.delete(tx.linkedTransactionId);
      await db.transactions.delete(id);
      setSelectedTx(null);
    } catch (err) { console.error(err); }
    finally { setIsDeleting(false); }
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-3 pb-32 px-2 md:px-0">

      {/* Page Header */}
      <div className="flex items-center justify-between gap-4 pt-1 pb-1">
        <div>
          <h1 className="text-xl font-heading font-bold text-brand-blue dark:text-white tracking-tight leading-none">Transactions</h1>
          <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Activity History</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="bg-white dark:bg-[#0C0C0F] p-2 rounded-[18px] border border-neutral-100 dark:border-white/5 shadow-sm flex items-center justify-center gap-6">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-emerald-50 dark:bg-emerald-500/10 rounded-md flex items-center justify-center text-emerald-600">
            <ArrowDownLeft className="w-3 h-3" />
          </div>
          <div>
            <p className="text-[8px] font-medium text-neutral-400 dark:text-white/40 leading-none">Inflow</p>
            <h3 className="text-xs font-heading font-bold text-emerald-600 tracking-tight">{currency}{totals.income.toLocaleString()}</h3>
          </div>
        </div>
        <div className="w-px h-4 bg-neutral-100 dark:bg-white/5" />
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-rose-50 dark:bg-rose-500/10 rounded-md flex items-center justify-center text-rose-600">
            <ArrowUpRight className="w-3 h-3" />
          </div>
          <div>
            <p className="text-[8px] font-medium text-neutral-400 dark:text-white/40 leading-none">Outflow</p>
            <h3 className="text-xs font-heading font-bold text-rose-600 tracking-tight">{currency}{totals.expense.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      {/* Notion/Linear Style Filter Toolbar */}
      <div className="sticky top-2 z-40 bg-white/90 dark:bg-[#060608]/90 backdrop-blur-xl p-2 rounded-[20px] border border-neutral-200/80 dark:border-white/10 shadow-lg flex flex-col gap-2">
        {/* Search & Main Controls */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Filter or search transactions..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-7 bg-neutral-100/60 dark:bg-white/5 border border-transparent focus:border-neutral-200 dark:focus:border-white/10 rounded-xl text-xs font-medium text-brand-blue dark:text-white outline-none transition-all placeholder:text-neutral-400"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setIsFilterOpen(true)}
            className={`h-8 px-2.5 border rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
              (categoryFilter.length > 0 || typeFilter.length > 0 || accountFilter.length > 0 || tagFilter.length > 0 || methodFilter.length > 0 || accountTypeFilter.length > 0 || granularity !== 'ALL')
                ? 'bg-brand-blue/10 text-brand-blue dark:text-white border-brand-blue/20'
                : 'bg-neutral-100/60 dark:bg-white/5 border-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-white/10'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Filter</span>
          </button>

          {/* Sort Button */}
          <div className="relative">
            <button
              onClick={() => togglePopover('sort')}
              className={`h-8 px-2.5 border rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                sortConfig.key !== 'date' || sortConfig.direction !== 'desc'
                  ? 'bg-brand-blue/10 text-brand-blue dark:text-white border-brand-blue/20'
                  : 'bg-neutral-100/60 dark:bg-white/5 border-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-white/10'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {sortConfig.key === 'date'
                  ? sortConfig.direction === 'desc' ? 'Newest' : 'Oldest'
                  : sortConfig.direction === 'desc' ? 'Highest' : 'Lowest'}
              </span>
            </button>

            {/* Sort Options Popover */}
            <AnimatePresence>
              {activePopover === 'sort' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 5 }}
                    className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5"
                  >
                    <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-neutral-400">Sort by</div>
                    {[
                      { label: 'Date: Newest First', key: 'date', direction: 'desc' },
                      { label: 'Date: Oldest First', key: 'date', direction: 'asc' },
                      { label: 'Amount: High to Low', key: 'amount', direction: 'desc' },
                      { label: 'Amount: Low to High', key: 'amount', direction: 'asc' },
                    ].map((opt, idx) => {
                      const isSelected = sortConfig.key === opt.key && sortConfig.direction === opt.direction;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setSortConfig({ key: opt.key as any, direction: opt.direction as any });
                            setActivePopover(null);
                          }}
                          className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold'
                              : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue dark:text-white" />}
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-brand-blue/10 border-t-brand-blue rounded-full animate-spin mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-blue/40">Accessing Records…</p>
          </div>
        ) : currentTxs.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center opacity-40">
            <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-[20px] flex items-center justify-center mb-6">
              <ListOrdered className="w-6 h-6 text-neutral-300" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Recorded Activity</p>
          </div>
        ) : filteredTxs.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center opacity-40">
            <p className="text-[9px] font-black uppercase tracking-widest italic">No matches found in this timeline</p>
          </div>
        ) : (
          filteredTxs.map((tx, idx) => {
            const date = new Date(tx.dateTime);
            const showDateHeader = idx === 0 || !isSameDay(date, new Date(filteredTxs[idx - 1].dateTime));
            return (
              <div key={tx.id || idx} className="space-y-1.5">
                {showDateHeader && (
                  <div className="pt-3 flex items-center gap-3">
                    <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                      {format(date, 'EEEE, dd MMM yyyy')}
                    </span>
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedTx(tx)}
                  className={`bg-white dark:bg-[#0C0C0F] hover:bg-neutral-50 dark:hover:bg-white/5 border border-neutral-100 dark:border-white/5 p-3 rounded-[20px] shadow-sm flex items-center gap-3 transition-all cursor-pointer active:shadow-inner pointer-events-auto`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); if (tx.category) setCategoryFilter(tx.category); }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${CATEGORY_COLORS[tx.category || 'Other'] || 'bg-neutral-50'} shrink-0 hover:scale-105 active:scale-95 transition-all`}
                    title={`Filter by ${tx.category}`}>
                    {CATEGORY_ICONS[tx.category || 'Other'] || '📝'}
                  </button>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-brand-blue dark:text-white truncate leading-tight mb-0.5">
                      {tx.party || tx.note || tx.category || 'Record'}
                    </h4>
                    {(() => {
                      const displayRemark = tx.party && tx.note && tx.note !== '-' && tx.note !== tx.party ? tx.note : '';
                      const displayMethod = (tx as any).upiApp || tx.paymentMethod || accountsMap[String(tx.accountId)]?.bankName || '';
                      return (
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                          {displayRemark && (
                            <span className="truncate max-w-[140px] sm:max-w-[200px]">{displayRemark}</span>
                          )}
                          {displayRemark && displayMethod && (
                            <div className="w-1 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700 shrink-0" />
                          )}
                          {displayMethod && (
                            <span className="shrink-0">{displayMethod}</span>
                          )}
                          {!displayRemark && !displayMethod && (
                            <span>—</span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <p className={`text-sm font-bold tracking-tight ${normalizeType(tx.type) === 'DEBIT' ? 'text-rose-500' : normalizeType(tx.type) === 'TRANSFER' ? 'text-cyan-500' : 'text-emerald-500'}`}>
                    {normalizeType(tx.type) === 'DEBIT' ? '−' : normalizeType(tx.type) === 'TRANSFER' ? '⇄' : '+'}{currency}{Number(tx.amount).toLocaleString()}
                  </p>
                </motion.div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selectedTx && (
          <Portal>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedTx(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999]" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0C0C0F] z-[10000] rounded-t-[32px] p-6 pb-20 md:pb-6 max-w-lg mx-auto shadow-2xl border-t border-white/10">
              <div className="w-10 h-1 bg-neutral-100 dark:bg-white/10 rounded-full mx-auto mb-6" />
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-neutral-100 dark:bg-white/5 rounded-xl flex items-center justify-center text-2xl border border-neutral-100 dark:border-white/10">
                    {CATEGORY_ICONS[selectedTx.category || 'Other'] || '📝'}
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 block mb-0.5">{selectedTx.category} Ledger</span>
                    <h2 className="text-base font-bold text-brand-blue dark:text-white tracking-tight">{selectedTx.party || 'Statement Entry'}</h2>
                    <p className="text-[10px] font-medium text-neutral-400 mt-0.5">{format(new Date(selectedTx.dateTime), 'dd MMM yyyy, hh:mm a')}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedTx(null)} className="p-2 bg-neutral-50 dark:bg-white/5 rounded-full text-neutral-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  { icon: <Landmark className="w-2.5 h-2.5" />, label: 'Source Account', value: accounts.find(a => a.id === selectedTx.accountId)?.bankName || 'Unknown' },
                  { icon: <Smartphone className="w-2.5 h-2.5" />, label: 'Method', value: (selectedTx as any).upiApp || selectedTx.paymentMethod || 'Manual' },
                  { icon: <TagIcon className="w-2.5 h-2.5" />, label: 'Classification', value: `#${selectedTx.expenseType || 'Unclassified'}` },
                  { icon: <Layers className="w-2.5 h-2.5" />, label: 'Flow',
                    value: normalizeType(selectedTx.type) === 'CREDIT' ? '↓ Inflow' : normalizeType(selectedTx.type) === 'TRANSFER' ? '⇄ Transfer' : '↑ Outflow',
                    color: normalizeType(selectedTx.type) === 'CREDIT' ? 'text-emerald-500' : normalizeType(selectedTx.type) === 'TRANSFER' ? 'text-cyan-500' : 'text-rose-500' },
                ].map(({ icon, label, value, color }) => (
                  <div key={label} className="bg-neutral-50 dark:bg-white/5 p-3 rounded-2xl border border-neutral-100 dark:border-white/5">
                    <p className="text-[7px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">{icon} {label}</p>
                    <p className={`text-[10px] font-bold truncate ${color || 'text-brand-blue dark:text-white'}`}>{value}</p>
                  </div>
                ))}
              </div>

              {selectedTx.note && (
                <div className="mb-6 bg-neutral-50/50 dark:bg-white/[0.02] p-4 rounded-2xl border border-dashed border-neutral-200 dark:border-white/10">
                  <p className="text-[11px] font-bold text-brand-blue dark:text-white opacity-80 italic leading-relaxed text-center">
                    "{selectedTx.note}"
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { navigate(`/?edit=${selectedTx.id}`); setSelectedTx(null); }}
                  className="py-4 bg-brand-blue dark:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-brand-blue/20">
                  <Edit3 className="w-4 h-4" /> Edit Record
                </button>
                <button onClick={() => deleteTransaction(selectedTx.id!)} disabled={isDeleting}
                  className="py-4 bg-rose-500/10 text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50">
                  {isDeleting ? <div className="w-4 h-4 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {isDeleting ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>




      {/* Filter Panel */}
      <AnimatePresence>
        {isFilterOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="fixed inset-0 bg-black/40 z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-80 max-w-full bg-white dark:bg-[#111111] z-50 shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex flex-col gap-4 shrink-0 bg-neutral-50/30">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-heading font-black text-brand-blue text-lg leading-none">Filter Transactions</h3>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Refine View</p>
                  </div>
                  <button onClick={() => setIsFilterOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-white/5">
                  <p className="text-[11px] font-bold text-neutral-500">Filter your transactions</p>
                  {(accountFilter.length > 0 || categoryFilter.length > 0 || tagFilter.length > 0 || methodFilter.length > 0 || typeFilter.length > 0 || accountTypeFilter.length > 0 || granularity !== 'ALL') && (
                    <button 
                      onClick={() => {
                        setAccountFilter([]);
                        setCategoryFilter([]);
                        setTagFilter([]);
                        setMethodFilter([]);
                        setTypeFilter([]);
                        setAccountTypeFilter([]);
                        setGranularity('ALL');
                      }}
                      className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-[9px] font-black text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors uppercase tracking-wider"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Primary: Time & Flow */}
                <div className="space-y-6">
                  {/* Period Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                        <Calendar className="w-3.5 h-3.5" /> Time Period
                      </h4>
                      <div className="flex bg-neutral-100/80 dark:bg-white/5 p-0.5 rounded-lg border border-neutral-200/50 dark:border-white/5">
                        <button onClick={() => setGranularity('ALL')} className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${granularity === 'ALL' ? 'bg-white dark:bg-[#111111] text-brand-blue dark:text-brand-cyan shadow-sm border border-neutral-200/50 dark:border-white/10' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}>All</button>
                        <button onClick={() => { setGranularity('MONTH'); setReferenceDate(new Date()); }} className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${granularity === 'MONTH' ? 'bg-white dark:bg-[#111111] text-brand-blue dark:text-brand-cyan shadow-sm border border-neutral-200/50 dark:border-white/10' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}>Month</button>
                        <button onClick={() => setGranularity('CUSTOM')} className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all ${granularity === 'CUSTOM' ? 'bg-white dark:bg-[#111111] text-brand-blue dark:text-brand-cyan shadow-sm border border-neutral-200/50 dark:border-white/10' : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}>Custom</button>
                      </div>
                    </div>
                    <div className="w-full">
                      {granularity === 'MONTH' || granularity === 'LAST_MONTH' ? (
                        <div className="flex items-center justify-between px-1 py-1">
                          <button onClick={() => setReferenceDate(subMonths(referenceDate, 1))} className="w-8 h-8 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-white/10 rounded-full transition-colors active:scale-95 text-neutral-400 hover:text-brand-blue dark:hover:text-white">
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <div className="flex-1 text-center font-bold text-neutral-700 dark:text-neutral-200 text-xs">
                            {format(referenceDate, 'MMMM yyyy')}
                          </div>
                          <button onClick={() => setReferenceDate(addMonths(referenceDate, 1))} className="w-8 h-8 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-white/10 rounded-full transition-colors active:scale-95 text-neutral-400 hover:text-brand-blue dark:hover:text-white">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      ) : granularity === 'CUSTOM' ? (
                        <div className="flex flex-col gap-2">
                          <AppDatePicker
                            label="Start"
                            value={customRange.start}
                            isOpen={openDatePicker === 'start'}
                            onToggle={() => setOpenDatePicker(prev => prev === 'start' ? null : 'start')}
                            onChange={(val) => setCustomRange(prev => ({ ...prev, start: val }))}
                          />
                          <AppDatePicker
                            label="End"
                            value={customRange.end}
                            isOpen={openDatePicker === 'end'}
                            onToggle={() => setOpenDatePicker(prev => prev === 'end' ? null : 'end')}
                            onChange={(val) => setCustomRange(prev => ({ ...prev, end: val }))}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Transaction Type Filter */}
                  <div>
                    <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-3">
                      <Layers className="w-3.5 h-3.5" /> Flow
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'DEBIT', label: 'Outflow' },
                        { key: 'CREDIT', label: 'Inflow' },
                        { key: 'TRANSFER', label: 'Transfers' }
                      ].map(t => {
                        const isSelected = typeFilter.includes(t.key);
                        return (
                          <button
                            key={t.key}
                            onClick={() => toggleType(t.key)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 border ${isSelected ? 'bg-brand-blue border-brand-blue text-white shadow-md shadow-brand-blue/20' : 'bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10'}`}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Sources: Accounts & Methods */}
                <div className="space-y-6 pt-6 border-t border-neutral-100 dark:border-white/5">
                  {/* Account Filter */}
                  <div>
                    <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-3">
                      <Landmark className="w-3.5 h-3.5" /> Source Accounts
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {accounts.map(acc => {
                        const isSelected = accountFilter.includes(acc.id);
                        return (
                          <button
                            key={acc.id}
                            onClick={() => toggleAccount(acc.id)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 border ${isSelected ? 'bg-brand-blue border-brand-blue text-white shadow-md shadow-brand-blue/20' : 'bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10'}`}
                          >
                            {acc.bankName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div>
                    <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-3">
                      <Smartphone className="w-3.5 h-3.5" /> Payment Medium
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {['Bank', 'UPI', 'Credit Card', 'Cash', 'Bank Transfer', 'Net Banking', 'Wallet'].map(method => {
                        const isSelected = methodFilter.includes(method);
                        return (
                          <button
                            key={method}
                            onClick={() => toggleMethod(method)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 border ${isSelected ? 'bg-brand-blue border-brand-blue text-white shadow-md shadow-brand-blue/20' : 'bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10'}`}
                          >
                            {method}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Classifications: Categories & Tags */}
                <div className="space-y-6 pt-6 border-t border-neutral-100 dark:border-white/5">
                  {/* Tag Filter */}
                  {tags.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-3">
                        <Hash className="w-3.5 h-3.5" /> Tags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {tags.map(tag => {
                          const isSelected = tagFilter.includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() => toggleTag(tag)}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 border flex items-center gap-1 ${isSelected ? 'bg-brand-blue border-brand-blue text-white shadow-md shadow-brand-blue/20' : 'bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10'}`}
                            >
                              <span className="opacity-50">#</span>
                              <span>{tag}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Category Filter */}
                  <div>
                    <h4 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500 mb-3">
                      <TagIcon className="w-3.5 h-3.5" /> Categories
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {appCategories.map(cat => {
                        const isSelected = categoryFilter.includes(cat);
                        return (
                          <button
                            key={cat}
                            onClick={() => toggleCategory(cat)}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all active:scale-95 border flex items-center gap-1.5 ${isSelected ? 'bg-brand-blue border-brand-blue text-white shadow-md shadow-brand-blue/20' : 'bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10'}`}
                          >
                            <span>{CATEGORY_ICONS[cat] || '📝'}</span>
                            <span>{cat}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
</motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
