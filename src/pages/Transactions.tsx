import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { format, startOfMonth, endOfMonth, isWithinInterval, isToday, isYesterday, parseISO, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Trash2, ArrowDownLeft, ArrowUpRight, Wallet, Share2, Filter } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  'Food': 'bg-orange-100 text-orange-600',
  'Transport': 'bg-blue-100 text-blue-600',
  'Rent': 'bg-purple-100 text-purple-600',
  'Shopping': 'bg-pink-100 text-pink-600',
  'Bills': 'bg-yellow-100 text-yellow-600',
  'Entertainment': 'bg-red-100 text-red-600',
  'Salary': 'bg-emerald-100 text-emerald-600',
  'Transfer': 'bg-neutral-100 text-[#222222]',
  'Other': 'bg-neutral-100 text-[#717171]'
};

export default function Transactions() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [entryTypeFilter, setEntryTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [datePreset, setDatePreset] = useState<'CUSTOM' | 'LAST_30' | 'LAST_10' | 'THIS_WEEK'>('CUSTOM');
  const [sortTypeFilter, setSortTypeFilter] = useState<string>('ALL');

  const { categories: appCategories } = useCategories();

  const allTransactions = useLiveQuery(() => db.transactions.orderBy('dateTime').reverse().toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  
  const filterStart = dateRange ? dateRange.start : startOfMonth(currentMonth);
  const filterEnd = dateRange ? dateRange.end : endOfMonth(currentMonth);

  const filteredTransactions = allTransactions.filter(tx => {
    const inDateRange = isWithinInterval(tx.dateTime, { start: filterStart, end: filterEnd });
    const matchesEntryType = entryTypeFilter === 'ALL' || tx.type === entryTypeFilter;
    const matchesSortType = sortTypeFilter === 'ALL' || tx.expenseType === sortTypeFilter;
    return inDateRange && matchesEntryType && matchesSortType;
  });

  const expenses = filteredTransactions.filter(tx => tx.type === 'DEBIT');
  const income = filteredTransactions.filter(tx => tx.type === 'CREDIT');

  const totalExpense = expenses.reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncome = income.reduce((sum, tx) => sum + tx.amount, 0);
  const balance = totalIncome - totalExpense;

  const handlePrevMonth = () => {
    if (dateRange) setDateRange(null);
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    if (dateRange) setDateRange(null);
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDatePresetChange = (preset: 'CUSTOM' | 'LAST_30' | 'LAST_10' | 'THIS_WEEK') => {
    setDatePreset(preset);
    const today = new Date();
    switch (preset) {
      case 'THIS_WEEK':
        setDateRange({
          start: startOfDay(startOfWeek(today, { weekStartsOn: 1 })),
          end: endOfDay(endOfWeek(today, { weekStartsOn: 1 }))
        });
        break;
      case 'LAST_10':
        setDateRange({
          start: startOfDay(subDays(today, 9)),
          end: endOfDay(today)
        });
        break;
      case 'LAST_30':
        setDateRange({
          start: startOfDay(subDays(today, 29)),
          end: endOfDay(today)
        });
        break;
      case 'CUSTOM':
        setDateRange(null);
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
      setDateRange({
        start: startOfDay(parseISO(tempStartDate)),
        end: endOfDay(parseISO(tempEndDate))
      });
    } else if (tempStartDate) {
      setDateRange({
        start: startOfDay(parseISO(tempStartDate)),
        end: endOfDay(parseISO(tempStartDate))
      });
    }
    setIsDatePickerOpen(false);
  };

  const clearDateFilter = () => {
    setDateRange(null);
    setIsDatePickerOpen(false);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      await db.transactions.delete(id);
      setSelectedTx(null);
    }
  };

  // Group transactions by date
  const groupedTransactions = filteredTransactions.reduce((groups, tx) => {
    const dateKey = format(tx.dateTime, 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(tx);
    return groups;
  }, {} as Record<string, typeof allTransactions>);

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

  return (
    <div className="relative min-h-[calc(100vh-8rem)] pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-[#F7F7F7] z-10 pb-4 pt-2 -mx-4 px-4 md:-mx-8 md:px-8">
        <div className="flex items-center justify-between mb-4">
          <button onClick={handlePrevMonth} className="p-2 text-[#717171] hover:bg-neutral-200 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={openDatePicker}
            className="flex items-center gap-2 px-4 py-2 hover:bg-neutral-200 rounded-xl transition-colors"
          >
            <h2 className="text-lg font-bold text-[#222222]">{getHeaderText()}</h2>
            <CalendarIcon className="w-4 h-4 text-[#717171]" />
          </button>
          <button onClick={handleNextMonth} className="p-2 text-[#717171] hover:bg-neutral-200 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <div className="relative bg-white rounded-[24px] border border-[#EBEBEB] shadow-[0_6px_16px_rgba(0,0,0,0.04)] py-5">
          <button className="absolute top-3 right-3 p-1.5 text-[#717171] hover:bg-neutral-100 rounded-full transition-colors border border-[#EBEBEB] shadow-sm bg-white z-10">
            <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          
          <div className="grid grid-cols-3 divide-x divide-[#EBEBEB]">
            {/* Outflow */}
            <div className="flex flex-col items-center justify-center text-center px-1">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <ArrowDownLeft className="w-3.5 h-3.5 text-rose-500" />
                <span className="text-[11px] sm:text-sm font-semibold text-[#717171]">Total Outflow</span>
              </div>
              <p className="text-base sm:text-2xl font-bold text-rose-600 tracking-tight truncate w-full">
                -₹{totalExpense.toLocaleString('en-IN')}
              </p>
            </div>

            {/* Inflow */}
            <div className="flex flex-col items-center justify-center text-center px-1">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[11px] sm:text-sm font-semibold text-[#717171]">Total Inflow</span>
              </div>
              <p className="text-base sm:text-2xl font-bold text-emerald-600 tracking-tight truncate w-full">
                +₹{totalIncome.toLocaleString('en-IN')}
              </p>
            </div>

            {/* Balance */}
            <div className="flex flex-col items-center justify-center text-center px-1">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <Wallet className="w-3.5 h-3.5 text-[#222222]" />
                <span className="text-[11px] sm:text-sm font-semibold text-[#717171]">Net Balance</span>
              </div>
              <p className={`text-base sm:text-2xl font-bold tracking-tight truncate w-full ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {balance >= 0 ? '+' : '-'}₹{Math.abs(balance).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link 
            to={`/transactions/table?start=${filterStart.toISOString()}&end=${filterEnd.toISOString()}`}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#222222] text-white hover:bg-black rounded-xl font-bold transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            Transaction Report
          </Link>
          
          <button 
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-[#EBEBEB] text-[#222222] hover:bg-neutral-50 rounded-xl font-bold transition-colors shadow-sm"
          >
            <Filter className="w-4 h-4" />
            {isFiltersOpen ? 'Hide Filters' : 'Show Filters'}
          </button>
          
          {isFiltersOpen && (
            <div className="bg-white rounded-[20px] border border-[#EBEBEB] shadow-sm p-4 space-y-4">
              {/* Entry Types */}
              <div>
                <label className="block text-xs font-bold text-[#717171] uppercase tracking-wider mb-2">Entry Types</label>
                <div className="flex flex-wrap gap-2">
                  {['ALL', 'CREDIT', 'DEBIT'].map(type => (
                    <button
                      key={type}
                      onClick={() => setEntryTypeFilter(type as any)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                        entryTypeFilter === type 
                          ? 'bg-[#222222] text-white' 
                          : 'bg-neutral-100 text-[#717171] hover:bg-neutral-200'
                      }`}
                    >
                      {type === 'ALL' ? 'All' : type === 'CREDIT' ? 'Income' : 'Expense'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Presets */}
              <div>
                <label className="block text-xs font-bold text-[#717171] uppercase tracking-wider mb-2">Date</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={openDatePicker}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                      datePreset === 'CUSTOM' && dateRange
                        ? 'bg-[#222222] text-white' 
                        : 'bg-neutral-100 text-[#717171] hover:bg-neutral-200'
                    }`}
                  >
                    Custom Date
                  </button>
                  {[
                    { id: 'THIS_WEEK', label: 'This Week' },
                    { id: 'LAST_10', label: 'Last 10 Days' },
                    { id: 'LAST_30', label: 'Last 30 Days' }
                  ].map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleDatePresetChange(preset.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                        datePreset === preset.id 
                          ? 'bg-[#222222] text-white' 
                          : 'bg-neutral-100 text-[#717171] hover:bg-neutral-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Type */}
              <div>
                <label className="block text-xs font-bold text-[#717171] uppercase tracking-wider mb-2">Sort Type</label>
                <div className="flex flex-wrap gap-2">
                  {['ALL', ...appCategories].map(type => (
                    <button
                      key={type}
                      onClick={() => setSortTypeFilter(type)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                        sortTypeFilter === type 
                          ? 'bg-[#222222] text-white' 
                          : 'bg-neutral-100 text-[#717171] hover:bg-neutral-200'
                      }`}
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

      {/* Transaction List */}
      <main className="space-y-6 mt-2">
        {Object.keys(groupedTransactions).length === 0 ? (
          <div className="text-center py-16 text-[#717171]">
            No transactions found for this period.
          </div>
        ) : (
          Object.entries(groupedTransactions).map(([date, txs]) => (
            <div key={date} className="mb-6">
              <h3 className="text-xs font-bold text-[#717171] uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#222222]"></div>
                {formatDateHeader(date)}
              </h3>
              <div className="bg-white rounded-[20px] border border-[#EBEBEB] shadow-[0_6px_16px_rgba(0,0,0,0.04)] overflow-hidden">
                <div className="divide-y divide-[#EBEBEB]">
                  {txs.map(tx => (
                    <div 
                      key={tx.id} 
                      onClick={() => setSelectedTx(tx)}
                      className="flex items-center gap-4 p-4 hover:bg-neutral-50 transition-colors cursor-pointer group"
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 ${CATEGORY_COLORS[tx.category] || CATEGORY_COLORS['Other']} group-hover:scale-105 transition-transform`}>
                        {CATEGORY_ICONS[tx.category] || '📝'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-bold text-[#222222] truncate group-hover:text-black transition-colors">
                          {tx.party || tx.category}
                        </h4>
                        {tx.note && (
                          <p className="text-sm text-[#717171] truncate mt-0.5">
                            {tx.note}
                          </p>
                        )}
                        <p className="text-xs font-medium text-[#B0B0B0] truncate mt-1 flex items-center gap-1">
                          {tx.paymentMethod === 'UPI' ? `UPI${tx.upiApp ? ` • ${tx.upiApp}` : ''}` : tx.paymentMethod === 'Bank' ? 'Bank' : 'Cash'} 
                          <span className="w-1 h-1 rounded-full bg-[#EBEBEB] mx-1"></span> 
                          {format(tx.dateTime, 'h:mm a')}
                        </p>
                      </div>
                      <div className={`text-lg font-black shrink-0 ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-[#222222]'}`}>
                        {tx.type === 'CREDIT' ? '+' : '-'} ₹{tx.amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </main>

      {/* FAB */}
      <Link 
        to="/"
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#222222] text-white rounded-full shadow-lg flex items-center justify-center hover:bg-black transition-transform active:scale-95 z-20"
      >
        <Plus className="w-6 h-6" />
      </Link>

      {/* Date Picker Modal */}
      {isDatePickerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-md overflow-hidden shadow-xl">
            <div className="p-5 border-b border-[#EBEBEB] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#222222]">Select Date Range</h3>
              <button onClick={() => setIsDatePickerOpen(false)} className="text-[#717171] hover:text-[#222222] p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-[#222222] mb-1.5">Start Date</label>
                <input 
                  type="date" 
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  className="w-full px-4 py-3 border border-[#B0B0B0] rounded-xl focus:ring-2 focus:ring-[#222222] focus:border-[#222222] outline-none transition-shadow"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-[#222222] mb-1.5">End Date (Optional)</label>
                <input 
                  type="date" 
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  min={tempStartDate}
                  className="w-full px-4 py-3 border border-[#B0B0B0] rounded-xl focus:ring-2 focus:ring-[#222222] focus:border-[#222222] outline-none transition-shadow"
                />
                <p className="text-xs text-[#717171] font-medium mt-1.5">Leave empty for a single day</p>
              </div>
            </div>
            
            <div className="p-5 border-t border-[#EBEBEB] bg-white flex flex-col sm:flex-row gap-3 justify-end">
              {dateRange && (
                <button 
                  onClick={clearDateFilter}
                  className="px-5 py-2.5 text-[#222222] hover:bg-neutral-100 rounded-xl font-bold transition-colors sm:mr-auto"
                >
                  Clear Filter
                </button>
              )}
              <button 
                onClick={() => setIsDatePickerOpen(false)}
                className="px-5 py-2.5 text-[#222222] hover:bg-neutral-100 rounded-xl font-bold transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={applyDateFilter}
                disabled={!tempStartDate}
                className="px-5 py-2.5 bg-[#222222] text-white rounded-xl font-bold hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] w-full max-w-md overflow-hidden shadow-xl">
            <div className="p-5 border-b border-[#EBEBEB] flex justify-between items-center">
              <h3 className="text-lg font-bold text-[#222222]">Transaction Details</h3>
              <button onClick={() => setSelectedTx(null)} className="text-[#717171] hover:text-[#222222] p-2 hover:bg-neutral-100 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl mb-4 ${CATEGORY_COLORS[selectedTx.category] || CATEGORY_COLORS['Other']}`}>
                  {CATEGORY_ICONS[selectedTx.category] || '📝'}
                </div>
                <h2 className={`text-4xl font-bold tracking-tight ${selectedTx.type === 'CREDIT' ? 'text-emerald-600' : 'text-[#222222]'}`}>
                  {selectedTx.type === 'CREDIT' ? '+' : '-'} ₹{selectedTx.amount.toLocaleString('en-IN')}
                </h2>
                <p className="text-[#717171] mt-2 font-medium">{selectedTx.party || selectedTx.category}</p>
              </div>

              <div className="bg-neutral-50 rounded-[20px] p-5 border border-[#EBEBEB]">
                <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
                  <div>
                    <p className="text-[#717171] text-xs font-bold uppercase tracking-wider mb-1.5">Date & Time</p>
                    <p className="font-bold text-[#222222]">{format(selectedTx.dateTime, 'MMM d, yyyy')}</p>
                    <p className="text-[#717171] font-medium text-xs mt-0.5">{format(selectedTx.dateTime, 'h:mm a')}</p>
                  </div>
                  
                  <div>
                    <p className="text-[#717171] text-xs font-bold uppercase tracking-wider mb-1.5">Category</p>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-neutral-200 text-[#222222]">
                      {selectedTx.category}
                    </span>
                  </div>
                  
                  {selectedTx.expenseType && (
                    <div>
                      <p className="text-[#717171] text-xs font-bold uppercase tracking-wider mb-1.5">Type</p>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-neutral-200 text-[#222222]">
                        {selectedTx.expenseType}
                      </span>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-[#717171] text-xs font-bold uppercase tracking-wider mb-1.5">Payment Method</p>
                    <p className="font-bold text-[#222222]">
                      {selectedTx.paymentMethod === 'UPI' ? `UPI${selectedTx.upiApp ? ` (${selectedTx.upiApp})` : ''}` : selectedTx.paymentMethod === 'Bank' ? 'Bank Transfer' : 'Cash'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-[#717171] text-xs font-bold uppercase tracking-wider mb-1.5">Account</p>
                    <p className="font-bold text-[#222222]">
                      {accounts.find(a => a.id === selectedTx.accountId)?.bankName || 'Unknown'} 
                      {accounts.find(a => a.id === selectedTx.accountId)?.accountLast4 ? ` ••••${accounts.find(a => a.id === selectedTx.accountId)?.accountLast4}` : ''}
                    </p>
                  </div>
                  
                  <div className="col-span-2 pt-4 border-t border-[#EBEBEB]">
                    <p className="text-[#717171] text-xs font-bold uppercase tracking-wider mb-1.5">Note / Reason</p>
                    <p className="font-bold text-[#222222] whitespace-pre-wrap">{selectedTx.note || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-5 border-t border-[#EBEBEB] bg-white flex justify-end gap-3">
              <button 
                onClick={() => handleDelete(selectedTx.id!)}
                className="px-5 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition-colors mr-auto flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button 
                onClick={() => setSelectedTx(null)}
                className="px-5 py-2.5 bg-neutral-100 text-[#222222] hover:bg-neutral-200 rounded-xl font-bold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
