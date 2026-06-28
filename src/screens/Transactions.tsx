import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../models/db';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths, addMonths, startOfYear, endOfYear, isSameDay, startOfWeek, endOfWeek, subWeeks, addWeeks, subDays, addDays, subYears, addYears } from 'date-fns';
import { 
  X, Trash2, Filter, Search, Edit3, Download, FileText,
  ChevronLeft, ChevronRight, ListOrdered, ArrowDownLeft, ArrowUpRight, BarChart3,
  Calendar, Layers, Tag as TagIcon, MoreVertical, Landmark, Smartphone,
  BookOpen, CheckCircle2, ChevronDown, Wallet, CreditCard
} from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const CATEGORY_ICONS: Record<string, string> = {
  'Food': '🍔',
  'Transport': '🚗',
  'Rent': '🏠',
  'Shopping': '🛍️',
  'Bills': '⚡',
  'Entertainment': '🎬',
  'Salary': '💰',
  'Transfer': '💸',
  'Other': '📝'
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

// Helper for Portals
const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return createPortal(children, document.body);
};

// ─────────────────────────────────────────────────────────────────
// Transaction Statement Sheet
// ─────────────────────────────────────────────────────────────────
function TransactionStatementSheet({ onClose, allAccounts, allTransactions }: {
  onClose: () => void;
  allAccounts: any[];
  allTransactions: Transaction[];
}) {
  const { user } = useAuth();
  const [selectedAccountId, setSelectedAccountId] = useState<number | 'ALL'>('ALL');
  const [granularity, setGranularity] = useState<'ALL' | 'MONTH' | 'YEAR' | 'CUSTOM'>('MONTH');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customRange, setCustomRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isProcessingPartition, setIsProcessingPartition] = useState(false);
  const [showPartitionSuccess, setShowPartitionSuccess] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  const allClosings = useLiveQuery(() => db.accountClosings.toArray(), [user?.uid]) || [];

  // Date limits for the selected period
  const { startDateLimit, endDateLimit } = useMemo(() => {
    if (granularity === 'ALL') return { startDateLimit: 0, endDateLimit: Infinity };
    const d = referenceDate;
    if (granularity === 'MONTH') return { startDateLimit: startOfMonth(d).getTime(), endDateLimit: endOfMonth(d).getTime() };
    if (granularity === 'YEAR') return { startDateLimit: startOfYear(d).getTime(), endDateLimit: endOfYear(d).getTime() };
    if (granularity === 'CUSTOM') return {
      startDateLimit: startOfDay(new Date(customRange.start)).getTime(),
      endDateLimit: endOfDay(new Date(customRange.end)).getTime()
    };
    return { startDateLimit: 0, endDateLimit: Infinity };
  }, [granularity, referenceDate, customRange]);

  // Navigate period
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

  // Filter transactions by account and period
  const accountTxs = useMemo(() => {
    return allTransactions.filter(tx => {
      if (selectedAccountId !== 'ALL' && Number(tx.accountId) !== Number(selectedAccountId)) return false;
      return true;
    });
  }, [allTransactions, selectedAccountId]);

  // Compute statement data with running balance
  const statementData = useMemo(() => {
    const sorted = [...accountTxs].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

    // Compute starting balance
    let runningBalance = 0;
    if (selectedAccountId === 'ALL') {
      allAccounts.forEach(acc => { runningBalance += (Number(acc.startingBalance) || 0); });
    } else {
      const acc = allAccounts.find(a => a.id === Number(selectedAccountId));
      runningBalance = Number(acc?.startingBalance) || 0;
    }

    // Add all txs before the view window
    const txsBefore = sorted.filter(tx => new Date(tx.dateTime).getTime() < startDateLimit);
    txsBefore.forEach(tx => {
      if (tx.type === 'CREDIT') runningBalance += (Number(tx.amount) || 0);
      else if (tx.type === 'DEBIT') runningBalance -= (Number(tx.amount) || 0);
    });

    const openingBalance = runningBalance;

    // Now compute rows for the view window
    const txsInView = sorted.filter(tx => {
      const t = new Date(tx.dateTime).getTime();
      return t >= startDateLimit && t <= endDateLimit;
    });

    const rows = txsInView.map(tx => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'CREDIT') runningBalance += amount;
      else if (tx.type === 'DEBIT') runningBalance -= amount;
      return { ...tx, amount, runningBalance } as Transaction & { runningBalance: number };
    });

    return { rows, openingBalance, closingBalance: runningBalance };
  }, [accountTxs, allAccounts, selectedAccountId, startDateLimit, endDateLimit]);

  const totalCredit = statementData.rows.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
  const totalDebit = statementData.rows.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0);

  // Actual total balance for selected account(s)
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
    allTransactions.filter(tx => Number(tx.accountId) === Number(selectedAccountId)).forEach(tx => {
      if (tx.type === 'CREDIT') bal += (Number(tx.amount) || 0);
      else if (tx.type === 'DEBIT') bal -= (Number(tx.amount) || 0);
    });
    return bal;
  }, [selectedAccountId, allAccounts, allTransactions]);

  // Selected account label
  const selectedAccountLabel = useMemo(() => {
    if (selectedAccountId === 'ALL') return 'All Accounts';
    const acc = allAccounts.find(a => a.id === Number(selectedAccountId));
    return acc ? `${acc.bankName} ···${acc.accountLast4}` : 'Unknown';
  }, [selectedAccountId, allAccounts]);

  // Start New Balance
  const handleStartNewBalance = async () => {
    if (selectedAccountId === 'ALL') return;
    const confirmReset = window.confirm('Start a new balance period using the current balance?');
    if (!confirmReset) return;
    setIsProcessingPartition(true);
    try {
      const acc = allAccounts.find(a => a.id === Number(selectedAccountId));
      if (!acc) return;
      const accTxs = allTransactions.filter(tx => Number(tx.accountId) === Number(selectedAccountId));
      const sortedAccTxs = [...accTxs].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      const lastTxTime = sortedAccTxs.length > 0 ? new Date(sortedAccTxs[sortedAccTxs.length - 1].dateTime).getTime() : Date.now();
      const partitionTime = Math.max(lastTxTime + 1, Date.now());
      const accClosings = allClosings.filter(c => c.accountId === Number(selectedAccountId)).sort((a, b) => new Date(a.closingDate).getTime() - new Date(b.closingDate).getTime());
      const lastClosing = accClosings.length > 0 ? accClosings[accClosings.length - 1] : null;
      const startLimit = lastClosing ? new Date(lastClosing.closingDate).getTime() : (acc.startingBalanceDate ? new Date(acc.startingBalanceDate).getTime() : 0);
      const liveTxs = accTxs.filter(tx => new Date(tx.dateTime).getTime() > startLimit);
      const inflow = liveTxs.filter(t => t.type === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);
      const outflow = liveTxs.filter(t => t.type === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0);
      const opening = lastClosing ? lastClosing.closingBalance : acc.startingBalance;
      await db.accountClosings.add({
        accountId: Number(selectedAccountId),
        closingDate: new Date(partitionTime),
        closingBalance: actualTotalBalance,
        periodName: format(new Date(partitionTime), 'dd MMM yyyy'),
        openingBalance: opening,
        totalInflow: inflow,
        totalOutflow: outflow
      });
      setShowPartitionSuccess(true);
      setTimeout(() => { setShowPartitionSuccess(false); setIsProcessingPartition(false); }, 1200);
    } catch (err) {
      console.error(err);
      setIsProcessingPartition(false);
    }
  };

  // Export PDF
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const accLabel = selectedAccountLabel;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(26, 35, 126);
    doc.text('TRANSACTION STATEMENT', 14, 18);

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Account: ${accLabel}`, 14, 25);
    doc.text(`Period: ${periodLabel}`, 14, 30);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 35);

    // Summary box
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text(`Opening Balance: Rs. ${statementData.openingBalance.toLocaleString()}`, 130, 22);
    doc.text(`Total Inflow:    Rs. ${totalCredit.toLocaleString()}`, 130, 27);
    doc.text(`Total Outflow:   Rs. ${totalDebit.toLocaleString()}`, 130, 32);
    doc.text(`Closing Balance: Rs. ${statementData.closingBalance.toLocaleString()}`, 130, 37);

    autoTable(doc, {
      startY: 42,
      head: [['Date', 'Particulars', 'Remarks', 'Category', 'Dr/Cr', 'Amount', 'Balance']],
      body: statementData.rows.map(tx => [
        format(new Date(tx.dateTime), 'dd MMM yy, hh:mm a'),
        (tx.party || 'N/A').toUpperCase(),
        tx.note || '-',
        (tx.category || 'OTHER').toUpperCase(),
        tx.type === 'CREDIT' ? 'CR' : tx.type === 'DEBIT' ? 'DR' : 'TRF',
        `Rs. ${tx.amount.toLocaleString()}`,
        `Rs. ${tx.runningBalance.toLocaleString()}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [26, 35, 126], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 6.5, textColor: [60, 60, 60] },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 28 },
        2: { cellWidth: 36 },
        3: { cellWidth: 22 },
        4: { cellWidth: 10, halign: 'center' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 22, halign: 'right' },
      },
      styles: { overflow: 'linebreak' }
    });

    doc.save(`Statement_${accLabel.replace(/\s/g, '_')}_${format(new Date(), 'yyyy_MM_dd')}.pdf`);
    setShowExportMenu(false);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Date', 'Particulars', 'Remarks', 'Category', 'Dr/Cr', 'Amount', 'Running Balance'];
    const rows = statementData.rows.map(tx => [
      format(new Date(tx.dateTime), 'yyyy-MM-dd HH:mm'),
      (tx.party || 'N/A').toUpperCase(),
      `"${(tx.note || '').replace(/"/g, '""')}"`,
      tx.category || 'OTHER',
      tx.type === 'CREDIT' ? 'CR' : tx.type === 'DEBIT' ? 'DR' : 'TRF',
      tx.amount,
      tx.runningBalance
    ]);
    const content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Statement_${selectedAccountLabel.replace(/\s/g, '_')}_${periodLabel.replace(/\s/g, '_')}_${format(new Date(), 'dd_MMM_yy')}.csv`;
    a.click();
    setShowExportMenu(false);
  };

  const accountTypeIcon = (type?: string) => {
    if (type === 'CASH') return <Wallet className="w-3 h-3" />;
    if (type === 'CREDIT_CARD') return <CreditCard className="w-3 h-3" />;
    return <Landmark className="w-3 h-3" />;
  };

  return (
    <Portal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 250 }}
        className="fixed inset-0 z-[9999] bg-white dark:bg-[#060608] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Top Bar ── */}
        <div className="bg-neutral-50 dark:bg-[#0C0C0F] border-b border-neutral-200 dark:border-white/5 px-4 py-3 shrink-0 space-y-2">
          {/* Row 1: title + close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center text-brand-blue dark:text-white hover:bg-neutral-300 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-[11px] font-black text-brand-blue dark:text-white uppercase tracking-widest leading-none">Transaction Statement</h2>
                <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">{periodLabel} · {statementData.rows.length} records</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-white/10 flex items-center justify-center text-neutral-500 hover:bg-neutral-300 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Row 2: Account selector */}
          <div className="relative">
            <button
              onClick={() => setShowAccountDropdown(v => !v)}
              className="w-full flex items-center justify-between gap-2 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-[10px] font-black text-brand-blue dark:text-white uppercase tracking-wider shadow-sm"
            >
              <div className="flex items-center gap-2">
                <Landmark className="w-3.5 h-3.5 text-brand-blue/40 dark:text-white/30" />
                <span>{selectedAccountLabel}</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${showAccountDropdown ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showAccountDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl z-10 overflow-hidden max-h-52 overflow-y-auto"
                >
                  <button
                    onClick={() => { setSelectedAccountId('ALL'); setShowAccountDropdown(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors border-b border-neutral-100 dark:border-white/5 ${selectedAccountId === 'ALL' ? 'bg-brand-blue/5 text-brand-blue dark:text-white' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-white/5'}`}
                  >
                    <Layers className="w-3 h-3" /> All Accounts
                  </button>
                  {allAccounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => { setSelectedAccountId(acc.id!); setShowAccountDropdown(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors border-b border-neutral-100 dark:border-white/5 last:border-0 ${Number(selectedAccountId) === acc.id ? 'bg-brand-blue/5 text-brand-blue dark:text-white' : 'text-neutral-500 hover:bg-neutral-50 dark:hover:bg-white/5'}`}
                    >
                      {accountTypeIcon(acc.type)}
                      {acc.bankName} ···{acc.accountLast4}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Row 3: Granularity pills */}
          <div className="flex bg-neutral-100 dark:bg-white/5 p-0.5 rounded-lg">
            {(['ALL', 'MONTH', 'YEAR', 'CUSTOM'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`flex-1 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all ${granularity === g ? 'bg-white dark:bg-[#333] text-brand-blue dark:text-white shadow-sm' : 'text-neutral-400'}`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Period navigator for MONTH/YEAR */}
          {(granularity === 'MONTH' || granularity === 'YEAR') && (
            <div className="flex items-center gap-2">
              <button onClick={() => navigatePeriod(-1)} className="w-7 h-7 rounded-lg bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-center text-neutral-400 hover:bg-neutral-50 transition-all">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center text-[9px] font-black uppercase tracking-widest text-brand-blue dark:text-white">{periodLabel}</div>
              <button onClick={() => navigatePeriod(1)} className="w-7 h-7 rounded-lg bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 flex items-center justify-center text-neutral-400 hover:bg-neutral-50 transition-all">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Custom date range */}
          {granularity === 'CUSTOM' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">From</label>
                <input type="date" value={customRange.start} onChange={e => setCustomRange(r => ({ ...r, start: e.target.value }))}
                  className="w-full h-8 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-white/10 rounded-lg px-2 text-[10px] font-bold text-brand-blue dark:text-white outline-none" />
              </div>
              <div className="space-y-0.5">
                <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">To</label>
                <input type="date" value={customRange.end} onChange={e => setCustomRange(r => ({ ...r, end: e.target.value }))}
                  className="w-full h-8 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-white/10 rounded-lg px-2 text-[10px] font-bold text-brand-blue dark:text-white outline-none" />
              </div>
            </div>
          )}

          {/* Summary bar */}
          <div className="bg-white dark:bg-[#111] px-3 py-2 rounded-xl border border-neutral-100 dark:border-white/5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3 divide-x divide-neutral-100 dark:divide-white/5">
              <div className="pr-3">
                <p className="text-[6px] font-black text-neutral-400 uppercase tracking-widest">Opening</p>
                <p className="text-[10px] font-black text-brand-blue/60 dark:text-white/50">₹{statementData.openingBalance.toLocaleString()}</p>
              </div>
              <div className="px-3">
                <p className="text-[6px] font-black text-neutral-400 uppercase tracking-widest">Closing</p>
                <p className="text-[10px] font-black text-brand-blue dark:text-white">₹{statementData.closingBalance.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-[6px] font-black text-emerald-500 uppercase">IN</p>
                <p className="text-[9px] font-black text-emerald-600">₹{totalCredit.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[6px] font-black text-rose-500 uppercase">OUT</p>
                <p className="text-[9px] font-black text-rose-600">₹{totalDebit.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleStartNewBalance}
              disabled={isProcessingPartition || showPartitionSuccess || selectedAccountId === 'ALL'}
              title={selectedAccountId === 'ALL' ? 'Select a specific account to use this feature' : ''}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
                showPartitionSuccess
                  ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                  : selectedAccountId === 'ALL'
                  ? 'bg-neutral-100 dark:bg-white/5 text-neutral-400 cursor-not-allowed'
                  : 'bg-brand-blue text-white shadow-brand-blue/20'
              } disabled:opacity-70`}
            >
              {isProcessingPartition ? (
                <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Saving...</span></>
              ) : showPartitionSuccess ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /><span>Settled!</span></>
              ) : (
                <><CheckCircle2 className="w-3 h-3" /><span>New Start Balance</span></>
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowExportMenu(v => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-neutral-800 dark:bg-white/10 text-white rounded-xl font-black text-[8px] uppercase tracking-widest active:scale-95 transition-all shadow-lg"
              >
                <Download className="w-3 h-3" />
                Export
                <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showExportMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-10"
                  >
                    <button
                      onClick={handleExportPDF}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border-b border-neutral-100 dark:border-white/5"
                    >
                      <FileText className="w-3.5 h-3.5 text-red-500" /> PDF Statement
                    </button>
                    <button
                      onClick={handleExportCSV}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-500" /> CSV Spreadsheet
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Statement Table ── */}
        <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-white dark:bg-[#0C0C0F] z-10 border-b border-neutral-100 dark:border-white/5">
              <tr>
                <th className="px-3 py-2 text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em] w-20">Date</th>
                <th className="px-2 py-2 text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em]">Particulars</th>
                <th className="px-2 py-2 text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em] hidden md:table-cell">Remarks</th>
                <th className="px-2 py-2 text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em] hidden sm:table-cell">Category</th>
                <th className="px-2 py-2 text-right text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em] w-20">Amount</th>
                <th className="px-3 py-2 text-right text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em] w-24">Balance</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening balance row */}
              <tr className="bg-brand-blue/[0.02] dark:bg-white/[0.01] border-b border-neutral-100 dark:border-white/5">
                <td className="px-3 py-2" colSpan={4}>
                  <span className="text-[8px] font-black text-brand-blue/50 dark:text-white/30 uppercase tracking-widest">
                    {granularity === 'ALL' ? 'System Opening Balance' : `Opening Balance — ${periodLabel}`}
                  </span>
                </td>
                <td className="px-2 py-2 text-right"></td>
                <td className="px-3 py-2 text-right">
                  <span className="text-[10px] font-black text-brand-blue/60 dark:text-white/50">₹{statementData.openingBalance.toLocaleString()}</span>
                </td>
              </tr>

              {statementData.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-30">
                      <ListOrdered className="w-8 h-8 text-neutral-300" />
                      <p className="text-[9px] font-black uppercase tracking-widest">No transactions in this period</p>
                    </div>
                  </td>
                </tr>
              ) : (
                statementData.rows.map((tx, idx) => {
                  const date = new Date(tx.dateTime);
                  const showDayHeader = idx === 0 || !isSameDay(date, new Date(statementData.rows[idx - 1].dateTime));
                  return (
                    <React.Fragment key={tx.id || idx}>
                      {showDayHeader && (
                        <tr className="bg-neutral-50/50 dark:bg-white/[0.005]">
                          <td colSpan={6} className="px-3 py-1">
                            <span className="text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em]">
                              {format(date, 'EEEE, dd MMM yyyy')}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-neutral-50 dark:border-white/[0.02] hover:bg-neutral-50/50 dark:hover:bg-white/[0.01] transition-colors">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-tighter">{format(date, 'hh:mm a')}</span>
                        </td>
                        <td className="px-2 py-2 max-w-[120px]">
                          <p className="text-[10px] font-black text-neutral-700 dark:text-neutral-200 uppercase truncate">{tx.party || tx.category || '—'}</p>
                          {/* On mobile show note here */}
                          {tx.note && <p className="text-[7px] text-neutral-400 italic truncate md:hidden">{tx.note}</p>}
                        </td>
                        <td className="px-2 py-2 hidden md:table-cell max-w-[150px]">
                          <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 italic truncate block">{tx.note || '—'}</span>
                        </td>
                        <td className="px-2 py-2 hidden sm:table-cell">
                          <span className="text-[8px] font-black text-brand-blue/40 dark:text-white/30 uppercase tracking-wider">{tx.category}</span>
                        </td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <span className={`text-[11px] font-black tracking-tighter ${tx.type === 'CREDIT' ? 'text-emerald-500' : tx.type === 'TRANSFER' ? 'text-cyan-500' : 'text-rose-500'}`}>
                            {tx.type === 'CREDIT' ? '+' : '−'}₹{tx.amount.toLocaleString()}
                          </span>
                          <p className="text-[6px] font-black text-neutral-400 uppercase tracking-widest">{tx.type === 'CREDIT' ? 'CR' : tx.type === 'TRANSFER' ? 'TRF' : 'DR'}</p>
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <span className={`text-[10px] font-black tracking-tighter ${tx.runningBalance >= 0 ? 'text-brand-blue dark:text-white' : 'text-rose-500'}`}>
                            ₹{tx.runningBalance.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}

              {/* Closing balance row */}
              {statementData.rows.length > 0 && (
                <tr className="bg-brand-blue/[0.04] dark:bg-white/[0.03] border-t-2 border-brand-blue/10 dark:border-white/10">
                  <td className="px-3 py-2.5" colSpan={4}>
                    <span className="text-[8px] font-black text-brand-blue/70 dark:text-white/60 uppercase tracking-widest">
                      Closing Balance — {periodLabel}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <div className="text-[7px] font-black text-neutral-400 uppercase">
                      <span className="text-emerald-500">+₹{totalCredit.toLocaleString()}</span>
                      {' / '}
                      <span className="text-rose-500">−₹{totalDebit.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="text-[13px] font-black text-brand-blue dark:text-white tracking-tighter">₹{statementData.closingBalance.toLocaleString()}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </Portal>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main Transactions Screen
// ─────────────────────────────────────────────────────────────────
export default function Transactions() {
  const { user } = useAuth();
  const { categories: appCategories } = useCategories();
  const { tags } = useTags();
  const navigate = useNavigate();
  
  // --- View Controls ---
  const [granularity, setGranularity] = useState<'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM'>('ALL'); 
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customRange, setCustomRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  // --- Filtering ---
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT' | 'TRANSFER'>('ALL');
  const [sourceTypeFilter, setSourceTypeFilter] = useState<'ALL' | 'BANK' | 'CREDIT_CARD' | 'CASH'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState<number | 'ALL'>('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // --- Statement Sheet ---
  const [showStatementSheet, setShowStatementSheet] = useState(false);

  // --- Detail View ---
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // --- Data ---
  const accounts = useLiveQuery(() => db.accounts.toArray(), [user?.uid]) || [];
  
  const dateLimits = useMemo(() => {
    let start: Date | number = 0;
    let end: Date | number = new Date(8640000000000000);
    
    if (granularity === 'MONTH') {
      start = startOfMonth(referenceDate);
      end = endOfMonth(referenceDate);
    } else if (granularity === 'YEAR') {
      start = startOfYear(referenceDate);
      end = endOfYear(referenceDate);
    } else if (granularity === 'CUSTOM') {
      start = startOfDay(new Date(customRange.start));
      end = endOfDay(new Date(customRange.end));
    }
    
    return { start, end };
  }, [granularity, referenceDate, customRange]);

  const allTxs = useLiveQuery(() => {
    if (granularity === 'ALL') {
      return db.transactions.reverse().toArray();
    }
    return db.transactions.where('dateTime').between(dateLimits.start, dateLimits.end, true, true).reverse().toArray();
  }, [granularity, dateLimits.start, dateLimits.end, user?.uid]);

  // ALL transactions for the statement sheet (always full history)
  const allTransactionsForStatement = useLiveQuery(() => db.transactions.toArray(), [user?.uid]) || [];

  const isLoading = allTxs === undefined;
  const currentTxs = allTxs || [];

  const filteredTxs = useMemo(() => {
    return currentTxs.filter(tx => {
      const txAccount = accounts.find(a => a.id === Number(tx.accountId));
      const txSourceType = txAccount?.type || 'BANK';
      const matchesSourceType = sourceTypeFilter === 'ALL' || txSourceType === sourceTypeFilter;

      const matchesType = typeFilter === 'ALL' || tx.type === typeFilter;
      const matchesCategory = categoryFilter === 'ALL' || tx.category === categoryFilter;
      const matchesAccount = accountFilter === 'ALL' || Number(tx.accountId) === Number(accountFilter);
      const matchesTag = tagFilter === 'ALL' || tx.expenseType === tagFilter;
      const matchesMethod = methodFilter === 'ALL' || tx.paymentMethod === methodFilter || (tx as any).upiApp === methodFilter;

      const matchesSearch = !searchTerm || 
        tx.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.party?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.category?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSourceType && matchesType && matchesCategory && matchesAccount && matchesTag && matchesMethod && matchesSearch;
    });
  }, [currentTxs, sourceTypeFilter, typeFilter, categoryFilter, accountFilter, tagFilter, methodFilter, searchTerm, accounts]);

  const totals = useMemo(() => {
    return filteredTxs.reduce((acc, tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'CREDIT') acc.income += amt;
      else acc.expense += amt;
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTxs]);

  const deleteTransaction = async (id: number) => {
    if (window.confirm('Permanently remove this financial record?')) {
      setIsDeleting(true);
      try {
        const tx = await db.transactions.get(id);
        if (tx?.linkedTransactionId) {
          await db.transactions.delete(tx.linkedTransactionId);
        }
        await db.transactions.delete(id);
        setSelectedTx(null);
      } catch (err) {
        console.error(err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const MonthNavigator = () => (
    <div className="flex items-center gap-3 bg-white dark:bg-[#111111] p-1.5 rounded-2xl border border-neutral-200 dark:border-white/5 shadow-sm">
      <button 
        onClick={() => setReferenceDate(subMonths(referenceDate, 1))}
        className="p-2 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-xl transition-all"
      >
        <ChevronLeft className="w-5 h-5 text-neutral-500" />
      </button>
      
      <div className="flex-1 text-center font-heading font-black text-brand-blue dark:text-white uppercase tracking-widest text-[10px]">
        {format(referenceDate, 'MMMM yyyy')}
      </div>

      <button 
        onClick={() => setReferenceDate(addMonths(referenceDate, 1))}
        className="p-2 hover:bg-neutral-50 dark:hover:bg-white/5 rounded-xl transition-all"
      >
        <ChevronRight className="w-5 h-5 text-neutral-500" />
      </button>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="max-w-4xl mx-auto space-y-3 pb-32 px-2 md:px-0"
    >
      {/* --- Page Header --- */}
      <div className="flex items-center justify-between gap-4 pt-1 pb-1">
        <div>
          <h1 className="text-xl font-heading font-black text-brand-blue dark:text-white tracking-tight leading-none">Transactions</h1>
          <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-[0.2em] mt-0.5">Activity History</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowStatementSheet(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue text-white rounded-lg hover:bg-brand-blue/90 transition-all active:scale-95 text-[9px] font-black uppercase tracking-wider shadow-lg shadow-brand-blue/20"
            title="Open Statement Sheet"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Statement</span>
          </button>
        </div>
      </div>

      {/* --- Nano Summary Row --- */}
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

      {/* --- Navigation & Filter Bar --- */}
      <div className="sticky top-2 z-40 space-y-1.5 pointer-events-none pb-1">
        <div className="pointer-events-auto bg-white/90 dark:bg-[#060608]/90 backdrop-blur-xl p-1 rounded-[16px] border border-neutral-200 dark:border-white/10 shadow-lg flex flex-col md:flex-row gap-1.5">
          
          <div className="flex bg-neutral-100 dark:bg-white/5 p-0.5 rounded-lg overflow-x-auto scrollbar-hide shrink-0">
            {(['MONTH', 'YEAR', 'ALL', 'CUSTOM'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-2.5 py-1 rounded-md text-[7px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  granularity === g 
                    ? 'bg-white dark:bg-[#333333] text-brand-blue dark:text-white shadow-sm' 
                    : 'text-neutral-400 hover:text-neutral-500'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="flex-1 flex gap-1">
            <div className="relative flex-1 group">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-400" />
              <input 
                type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-7 bg-transparent border border-transparent focus:border-neutral-100 dark:focus:border-white/5 pl-7 pr-2 rounded-lg text-[9px] font-bold text-brand-blue dark:text-white outline-none transition-all"
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`px-2.5 h-7 rounded-lg flex items-center justify-center gap-1.5 border transition-all ${isFilterOpen ? 'bg-brand-blue text-white border-brand-blue' : 'bg-transparent border-transparent text-neutral-400 hover:bg-neutral-50 dark:hover:bg-white/5'}`}
            >
              <Filter className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* --- Contextual Overlays --- */}
        <AnimatePresence>
          {granularity === 'MONTH' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="pointer-events-auto max-w-[200px] mx-auto">
              <MonthNavigator />
            </motion.div>
          )}

          {isFilterOpen && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="pointer-events-auto bg-white dark:bg-[#111111] p-4 rounded-[24px] border border-neutral-200 dark:border-white/10 shadow-2xl space-y-3">
               
               <div className="space-y-1">
                  <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">Source Type</label>
                  <div className="flex bg-neutral-50 dark:bg-black/20 p-1 rounded-lg">
                    {(['ALL', 'BANK', 'CREDIT_CARD', 'CASH'] as const).map(t => (
                      <button key={t} onClick={() => { setSourceTypeFilter(t); setAccountFilter('ALL'); setMethodFilter('ALL'); }} className={`flex-1 py-1 rounded-md text-[8px] font-black tracking-widest transition-all ${sourceTypeFilter === t ? 'bg-white dark:bg-white/10 shadow-sm text-brand-blue dark:text-white' : 'text-neutral-400'}`}>
                        {t === 'CREDIT_CARD' ? 'CREDIT' : t}
                      </button>
                    ))}
                  </div>
               </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                     <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">Flow</label>
                     <div className="flex bg-neutral-50 dark:bg-black/20 p-1 rounded-lg">
                       {(['ALL', 'DEBIT', 'CREDIT', 'TRANSFER'] as const).map(t => (
                         <button key={t} onClick={() => setTypeFilter(t)} className={`flex-1 py-1 rounded-md text-[8px] font-black tracking-widest transition-all ${typeFilter === t ? 'bg-white dark:bg-white/10 shadow-sm text-brand-blue dark:text-white' : 'text-neutral-400'}`}>
                           {t === 'DEBIT' ? 'EXP' : t === 'CREDIT' ? 'INC' : t === 'TRANSFER' ? 'TRF' : 'ALL'}
                         </button>
                       ))}
                     </div>
                  </div>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                    <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">Category</label>
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full h-8 bg-neutral-50 dark:bg-black/20 border-neutral-100 dark:border-white/5 border px-2 py-0 rounded-lg text-[10px] font-bold text-brand-blue dark:text-white outline-none appearance-none">
                      <option value="ALL">All Categories</option>
                      {appCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">Tag</label>
                    <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className="w-full h-8 bg-neutral-50 dark:bg-black/20 border-neutral-100 dark:border-white/5 border px-2 py-0 rounded-lg text-[10px] font-bold text-brand-blue dark:text-white outline-none appearance-none">
                      <option value="ALL">All Tags</option>
                      {tags.map(t => <option key={t} value={t}>#{t}</option>)}
                    </select>
                 </div>
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                 <div className="space-y-1">
                    <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">Account Space</label>
                    <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))} className="w-full h-8 bg-neutral-50 dark:bg-black/20 border-neutral-100 dark:border-white/5 border px-2 py-0 rounded-lg text-[10px] font-bold text-brand-blue dark:text-white outline-none appearance-none">
                      <option value="ALL">All {sourceTypeFilter === 'ALL' ? 'Accounts' : sourceTypeFilter}</option>
                      {accounts.filter(a => sourceTypeFilter === 'ALL' || a.type === sourceTypeFilter).map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} (..{acc.accountLast4})</option>)}
                    </select>
                 </div>
                 {sourceTypeFilter !== 'CREDIT_CARD' && sourceTypeFilter !== 'CASH' && (
                  <div className="space-y-1">
                     <label className="text-[7px] font-black text-neutral-400 uppercase tracking-widest pl-1">Method</label>
                     <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="w-full h-8 bg-neutral-50 dark:bg-black/20 border-neutral-100 dark:border-white/5 border px-2 py-0 rounded-lg text-[10px] font-bold text-brand-blue dark:text-white outline-none appearance-none">
                       <option value="ALL">All Methods</option>
                       {['Cash', 'Credit Card', 'Bank Transfer', 'UPI', 'GPay', 'PhonePe', 'Paytm', 'Amazon Pay', 'CRED', 'BHIM']
                         .filter(m => {
                           if (sourceTypeFilter === 'BANK') {
                             return m !== 'Cash' && m !== 'Credit Card';
                           }
                           return true;
                         })
                         .map(m => <option key={m} value={m}>{m}</option>)}
                     </select>
                  </div>
                  )}
               </div>
               
               <div className="flex items-center justify-between pt-2">
                 <button onClick={() => { setSourceTypeFilter('ALL'); setTypeFilter('ALL'); setCategoryFilter('ALL'); setAccountFilter('ALL'); setTagFilter('ALL'); setMethodFilter('ALL'); }} className="text-[10px] font-bold text-rose-500/80 hover:text-rose-500 transition-colors">Clear Filters</button>
                 <button onClick={() => setIsFilterOpen(false)} className="px-4 py-1.5 bg-brand-blue dark:bg-white/10 text-white rounded-lg text-[10px] font-bold active:scale-95 transition-all shadow-md">Apply Filters</button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- Transactions List --- */}
      <div className="space-y-2.5">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-brand-blue/10 border-t-brand-blue rounded-full animate-spin mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-blue/40">Accessing Records...</p>
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
            <p className="text-[9px] font-black uppercase tracking-widest text-brand-blue/60 mt-2 italic shadow-sm">No matches found in this timeline</p>
          </div>
        ) : (
          filteredTxs.map((tx, idx) => {
            const date = new Date(tx.dateTime);
            const showDateHeader = idx === 0 || !isSameDay(date, new Date(filteredTxs[idx-1].dateTime));
            
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
                  initial={{ opacity: 0, y: 5 }} 
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedTx(tx)}
                  className="bg-white dark:bg-[#0C0C0F] group hover:bg-neutral-50 dark:hover:bg-white/5 border border-neutral-100 dark:border-white/5 p-3 rounded-[20px] shadow-sm flex items-center gap-3 transition-all cursor-pointer active:shadow-inner pointer-events-auto"
                >
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

                  <div className="text-right flex flex-col items-end gap-1">
                     <p className={`text-base font-heading font-black tracking-tighter ${tx.type === 'DEBIT' ? 'text-rose-500' : tx.type === 'TRANSFER' ? 'text-cyan-500' : 'text-emerald-500'}`}>
                       {tx.type === 'DEBIT' ? '-' : tx.type === 'TRANSFER' ? '⇄' : '+'}₹{Number(tx.amount).toLocaleString()}
                     </p>
                  </div>
                </motion.div>
              </div>
            );
          })
        )}
      </div>

      {/* --- Detail Drawer --- */}
      <AnimatePresence>
        {selectedTx && (
          <Portal>
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setSelectedTx(null)}
               className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999]"
            />
            <motion.div 
               initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0C0C0F] z-[10000] rounded-t-[32px] p-6 pb-20 md:pb-6 max-w-lg mx-auto shadow-2xl border-t border-white/10"
            >
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
                   <div className="bg-neutral-50 dark:bg-white/5 p-3 rounded-2xl border border-neutral-100 dark:border-white/5">
                      <p className="text-[7px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Landmark className="w-2.5 h-2.5" /> Source Account</p>
                      <p className="text-[10px] font-bold text-brand-blue dark:text-white truncate">
                        {accounts.find(a => a.id === selectedTx.accountId)?.bankName || 'Unknown'}
                      </p>
                   </div>
                   <div className="bg-neutral-50 dark:bg-white/5 p-3 rounded-2xl border border-neutral-100 dark:border-white/5">
                      <p className="text-[7px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Smartphone className="w-2.5 h-2.5" /> Logistics</p>
                      <p className="text-[10px] font-bold text-brand-blue dark:text-white truncate">
                        {selectedTx.upiApp || selectedTx.paymentMethod || 'Manual'}
                      </p>
                   </div>
                   <div className="bg-neutral-50 dark:bg-white/5 p-3 rounded-2xl border border-neutral-100 dark:border-white/5">
                      <p className="text-[7px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><TagIcon className="w-2.5 h-2.5" /> Classification</p>
                      <p className="text-[10px] font-bold text-brand-blue dark:text-white">
                        #{selectedTx.expenseType || 'Unclassified'}
                      </p>
                   </div>
                   <div className="bg-neutral-50 dark:bg-white/5 p-3 rounded-2xl border border-neutral-100 dark:border-white/5">
                      <p className="text-[7px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5"><Layers className="w-2.5 h-2.5" /> Flow</p>
                      <p className={`text-[10px] font-black uppercase tracking-tighter ${selectedTx.type === 'CREDIT' ? 'text-emerald-500' : selectedTx.type === 'TRANSFER' ? 'text-cyan-500' : 'text-rose-500'}`}>
                        {selectedTx.type === 'CREDIT' ? '↓ Inflow' : selectedTx.type === 'TRANSFER' ? '⇄ Transfer' : '↑ Outflow'}
                      </p>
                   </div>
                </div>

                {selectedTx.note && (
                  <div className="mb-6 bg-neutral-50/50 dark:bg-white/[0.02] p-4 rounded-2xl border border-dashed border-neutral-200 dark:border-white/10">
                    <p className="text-[11px] font-bold text-brand-blue dark:text-white opacity-80 italic leading-relaxed text-center">
                      "{selectedTx.note}"
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { navigate(`/?edit=${selectedTx.id}`); setSelectedTx(null); }}
                    className="py-4 bg-brand-blue dark:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-brand-blue/20"
                  >
                    <Edit3 className="w-4 h-4" /> Edit Record
                  </button>
                  <button 
                    onClick={() => deleteTransaction(selectedTx.id!)}
                    disabled={isDeleting}
                    className="py-4 bg-rose-500/10 text-rose-500 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isDeleting ? (
                       <div className="w-4 h-4 border-2 border-rose-500/30 border-t-rose-500 rounded-full animate-spin" />
                    ) : <Trash2 className="w-4 h-4" />}
                    {isDeleting ? 'Removing...' : 'Remove'}
                  </button>
                </div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>

      {/* --- Statement Sheet --- */}
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
