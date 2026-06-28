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
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

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
// Transaction Statement Sheet
// ═════════════════════════════════════════════════════════════════
function TransactionStatementSheet({ onClose, allAccounts, allTransactions }: {
  onClose: () => void;
  allAccounts: any[];
  allTransactions: Transaction[];
}) {
  const { user } = useAuth();
  const { categories: appCategories } = useCategories();

  // ── UI state ──────────────────────────────────────────────────
  const [selectedAccountId, setSelectedAccountId] = useState<number | 'ALL'>('ALL');
  const [granularity, setGranularity] = useState<'ALL' | 'MONTH' | 'YEAR' | 'CUSTOM'>('MONTH');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customRange, setCustomRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isProcessingPartition, setIsProcessingPartition] = useState(false);
  const [showPartitionSuccess, setShowPartitionSuccess] = useState(false);

  // ── In-sheet filter state ──────────────────────────────────────
  const [filterType, setFilterType] = useState<'ALL' | 'CREDIT' | 'DEBIT' | 'TRANSFER'>('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterSearch, setFilterSearch] = useState('');

  const allClosings = useLiveQuery(() => db.accountClosings.toArray(), [user?.uid]) || [];

  // ── Date limits ───────────────────────────────────────────────
  const { startDateLimit, endDateLimit } = useMemo(() => {
    if (granularity === 'ALL') return { startDateLimit: 0, endDateLimit: Infinity };
    if (granularity === 'MONTH') return {
      startDateLimit: startOfMonth(referenceDate).getTime(),
      endDateLimit: endOfMonth(referenceDate).getTime(),
    };
    if (granularity === 'YEAR') return {
      startDateLimit: startOfYear(referenceDate).getTime(),
      endDateLimit: endOfYear(referenceDate).getTime(),
    };
    return {
      startDateLimit: startOfDay(new Date(customRange.start)).getTime(),
      endDateLimit: endOfDay(new Date(customRange.end)).getTime(),
    };
  }, [granularity, referenceDate, customRange]);

  const navigatePeriod = (dir: -1 | 1) => {
    if (granularity === 'MONTH') setReferenceDate(d => addMonths(d, dir));
    else if (granularity === 'YEAR') setReferenceDate(d => new Date(d.getFullYear() + dir, 0, 1));
  };

  const periodLabel = useMemo(() => {
    if (granularity === 'ALL') return 'All Time';
    if (granularity === 'MONTH') return format(referenceDate, 'MMMM yyyy');
    if (granularity === 'YEAR') return format(referenceDate, 'yyyy');
    return `${customRange.start} → ${customRange.end}`;
  }, [granularity, referenceDate, customRange]);

  // ── Statement data with running balance ───────────────────────
  const statementData = useMemo(() => {
    const accountTxs = allTransactions.filter(tx =>
      selectedAccountId === 'ALL' || Number(tx.accountId) === Number(selectedAccountId)
    );
    const sorted = [...accountTxs].sort((a, b) =>
      new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
    );
    let runningBalance = selectedAccountId === 'ALL'
      ? allAccounts.reduce((s, a) => s + (Number(a.startingBalance) || 0), 0)
      : Number(allAccounts.find(a => a.id === Number(selectedAccountId))?.startingBalance) || 0;

    // Accumulate txns before the view window
    sorted
      .filter(tx => new Date(tx.dateTime).getTime() < startDateLimit)
      .forEach(tx => {
        if (tx.type === 'CREDIT') runningBalance += (Number(tx.amount) || 0);
        else if (tx.type === 'DEBIT') runningBalance -= (Number(tx.amount) || 0);
      });

    const openingBalance = runningBalance;

    // Rows in view window
    const rows = sorted
      .filter(tx => {
        const t = new Date(tx.dateTime).getTime();
        return t >= startDateLimit && t <= endDateLimit;
      })
      .map(tx => {
        const amount = Number(tx.amount) || 0;
        if (tx.type === 'CREDIT') runningBalance += amount;
        else if (tx.type === 'DEBIT') runningBalance -= amount;
        return { ...tx, amount, runningBalance } as Transaction & { runningBalance: number };
      });

    return { rows, openingBalance, closingBalance: runningBalance };
  }, [allTransactions, allAccounts, selectedAccountId, startDateLimit, endDateLimit]);

  // ── Apply in-sheet filters ────────────────────────────────────
  const displayRows = useMemo(() =>
    statementData.rows.filter(tx => {
      if (filterType !== 'ALL' && tx.type !== filterType) return false;
      if (filterCategory !== 'ALL' && tx.category !== filterCategory) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (
          !tx.party?.toLowerCase().includes(q) &&
          !tx.note?.toLowerCase().includes(q) &&
          !tx.category?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    }),
    [statementData.rows, filterType, filterCategory, filterSearch]
  );

  const totalCredit = statementData.rows.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
  const totalDebit  = statementData.rows.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0);
  const activeFiltersCount = [filterType !== 'ALL', filterCategory !== 'ALL', filterSearch !== ''].filter(Boolean).length;

  // ── Live current balance ───────────────────────────────────────
  const actualTotalBalance = useMemo(() => {
    if (selectedAccountId === 'ALL') {
      let bal = allAccounts.reduce((s, a) => s + (Number(a.startingBalance) || 0), 0);
      allTransactions.forEach(tx => {
        if (tx.type === 'CREDIT') bal += (Number(tx.amount) || 0);
        else if (tx.type === 'DEBIT') bal -= (Number(tx.amount) || 0);
      });
      return bal;
    }
    const acc = allAccounts.find(a => a.id === Number(selectedAccountId));
    let bal = Number(acc?.startingBalance) || 0;
    allTransactions
      .filter(tx => Number(tx.accountId) === Number(selectedAccountId))
      .forEach(tx => {
        if (tx.type === 'CREDIT') bal += (Number(tx.amount) || 0);
        else if (tx.type === 'DEBIT') bal -= (Number(tx.amount) || 0);
      });
    return bal;
  }, [selectedAccountId, allAccounts, allTransactions]);

  const selectedAccountLabel = useMemo(() => {
    if (selectedAccountId === 'ALL') return 'All Accounts';
    const acc = allAccounts.find(a => a.id === Number(selectedAccountId));
    return acc ? `${acc.bankName} ···${acc.accountLast4}` : 'Unknown';
  }, [selectedAccountId, allAccounts]);

  const selectedAccount = selectedAccountId !== 'ALL'
    ? allAccounts.find(a => a.id === Number(selectedAccountId)) ?? null
    : null;

  // ── Start New Balance ─────────────────────────────────────────
  const handleStartNewBalance = async () => {
    if (selectedAccountId === 'ALL') return;
    if (!window.confirm('Start a new balance period using the current balance?')) return;
    setIsProcessingPartition(true);
    try {
      const acc = allAccounts.find(a => a.id === Number(selectedAccountId));
      if (!acc) return;
      const accTxs = allTransactions.filter(tx => Number(tx.accountId) === Number(selectedAccountId));
      const sortedAccTxs = [...accTxs].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      const lastTxTime = sortedAccTxs.length > 0
        ? new Date(sortedAccTxs[sortedAccTxs.length - 1].dateTime).getTime()
        : Date.now();
      const partitionTime = Math.max(lastTxTime + 1, Date.now());
      const accClosings = allClosings
        .filter(c => c.accountId === Number(selectedAccountId))
        .sort((a, b) => new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime());
      const lastClosing = accClosings.length > 0 ? accClosings[accClosings.length - 1] : null;
      const startLimit = lastClosing
        ? new Date(lastClosing.closingDate).getTime()
        : acc.startingBalanceDate ? new Date(acc.startingBalanceDate).getTime() : 0;
      const liveTxs = accTxs.filter(tx => new Date(tx.dateTime).getTime() > startLimit);
      const inflow  = liveTxs.filter(t => t.type === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);
      const outflow = liveTxs.filter(t => t.type === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0);
      const opening = lastClosing ? lastClosing.closingBalance : acc.startingBalance;
      await db.accountClosings.add({
        accountId: Number(selectedAccountId),
        closingDate: new Date(partitionTime),
        closingBalance: actualTotalBalance,
        periodName: format(new Date(partitionTime), 'dd MMM yyyy'),
        openingBalance: opening,
        totalInflow: inflow,
        totalOutflow: outflow,
      });
      setShowPartitionSuccess(true);
      setTimeout(() => { setShowPartitionSuccess(false); setIsProcessingPartition(false); }, 1400);
    } catch (err) {
      console.error(err);
      setIsProcessingPartition(false);
    }
  };

  // ── Export PDF ────────────────────────────────────────────────
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setTextColor(26, 35, 126);
    doc.text('TRANSACTION STATEMENT', 14, 18);
    doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(`Account: ${selectedAccountLabel}`, 14, 25);
    doc.text(`Period: ${periodLabel}`, 14, 30);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 35);
    doc.setFontSize(9); doc.setTextColor(50, 50, 50);
    doc.text(`Opening Balance: Rs. ${statementData.openingBalance.toLocaleString()}`, 125, 22);
    doc.text(`Total Inflow:    Rs. ${totalCredit.toLocaleString()}`, 125, 27);
    doc.text(`Total Outflow:   Rs. ${totalDebit.toLocaleString()}`, 125, 32);
    doc.text(`Closing Balance: Rs. ${statementData.closingBalance.toLocaleString()}`, 125, 37);
    autoTable(doc, {
      startY: 42,
      head: [['Date & Time', 'Particulars', 'Remarks / Notes', 'Category', 'Dr/Cr', 'Amount (₹)', 'Balance (₹)']],
      body: displayRows.map(tx => [
        format(new Date(tx.dateTime), 'dd MMM yy\nhh:mm a'),
        (tx.party || 'N/A').toUpperCase(),
        tx.note || '—',
        (tx.category || 'OTHER').toUpperCase(),
        tx.type === 'CREDIT' ? 'CR' : tx.type === 'DEBIT' ? 'DR' : 'TRF',
        tx.amount.toLocaleString(),
        tx.runningBalance.toLocaleString(),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [26, 35, 126], fontSize: 7, fontStyle: 'bold', cellPadding: 2 },
      bodyStyles: { fontSize: 6.5, textColor: [60, 60, 60], cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 22 }, 1: { cellWidth: 28 }, 2: { cellWidth: 40 },
        3: { cellWidth: 22 }, 4: { cellWidth: 10, halign: 'center' },
        5: { cellWidth: 20, halign: 'right' }, 6: { cellWidth: 22, halign: 'right' },
      },
      styles: { overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [248, 249, 255] },
    });
    doc.save(`Statement_${selectedAccountLabel.replace(/\s/g, '_')}_${format(new Date(), 'yyyy_MM_dd')}.pdf`);
    setShowExportMenu(false);
  };

  // ── Export CSV ────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ['Date', 'Time', 'Particulars', 'Remarks', 'Category', 'Dr/Cr', 'Amount', 'Running Balance'];
    const rows = displayRows.map(tx => [
      format(new Date(tx.dateTime), 'yyyy-MM-dd'),
      format(new Date(tx.dateTime), 'HH:mm'),
      `"${(tx.party || 'N/A').toUpperCase()}"`,
      `"${(tx.note || '').replace(/"/g, '""')}"`,
      tx.category || 'OTHER',
      tx.type === 'CREDIT' ? 'CR' : tx.type === 'DEBIT' ? 'DR' : 'TRF',
      tx.amount,
      tx.runningBalance,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Statement_${selectedAccountLabel.replace(/\s/g, '_')}_${periodLabel.replace(/[\s→]/g, '_')}_${format(new Date(), 'dd_MMM_yy')}.csv`;
    a.click();
    setShowExportMenu(false);
  };

  // ── Helpers ───────────────────────────────────────────────────
  const accountTypeIcon = (type?: string) => {
    if (type === 'CASH') return <Wallet className="w-3.5 h-3.5" />;
    if (type === 'CREDIT_CARD') return <CreditCard className="w-3.5 h-3.5" />;
    return <Landmark className="w-3.5 h-3.5" />;
  };
  const typeColor  = (t: string) => t === 'CREDIT' ? 'text-emerald-500' : t === 'TRANSFER' ? 'text-cyan-500' : 'text-rose-500';
  const typeLabel  = (t: string) => t === 'CREDIT' ? 'CR' : t === 'TRANSFER' ? 'TRF' : 'DR';
  const typeSign   = (t: string) => t === 'CREDIT' ? '+' : t === 'TRANSFER' ? '⇄' : '−';
  const typeBadge  = (t: string) =>
    t === 'CREDIT' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
    : t === 'TRANSFER' ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600'
    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-500';

  // ─────────────────────────────────────────────────────────────
  return (
    <Portal>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
        onClick={onClose}
      />

      {/* Sheet — full screen mobile · floating panel desktop */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 260 }}
        className="fixed inset-x-0 bottom-0 top-0 z-[9999] bg-white dark:bg-[#060608] flex flex-col md:inset-y-4 md:right-4 md:left-auto md:w-[480px] md:rounded-[28px] md:shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <div className="bg-white dark:bg-[#0C0C0F] border-b border-neutral-100 dark:border-white/5 px-4 pt-4 pb-3 shrink-0 space-y-3">

          {/* Row 1: Back · Title · Export */}
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-white/10 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/15 transition-all shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-[13px] font-black text-brand-blue dark:text-white uppercase tracking-widest leading-none truncate">
                Transaction Statement
              </h2>
              <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mt-0.5">
                {periodLabel} · {displayRows.length} records
              </p>
            </div>
            {/* Export button */}
            <div className="relative shrink-0">
              <button onClick={() => setShowExportMenu(v => !v)}
                className="w-8 h-8 rounded-full bg-brand-blue text-white flex items-center justify-center shadow-lg shadow-brand-blue/30 active:scale-95 transition-all">
                <Download className="w-3.5 h-3.5" />
              </button>
              <AnimatePresence>
                {showExportMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                    className="absolute top-full right-0 mt-1.5 bg-white dark:bg-[#1C1C1E] border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-20 w-44">
                    <button onClick={handleExportPDF}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border-b border-neutral-100 dark:border-white/5">
                      <FileText className="w-3.5 h-3.5 text-rose-500" /> PDF Statement
                    </button>
                    <button onClick={handleExportCSV}
                      className="w-full flex items-center gap-2.5 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                      <Download className="w-3.5 h-3.5 text-emerald-500" /> CSV Spreadsheet
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Row 2: Account selector */}
          <div className="relative">
            <button onClick={() => setShowAccountDropdown(v => !v)}
              className="w-full flex items-center gap-2.5 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-left active:scale-[0.98] transition-all">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0
                ${selectedAccount?.type === 'CASH' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                : selectedAccount?.type === 'CREDIT_CARD' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500'
                : 'bg-brand-blue/5 dark:bg-white/10 text-brand-blue dark:text-white/70'}`}>
                {accountTypeIcon(selectedAccount?.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[7px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-0.5">Account</p>
                <p className="text-[11px] font-black text-brand-blue dark:text-white truncate">{selectedAccountLabel}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ${showAccountDropdown ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showAccountDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#1C1C1E] border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl z-20 overflow-hidden max-h-56 overflow-y-auto">
                  <button onClick={() => { setSelectedAccountId('ALL'); setShowAccountDropdown(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-wider transition-colors border-b border-neutral-100 dark:border-white/5
                      ${selectedAccountId === 'ALL' ? 'bg-brand-blue/5 text-brand-blue dark:text-white' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-white/5'}`}>
                    <div className="w-6 h-6 rounded-lg bg-neutral-100 dark:bg-white/10 flex items-center justify-center">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    All Accounts
                    {selectedAccountId === 'ALL' && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-brand-blue" />}
                  </button>
                  {allAccounts.map(acc => (
                    <button key={acc.id} onClick={() => { setSelectedAccountId(acc.id!); setShowAccountDropdown(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black uppercase tracking-wider transition-colors border-b border-neutral-100 dark:border-white/5 last:border-0
                        ${Number(selectedAccountId) === acc.id ? 'bg-brand-blue/5 text-brand-blue dark:text-white' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-white/5'}`}>
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center
                        ${acc.type === 'CASH' ? 'bg-emerald-50 text-emerald-600'
                        : acc.type === 'CREDIT_CARD' ? 'bg-rose-50 text-rose-500'
                        : 'bg-blue-50 text-brand-blue'}`}>
                        {accountTypeIcon(acc.type)}
                      </div>
                      <span className="flex-1 text-left truncate">{acc.bankName} ···{acc.accountLast4}</span>
                      {Number(selectedAccountId) === acc.id && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-brand-blue shrink-0" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Row 3: Period pills + Filter toggle */}
          <div className="flex gap-1.5">
            <div className="flex bg-neutral-100 dark:bg-white/5 p-0.5 rounded-xl flex-1">
              {(['ALL', 'MONTH', 'YEAR', 'CUSTOM'] as const).map(g => (
                <button key={g} onClick={() => setGranularity(g)}
                  className={`flex-1 py-1.5 rounded-lg text-[7px] font-black uppercase tracking-wider transition-all
                    ${granularity === g ? 'bg-white dark:bg-white/10 text-brand-blue dark:text-white shadow-sm' : 'text-neutral-400'}`}>
                  {g}
                </button>
              ))}
            </div>
            <button onClick={() => setShowFilters(v => !v)}
              className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-all border
                ${showFilters
                  ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/20'
                  : 'bg-neutral-100 dark:bg-white/5 text-neutral-400 border-transparent'}`}>
              <Filter className="w-3.5 h-3.5" />
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[7px] font-black flex items-center justify-center leading-none">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {/* Period navigator */}
          {(granularity === 'MONTH' || granularity === 'YEAR') && (
            <div className="flex items-center gap-2">
              <button onClick={() => navigatePeriod(-1)}
                className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-neutral-400 hover:bg-neutral-200 transition-all active:scale-95">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center text-[10px] font-black uppercase tracking-widest text-brand-blue dark:text-white">
                {periodLabel}
              </div>
              <button onClick={() => navigatePeriod(1)}
                className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-neutral-400 hover:bg-neutral-200 transition-all active:scale-95">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Custom date pickers */}
          {granularity === 'CUSTOM' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1 mb-1 block">From</label>
                <input type="date" value={customRange.start}
                  onChange={e => setCustomRange(r => ({ ...r, start: e.target.value }))}
                  className="w-full h-9 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-3 text-[11px] font-bold text-brand-blue dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20" />
              </div>
              <div>
                <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1 mb-1 block">To</label>
                <input type="date" value={customRange.end}
                  onChange={e => setCustomRange(r => ({ ...r, end: e.target.value }))}
                  className="w-full h-9 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl px-3 text-[11px] font-bold text-brand-blue dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20" />
              </div>
            </div>
          )}

          {/* ── Inline Filter Panel (animated) ── */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="pt-1 space-y-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                    <input
                      type="text" value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
                      placeholder="Search party, note, category…"
                      className="w-full h-9 bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-xl pl-9 pr-8 text-[11px] font-bold text-brand-blue dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20 placeholder:text-neutral-300 dark:placeholder:text-white/20" />
                    {filterSearch && (
                      <button onClick={() => setFilterSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-300 hover:text-neutral-500">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Type chips */}
                  <div>
                    <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1 mb-1.5 block">Type</label>
                    <div className="flex gap-1.5">
                      {([
                        { val: 'ALL',      label: 'All',   active: 'bg-brand-blue text-white' },
                        { val: 'CREDIT',   label: '↓ IN',  active: 'bg-emerald-500 text-white' },
                        { val: 'DEBIT',    label: '↑ OUT', active: 'bg-rose-500 text-white' },
                        { val: 'TRANSFER', label: '⇄ TRF', active: 'bg-cyan-500 text-white' },
                      ] as const).map(({ val, label, active }) => (
                        <button key={val} onClick={() => setFilterType(val)}
                          className={`flex-1 py-1.5 rounded-xl text-[8px] font-black tracking-wider transition-all active:scale-95
                            ${filterType === val ? active + ' shadow-sm' : 'bg-neutral-100 dark:bg-white/5 text-neutral-400 hover:bg-neutral-200'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category chips (horizontal scroll) */}
                  <div>
                    <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1 mb-1.5 block">Category</label>
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                      {(['ALL', ...appCategories]).map(cat => (
                        <button key={cat} onClick={() => setFilterCategory(cat)}
                          className={`shrink-0 px-3 py-1.5 rounded-xl text-[8px] font-black tracking-wider transition-all active:scale-95 whitespace-nowrap
                            ${filterCategory === cat ? 'bg-brand-blue text-white shadow-sm' : 'bg-neutral-100 dark:bg-white/5 text-neutral-400 hover:bg-neutral-200'}`}>
                          {cat === 'ALL' ? 'All' : cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeFiltersCount > 0 && (
                    <button
                      onClick={() => { setFilterType('ALL'); setFilterCategory('ALL'); setFilterSearch(''); }}
                      className="w-full text-[9px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-wider transition-colors py-0.5">
                      ✕ Clear {activeFiltersCount} active filter{activeFiltersCount > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── 4-column Summary Strip ── */}
          <div className="grid grid-cols-4 gap-1.5">
            {([
              { label: 'Opening', value: statementData.openingBalance, color: 'text-neutral-500 dark:text-white/50' },
              { label: 'Inflow',  value: totalCredit,                  color: 'text-emerald-600' },
              { label: 'Outflow', value: totalDebit,                   color: 'text-rose-500' },
              { label: 'Closing', value: statementData.closingBalance, color: 'text-brand-blue dark:text-white' },
            ] as const).map(({ label, value, color }) => (
              <div key={label} className="bg-neutral-50 dark:bg-white/[0.03] rounded-xl px-1.5 py-2 text-center border border-neutral-100 dark:border-white/5">
                <p className="text-[6px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">{label}</p>
                <p className={`text-[9px] font-black tracking-tight ${color}`}>
                  ₹{Math.abs(value).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* ── New Start Balance ── */}
          <button
            onClick={handleStartNewBalance}
            disabled={isProcessingPartition || showPartitionSuccess || selectedAccountId === 'ALL'}
            title={selectedAccountId === 'ALL' ? 'Select a specific account first' : ''}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-[0.98]
              ${showPartitionSuccess
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : selectedAccountId === 'ALL'
                ? 'bg-neutral-100 dark:bg-white/5 text-neutral-400 cursor-not-allowed'
                : 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
              } disabled:opacity-60`}>
            {isProcessingPartition
              ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Saving Period…</span></>
              : showPartitionSuccess
              ? <><CheckCircle2 className="w-4 h-4" /><span>Period Settled!</span></>
              : <><CheckCircle2 className="w-3.5 h-3.5" />
                  <span>New Start Balance{selectedAccountId === 'ALL' ? ' — Select Account' : ''}</span>
                </>
            }
          </button>
        </div>

        {/* ── MOBILE-FIRST CARD LIST ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>

          {/* Opening balance anchor row */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-brand-blue/[0.03] dark:bg-white/[0.02] border-b border-brand-blue/10 dark:border-white/5">
            <span className="text-[8px] font-black text-brand-blue/50 dark:text-white/30 uppercase tracking-widest">
              {granularity === 'ALL' ? 'System Opening Balance' : `Opening — ${periodLabel}`}
            </span>
            <span className="text-[11px] font-black text-brand-blue/60 dark:text-white/50">
              ₹{statementData.openingBalance.toLocaleString()}
            </span>
          </div>

          {displayRows.length === 0 ? (
            <div className="py-24 flex flex-col items-center justify-center opacity-30">
              <ListOrdered className="w-10 h-10 text-neutral-300 mb-4" />
              <p className="text-[9px] font-black uppercase tracking-widest text-center px-8">
                {statementData.rows.length > 0 ? 'No matches for current filters' : 'No transactions in this period'}
              </p>
            </div>
          ) : (
            <>
              {displayRows.map((tx, idx) => {
                const date = new Date(tx.dateTime);
                const showDayHeader = idx === 0 || !isSameDay(date, new Date(displayRows[idx - 1].dateTime));
                return (
                  <React.Fragment key={tx.id || idx}>
                    {showDayHeader && (
                      <div className="sticky top-0 z-10 bg-neutral-50/95 dark:bg-[#0C0C0F]/95 backdrop-blur-sm px-4 py-1.5 border-b border-neutral-100 dark:border-white/5">
                        <span className="text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                          {format(date, 'EEEE, dd MMM yyyy')}
                        </span>
                      </div>
                    )}

                    {/* Card row */}
                    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-50 dark:border-white/[0.03] hover:bg-neutral-50/60 dark:hover:bg-white/[0.01] active:bg-neutral-100/80 transition-colors">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center text-lg border shrink-0 ${CATEGORY_COLORS[tx.category || 'Other'] || 'bg-neutral-50 border-neutral-100'}`}>
                        {CATEGORY_ICONS[tx.category || 'Other'] || '📝'}
                      </div>

                      {/* Middle: party / note / meta */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-black text-neutral-800 dark:text-white uppercase truncate leading-tight">
                          {tx.party || tx.category || '—'}
                        </p>
                        {tx.note
                          ? <p className="text-[9px] text-neutral-400 dark:text-white/30 italic truncate leading-snug mt-0.5">{tx.note}</p>
                          : <p className="text-[8px] font-bold text-neutral-300 dark:text-white/20 uppercase tracking-wider leading-snug mt-0.5">{tx.category}</p>
                        }
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[7px] font-bold text-neutral-400 uppercase tracking-wider">{format(date, 'hh:mm a')}</span>
                          <span className={`text-[6px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${typeBadge(tx.type)}`}>
                            {typeLabel(tx.type)}
                          </span>
                        </div>
                      </div>

                      {/* Right: amount + running balance */}
                      <div className="text-right shrink-0">
                        <p className={`text-[15px] font-black tracking-tighter leading-none ${typeColor(tx.type)}`}>
                          {typeSign(tx.type)}₹{tx.amount.toLocaleString()}
                        </p>
                        <p className="text-[8px] font-bold text-neutral-400 dark:text-white/30 tracking-tight mt-1">
                          ₹{tx.runningBalance.toLocaleString()}
                        </p>
                        <p className="text-[6px] font-black text-neutral-300 dark:text-white/20 uppercase tracking-wider">bal</p>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Closing balance row */}
              <div className="flex items-center justify-between px-4 py-4 bg-brand-blue/[0.04] dark:bg-white/[0.02] border-t-2 border-brand-blue/10 dark:border-white/10">
                <div>
                  <p className="text-[7px] font-black text-brand-blue/50 dark:text-white/30 uppercase tracking-widest">Closing Balance</p>
                  <p className="text-[8px] font-bold text-neutral-400 mt-0.5">{periodLabel}</p>
                </div>
                <div className="text-right">
                  <p className="text-[20px] font-black text-brand-blue dark:text-white tracking-tighter leading-none">
                    ₹{statementData.closingBalance.toLocaleString()}
                  </p>
                  <p className="text-[8px] font-bold text-neutral-400 mt-0.5">
                    <span className="text-emerald-500">+₹{totalCredit.toLocaleString()}</span>
                    {' / '}
                    <span className="text-rose-500">−₹{totalDebit.toLocaleString()}</span>
                  </p>
                </div>
              </div>
            </>
          )}
          <div className="h-10" />
        </div>
      </motion.div>
    </Portal>
  );
}

// ═════════════════════════════════════════════════════════════════
// Main Transactions Screen
// ═════════════════════════════════════════════════════════════════
export default function Transactions() {
  const { user } = useAuth();
  const { categories: appCategories } = useCategories();
  const { tags } = useTags();
  const navigate = useNavigate();

  // ── View ──────────────────────────────────────────────────────
  const [granularity, setGranularity] = useState<'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM'>('ALL');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customRange, setCustomRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  // ── Filters ───────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT' | 'TRANSFER'>('ALL');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'ALL' | 'BANK' | 'CREDIT_CARD' | 'CASH'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState<number | 'ALL'>('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // ── Statement sheet ───────────────────────────────────────────
  const [showStatementSheet, setShowStatementSheet] = useState(false);

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

  const allTransactionsForStatement = useLiveQuery(() => db.transactions.toArray(), [user?.uid]) || [];
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
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!tx.note?.toLowerCase().includes(q) && !tx.party?.toLowerCase().includes(q) && !tx.category?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [currentTxs, sourceTypeFilter, typeFilter, categoryFilter, accountFilter, tagFilter, methodFilter, searchTerm, accounts]);

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
        <button
          onClick={() => setShowStatementSheet(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90 transition-all active:scale-95 text-[9px] font-black uppercase tracking-wider shadow-lg shadow-brand-blue/20">
          <BookOpen className="w-3.5 h-3.5" />
          <span>Statement</span>
        </button>
      </div>

      {/* Summary strip */}
      <div className="bg-white dark:bg-[#0C0C0F] p-2 rounded-[18px] border border-neutral-100 dark:border-white/5 shadow-sm flex items-center justify-center gap-6">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-emerald-50 dark:bg-emerald-500/10 rounded-md flex items-center justify-center text-emerald-600">
            <ArrowDownLeft className="w-3 h-3" />
          </div>
          <div>
            <p className="text-[6px] font-black text-neutral-400 dark:text-white/40 uppercase tracking-[0.1em] leading-none">Inflow</p>
            <h3 className="text-xs font-heading font-black text-emerald-600 tracking-tight">₹{totals.income.toLocaleString()}</h3>
          </div>
        </div>
        <div className="w-px h-4 bg-neutral-100 dark:bg-white/5" />
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 bg-rose-50 dark:bg-rose-500/10 rounded-md flex items-center justify-center text-rose-600">
            <ArrowUpRight className="w-3 h-3" />
          </div>
          <div>
            <p className="text-[6px] font-black text-neutral-400 dark:text-white/40 uppercase tracking-[0.1em] leading-none">Outflow</p>
            <h3 className="text-xs font-heading font-black text-rose-600 tracking-tight">₹{totals.expense.toLocaleString()}</h3>
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
                    {tx.type === 'DEBIT' ? '−' : tx.type === 'TRANSFER' ? '⇄' : '+'}₹{Number(tx.amount).toLocaleString()}
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

      {/* Statement Sheet */}
      <AnimatePresence>
        {showStatementSheet && (
          <TransactionStatementSheet
            onClose={() => setShowStatementSheet(false)}
            allAccounts={accounts}
            allTransactions={allTransactionsForStatement}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
