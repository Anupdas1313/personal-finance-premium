import { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { format, startOfDay, endOfDay } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, ZoomIn, ZoomOut, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Calendar, FileText, Share2, ArrowUpRight, ArrowDownLeft, Wallet, PieChart, Landmark, Sparkles, TrendingUp, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toBlob } from 'html-to-image';
import { motion, useSpring, useTransform } from 'framer-motion';

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
  
  const [startDate, setStartDate] = useState(startParam ? format(new Date(startParam), 'yyyy-MM-dd') : '');
  const [endDate, setEndDate] = useState(endParam ? format(new Date(endParam), 'yyyy-MM-dd') : '');

  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [isAccountBreakdownExpanded, setIsAccountBreakdownExpanded] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'}>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const summaryRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));
  const handleZoomReset = () => setZoom(1);

  const allTransactionsRaw = useLiveQuery(() => db.transactions.toArray()) || [];
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
  }, [allTransactionsRaw, accounts, startDate, endDate, searchQuery, filterType, filterCategory, filterAccount, filterPaymentMethod, sortConfig]);

  // Reset pagination when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterCategory, filterAccount, filterPaymentMethod, startDate, endDate, sortConfig]);

  // Summary calculations
  const summary = useMemo(() => {
    return filteredAndSortedTransactions.reduce((acc, tx) => {
      if (tx.type === 'CREDIT') acc.received += (tx.amount || 0);
      if (tx.type === 'DEBIT') acc.spent += (tx.amount || 0);
      return acc;
    }, { received: 0, spent: 0 });
  }, [filteredAndSortedTransactions]);

  const insights = useMemo(() => {
    const spentByCategory: Record<string, number> = {};
    const spentByAccount: Record<string, number> = {};
    const receivedByAccount: Record<string, number> = {};
    let largestTx: any = null;
    const merchantCounts: Record<string, number> = {};

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const categoryWeekly: Record<string, { thisWeek: number, lastWeek: number }> = {};

    filteredAndSortedTransactions.forEach(tx => {
      const amt = tx.amount || 0;
      const txDate = new Date(tx.dateTime);

      if (!largestTx || amt > (largestTx.amount || 0)) {
        largestTx = tx;
      }

      if (tx.party) {
        merchantCounts[tx.party] = (merchantCounts[tx.party] || 0) + 1;
      }

      if (tx.type === 'DEBIT') {
        if (tx.category) {
          spentByCategory[tx.category] = (spentByCategory[tx.category] || 0) + amt;
          
          if (!categoryWeekly[tx.category]) categoryWeekly[tx.category] = { thisWeek: 0, lastWeek: 0 };
          
          if (txDate >= oneWeekAgo && txDate <= now) {
            categoryWeekly[tx.category].thisWeek += amt;
          } else if (txDate >= twoWeeksAgo && txDate < oneWeekAgo) {
            categoryWeekly[tx.category].lastWeek += amt;
          }
        }
        if (tx.accountId) {
          spentByAccount[tx.accountId] = (spentByAccount[tx.accountId] || 0) + amt;
        }
      } else if (tx.type === 'CREDIT') {
        if (tx.accountId) {
          receivedByAccount[tx.accountId] = (receivedByAccount[tx.accountId] || 0) + amt;
        }
      }
    });

    const topCategories = Object.entries(spentByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    let patternMessage = null;
    if (topCategories.length > 0) {
      const topCat = topCategories[0][0];
      const weekly = categoryWeekly[topCat];
      if (weekly && weekly.lastWeek > 0) {
        const percentChange = Math.round(((weekly.thisWeek - weekly.lastWeek) / weekly.lastWeek) * 100);
        if (percentChange > 0) {
          patternMessage = `You've spent ${percentChange}% more on ${topCat} this week than last week.`;
        } else if (percentChange < 0) {
          patternMessage = `Great job! You've spent ${Math.abs(percentChange)}% less on ${topCat} this week than last week.`;
        }
      }
    }

    let mostFrequentMerchant = '';
    let maxCount = 0;
    for (const [merchant, count] of Object.entries(merchantCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequentMerchant = merchant;
      }
    }

    const insightCards = [];
    
    if (largestTx) {
      insightCards.push({
        id: 'largest-tx',
        title: 'Largest Transaction',
        content: `${largestTx.party || largestTx.note || largestTx.category || 'Unknown'}`,
        value: `₹${(largestTx.amount || 0).toLocaleString('en-IN')}`,
        subtext: safeFormatDate(largestTx.dateTime, 'MMM d, yyyy'),
        icon: <Sparkles className="w-6 h-6 text-indigo-200" />
      });
    }
    
    if (patternMessage) {
      insightCards.push({
        id: 'pattern',
        title: 'Spending Pattern',
        content: patternMessage,
        icon: <TrendingUp className="w-6 h-6 text-indigo-200" />
      });
    }
    
    if (mostFrequentMerchant && maxCount > 1) {
      insightCards.push({
        id: 'frequent-merchant',
        title: 'Most Frequent Merchant',
        content: mostFrequentMerchant,
        value: `${maxCount} times`,
        icon: <Landmark className="w-6 h-6 text-indigo-200" />
      });
    }
    
    insightCards.push({
      id: 'total-tx',
      title: 'Total Transactions',
      content: 'In this period',
      value: filteredAndSortedTransactions.length.toString(),
      icon: <FileText className="w-6 h-6 text-indigo-200" />
    });

    return {
      topCategories,
      spentByAccount,
      receivedByAccount,
      insightCards
    };
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
    if (sortConfig.key !== columnKey) return <ChevronDown className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 text-indigo-600" /> : <ChevronDown className="w-4 h-4 text-indigo-600" />;
  };

  const handleExportCSV = () => {
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

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${startDate || 'all'}_to_${endDate || 'all'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Transaction Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Period: ${startDate || 'All'} to ${endDate || 'All'}`, 14, 30);
    doc.text(`Total Spent: Rs. ${summary.spent.toLocaleString('en-IN')}`, 14, 36);
    doc.text(`Total Received: Rs. ${summary.received.toLocaleString('en-IN')}`, 14, 42);
    doc.text(`Net Balance: Rs. ${Math.abs(summary.received - summary.spent).toLocaleString('en-IN')} ${summary.received - summary.spent >= 0 ? '(+)' : '(-)'}`, 14, 48);

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
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`transactions_report_${startDate || 'all'}_to_${endDate || 'all'}.pdf`);
  };

  const handleShareSummary = async () => {
    if (!summaryRef.current) return;
    try {
      const blob = await toBlob(summaryRef.current, { backgroundColor: '#f9fafb', pixelRatio: 2 });
      if (!blob) return;
      const file = new File([blob], 'summary.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Transaction Summary',
          files: [file]
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'summary.png';
        link.click();
      }
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
          <span style="color: #6b7280;">Category</span>
          <span style="font-weight: 500;">${tx.category || '—'}</span>
        </div>
        ${tx.expenseType ? `
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280;">Type</span>
          <span style="font-weight: 500; background-color: #e0e7ff; color: #3730a3; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${tx.expenseType}</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280;">Account</span>
          <span style="font-weight: 500;">${accountName}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #6b7280;">Method</span>
          <span style="font-weight: 500;">${tx.paymentMethod === 'UPI' ? `UPI${tx.upiApp ? ` (${tx.upiApp})` : ''}` : tx.paymentMethod}</span>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const blob = await toBlob(container, { pixelRatio: 2 });
      if (!blob) return;
      const file = new File([blob], 'transaction.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Transaction Details',
          files: [file]
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'transaction.png';
        link.click();
      }
      document.body.removeChild(container);
    } catch (error) {
      console.error('Error sharing transaction:', error);
      document.body.removeChild(container);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-10">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <button 
            onClick={() => navigate('/transactions')} 
            className="p-2 -ml-2 sm:ml-0 text-gray-500 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Transaction Report</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              {filteredAndSortedTransactions.length} of {allTransactionsRaw.length} transactions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={handleZoomOut} className="p-1.5 text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all" title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={handleZoomReset} className="px-2 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all h-7" title="Reset Zoom">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={handleZoomIn} className="p-1.5 text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all" title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportPDF}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg font-medium transition-colors"
              title="Download PDF Report"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button 
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium transition-colors"
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 bg-gray-50 flex flex-col gap-6">
        {/* Monthly Insights Dashboard */}
        <div className="relative">
          <div ref={summaryRef} className="flex flex-col gap-4 p-2 -m-2 rounded-xl bg-gray-50">
            {/* KPI Cards */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="grid grid-cols-3 divide-x divide-gray-100">
                <div className="p-3 sm:p-5 flex flex-col items-center justify-center text-center">
                  <div className="text-[10px] sm:text-sm font-semibold text-gray-500 mb-1 sm:mb-2 flex items-center gap-1 uppercase tracking-wider sm:normal-case sm:tracking-normal">
                    <ArrowDownLeft className="w-3 h-3 sm:w-4 sm:h-4 text-rose-500" />
                    <span className="hidden sm:inline">Total </span>Outflow
                  </div>
                  <div className="text-sm sm:text-3xl font-bold text-rose-600 truncate w-full">
                    <CountUp value={summary.spent} prefix="-₹" />
                  </div>
                </div>
                <div className="p-3 sm:p-5 flex flex-col items-center justify-center text-center">
                  <div className="text-[10px] sm:text-sm font-semibold text-gray-500 mb-1 sm:mb-2 flex items-center gap-1 uppercase tracking-wider sm:normal-case sm:tracking-normal">
                    <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-500" />
                    <span className="hidden sm:inline">Total </span>Inflow
                  </div>
                  <div className="text-sm sm:text-3xl font-bold text-emerald-600 truncate w-full">
                    <CountUp value={summary.received} prefix="+₹" />
                  </div>
                </div>
                <div className="p-3 sm:p-5 flex flex-col items-center justify-center text-center bg-gray-50/50">
                  <div className="text-[10px] sm:text-sm font-semibold text-gray-500 mb-1 sm:mb-2 flex items-center gap-1 uppercase tracking-wider sm:normal-case sm:tracking-normal">
                    <Wallet className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-500" />
                    Net<span className="hidden sm:inline"> Balance</span>
                  </div>
                  <div className={`text-sm sm:text-3xl font-bold truncate w-full ${summary.received - summary.spent >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                    <CountUp value={Math.abs(summary.received - summary.spent)} prefix={summary.received - summary.spent >= 0 ? '+₹' : '-₹'} />
                  </div>
                </div>
              </div>
            </div>

            {/* Insights Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Categories */}
              <div 
                className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-all flex flex-col"
                onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <PieChart className="w-4 h-4"/>
                    </div>
                    Top Spending Categories
                  </h3>
                  <div className="p-1.5 bg-gray-50 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                    {isCategoriesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
                
                {!isCategoriesExpanded && (
                  <div className="text-sm font-medium text-gray-500 mt-2 pl-1">
                    {insights.topCategories.length > 0 
                      ? <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500"></span>{insights.topCategories[0][0]} <span className="text-gray-900 font-semibold ml-auto">₹{insights.topCategories[0][1].toLocaleString('en-IN')}</span></div>
                      : 'No spending data available.'}
                  </div>
                )}

                {isCategoriesExpanded && (
                  <div className="space-y-4 mt-4 flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {insights.topCategories.map(([cat, amount], index) => {
                      const colors = ['bg-indigo-500', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-cyan-500'];
                      const lightColors = ['bg-indigo-50', 'bg-rose-50', 'bg-amber-50', 'bg-emerald-50', 'bg-cyan-50'];
                      const textColors = ['text-indigo-600', 'text-rose-600', 'text-amber-600', 'text-emerald-600', 'text-cyan-600'];
                      const colorClass = colors[index % colors.length];
                      const lightClass = lightColors[index % lightColors.length];
                      const textClass = textColors[index % textColors.length];
                      
                      return (
                        <div key={cat} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                          <div className="flex justify-between items-center text-sm mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-md ${lightClass} ${textClass} flex items-center justify-center text-[10px] font-bold`}>
                                {index + 1}
                              </div>
                              <span className="font-medium text-gray-800">{cat}</span>
                            </div>
                            <span className="text-gray-900 font-bold">₹{amount.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <motion.div 
                              className={`${colorClass} h-full rounded-full`}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min((amount / summary.spent) * 100, 100)}%` }}
                              transition={{ duration: 1, delay: 0.1 * index }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {insights.topCategories.length === 0 && <div className="text-sm font-medium text-gray-500 text-center py-6 bg-gray-50 rounded-xl border border-gray-100 border-dashed">No spending data available.</div>}
                  </div>
                )}
              </div>

              {/* Account Breakdown */}
              <div 
                className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-all flex flex-col"
                onClick={() => setIsAccountBreakdownExpanded(!isAccountBreakdownExpanded)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Landmark className="w-4 h-4" />
                    </div>
                    Account Breakdown
                  </h3>
                  <div className="p-1.5 bg-gray-50 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
                    {isAccountBreakdownExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {!isAccountBreakdownExpanded && (
                  <div className="text-sm font-medium text-gray-500 mt-2 pl-1">
                    {accounts.length > 0 
                      ? <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-indigo-500"></span>{accounts.length} Active Accounts</div>
                      : 'No account data available.'}
                  </div>
                )}

                {isAccountBreakdownExpanded && (
                  <div className="space-y-3 mt-4 overflow-y-auto flex-1 pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {accounts.map(acc => {
                    const spent = insights.spentByAccount[acc.id!] || 0;
                    const received = insights.receivedByAccount[acc.id!] || 0;
                    if (spent === 0 && received === 0) return null;
                    
                    const totalVolume = spent + received;
                    const spentPct = totalVolume > 0 ? (spent / totalVolume) * 100 : 0;
                    const receivedPct = totalVolume > 0 ? (received / totalVolume) * 100 : 0;

                    return (
                      <div key={acc.id} className="p-3.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-400 to-rose-400 opacity-60"></div>
                        <div className="flex items-center justify-between mb-3 pl-2">
                          <div className="font-semibold text-gray-800 text-sm flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-600 border border-gray-200 shadow-sm">
                              {acc.bankName.substring(0, 2).toUpperCase()}
                            </div>
                            {acc.bankName}
                          </div>
                        </div>
                        
                        <div className="pl-2 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <div className="p-1 bg-emerald-50 rounded-md text-emerald-600"><ArrowDownLeft className="w-3 h-3"/></div>
                              <span>In</span>
                            </div>
                            <span className="font-bold text-emerald-600">₹{received.toLocaleString('en-IN')}</span>
                          </div>
                          
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-gray-500">
                              <div className="p-1 bg-rose-50 rounded-md text-rose-600"><ArrowUpRight className="w-3 h-3"/></div>
                              <span>Out</span>
                            </div>
                            <span className="font-bold text-rose-600">₹{spent.toLocaleString('en-IN')}</span>
                          </div>
                          
                          {/* Visual Bar */}
                          <div className="w-full h-1.5 flex rounded-full overflow-hidden bg-gray-100 mt-3">
                            {received > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${receivedPct}%` }} transition={{ duration: 1, delay: 0.1 }} className="bg-emerald-400 h-full" />}
                            {spent > 0 && <motion.div initial={{ width: 0 }} animate={{ width: `${spentPct}%` }} transition={{ duration: 1, delay: 0.1 }} className="bg-rose-400 h-full" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {accounts.every(acc => !(insights.spentByAccount[acc.id!] || insights.receivedByAccount[acc.id!])) && (
                    <div className="text-sm font-medium text-gray-500 text-center py-6 bg-gray-50 rounded-xl border border-gray-100 border-dashed">No account data available.</div>
                  )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <button 
            onClick={handleShareSummary}
            className="absolute -top-2 -right-2 sm:top-2 sm:right-2 p-2 bg-white border border-gray-200 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full shadow-sm transition-colors z-10"
            title="Share Dashboard"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Filters and Search */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search anything (merchant, UPI, amount...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
              />
            </div>
            {/* Filter Toggle Button */}
            <button 
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className={`p-2 rounded-lg border flex items-center gap-2 transition-colors shrink-0 ${isFiltersExpanded ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              title="Toggle Filters"
            >
              <Filter className="w-5 h-5" />
              <span className="hidden sm:inline font-medium text-sm">Filters</span>
            </button>
          </div>

          {/* Expanded Filters */}
          {isFiltersExpanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex flex-col gap-3 pt-2 border-t border-gray-100"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Date Range */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-none">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <span className="text-gray-500 text-sm">to</span>
                  <div className="relative flex-1 sm:flex-none">
                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="ALL">All Types</option>
                  <option value="CREDIT">Received (Credit)</option>
                  <option value="DEBIT">Paid (Debit)</option>
                </select>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="ALL">All Categories</option>
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <select
                  value={filterAccount}
                  onChange={(e) => setFilterAccount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="ALL">All Accounts</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.bankName}</option>
                  ))}
                </select>

                <select
                  value={filterPaymentMethod}
                  onChange={(e) => setFilterPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="ALL">All Payment Methods</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
            </motion.div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm w-full overflow-x-auto flex-1 flex flex-col">
          <div style={{ zoom: zoom as any }} className="min-w-max flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-100 border-b border-gray-200 text-gray-700 font-semibold">
              <tr>
                <th className="px-4 py-3 cursor-pointer group hover:bg-gray-200 transition-colors" onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1">Date <SortIcon columnKey="date" /></div>
                </th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Entry Type</th>
                <th className="px-4 py-3 cursor-pointer group hover:bg-gray-200 transition-colors" onClick={() => handleSort('category')}>
                  <div className="flex items-center gap-1">Category <SortIcon columnKey="category" /></div>
                </th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3 cursor-pointer group hover:bg-gray-200 transition-colors text-right" onClick={() => handleSort('amount')}>
                  <div className="flex items-center justify-end gap-1">Amount <SortIcon columnKey="amount" /></div>
                </th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedTransactions.map(tx => (
                <tr key={tx.id} className="hover:bg-indigo-50/50 transition-colors group border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{safeFormatDate(tx.dateTime, 'yyyy-MM-dd')}</td>
                  <td className="px-4 py-3 text-gray-600 font-medium">{safeFormatDate(tx.dateTime, 'hh:mm a')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold tracking-wide ${tx.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {tx.type === 'CREDIT' ? 'CREDIT' : 'DEBIT'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{tx.category}</td>
                  <td className="px-4 py-3 font-medium text-gray-700">
                    {tx.expenseType ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {tx.expenseType}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900 max-w-[150px] truncate" title={tx.party}>
                    {tx.party || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium max-w-[150px] truncate" title={tx.note}>
                    {tx.note || '—'}
                  </td>
                  <td className={`px-4 py-3 text-right font-black text-base ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {tx.type === 'CREDIT' ? '+' : '-'} ₹{(tx.amount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-semibold">
                    {tx.paymentMethod === 'UPI' ? `UPI${tx.upiApp ? ` (${tx.upiApp})` : ''}` : tx.paymentMethod === 'Bank' ? 'Bank' : 'Cash'}
                  </td>
                  <td className="px-4 py-3 text-gray-800 font-semibold">
                    {accounts.find(a => a.id === tx.accountId)?.bankName || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => handleShareTransaction(tx)}
                      className="p-2 text-gray-500 hover:text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                      title="Share Transaction"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedTransactions.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Search className="w-10 h-10 mb-4 text-gray-300" />
                      <p className="text-lg font-medium text-gray-900">No transactions found</p>
                      <p className="text-sm mt-1">Try adjusting your filters or search query.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-50 rounded-b-xl sticky bottom-0">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredAndSortedTransactions.length)}</span> of <span className="font-medium">{filteredAndSortedTransactions.length}</span> results
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-gray-700 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notable Activity Carousel */}
        <div className="mt-2">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600"/> Notable Activity
          </h3>
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {insights.insightCards.map((card) => (
              <div 
                key={card.id} 
                className="min-w-[280px] max-w-[320px] flex-shrink-0 snap-center bg-gradient-to-br from-indigo-600 to-purple-700 p-5 rounded-2xl shadow-sm text-white relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                  {card.icon}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  {card.icon}
                  <h4 className="text-xs font-semibold text-indigo-100 uppercase tracking-wider">{card.title}</h4>
                </div>
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-md border border-white/20 h-full flex flex-col justify-center">
                  <div className="font-medium text-sm text-indigo-50 mb-1">{card.content}</div>
                  {card.value && <div className="text-2xl font-bold mt-1">{card.value}</div>}
                  {card.subtext && <div className="text-xs text-indigo-200 mt-2">{card.subtext}</div>}
                </div>
              </div>
            ))}
            {insights.insightCards.length === 0 && (
              <div className="text-sm text-gray-500">Not enough data to generate insights yet.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
