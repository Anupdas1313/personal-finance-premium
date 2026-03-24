import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../lib/db';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths, addMonths, startOfYear, endOfYear, isSameDay } from 'date-fns';
import { 
  X, Trash2, Filter, Search, Edit3, Download, 
  ChevronLeft, ChevronRight, ListOrdered, ArrowDownLeft, ArrowUpRight, BarChart3,
  Calendar, Layers, Tag as TagIcon, MoreVertical
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

export default function Transactions() {
  const navigate = useNavigate();
  
  // --- View Controls ---
  const [granularity, setGranularity] = useState<'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM'>('ALL'); // Changed default to ALL to prevent "not found" on empty months
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
    a.download = `Transactions_${granularity}_${format(new Date(), 'dd_MMM_yy')}.csv`;
    a.click();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(26, 35, 126);
    doc.text('Transactions History', 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 28);
    doc.text(`Period: ${granularity} View`, 14, 33);
    
    autoTable(doc, {
      startY: 40,
      head: [['Date', 'Particulars', 'Category', 'Type', 'Amount']],
      body: filteredTxs.map(tx => [
        format(new Date(tx.dateTime), 'dd MMM yy'),
        (tx.party || tx.category || 'N/A').toUpperCase(),
        (tx.category || 'OTHER').toUpperCase(),
        tx.type,
        `₹${tx.amount.toLocaleString()}`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [26, 35, 126], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 }
    });
    doc.save(`Transactions_${format(new Date(), 'yyyy_MM_dd')}.pdf`);
  };

  const deleteTransaction = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this transaction record?')) {
      await db.transactions.delete(id);
      setSelectedTx(null);
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
      
      <div className="flex-1 text-center font-heading font-black text-brand-blue dark:text-white uppercase tracking-widest text-xs">
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
      className="max-w-4xl mx-auto space-y-6 pb-32 px-2 md:px-0"
    >
      {/* --- Page Header --- */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-black text-brand-blue dark:text-white tracking-tight">Transactions</h1>
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em]">Live History Activity</p>
        </div>
        <div className="flex gap-2">
           <button 
             onClick={handleExportPDF}
             className="p-3 bg-brand-blue/5 dark:bg-white/5 text-brand-blue dark:text-white rounded-xl hover:bg-brand-blue/10 transition-all active:scale-95"
             title="Export Report"
           >
             <Download className="w-5 h-5" />
           </button>
        </div>
      </div>

      {/* --- Condensed Summary Card (Merged Inflow/Outflow) --- */}
      <div className="bg-white dark:bg-[#0C0C0F] p-4 md:p-6 rounded-[32px] border border-neutral-100 dark:border-white/5 shadow-sm flex items-center justify-between">
         <div className="flex flex-1 items-center gap-4 border-r border-neutral-100 dark:border-white/5 pr-6">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[8px] font-black text-neutral-400 dark:text-white/40 uppercase tracking-[0.2em] mb-0.5">Inflow</p>
              <h3 className="text-xl font-heading font-black text-emerald-600 tracking-tighter">₹{totals.income.toLocaleString()}</h3>
            </div>
         </div>
         <div className="flex flex-1 items-center gap-4 pl-6">
            <div className="w-10 h-10 bg-rose-50 dark:bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-600">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[8px] font-black text-neutral-400 dark:text-white/40 uppercase tracking-[0.2em] mb-0.5">Outflow</p>
              <h3 className="text-xl font-heading font-black text-rose-600 tracking-tighter">₹{totals.expense.toLocaleString()}</h3>
            </div>
         </div>
      </div>

      {/* --- Filter & Navigation Bar --- */}
      <div className="sticky top-4 z-40 space-y-3 pointer-events-none">
        <div className="pointer-events-auto bg-white/80 dark:bg-[#060608]/80 backdrop-blur-xl p-2 rounded-[24px] border border-neutral-200 dark:border-white/10 shadow-xl flex flex-col md:flex-row gap-2">
          
          <div className="flex bg-neutral-100 dark:bg-white/5 p-1 rounded-xl overflow-x-auto scrollbar-hide">
            {(['MONTH', 'YEAR', 'ALL', 'CUSTOM'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  granularity === g 
                    ? 'bg-white dark:bg-[#333333] text-brand-blue dark:text-white shadow-sm' 
                    : 'text-neutral-400 hover:text-neutral-500'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="flex-1 flex gap-2">
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <input 
                type="text" placeholder="Search parameters..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 bg-neutral-50 dark:bg-white/5 border border-transparent focus:border-neutral-200 dark:focus:border-white/10 pl-10 pr-4 rounded-xl text-xs font-bold text-brand-blue dark:text-white outline-none transition-all"
              />
            </div>
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`px-4 rounded-xl flex items-center justify-center gap-2 border-2 transition-all ${isFilterOpen ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white dark:bg-white/5 border-neutral-100 dark:border-white/5 text-neutral-400'}`}
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* --- Contextual Overlays --- */}
        <AnimatePresence>
          {granularity === 'MONTH' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="pointer-events-auto max-w-xs mx-auto">
              <MonthNavigator />
            </motion.div>
          )}

          {isFilterOpen && (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="pointer-events-auto bg-white dark:bg-[#111111] p-5 rounded-[28px] border border-neutral-200 dark:border-white/10 shadow-2xl space-y-4">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest ml-1">Flow Direction</label>
                    <div className="flex bg-neutral-50 dark:bg-black/20 p-1 rounded-xl">
                      {(['ALL', 'DEBIT', 'CREDIT'] as const).map(t => (
                        <button key={t} onClick={() => setTypeFilter(t)} className={`flex-1 py-1.5 rounded-lg text-[9px] font-black tracking-widest transition-all ${typeFilter === t ? 'bg-white dark:bg-white/10 shadow-sm text-brand-blue dark:text-white' : 'text-neutral-400'}`}>{t}</button>
                      ))}
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest ml-1">Category Domain</label>
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-full bg-neutral-50 dark:bg-black/20 border-neutral-100 dark:border-white/5 border px-3 py-2 rounded-xl text-xs font-bold text-brand-blue dark:text-white outline-none appearance-none">
                      <option value="ALL">All Categories</option>
                      {Object.keys(CATEGORY_ICONS).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                 </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[8px] font-black text-neutral-400 uppercase tracking-widest ml-1">Select Account Scope</label>
                  <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))} className="w-full bg-neutral-50 dark:bg-black/20 border-neutral-100 dark:border-white/5 border px-3 py-2 rounded-xl text-xs font-bold text-brand-blue dark:text-white outline-none appearance-none">
                    <option value="ALL">Everything Combined</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.bankName} (..{acc.accountLast4})</option>)}
                  </select>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- Transactions List --- */}
      <div className="space-y-4">
        {filteredTxs.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center opacity-40">
            <div className="w-20 h-20 bg-neutral-100 dark:bg-white/5 rounded-[24px] flex items-center justify-center mb-6">
              <ListOrdered className="w-8 h-8 text-neutral-300" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Transactions Found</p>
            <p className="text-[8px] font-bold text-neutral-400 uppercase mt-2">Adjust filters or select 'ALL' view</p>
          </div>
        ) : (
          filteredTxs.map((tx, idx) => {
            const date = new Date(tx.dateTime);
            const showDateHeader = idx === 0 || !isSameDay(date, new Date(filteredTxs[idx-1].dateTime));
            
            return (
              <div key={tx.id || idx} className="space-y-2">
                {showDateHeader && (
                  <div className="pt-6 flex items-center gap-3">
                     <span className="text-[9px] font-black text-neutral-400 dark:text-white/30 uppercase tracking-[0.2em] whitespace-nowrap">
                       {format(date, 'EEEE, dd MMM yyyy')}
                     </span>
                     <div className="h-px flex-1 bg-neutral-100 dark:bg-white/5" />
                  </div>
                )}
                
                <motion.div 
                  initial={{ opacity: 0, y: 5 }} 
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedTx(tx)}
                  className="bg-white dark:bg-[#0C0C0F] group hover:bg-neutral-50 dark:hover:bg-white/5 border border-neutral-100 dark:border-white/5 p-4 rounded-[24px] shadow-sm flex items-center gap-4 transition-all cursor-pointer active:scale-[0.99]"
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl border ${CATEGORY_COLORS[tx.category || 'Other'] || 'bg-neutral-50'} shrink-0`}>
                    {CATEGORY_ICONS[tx.category || 'Other'] || '📝'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                     <h4 className="text-sm font-black text-brand-blue dark:text-white truncate uppercase tracking-tight leading-tight mb-1">
                       {tx.party || tx.category || 'Untitled'}
                     </h4>
                     <div className="flex items-center gap-2">
                        <span className="text-[8px] font-bold text-neutral-400 tracking-widest uppercase">{format(date, 'hh:mm a')}</span>
                        <div className="w-1 h-1 rounded-full bg-neutral-200" />
                        <span className="text-[8px] font-black text-brand-blue/30 dark:text-white/20 tracking-widest uppercase">{tx.category}</span>
                     </div>
                  </div>

                  <div className="text-right">
                     <p className={`text-lg font-heading font-black tracking-tighter ${tx.type === 'DEBIT' ? 'text-rose-500' : 'text-emerald-500'}`}>
                       {tx.type === 'DEBIT' ? '-' : '+'}₹{Number(tx.amount).toLocaleString()}
                     </p>
                  </div>
                </motion.div>
              </div>
            );
          })
        )}
      </div>

      {/* --- Detail Backdrop Drawer --- */}
      <AnimatePresence>
        {selectedTx && (
          <>
            <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setSelectedTx(null)}
               className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
            />
            <motion.div 
               initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0C0C0F] z-[101] rounded-t-[40px] p-8 max-w-lg mx-auto shadow-2xl border-t border-white/10"
            >
               <div className="w-12 h-1 bg-neutral-100 dark:bg-white/10 rounded-full mx-auto mb-8" />
               
               <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-neutral-50 dark:bg-white/5 rounded-[24px] flex items-center justify-center text-3xl border border-neutral-100 dark:border-white/10">
                       {CATEGORY_ICONS[selectedTx.category || 'Other'] || '📝'}
                    </div>
                    <div>
                       <span className="text-[8px] font-black text-brand-blue/40 dark:text-white/30 uppercase tracking-widest block mb-1">{selectedTx.category} Ledger</span>
                       <h2 className="text-2xl font-heading font-black text-brand-blue dark:text-white uppercase tracking-tight">{selectedTx.party || 'Detail View'}</h2>
                       <p className="text-[9px] font-bold text-neutral-400 mt-0.5 uppercase tracking-widest">{format(new Date(selectedTx.dateTime), 'dd MMM yyyy, hh:mm a')}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedTx(null)} className="p-2.5 bg-neutral-50 dark:bg-white/5 rounded-full text-neutral-400">
                    <X className="w-5 h-5" />
                  </button>
               </div>

               <div className="bg-neutral-50 dark:bg-white/5 p-6 rounded-[32px] border border-neutral-200/50 dark:border-white/5 mb-8 text-center">
                  <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-2">Value</p>
                  <h3 className={`text-5xl font-heading font-black tracking-tighter ${selectedTx.type === 'DEBIT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {selectedTx.type === 'DEBIT' ? '-' : '+'}₹{Number(selectedTx.amount).toLocaleString()}
                  </h3>
               </div>

               {selectedTx.note && (
                 <div className="mb-8 px-2">
                   <p className="text-sm font-bold text-brand-blue dark:text-white opacity-80 italic leading-relaxed pl-4 border-l-4 border-brand-blue/10">
                     "{selectedTx.note}"
                   </p>
                 </div>
               )}

               <div className="grid grid-cols-2 gap-3">
                 <button 
                   onClick={() => { navigate(`/?edit=${selectedTx.id}`); setSelectedTx(null); }}
                   className="py-4 bg-brand-blue text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                 >
                   <Edit3 className="w-4 h-4" /> Edit
                 </button>
                 <button 
                   onClick={() => deleteTransaction(selectedTx.id!)}
                   className="py-4 bg-rose-50 text-rose-600 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"
                 >
                   <Trash2 className="w-4 h-4" /> Delete
                 </button>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
