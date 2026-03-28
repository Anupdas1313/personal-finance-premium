import { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, ZoomIn, ZoomOut, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Calendar, FileText, Share2, ArrowUpRight, ArrowDownLeft, Wallet, Landmark, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toBlob } from 'html-to-image';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';

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
  const [datePreset, setDatePreset] = useState('CUSTOM');
  
  const [startDate, setStartDate] = useState(startParam ? format(new Date(startParam), 'yyyy-MM-dd') : '');
  const [endDate, setEndDate] = useState(endParam ? format(new Date(endParam), 'yyyy-MM-dd') : '');

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
      case 'LAST_10_DAYS':
        setStartDate(format(subDays(today, 9), 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
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
      case 'CUSTOM':
        // keep current dates
        break;
    }
  };

  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'}>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const summaryRef = useRef<HTMLDivElement>(null);
  
  const { categories: appCategories } = useCategories();
  const { tags } = useTags();

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));
  const handleZoomReset = () => setZoom(1);

  const allTransactionsRaw = useLiveQuery(() => {
    if (startDate && endDate) {
      const start = startOfDay(new Date(startDate));
      const end = endOfDay(new Date(endDate));
      return db.transactions.where('dateTime').between(start, end, true, true).toArray();
    }
    return db.transactions.toArray();
  }, [startDate, endDate]) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  const uniqueCategories = useMemo(() => {
    const cats = new Set(allTransactionsRaw.map(tx => tx.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [allTransactionsRaw]);

  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...allTransactionsRaw];

    // 1. Date Range Filter
    if (startDate && endDate) {
      try {
        const start = startOfDay(new Date(startDate)).getTime();
        const end = endOfDay(new Date(endDate)).getTime();
        result = result.filter(tx => {
          const txDate = new Date(tx.dateTime).getTime();
          return txDate >= start && txDate <= end;
        });
      } catch (e) {
        // Ignore invalid dates
      }
    }

    // 2. Global Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(tx => {
        const partyMatch = tx.party?.toLowerCase().includes(query);
        const noteMatch = tx.note?.toLowerCase().includes(query);
        const accountMatch = accounts.find(a => a.id === tx.accountId)?.bankName.toLowerCase().includes(query);
        const categoryMatch = tx.category?.toLowerCase().includes(query);
        
        const resolvedMethod = tx.paymentMethod === 'UPI' ? 'upi' : tx.paymentMethod === 'Bank' ? 'bank' : 'cash';
        const methodMatch = resolvedMethod.includes(query);
        
        const upiAppMatch = tx.upiApp?.toLowerCase().includes(query);
        const amountMatch = tx.amount?.toString().includes(query);
        const typeMatch = tx.type?.toLowerCase().includes(query);
        
        return partyMatch || noteMatch || accountMatch || categoryMatch || methodMatch || upiAppMatch || amountMatch || typeMatch;
      });
    }

    // 3. Multi-Filters
    if (filterType !== 'ALL') {
      result = result.filter(tx => tx.type === filterType);
    }
    if (filterCategory !== 'ALL') {
      result = result.filter(tx => tx.category === filterCategory);
    }
    if (filterAccount !== 'ALL') {
      result = result.filter(tx => String(tx.accountId) === filterAccount);
    }
    if (filterPaymentMethod !== 'ALL') {
      result = result.filter(tx => {
        const resolvedMethod = tx.paymentMethod === 'UPI' ? 'UPI' : tx.paymentMethod === 'Bank' ? 'Bank' : 'Cash';
        return resolvedMethod === filterPaymentMethod;
      });
    }
    if (filterExpenseType !== 'ALL') {
      result = result.filter(tx => tx.expenseType === filterExpenseType);
    }

    // 4. Sorting
    result.sort((a, b) => {
      if (sortConfig.key === 'date') {
        const dateA = new Date(a.dateTime).getTime();
        const dateB = new Date(b.dateTime).getTime();
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortConfig.key === 'amount') {
        const amountA = a.amount || 0;
        const amountB = b.amount || 0;
        return sortConfig.direction === 'asc' ? amountA - amountB : amountB - amountA;
      }
      if (sortConfig.key === 'category') {
        const catA = a.category || '';
        const catB = b.category || '';
        return sortConfig.direction === 'asc' ? catA.localeCompare(catB) : catB.localeCompare(catA);
      }
      return 0;
    });

    return result;
  }, [allTransactionsRaw, accounts, startDate, endDate, searchQuery, filterType, filterCategory, filterAccount, filterPaymentMethod, filterExpenseType, sortConfig]);

  // Reset pagination when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterCategory, filterAccount, filterPaymentMethod, filterExpenseType, startDate, endDate, sortConfig]);

  // Summary calculations
  const summary = useMemo(() => {
    return filteredAndSortedTransactions.reduce((acc, tx) => {
      if (tx.type === 'CREDIT') acc.received += (tx.amount || 0);
      if (tx.type === 'DEBIT') acc.spent += (tx.amount || 0);
      return acc;
    }, { received: 0, spent: 0 });
  }, [filteredAndSortedTransactions]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedTransactions.length / itemsPerPage));
  const paginatedTransactions = filteredAndSortedTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'desc' }; // Default to desc for new column
    });
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ChevronDown className="w-4 h-4 text-[#B0B0B0] dark:text-[#666666] opacity-0 group-hover:opacity-100" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 text-[#222222] dark:text-[#F7F7F7]" /> : <ChevronDown className="w-4 h-4 text-[#222222] dark:text-[#F7F7F7]" />;
  };

  const handleExportCSV = async () => {
    const headers = ['Date', 'Time', 'Type', 'Category', 'Name', 'Note', 'Amount', 'Payment Method', 'Account'];
    const rows = filteredAndSortedTransactions.map(tx => {
      const typeLabel = tx.type === 'CREDIT' ? '(Received/Credited)' : '(Paid to / Debit)';
      return [
        safeFormatDate(tx.dateTime, 'yyyy-MM-dd'),
        safeFormatDate(tx.dateTime, 'HH:mm:ss'),
        typeLabel,
        tx.category,
        `"${(tx.party || '').replace(/"/g, '""')}"`,
        `"${(tx.note || '').replace(/"/g, '""')}"`,
        tx.amount || 0,
        tx.paymentMethod === 'UPI' ? `UPI (${tx.upiApp || ''})` : tx.paymentMethod,
        accounts.find(a => a.id === tx.accountId)?.bankName || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const fileName = `transactions_${startDate || 'all'}_to_${endDate || 'all'}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    
    if (isIOS || isAndroid) {
      const reader = new FileReader();
      reader.onload = function() {
        const dataUrl = reader.result as string;
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.click();
      };
      reader.readAsDataURL(blob);
    } else {
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Transaction Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Period: ${startDate || 'All'} to ${endDate || 'All'}`, 14, 30);
    doc.text(`Total Spent: Rs. ${summary.spent.toLocaleString('en-IN')}`, 14, 36);
    doc.text(`Total Received: Rs. ${summary.received.toLocaleString('en-IN')}`, 14, 42);

    const tableColumn = ["Date", "Type", "Category", "Name", "Note", "Amount", "Account"];
    const tableRows = filteredAndSortedTransactions.map(tx => {
      const typeLabel = tx.type === 'CREDIT' ? 'Credit' : 'Debit';
      return [
        safeFormatDate(tx.dateTime, 'yyyy-MM-dd'),
        typeLabel,
        tx.category || '',
        tx.party || '',
        tx.note || '',
        `${tx.type === 'CREDIT' ? '+' : '-'} Rs. ${tx.amount || 0}`,
        accounts.find(a => a.id === tx.accountId)?.bankName || ''
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 55,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 34, 34] }
    });

    doc.save(`transactions_report_${startDate || 'all'}_to_${endDate || 'all'}.pdf`);
  };

  const handleShareSummary = async () => {
    if (!summaryRef.current) return;
    try {
      const blob = await toBlob(summaryRef.current, { backgroundColor: '#f9fafb', pixelRatio: 2 });
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'summary.png';
      link.click();
    } catch (error) {
      console.error('Error sharing summary:', error);
    }
  };

  const handleShareTransaction = async (tx: any) => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '400px';
    container.style.padding = '24px';
    container.style.backgroundColor = '#ffffff';
    container.style.borderRadius = '16px';
    container.style.fontFamily = 'sans-serif';
    container.style.color = '#111827';
    
    const isCredit = tx.type === 'CREDIT';
    const amountColor = isCredit ? '#059669' : '#e11d48';
    const typeLabel = isCredit ? 'Received' : 'Paid';
    const merchantNote = tx.party && tx.note ? `${tx.party} - ${tx.note}` : tx.party || tx.note || 'Transaction';
    const accountName = accounts.find(a => a.id === tx.accountId)?.bankName || 'Unknown Account';

    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">${typeLabel}</div>
        <div style="font-size: 36px; font-weight: bold; color: ${amountColor}; margin: 8px 0;">
          ${isCredit ? '+' : '-'}₹${(tx.amount || 0).toLocaleString('en-IN')}
        </div>
        <div style="font-size: 18px; font-weight: 500;">${merchantNote}</div>
      </div>
      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 16px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280;">Date</span>
          <span style="font-weight: 500;">${safeFormatDate(tx.dateTime, 'MMM d, yyyy - hh:mm a')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280;">Account</span>
          <span style="font-weight: 500;">${accountName}</span>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const blob = await toBlob(container, { pixelRatio: 2 });
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'transaction.png';
      link.click();
      document.body.removeChild(container);
    } catch (error) {
      console.error('Error sharing transaction:', error);
      document.body.removeChild(container);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#111111] text-[#222222] dark:text-[#F7F7F7] flex flex-col">
      <header className="bg-white dark:bg-[#111111] border-b border-[#EBEBEB] dark:border-[#222222] px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <button 
            onClick={() => navigate('/transactions')} 
            className="p-2 -ml-2 sm:ml-0 text-[#111111] dark:text-[#A0A0A0] hover:bg-neutral-100 dark:hover:bg-[#222222] dark:bg-[#1A1A1A] rounded-full transition-colors shrink-0 border border-[#EBEBEB] dark:border-transparent"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-heading font-semibold text-brand-blue dark:text-[#F7F7F7]">Manifest</h1>
            <p className="text-[10px] text-brand-blue/30 dark:text-[#A0A0A0] font-semibold uppercase tracking-[0.2em] mt-0.5">
              {filteredAndSortedTransactions.length} of {allTransactionsRaw.length} points
            </p>
          </div>

        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-neutral-100 dark:bg-[#1A1A1A] rounded-xl p-1">
            <button onClick={handleZoomOut} className="p-1.5 text-[#717171] dark:text-[#A0A0A0] hover:bg-white dark:bg-[#111111] hover:shadow-sm rounded-lg transition-all" title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={handleZoomReset} className="px-2 text-xs font-bold text-[#222222] dark:text-[#F7F7F7] hover:bg-white dark:bg-[#111111] hover:shadow-sm rounded-lg transition-all h-7" title="Reset Zoom">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={handleZoomIn} className="p-1.5 text-[#717171] dark:text-[#A0A0A0] hover:bg-white dark:bg-[#111111] hover:shadow-sm rounded-lg transition-all" title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportPDF} className="p-2 bg-white dark:bg-[#111111] border border-brand-blue/10 dark:border-[#222222] text-brand-blue dark:text-[#F7F7F7] rounded-xl hover:bg-brand-blue/5 transition-all">
              <FileText className="w-4 h-4" />
            </button>
            <button onClick={handleExportCSV} className="p-2 bg-brand-blue text-white rounded-xl hover:bg-brand-blue/90 shadow-lg shadow-brand-blue/10 transition-all">
              <Download className="w-4 h-4" />
            </button>
          </div>

        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 bg-[#F7F7F7] dark:bg-[#0A0A0A] flex flex-col gap-6">
        <div className="relative">
          <div ref={summaryRef} className="flex flex-col gap-4 p-2 -m-2 rounded-xl bg-[#F7F7F7] dark:bg-[#0A0A0A]">
            <div className="relative bg-white dark:bg-[#111111] rounded-[24px] border border-[#EBEBEB] dark:border-[#222222] shadow-[0_8px_30px_rgba(0,0,0,0.12)] py-5">
              <button onClick={handleShareSummary} className="absolute top-3 right-3 p-1.5 text-[#111111] dark:text-[#A0A0A0] rounded-full border border-[#EBEBEB] dark:border-[#222222] bg-white dark:bg-[#111111]">
                <Share2 className="w-4 h-4" />
              </button>

              
              <div className="grid grid-cols-3 divide-x divide-[#EBEBEB]">
                <div className="flex flex-col items-center justify-center text-center px-1">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-brand-red" />
                    <span className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em]">Outflow</span>
                  </div>
                  <div className="text-base sm:text-2xl font-semibold text-brand-red truncate w-full">
                    <CountUp value={summary.spent} prefix="-₹" />
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center text-center px-1">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <ArrowUpRight className="w-3.5 h-3.5 text-brand-green" />
                    <span className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em]">Inflow</span>
                  </div>
                  <div className="text-base sm:text-2xl font-semibold text-brand-green truncate w-full">
                    <CountUp value={summary.received} prefix="+₹" />
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center text-center px-1">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Wallet className="w-3.5 h-3.5 text-brand-blue dark:text-[#F7F7F7]" />
                    <span className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em]">Net Change</span>
                  </div>

                  <div className={`text-base sm:text-2xl font-semibold truncate w-full ${summary.received - summary.spent >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                    <CountUp value={Math.abs(summary.received - summary.spent)} prefix={summary.received - summary.spent >= 0 ? '+₹' : '-₹'} />
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111111] p-3 sm:p-4 rounded-[24px] border border-[#EBEBEB] dark:border-[#222222] shadow-[0_6px_16px_rgba(0,0,0,0.04)] flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#717171] dark:text-[#A0A0A0]" />
                <input
                type="text"
                placeholder="Locate within manifest..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/10 dark:border-[#222222] rounded-xl outline-none text-sm font-medium text-brand-blue dark:text-[#F7F7F7] focus:ring-2 focus:ring-brand-cyan transition-all"
              />

            </div>
            <button 
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className="p-2.5 rounded-xl border border-[#EBEBEB] dark:border-[#222222] bg-white dark:bg-[#111111] text-[#717171] dark:text-[#A0A0A0]"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {isFiltersExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex flex-col gap-4 pt-4 border-t border-[#EBEBEB] dark:border-[#222222]">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Date Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-brand-blue/40 uppercase tracking-widest pl-1">Timeline</label>
                  <select
                    value={datePreset}
                    onChange={(e) => handleDatePresetChange(e.target.value)}
                    className="w-full px-3 py-2 border border-[#EBEBEB] dark:border-[#222222] rounded-xl text-xs font-semibold outline-none bg-white dark:bg-[#111111] text-brand-blue dark:text-white"
                  >
                    <option value="ALL_TIME">All Time</option>
                    <option value="TODAY">Today</option>
                    <option value="YESTERDAY">Yesterday</option>
                    <option value="THIS_WEEK">This Week</option>
                    <option value="THIS_MONTH">This Month</option>
                    <option value="CUSTOM">Custom Range</option>
                  </select>
                </div>

                {/* Type Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-brand-blue/40 uppercase tracking-widest pl-1">Nature</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-3 py-2 border border-[#EBEBEB] dark:border-[#222222] rounded-xl text-xs font-semibold outline-none bg-white dark:bg-[#111111] text-brand-blue dark:text-white"
                  >
                    <option value="ALL">All Types</option>
                    <option value="DEBIT">Outflow (Debit)</option>
                    <option value="CREDIT">Inflow (Credit)</option>
                    <option value="TRANSFER">Inter-Account</option>
                  </select>
                </div>

                {/* Account Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-brand-blue/40 uppercase tracking-widest pl-1">Sub-Ledger</label>
                  <select
                    value={filterAccount}
                    onChange={(e) => setFilterAccount(e.target.value)}
                    className="w-full px-3 py-2 border border-[#EBEBEB] dark:border-[#222222] rounded-xl text-xs font-semibold outline-none bg-white dark:bg-[#111111] text-brand-blue dark:text-white"
                  >
                    <option value="ALL">All Accounts</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={String(acc.id)}>{acc.bankName}</option>
                    ))}
                  </select>
                </div>

                {/* Classification Filter (Tags) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-brand-blue/40 uppercase tracking-widest pl-1">Classifier</label>
                  <select
                    value={filterExpenseType}
                    onChange={(e) => setFilterExpenseType(e.target.value)}
                    className="w-full px-3 py-2 border border-[#EBEBEB] dark:border-[#222222] rounded-xl text-xs font-semibold outline-none bg-white dark:bg-[#111111] text-brand-blue dark:text-white"
                  >
                    <option value="ALL">All Tags</option>
                    {tags.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-brand-blue/40 uppercase tracking-widest pl-1">Taxonomy</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-[#EBEBEB] dark:border-[#222222] rounded-xl text-xs font-semibold outline-none bg-white dark:bg-[#111111] text-brand-blue dark:text-white"
                  >
                    <option value="ALL">All Categories</option>
                    {appCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {datePreset === 'CUSTOM' && (
                <div className="flex items-center gap-3 p-3 bg-neutral-100 dark:bg-[#1A1A1A] rounded-2xl animate-in fade-in slide-in-from-top-2">
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[8px] font-bold text-brand-blue/30 uppercase tracking-[0.2em] pl-1">Commencement</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-1.5 border border-[#EBEBEB] dark:border-[#222222] rounded-xl text-xs font-semibold bg-white dark:bg-[#111111]" />
                  </div>
                  <div className="text-brand-blue/20 dark:text-[#333333] pt-4 font-bold">➔</div>
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-[8px] font-bold text-brand-blue/30 uppercase tracking-[0.2em] pl-1">Termination</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-1.5 border border-[#EBEBEB] dark:border-[#222222] rounded-xl text-xs font-semibold bg-white dark:bg-[#111111]" />
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        <div className="bg-white dark:bg-[#111111] border border-brand-blue/5 dark:border-[#222222] rounded-[24px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-brand-blue text-white uppercase tracking-[0.2em] text-[10px] font-semibold">


                <tr>
                  <th className="px-4 py-3 cursor-pointer" onClick={() => handleSort('date')}>Date <SortIcon columnKey="date" /></th>
                  <th className="hidden md:table-cell px-4 py-3">Type</th>
                  <th className="hidden sm:table-cell px-4 py-3">Category</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="hidden lg:table-cell px-4 py-3">Note</th>
                  <th className="px-4 py-3 text-right" onClick={() => handleSort('amount')}>Amount <SortIcon columnKey="amount" /></th>
                  <th className="hidden md:table-cell px-4 py-3">Account</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EBEBEB] dark:divide-[#222222]">
                {paginatedTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors border-b border-[#EBEBEB] dark:border-transparent">
                    <td className="px-4 py-4 sm:py-3 text-brand-blue dark:text-white">
                      <div className="font-semibold text-sm">
                        {safeFormatDate(tx.dateTime, 'MMM d, yyyy')}
                      </div>
                      <div className="text-[10px] text-brand-blue/30 dark:text-[#A0A0A0] md:hidden font-semibold uppercase tracking-widest">
                        {safeFormatDate(tx.dateTime, 'hh:mm a')}
                      </div>
                    </td>


                    <td className="hidden md:table-cell px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-widest ${tx.type === 'CREDIT' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-red/10 text-brand-red'}`}>
                        {tx.type}
                      </span>
                    </td>

                    <td className="hidden sm:table-cell px-4 py-3 font-semibold text-[#525252] dark:text-[#A0A0A0]">{tx.category}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-brand-blue dark:text-[#F7F7F7] max-w-[120px] sm:max-w-[200px] truncate">
                        {tx.party || '—'}
                      </div>
                      <div className="text-[10px] text-brand-blue/30 dark:text-[#A0A0A0] lg:hidden max-w-[120px] truncate font-semibold uppercase tracking-widest">
                        {tx.note}
                      </div>
                    </td>

                    <td className="hidden lg:table-cell px-4 py-3 font-medium text-[#525252] dark:text-[#A0A0A0] max-w-[200px] truncate">
                      {tx.note || '—'}
                    </td>

                    <td className={`px-4 py-3 text-right font-semibold ${tx.type === 'CREDIT' ? 'text-brand-green' : 'text-brand-red'}`}>
                      {tx.type === 'CREDIT' ? '+' : '-'}₹{(tx.amount || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="hidden md:table-cell px-4 py-3 font-medium text-[#717171] dark:text-[#A0A0A0]">
                      {accounts.find(a => a.id === tx.accountId)?.bankName || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {totalPages > 1 && (
            <div className="px-4 py-3 flex items-center justify-between border-t border-brand-blue/5">
                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1 px-4 border border-brand-blue/10 rounded-xl text-[10px] font-semibold uppercase tracking-widest disabled:opacity-50 hover:bg-brand-blue/5 transition-all">Prev</button>
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-blue/40">Page {currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-1 px-4 border border-brand-blue/10 rounded-xl text-[10px] font-semibold uppercase tracking-widest disabled:opacity-50 hover:bg-brand-blue/5 transition-all">Next</button>
            </div>

          )}
        </div>
      </main>
    </div>
  );
}
