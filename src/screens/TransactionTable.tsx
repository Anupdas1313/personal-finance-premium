import { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, normalizeType } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, ZoomIn, ZoomOut, Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Calendar, FileText, Share2, ArrowUpRight, ArrowDownLeft, Wallet, Landmark, Filter, CheckSquare, Square, Trash2, Edit3, X, CheckCircle2, ListOrdered, Plus, Check } from 'lucide-react';

import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';
import { useCurrency } from '../hooks/useCurrency';

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
  const currency = useCurrency();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  
  const [zoom, setZoom] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string[]>([]);
  const [filterAccount, setFilterAccount] = useState<string[]>([]);
  const [filterAccountType, setFilterAccountType] = useState<string[]>([]);
  const [filterMethod, setFilterMethod] = useState<string[]>([]);
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('ALL');
  const [filterExpenseType, setFilterExpenseType] = useState<string[]>([]);

  const toggleCategory = (c: string) => setFilterCategory(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  const toggleAccount = (a: string) => setFilterAccount(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);
  const toggleType = (t: string) => setFilterType(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const toggleTag = (tg: string) => setFilterExpenseType(prev => prev.includes(tg) ? prev.filter(x => x !== tg) : [...prev, tg]);
  const toggleAccountType = (at: string) => setFilterAccountType(prev => prev.includes(at) ? prev.filter(x => x !== at) : [...prev, at]);
  const toggleMethod = (m: string) => setFilterMethod(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  const [datePreset, setDatePreset] = useState('CUSTOM');
  
  const [startDate, setStartDate] = useState(startParam ? format(new Date(startParam + 'T00:00:00'), 'yyyy-MM-dd') : '');
  const [endDate, setEndDate] = useState(endParam ? format(new Date(endParam + 'T00:00:00'), 'yyyy-MM-dd') : '');

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

  const [activePopover, setActivePopover] = useState<string | null>(null);
  const togglePopover = (popover: string) => setActivePopover(prev => prev === popover ? null : popover);
  const toggleDropdown = (dropdown: typeof activeDropdown) => {
    setActiveDropdown(prev => prev === dropdown ? null : dropdown);
  };
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'}>({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());
  const [isBulkCategoryModalOpen, setIsBulkCategoryModalOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const summaryRef = useRef<HTMLDivElement>(null);
  
  const { categories: appCategories } = useCategories();
  const { tags } = useTags();

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));
  const handleZoomReset = () => setZoom(1);

  const allTransactionsRaw = useLiveQuery(() => {
    if (startDate && endDate) {
      const start = startOfDay(new Date(startDate + 'T00:00:00'));
      const end = endOfDay(new Date(endDate + 'T00:00:00'));
      return db.transactions.where('dateTime').between(start, end, true, true).toArray();
    }
    return db.transactions.toArray();
  }, [startDate, endDate, user?.uid]) || [];
  const accounts = useLiveQuery(async () => {
    const arr = await db.accounts.toArray();
    return [...arr].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [user?.uid]) || [];

  const uniqueCategories = useMemo(() => {
    const cats = new Set(allTransactionsRaw.map(tx => tx.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [allTransactionsRaw]);

  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...allTransactionsRaw];

    // 1. Date Range Filter
    if (startDate && endDate) {
      try {
        const start = startOfDay(new Date(startDate + 'T00:00:00')).getTime();
        const end = endOfDay(new Date(endDate + 'T00:00:00')).getTime();
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
    if (filterType.length > 0) {
      result = result.filter(tx => filterType.includes(normalizeType(tx.type)));
    }
    if (filterCategory.length > 0) {
      result = result.filter(tx => filterCategory.includes(tx.category || 'Other'));
    }
    if (filterAccount.length > 0) {
      result = result.filter(tx => filterAccount.includes(String(tx.accountId)));
    }
    if (filterAccountType.length > 0) {
      result = result.filter(tx => {
        const acc = accounts.find(a => a.id === Number(tx.accountId));
        return acc && filterAccountType.includes(acc.type);
      });
    }
    if (filterMethod.length > 0) {
      result = result.filter(tx => {
        const pm = (tx.paymentMethod || '').toLowerCase();
        const upi = ((tx as any).upiApp || '').toLowerCase();
        return filterMethod.some(m => pm.includes(m.toLowerCase()) || upi.includes(m.toLowerCase()));
      });
    }
    if (filterExpenseType.length > 0) {
      result = result.filter(tx => filterExpenseType.includes(tx.expenseType || ''));
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
      if (normalizeType(tx.type) === 'CREDIT') acc.received += (tx.amount || 0);
      else if (normalizeType(tx.type) === 'DEBIT') acc.spent += (tx.amount || 0);
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

  const handleToggleSelectAll = () => {
    if (selectedTxIds.size === paginatedTransactions.length && paginatedTransactions.length > 0) {
      setSelectedTxIds(new Set());
    } else {
      const newSelected = new Set(selectedTxIds);
      paginatedTransactions.forEach(tx => { if (tx.id) newSelected.add(tx.id) });
      setSelectedTxIds(newSelected);
    }
  };

  const handleToggleSelect = (id: number) => {
    const newSelected = new Set(selectedTxIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTxIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedTxIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedTxIds.size} transaction(s)?`)) return;
    
    try {
      const idsToDelete = new Set(selectedTxIds);
      for (const id of selectedTxIds) {
        const tx = await db.transactions.get(id);
        if (tx?.linkedTransactionId) {
          idsToDelete.add(tx.linkedTransactionId);
        }
      }
      await db.transactions.bulkDelete(Array.from(idsToDelete));
      setSelectedTxIds(new Set());
    } catch (error) {
      console.error(error);
    }
  };

  const handleBulkEditCategory = async () => {
    if (selectedTxIds.size === 0 || !bulkCategory) return;
    try {
      const updates = Array.from(selectedTxIds).map(id => ({
        key: id,
        changes: { category: bulkCategory }
      }));
      await Promise.all(updates.map(u => db.transactions.update(u.key, u.changes)));
      setIsBulkCategoryModalOpen(false);
      setSelectedTxIds(new Set());
      setBulkCategory('');
    } catch (error) {
      console.error(error);
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) return <ChevronDown className="w-4 h-4 text-[#B0B0B0] dark:text-[#666666] opacity-0 group-hover:opacity-100" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4 text-[#222222] dark:text-[#F7F7F7]" /> : <ChevronDown className="w-4 h-4 text-[#222222] dark:text-[#F7F7F7]" />;
  };

  const handleExportCSV = async () => {
    const headers = ['Date', 'Time', 'Type', 'Category', 'Name', 'Note', 'Amount', 'Payment Method', 'Account'];
    const rows = filteredAndSortedTransactions.map(tx => {
      const typeLabel = normalizeType(tx.type) === 'CREDIT' ? '(Received/Credited)' : '(Paid to / Debit)';
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
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
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
      const typeLabel = normalizeType(tx.type) === 'CREDIT' ? 'Credit' : 'Debit';
      return [
        safeFormatDate(tx.dateTime, 'yyyy-MM-dd'),
        typeLabel,
        tx.category || '',
        tx.party || '',
        tx.note || '',
        `${normalizeType(tx.type) === 'CREDIT' ? '+' : '-'} Rs. ${tx.amount || 0}`,
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
      const { toBlob } = await import('html-to-image');
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
    
    const isCredit = normalizeType(tx.type) === 'CREDIT';
    const amountColor = isCredit ? '#059669' : '#e11d48';
    const typeLabel = isCredit ? 'Received' : 'Paid';
    const merchantNote = tx.party && tx.note ? `${tx.party} - ${tx.note}` : tx.party || tx.note || 'Transaction';
    const accountName = accounts.find(a => a.id === tx.accountId)?.bankName || 'Unknown Account';

    container.innerHTML = `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">${typeLabel}</div>
        <div style="font-size: 36px; font-weight: bold; color: ${amountColor}; margin: 8px 0;">
          ${isCredit ? '+' : '-'}{currency}${(tx.amount || 0).toLocaleString('en-IN')}
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
      const { toBlob } = await import('html-to-image');
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
                    <CountUp value={summary.spent} prefix="-${currency}" />
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center text-center px-1">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <ArrowUpRight className="w-3.5 h-3.5 text-brand-green" />
                    <span className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em]">Inflow</span>
                  </div>
                  <div className="text-base sm:text-2xl font-semibold text-brand-green truncate w-full">
                    <CountUp value={summary.received} prefix="+${currency}" />
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center text-center px-1">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    <Wallet className="w-3.5 h-3.5 text-brand-blue dark:text-[#F7F7F7]" />
                    <span className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em]">Net Change</span>
                  </div>

                  <div className={`text-base sm:text-2xl font-semibold truncate w-full ${summary.received - summary.spent >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                    <CountUp value={Math.abs(summary.received - summary.spent)} prefix={summary.received - summary.spent >= 0 ? '+{currency}' : '-{currency}'} />
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-[#111111] p-3 rounded-[20px] border border-[#EBEBEB] dark:border-[#222222] shadow-[0_6px_16px_rgba(0,0,0,0.04)] flex flex-col gap-2">
          {/* Notion/Linear Style Desktop Filter Bar */}
          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                placeholder="Filter or search manifest..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-7 py-1.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-transparent focus:border-neutral-200 dark:focus:border-white/10 rounded-xl outline-none text-xs font-semibold text-brand-blue dark:text-[#F7F7F7] transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* + Filter Add Button */}
            <div className="relative">
              <button
                onClick={() => togglePopover('addFilter')}
                className="h-8 px-3 bg-neutral-100/60 dark:bg-white/5 hover:bg-neutral-200/50 dark:hover:bg-white/10 border border-transparent rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>

              {/* Add Filter Popover Menu */}
              <AnimatePresence>
                {activePopover === 'addFilter' && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                      className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5"
                    >
                      <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-neutral-400">Add filter by</div>
                      {[
                        { key: 'category', label: 'Category', icon: '🏷️' },
                        { key: 'nature', label: 'Nature (In/Out)', icon: '⇄' },
                        { key: 'account', label: 'Account', icon: '🏦' },
                        { key: 'tag', label: 'Tag', icon: '🔖' },
                        { key: 'timeline', label: 'Timeline', icon: '📅' },
                      ].map(prop => (
                        <button
                          key={prop.key}
                          onClick={() => {
                            setActivePopover(null);
                            if (prop.key === 'category' && filterCategory.length === 0 && appCategories.length > 0) setFilterCategory([appCategories[0]]);
                            if (prop.key === 'type' && filterType.length === 0) setFilterType(['DEBIT']);
                            if (prop.key === 'accountType' && filterAccountType.length === 0) setFilterAccountType(['BANK']);
                            if (prop.key === 'account' && filterAccount.length === 0 && accounts.length > 0) setFilterAccount([String(accounts[0].id)]);
                            if (prop.key === 'method' && filterMethod.length === 0) setFilterMethod(['UPI']);
                            if (prop.key === 'tag' && filterExpenseType.length === 0 && tags.length > 0) setFilterExpenseType([tags[0]]);
                            if (prop.key === 'granularity' && datePreset === 'ALL_TIME') handleDatePresetChange('THIS_MONTH');
                            setActivePopover(prop.key);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5 flex items-center gap-2 transition-all"
                        >
                          <span className="text-xs">{prop.icon}</span>
                          <span>{prop.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Sort Button */}
            <div className="relative">
              <button
                onClick={() => togglePopover('sort')}
                className={`h-8 px-3 border rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  sortConfig.key !== 'date' || sortConfig.direction !== 'desc'
                    ? 'bg-brand-blue/10 text-brand-blue dark:text-white border-brand-blue/20'
                    : 'bg-neutral-100/60 dark:bg-white/5 border-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-white/10'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>
                  {sortConfig.key === 'date'
                    ? sortConfig.direction === 'desc' ? 'Newest' : 'Oldest'
                    : sortConfig.direction === 'desc' ? 'Highest' : 'Lowest'}
                </span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {/* Sort Options Popover */}
              <AnimatePresence>
                {activePopover === 'sort' && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 5 }}
                      className="absolute right-0 mt-1.5 w-48 bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5"
                    >
                      <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-neutral-400">Sort by</div>
                      {[
                        { label: 'Date: Newest First', key: 'date', direction: 'desc' },
                        { label: 'Date: Oldest First', key: 'date', direction: 'asc' },
                        { label: 'Amount: High to Low', key: 'amount', direction: 'desc' },
                        { label: 'Amount: Low to High', key: 'amount', direction: 'asc' },
                      ].map((opt, idx) => {
                        const isSelected = sortConfig.key === opt.key && sortConfig.direction === opt.direction;
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              setSortConfig({ key: opt.key, direction: opt.direction as any });
                              setActivePopover(null);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between transition-all ${
                              isSelected
                                ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold'
                                : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-white/5'
                            }`}
                          >
                            <span>{opt.label}</span>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue dark:text-white" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Active Filter Pills (Notion Style) */}
          {(filterCategory.length > 0 || filterType.length > 0 || filterAccount.length > 0 || filterExpenseType.length > 0 || datePreset !== 'ALL_TIME') && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {/* Category Pill */}
              {filterCategory.length > 0 && (
                <div className="relative">
                  <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-brand-blue/10 dark:bg-white/10 border border-brand-blue/20 dark:border-white/10 rounded-xl text-xs font-semibold text-brand-blue dark:text-white">
                    <button onClick={() => togglePopover('category')} className="flex items-center gap-1 hover:opacity-80">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Category</span>
                      <span className="font-bold">{filterCategory.length === 1 ? filterCategory[0] : `${filterCategory[0]} +${filterCategory.length - 1}`}</span>
                      <ChevronDown className="w-3 h-3 text-neutral-400" />
                    </button>
                    <button onClick={() => setFilterCategory([])} className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-md transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {activePopover === 'category' && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                          className="absolute left-0 mt-1.5 w-52 max-h-60 overflow-y-auto bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5">
                          <div className="flex items-center justify-between px-2.5 py-1 border-b border-neutral-100 dark:border-white/5 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Categories</span>
                            <button onClick={() => setFilterCategory([])} className="text-[9px] font-bold text-rose-500 hover:underline">Clear</button>
                          </div>
                          {appCategories.map(c => {
                            const isSelected = filterCategory.includes(c);
                            return (
                              <button key={c} onClick={() => toggleCategory(c)}
                                className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between ${isSelected ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-200'}`}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${isSelected ? 'bg-brand-blue border-brand-blue text-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                                    {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
                                  </div>
                                  <span>{c}</span>
                                </div>
                              </button>
                            );
                          })}
                        
                        <div className="pt-1.5 mt-1 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between gap-2 px-1">
                          <button onClick={() => setFilterCategory([])} className="text-[10px] font-bold text-neutral-400 hover:text-rose-500 transition-colors">Reset</button>
                          <button onClick={() => setActivePopover(null)} className="px-3 py-1 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1">
                            <span>Apply</span>
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
</motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Nature / Flow Pill */}
              {filterType.length > 0 && (
                <div className="relative">
                  <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-brand-blue/10 dark:bg-white/10 border border-brand-blue/20 dark:border-white/10 rounded-xl text-xs font-semibold text-brand-blue dark:text-white">
                    <button onClick={() => togglePopover('nature')} className="flex items-center gap-1 hover:opacity-80">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Nature</span>
                      <span className="font-bold">{filterType.length === 1 ? (filterType[0] === 'DEBIT' ? 'Outflow' : filterType[0] === 'CREDIT' ? 'Inflow' : 'Transfer') : `${filterType.length} selected` }</span>
                      <ChevronDown className="w-3 h-3 text-neutral-400" />
                    </button>
                    <button onClick={() => setFilterType([])} className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-md transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {activePopover === 'nature' && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                          className="absolute left-0 mt-1.5 w-48 bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5">
                          <div className="flex items-center justify-between px-2.5 py-1 border-b border-neutral-100 dark:border-white/5 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Flow Type</span>
                            <button onClick={() => setFilterType([])} className="text-[9px] font-bold text-rose-500 hover:underline">Clear</button>
                          </div>
                          {[
                            { label: 'Outflow (Debit)', val: 'DEBIT' },
                            { label: 'Inflow (Credit)', val: 'CREDIT' },
                            { label: 'Inter-Account', val: 'TRANSFER' }
                          ].map(opt => {
                            const isSelected = filterType.includes(opt.val);
                            return (
                              <button key={opt.val} onClick={() => toggleType(opt.val)}
                                className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between ${isSelected ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-200'}`}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${isSelected ? 'bg-brand-blue border-brand-blue text-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                                    {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
                                  </div>
                                  <span>{opt.label}</span>
                                </div>
                              </button>
                            );
                          })}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Account Type Filter Pill */}
              {filterAccountType.length > 0 && (
                <div className="relative">
                  <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-brand-blue/10 dark:bg-white/10 border border-brand-blue/20 dark:border-white/10 rounded-xl text-xs font-semibold text-brand-blue dark:text-white">
                    <button onClick={() => togglePopover('accountType')} className="flex items-center gap-1 hover:opacity-80">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Account Type</span>
                      <span className="font-bold">{filterAccountType.length === 1 ? (filterAccountType[0] === 'BANK' ? 'Bank' : filterAccountType[0] === 'CREDIT_CARD' ? 'Credit Card' : 'Cash/Wallet') : `${filterAccountType.length} selected` }</span>
                      <ChevronDown className="w-3 h-3 text-neutral-400" />
                    </button>
                    <button onClick={() => setFilterAccountType([])} className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-md transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {activePopover === 'accountType' && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                          className="absolute left-0 mt-1.5 w-52 bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5">
                          <div className="flex items-center justify-between px-2.5 py-1 border-b border-neutral-100 dark:border-white/5 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Account Classification</span>
                            <button onClick={() => setFilterAccountType([])} className="text-[9px] font-bold text-rose-500 hover:underline">Clear</button>
                          </div>
                          {[
                            { id: 'BANK', label: '🏦 Bank Accounts' },
                            { id: 'CREDIT_CARD', label: '💳 Credit Cards' },
                            { id: 'CASH', label: '💵 Cash & Wallets' }
                          ].map(typeOpt => {
                            const isSelected = filterAccountType.includes(typeOpt.id);
                            return (
                              <button key={typeOpt.id} onClick={() => toggleAccountType(typeOpt.id)}
                                className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between ${isSelected ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-200'}`}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${isSelected ? 'bg-brand-blue border-brand-blue text-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                                    {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
                                  </div>
                                  <span>{typeOpt.label}</span>
                                </div>
                              </button>
                            );
                          })}
                        
                        <div className="pt-1.5 mt-1 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between gap-2 px-1">
                          <button onClick={() => setFilterAccountType([])} className="text-[10px] font-bold text-neutral-400 hover:text-rose-500 transition-colors">Reset</button>
                          <button onClick={() => setActivePopover(null)} className="px-3 py-1 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1">
                            <span>Apply</span>
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
</motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Payment Method Filter Pill */}
              {filterMethod.length > 0 && (
                <div className="relative">
                  <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-brand-blue/10 dark:bg-white/10 border border-brand-blue/20 dark:border-white/10 rounded-xl text-xs font-semibold text-brand-blue dark:text-white">
                    <button onClick={() => togglePopover('method')} className="flex items-center gap-1 hover:opacity-80">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Method</span>
                      <span className="font-bold">{filterMethod.length === 1 ? filterMethod[0] : `${filterMethod[0]} +${filterMethod.length - 1}`}</span>
                      <ChevronDown className="w-3 h-3 text-neutral-400" />
                    </button>
                    <button onClick={() => setFilterMethod([])} className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-md transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {activePopover === 'method' && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                          className="absolute left-0 mt-1.5 w-52 max-h-60 overflow-y-auto bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5">
                          <div className="flex items-center justify-between px-2.5 py-1 border-b border-neutral-100 dark:border-white/5 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Payment Medium</span>
                            <button onClick={() => setFilterMethod([])} className="text-[9px] font-bold text-rose-500 hover:underline">Clear</button>
                          </div>
                          {['UPI', 'Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', 'Net Banking', 'Wallet'].map(m => {
                            const isSelected = filterMethod.includes(m);
                            return (
                              <button key={m} onClick={() => toggleMethod(m)}
                                className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between ${isSelected ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-200'}`}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${isSelected ? 'bg-brand-blue border-brand-blue text-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                                    {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
                                  </div>
                                  <span>{m}</span>
                                </div>
                              </button>
                            );
                          })}
                        
                        <div className="pt-1.5 mt-1 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between gap-2 px-1">
                          <button onClick={() => setFilterMethod([])} className="text-[10px] font-bold text-neutral-400 hover:text-rose-500 transition-colors">Reset</button>
                          <button onClick={() => setActivePopover(null)} className="px-3 py-1 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1">
                            <span>Apply</span>
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
</motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Grouped Specific Account Filter Pill */}
              {filterAccount.length > 0 && (
                <div className="relative">
                  <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-brand-blue/10 dark:bg-white/10 border border-brand-blue/20 dark:border-white/10 rounded-xl text-xs font-semibold text-brand-blue dark:text-white">
                    <button onClick={() => togglePopover('account')} className="flex items-center gap-1 hover:opacity-80">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Account</span>
                      <span className="font-bold">{filterAccount.length === 1 ? (accounts.find(a => String(a.id) === filterAccount[0])?.bankName || filterAccount[0]) : `${accounts.find(a => String(a.id) === filterAccount[0])?.bankName || 'Account'} +${filterAccount.length - 1}`}</span>
                      <ChevronDown className="w-3 h-3 text-neutral-400" />
                    </button>
                    <button onClick={() => setFilterAccount([])} className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-md transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {activePopover === 'account' && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                          className="absolute left-0 mt-1.5 w-60 max-h-72 overflow-y-auto bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-2 z-50 space-y-2">
                          <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-100 dark:border-white/5">
                            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Specific Accounts</span>
                            <button onClick={() => setFilterAccount([])} className="text-[9px] font-bold text-rose-500 hover:underline">Clear</button>
                          </div>

                          {[
                            { title: '🏦 Bank Accounts', typeKey: 'BANK' },
                            { title: '💳 Credit Cards', typeKey: 'CREDIT_CARD' },
                            { title: '💵 Cash & Wallets', typeKey: 'CASH' }
                          ].map(section => {
                            const sectionAccs = accounts.filter(a => a.type === section.typeKey);
                            if (sectionAccs.length === 0) return null;
                            return (
                              <div key={section.typeKey} className="space-y-1">
                                <div className="px-2 text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">{section.title}</div>
                                {sectionAccs.map(acc => {
                                  const isSelected = filterAccount.includes(String(acc.id));
                                  return (
                                    <button key={acc.id} onClick={() => toggleAccount(String(acc.id))}
                                      className={`w-full px-2.5 py-1 rounded-xl text-left text-xs font-medium flex items-center justify-between ${isSelected ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-200'}`}>
                                      <div className="flex items-center gap-2 truncate">
                                        <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center shrink-0 ${isSelected ? 'bg-brand-blue border-brand-blue text-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                                          {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className="truncate">{acc.bankName}</span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })}
                        
                        <div className="pt-1.5 mt-1 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between gap-2 px-1">
                          <button onClick={() => setFilterAccount([])} className="text-[10px] font-bold text-neutral-400 hover:text-rose-500 transition-colors">Reset</button>
                          <button onClick={() => setActivePopover(null)} className="px-3 py-1 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1">
                            <span>Apply</span>
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
</motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Tag Pill */}
              {filterExpenseType.length > 0 && (
                <div className="relative">
                  <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-brand-blue/10 dark:bg-white/10 border border-brand-blue/20 dark:border-white/10 rounded-xl text-xs font-semibold text-brand-blue dark:text-white">
                    <button onClick={() => togglePopover('tag')} className="flex items-center gap-1 hover:opacity-80">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Tag</span>
                      <span className="font-bold">{filterExpenseType.length === 1 ? `#${filterExpenseType[0]}` : `#${filterExpenseType[0]} +${filterExpenseType.length - 1}`}</span>
                      <ChevronDown className="w-3 h-3 text-neutral-400" />
                    </button>
                    <button onClick={() => setFilterExpenseType([])} className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-md transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {activePopover === 'tag' && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                          className="absolute left-0 mt-1.5 w-52 max-h-60 overflow-y-auto bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-1.5 z-50 space-y-0.5">
                          <div className="flex items-center justify-between px-2.5 py-1 border-b border-neutral-100 dark:border-white/5 mb-1">
                            <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Tags</span>
                            <button onClick={() => setFilterExpenseType([])} className="text-[9px] font-bold text-rose-500 hover:underline">Clear</button>
                          </div>
                          {tags.map(t => {
                            const isSelected = filterExpenseType.includes(t);
                            return (
                              <button key={t} onClick={() => toggleTag(t)}
                                className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between ${isSelected ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-200'}`}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center ${isSelected ? 'bg-brand-blue border-brand-blue text-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                                    {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
                                  </div>
                                  <span>#{t}</span>
                                </div>
                              </button>
                            );
                          })}
                        
                        <div className="pt-1.5 mt-1 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between gap-2 px-1">
                          <button onClick={() => setFilterExpenseType([])} className="text-[10px] font-bold text-neutral-400 hover:text-rose-500 transition-colors">Reset</button>
                          <button onClick={() => setActivePopover(null)} className="px-3 py-1 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1">
                            <span>Apply</span>
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
</motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Timeline Pill */}
              {datePreset !== 'ALL_TIME' && (
                <div className="relative">
                  <div className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-brand-blue/10 dark:bg-white/10 border border-brand-blue/20 dark:border-white/10 rounded-xl text-xs font-semibold text-brand-blue dark:text-white">
                    <button onClick={() => togglePopover('timeline')} className="flex items-center gap-1 hover:opacity-80">
                      <span className="text-[10px] text-neutral-400 uppercase tracking-wider">Time</span>
                      <span className="font-bold">
                        {datePreset === 'CUSTOM' && startDate && endDate
                          ? `${format(new Date(startDate + 'T00:00:00'), 'MMM d')} – ${format(new Date(endDate + 'T00:00:00'), 'MMM d')}`
                          : datePreset.replace('_', ' ')}
                      </span>
                      <ChevronDown className="w-3 h-3 text-neutral-400" />
                    </button>
                    <button onClick={() => handleDatePresetChange('ALL_TIME')} className="p-0.5 hover:bg-neutral-200 dark:hover:bg-white/20 rounded-md transition-colors text-neutral-400 hover:text-neutral-700 dark:hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <AnimatePresence>
                    {activePopover === 'timeline' && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActivePopover(null)} />
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                          className="absolute left-0 mt-1.5 w-60 bg-white dark:bg-[#18181B] border border-neutral-200/80 dark:border-white/10 rounded-2xl shadow-xl p-2.5 z-50 space-y-1">
                          <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-neutral-400">Timeline</div>
                          {['ALL_TIME', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM'].map(p => (
                            <button key={p} onClick={() => { handleDatePresetChange(p); if (p !== 'CUSTOM') setActivePopover(null); }}
                              className={`w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium flex items-center justify-between ${datePreset === p ? 'bg-brand-blue/10 text-brand-blue dark:text-white font-bold' : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-200'}`}>
                              <span>{p.replace('_', ' ')}</span>
                              {datePreset === p && <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue dark:text-white" />}
                            </button>
                          ))}

                          {datePreset === 'CUSTOM' && (
                            <div className="pt-2.5 mt-1 border-t border-neutral-100 dark:border-white/10 space-y-2.5">
                              <div className="flex items-center justify-between px-1">
                                <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-blue dark:text-brand-cyan flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> Custom Date Range
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-neutral-50 dark:bg-white/5 border border-neutral-200/80 dark:border-white/10 p-2 rounded-xl transition-all focus-within:border-brand-blue dark:focus-within:border-brand-cyan">
                                  <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1">Start Date</span>
                                  <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="w-full bg-transparent text-[11px] font-semibold text-neutral-800 dark:text-white focus:outline-none cursor-pointer"
                                  />
                                </div>
                                <div className="bg-neutral-50 dark:bg-white/5 border border-neutral-200/80 dark:border-white/10 p-2 rounded-xl transition-all focus-within:border-brand-blue dark:focus-within:border-brand-cyan">
                                  <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1">End Date</span>
                                  <input
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="w-full bg-transparent text-[11px] font-semibold text-neutral-800 dark:text-white focus:outline-none cursor-pointer"
                                  />
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest px-1">Quick Presets</span>
                                <div className="grid grid-cols-3 gap-1">
                                  <button
                                    onClick={() => {
                                      setStartDate(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
                                      setEndDate(format(new Date(), 'yyyy-MM-dd'));
                                    }}
                                    className="py-1 px-1.5 bg-neutral-100/80 dark:bg-white/5 hover:bg-brand-blue/10 hover:text-brand-blue dark:hover:text-brand-cyan rounded-lg text-[10px] font-bold text-neutral-600 dark:text-neutral-300 transition-all text-center">
                                    Last 7d
                                  </button>
                                  <button
                                    onClick={() => {
                                      setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
                                      setEndDate(format(new Date(), 'yyyy-MM-dd'));
                                    }}
                                    className="py-1 px-1.5 bg-neutral-100/80 dark:bg-white/5 hover:bg-brand-blue/10 hover:text-brand-blue dark:hover:text-brand-cyan rounded-lg text-[10px] font-bold text-neutral-600 dark:text-neutral-300 transition-all text-center">
                                    Last 30d
                                  </button>
                                  <button
                                    onClick={() => {
                                      setStartDate(format(startOfYear(new Date()), 'yyyy-MM-dd'));
                                      setEndDate(format(new Date(), 'yyyy-MM-dd'));
                                    }}
                                    className="py-1 px-1.5 bg-neutral-100/80 dark:bg-white/5 hover:bg-brand-blue/10 hover:text-brand-blue dark:hover:text-brand-cyan rounded-lg text-[10px] font-bold text-neutral-600 dark:text-neutral-300 transition-all text-center">
                                    This Year
                                  </button>
                                </div>
                              </div>

                              <button
                                onClick={() => setActivePopover(null)}
                                className="w-full py-2 bg-gradient-to-r from-brand-blue to-indigo-600 dark:from-brand-blue dark:to-cyan-600 text-white rounded-xl text-xs font-bold shadow-md shadow-brand-blue/20 hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-1.5">
                                <span>Apply Custom Range</span>
                              </button>
                            </div>
                          )}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Clear All Text Button */}
              <button
                onClick={() => {
                  setFilterCategory([]);
                  setFilterType([]);
                  setFilterAccount([]);
                  setFilterExpenseType([]);
                  handleDatePresetChange('ALL_TIME');
                }}
                className="text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:underline uppercase tracking-wider ml-1"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
<div className="bg-white dark:bg-[#111111] border border-brand-blue/5 dark:border-[#222222] rounded-[24px] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-brand-blue text-white uppercase tracking-[0.2em] text-[10px] font-semibold">


                <tr>
                  <th className="px-4 py-3 w-10">
                    <button onClick={handleToggleSelectAll} className="text-brand-blue dark:text-white/70">
                      {paginatedTransactions.length > 0 && selectedTxIds.size === paginatedTransactions.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
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
                  <tr key={tx.id} className={`hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors border-b border-[#EBEBEB] dark:border-transparent ${tx.id && selectedTxIds.has(tx.id) ? 'bg-brand-blue/5 dark:bg-brand-blue/10' : ''}`}>
                    <td className="px-4 py-4 sm:py-3 text-brand-blue dark:text-white w-10">
                      <button onClick={() => tx.id && handleToggleSelect(tx.id)} className="text-brand-blue/50 dark:text-white/50">
                        {tx.id && selectedTxIds.has(tx.id) ? <CheckSquare className="w-4 h-4 text-brand-blue dark:text-brand-cyan" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-4 sm:py-3 text-brand-blue dark:text-white">
                      <div className="font-semibold text-sm">
                        {safeFormatDate(tx.dateTime, 'MMM d, yyyy')}
                      </div>
                      <div className="text-[10px] text-brand-blue/30 dark:text-[#A0A0A0] md:hidden font-semibold uppercase tracking-widest">
                        {safeFormatDate(tx.dateTime, 'hh:mm a')}
                      </div>
                    </td>


                    <td className="hidden md:table-cell px-4 py-3">
                      <button
                        onClick={() => toggleType(normalizeType(tx.type))}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-widest cursor-pointer hover:opacity-80 transition-opacity ${normalizeType(tx.type) === 'CREDIT' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-red/10 text-brand-red'}`}
                        title={`Filter by nature: ${normalizeType(tx.type)}`}>
                        {normalizeType(tx.type)}
                      </button>
                    </td>

                    <td className="hidden sm:table-cell px-4 py-3 font-semibold text-[#525252] dark:text-[#A0A0A0]">
                      <button
                        onClick={() => tx.category && toggleCategory(tx.category)}
                        className="hover:text-brand-blue dark:hover:text-white hover:underline cursor-pointer transition-colors text-left"
                        title={`Filter by category: ${tx.category}`}>
                        {tx.category || '—'}
                      </button>
                    </td>
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

                    <td className={`px-4 py-3 text-right font-semibold ${normalizeType(tx.type) === 'CREDIT' ? 'text-brand-green' : 'text-brand-red'}`}>
                      {normalizeType(tx.type) === 'CREDIT' ? '+' : '-'}{currency}{(tx.amount || 0).toLocaleString('en-IN')}
                    </td>

                    <td className="hidden md:table-cell px-4 py-3 font-medium text-[#717171] dark:text-[#A0A0A0]">
                      <button
                        onClick={() => tx.accountId && toggleAccount(String(tx.accountId))}
                        className="hover:text-brand-blue dark:hover:text-white hover:underline cursor-pointer transition-colors text-left"
                        title={`Filter by account: ${accounts.find(a => a.id === tx.accountId)?.bankName}`}>
                        {accounts.find(a => a.id === tx.accountId)?.bankName || '—'}
                      </button>
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

      {/* Bulk Action Bar */}
      {selectedTxIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-[#111] px-6 py-4 rounded-full shadow-2xl border border-neutral-200 dark:border-white/10 flex items-center gap-6 z-50 animate-in slide-in-from-bottom-10 fade-in">
          <span className="text-sm font-bold text-brand-blue dark:text-white">
            {selectedTxIds.size} selected
          </span>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsBulkCategoryModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue dark:text-white rounded-full text-sm font-bold transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit Category
            </button>
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-full text-sm font-bold transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
            <button 
              onClick={() => setSelectedTxIds(new Set())}
              className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk Edit Category Modal */}
      {isBulkCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111] p-6 rounded-3xl w-full max-w-sm border border-neutral-200 dark:border-white/10 shadow-2xl">
            <h3 className="text-lg font-bold text-brand-blue dark:text-white mb-4">Edit Category for {selectedTxIds.size} items</h3>
            <select 
              value={bulkCategory} 
              onChange={e => setBulkCategory(e.target.value)}
              className="w-full h-12 bg-neutral-50 dark:bg-black/20 border border-neutral-200 dark:border-white/10 px-4 rounded-xl text-sm font-bold text-brand-blue dark:text-white outline-none mb-6"
            >
              <option value="" disabled>Select Category...</option>
              {appCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-3">
              <button 
                onClick={() => setIsBulkCategoryModalOpen(false)}
                className="flex-1 py-3 bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-brand-blue dark:text-white rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleBulkEditCategory}
                disabled={!bulkCategory}
                className="flex-1 py-3 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
