import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../lib/db';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { Download, FileText, Printer, ChevronDown, Calendar, Filter, User, Smartphone, Landmark, CreditCard, Coins, Tag, MoreHorizontal } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';

export default function Reports() {
  const [searchParams] = useSearchParams();
  const accountIdParam = searchParams.get('accountId');
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const { categories } = useCategories();
  const { tags } = useTags();

  // Filter States
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'ALL'>(accountIdParam || 'ALL');

  useEffect(() => {
    if (accountIdParam) setSelectedAccountId(accountIdParam);
  }, [accountIdParam]);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedCategory, setSelectedCategory] = useState<string | 'ALL'>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string | 'ALL'>('ALL');
  const [selectedTag, setSelectedTag] = useState<string | 'ALL'>('ALL');
  const [transactionType, setTransactionType] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');

  const filteredTransactions = useLiveQuery(async () => {
    let collection = db.transactions.toCollection();

    // Account Filter
    if (selectedAccountId !== 'ALL') {
      collection = db.transactions.where('accountId').equals(Number(selectedAccountId));
    }

    let txs = await collection.toArray();

    // Date Range Filter
    const start = startOfDay(new Date(dateRange.start)).getTime();
    const end = endOfDay(new Date(dateRange.end)).getTime();
    txs = txs.filter(t => {
      const time = new Date(t.dateTime).getTime();
      return time >= start && time <= end;
    });

    // Type Filter
    if (transactionType !== 'ALL') {
      txs = txs.filter(t => t.type === transactionType);
    }

    // Category Filter
    if (selectedCategory !== 'ALL') {
      txs = txs.filter(t => t.category === selectedCategory);
    }

    // Method Filter
    if (selectedMethod !== 'ALL') {
      txs = txs.filter(t => t.paymentMethod === selectedMethod);
    }

    // Tag Filter
    if (selectedTag !== 'ALL') {
      txs = txs.filter(t => t.expenseType === selectedTag);
    }

    return txs.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [selectedAccountId, dateRange, selectedCategory, selectedMethod, selectedTag, transactionType]) || [];

  const totals = useMemo(() => {
    return filteredTransactions.reduce((acc, tx) => {
      if (tx.type === 'CREDIT') acc.income += tx.amount;
      else acc.expense += tx.amount;
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTransactions]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Financial Activity Report', 14, 20);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 14, 28);
    doc.text(`Account: ${selectedAccountId === 'ALL' ? 'All Accounts' : accounts.find(a => a.id === Number(selectedAccountId))?.bankName}`, 14, 33);
    doc.text(`Filter Applied: Cat: ${selectedCategory}, Method: ${selectedMethod}, Tag: ${selectedTag}`, 14, 38);

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`Total Income: INR ${totals.income.toLocaleString()}`, 14, 48);
    doc.text(`Total Expense: INR ${totals.expense.toLocaleString()}`, 14, 53);
    doc.text(`Net Cash Flow: INR ${(totals.income - totals.expense).toLocaleString()}`, 14, 58);

    autoTable(doc, {
      startY: 65,
      head: [['Date', 'Particulars', 'Category', 'Method', 'Debit', 'Credit']],
      body: filteredTransactions.map(tx => [
        format(new Date(tx.dateTime), 'dd MMM yyyy'),
        (tx.party || tx.note || '—').toUpperCase(),
        tx.category.toUpperCase(),
        tx.paymentMethod.toUpperCase(),
        tx.type === 'DEBIT' ? tx.amount.toLocaleString() : '-',
        tx.type === 'CREDIT' ? tx.amount.toLocaleString() : '-',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [26, 35, 126], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 }
    });

    doc.save(`Financial_Report_${format(new Date(), 'ddMMyy_HHmm')}.pdf`);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Party', 'Note', 'Category', 'Type', 'Method', 'Tag', 'Amount'];
    const rows = filteredTransactions.map(tx => [
      format(new Date(tx.dateTime), 'yyyy-MM-dd HH:mm'),
      tx.party || '',
      tx.note || '',
      tx.category,
      tx.type,
      tx.paymentMethod,
      tx.expenseType || '',
      tx.amount
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
        <div>
          <h1 className="text-4xl font-heading font-semibold text-brand-blue dark:text-white tracking-tight">Reports</h1>
          <p className="text-brand-blue/50 dark:text-[#A0A0A0] font-semibold mt-1 uppercase text-[10px] tracking-[0.2em]">Advanced Financial Manifest & Export</p>
        </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={exportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-neutral-100 dark:bg-[#1A1A1A] text-brand-blue dark:text-white rounded-xl font-semibold text-[10px] uppercase border border-neutral-200 dark:border-white/5 hover:bg-neutral-200 transition-all tracking-[0.1em]"
          >
            <Printer className="w-3.5 h-3.5" /> CSV
          </button>
          <button 
            onClick={exportPDF}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-blue text-white rounded-xl font-semibold text-[10px] uppercase shadow-lg shadow-brand-blue/20 hover:scale-105 transition-all tracking-[0.1em]"
          >
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </header>

      {/* Control Panel */}
      <div className="bg-white dark:bg-[#111111] p-6 rounded-[28px] border border-neutral-100 dark:border-[#222222] shadow-[0_8px_40px_rgba(26,35,126,0.05)] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Account Selection */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.2em] ml-1">Asset Source</label>
          <div className="relative">
            <select 
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full appearance-none bg-neutral-50 dark:bg-[#060608] text-brand-blue dark:text-white px-4 py-3 rounded-xl text-xs font-semibold uppercase outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-cyan transition-all tracking-[0.05em]"
            >
              <option value="ALL">All Consolidated Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.bankName} (**** {acc.accountLast4})</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          </div>
        </div>

        {/* Date Filters */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.2em] ml-1">Time Horizon (Start)</label>
          <input 
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="w-full bg-neutral-50 dark:bg-[#060608] text-brand-blue dark:text-white px-4 py-3 rounded-xl text-xs font-semibold outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-cyan transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.2em] ml-1">Time Horizon (End)</label>
          <input 
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="w-full bg-neutral-50 dark:bg-[#060608] text-brand-blue dark:text-white px-4 py-3 rounded-xl text-xs font-semibold outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-cyan transition-all"
          />
        </div>

        {/* Segment Filters */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.2em] ml-1">Logistics (Method)</label>
          <div className="relative">
            <select 
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="w-full appearance-none bg-neutral-50 dark:bg-[#060608] text-brand-blue dark:text-white px-4 py-3 rounded-xl text-xs font-semibold uppercase outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-cyan transition-all tracking-[0.05em]"
            >
              <option value="ALL">Any Payment Method</option>
              {['Bank', 'UPI', 'Credit Card', 'Cash', 'Bank Transfer'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.2em] ml-1">Tagging (Segment)</label>
          <div className="relative">
            <select 
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full appearance-none bg-neutral-50 dark:bg-[#060608] text-brand-blue dark:text-white px-4 py-3 rounded-xl text-xs font-semibold uppercase outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-cyan transition-all tracking-[0.05em]"
            >
              <option value="ALL">Any Tag (No Classification)</option>
              {tags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-[0.2em] ml-1">Categorization</label>
          <div className="relative">
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none bg-neutral-50 dark:bg-[#060608] text-brand-blue dark:text-white px-4 py-3 rounded-xl text-xs font-semibold uppercase outline-none border border-neutral-100 dark:border-white/5 focus:ring-2 focus:ring-brand-cyan transition-all tracking-[0.02em]"
            >
              <option value="ALL">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          </div>
        </div>

      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
          <p className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] mb-1.5">Total Savings (Inflow)</p>
          <p className="text-xl font-heading font-semibold text-emerald-700 dark:text-white tracking-tight">₹{totals.income.toLocaleString()}</p>
        </div>
        <div className="bg-rose-50 dark:bg-rose-500/10 p-5 rounded-2xl border border-rose-100 dark:border-rose-500/20">
          <p className="text-[9px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em] mb-1.5">Total Spending (Outflow)</p>
          <p className="text-xl font-heading font-semibold text-rose-700 dark:text-white tracking-tight">₹{totals.expense.toLocaleString()}</p>
        </div>
        <div className="bg-brand-blue p-5 rounded-2xl shadow-xl shadow-brand-blue/10">
          <p className="text-[9px] font-semibold text-white/50 uppercase tracking-[0.2em] mb-1.5">Net Position</p>
          <p className="text-xl font-heading font-semibold text-white tracking-tight">₹{(totals.income - totals.expense).toLocaleString()}</p>
        </div>
      </div>

      {/* Manifest Table */}
      <div className="bg-white dark:bg-[#0C0C0C] rounded-[32px] border border-neutral-100 dark:border-[#1A1A1E] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-neutral-100 dark:border-[#1A1A1E] flex justify-between items-center">
          <h3 className="text-xs font-heading font-semibold text-brand-blue dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-green" />
            Report Manifest 
            <span className="bg-neutral-100 dark:bg-[#222222] text-neutral-500 px-2 py-0.5 rounded-full text-[9px] font-semibold ml-2">
              {filteredTransactions.length} Items Selected
            </span>
          </h3>
        </div>
        
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-50 dark:bg-[#111111] border-b border-neutral-100 dark:border-[#222222]">
                <th className="px-6 py-4 text-[9px] font-semibold text-neutral-400 uppercase tracking-[0.2em]">Date</th>
                <th className="px-6 py-4 text-[9px] font-semibold text-neutral-400 uppercase tracking-[0.2em]">Particulars</th>
                <th className="px-6 py-4 text-[9px] font-semibold text-neutral-400 uppercase tracking-[0.2em] text-right">Debit (Dr)</th>
                <th className="px-6 py-4 text-[9px] font-semibold text-neutral-400 uppercase tracking-[0.2em] text-right">Credit (Cr)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 dark:divide-[#1A1A1A]">
              {filteredTransactions.map(tx => (
                <tr key={tx.id} className="hover:bg-neutral-50 dark:hover:bg-[#151515] transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-[11px] font-semibold text-brand-blue dark:text-white tracking-tight">{format(new Date(tx.dateTime), 'dd MMM yyyy')}</p>
                    <p className="text-[8px] text-neutral-400 font-semibold uppercase tracking-[0.1em]">{format(new Date(tx.dateTime), 'h:mm a')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-[11px] font-semibold text-brand-blue dark:text-white uppercase truncate max-w-[200px] tracking-tight">{tx.party || tx.category}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-brand-blue/5 dark:bg-[#222222] text-brand-blue/40 dark:text-[#A0A0A0] font-semibold uppercase tracking-[0.1em]">
                        {tx.paymentMethod}
                      </span>
                      {tx.expenseType && (
                        <span className="text-[8px] font-semibold text-neutral-300 uppercase tracking-[0.2em] flex items-center gap-1">
                          <Tag className="w-2 h-2" /> {tx.expenseType}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {tx.type === 'DEBIT' ? (
                      <span className="text-[11px] font-heading font-semibold text-rose-500 tracking-tight">₹{tx.amount.toLocaleString()}</span>
                    ) : <span className="text-neutral-200">—</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {tx.type === 'CREDIT' ? (
                      <span className="text-[11px] font-heading font-semibold text-emerald-500 tracking-tight">₹{tx.amount.toLocaleString()}</span>
                    ) : <span className="text-neutral-200">—</span>}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <Filter className="w-12 h-12 mb-4" />
                      <p className="text-xs font-semibold uppercase tracking-[0.3em]">Refine your filters to generate report</p>
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
