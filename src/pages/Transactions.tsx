import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { format, startOfMonth, endOfMonth, isWithinInterval, isToday, isYesterday, parseISO, startOfDay, endOfDay } from 'date-fns';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X, Trash2, ArrowDownLeft, ArrowUpRight, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

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
  'Transfer': 'bg-indigo-100 text-indigo-600',
  'Other': 'bg-gray-100 text-gray-600'
};

export default function Transactions() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  const allTransactions = useLiveQuery(() => db.transactions.orderBy('dateTime').reverse().toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  
  const filterStart = dateRange ? dateRange.start : startOfMonth(currentMonth);
  const filterEnd = dateRange ? dateRange.end : endOfMonth(currentMonth);

  const filteredTransactions = allTransactions.filter(tx => 
    isWithinInterval(tx.dateTime, { start: filterStart, end: filterEnd })
  );

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

  const openDatePicker = () => {
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
      <header className="sticky top-0 bg-gray-50 z-10 pb-4 pt-2 -mx-4 px-4 md:-mx-8 md:px-8">
        <div className="flex items-center justify-between mb-4">
          <button onClick={handlePrevMonth} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={openDatePicker}
            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <h2 className="text-lg font-semibold text-gray-900">{getHeaderText()}</h2>
            <CalendarIcon className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={handleNextMonth} className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-200 p-2 rounded-2xl shadow-inner">
            <div className="bg-white p-3 rounded-xl h-full flex flex-col justify-center shadow-sm">
              <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Inflow</p>
              <p className="text-sm sm:text-base font-bold text-emerald-600 leading-none">+</p>
              <p className="text-base sm:text-xl font-black text-emerald-600 leading-none mt-1">₹{totalIncome.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="bg-gray-200 p-2 rounded-2xl shadow-inner">
            <div className="bg-white p-3 rounded-xl h-full flex flex-col justify-center shadow-sm">
              <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Outflow</p>
              <p className="text-sm sm:text-base font-bold text-rose-600 leading-none">-</p>
              <p className="text-base sm:text-xl font-black text-rose-600 leading-none mt-1">₹{totalExpense.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <div className="bg-gray-200 p-2 rounded-2xl shadow-inner">
            <div className="bg-white p-3 rounded-xl h-full flex flex-col justify-center shadow-sm">
              <p className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Balance</p>
              <p className="text-sm sm:text-base font-bold transparent leading-none">&nbsp;</p>
              <p className={`text-base sm:text-xl font-black leading-none mt-1 ${balance >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                {balance >= 0 ? '+' : '-'}₹{Math.abs(balance).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <Link 
            to={`/transactions/table?start=${filterStart.toISOString()}&end=${filterEnd.toISOString()}`}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-medium transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            Transaction Report
          </Link>
        </div>
      </header>

      {/* Transaction List */}
      <main className="space-y-6 mt-2">
        {Object.keys(groupedTransactions).length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No transactions found for this period.
          </div>
        ) : (
          Object.entries(groupedTransactions).map(([date, txs]) => (
            <div key={date} className="mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                {formatDateHeader(date)}
              </h3>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {txs.map(tx => (
                    <div 
                      key={tx.id} 
                      onClick={() => setSelectedTx(tx)}
                      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                    >
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 ${CATEGORY_COLORS[tx.category] || CATEGORY_COLORS['Other']} group-hover:scale-105 transition-transform`}>
                        {CATEGORY_ICONS[tx.category] || '📝'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                          {tx.party || tx.category}
                        </h4>
                        {tx.note && (
                          <p className="text-sm text-gray-600 truncate mt-0.5">
                            {tx.note}
                          </p>
                        )}
                        <p className="text-xs font-medium text-gray-400 truncate mt-1 flex items-center gap-1">
                          {tx.paymentMethod === 'UPI' ? `UPI${tx.upiApp ? ` • ${tx.upiApp}` : ''}` : tx.paymentMethod === 'Bank' ? 'Bank' : 'Cash'} 
                          <span className="w-1 h-1 rounded-full bg-gray-300 mx-1"></span> 
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
          ))
        )}
      </main>

      {/* FAB */}
      <Link 
        to="/"
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-transform active:scale-95 z-20"
      >
        <Plus className="w-6 h-6" />
      </Link>

      {/* Date Picker Modal */}
      {isDatePickerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Select Date Range</h3>
              <button onClick={() => setIsDatePickerOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input 
                  type="date" 
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date (Optional)</label>
                <input 
                  type="date" 
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  min={tempStartDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for a single day</p>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-3 justify-end">
              {dateRange && (
                <button 
                  onClick={clearDateFilter}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors sm:mr-auto"
                >
                  Clear Filter
                </button>
              )}
              <button 
                onClick={() => setIsDatePickerOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={applyDateFilter}
                disabled={!tempStartDate}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Transaction Details</h3>
              <button onClick={() => setSelectedTx(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl mb-3 ${CATEGORY_COLORS[selectedTx.category] || CATEGORY_COLORS['Other']}`}>
                  {CATEGORY_ICONS[selectedTx.category] || '📝'}
                </div>
                <h2 className={`text-3xl font-bold ${selectedTx.type === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {selectedTx.type === 'CREDIT' ? '+' : '-'} ₹{selectedTx.amount.toLocaleString('en-IN')}
                </h2>
                <p className="text-gray-500 mt-1 font-medium">{selectedTx.party || selectedTx.category}</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="grid grid-cols-2 gap-y-4 gap-x-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Date & Time</p>
                    <p className="font-medium text-gray-900">{format(selectedTx.dateTime, 'MMM d, yyyy')}</p>
                    <p className="text-gray-600 text-xs">{format(selectedTx.dateTime, 'h:mm a')}</p>
                  </div>
                  
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Category</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-800">
                      {selectedTx.category}
                    </span>
                  </div>
                  
                  {selectedTx.expenseType && (
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Type</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        {selectedTx.expenseType}
                      </span>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Payment Method</p>
                    <p className="font-medium text-gray-900">
                      {selectedTx.paymentMethod === 'UPI' ? `UPI${selectedTx.upiApp ? ` (${selectedTx.upiApp})` : ''}` : selectedTx.paymentMethod === 'Bank' ? 'Bank Transfer' : 'Cash'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Account</p>
                    <p className="font-medium text-gray-900">
                      {accounts.find(a => a.id === selectedTx.accountId)?.bankName || 'Unknown'} 
                      {accounts.find(a => a.id === selectedTx.accountId)?.accountLast4 ? ` ••••${accounts.find(a => a.id === selectedTx.accountId)?.accountLast4}` : ''}
                    </p>
                  </div>
                  
                  <div className="col-span-2 pt-2 border-t border-gray-200">
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Note / Reason</p>
                    <p className="font-medium text-gray-900 whitespace-pre-wrap">{selectedTx.note || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => handleDelete(selectedTx.id!)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors mr-auto flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button 
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 rounded-lg font-medium transition-colors"
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
