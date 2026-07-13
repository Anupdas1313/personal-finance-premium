import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../models/db';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, addMonths, subMonths, startOfYear, endOfYear, isSameDay } from 'date-fns';
import {
  X, Trash2, Filter, Search, Edit3, Download, FileText,
  ChevronLeft, ChevronRight, ListOrdered, ArrowDownLeft, ArrowUpRight,
  Layers, Tag as TagIcon, Landmark, Smartphone,
  BookOpen, CheckCircle2, ChevronDown, Wallet, CreditCard
} from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../hooks/useCurrency';

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

  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || 'ALL';
  const initialSearch = searchParams.get('search') || '';
  const initialGranularity = (searchParams.get('granularity') as 'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM') || 'ALL';
  
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
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT' | 'TRANSFER'>('ALL');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'ALL' | 'BANK' | 'CREDIT_CARD' | 'CASH'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [accountFilter, setAccountFilter] = useState<number | 'ALL'>('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // ── Detail drawer ─────────────────────────────────────────────
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Data ──────────────────────────────────────────────────────
  const accounts = useLiveQuery(() => db.accounts.toArray(), [user?.uid]) || [];

  const dateLimits = useMemo(() => {
    let start: Date | number = 0;
    let end: Date | number = new Date(8640000000000000);
    if (granularity === 'MONTH') { start = startOfMonth(referenceDate); end = endOfMonth(referenceDate); }
    else if (granularity === 'YEAR') { start = startOfYear(referenceDate); end = endOfYear(referenceDate); }
    else if (granularity === 'CUSTOM') { start = startOfDay(new Date(customRange.start)); end = endOfDay(new Date(customRange.end)); }
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
      if (tagFilter !== 'ALL' && tx.expenseType !== tagFilter) return false;
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
  }, [currentTxs, sourceTypeFilter, typeFilter, categoryFilter, accountFilter, tagFilter, methodFilter, searchTerm, accounts, searchParams]);

  const totals = useMemo(() =>
    filteredTxs.reduce((acc, tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'CREDIT') acc.income += amt; else acc.expense += amt;
      return acc;
    }, { income: 0, expense: 0 }),
    [filteredTxs]
  );

  const deleteTransaction = async (id: number) => {
    if (!window.confirm('Permanently remove this financial record?')) return;
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
          <h1 className="text-xl font-heading font-black text-brand-blue dark:text-white tracking-tight leading-none">Transactions</h1>
          <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-0.5">Activity History</p>
        </div>
      </div>

      {/* Summary strip */}
      <div className="bg-white dark:bg-[#0C0C0F] p-2 rounded-[18px] border border-neutral-100 dark:border-white/5 shadow-sm flex items-center justify-center gap-6">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-emerald-50 dark:bg-emerald-500/10 rounded-md flex items-center justify-center text-emerald-600">
            <ArrowDownLeft className="w-3 h-3" />
          </div>
          <div>
            <p className="text-[6px] font-black text-neutral-400 dark:text-white/40 uppercase tracking-[0.1em] leading-none">Inflow</p>
            <h3 className="text-xs font-heading font-black text-emerald-600 tracking-tight">{currency}{totals.income.toLocaleString()}</h3>
          </div>
        </div>
        <div className="w-px h-4 bg-neutral-100 dark:bg-white/5" />
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-rose-50 dark:bg-rose-500/10 rounded-md flex items-center justify-center text-rose-600">
            <ArrowUpRight className="w-3 h-3" />
          </div>
          <div>
            <p className="text-[6px] font-black text-neutral-400 dark:text-white/40 uppercase tracking-[0.1em] leading-none">Outflow</p>
            <h3 className="text-xs font-heading font-black text-rose-600 tracking-tight">{currency}{totals.expense.toLocaleString()}</h3>
          </div>
        </div>
      </div>

      {/* Navigation + Filter bar */}
      <div className="sticky top-2 z-40 space-y-1.5 pointer-events-none pb-1">
        <div className="pointer-events-auto bg-white/90 dark:bg-[#060608]/90 backdrop-blur-xl p-1 rounded-[16px] border border-neutral-200 dark:border-white/10 shadow-lg flex flex-col md:flex-row gap-1.5">
          <div className="flex bg-neutral-100 dark:bg-white/5 p-0.5 rounded-lg overflow-x-auto scrollbar-hide shrink-0">
            {(['MONTH', 'YEAR', 'ALL', 'CUSTOM'] as const).map(g => (
              <button key={g} onClick={() => setGranularity(g)}
                className={`px-2.5 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                  ${granularity === g ? 'bg-white dark:bg-[#333] text-brand-blue dark:text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-500'}`}>
                {g}
              </button>
            ))}
          </div>
          <div className="flex-1 flex gap-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
              <input type="text" placeholder="Search…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-7 bg-transparent border border-transparent focus:border-neutral-100 dark:focus:border-white/5 pl-7 pr-2 rounded-lg text-[9px] font-bold text-brand-blue dark:text-white outline-none transition-all" />
            </div>
            <button onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`px-2.5 h-7 rounded-lg flex items-center justify-center border transition-all
                ${isFilterOpen ? 'bg-brand-blue text-white border-brand-blue' : 'bg-transparent border-transparent text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/5'}`}>
              <Filter className="w-3 h-3" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {granularity === 'MONTH' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="pointer-events-auto max-w-[200px] mx-auto">
              <div className="flex items-center gap-3 bg-white dark:bg-[#111] p-1.5 rounded-2xl border border-neutral-200 dark:border-white/5 shadow-sm">
                <button onClick={() => setReferenceDate(subMonths(referenceDate, 1))} className="p-2 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-xl transition-all">
                  <ChevronLeft className="w-5 h-5 text-neutral-500" />
                </button>
                <div className="flex-1 text-center font-heading font-black text-brand-blue dark:text-white uppercase tracking-widest text-[10px]">
                  {format(referenceDate, 'MMMM yyyy')}
                </div>
                <button onClick={() => setReferenceDate(addMonths(referenceDate, 1))} className="p-2 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-xl transition-all">
                  <ChevronRight className="w-5 h-5 text-neutral-500" />
                </button>
              </div>
            </motion.div>
          )}

          {isFilterOpen && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
              className="pointer-events-auto bg-white dark:bg-[#111] p-4 rounded-[24px] border border-neutral-200 dark:border-white/10 shadow-2xl space-y-3">

              {/* Source type */}
              <div className="space-y-1">
                <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">Source Type</label>
                <div className="flex bg-neutral-50 dark:bg-black/20 p-1 rounded-lg">
                  {(['ALL', 'BANK', 'CREDIT_CARD', 'CASH'] as const).map(t => (
                    <button key={t} onClick={() => { setSourceTypeFilter(t); setAccountFilter('ALL'); setMethodFilter('ALL'); }}
                      className={`flex-1 py-1 rounded-md text-[8px] font-black tracking-widest transition-all
                        ${sourceTypeFilter === t ? 'bg-white dark:bg-white/10 shadow-sm text-brand-blue dark:text-white' : 'text-neutral-400'}`}>
                      {t === 'CREDIT_CARD' ? 'CC' : t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Flow */}
              <div className="space-y-1">
                <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">Flow</label>
                <div className="flex bg-neutral-50 dark:bg-black/20 p-1 rounded-lg">
                  {(['ALL', 'DEBIT', 'CREDIT', 'TRANSFER'] as const).map(t => (
                    <button key={t} onClick={() => setTypeFilter(t)}
                      className={`flex-1 py-1 rounded-md text-[8px] font-black tracking-widest transition-all
                        ${typeFilter === t ? 'bg-white dark:bg-white/10 shadow-sm text-brand-blue dark:text-white' : 'text-neutral-400'}`}>
                      {t === 'DEBIT' ? 'OUT' : t === 'CREDIT' ? 'IN' : t === 'TRANSFER' ? 'TRF' : 'ALL'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">Category</label>
                  <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                    className="w-full h-8 bg-neutral-50 dark:bg-black/20 border border-neutral-100 dark:border-white/5 px-2 rounded-lg text-[10px] font-bold text-brand-blue dark:text-white outline-none appearance-none">
                    <option value="ALL">All Categories</option>
                    {appCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">Tag</label>
                  <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
                    className="w-full h-8 bg-neutral-50 dark:bg-black/20 border border-neutral-100 dark:border-white/5 px-2 rounded-lg text-[10px] font-bold text-brand-blue dark:text-white outline-none appearance-none">
                    <option value="ALL">All Tags</option>
                    {tags.map(t => <option key={t} value={t}>#{t}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">Account</label>
                  <select value={accountFilter} onChange={e => setAccountFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                    className="w-full h-8 bg-neutral-50 dark:bg-black/20 border border-neutral-100 dark:border-white/5 px-2 rounded-lg text-[10px] font-bold text-brand-blue dark:text-white outline-none appearance-none">
                    <option value="ALL">All Accounts</option>
                    {accounts.filter(a => sourceTypeFilter === 'ALL' || a.type === sourceTypeFilter).map(a => (
                      <option key={a.id} value={a.id}>{a.bankName} (..{a.accountLast4})</option>
                    ))}
                  </select>
                </div>
                {sourceTypeFilter !== 'CREDIT_CARD' && sourceTypeFilter !== 'CASH' && (
                  <div className="space-y-1">
                    <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">Method</label>
                    <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)}
                      className="w-full h-8 bg-neutral-50 dark:bg-black/20 border border-neutral-100 dark:border-white/5 px-2 rounded-lg text-[10px] font-bold text-brand-blue dark:text-white outline-none appearance-none">
                      <option value="ALL">All Methods</option>
                      {['Bank Transfer', 'UPI', 'GPay', 'PhonePe', 'Paytm', 'Amazon Pay', 'CRED', 'BHIM'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <button onClick={() => { setSourceTypeFilter('ALL'); setTypeFilter('ALL'); setCategoryFilter('ALL'); setAccountFilter('ALL'); setTagFilter('ALL'); setMethodFilter('ALL'); }}
                  className="text-[10px] font-bold text-rose-500/80 hover:text-rose-500 transition-colors">
                  Clear Filters
                </button>
                <button onClick={() => setIsFilterOpen(false)}
                  className="px-4 py-1.5 bg-brand-blue dark:bg-white/10 text-white rounded-lg text-[10px] font-bold active:scale-95 transition-all shadow-md">
                  Apply
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
                  <div className="pt-4 flex items-center gap-3">
                    <span className="text-[8px] font-black text-neutral-400 dark:text-white/30 uppercase tracking-[0.2em] whitespace-nowrap">
                      {format(date, 'EEEE, dd MMM yyyy')}
                    </span>
                    <div className="h-px flex-1 bg-neutral-100 dark:bg-white/5" />
                  </div>
                )}
                <motion.div
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedTx(tx)}
                  className="bg-white dark:bg-[#0C0C0F] hover:bg-neutral-50 dark:hover:bg-white/5 border border-neutral-100 dark:border-white/5 p-3 rounded-[20px] shadow-sm flex items-center gap-3 transition-all cursor-pointer active:shadow-inner pointer-events-auto">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border ${CATEGORY_COLORS[tx.category || 'Other'] || 'bg-neutral-50'} shrink-0`}>
                    {CATEGORY_ICONS[tx.category || 'Other'] || '📝'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black text-brand-blue dark:text-white truncate uppercase tracking-tight leading-tight mb-0.5">
                      {tx.party || tx.category || 'Record'}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[7px] font-bold text-neutral-400 tracking-widest uppercase">{format(date, 'hh:mm a')}</span>
                      <div className="w-0.5 h-0.5 rounded-full bg-neutral-200" />
                      <span className="text-[7px] font-black text-brand-blue/30 dark:text-white/20 tracking-widest uppercase">{tx.category}</span>
                    </div>
                  </div>
                  <p className={`text-base font-heading font-black tracking-tighter ${tx.type === 'DEBIT' ? 'text-rose-500' : tx.type === 'TRANSFER' ? 'text-cyan-500' : 'text-emerald-500'}`}>
                    {tx.type === 'DEBIT' ? '−' : tx.type === 'TRANSFER' ? '⇄' : '+'}{currency}{Number(tx.amount).toLocaleString()}
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
                    <span className="text-[7px] font-black text-brand-blue/40 dark:text-white/30 uppercase tracking-widest block mb-1">{selectedTx.category} Ledger</span>
                    <h2 className="text-xl font-heading font-black text-brand-blue dark:text-white uppercase tracking-tight">{selectedTx.party || 'Statement Entry'}</h2>
                    <p className="text-[8px] font-bold text-neutral-400 mt-0.5 uppercase tracking-widest">{format(new Date(selectedTx.dateTime), 'dd MMM yyyy, hh:mm a')}</p>
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
                    value: selectedTx.type === 'CREDIT' ? '↓ Inflow' : selectedTx.type === 'TRANSFER' ? '⇄ Transfer' : '↑ Outflow',
                    color: selectedTx.type === 'CREDIT' ? 'text-emerald-500' : selectedTx.type === 'TRANSFER' ? 'text-cyan-500' : 'text-rose-500' },
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
