import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../models/db';
import { useAuth } from '../context/AuthContext';
import {
  format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay,
  subDays, eachDayOfInterval, differenceInDays
} from 'date-fns';
import {
  Download, FileText, Printer, ChevronDown, Filter,
  TrendingUp, TrendingDown, Search, ArrowLeftRight, Tag, RefreshCw
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';
import { useCurrency } from '../hooks/useCurrency';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid, BarChart, Bar
} from 'recharts';
import { cn } from '../logic/utils';

// ─── Constants ────────────────────────────────────────────────────────────────
const CHART_COLORS = ['#00A86B', '#1A237E', '#D4AF37', '#82EEFD', '#E53935', '#3B3B98', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const CATEGORY_ICONS: Record<string, string> = {
  'Food': '🍔', 'Transport': '🚗', 'Shopping': '🛍️', 'Bills': '⚡',
  'Entertainment': '🎬', 'Salary': '💰', 'Transfer': '💸', 'Groceries': '🛒',
  'Health': '💊', 'Education': '📚', 'Housing': '🏠', 'Travel': '✈️',
  'Investment': '📈', 'Loan': '🏦', 'Rent': '🏘️', 'Other': '📝',
};
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Financial Year Helpers (Apr–Mar, India) ──────────────────────────────────
const getFYStart = (date: Date) => {
  const y = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  return new Date(y, 3, 1); // Apr 1
};
const getFYEnd = (date: Date) => {
  const y = date.getMonth() >= 3 ? date.getFullYear() + 1 : date.getFullYear();
  return new Date(y, 2, 31); // Mar 31
};

// ─── Date Presets ─────────────────────────────────────────────────────────────
type DatePreset = { label: string; getRange: () => { start: string; end: string } };
const DATE_PRESETS: DatePreset[] = [
  { label: 'Today', getRange: () => { const d = format(new Date(), 'yyyy-MM-dd'); return { start: d, end: d }; } },
  { label: 'Yesterday', getRange: () => { const d = format(subDays(new Date(), 1), 'yyyy-MM-dd'); return { start: d, end: d }; } },
  { label: 'This Month', getRange: () => ({ start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') }) },
  { label: 'Last Month', getRange: () => { const lm = subMonths(new Date(), 1); return { start: format(startOfMonth(lm), 'yyyy-MM-dd'), end: format(endOfMonth(lm), 'yyyy-MM-dd') }; } },
  { label: 'Last 3 Mo', getRange: () => ({ start: format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') }) },
  { label: 'Last 6 Mo', getRange: () => ({ start: format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd') }) },
  { label: 'This FY', getRange: () => ({ start: format(getFYStart(new Date()), 'yyyy-MM-dd'), end: format(getFYEnd(new Date()), 'yyyy-MM-dd') }) },
];

// ─── Insights Generator ──────────────────────────────────────────────────────
interface Insight { icon: string; text: string; color: string }
const generateInsights = (txs: Transaction[], prevTxs: Transaction[], currency: string): Insight[] => {
  const insights: Insight[] = [];
  if (txs.length === 0) return insights;

  const debits = txs.filter(t => t.type === 'DEBIT');
  const credits = txs.filter(t => t.type === 'CREDIT');
  const totalExpense = debits.reduce((s, t) => s + t.amount, 0);
  const totalIncome = credits.reduce((s, t) => s + t.amount, 0);

  // Biggest single expense
  if (debits.length > 0) {
    const biggest = debits.reduce((a, b) => a.amount > b.amount ? a : b);
    insights.push({
      icon: '💸', color: 'rose',
      text: `Biggest expense: ${currency}${biggest.amount.toLocaleString('en-IN')} to ${biggest.party || biggest.category} on ${format(new Date(biggest.dateTime), 'dd MMM')}`
    });
  }

  // Average transaction
  if (debits.length > 0) {
    const avg = Math.round(totalExpense / debits.length);
    insights.push({
      icon: '📊', color: 'blue',
      text: `${debits.length} expenses averaging ${currency}${avg.toLocaleString('en-IN')} each`
    });
  }

  // Most active weekday
  if (txs.length >= 3) {
    const dayCount = new Array(7).fill(0);
    txs.forEach(t => dayCount[new Date(t.dateTime).getDay()]++);
    const maxDay = dayCount.indexOf(Math.max(...dayCount));
    insights.push({
      icon: '📅', color: 'cyan',
      text: `Most active day: ${WEEKDAYS[maxDay]} (${dayCount[maxDay]} transactions)`
    });
  }

  // Savings rate
  if (totalIncome > 0) {
    const rate = ((totalIncome - totalExpense) / totalIncome * 100).toFixed(0);
    insights.push({
      icon: Number(rate) >= 0 ? '🎯' : '⚠️', color: Number(rate) >= 0 ? 'emerald' : 'amber',
      text: Number(rate) >= 0 ? `Savings rate: ${rate}% of income saved` : `Overspent by ${Math.abs(Number(rate))}% beyond income`
    });
  }

  return insights.slice(0, 4);
};

export default function Reports() {
  const currency = useCurrency();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const accountIdParam = searchParams.get('accountId');
  const accounts = useLiveQuery(() => db.accounts.toArray(), [user?.uid]) || [];
  const { categories } = useCategories();
  const { tags } = useTags();

  // ── Filter State ──
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'ALL'>(accountIdParam || 'ALL');
  const [activePreset, setActivePreset] = useState('This Month');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedCategory, setSelectedCategory] = useState<string | 'ALL'>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string | 'ALL'>('ALL');
  const [selectedUpiApp, setSelectedUpiApp] = useState<string | 'ALL'>('ALL');
  const [selectedMethodAccount, setSelectedMethodAccount] = useState<string | 'ALL'>('ALL');
  const [selectedTag, setSelectedTag] = useState<string | 'ALL'>('ALL');
  const [transactionType, setTransactionType] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [payeeSearch, setPayeeSearch] = useState('');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [activeChart, setActiveChart] = useState<'category' | 'daily' | 'tags'>('category');

  const bankAccounts = useMemo(() => accounts.filter(a => (a.type || 'BANK') === 'BANK'), [accounts]);
  const creditCards = useMemo(() => accounts.filter(a => a.type === 'CREDIT_CARD'), [accounts]);
  const cashAccounts = useMemo(() => accounts.filter(a => a.type === 'CASH'), [accounts]);

  useEffect(() => {
    if (accountIdParam) setSelectedAccountId(accountIdParam);
  }, [accountIdParam]);

  const applyPreset = (preset: DatePreset) => {
    const range = preset.getRange();
    setDateRange(range);
    setActivePreset(preset.label);
  };

  const comparisonRange = useMemo(() => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    const days = differenceInDays(end, start) + 1;
    const compEnd = subDays(start, 1);
    const compStart = subDays(start, days);
    return {
      start: format(compStart, 'yyyy-MM-dd'),
      end: format(compEnd, 'yyyy-MM-dd')
    };
  }, [dateRange]);

  const allTransactions = useLiveQuery(() => db.transactions.toArray(), [user?.uid]) || [];

  const uniqueUpiApps = useMemo(() => {
    const apps = new Set<string>();
    allTransactions.forEach(t => { if (t.upiApp) apps.add(t.upiApp); });
    return Array.from(apps).sort();
  }, [allTransactions]);

  const filteredTransactions = useMemo(() => {
    let txs = [...allTransactions];

    if (selectedAccountId !== 'ALL') {
      txs = txs.filter(t => t.accountId === Number(selectedAccountId));
    }

    const start = startOfDay(new Date(dateRange.start)).getTime();
    const end = endOfDay(new Date(dateRange.end)).getTime();
    txs = txs.filter(t => {
      const time = new Date(t.dateTime).getTime();
      return time >= start && time <= end;
    });

    if (transactionType !== 'ALL') txs = txs.filter(t => t.type === transactionType);
    if (selectedCategory !== 'ALL') txs = txs.filter(t => t.category === selectedCategory);
    if (selectedMethod !== 'ALL') {
      txs = txs.filter(t => t.paymentMethod === selectedMethod);
    }
    if (selectedUpiApp !== 'ALL') {
      txs = txs.filter(t => t.upiApp === selectedUpiApp);
    }
    if (selectedMethodAccount !== 'ALL') {
      txs = txs.filter(t => t.accountId === Number(selectedMethodAccount));
    }
    if (selectedTag !== 'ALL') txs = txs.filter(t => t.expenseType === selectedTag);
    if (payeeSearch.trim()) {
      const q = payeeSearch.toLowerCase();
      txs = txs.filter(t => (t.party || '').toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q));
    }

    return txs.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [allTransactions, selectedAccountId, dateRange, selectedCategory, selectedMethod, selectedUpiApp, selectedMethodAccount, selectedTag, transactionType, payeeSearch]);

  const comparisonTransactions = useMemo(() => {
    if (!comparisonMode) return [];
    let txs = [...allTransactions];
    if (selectedAccountId !== 'ALL') txs = txs.filter(t => t.accountId === Number(selectedAccountId));
    const start = startOfDay(new Date(comparisonRange.start)).getTime();
    const end = endOfDay(new Date(comparisonRange.end)).getTime();
    txs = txs.filter(t => { const time = new Date(t.dateTime).getTime(); return time >= start && time <= end; });
    if (transactionType !== 'ALL') txs = txs.filter(t => t.type === transactionType);
    if (selectedCategory !== 'ALL') txs = txs.filter(t => t.category === selectedCategory);
    if (selectedMethod !== 'ALL') txs = txs.filter(t => t.paymentMethod === selectedMethod);
    if (selectedTag !== 'ALL') txs = txs.filter(t => t.expenseType === selectedTag);
    return txs;
  }, [comparisonMode, allTransactions, selectedAccountId, comparisonRange, transactionType, selectedCategory, selectedMethod, selectedTag]);

  const totals = useMemo(() => filteredTransactions.reduce((acc, tx) => {
    if (tx.type === 'CREDIT') acc.income += tx.amount;
    else if (tx.type === 'DEBIT') acc.expense += tx.amount;
    return acc;
  }, { income: 0, expense: 0 }), [filteredTransactions]);

  const compTotals = useMemo(() => comparisonTransactions.reduce((acc, tx) => {
    if (tx.type === 'CREDIT') acc.income += tx.amount;
    else if (tx.type === 'DEBIT') acc.expense += tx.amount;
    return acc;
  }, { income: 0, expense: 0 }), [comparisonTransactions]);

  const txsWithBalance = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    let balance = 0;
    return sorted.map(tx => {
      if (tx.type === 'CREDIT') balance += tx.amount;
      else balance -= tx.amount;
      return { ...tx, runningBalance: balance };
    }).reverse();
  }, [filteredTransactions]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTransactions.filter(t => t.type === 'DEBIT').forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const compCategoryData = useMemo(() => {
    if (!comparisonMode) return {};
    const map: Record<string, number> = {};
    comparisonTransactions.filter(t => t.type === 'DEBIT').forEach(t => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return map;
  }, [comparisonMode, comparisonTransactions]);

  const dailyData = useMemo(() => {
    try {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      if (differenceInDays(end, start) > 366) return [];
      const days = eachDayOfInterval({ start, end });
      const map: Record<string, number> = {};
      filteredTransactions.filter(t => t.type === 'DEBIT').forEach(t => {
        const key = format(new Date(t.dateTime), 'yyyy-MM-dd');
        map[key] = (map[key] || 0) + t.amount;
      });
      return days.map(d => ({ date: format(d, 'dd MMM'), amount: map[format(d, 'yyyy-MM-dd')] || 0 }));
    } catch { return []; }
  }, [filteredTransactions, dateRange]);

  const tagData = useMemo(() => {
    const map: Record<string, { debit: number; credit: number }> = {};
    filteredTransactions.forEach(t => {
      const tag = t.expenseType || 'Untagged';
      if (!map[tag]) map[tag] = { debit: 0, credit: 0 };
      if (t.type === 'DEBIT') map[tag].debit += t.amount;
      else if (t.type === 'CREDIT') map[tag].credit += t.amount;
    });
    return Object.entries(map).map(([name, v]) => ({ name, expense: v.debit, income: v.credit }));
  }, [filteredTransactions]);

  const uniquePayees = useMemo(() => {
    const set = new Set<string>();
    allTransactions.forEach(t => { if (t.party) set.add(t.party); });
    return Array.from(set).sort();
  }, [allTransactions]);

  const insights = useMemo(() => generateInsights(filteredTransactions, comparisonTransactions, currency), [filteredTransactions, comparisonTransactions, currency]);

  const pctChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(26, 35, 126);
    doc.rect(0, 0, pageW, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('Financial Activity Report', 14, 15);
    doc.setFontSize(8);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, h:mm a')}`, 14, 22);
    doc.text('Personal Finance Premium', pageW - 14, 22, { align: 'right' });

    doc.setTextColor(100);
    doc.setFontSize(8);
    let y = 40;
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, y);
    const accName = selectedAccountId === 'ALL' ? 'All Accounts' : accounts.find(a => a.id === Number(selectedAccountId))?.bankName || 'Unknown';
    doc.text(`Account: ${accName}  |  Category: ${selectedCategory}  |  Tag: ${selectedTag}  |  Method: ${selectedMethod}`, 14, y + 5);
    if (payeeSearch) doc.text(`Payee Filter: "${payeeSearch}"`, 14, y + 10);
    y += payeeSearch ? 18 : 13;

    doc.setFontSize(9);
    doc.setTextColor(0);
    const boxW = (pageW - 42) / 3;
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(14, y, boxW, 18, 2, 2, 'F');
    doc.setTextColor(5, 150, 105);
    doc.text('TOTAL INCOME', 18, y + 6);
    doc.setFontSize(11);
    doc.text(`${currency} ${totals.income.toLocaleString()}`, 18, y + 14);

    doc.setFillColor(254, 242, 242);
    doc.roundedRect(14 + boxW + 7, y, boxW, 18, 2, 2, 'F');
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(9);
    doc.text('TOTAL EXPENSE', 14 + boxW + 11, y + 6);
    doc.setFontSize(11);
    doc.text(`${currency} ${totals.expense.toLocaleString()}`, 14 + boxW + 11, y + 14);

    doc.setFillColor(238, 242, 255);
    doc.roundedRect(14 + (boxW + 7) * 2, y, boxW, 18, 2, 2, 'F');
    doc.setTextColor(26, 35, 126);
    doc.setFontSize(9);
    doc.text('NET CASH FLOW', 14 + (boxW + 7) * 2 + 4, y + 6);
    doc.setFontSize(11);
    doc.text(`${currency} ${(totals.income - totals.expense).toLocaleString()}`, 14 + (boxW + 7) * 2 + 4, y + 14);
    y += 26;

    if (categoryData.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text('CATEGORY BREAKDOWN', 14, y);
      y += 4;
      const maxVal = categoryData[0]?.value || 1;
      const barMaxW = pageW - 90;
      categoryData.slice(0, 6).forEach((cat, i) => {
        const barW = (cat.value / maxVal) * barMaxW;
        const colors: [number, number, number][] = [[0, 168, 107], [26, 35, 126], [212, 175, 55], [229, 57, 53], [59, 59, 152], [16, 185, 129]];
        const c = colors[i % colors.length];
        doc.setFillColor(c[0], c[1], c[2]);
        doc.roundedRect(14, y, Math.max(barW, 2), 5, 1, 1, 'F');
        doc.setFontSize(7);
        doc.setTextColor(80);
        doc.text(`${cat.name}`, Math.max(barW, 2) + 18, y + 4);
        doc.text(`${currency} ${cat.value.toLocaleString()} (${((cat.value / totals.expense) * 100).toFixed(0)}%)`, pageW - 14, y + 4, { align: 'right' });
        y += 8;
      });
      y += 4;
    }

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Particulars', 'Category', 'Tag', 'Method', 'Debit', 'Credit', 'Balance']],
      body: txsWithBalance.map(tx => [
        format(new Date(tx.dateTime), 'dd MMM yy'),
        (tx.party || tx.note || '—').substring(0, 20).toUpperCase(),
        tx.category.toUpperCase(),
        (tx.expenseType || '—').toUpperCase(),
        (tx.paymentMethod || '—').toUpperCase(),
        tx.type === 'DEBIT' ? tx.amount.toLocaleString() : '',
        tx.type === 'CREDIT' ? tx.amount.toLocaleString() : '',
        (tx.runningBalance >= 0 ? '' : '-') + currency + Math.abs(tx.runningBalance).toLocaleString(),
      ]),
      foot: [['', '', '', '', 'TOTALS', totals.expense.toLocaleString(), totals.income.toLocaleString(), currency + (totals.income - totals.expense).toLocaleString()]],
      theme: 'grid',
      headStyles: { fillColor: [26, 35, 126], fontSize: 7, cellPadding: 2 },
      footStyles: { fillColor: [240, 240, 250], textColor: [26, 35, 126], fontStyle: 'bold', fontSize: 7 },
      styles: { fontSize: 6.5, cellPadding: 1.5 },
      didDrawPage: () => {
        const pg = doc.internal.pages.length - 1;
        doc.setFontSize(7);
        doc.setTextColor(180);
        doc.text(`Page ${pg}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
        doc.text('Generated by Personal Finance Premium', 14, doc.internal.pageSize.getHeight() - 8);
      }
    });

    doc.save(`Financial_Report_${format(new Date(), 'ddMMyy_HHmm')}.pdf`);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Time', 'Party', 'Note', 'Category', 'Type', 'Method', 'Tag', 'Amount', 'Running Balance'];
    const rows = txsWithBalance.map(tx => [
      format(new Date(tx.dateTime), 'yyyy-MM-dd'),
      format(new Date(tx.dateTime), 'HH:mm'),
      `"${(tx.party || '').replace(/"/g, '""')}"`,
      `"${(tx.note || '').replace(/"/g, '""')}"`,
      tx.category,
      tx.type,
      tx.paymentMethod || '',
      tx.expenseType || '',
      tx.amount,
      tx.runningBalance
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Financial_Export_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-blue/5 dark:bg-brand-blue/10 text-brand-blue dark:text-brand-cyan rounded-2xl border border-brand-blue/10 dark:border-brand-blue/5">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-3xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">Reports</h1>
            <p className="text-neutral-400 font-bold mt-0.5 uppercase tracking-widest text-[8px]">Advanced Financial Manifest & Export</p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setComparisonMode(!comparisonMode)}
            className={cn(
              "flex-1 sm:flex-initial px-3 py-1.5 border rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
              comparisonMode
                ? "bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-500/10"
                : "border-neutral-200 dark:border-[#333333] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-[#222222]"
            )}
          >
            <ArrowLeftRight className="w-3 h-3 inline mr-1" /> Compare
          </button>
          <button onClick={exportCSV}
            className="flex-1 sm:flex-initial px-3 py-1.5 border border-neutral-200 dark:border-[#333333] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-[#222222] rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
          >
            <Printer className="w-3 h-3 inline mr-1" /> CSV
          </button>
          <button onClick={exportPDF}
            className="flex-1 sm:flex-initial px-4 py-1.5 bg-brand-green text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-brand-green/10"
          >
            <Download className="w-3 h-3 inline mr-1" /> PDF
          </button>
        </div>
      </div>

      {/* ── Quick Date Presets ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {DATE_PRESETS.map(preset => (
          <button key={preset.label} onClick={() => applyPreset(preset)}
            className={cn(
              "flex-shrink-0 px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
              activePreset === preset.label
                ? "bg-brand-green border-brand-green text-white shadow-sm shadow-brand-green/10"
                : "bg-white dark:bg-[#111111] text-neutral-400 border-neutral-100 dark:border-[#222222] hover:text-neutral-600 dark:hover:text-neutral-200"
            )}>
            {preset.label}
          </button>
        ))}
      </div>

      {/* ── Control Panel ── */}
      <div className="bg-white dark:bg-[#111111] p-5 rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Account */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Account</label>
            <div className="relative">
              <select value={selectedAccountId} onChange={(e) => { setSelectedAccountId(e.target.value); setActivePreset(''); }}
                className="w-full appearance-none bg-neutral-50 dark:bg-[#1A1A1E] text-brand-blue dark:text-white px-3 py-2.5 rounded-xl text-xs font-bold outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-green/10 transition-all">
                <option value="ALL">All Accounts</option>
                {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} (****{acc.accountLast4})</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
            </div>
          </div>

          {/* Date Start */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">From</label>
            <input type="date" value={dateRange.start} onChange={(e) => { setDateRange(prev => ({ ...prev, start: e.target.value })); setActivePreset('Custom'); }}
              className="w-full bg-neutral-50 dark:bg-[#1A1A1E] text-brand-blue dark:text-white px-3 py-2.5 rounded-xl text-xs font-bold outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-green/10 transition-all" />
          </div>

          {/* Date End */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">To</label>
            <input type="date" value={dateRange.end} onChange={(e) => { setDateRange(prev => ({ ...prev, end: e.target.value })); setActivePreset('Custom'); }}
              className="w-full bg-neutral-50 dark:bg-[#1A1A1E] text-brand-blue dark:text-white px-3 py-2.5 rounded-xl text-xs font-bold outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-green/10 transition-all" />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Flow</label>
            <div className="flex bg-neutral-50 dark:bg-[#1A1A1E] p-1 rounded-xl border border-neutral-100 dark:border-white/5">
              {(['ALL', 'DEBIT', 'CREDIT'] as const).map(t => (
                <button key={t} onClick={() => setTransactionType(t)}
                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all cursor-pointer ${
                    transactionType === t ? 'bg-white dark:bg-white/10 shadow-sm text-brand-blue dark:text-white' : 'text-neutral-400'
                  }`}>{t}</button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Category</label>
            <div className="relative">
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full appearance-none bg-neutral-50 dark:bg-[#1A1A1E] text-brand-blue dark:text-white px-3 py-2.5 rounded-xl text-xs font-bold outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-green/10 transition-all">
                <option value="ALL">All Categories</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
            </div>
          </div>

          {/* Method (Cascading) */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Payment Channel</label>
            <div className="relative">
              <select value={selectedMethod} onChange={(e) => { setSelectedMethod(e.target.value); setSelectedUpiApp('ALL'); setSelectedMethodAccount('ALL'); }}
                className="w-full appearance-none bg-neutral-50 dark:bg-[#1A1A1E] text-brand-blue dark:text-white px-3 py-2.5 rounded-xl text-xs font-bold outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-green/10 transition-all">
                <option value="ALL">All Channels</option>
                <option value="UPI">📱 UPI</option>
                <option value="Bank Transfer">🏦 Bank Transfer</option>
                <option value="Credit Card">💳 Credit Card</option>
                <option value="Cash">💵 Cash</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
            </div>
          </div>

          {/* UPI App (only when UPI selected) */}
          {selectedMethod === 'UPI' && (
            <div className="space-y-1.5">
              <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">UPI App</label>
              <div className="relative">
                <select value={selectedUpiApp} onChange={(e) => setSelectedUpiApp(e.target.value)}
                  className="w-full appearance-none bg-neutral-50 dark:bg-[#1A1A1E] text-brand-blue dark:text-white px-3 py-2.5 rounded-xl text-xs font-bold outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-green/10 transition-all">
                  <option value="ALL">All UPI Apps</option>
                  {uniqueUpiApps.map(app => <option key={app} value={app}>{app}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Deducted From Account (contextual based on channel) */}
          {selectedMethod !== 'ALL' && (
            <div className="space-y-1.5">
              <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">
                {selectedMethod === 'UPI' ? 'Linked Bank A/C' : selectedMethod === 'Credit Card' ? 'Which Card' : selectedMethod === 'Bank Transfer' ? 'Which Bank' : 'Cash A/C'}
              </label>
              <div className="relative">
                <select value={selectedMethodAccount} onChange={(e) => setSelectedMethodAccount(e.target.value)}
                  className="w-full appearance-none bg-neutral-50 dark:bg-[#1A1A1E] text-brand-blue dark:text-white px-3 py-2.5 rounded-xl text-xs font-bold outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-green/10 transition-all">
                  <option value="ALL">
                    {selectedMethod === 'UPI' ? 'All Linked Banks' : selectedMethod === 'Credit Card' ? 'All Cards' : selectedMethod === 'Bank Transfer' ? 'All Banks' : 'All Cash A/Cs'}
                  </option>
                  {(selectedMethod === 'UPI' || selectedMethod === 'Bank Transfer') && bankAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} (****{acc.accountLast4})</option>)}
                  {selectedMethod === 'Credit Card' && creditCards.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} (****{acc.accountLast4})</option>)}
                  {selectedMethod === 'Cash' && cashAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} (****{acc.accountLast4})</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Tag */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Classifier Tag</label>
            <div className="relative">
              <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full appearance-none bg-neutral-50 dark:bg-[#1A1A1E] text-brand-blue dark:text-white px-3 py-2.5 rounded-xl text-xs font-bold outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-green/10 transition-all">
                <option value="ALL">All Tags</option>
                {tags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
            </div>
          </div>

          {/* Payee Search */}
          <div className="space-y-1.5">
            <label className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Payee / Party</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <input type="text" value={payeeSearch} onChange={(e) => setPayeeSearch(e.target.value)}
                placeholder="Search payee..."
                list="payee-suggestions"
                className="w-full bg-neutral-50 dark:bg-[#1A1A1E] text-brand-blue dark:text-white pl-8 pr-3 py-2.5 rounded-xl text-xs font-bold outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-green/10 transition-all placeholder:text-neutral-300" />
              <datalist id="payee-suggestions">
                {uniquePayees.slice(0, 20).map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
          </div>
        </div>

        {/* Active filter pills */}
        {(selectedCategory !== 'ALL' || selectedTag !== 'ALL' || selectedMethod !== 'ALL' || selectedUpiApp !== 'ALL' || selectedMethodAccount !== 'ALL' || payeeSearch || transactionType !== 'ALL') && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-neutral-100 dark:border-[#222222]">
            <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest py-1">Active:</span>
            {selectedCategory !== 'ALL' && <span className="px-2 py-0.5 bg-neutral-100 dark:bg-[#222222] text-neutral-500 rounded-full text-[9px] font-bold">{selectedCategory} ×</span>}
            {selectedTag !== 'ALL' && <span className="px-2 py-0.5 bg-neutral-100 dark:bg-[#222222] text-neutral-500 rounded-full text-[9px] font-bold">#{selectedTag} ×</span>}
            {selectedMethod !== 'ALL' && (
              <span className="px-2 py-0.5 bg-neutral-100 dark:bg-[#222222] text-neutral-500 rounded-full text-[9px] font-bold">
                {selectedMethod} ×
              </span>
            )}
            {selectedUpiApp !== 'ALL' && (
              <span className="px-2 py-0.5 bg-neutral-100 dark:bg-[#222222] text-neutral-500 rounded-full text-[9px] font-bold">
                App: {selectedUpiApp} ×
              </span>
            )}
            {selectedMethodAccount !== 'ALL' && (
              <span className="px-2 py-0.5 bg-neutral-100 dark:bg-[#222222] text-neutral-500 rounded-full text-[9px] font-bold">
                A/C: {accounts.find(a => a.id === Number(selectedMethodAccount))?.bankName || selectedMethodAccount} ×
              </span>
            )}
            {payeeSearch && <span className="px-2 py-0.5 bg-neutral-100 dark:bg-[#222222] text-neutral-500 rounded-full text-[9px] font-bold">"{payeeSearch}" ×</span>}
            {transactionType !== 'ALL' && <span className="px-2 py-0.5 bg-neutral-100 dark:bg-[#222222] text-neutral-500 rounded-full text-[9px] font-bold">{transactionType} ×</span>}
            <button onClick={() => { setSelectedCategory('ALL'); setSelectedTag('ALL'); setSelectedMethod('ALL'); setSelectedUpiApp('ALL'); setSelectedMethodAccount('ALL'); setPayeeSearch(''); setTransactionType('ALL'); }}
              className="px-2 py-0.5 text-[9px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-0.5"><RefreshCw className="w-2.5 h-2.5" /> Clear</button>
          </div>
        )}
      </div>

      {/* ── Stats Summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Income */}
        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-[24px] border border-emerald-100 dark:border-emerald-500/20">
          <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Total Income</p>
          <p className="text-xl font-heading font-black text-emerald-700 dark:text-white tracking-tighter">{currency}{totals.income.toLocaleString('en-IN')}</p>
          {comparisonMode && compTotals.income > 0 && (
            <div className={`flex items-center gap-1 mt-1 text-[9px] font-bold ${pctChange(totals.income, compTotals.income) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {pctChange(totals.income, compTotals.income) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(pctChange(totals.income, compTotals.income)).toFixed(0)}% vs prev · {currency}{compTotals.income.toLocaleString('en-IN')}
            </div>
          )}
        </div>
        {/* Expense */}
        <div className="bg-rose-50 dark:bg-rose-500/10 p-4 rounded-[24px] border border-rose-100 dark:border-rose-500/20">
          <p className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1">Total Expense</p>
          <p className="text-xl font-heading font-black text-rose-700 dark:text-white tracking-tighter">{currency}{totals.expense.toLocaleString('en-IN')}</p>
          {comparisonMode && compTotals.expense > 0 && (
            <div className={`flex items-center gap-1 mt-1 text-[9px] font-bold ${pctChange(totals.expense, compTotals.expense) <= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {pctChange(totals.expense, compTotals.expense) <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {Math.abs(pctChange(totals.expense, compTotals.expense)).toFixed(0)}% vs prev · {currency}{compTotals.expense.toLocaleString('en-IN')}
            </div>
          )}
        </div>
        {/* Net */}
        <div className="bg-brand-blue p-4 rounded-[24px] shadow-xl shadow-brand-blue/10 text-white">
          <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mb-1">Net Position</p>
          <p className="text-xl font-heading font-black text-white tracking-tighter">{currency}{(totals.income - totals.expense).toLocaleString('en-IN')}</p>
          {comparisonMode && (
            <p className="text-[9px] font-bold text-white/40 mt-1">
              Prev: {currency}{(compTotals.income - compTotals.expense).toLocaleString('en-IN')}
            </p>
          )}
        </div>
      </div>

      {/* ── Insights Panel ── */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {insights.map((ins, i) => (
            <div key={i} className="flex items-start gap-3 bg-white dark:bg-[#111111] p-3.5 rounded-2xl border border-neutral-100 dark:border-[#222222]">
              <span className="text-lg flex-shrink-0">{ins.icon}</span>
              <p className="text-[10px] font-semibold text-neutral-400/80 leading-relaxed">{ins.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Analytics Charts ── */}
      {filteredTransactions.length > 0 && (
        <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 pb-0">
            <h2 className="text-xs font-bold text-brand-blue dark:text-[#F7F7F7] uppercase tracking-widest flex items-center gap-2">
              <span className="p-2 bg-neutral-100 dark:bg-[#222222] rounded-xl"><Filter className="w-3.5 h-3.5 text-brand-green" /></span> Analytics
            </h2>
            <div className="flex bg-neutral-100 dark:bg-[#1A1A1E] p-0.5 rounded-xl">
              {([['category', 'Category'], ['daily', 'Daily'], ['tags', 'Tags']] as const).map(([key, label]) => (
                <button key={key} onClick={() => setActiveChart(key)}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    activeChart === key ? 'bg-white dark:bg-[#222222] text-brand-green shadow-sm' : 'text-neutral-400'
                  }`}>{label}</button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {/* Category Donut */}
            {activeChart === 'category' && categoryData.length > 0 && (
              <div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%" paddingAngle={2} dataKey="value">
                        {categoryData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 12, fontSize: 11 }}
                        formatter={(v: number) => [`${currency}${v.toLocaleString('en-IN')}`, '']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {categoryData.slice(0, 8).map((d, i) => {
                    const pct = totals.expense > 0 ? (d.value / totals.expense * 100).toFixed(0) : '0';
                    const prevVal = compCategoryData[d.name] || 0;
                    const change = comparisonMode && prevVal > 0 ? pctChange(d.value, prevVal) : null;
                    return (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-[10px] font-bold text-neutral-400">
                            {CATEGORY_ICONS[d.name] || '📦'} {d.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {change !== null && (
                            <span className={`text-[8px] font-bold ${change > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                              {change > 0 ? '↑' : '↓'}{Math.abs(change).toFixed(0)}%
                            </span>
                          )}
                          <span className="text-[9px] text-neutral-400 font-bold">{pct}%</span>
                          <span className="text-xs font-bold text-brand-blue dark:text-white">{currency}{d.value.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Daily Spend */}
            {activeChart === 'daily' && dailyData.length > 0 && (
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#A0A0A0', fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 8, fill: '#A0A0A0' }} axisLine={false} tickLine={false} tickFormatter={v => `${currency}${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 12, fontSize: 11 }}
                      formatter={(v: number) => [`${currency}${v.toLocaleString('en-IN')}`, '']} />
                    <Bar dataKey="amount" fill="#E53935" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Tag Breakdown */}
            {activeChart === 'tags' && tagData.length > 0 && (
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tagData} barSize={16} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#A0A0A0', fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 8, fill: '#A0A0A0' }} axisLine={false} tickLine={false} tickFormatter={v => `${currency}${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: 12, fontSize: 11 }}
                      formatter={(v: number) => [`${currency}${v.toLocaleString('en-IN')}`, '']} />
                    <Bar dataKey="expense" fill="#E53935" radius={[4, 4, 0, 0]} name="Expense" />
                    <Bar dataKey="income" fill="#00A86B" radius={[4, 4, 0, 0]} name="Income" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-4 mt-2 justify-center">
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-red" /><span className="text-[10px] text-neutral-400 font-bold">Expense</span></div>
                  <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-brand-green" /><span className="text-[10px] text-neutral-400 font-bold">Income</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Comparison Mode: Category Side-by-Side ── */}
      {comparisonMode && categoryData.length > 0 && (
        <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-purple-200 dark:border-purple-500/20 shadow-sm p-5">
          <h3 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4" /> Period Comparison by Category
          </h3>
          <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-3 flex justify-between">
            <span>Current: {dateRange.start} → {dateRange.end}</span>
            <span>Previous: {comparisonRange.start} → {comparisonRange.end}</span>
          </div>
          <div className="space-y-2">
            {categoryData.slice(0, 8).map((cat, i) => {
              const prevVal = compCategoryData[cat.name] || 0;
              const change = prevVal > 0 ? pctChange(cat.value, prevVal) : (cat.value > 0 ? 100 : 0);
              return (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-neutral-400 w-24 truncate flex items-center gap-1">
                    {CATEGORY_ICONS[cat.name] || '📦'} {cat.name}
                  </span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden flex">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((prevVal / (Math.max(cat.value, prevVal) || 1)) * 100, 100)}%`, background: '#8B5CF640' }} />
                    </div>
                    <div className="flex-1 h-2 bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden flex">
                      <div className="h-full rounded-full" style={{ width: `${Math.min((cat.value / (Math.max(cat.value, prevVal) || 1)) * 100, 100)}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    </div>
                  </div>
                  <span className="text-[9px] font-bold text-neutral-400 w-14 text-right">{currency}{prevVal.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] font-bold text-brand-blue dark:text-white w-14 text-right">{currency}{cat.value.toLocaleString('en-IN')}</span>
                  <span className={`text-[9px] font-black w-12 text-right ${change > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {change > 0 ? '↑' : '↓'}{Math.abs(change).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Manifest Table ── */}
      <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-[#222222] flex justify-between items-center">
          <h3 className="text-xs font-bold text-brand-blue dark:text-white uppercase tracking-widest flex items-center gap-2">
            <span className="p-2 bg-neutral-100 dark:bg-[#222222] rounded-xl"><FileText className="w-3.5 h-3.5 text-brand-green" /></span>
            Report Manifest
            <span className="bg-neutral-100 dark:bg-[#222222] text-neutral-500 px-2 py-0.5 rounded-full text-[9px] font-semibold ml-2">
              {filteredTransactions.length} Items
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 dark:bg-[#111111] border-b border-neutral-100 dark:border-[#222222]">
                <th className="px-4 py-3.5 text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Date</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-neutral-400 uppercase tracking-widest">Particulars</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-neutral-400 uppercase tracking-widest hidden md:table-cell">Category</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-neutral-400 uppercase tracking-widest hidden lg:table-cell">Tag</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-neutral-400 uppercase tracking-widest text-right">Debit</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-neutral-400 uppercase tracking-widest text-right">Credit</th>
                <th className="px-4 py-3.5 text-[8px] font-bold text-neutral-400 uppercase tracking-widest text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 dark:divide-[#1A1A1E]">
              {txsWithBalance.map(tx => (
                <tr key={tx.id} className="hover:bg-neutral-50 dark:hover:bg-[#151515] transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-xs font-bold text-brand-blue dark:text-white tracking-tight">{format(new Date(tx.dateTime), 'dd MMM yy')}</p>
                    <p className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider">{format(new Date(tx.dateTime), 'h:mm a')}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-bold text-brand-blue dark:text-white uppercase truncate max-w-[160px] tracking-tight">{tx.party || tx.category}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#222222] text-neutral-400 font-bold uppercase tracking-wider">
                        {tx.paymentMethod || '—'}
                      </span>
                      {tx.note && <span className="text-[9px] text-neutral-400 truncate max-w-[80px]">{tx.note}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-bold text-neutral-400">{CATEGORY_ICONS[tx.category] || '📦'} {tx.category}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {tx.expenseType && (
                      <span className="text-xs font-bold text-neutral-400 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-neutral-400" /> {tx.expenseType}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {tx.type === 'DEBIT' ? (
                      <span className="text-xs font-heading font-bold text-rose-500 tracking-tight">{currency}{tx.amount.toLocaleString('en-IN')}</span>
                    ) : <span className="text-neutral-200 dark:text-neutral-700">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {tx.type === 'CREDIT' ? (
                      <span className="text-xs font-heading font-bold text-emerald-500 tracking-tight">{currency}{tx.amount.toLocaleString('en-IN')}</span>
                    ) : <span className="text-neutral-200 dark:text-neutral-700">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-heading font-bold tracking-tight ${tx.runningBalance >= 0 ? 'text-brand-blue dark:text-white' : 'text-rose-500'}`}>
                      {tx.runningBalance >= 0 ? '' : '-'}{currency}{Math.abs(tx.runningBalance).toLocaleString('en-IN')}
                    </span>
                  </td>
                </tr>
              ))}

              {txsWithBalance.length > 0 && (
                <tr className="bg-neutral-50 dark:bg-[#0D0D11] border-t-2 border-neutral-100 dark:border-[#222222]">
                  <td colSpan={2} className="px-4 py-3.5">
                    <span className="text-[10px] font-black text-brand-blue dark:text-white uppercase tracking-widest">Totals</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell" />
                  <td className="px-4 py-3 hidden lg:table-cell" />
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-heading font-black text-rose-600 tracking-tight">{currency}{totals.expense.toLocaleString('en-IN')}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-heading font-black text-emerald-600 tracking-tight">{currency}{totals.income.toLocaleString('en-IN')}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-heading font-black tracking-tight ${(totals.income - totals.expense) >= 0 ? 'text-brand-blue dark:text-white' : 'text-rose-600'}`}>
                      {currency}{(totals.income - totals.expense).toLocaleString('en-IN')}
                    </span>
                  </td>
                </tr>
              )}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-20 text-center">
                    <div className="flex flex-col items-center opacity-25">
                      <Filter className="w-12 h-12 mb-4 text-neutral-400" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Refine your filters to generate report</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
