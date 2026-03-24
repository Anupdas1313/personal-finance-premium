import React, { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../lib/db';
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, subMonths, addMonths, startOfYear, endOfYear, subDays, addDays, startOfWeek, endOfWeek, subWeeks, addWeeks, subYears, addYears, isSameMonth } from 'date-fns';
import { 
  Plus, Calendar as CalendarIcon, X, Trash2, ArrowDownLeft, ArrowUpRight, 
  Wallet, Share2, Filter, Search, Edit3, Copy, ArrowDownUp, Download, 
  ChevronLeft, ChevronRight, FileText, Printer, MoreHorizontal, 
  Banknote, History
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export default function Transactions() {
  const navigate = useNavigate();
  
  // --- View Controls ---
  const [granularity, setGranularity] = useState<'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM'>('MONTH');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customRange, setCustomRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });

  // --- Filtering ---
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState<number | 'ALL'>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // --- detail View ---
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  
  // --- Data ---
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  
  // Resolve Date Limits
  const dateLimits = useMemo(() => {
    let start = 0;
    let end = Infinity;
    
    if (granularity === 'MONTH') {
      start = startOfMonth(referenceDate).getTime();
      end = endOfMonth(referenceDate).getTime();
    } else if (granularity === 'YEAR') {
      start = startOfYear(referenceDate).getTime();
      end = endOfYear(referenceDate).getTime();
    } else if (granularity === 'CUSTOM') {
      start = startOfDay(new Date(customRange.start)).getTime();
      end = endOfDay(new Date(customRange.end)).getTime();
    }
    
    return { start, end };
  }, [granularity, referenceDate, customRange]);

  // Main Query
  const allTxs = useLiveQuery(() => 
    db.transactions.where('dateTime').between(dateLimits.start, dateLimits.end, true, true).reverse().toArray()
  , [dateLimits.start, dateLimits.end]) || [];

  // Filter Logic
  const filteredTxs = useMemo(() => {
    return allTxs.filter(tx => {
      const matchesType = typeFilter === 'ALL' || tx.type === typeFilter;
      const matchesCategory = categoryFilter === 'ALL' || tx.category === categoryFilter;
      const matchesAccount = accountFilter === 'ALL' || Number(tx.accountId) === Number(accountFilter);
      const matchesSearch = !searchTerm || 
        tx.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.party?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.category?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesType && matchesCategory && matchesAccount && matchesSearch;
    });
  }, [allTxs, typeFilter, categoryFilter, accountFilter, searchTerm]);

  // Derived Values
  const totals = useMemo(() => {
    return filteredTxs.reduce((acc, tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'CREDIT') acc.income += amt;
      else acc.expense += amt;
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTxs]);

  // --- Handlers ---
  const handleExportCSV = () => {
    const headers = ['Date', 'Party', 'Category', 'Type', 'Amount', 'Note'];
    const rows = filteredTxs.map(tx => [
      format(new Date(tx.dateTime), 'yyyy-MM-dd HH:mm'),
      tx.party || 'N/A',
      tx.category || 'Other',
      tx.type,
      tx.amount,
      tx.note || ''
    ]);
    const content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transactions_${granularity}_${format(new Date(), 'dd_MMM_yy')}.csv`;
    a.click();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Transaction History Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Period: ${granularity} (${format(new Date(), 'dd MMM yyyy')})`, 14, 22);
    
    autoTable(doc, {
      startY: 30,
      head: [['Date', 'Party', 'Category', 'Amount', 'Balance']],
      body: filteredTxs.map(tx => [
        format(new Date(tx.dateTime), 'dd MMM'),
        tx.party?.toUpperCase() || 'N/A',
        tx.category?.toUpperCase() || 'OTHER',
        `${tx.type === 'DEBIT' ? '-' : '+'} ₹${tx.amount.toLocaleString()}`,
        tx.amount
      ]),
      theme: 'striped',
      headStyles: { fillColor: [0, 168, 107] }
    });
    doc.save(`Transactions_${format(new Date(), 'yyyy_MM_dd')}.pdf`);
  };

  const deleteTransaction = async (id: number) => {
    if (window.confirm('Delete this transaction permanently?')) {
      await db.transactions.delete(id);
      setSelectedTx(null);
    }
  };

  // --- UI Components ---
  const MonthSwitcher = () => (
    <div className="flex items-center gap-4 bg-[#F9FBFF] dark:bg-[#111111] p-3 rounded-2xl border border-brand-blue/5 dark:border-white/5">
      <button 
        onClick={() => setReferenceDate(subMonths(referenceDate, 1))}
        className="p-2 hover:bg-brand-blue/5 rounded-xl transition-all active:scale-90"
      >
        <ChevronLeft className="w-5 h-5 text-brand-blue/60" />
      </button>
      
      <div className="flex-1 text-center">
        <h2 className="text-sm font-heading font-black text-brand-blue dark:text-white uppercase tracking-[0.2em]">
          {format(referenceDate, 'MMMM yyyy')}
        </h2>
        <p className="text-[10px] font-bold text-neutral-400 capitalize opacity-60">Month Wise View</p>
      </div>

      <button 
        onClick={() => setReferenceDate(addMonths(referenceDate, 1))}
        className="p-2 hover:bg-brand-blue/5 rounded-xl transition-all active:scale-90"
      >
        <ChevronRight className="w-5 h-5 text-brand-blue/60" />
      </button>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Area */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-heading font-semibold text-brand-blue dark:text-[#F7F7F7] tracking-tight">Transactions</h1>
          <p className="text-neutral-400 font-medium text-sm mt-1">Manage and audit your history</p>
        </div>
        <div className="flex gap-2">
           <div className="relative group">
              <button 
                className="p-3 bg-white dark:bg-[#1A1A1A] rounded-xl border border-brand-blue/10 dark:border-white/5 shadow-sm hover:shadow-md transition-all text-brand-blue dark:text-[#F7F7F7]"
                onClick={handleExportCSV}
              >
                <Download className="w-5 h-5" />
              </button>
              <div className="absolute top-full mt-2 right-0 bg-brand-blue text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap">Export CSV</div>
           </div>
        </div>
      </div>

      {/* View Switcher Bar */}
      <div className="flex overflow-x-auto gap-2 p-1 bg-neutral-100 dark:bg-[#111111] rounded-2xl scrollbar-hide">
        {(['MONTH', 'YEAR', 'ALL', 'CUSTOM'] as const).map(g => (
          <button
            key={g}
            onClick={() => setGranularity(g)}
            className={`flex-1 min-w-[100px] py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
              granularity === g 
                ? 'bg-white dark:bg-[#333333] text-brand-blue dark:text-white shadow-sm' 
                : 'text-neutral-400 hover:text-neutral-500'
            }`}
          >
            {g === 'CUSTOM' ? 'Custom Range' : g}
          </button>
        ))}
      </div>

      {/* Contextual Controls */}
      {granularity === 'MONTH' && <MonthSwitcher />}
      {granularity === 'CUSTOM' && (
        <div className="bg-[#F9FBFF] dark:bg-[#111111] p-4 rounded-2xl border border-brand-blue/5 dark:border-white/10 flex items-center justify-between gap-4">
           <div className="flex-1 flex flex-col gap-1">
             <label className="text-[8px] font-black uppercase text-neutral-400 tracking-widest pl-1">From</label>
             <input 
              type="date" 
              value={customRange.start} 
              onChange={(e) => setCustomRange(p => ({...p, start: e.target.value}))}
              className="bg-white dark:bg-[#1A1A1A] px-3 py-2 rounded-xl text-xs font-black text-brand-blue dark:text-white outline-none border border-transparent focus:border-brand-green/30"
             />
           </div>
           <div className="w-px h-10 bg-neutral-200 dark:bg-white/5 mt-3" />
           <div className="flex-1 flex flex-col gap-1">
             <label className="text-[8px] font-black uppercase text-neutral-400 tracking-widest pl-1">To</label>
             <input 
              type="date" 
              value={customRange.end} 
              onChange={(e) => setCustomRange(p => ({...p, end: e.target.value}))}
              className="bg-white dark:bg-[#1A1A1A] px-3 py-2 rounded-xl text-xs font-black text-brand-blue dark:text-white outline-none border border-transparent focus:border-brand-green/30"
             />
           </div>
        </div>
      )}

      {/* Summary Chips */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#E7F7F0] dark:bg-[#00A86B]/10 p-3 rounded-2xl border border-[#00A86B]/10">
           <p className="text-[8px] font-black text-[#00A86B]/60 uppercase tracking-widest">Inflow</p>
           <h3 className="text-lg font-black text-[#00A86B] tracking-tight">₹{totals.income.toLocaleString()}</h3>
        </div>
        <div className="bg-[#FFF1F1] dark:bg-rose-500/10 p-3 rounded-2xl border border-rose-500/10">
           <p className="text-[8px] font-black text-rose-500/60 uppercase tracking-widest">Outflow</p>
           <h3 className="text-lg font-black text-rose-500 tracking-tight">₹{totals.expense.toLocaleString()}</h3>
        </div>
        <div className="bg-brand-blue/5 dark:bg-white/5 p-3 rounded-2xl border border-brand-blue/5">
           <p className="text-[8px] font-black text-brand-blue/40 dark:text-white/30 uppercase tracking-widest">Net Flow</p>
           <h3 className={`text-lg font-black tracking-tight ${totals.income - totals.expense >= 0 ? 'text-brand-blue dark:text-white' : 'text-rose-500'}`}>
             ₹{(totals.income - totals.expense).toLocaleString()}
           </h3>
        </div>
      </div>

      {/* Advanced Filter Chips */}
      <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
         <button 
           onClick={() => setIsFilterOpen(!isFilterOpen)}
           className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-[11px] font-bold ${isFilterOpen ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white dark:bg-[#1A1A1A] text-neutral-500 dark:text-white/60 border-neutral-200 dark:border-white/5 hover:border-brand-blue/40'}`}
         >
           <Filter className="w-3.5 h-3.5" /> Filters
         </button>

         <div className="w-px h-6 bg-neutral-200 dark:bg-white/5 self-center" />

         {(['ALL', 'DEBIT', 'CREDIT'] as const).map(t => (
           <button 
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`shrink-0 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${typeFilter === t ? 'bg-brand-green text-white' : 'bg-white dark:bg-[#1A1A1A] text-neutral-400 dark:text-white/40 border border-neutral-100 dark:border-white/5'}`}
           >
             {t}
           </button>
         ))}

         <div className="w-px h-6 bg-neutral-200 dark:bg-white/5 self-center" />

         <div className="relative flex-1 min-w-[150px]">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
           <input 
            type="text"
            placeholder="Search party or note..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-[#1A1A1A] pl-9 pr-4 py-2 rounded-full border border-neutral-100 dark:border-white/5 text-[11px] font-bold text-brand-blue dark:text-white outline-none focus:border-brand-blue/30"
           />
         </div>
      </div>

      {/* Expanded Filters Drawer */}
      {isFilterOpen && (
        <div className="bg-neutral-50 dark:bg-[#111111] p-5 rounded-[24px] border border-brand-blue/5 grid grid-cols-2 gap-6 animate-in slide-in-from-top-4 duration-300">
           <div className="space-y-2">
              <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block ml-1">Filter by account</label>
              <select 
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="w-full bg-white dark:bg-[#1A1A1A] px-4 py-2.5 rounded-xl text-xs font-bold text-brand-blue dark:text-white border border-transparent focus:border-brand-green/30 outline-none"
              >
                <option value="ALL">All Accounts</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.bankName} - {acc.accountLast4}</option>
                ))}
              </select>
           </div>
           <div className="space-y-2">
              <label className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block ml-1">Filter by category</label>
              <select 
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-white dark:bg-[#1A1A1A] px-4 py-2.5 rounded-xl text-xs font-bold text-brand-blue dark:text-white border border-transparent focus:border-brand-green/30 outline-none"
              >
                <option value="ALL">All Categories</option>
                {Object.keys(CATEGORY_ICONS).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
           </div>
        </div>
      )}

      {/* Transactions List */}
      <div className="space-y-3 pb-8">
        {filteredTxs.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center opacity-40">
             <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                <ListOrdered className="w-8 h-8 text-brand-blue/30" />
             </div>
             <p className="text-[10px] font-black text-brand-blue dark:text-white uppercase tracking-[0.2em]">No Transactions Found</p>
          </div>
        ) : (
          filteredTxs.map((tx, idx) => {
            const date = new Date(tx.dateTime);
            const showDateHeader = idx === 0 || !isSameDay(date, new Date(filteredTxs[idx-1].dateTime));
            
            return (
              <div key={tx.id}>
                {showDateHeader && (
                  <div className="sticky top-0 z-10 py-3 bg-white/80 dark:bg-[#060608]/80 backdrop-blur-md">
                     <div className="inline-flex items-center gap-2 bg-brand-green/10 px-3 py-1 rounded-full border border-brand-green/20">
                        <span className="text-[9px] font-black text-brand-green uppercase tracking-widest">
                          {format(date, 'EEEE, dd MMM yyyy')}
                        </span>
                     </div>
                  </div>
                )}
                <div 
                  onClick={() => setSelectedTx(tx)}
                  className="bg-white dark:bg-[#0C0C0F] p-4 rounded-2xl border border-neutral-100 dark:border-white/5 flex items-center justify-between hover:border-brand-green/30 transition-all cursor-pointer group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-neutral-50 dark:bg-white/5 shadow-sm border border-neutral-100 dark:border-white/5`}>
                      {CATEGORY_ICONS[tx.category || 'Other'] || '📝'}
                    </div>
                    <div>
                      <h4 className="font-heading font-bold text-brand-blue dark:text-white text-[13px] leading-tight uppercase tracking-tight">
                        {tx.party || tx.category || 'N/A'}
                      </h4>
                      <p className="text-[10px] font-bold text-neutral-400 mt-0.5 uppercase tracking-tighter">
                        {format(date, 'hh:mm a')} • {tx.category}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-heading font-black text-lg tracking-tighter ${tx.type === 'DEBIT' ? 'text-rose-500' : 'text-brand-green'}`}>
                      {tx.type === 'DEBIT' ? '-' : '+'}₹{Number(tx.amount).toLocaleString()}
                    </p>
                    {tx.note && (
                      <p className="text-[9px] font-bold text-neutral-400 truncate max-w-[120px] uppercase">{tx.note}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-[#0C0C0F] w-full max-w-lg rounded-t-[32px] md:rounded-[32px] p-8 shadow-2xl relative animate-in slide-in-from-bottom-8 duration-500">
              <button 
                onClick={() => setSelectedTx(null)}
                className="absolute top-6 right-6 w-8 h-8 rounded-full bg-neutral-100 dark:bg-white/5 flex items-center justify-center text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col items-center text-center">
                 <div className="w-20 h-20 bg-brand-green/10 rounded-[28px] flex items-center justify-center text-4xl mb-4">
                    {CATEGORY_ICONS[selectedTx.category || 'Other'] || '📝'}
                 </div>
                 <h2 className="text-2xl font-heading font-black text-brand-blue dark:text-white uppercase tracking-tight mb-1">
                   {selectedTx.party || 'No Name'}
                 </h2>
                 <p className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-6">
                   {selectedTx.category} • {format(new Date(selectedTx.dateTime), 'dd MMMM yyyy')}
                 </p>

                 <div className="w-full bg-neutral-50 dark:bg-white/5 p-6 rounded-[24px] border border-brand-blue/5 mb-8">
                    <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">Amount</p>
                    <h3 className={`text-4xl font-heading font-black tracking-tighter ${selectedTx.type === 'DEBIT' ? 'text-rose-500' : 'text-brand-green'}`}>
                      {selectedTx.type === 'DEBIT' ? '-' : '+'}₹{Number(selectedTx.amount).toLocaleString()}
                    </h3>
                 </div>

                 {selectedTx.note && (
                   <div className="w-full text-left mb-8 px-2">
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2">Note / Description</p>
                      <p className="text-sm font-bold text-brand-blue/80 dark:text-white/80 leading-relaxed italic border-l-4 border-brand-green/30 pl-4">
                        "{selectedTx.note}"
                      </p>
                   </div>
                 )}

                 <div className="w-full grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        navigate(`/?edit=${selectedTx.id}`);
                        setSelectedTx(null);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-4 bg-brand-blue text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-brand-blue/90 transition-all"
                    >
                      <Edit3 className="w-4 h-4" /> Edit Record
                    </button>
                    <button 
                      onClick={() => deleteTransaction(selectedTx.id!)}
                      className="flex-1 flex items-center justify-center gap-2 py-4 bg-rose-500/10 text-rose-500 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all overflow-hidden"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
