import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction, normalizeType } from '../models/db';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, addMonths, subMonths, startOfYear, endOfYear, isSameDay } from 'date-fns';
import { X, Trash2, Filter, Search, Edit3, Download, FileText, Plus,
  ChevronLeft, ChevronRight, ListOrdered, ArrowDownLeft, ArrowUpRight,
  Layers, Tag as TagIcon, Landmark, Smartphone,
  BookOpen, CheckCircle2, ChevronDown, Wallet, CreditCard,

} from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../hooks/useCurrency';
import { useToast } from '../context/ToastContext';

// ─── Category appearance maps ─────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  'Food': '🍔', 'Transport': '🚗', 'Rent': '🏠', 'Shopping': '🛍️',
  'Bills': '⚡', 'Entertainment': '🎬', 'Salary': '💰', 'Transfer': '💸', 'Other': '📝'
};
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
  const [granularity, setGranularity] = useState<'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM'>(initialGranularity);
  const [referenceDate, setReferenceDate] = useState(initialDate);
  const [customRange, setCustomRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  // ── Filters ───────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const initialType = (searchParams.get('type') as any) || 'ALL';
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT' | 'TRANSFER'>(initialType);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'ALL' | 'BANK' | 'CREDIT_CARD' | 'CASH'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const initialTag = searchParams.get('tag') || 'ALL';
  const initialAccount = searchParams.has('account') ? Number(searchParams.get('account')) : 'ALL';
  const initialMethod = searchParams.get('method') || 'ALL';

  const [accountFilter, setAccountFilter] = useState<number | 'ALL'>(initialAccount);
  const [tagFilter, setTagFilter] = useState(initialTag);
  const [methodFilter, setMethodFilter] = useState(initialMethod);
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

  const dateLimits = useMemo(() => {
    let start: Date | number = 0;
    let end: Date | number = new Date(8640000000000000);
    if (granularity === 'MONTH') { start = startOfMonth(referenceDate); end = endOfMonth(referenceDate); }
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
      if (sourceTypeFilter !== 'ALL' && txSourceType !== sourceTypeFilter) return false;
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) return false;
      if (accountFilter !== 'ALL' && Number(tx.accountId) !== Number(accountFilter)) return false;
      if (tagFilter !== 'ALL' && (tx.expenseType || '').toLowerCase() !== tagFilter.toLowerCase()) return false;
      if (methodFilter !== 'ALL' && tx.paymentMethod !== methodFilter && (tx as any).upiApp !== methodFilter) return false;
      
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
  }, [currentTxs, sourceTypeFilter, typeFilter, categoryFilter, accountFilter, tagFilter, methodFilter, searchTerm, accounts, searchParams, sortConfig]);

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

          {/* + Filter Add Button */}
          <div className="relative">
            <button
              onClick={() => togglePopover('addFilter')}
              className="h-8 px-2.5 bg-neutral-100/60 dark:bg-white/5 hover:bg-neutral-200/50 dark:hover:bg-white/10 border border-transparent rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {/* Add Filter Popover Menu */}
            <AnimatePresence>
              {activePopover === 'addFilter' && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 5 }}
                    className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5"
                  >
                    <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-neutral-400">Add filter by</div>
                    {[
                      { key: 'category', label: 'Category', icon: '🏷️' },
                      { key: 'type', label: 'Flow (In/Out)', icon: '⇄' },
                      { key: 'account', label: 'Account', icon: '🏦' },
                      { key: 'tag', label: 'Tag', icon: '🔖' },
                      { key: 'granularity', label: 'Timeline', icon: '📅' },
                    ].map(prop => (
                      <button
                        key={prop.key}
                        onClick={() => {
                          setActivePopover(null);
                          if (prop.key === 'category' && categoryFilter === 'ALL') setCategoryFilter(appCategories[0] || 'Food');
                          if (prop.key === 'type' && typeFilter === 'ALL') setTypeFilter('DEBIT');
                          if (prop.key === 'account' && accountFilter === 'ALL' && accounts.length > 0) setAccountFilter(accounts[0].id);
                          if (prop.key === 'tag' && tagFilter === 'ALL' && tags.length > 0) setTagFilter(tags[0]);
                          if (prop.key === 'granularity' && granularity === 'ALL') setGranularity('MONTH');
                          setActivePopover(prop.key);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 flex items-center gap-2 transition-all"
                      >
                        <span className="text-xs">{prop.icon}</span>
                        <span>{prop.label}</span>
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

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

        {/* Active Notion-style Filter Badges (Pills) */}
        {(categoryFilter !== 'ALL' || typeFilter !== 'ALL' || accountFilter !== 'ALL' || tagFilter !== 'ALL' || granularity !== 'ALL') && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {/* Category Filter Pill */}
            {categoryFilter !== 'ALL' && (
              <div className="relative">
                <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-neutral-100 dark:bg-white/10 border border-neutral-200/60 dark:border-white/10 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  <button onClick={() => togglePopover('category')} className="flex items-center gap-1 hover:opacity-80">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Category is</span>
                    <span className="font-bold">{categoryFilter}</span>
                    <ChevronDown className="w-3 h-3 text-neutral-400" />
                  </button>
                  <button onClick={() => setCategoryFilter('ALL')} className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-md transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <AnimatePresence>
                  {activePopover === 'category' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 mt-1.5 w-48 max-h-56 overflow-y-auto bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5">
                        {appCategories.map(c => (
                          <button key={c} onClick={() => { setCategoryFilter(c); setActivePopover(null); }}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between ${categoryFilter === c ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-200'}`}>
                            <span>{c}</span>
                            {categoryFilter === c && <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue dark:text-white" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Flow Filter Pill */}
            {typeFilter !== 'ALL' && (
              <div className="relative">
                <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-neutral-100 dark:bg-white/10 border border-neutral-200/60 dark:border-white/10 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  <button onClick={() => togglePopover('type')} className="flex items-center gap-1 hover:opacity-80">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Flow is</span>
                    <span className="font-bold">{typeFilter === 'DEBIT' ? 'Outflow' : typeFilter === 'CREDIT' ? 'Inflow' : 'Transfer'}</span>
                    <ChevronDown className="w-3 h-3 text-neutral-400" />
                  </button>
                  <button onClick={() => setTypeFilter('ALL')} className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-md transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <AnimatePresence>
                  {activePopover === 'type' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 mt-1.5 w-44 bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5">
                        {[
                          { label: 'Outflow (Debit)', val: 'DEBIT' },
                          { label: 'Inflow (Credit)', val: 'CREDIT' },
                          { label: 'Inter-Account', val: 'TRANSFER' }
                        ].map(opt => (
                          <button key={opt.val} onClick={() => { setTypeFilter(opt.val as any); setActivePopover(null); }}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between ${typeFilter === opt.val ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-200'}`}>
                            <span>{opt.label}</span>
                            {typeFilter === opt.val && <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue dark:text-white" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Account Filter Pill */}
            {accountFilter !== 'ALL' && (
              <div className="relative">
                <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-neutral-100 dark:bg-white/10 border border-neutral-200/60 dark:border-white/10 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  <button onClick={() => togglePopover('account')} className="flex items-center gap-1 hover:opacity-80">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Account is</span>
                    <span className="font-bold">{accounts.find(a => a.id === Number(accountFilter))?.bankName || accountFilter}</span>
                    <ChevronDown className="w-3 h-3 text-neutral-400" />
                  </button>
                  <button onClick={() => setAccountFilter('ALL')} className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-md transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <AnimatePresence>
                  {activePopover === 'account' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 mt-1.5 w-52 max-h-56 overflow-y-auto bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5">
                        {accounts.map(acc => (
                          <button key={acc.id} onClick={() => { setAccountFilter(acc.id); setActivePopover(null); }}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between ${accountFilter === acc.id ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-200'}`}>
                            <span className="truncate">{acc.bankName}</span>
                            {accountFilter === acc.id && <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue dark:text-white" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Tag Filter Pill */}
            {tagFilter !== 'ALL' && (
              <div className="relative">
                <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-neutral-100 dark:bg-white/10 border border-neutral-200/60 dark:border-white/10 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  <button onClick={() => togglePopover('tag')} className="flex items-center gap-1 hover:opacity-80">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Tag is</span>
                    <span className="font-bold">#{tagFilter}</span>
                    <ChevronDown className="w-3 h-3 text-neutral-400" />
                  </button>
                  <button onClick={() => setTagFilter('ALL')} className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-md transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <AnimatePresence>
                  {activePopover === 'tag' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 mt-1.5 w-48 max-h-56 overflow-y-auto bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5">
                        {tags.map(t => (
                          <button key={t} onClick={() => { setTagFilter(t); setActivePopover(null); }}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between ${tagFilter === t ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-200'}`}>
                            <span>#{t}</span>
                            {tagFilter === t && <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue dark:text-white" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Timeline Granularity Pill */}
            {granularity !== 'ALL' && (
              <div className="relative">
                <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-neutral-100 dark:bg-white/10 border border-neutral-200/60 dark:border-white/10 rounded-xl text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  <button onClick={() => togglePopover('granularity')} className="flex items-center gap-1 hover:opacity-80">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Time is</span>
                    <span className="font-bold">{granularity}</span>
                    <ChevronDown className="w-3 h-3 text-neutral-400" />
                  </button>
                  <button onClick={() => setGranularity('ALL')} className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-md transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <AnimatePresence>
                  {activePopover === 'granularity' && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                        className="absolute left-0 mt-1.5 w-44 bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5">
                        {(['MONTH', 'YEAR', 'ALL', 'CUSTOM'] as const).map(g => (
                          <button key={g} onClick={() => { setGranularity(g); setActivePopover(null); }}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between ${granularity === g ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-200'}`}>
                            <span>{g}</span>
                            {granularity === g && <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue dark:text-white" />}
                          </button>
                        ))}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Clear All Text Button */}
            <button
              onClick={() => {
                setCategoryFilter('ALL');
                setTypeFilter('ALL');
                setAccountFilter('ALL');
                setTagFilter('ALL');
                setGranularity('ALL');
              }}
              className="text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:underline uppercase tracking-wider ml-1"
            >
              Clear All
            </button>
          </div>
        )}
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
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${CATEGORY_COLORS[tx.category || 'Other'] || 'bg-neutral-50'} shrink-0`}>
                    {CATEGORY_ICONS[tx.category || 'Other'] || '📝'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-semibold text-brand-blue dark:text-white truncate leading-tight mb-0.5">
                      {tx.party || tx.category || 'Record'}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-neutral-400">{format(date, 'hh:mm a')}</span>
                      <div className="w-1 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                      <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">{tx.category}</span>
                    </div>
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



    </motion.div>
  );
}
