import { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Download, ZoomIn, ZoomOut, Search, ChevronUp, ChevronDown, 
  ChevronLeft, ChevronRight, Calendar, FileText, Share2, ArrowUpRight, 
  ArrowDownLeft, Wallet, Filter, Printer, MoreHorizontal, CheckCircle2,
  Clock, Tag, CreditCard, Banknote, User
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toBlob } from 'html-to-image';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { useCategories } from '../hooks/useCategories';

function CountUp({ value, prefix = '', suffix = '' }: { value: number, prefix?: string, suffix?: string }) {
  const spring = useSpring(0, { bounce: 0, duration: 1500 });
  const display = useTransform(spring, (current) => 
    `${prefix}${Math.round(current).toLocaleString('en-IN')}${suffix}`
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

const safeFormatDate = (dateVal: any, formatStr: string) => {
  try {
    if (!dateVal) return '—';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return format(d, formatStr);
  } catch (e) {
    return '—';
  }
};

export default function TransactionTable() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  
  const [zoom, setZoom] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterAccount, setFilterAccount] = useState('ALL');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('ALL');
  const [filterExpenseType, setFilterExpenseType] = useState('ALL');
  const [datePreset, setDatePreset] = useState(startParam ? 'CUSTOM' : 'THIS_MONTH');
  
  const [startDate, setStartDate] = useState(startParam ? format(new Date(startParam), 'yyyy-MM-dd') : format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(endParam ? format(new Date(endParam), 'yyyy-MM-dd') : format(endOfMonth(new Date()), 'yyyy-MM-dd'));

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    switch (preset) {
      case 'TODAY':
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'YESTERDAY':
        const yesterday = subDays(today, 1);
        setStartDate(format(yesterday, 'yyyy-MM-dd'));
        setEndDate(format(yesterday, 'yyyy-MM-dd'));
        break;
      case 'THIS_WEEK':
        setStartDate(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'LAST_30_DAYS':
        setStartDate(format(subDays(today, 29), 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'THIS_MONTH':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
        break;
      case 'ALL_TIME':
        setStartDate('');
        setEndDate('');
        break;
    }
  };

  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'}>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const reportRef = useRef<HTMLDivElement>(null);
  
  const { categories: appCategories } = useCategories();

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  const allTransactionsRaw = useLiveQuery(() => db.transactions.toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  const uniqueCategories = useMemo(() => {
    const cats = new Set(allTransactionsRaw.map(tx => tx.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [allTransactionsRaw]);

  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...allTransactionsRaw];

    if (startDate && endDate) {
      try {
        const start = startOfDay(new Date(startDate)).getTime();
        const end = endOfDay(new Date(endDate)).getTime();
        result = result.filter(tx => {
          const txDate = new Date(tx.dateTime).getTime();
          return txDate >= start && txDate <= end;
        });
      } catch (e) {}
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(tx => 
        tx.party?.toLowerCase().includes(q) || 
        tx.note?.toLowerCase().includes(q) ||
        tx.category?.toLowerCase().includes(q) ||
        tx.amount?.toString().includes(q)
      );
    }

    if (filterType !== 'ALL') result = result.filter(tx => tx.type === filterType);
    if (filterCategory !== 'ALL') result = result.filter(tx => tx.category === filterCategory);
    if (filterAccount !== 'ALL') result = result.filter(tx => String(tx.accountId) === filterAccount);
    if (filterExpenseType !== 'ALL') result = result.filter(tx => tx.expenseType === filterExpenseType);

    result.sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      if (sortConfig.key === 'date') return (new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()) * dir;
      if (sortConfig.key === 'amount') return ((a.amount || 0) - (b.amount || 0)) * dir;
      if (sortConfig.key === 'category') return (a.category || '').localeCompare(b.category || '') * dir;
      return 0;
    });

    return result;
  }, [allTransactionsRaw, startDate, endDate, searchQuery, filterType, filterCategory, filterAccount, filterExpenseType, sortConfig]);

  const summary = useMemo(() => {
    const res = filteredAndSortedTransactions.reduce((acc, tx) => {
      if (tx.type === 'CREDIT') acc.received += (tx.amount || 0);
      else acc.spent += (tx.amount || 0);
      return acc;
    }, { received: 0, spent: 0 });
    return { ...res, net: res.received - res.spent };
  }, [filteredAndSortedTransactions]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedTransactions.length / itemsPerPage));
  const paginatedTransactions = filteredAndSortedTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (key: string) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ChevronDown className="w-3 h-3 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-[#222222] dark:text-[#F7F7F7]" /> : <ChevronDown className="w-3 h-3 text-[#222222] dark:text-[#F7F7F7]" />;
  };

  const exportPDF = async () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.setFontSize(22);
    doc.text('Transaction Table Report', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${format(new Date(), 'PPP p')} | Period: ${startDate || 'All'} to ${endDate || 'All'}`, 14, 28);
    
    const tableData = filteredAndSortedTransactions.map(tx => [
      format(new Date(tx.dateTime), 'yyyy-MM-dd HH:mm'),
      tx.type,
      tx.category || '-',
      tx.party || '-',
      tx.note || '-',
      tx.type === 'CREDIT' ? `+${tx.amount}` : `-${tx.amount}`,
      accounts.find(a => a.id === tx.accountId)?.bankName || '-'
    ]);

    autoTable(doc, {
      head: [['DateTime', 'Type', 'Category', 'Merchant/Party', 'Note', 'Amount', 'Account']],
      body: tableData,
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [40, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 250] }
    });
    doc.save('Transaction_Report.pdf');
  };

  const shareReportImage = async () => {
    if (!reportRef.current) return;
    try {
      const blob = await toBlob(reportRef.current, { backgroundColor: '#000000', pixelRatio: 2 });
      if (blob) {
        const item = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([item]);
        alert("Report copied to clipboard as image!");
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#F7F7F7] flex flex-col font-sans selection:bg-white/20">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-[#222222] bg-[#0A0A0A]/80 backdrop-blur-xl sticky top-0 z-50 px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/transactions')} 
            className="p-2 hover:bg-[#222222] rounded-full transition-all text-[#A0A0A0] hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="h-4 w-[1px] bg-[#222222]" />
          <div>
            <h1 className="text-sm font-black tracking-widest uppercase">FinTrack Pro <span className="text-[#666666] font-medium ml-2">/ Report</span></h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[#111111] border border-[#222222] rounded-full p-1 shadow-inner">
            <button onClick={handleZoomOut} className="p-1.5 hover:bg-[#222222] rounded-full transition-all text-[#666666] hover:text-white"><ZoomOut className="w-4 h-4" /></button>
            <button onClick={handleZoomReset} className="px-3 text-[10px] font-black">{Math.round(zoom * 100)}%</button>
            <button onClick={handleZoomIn} className="p-1.5 hover:bg-[#222222] rounded-full transition-all text-[#666666] hover:text-white"><ZoomIn className="w-4 h-4" /></button>
          </div>
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-[#111111] hover:bg-[#222222] border border-[#222222] rounded-xl text-xs font-bold transition-all">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={shareReportImage} className="p-2 bg-white text-black rounded-xl hover:scale-105 transition-all">
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-[1400px] mx-auto w-full flex flex-col gap-8">
        {/* KPI & Filters Row */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Summary Cards */}
          <div className="lg:col-span-8 grid grid-cols-3 gap-4">
            {[
              { label: 'Total Inflow', val: summary.received, color: 'text-emerald-400', icon: ArrowDownLeft, bg: 'bg-emerald-500/5' },
              { label: 'Total Outflow', val: summary.spent, color: 'text-rose-400', icon: ArrowUpRight, bg: 'bg-rose-500/5' },
              { label: 'Net Balance', val: summary.net, color: summary.net >= 0 ? 'text-blue-400' : 'text-orange-400', icon: Wallet, bg: 'bg-white/5' }
            ].map((card, i) => (
              <div key={i} className={`p-4 rounded-[24px] border border-[#222222] ${card.bg} relative overflow-hidden group`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`p-1.5 rounded-lg border border-[#222222] ${card.color}`}>
                    <card.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-black text-[#666666] uppercase tracking-widest">{card.label}</span>
                </div>
                <div className={`text-xl font-black ${card.color} tracking-tight`}>
                  <CountUp value={Math.abs(card.val)} prefix={card.val < 0 ? '-₹' : '₹'} />
                </div>
              </div>
            ))}
          </div>

          {/* Quick Filters */}
          <div className="lg:col-span-4 bg-[#0A0A0A] border border-[#222222] rounded-[24px] p-4 flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-[#666666]" />
              <select 
                value={datePreset} 
                onChange={(e) => handleDatePresetChange(e.target.value)}
                className="bg-transparent text-sm font-bold border-none outline-none focus:ring-0 text-[#F7F7F7] flex-1 cursor-pointer"
              >
                <option value="THIS_MONTH" className="bg-black">This Month</option>
                <option value="LAST_30_DAYS" className="bg-black">Last 30 Days</option>
                <option value="THIS_WEEK" className="bg-black">This Week</option>
                <option value="TODAY" className="bg-black">Today</option>
                <option value="ALL_TIME" className="bg-black">All Time</option>
                <option value="CUSTOM" className="bg-black">Custom Range</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#444444]" />
                <input 
                  type="text" 
                  placeholder="Filter table..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black border border-[#222222] rounded-xl pl-9 pr-4 py-2 text-xs font-medium outline-none focus:border-white/20 transition-all"
                />
              </div>
              <button 
                onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                className={`p-2 rounded-xl border border-[#222222] transition-all ${isFiltersExpanded ? 'bg-white text-black border-transparent' : 'bg-[#111111] text-[#666666]'}`}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>

        {/* Advanced Filters Drawer */}
        <AnimatePresence>
          {isFiltersExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#0A0A0A] border border-[#222222] rounded-[24px] p-6 grid grid-cols-2 md:grid-cols-4 gap-6 mb-4">
                {[
                  { label: 'Entry Type', val: filterType, set: setFilterType, options: [{id:'ALL',name:'All Types'}, {id:'CREDIT',name:'Credit/Inflow'}, {id:'DEBIT',name:'Debit/Outflow'}] },
                  { label: 'Category', val: filterCategory, set: setFilterCategory, options: [{id:'ALL',name:'All Categories'}, ...uniqueCategories.map(c => ({id:c, name:c}))] },
                  { label: 'Payment', val: filterPaymentMethod, set: setFilterPaymentMethod, options: [{id:'ALL',name:'All Methods'}, {id:'UPI',name:'UPI'}, {id:'Bank',name:'Bank'}, {id:'Cash',name:'Cash'}] },
                  { label: 'Account', val: filterAccount, set: setFilterAccount, options: [{id:'ALL',name:'All Accounts'}, ...accounts.map(a => ({id:String(a.id), name:a.bankName}))] }
                ].map((f, i) => (
                  <div key={i}>
                    <label className="text-[10px] font-black text-[#444444] uppercase tracking-widest mb-2 block">{f.label}</label>
                    <select 
                      value={f.val} 
                      onChange={(e) => f.set(e.target.value)}
                      className="w-full bg-[#111111] border border-[#222222] rounded-xl px-3 py-2 text-xs font-bold outline-none cursor-pointer hover:border-[#444444] transition-all"
                    >
                      {f.options.map(opt => <option key={opt.id} value={opt.id} className="bg-black">{opt.name}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The Main Table Component */}
        <div ref={reportRef} className="bg-[#0A0A0A] border border-[#222222] rounded-[32px] overflow-hidden shadow-2xl flex flex-col" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}>
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left text-[13px] border-collapse">
              <thead>
                <tr className="bg-[#111111] border-b border-[#222222]">
                  <th className="px-6 py-4 font-black text-[#666666] uppercase tracking-widest cursor-pointer group hover:text-white" onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-2">Date <SortIcon columnKey="date" /></div>
                  </th>
                  <th className="px-6 py-4 font-black text-[#666666] uppercase tracking-widest">Type</th>
                  <th className="px-6 py-4 font-black text-[#666666] uppercase tracking-widest cursor-pointer group hover:text-white" onClick={() => handleSort('category')}>
                    <div className="flex items-center gap-2">Category <SortIcon columnKey="category" /></div>
                  </th>
                  <th className="px-6 py-4 font-black text-[#666666] uppercase tracking-widest">Description</th>
                  <th className="px-6 py-4 font-black text-[#666666] uppercase tracking-widest">Note</th>
                  <th className="px-6 py-4 font-black text-[#666666] uppercase tracking-widest text-right cursor-pointer group hover:text-white" onClick={() => handleSort('amount')}>
                    <div className="flex items-center justify-end gap-2">Amount <SortIcon columnKey="amount" /></div>
                  </th>
                  <th className="px-6 py-4 font-black text-[#666666] uppercase tracking-widest">Account</th>
                  <th className="px-6 py-4 font-black text-[#666666] uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {paginatedTransactions.map((tx, idx) => (
                  <motion.tr 
                    key={tx.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="hover:bg-white/[0.02] transition-all group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[#222222] group-hover:bg-white transition-all shadow-[0_0_8px_rgba(255,255,255,0.1)]" />
                        <span className="font-black text-[#F7F7F7]">{safeFormatDate(tx.dateTime, 'MMM d, yyyy')}</span>
                      </div>
                      <div className="text-[10px] text-[#666666] font-medium ml-5">{safeFormatDate(tx.dateTime, 'hh:mm a')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${tx.type === 'CREDIT' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-[#444444]" />
                        <span className="font-bold text-[#A0A0A0]">{tx.category || 'Uncategorized'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-[#444444]" />
                        <span className="font-black text-white max-w-[180px] truncate">{tx.party || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[#666666] italic italic max-w-[200px] truncate block">{tx.note || '—'}</span>
                    </td>
                    <td className={`px-6 py-4 text-right font-black text-base ${tx.type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.type === 'CREDIT' ? '+' : '-'} ₹{(tx.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#111111] border border-[#222222] flex items-center justify-center">
                          <CreditCard className="w-3 h-3 text-[#444444]" />
                        </div>
                        <span className="font-bold text-[#A0A0A0]">{accounts.find(a => a.id === tx.accountId)?.bankName || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button className="p-2 hover:bg-[#222222] rounded-xl transition-all text-[#444444] hover:text-white">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
                {paginatedTransactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-32 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-20">
                        <FileText className="w-16 h-16" />
                        <p className="text-sm font-black uppercase tracking-[0.2em]">No Data Record Found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          <footer className="border-t border-[#222222] px-8 py-4 bg-[#0F0F0F] flex items-center justify-between">
            <div className="text-[10px] font-black text-[#444444] uppercase tracking-widest">
              Showing <span className="text-[#A0A0A0]">{paginatedTransactions.length}</span> of <span className="text-[#A0A0A0]">{filteredAndSortedTransactions.length}</span> result entries
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-[#222222] rounded-xl disabled:opacity-20 hover:bg-[#222222] transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).map((p, i, arr) => (
                  <div key={p} className="flex items-center">
                    {i > 0 && arr[i-1] !== p - 1 && <span className="mx-1 text-[#444444]">...</span>}
                    <button 
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-xl text-[11px] font-black transition-all ${currentPage === p ? 'bg-white text-black' : 'text-[#666666] hover:text-white'}`}
                    >
                      {p}
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-[#222222] rounded-xl disabled:opacity-20 hover:bg-[#222222] transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
