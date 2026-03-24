import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../lib/db';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths, addMonths, startOfYear, endOfYear, isSameDay } from 'date-fns';
import { 
  X, Trash2, Filter, Search, Edit3, Download, 
  ChevronLeft, ChevronRight, ListOrdered, ArrowDownLeft, ArrowUpRight, BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { motion, AnimatePresence } from 'framer-motion';

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

  // --- Detail View ---
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  
  // --- Data ---
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  
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

  const allTxs = useLiveQuery(() => 
    db.transactions.where('dateTime').between(dateLimits.start, dateLimits.end, true, true).reverse().toArray()
  , [dateLimits.start, dateLimits.end]) || [];

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

  const totals = useMemo(() => {
    return filteredTxs.reduce((acc, tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'CREDIT') acc.income += amt;
      else acc.expense += amt;
      return acc;
    }, { income: 0, expense: 0 });
  }, [filteredTxs]);

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
    a.download = `Analysis_${granularity}_${format(new Date(), 'dd_MMM_yy')}.csv`;
    a.click();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text('Analysis History Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Period: ${granularity} (${format(new Date(), 'dd MMM yyyy')})`, 14, 22);
    
    autoTable(doc, {
      startY: 30,
      head: [['Date', 'Party', 'Category', 'Amount']],
      body: filteredTxs.map(tx => [
        format(new Date(tx.dateTime), 'dd MMM'),
        tx.party?.toUpperCase() || 'N/A',
        tx.category?.toUpperCase() || 'OTHER',
        `${tx.type === 'DEBIT' ? '-' : '+'} ₹${tx.amount.toLocaleString()}`,
      ]),
      theme: 'grid',
      headStyles: { fillColor: [26, 35, 126] } // brand-blue
    });
    doc.save(`Analysis_${format(new Date(), 'yyyy_MM_dd')}.pdf`);
  };

  const deleteTransaction = async (id: number) => {
    if (window.confirm('Delete this transaction permanently?')) {
      await db.transactions.delete(id);
      setSelectedTx(null);
    }
  };

  const MonthSwitcher = () => (
    <div className="flex items-center gap-4 bg-white/60 dark:bg-[#111111]/80 backdrop-blur-md p-2 rounded-2xl border border-brand-blue/5 dark:border-white/5 shadow-sm">
      <button 
        onClick={() => setReferenceDate(subMonths(referenceDate, 1))}
        className="p-2.5 bg-brand-blue/5 dark:bg-white/5 hover:bg-brand-blue/10 dark:hover:bg-white/10 rounded-xl transition-all active:scale-95 text-brand-blue dark:text-white"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      
      <div className="flex-1 text-center flex flex-col items-center justify-center">
        <h2 className="text-sm font-heading font-black text-brand-blue dark:text-white uppercase tracking-[0.2em]">
          {format(referenceDate, 'MMMM yyyy')}
        </h2>
        <p className="text-[9px] font-bold text-neutral-400 capitalize bg-neutral-100 dark:bg-white/5 px-2 py-0.5 rounded-full mt-1">Periodical Review</p>
      </div>

      <button 
        onClick={() => setReferenceDate(addMonths(referenceDate, 1))}
        className="p-2.5 bg-brand-blue/5 dark:bg-white/5 hover:bg-brand-blue/10 dark:hover:bg-white/10 rounded-xl transition-all active:scale-95 text-brand-blue dark:text-white"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }}
      className="space-y-6 pb-20"
    >
      {/* 1. Header Section */}
      <div className="flex justify-between items-center bg-gradient-to-r from-brand-blue/5 to-transparent dark:from-white/5 p-6 rounded-[32px] border border-brand-blue/5 dark:border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white dark:bg-[#111111] rounded-2xl shadow-lg border border-brand-blue/10 dark:border-white/10 flex items-center justify-center -rotate-6">
            <BarChart3 className="w-6 h-6 text-brand-blue dark:text-brand-cyan" />
          </div>
          <div>
            <h1 className="text-3xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tight">Analysis</h1>
            <p className="text-[#1A237E]/60 dark:text-[#A0A0A0] font-semibold text-xs tracking-widest uppercase mt-0.5">Explore your data</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={handleExportPDF}
              className="p-3 bg-brand-blue/5 dark:bg-white/5 hover:bg-brand-blue/10 dark:hover:bg-white/10 rounded-xl transition-all text-brand-blue dark:text-[#F7F7F7]"
              title="Export PDF"
            >
              <Download className="w-5 h-5" />
            </button>
        </div>
      </div>

      {/* 2. Insight Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div whileHover={{ y: -2 }} className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-[#00A86B]/20 dark:to-[#00A86B]/5 p-5 rounded-[28px] border border-emerald-500/10 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
           <div className="flex justify-between items-start mb-4 relative z-10">
             <div className="p-2 bg-emerald-500/10 rounded-xl">
               <ArrowDownLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
             </div>
             <p className="text-[9px] font-black text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-md">Inflow</p>
           </div>
           <h3 className="text-2xl lg:text-3xl font-heading font-black text-emerald-600 dark:text-emerald-400 tracking-tighter relative z-10 block">
             ₹{totals.income.toLocaleString()}
           </h3>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-500/20 dark:to-rose-500/5 p-5 rounded-[28px] border border-rose-500/10 shadow-sm relative overflow-hidden">
           <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />
           <div className="flex justify-between items-start mb-4 relative z-10">
             <div className="p-2 bg-rose-500/10 rounded-xl">
               <ArrowUpRight className="w-5 h-5 text-rose-600 dark:text-rose-400" />
             </div>
             <p className="text-[9px] font-black text-rose-600/60 dark:text-rose-400/60 uppercase tracking-widest bg-rose-500/10 px-2 py-1 rounded-md">Outflow</p>
           </div>
           <h3 className="text-2xl lg:text-3xl font-heading font-black text-rose-600 dark:text-rose-400 tracking-tighter relative z-10 block">
             ₹{totals.expense.toLocaleString()}
           </h3>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="bg-gradient-to-br from-brand-blue/5 to-transparent dark:from-brand-cyan/10 dark:to-transparent p-5 rounded-[28px] border border-brand-blue/10 dark:border-brand-cyan/20 shadow-sm relative overflow-hidden flex flex-col justify-between">
           <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-brand-blue/5 dark:bg-brand-cyan/5 rounded-full blur-3xl pointer-events-none" />
           <p className="text-[10px] font-black text-brand-blue dark:text-white uppercase tracking-widest mb-2 relative z-10 opacity-70">Net Delta</p>
           <h3 className={`text-3xl lg:text-4xl font-heading font-black tracking-tighter relative z-10 ${totals.income >= totals.expense ? 'text-brand-blue dark:text-brand-cyan' : 'text-rose-500'}`}>
             {totals.income >= totals.expense ? '+' : '-'}₹{Math.abs(totals.income - totals.expense).toLocaleString()}
           </h3>
        </motion.div>
      </div>

      {/* 3. Immersive Controls Wrapper */}
      <div className="sticky top-0 z-20 pt-4 pb-2 bg-white/80 dark:bg-[#060608]/80 backdrop-blur-xl border-b border-brand-blue/5 dark:border-white/5 mx-[-1rem] px-[1rem] shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col gap-3">
          {/* Sub-header Filter Tabs */}
          <div className="flex overflow-x-auto gap-2 scrollbar-hide">
            {(['MONTH', 'YEAR', 'ALL', 'CUSTOM'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`flex-1 min-w-[100px] py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all relative overflow-hidden ${
                  granularity === g 
                    ? 'bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue shadow-lg scale-[1.02]' 
                    : 'bg-white dark:bg-[#111111] text-neutral-400 hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] border border-neutral-200 dark:border-white/5'
                }`}
              >
                {g === 'CUSTOM' ? 'Range' : g}
                {granularity === g && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-white/30" />}
              </button>
            ))}
          </div>

          {/* Conditional Time Pickers */}
          <AnimatePresence mode="wait">
            {granularity === 'MONTH' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-1">
                <MonthSwitcher />
              </motion.div>
            )}
            {granularity === 'CUSTOM' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pt-1">
                <div className="bg-white/60 dark:bg-[#111111]/80 backdrop-blur-md p-3 rounded-2xl border border-brand-blue/5 dark:border-white/10 flex items-center justify-between gap-4">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[8px] font-black uppercase text-brand-blue/60 dark:text-white/40 tracking-widest pl-1">Starts From</label>
                    <input type="date" value={customRange.start} onChange={(e) => setCustomRange(p => ({...p, start: e.target.value}))} className="bg-neutral-50 dark:bg-[#1A1A1A] px-3 py-2.5 rounded-xl text-xs font-bold text-brand-blue dark:text-white outline-none focus:ring-2 focus:ring-brand-cyan/50 transition-all border border-transparent" />
                  </div>
                  <div className="w-8 flex items-center justify-center opacity-30 mt-4"><ChevronRight className="w-5 h-5"/></div>
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[8px] font-black uppercase text-brand-blue/60 dark:text-white/40 tracking-widest pl-1">Ends Before</label>
                    <input type="date" value={customRange.end} onChange={(e) => setCustomRange(p => ({...p, end: e.target.value}))} className="bg-neutral-50 dark:bg-[#1A1A1A] px-3 py-2.5 rounded-xl text-xs font-bold text-brand-blue dark:text-white outline-none focus:ring-2 focus:ring-brand-cyan/50 transition-all border border-transparent" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Deep Filters Search Bar */}
          <div className="flex items-center gap-2 pt-2">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-[20px] transition-all border-2 ${isFilterOpen ? 'bg-brand-blue text-white border-brand-blue dark:bg-brand-cyan dark:text-brand-blue dark:border-brand-cyan shadow-lg' : 'bg-white dark:bg-[#111111] text-brand-blue dark:text-white/60 border-neutral-100 dark:border-white/5 hover:border-brand-blue/30'}`}
            >
              <Filter className="w-5 h-5" />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-blue/40 dark:text-white/40" />
              <input 
                type="text" placeholder="Search insights, parties or notes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-12 bg-white dark:bg-[#111111] pl-11 pr-4 rounded-[20px] shadow-sm border border-neutral-100 dark:border-white/5 text-sm font-bold text-brand-blue dark:text-white outline-none focus:ring-2 focus:ring-brand-blue/20 dark:focus:ring-brand-cyan/30 transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isFilterOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-5 bg-white shadow-xl dark:bg-[#111111] rounded-[28px] border border-brand-blue/10 dark:border-white/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-brand-blue/50 dark:text-white/50 uppercase tracking-widest pl-1">Flow Direction</label>
              <div className="flex bg-neutral-100 dark:bg-[#1A1A1A] p-1 rounded-2xl">
                {(['ALL', 'DEBIT', 'CREDIT'] as const).map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${typeFilter === t ? 'bg-white dark:bg-[#333333] text-brand-blue dark:text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-500'}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-brand-blue/50 dark:text-white/50 uppercase tracking-widest pl-1">Entity Account</label>
              <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))} className="w-full h-10 bg-neutral-100 dark:bg-[#1A1A1A] px-4 rounded-2xl text-xs font-bold text-brand-blue dark:text-white border-none outline-none focus:ring-2 focus:ring-brand-cyan/50 appearance-none">
                <option value="ALL">All Accounts Scope</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.bankName} (..{acc.accountLast4})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-brand-blue/50 dark:text-white/50 uppercase tracking-widest pl-1">Category</label>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full h-10 bg-neutral-100 dark:bg-[#1A1A1A] px-4 rounded-2xl text-xs font-bold text-brand-blue dark:text-white border-none outline-none focus:ring-2 focus:ring-brand-cyan/50 appearance-none">
                <option value="ALL">All Taxonomies</option>
                {Object.keys(CATEGORY_ICONS).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Transactions Deep List */}
      <div className="space-y-4">
        {filteredTxs.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-24 flex flex-col items-center justify-center opacity-40">
            <div className="w-24 h-24 bg-neutral-200 dark:bg-white/5 rounded-[40px] flex items-center justify-center mb-6 rotate-12 scale-110 shadow-inner">
               <ListOrdered className="w-10 h-10 text-brand-blue/30 dark:text-white/30" />
            </div>
            <p className="text-[12px] font-black text-brand-blue dark:text-white uppercase tracking-[0.3em]">No Intelligence Found</p>
          </motion.div>
        ) : (
          filteredTxs.map((tx, idx) => {
            const date = new Date(tx.dateTime);
            const showDateHeader = idx === 0 || !isSameDay(date, new Date(filteredTxs[idx-1].dateTime));
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.3, delay: idx * 0.02 }}
                key={tx.id}
              >
                {showDateHeader && (
                  <div className="py-4">
                     <span className="text-[10px] font-black text-brand-blue/60 dark:text-brand-cyan/80 uppercase tracking-[0.2em] bg-brand-blue/5 dark:bg-brand-cyan/10 px-4 py-1.5 rounded-full border border-brand-blue/10 dark:border-brand-cyan/20">
                       {format(date, 'EEEE, dd MMMM yyyy')}
                     </span>
                  </div>
                )}
                <div 
                  onClick={() => setSelectedTx(tx)}
                  className="bg-white dark:bg-[#0C0C0F] p-4 rounded-[24px] border border-neutral-200 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between hover:border-brand-blue/30 dark:hover:border-brand-cyan/40 hover:shadow-[0_10px_30px_rgba(26,35,126,0.06)] dark:hover:shadow-[0_10px_30px_rgba(0,168,107,0.04)] transition-all cursor-pointer group hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <div className="absolute inset-0 bg-brand-blue/5 dark:bg-white/5 rounded-2xl blur-md group-hover:bg-brand-blue/20 dark:group-hover:bg-brand-cyan/20 transition-all opacity-0 group-hover:opacity-100" />
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl bg-neutral-50 dark:bg-[#1A1A1A] shadow-sm border border-neutral-100 dark:border-white/5 relative z-10 transition-transform group-hover:scale-105">
                        {CATEGORY_ICONS[tx.category || 'Other'] || '📝'}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-heading font-black text-brand-blue dark:text-white text-[15px] md:text-lg leading-tight tracking-tight mb-1 group-hover:text-brand-cyan transition-colors">
                        {tx.party || tx.category || 'N/A'}
                      </h4>
                      <div className="flex items-center gap-2">
                         <span className="bg-brand-blue/5 dark:bg-white/5 px-2 py-0.5 rounded-md text-[9px] font-bold text-brand-blue/70 dark:text-white/50 uppercase tracking-widest">{format(date, 'hh:mm a')}</span>
                         <span className="bg-neutral-100 dark:bg-white/5 px-2 py-0.5 rounded-md text-[9px] font-black text-neutral-500 dark:text-white/40 uppercase tracking-widest">{tx.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 md:mt-0 text-right flex flex-row md:flex-col justify-between items-center md:items-end">
                    <div className="flex items-center gap-2 md:hidden">
                       <span className="px-2 py-1 rounded bg-neutral-100 dark:bg-white/5 text-[9px] font-black uppercase text-neutral-500">Amount</span>
                    </div>
                    <p className={`font-heading font-black text-xl lg:text-2xl tracking-tighter ${tx.type === 'DEBIT' ? 'text-rose-500' : 'text-brand-green'}`}>
                      {tx.type === 'DEBIT' ? '-' : '+'}₹{Number(tx.amount).toLocaleString()}
                    </p>
                    {tx.note && (
                      <p className="text-[10px] font-bold text-neutral-400 dark:text-white/30 truncate max-w-[150px] uppercase hidden md:block mt-1 group-hover:text-brand-blue/60 transition-colors">"{tx.note}"</p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* 5. Deep Detail Modal */}
      <AnimatePresence>
        {selectedTx && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-brand-blue/30 dark:bg-black/60 backdrop-blur-md z-[100] flex items-end md:items-center justify-center p-0 md:p-6"
          >
             <motion.div 
                initial={{ y: "100%", opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: "100%", opacity: 0, transition: { ease: "easeInOut", duration: 0.2 } }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-white dark:bg-[#0C0C0F] w-full max-w-md rounded-t-[40px] md:rounded-[40px] p-8 shadow-2xl relative border-t md:border border-white/20"
             >
                <button 
                  onClick={() => setSelectedTx(null)}
                  className="absolute top-6 right-6 w-10 h-10 rounded-full bg-neutral-100 dark:bg-[#1A1A1A] hover:bg-neutral-200 dark:hover:bg-white/10 flex items-center justify-center text-neutral-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center mt-4">
                   <div className="relative">
                      <div className={`absolute inset-0 rounded-[32px] blur-xl opacity-50 ${selectedTx.type === 'DEBIT' ? 'bg-rose-500/20' : 'bg-brand-green/20'}`} />
                      <div className={`w-24 h-24 rounded-[32px] flex items-center justify-center text-5xl mb-6 relative z-10 border shadow-lg ${selectedTx.type === 'DEBIT' ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-500/20' : 'bg-brand-green/10 dark:bg-brand-green/10 border-brand-green/20'}`}>
                        {CATEGORY_ICONS[selectedTx.category || 'Other'] || '📝'}
                      </div>
                   </div>
                   <h2 className="text-3xl font-heading font-black text-brand-blue dark:text-white uppercase tracking-tight mb-2">
                     {selectedTx.party || selectedTx.category || 'Detail View'}
                   </h2>
                   <div className="flex items-center gap-2 mb-8">
                      <span className="bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-white/60 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">{selectedTx.category}</span>
                      <span className="bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-white/60 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">{format(new Date(selectedTx.dateTime), 'dd MMM yy')}</span>
                   </div>

                   <div className="w-full bg-gradient-to-br from-neutral-50 to-neutral-100/50 dark:from-[#111111] dark:to-black p-6 rounded-[32px] border border-neutral-200 dark:border-white/10 mb-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 dark:bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                      <p className="text-[10px] font-black text-brand-blue/50 dark:text-white/40 uppercase tracking-widest mb-1">Assessed Value</p>
                      <h3 className={`text-5xl font-heading font-black tracking-tighter ${selectedTx.type === 'DEBIT' ? 'text-rose-500' : 'text-brand-green'}`}>
                        {selectedTx.type === 'DEBIT' ? '-' : '+'}₹{Number(selectedTx.amount).toLocaleString()}
                      </h3>
                   </div>

                   {selectedTx.note && (
                     <div className="w-full text-left mb-10 px-4">
                        <p className="text-[9px] font-black text-brand-blue/40 dark:text-white/30 uppercase tracking-widest mb-2 flex items-center gap-2 border-b border-brand-blue/5 dark:border-white/5 pb-2">
                          <Edit3 className="w-3 h-3"/> Description Node
                        </p>
                        <p className="text-base font-bold text-brand-blue/90 dark:text-white/90 leading-relaxed italic border-l-4 border-brand-blue/30 dark:border-brand-cyan/50 pl-4 mt-3">
                          "{selectedTx.note}"
                        </p>
                     </div>
                   )}

                   <div className="w-full flex flex-col gap-3">
                      <button 
                        onClick={() => {
                          navigate(`/?edit=${selectedTx.id}`);
                          setSelectedTx(null);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:opacity-90 transition-all hover:scale-[1.02] shadow-xl shadow-brand-blue/20 dark:shadow-brand-cyan/20"
                      >
                        <Edit3 className="w-4 h-4" /> Edit Parameters
                      </button>
                      <button 
                        onClick={() => deleteTransaction(selectedTx.id!)}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-rose-500/10 text-rose-500 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-rose-500 hover:text-white transition-all overflow-hidden"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Record
                      </button>
                   </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
