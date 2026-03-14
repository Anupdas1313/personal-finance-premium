import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../lib/db';
import { format, startOfMonth, endOfMonth, isWithinInterval, isToday, isYesterday, parseISO, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Trash2, ArrowDownLeft, ArrowUpRight, Wallet, Share2, Filter, Search, Edit3, Copy, ArrowDownUp, BarChart3, Download, ListOrdered } from 'lucide-react';
import { useState, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCategories } from '../hooks/useCategories';

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
  'Food': 'bg-orange-100 dark:bg-orange-500/20 text-orange-600',
  'Transport': 'bg-blue-100 dark:bg-blue-500/20 text-blue-600',
  'Rent': 'bg-purple-100 dark:bg-purple-500/20 text-purple-600',
  'Shopping': 'bg-pink-100 dark:bg-pink-500/20 text-pink-600',
  'Bills': 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600',
  'Entertainment': 'bg-red-100 dark:bg-red-500/20 text-red-600',
  'Salary': 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600',
  'Transfer': 'bg-neutral-100 dark:bg-[#1A1A1A] text-[#717171] dark:text-[#A0A0A0]',
  'Other': 'bg-neutral-100 dark:bg-[#1A1A1A] text-[#717171] dark:text-[#A0A0A0]'
};

type SortMode = 'date' | 'amount_high' | 'amount_low' | 'category';

// Highlight matching text helper
function HighlightText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase()
          ? <mark key={i} className="bg-amber-200 dark:bg-amber-500/40 text-inherit rounded-sm px-0.5">{part}</mark>
          : <Fragment key={i}>{part}</Fragment>
      )}
    </>
  );
}

export default function Transactions() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [entryTypeFilter, setEntryTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [datePreset, setDatePreset] = useState<'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'>('MONTH');
  const [sortTypeFilter, setSortTypeFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [isEditing, setIsEditing] = useState(false);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editParty, setEditParty] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { categories: appCategories } = useCategories();

  const allTransactions = useLiveQuery(() => db.transactions.orderBy('dateTime').reverse().toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  
  const filterStart = dateRange ? dateRange.start : startOfMonth(currentMonth);
  const filterEnd = dateRange ? dateRange.end : endOfMonth(currentMonth);

  let filteredTransactions = allTransactions.filter(tx => {
    const inDateRange = isWithinInterval(tx.dateTime, { start: filterStart, end: filterEnd });
    const matchesEntryType = entryTypeFilter === 'ALL' || tx.type === entryTypeFilter;
    const matchesSortType = sortTypeFilter === 'ALL' || tx.expenseType === sortTypeFilter;
    
    let matchesSearch = true;
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      const amountStr = tx.amount.toString();
      matchesSearch = 
        (tx.note && tx.note.toLowerCase().includes(lowerSearch)) ||
        (tx.party && tx.party.toLowerCase().includes(lowerSearch)) ||
        (tx.category && tx.category.toLowerCase().includes(lowerSearch)) ||
        (tx.expenseType && tx.expenseType.toLowerCase().includes(lowerSearch)) ||
        amountStr.includes(lowerSearch);
    }

    return inDateRange && matchesEntryType && matchesSortType && matchesSearch;
  });

  // Sort
  if (sortMode === 'amount_high') {
    filteredTransactions = [...filteredTransactions].sort((a, b) => b.amount - a.amount);
  } else if (sortMode === 'amount_low') {
    filteredTransactions = [...filteredTransactions].sort((a, b) => a.amount - b.amount);
  } else if (sortMode === 'category') {
    filteredTransactions = [...filteredTransactions].sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  }

  const handlePrevMonth = () => {
    if (dateRange) setDateRange(null);
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    if (dateRange) setDateRange(null);
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDatePresetChange = (preset: 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM') => {
    setDatePreset(preset);
    const today = new Date();
    switch (preset) {
      case 'WEEK':
        setDateRange({ start: startOfDay(startOfWeek(today, { weekStartsOn: 1 })), end: endOfDay(endOfWeek(today, { weekStartsOn: 1 })) });
        break;
      case 'MONTH':
        setDateRange(null); // Uses currentMonth state
        break;
      case 'YEAR':
        setDateRange({ start: startOfMonth(new Date(today.getFullYear(), 0, 1)), end: endOfMonth(new Date(today.getFullYear(), 11, 31)) });
        break;
      case 'CUSTOM':
        openDatePicker();
        break;
    }
  };

  const openDatePicker = () => {
    setDatePreset('CUSTOM');
    if (dateRange) {
      setTempStartDate(format(dateRange.start, 'yyyy-MM-dd'));
      setTempEndDate(format(dateRange.end, 'yyyy-MM-dd'));
    } else {
      setTempStartDate(format(filterStart, 'yyyy-MM-dd'));
      setTempEndDate(format(filterEnd, 'yyyy-MM-dd'));
    }
    setIsDatePickerOpen(true);
  };

  const applyDateFilter = () => {
    if (tempStartDate && tempEndDate) {
      setDateRange({ start: startOfDay(parseISO(tempStartDate)), end: endOfDay(parseISO(tempEndDate)) });
    } else if (tempStartDate) {
      setDateRange({ start: startOfDay(parseISO(tempStartDate)), end: endOfDay(parseISO(tempStartDate)) });
    }
    setIsDatePickerOpen(false);
  };

  const clearDateFilter = () => { setDateRange(null); setIsDatePickerOpen(false); };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      await db.transactions.delete(id);
      setSelectedTx(null);
    }
  };

  const startEditing = (tx: any) => {
    setIsEditing(true);
    setEditAmount(tx.amount.toString());
    setEditNote(tx.note || '');
    setEditParty(tx.party || '');
    setEditCategory(tx.category || 'Other');
  };

  const saveEdit = async () => {
    if (!selectedTx?.id || !editAmount) return;
    await db.transactions.update(selectedTx.id, {
      amount: parseFloat(editAmount),
      note: editNote,
      party: editParty,
      category: editCategory,
    });
    setIsEditing(false);
    setSelectedTx(null);
  };

  const duplicateTransaction = async (tx: any) => {
    const { id, ...rest } = tx;
    await db.transactions.add({ ...rest, dateTime: new Date() });
    setSelectedTx(null);
  };

  const groupedTransactions = filteredTransactions.reduce((groups, tx) => {
    const dateKey = format(tx.dateTime, 'yyyy-MM-dd');
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(tx);
    return groups;
  }, {} as Record<string, typeof allTransactions>);

  const getDailyTotals = (txs: typeof allTransactions) => {
    const spent = txs.filter(t => t.type === 'DEBIT').reduce((s, t) => s + t.amount, 0);
    const received = txs.filter(t => t.type === 'CREDIT').reduce((s, t) => s + t.amount, 0);
    return { spent, received };
  };

  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return `Today, ${format(date, 'MMMM d')}`;
    if (isYesterday(date)) return `Yesterday, ${format(date, 'MMMM d')}`;
    return format(date, 'EEEE, MMMM d');
  };

  const getHeaderText = () => {
    if (dateRange) {
      const startStr = format(dateRange.start, 'MMM d, yyyy');
      const endStr = format(dateRange.end, 'MMM d, yyyy');
      return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
    }
    return format(currentMonth, 'MMMM yyyy');
  };

  const SORT_OPTIONS: { id: SortMode; label: string }[] = [
    { id: 'date', label: 'Latest First' },
    { id: 'amount_high', label: 'Highest Amount' },
    { id: 'amount_low', label: 'Lowest Amount' },
    { id: 'category', label: 'Category A-Z' },
  ];

  return (
    <div className="relative min-h-[calc(100vh-8rem)] pb-20 max-w-2xl mx-auto px-4">
      <header className="sticky top-0 bg-[#060608] z-30 pt-4 pb-2">
        <div className="flex items-center justify-between mb-6">
          {!isSearchOpen ? (
            <>
              <h1 className="text-3xl font-bold text-white tracking-tight">Analysis</h1>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsSearchOpen(true)}
                  className="p-2.5 bg-[#111111] border border-[#222222] rounded-full text-[#A0A0A0] hover:text-white transition-colors shadow-sm"
                >
                  <Search className="w-5 h-5" />
                </button>
                <button className="p-2.5 bg-[#111111] border border-[#222222] rounded-full text-[#A0A0A0] hover:text-white transition-colors shadow-sm">
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center gap-3 animate-in slide-in-from-right-4 duration-300">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666666]" />
                <input
                  autoFocus
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search and analyze..."
                  className="w-full pl-10 pr-10 py-2.5 bg-[#111111] border border-[#222222] text-white rounded-2xl focus:outline-none focus:ring-1 focus:ring-[#333333] font-medium"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-[#A0A0A0]" />
                  </button>
                )}
              </div>
              <button 
                onClick={() => { setIsSearchOpen(false); setSearchTerm(''); }}
                className="text-sm font-bold text-[#A0A0A0] hover:text-white transition-colors px-1"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="bg-[#0C0C0F] p-1 rounded-2xl flex items-center mb-6">
          {(['WEEK', 'MONTH', 'YEAR', 'CUSTOM'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handleDatePresetChange(p)}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                datePreset === p ? 'bg-[#222222] text-white shadow-sm' : 'text-[#717171] hover:text-[#A0A0A0]'
              }`}
            >
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="bg-[#111111] p-3 rounded-[28px] border border-[#222222] flex items-center justify-between shadow-sm">
          <button onClick={handlePrevMonth} className="p-3 text-[#A0A0A0] hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold text-[#F7F7F7] leading-none mb-1">{getHeaderText()}</h2>
            <p className="text-[10px] font-black text-[#666666] tracking-[0.1em] uppercase">
              {filteredTransactions.length} TRANSACTIONS
            </p>
          </div>
          <button onClick={handleNextMonth} className="p-3 text-[#A0A0A0] hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex gap-2">
            <Link 
              to={`/transactions/table?start=${filterStart.toISOString()}&end=${filterEnd.toISOString()}`}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-[#F7F7F7] text-[#111111] hover:bg-white rounded-2xl font-bold transition-all shadow-sm text-sm active:scale-95"
            >
              <ListOrdered className="w-4 h-4" />
              View Report
            </Link>
            <button 
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-2xl font-bold transition-all shadow-sm text-sm active:scale-95 ${isFiltersOpen ? 'bg-white text-[#111111] border-white' : 'bg-[#111111] border-[#222222] text-[#A0A0A0] hover:text-white hover:border-[#333333]'}`}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
          
          {isFiltersOpen && (
            <div className="bg-[#111111] rounded-[24px] border border-[#222222] shadow-sm p-5 space-y-5 animate-in slide-in-from-top-2 duration-200">
              <div>
                <label className="block text-[10px] font-black text-[#666666] uppercase tracking-[0.1em] mb-3">Transaction Type</label>
                <div className="flex flex-wrap gap-2">
                  {[{ id: 'ALL', label: 'All' }, { id: 'CREDIT', label: 'Income' }, { id: 'DEBIT', label: 'Expense' }].map(type => (
                    <button key={type.id} onClick={() => setEntryTypeFilter(type.id as any)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${entryTypeFilter === type.id ? 'bg-white text-[#111111]' : 'bg-[#1A1A1A] text-[#717171] hover:text-[#A0A0A0]'}`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#666666] uppercase tracking-[0.1em] mb-3">Sort Order</label>
                <div className="flex flex-wrap gap-2">
                  {SORT_OPTIONS.map(opt => (
                    <button key={opt.id} onClick={() => setSortMode(opt.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${sortMode === opt.id ? 'bg-white text-[#111111]' : 'bg-[#1A1A1A] text-[#717171] hover:text-[#A0A0A0]'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-[#666666] uppercase tracking-[0.1em] mb-3">Categories</label>
                <div className="flex flex-wrap gap-2">
                  {['ALL', ...appCategories].map(type => (
                    <button key={type} onClick={() => setSortTypeFilter(type)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${sortTypeFilter === type ? 'bg-white text-[#111111]' : 'bg-[#1A1A1A] text-[#717171] hover:text-[#A0A0A0]'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="space-y-6 mt-2">
        {Object.keys(groupedTransactions).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-300">
            <div className="relative w-40 h-40 mb-8 opacity-90">
              <div className="absolute inset-0 bg-amber-200/5 blur-3xl rounded-full"></div>
              <img src="https://cdn-icons-png.flaticon.com/512/6190/6190113.png" alt="Empty Transactions" className="w-full h-full object-contain relative z-10" />
            </div>
            <p className="text-xl font-bold text-[#A0A0A0] mb-2">No transactions</p>
            {!searchTerm && (
              <Link to="/?add=true" className="mt-4 px-6 py-2.5 bg-[#F7F7F7] text-[#111111] rounded-full font-bold text-sm hover:bg-white transition-all active:scale-95 shadow-sm">
                Start Journey
              </Link>
            )}
          </div>
        ) : (
          Object.entries(groupedTransactions).map(([date, txs]) => {
            const daily = getDailyTotals(txs);
            return (
              <div key={date} className="mb-6">
                <div className="flex items-center justify-between mb-3 px-2">
                  <h3 className="text-xs font-bold text-[#717171] dark:text-[#A0A0A0] uppercase tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#222222] dark:bg-[#F7F7F7]"></div>
                    {formatDateHeader(date)}
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] font-bold">
                    {daily.spent > 0 && <span className="text-rose-500">-₹{daily.spent.toLocaleString('en-IN')}</span>}
                    {daily.received > 0 && <span className="text-emerald-500">+₹{daily.received.toLocaleString('en-IN')}</span>}
                  </div>
                </div>
                <div className="bg-white dark:bg-[#111111] rounded-[20px] border border-[#EBEBEB] dark:border-[#222222] shadow-[0_6px_16px_rgba(0,0,0,0.04)] overflow-hidden">
                  <div className="divide-y divide-[#EBEBEB] dark:divide-[#222222]">
                    {txs.map(tx => (
                      <div key={tx.id} onClick={() => { setSelectedTx(tx); setIsEditing(false); }} className="flex items-center gap-3 sm:gap-4 p-4 hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer group">
                        <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xl sm:text-2xl shrink-0 ${CATEGORY_COLORS[tx.category] || CATEGORY_COLORS['Other']} group-hover:scale-105 transition-transform`}>
                          {CATEGORY_ICONS[tx.category] || '📝'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-[#222222] dark:text-[#F7F7F7] truncate">
                              <HighlightText text={tx.party || tx.category} highlight={searchTerm} />
                            </h4>
                            {tx.expenseType && (<span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-[#222222] text-[#717171] dark:text-[#A0A0A0] whitespace-nowrap">{tx.expenseType}</span>)}
                          </div>
                          {tx.note && (<p className="text-sm text-[#717171] dark:text-[#A0A0A0] truncate mt-0.5"><HighlightText text={tx.note} highlight={searchTerm} /></p>)}
                          <p className="text-xs font-medium text-[#B0B0B0] dark:text-[#666666] truncate mt-1 flex items-center gap-1">
                            {tx.paymentMethod === 'UPI' ? `UPI${tx.upiApp ? ` • ${tx.upiApp}` : ''}` : tx.paymentMethod === 'Bank' ? 'Bank' : 'Cash'}
                            <span className="w-1 h-1 rounded-full bg-[#EBEBEB] dark:bg-[#333333] mx-1"></span>
                            {format(tx.dateTime, 'h:mm a')}
                          </p>
                        </div>
                        <div className={`text-lg font-black shrink-0 ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {tx.type === 'CREDIT' ? '+' : '-'} ₹{tx.amount.toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      <Link to="/" className="fixed bottom-20 md:bottom-6 right-6 w-14 h-14 bg-[#222222] dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-full shadow-lg flex items-center justify-center hover:bg-black dark:hover:bg-neutral-200 transition-transform active:scale-95 z-20">
        <Plus className="w-6 h-6" />
      </Link>

      {isDatePickerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111111] rounded-[24px] w-full max-w-md overflow-hidden shadow-xl">
            <div className="p-5 border-b border-[#EBEBEB] dark:border-[#222222] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#222222] dark:text-[#F7F7F7]">Select Date Range</h3>
              <button onClick={() => setIsDatePickerOpen(false)} className="text-[#717171] dark:text-[#A0A0A0] hover:text-[#222222] dark:hover:text-[#F7F7F7] p-2 hover:bg-neutral-100 dark:hover:bg-[#222222] rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1.5">Start Date</label>
                <input type="date" value={tempStartDate} onChange={(e) => setTempStartDate(e.target.value)} className="w-full px-4 py-3 border border-[#B0B0B0] dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] outline-none transition-shadow bg-white dark:bg-[#1A1A1A] text-[#222222] dark:text-[#F7F7F7]" />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1.5">End Date (Optional)</label>
                <input type="date" value={tempEndDate} onChange={(e) => setTempEndDate(e.target.value)} min={tempStartDate} className="w-full px-4 py-3 border border-[#B0B0B0] dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] outline-none transition-shadow bg-white dark:bg-[#1A1A1A] text-[#222222] dark:text-[#F7F7F7]" />
                <p className="text-xs text-[#717171] dark:text-[#A0A0A0] font-medium mt-1.5">Leave empty for a single day</p>
              </div>
            </div>
            <div className="p-5 border-t border-[#EBEBEB] dark:border-[#222222] flex flex-col sm:flex-row gap-3 justify-end">
              {dateRange && (<button onClick={clearDateFilter} className="px-5 py-2.5 text-[#222222] dark:text-[#F7F7F7] hover:bg-neutral-100 dark:hover:bg-[#222222] rounded-xl font-bold transition-colors sm:mr-auto">Clear Filter</button>)}
              <button onClick={() => setIsDatePickerOpen(false)} className="px-5 py-2.5 text-[#222222] dark:text-[#F7F7F7] hover:bg-neutral-100 dark:hover:bg-[#222222] rounded-xl font-bold transition-colors">Cancel</button>
              <button onClick={applyDateFilter} disabled={!tempStartDate} className="px-5 py-2.5 bg-[#222222] dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-xl font-bold hover:bg-black dark:hover:bg-neutral-200 transition-colors disabled:opacity-50">Apply</button>
            </div>
          </div>
        </div>
      )}

      {selectedTx && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111111] rounded-[24px] w-full max-w-md overflow-hidden shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-[#EBEBEB] dark:border-[#222222] flex justify-between items-center sticky top-0 bg-white dark:bg-[#111111] z-10">
              <h3 className="text-lg font-bold text-[#222222] dark:text-[#F7F7F7]">{isEditing ? 'Edit Transaction' : 'Transaction Details'}</h3>
              <button onClick={() => { setSelectedTx(null); setIsEditing(false); }} className="text-[#717171] dark:text-[#A0A0A0] hover:text-[#222222] dark:hover:text-[#F7F7F7] p-2 hover:bg-neutral-100 dark:hover:bg-[#222222] rounded-full transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div><label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1.5">Amount *</label><input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} step="0.01" className="w-full px-4 py-3 border border-[#B0B0B0] dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] outline-none bg-white dark:bg-[#1A1A1A] text-[#222222] dark:text-[#F7F7F7]" /></div>
                  <div><label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1.5">Party</label><input type="text" value={editParty} onChange={e => setEditParty(e.target.value)} className="w-full px-4 py-3 border border-[#B0B0B0] dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] outline-none bg-white dark:bg-[#1A1A1A] text-[#222222] dark:text-[#F7F7F7]" /></div>
                  <div><label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1.5">Note</label><input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} className="w-full px-4 py-3 border border-[#B0B0B0] dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] outline-none bg-white dark:bg-[#1A1A1A] text-[#222222] dark:text-[#F7F7F7]" /></div>
                  <div><label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1.5">Category</label><select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-full px-4 py-3 border border-[#B0B0B0] dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] outline-none bg-white dark:bg-[#1A1A1A] text-[#222222] dark:text-[#F7F7F7]">{['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Entertainment', 'Salary', 'Transfer', 'Other'].map(c => (<option key={c} value={c}>{c}</option>))}</select></div>
                </div>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl mb-4 ${CATEGORY_COLORS[selectedTx.category] || CATEGORY_COLORS['Other']}`}>{CATEGORY_ICONS[selectedTx.category] || '📝'}</div>
                    <h2 className={`text-4xl font-bold tracking-tight ${selectedTx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>{selectedTx.type === 'CREDIT' ? '+' : '-'} ₹{selectedTx.amount.toLocaleString('en-IN')}</h2>
                    <p className="text-[#717171] dark:text-[#A0A0A0] mt-2 font-medium">{selectedTx.party || selectedTx.category}</p>
                  </div>
                  <div className="bg-neutral-50 dark:bg-[#1A1A1A] rounded-[20px] p-5 border border-[#EBEBEB] dark:border-[#222222]">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
                      <div><p className="text-[#717171] dark:text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-1.5">Date & Time</p><p className="font-bold text-[#222222] dark:text-[#F7F7F7]">{format(selectedTx.dateTime, 'MMM d, yyyy')}</p><p className="text-[#717171] dark:text-[#A0A0A0] font-medium text-xs mt-0.5">{format(selectedTx.dateTime, 'h:mm a')}</p></div>
                      <div><p className="text-[#717171] dark:text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-1.5">Category</p><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-neutral-200 dark:bg-[#222222] text-[#222222] dark:text-[#F7F7F7]">{selectedTx.category}</span></div>
                      {selectedTx.expenseType && (<div><p className="text-[#717171] dark:text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-1.5">Type</p><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-neutral-200 dark:bg-[#222222] text-[#222222] dark:text-[#F7F7F7]">{selectedTx.expenseType}</span></div>)}
                      <div><p className="text-[#717171] dark:text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-1.5">Payment Method</p><p className="font-bold text-[#222222] dark:text-[#F7F7F7]">{selectedTx.paymentMethod === 'UPI' ? `UPI${selectedTx.upiApp ? ` (${selectedTx.upiApp})` : ''}` : selectedTx.paymentMethod === 'Bank' ? 'Bank Transfer' : 'Cash'}</p></div>
                      <div><p className="text-[#717171] dark:text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-1.5">Account</p><p className="font-bold text-[#222222] dark:text-[#F7F7F7]">{accounts.find(a => a.id === selectedTx.accountId)?.bankName || 'Unknown'} {accounts.find(a => a.id === selectedTx.accountId)?.accountLast4 ? ` ••••${accounts.find(a => a.id === selectedTx.accountId)?.accountLast4}` : ''}</p></div>
                      <div className="col-span-2 pt-4 border-t border-[#EBEBEB] dark:border-[#222222]"><p className="text-[#717171] dark:text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-1.5">Note / Reason</p><p className="font-bold text-[#222222] dark:text-[#F7F7F7] whitespace-pre-wrap">{selectedTx.note || '—'}</p></div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="p-5 border-t border-[#EBEBEB] dark:border-[#222222] bg-white dark:bg-[#111111] flex flex-wrap gap-2 sticky bottom-0">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} className="px-5 py-2.5 text-[#222222] dark:text-[#F7F7F7] hover:bg-neutral-100 dark:hover:bg-[#222222] rounded-xl font-bold transition-colors mr-auto">Cancel</button>
                  <button onClick={saveEdit} disabled={!editAmount} className="px-5 py-2.5 bg-[#222222] dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-xl font-bold hover:bg-black dark:hover:bg-neutral-200 transition-colors disabled:opacity-50">Save Changes</button>
                </>
              ) : (
                <>
                  <button onClick={() => handleDelete(selectedTx.id!)} className="px-4 py-2.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl font-bold transition-colors flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete</button>
                  <div className="flex-1" />
                  <button onClick={() => duplicateTransaction(selectedTx)} className="px-4 py-2.5 text-[#717171] dark:text-[#A0A0A0] hover:bg-neutral-100 dark:hover:bg-[#222222] rounded-xl font-bold transition-colors flex items-center gap-2 text-sm"><Copy className="w-4 h-4" /> Repeat</button>
                  <button onClick={() => startEditing(selectedTx)} className="px-4 py-2.5 bg-[#222222] dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-xl font-bold hover:bg-black dark:hover:bg-neutral-200 transition-colors flex items-center gap-2 text-sm"><Edit3 className="w-4 h-4" /> Edit</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
