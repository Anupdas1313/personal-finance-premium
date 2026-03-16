import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../lib/db';
import { format, startOfMonth, endOfMonth, isWithinInterval, isToday, isYesterday, parseISO, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
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
  'Food': 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-500',
  'Transport': 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-500',
  'Rent': 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-500',
  'Shopping': 'bg-pink-100 dark:bg-pink-900/40 text-pink-600 dark:text-pink-500',
  'Bills': 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-500',
  'Entertainment': 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-500',
  'Salary': 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-500',
  'Transfer': 'bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-600 dark:text-[#A0A0A0]',
  'Other': 'bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-600 dark:text-[#A0A0A0]'
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
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const { categories: appCategories } = useCategories();

  const filterStart = dateRange ? dateRange.start : startOfMonth(currentMonth);
  const filterEnd = dateRange ? dateRange.end : endOfMonth(currentMonth);

  const allTransactions = useLiveQuery(() => 
    db.transactions.where('dateTime').between(filterStart, filterEnd, true, true).reverse().toArray()
  , [filterStart, filterEnd]) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  
  let filteredTransactions = allTransactions.filter(tx => {
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

    return matchesEntryType && matchesSortType && matchesSearch;
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
      amount: parseFloat(editAmount.toString().replace(/,/g, '')) || 0,
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
      <header className="sticky top-0 bg-[#F7F7F7] dark:bg-[#060608] z-30 pt-4 pb-2">

        <div className="flex items-center justify-between mb-6">
          {!isSearchOpen ? (
            <>
              <h1 className="text-4xl font-black text-brand-blue dark:text-white tracking-tighter">Timeline</h1>

              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  className={`p-2.5 border rounded-full transition-all shadow-sm ${
                    isFiltersOpen 
                      ? "bg-brand-blue border-brand-blue text-white dark:bg-white dark:border-white dark:text-[#111111]" 
                      : "bg-white border-brand-blue/5 text-brand-blue hover:text-brand-green dark:bg-[#111111] dark:border-[#222222] dark:text-[#A0A0A0] dark:hover:text-white"
                  }`}



                  title="Filters"
                >
                  <Filter className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setIsCalendarOpen(true)}
                  className={`p-2.5 border rounded-full transition-all shadow-sm ${
                    isCalendarOpen 
                      ? "bg-brand-blue border-brand-blue text-white dark:bg-white dark:border-white dark:text-[#111111]" 
                      : "bg-white border-brand-blue/5 text-brand-blue/40 hover:text-brand-blue dark:bg-[#111111] dark:border-[#222222] dark:text-[#A0A0A0] dark:hover:text-white"
                  }`}
                  title="Calendar View"
                >
                  <CalendarIcon className="w-5 h-5" />
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
                  placeholder="Analyze transactions..."
                  className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#111111] border border-brand-blue/10 dark:border-[#222222] text-brand-blue dark:text-white rounded-2xl focus:outline-none focus:ring-1 focus:ring-brand-cyan font-black"
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

        {/* Month Navigation Card - Full Width */}
        <div className="bg-white dark:bg-[#111111] p-1.5 rounded-2xl border border-brand-blue/5 dark:border-[#222222] flex items-center justify-between shadow-sm mb-4">



          <button onClick={handlePrevMonth} className="p-2 text-brand-blue/40 hover:text-brand-blue transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-sm font-black text-brand-blue dark:text-[#F7F7F7] leading-tight uppercase tracking-widest">{getHeaderText()}</h2>


            <p className="text-[9px] font-black text-brand-green tracking-[0.05em] uppercase">
              {filteredTransactions.length} Checkpoints
            </p>

          </div>
          <button onClick={handleNextMonth} className="p-2 text-brand-blue/40 hover:text-brand-blue transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>


        </div>

        {/* Date Presets Selector */}
        <div className="bg-neutral-100 dark:bg-[#0C0C0F] p-1 rounded-2xl flex items-center mb-4">

          {(['WEEK', 'MONTH', 'YEAR', 'CUSTOM'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handleDatePresetChange(p)}
              className={`flex-1 py-2 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${
                datePreset === p ? 'bg-brand-blue text-white shadow-lg scale-105' : 'text-brand-blue/40 hover:text-brand-blue'
              }`}



            >
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Report Button - Full Width */}
        <Link 
          to={`/transactions/table?start=${filterStart.toISOString()}&end=${filterEnd.toISOString()}`}
          className="w-full py-3.5 flex items-center justify-center gap-2 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] hover:bg-brand-green/90 hover:ring-2 hover:ring-brand-cyan rounded-2xl font-black transition-all shadow-lg text-[10px] uppercase tracking-[0.2em] active:scale-95 mb-6"
        >
          <ListOrdered className="w-4 h-4" />
          Detailed Manifest
        </Link>


        {isFiltersOpen && (
          <div className="mt-4 bg-white dark:bg-[#111111] rounded-[24px] border border-[#EBEBEB] dark:border-[#222222] shadow-xl p-5 space-y-5 animate-in slide-in-from-top-2 duration-300">

            <div>
              <label className="block text-[10px] font-black text-[#666666] uppercase tracking-[0.1em] mb-3">Transaction Type</label>
              <div className="flex flex-wrap gap-2">
                {[{ id: 'ALL', label: 'All' }, { id: 'CREDIT', label: 'Inflow' }, { id: 'DEBIT', label: 'Outflow' }].map(type => (
                  <button key={type.id} onClick={() => setEntryTypeFilter(type.id as any)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${entryTypeFilter === type.id ? 'bg-brand-blue text-white shadow-md' : 'bg-brand-blue/5 text-brand-blue/40'}`}
                  >
                    {type.label}
                  </button>
                )) }
              </div>

            </div>
            <div>
              <label className="block text-[10px] font-black text-[#666666] uppercase tracking-[0.1em] mb-3">Sort Order</label>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map(opt => (
                  <button key={opt.id} onClick={() => setSortMode(opt.id)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortMode === opt.id ? 'bg-brand-blue text-white shadow-md' : 'bg-brand-blue/5 text-brand-blue/40'}`}
                  >
                    {opt.label}
                  </button>
                )) }
              </div>

            </div>
            <div>
              <label className="block text-[10px] font-black text-[#666666] uppercase tracking-[0.1em] mb-3">Categories</label>
              <div className="flex flex-wrap gap-2">
                {['ALL', ...appCategories].map(type => (
                  <button key={type} onClick={() => setSortTypeFilter(type)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${sortTypeFilter === type ? 'bg-[#222222] text-white dark:bg-white dark:text-[#111111]' : 'bg-neutral-100 dark:bg-[#1A1A1A] text-[#717171] dark:text-[#717171] hover:text-[#222222] dark:hover:text-[#A0A0A0]'}`}

                  >
                    {type}
                  </button>
                )) }
              </div>
            </div>
          </div>
        )}

        {isCalendarOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-[#111111] border border-[#222222] rounded-[32px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="p-5 border-b border-[#222222] flex justify-between items-center bg-[#16161A]">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-white tracking-tight">{format(calendarMonth, 'MMMM yyyy')}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))} className="p-2 text-[#717171] hover:text-white hover:bg-[#222222] rounded-full transition-all">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-2 text-[#717171] hover:text-white hover:bg-[#222222] rounded-full transition-all">
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button onClick={() => setIsCalendarOpen(false)} className="p-2 ml-2 text-[#717171] hover:text-white hover:bg-rose-500/10 hover:text-rose-500 rounded-full transition-all">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="p-5">
                <div className="grid grid-cols-7 mb-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} className="text-center text-[10px] font-black text-[#444444] uppercase tracking-wider py-2">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {eachDayOfInterval({
                    start: startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 }),
                    end: endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 })
                  }).map((day, i) => {
                    const isSelected = dateRange && isSameDay(day, dateRange.start) && isSameDay(day, dateRange.end);
                    const hasTransactions = allTransactions.some(tx => isSameDay(tx.dateTime, day));
                    const isCurrentMonth = isSameMonth(day, calendarMonth);
                    
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setDateRange({ start: startOfDay(day), end: endOfDay(day) });
                          setDatePreset('CUSTOM');
                          setIsCalendarOpen(false);
                        }}
                        className={`
                          relative h-12 flex flex-col items-center justify-center rounded-2xl transition-all group
                          ${!isCurrentMonth ? 'opacity-20' : 'opacity-100'}
                          ${isSelected ? 'bg-white text-[#111111]' : 'hover:bg-[#1A1A1A] text-[#A0A0A0]'}
                        `}
                      >
                        <span className={`text-sm font-bold ${isSelected ? 'text-[#111111]' : 'group-hover:text-white'}`}>
                          {format(day, 'd')}
                        </span>
                        {hasTransactions && !isSelected && (
                          <div className="absolute bottom-2 w-1 h-1 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        )}
                        {isToday(day) && !isSelected && (
                          <div className="absolute top-2 right-2 w-1 h-1 rounded-full bg-blue-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className="p-4 bg-[#16161A] border-t border-[#222222]">
                <button 
                  onClick={() => {
                    setDateRange(null);
                    setCalendarMonth(new Date());
                    setDatePreset('MONTH');
                    setIsCalendarOpen(false);
                  }}
                  className="w-full py-3 bg-[#222222] text-[#A0A0A0] hover:text-white rounded-2xl text-xs font-bold transition-all"
                >
                  Reset to Current Month
                </button>
              </div>
            </div>
          </div>
        )}
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
            <Link to="/?add=true" className="mt-4 px-6 py-2.5 bg-brand-green text-white rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-brand-green/90 transition-all active:scale-95 shadow-lg shadow-brand-green/20">
                Deploy Transaction
              </Link>

            )}
          </div>
        ) : (
          Object.entries(groupedTransactions).map(([date, txs]) => {
            const daily = getDailyTotals(txs);
            return (
              <div key={date} className="mb-6">
                <div className="flex items-center justify-between mb-3 px-2">
                  <h3 className="text-[10px] font-black text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-widest flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue dark:bg-[#F7F7F7]"></div>
                    {formatDateHeader(date)}
                  </h3>

                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-tighter">
                    {daily.spent > 0 && <span className="text-brand-red">-₹{daily.spent.toLocaleString('en-IN')}</span>}
                    {daily.received > 0 && <span className="text-brand-green">+₹{daily.received.toLocaleString('en-IN')}</span>}
                  </div>
                </div>


                <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-[#EBEBEB] dark:border-[#222222] shadow-[0_8px_40px_rgba(26,35,126,0.05)] overflow-hidden">


                  <div className="divide-y divide-[#EBEBEB] dark:divide-[#222222]">
                    {txs.map(tx => (
                      <div key={tx.id} onClick={() => { setSelectedTx(tx); setIsEditing(false); }} className="flex items-center gap-3 p-3 hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors cursor-pointer group">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shrink-0 ${CATEGORY_COLORS[tx.category] || CATEGORY_COLORS['Other']} group-hover:scale-105 transition-transform`}>
                          {CATEGORY_ICONS[tx.category] || '📝'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-brand-blue dark:text-[#F7F7F7] truncate">
                              <HighlightText text={tx.party || tx.category} highlight={searchTerm} />
                            </h4>

                            {tx.expenseType && (<span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-brand-blue/5 dark:bg-[#222222] text-brand-blue/40 dark:text-[#A0A0A0] whitespace-nowrap uppercase tracking-tighter shadow-sm border border-brand-blue/5">{tx.expenseType}</span>)}
                          </div>
                          {tx.note && (<p className="text-[10px] text-brand-blue/30 dark:text-[#A0A0A0] font-black truncate mt-0.5 uppercase tracking-widest"><HighlightText text={tx.note} highlight={searchTerm} /></p>)}


                          <p className="text-[10px] font-medium text-[#B0B0B0] dark:text-[#666666] truncate mt-0.5 flex items-center gap-1">
                            {tx.paymentMethod === 'UPI' ? `UPI${tx.upiApp ? ` • ${tx.upiApp}` : ''}` : tx.paymentMethod === 'Bank' ? 'Bank' : 'Cash'}
                            <span className="w-1 h-1 rounded-full bg-[#EBEBEB] dark:bg-[#333333] mx-1"></span>
                            {format(tx.dateTime, 'h:mm a')}
                          </p>
                        </div>
                        <div className={`text-sm font-black shrink-0 ${tx.type === 'CREDIT' ? 'text-brand-green' : 'text-brand-blue dark:text-[#F7F7F7]'}`}>
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

      <Link to="/" className="fixed bottom-20 md:bottom-6 right-6 w-16 h-16 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-full shadow-2xl flex items-center justify-center hover:bg-brand-green/90 hover:ring-4 hover:ring-brand-cyan/30 transition-all active:scale-95 z-40 transform hover:-rotate-12">
        <Plus className="w-8 h-8" />
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
                  <div><label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1.5">Amount *</label><input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value.toString().replace(/,/g, ''))} step="0.01" className="w-full px-4 py-3 border border-[#B0B0B0] dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] outline-none bg-white dark:bg-[#1A1A1A] text-[#222222] dark:text-[#F7F7F7]" /></div>
                  <div><label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1.5">Party</label><input type="text" value={editParty} onChange={e => setEditParty(e.target.value)} className="w-full px-4 py-3 border border-[#B0B0B0] dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] outline-none bg-white dark:bg-[#1A1A1A] text-[#222222] dark:text-[#F7F7F7]" /></div>
                  <div><label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1.5">Note</label><input type="text" value={editNote} onChange={e => setEditNote(e.target.value)} className="w-full px-4 py-3 border border-[#B0B0B0] dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] outline-none bg-white dark:bg-[#1A1A1A] text-[#222222] dark:text-[#F7F7F7]" /></div>
                  <div><label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1.5">Category</label><select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="w-full px-4 py-3 border border-[#B0B0B0] dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] outline-none bg-white dark:bg-[#1A1A1A] text-[#222222] dark:text-[#F7F7F7]">{['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Entertainment', 'Salary', 'Transfer', 'Other'].map(c => (<option key={c} value={c}>{c}</option>))}</select></div>
                </div>
              ) : (
                <>
                  <div className="text-center mb-6">
                    <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl mb-4 ${CATEGORY_COLORS[selectedTx.category] || CATEGORY_COLORS['Other']}`}>{CATEGORY_ICONS[selectedTx.category] || '📝'}</div>
                    <h2 className={`text-4xl font-black tracking-tight ${selectedTx.type === 'CREDIT' ? 'text-brand-green' : 'text-brand-red'}`}>{selectedTx.type === 'CREDIT' ? '+' : '-'} ₹{selectedTx.amount.toLocaleString('en-IN')}</h2>
                    <p className="text-brand-blue/40 dark:text-[#A0A0A0] mt-2 font-black uppercase tracking-widest text-xs">{selectedTx.party || selectedTx.category}</p>
                  </div>

                  <div className="bg-neutral-50 dark:bg-[#1A1A1A] rounded-[20px] p-5 border border-[#EBEBEB] dark:border-[#222222]">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
                      <div><p className="text-[#525252] dark:text-[#A0A0A0] text-xs font-black uppercase tracking-wider mb-1.5">Date & Time</p><p className="font-black text-[#111111] dark:text-[#F7F7F7]">{format(selectedTx.dateTime, 'MMM d, yyyy')}</p><p className="text-[#525252] dark:text-[#A0A0A0] font-bold text-xs mt-0.5">{format(selectedTx.dateTime, 'h:mm a')}</p></div>
                      <div><p className="text-[#525252] dark:text-[#A0A0A0] text-xs font-black uppercase tracking-wider mb-1.5">Category</p><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-neutral-200 dark:bg-[#222222] text-[#111111] dark:text-[#F7F7F7]">{selectedTx.category}</span></div>

                      {selectedTx.expenseType && (<div><p className="text-[#717171] dark:text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-1.5">Type</p><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-neutral-200 dark:bg-[#222222] text-[#222222] dark:text-[#F7F7F7]">{selectedTx.expenseType}</span></div>)}
                      <div><p className="text-[#717171] dark:text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-1.5">Payment Method</p><p className="font-bold text-[#222222] dark:text-[#F7F7F7]">{selectedTx.paymentMethod === 'UPI' ? `UPI${selectedTx.upiApp ? ` (${selectedTx.upiApp})` : ''}` : selectedTx.paymentMethod === 'Bank' ? 'Bank Transfer' : 'Cash'}</p></div>
                      <div>
                        <p className="text-[#717171] dark:text-[#A0A0A0] text-xs font-bold uppercase tracking-wider mb-1.5">Account</p>
                        <p className="font-bold text-[#222222] dark:text-[#F7F7F7]">
                          {accounts.find(a => a.id === selectedTx.accountId)?.bankName || 'Unknown'} 
                          {accounts.find(a => a.id === selectedTx.accountId)?.accountLast4 ? (
                            (accounts.find(a => a.id === selectedTx.accountId) as any)?.type === 'CASH' 
                              ? ` (${accounts.find(a => a.id === selectedTx.accountId)?.accountLast4})`
                              : ` ••••${accounts.find(a => a.id === selectedTx.accountId)?.accountLast4}`
                          ) : ''}
                        </p>
                      </div>
                      <div className="col-span-2 pt-4 border-t border-[#EBEBEB] dark:border-[#222222]"><p className="text-[#525252] dark:text-[#A0A0A0] text-xs font-black uppercase tracking-wider mb-1.5">Note / Reason</p><p className="font-black text-[#111111] dark:text-[#F7F7F7] whitespace-pre-wrap">{selectedTx.note || '—'}</p></div>

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
