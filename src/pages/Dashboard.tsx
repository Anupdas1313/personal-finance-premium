import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, X, AlertCircle, CheckCircle2, Search, ChevronDown, Landmark, Smartphone } from 'lucide-react';
import { format, startOfMonth, startOfYear, isToday, isYesterday } from 'date-fns';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { useCategories } from '../hooks/useCategories';

const CATEGORIES = ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Entertainment', 'Salary', 'Transfer', 'Other'];

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
  'Food': 'bg-orange-900/40 text-orange-500',
  'Transport': 'bg-blue-900/40 text-blue-500',
  'Rent': 'bg-purple-900/40 text-purple-500',
  'Shopping': 'bg-pink-900/40 text-pink-500',
  'Bills': 'bg-yellow-900/40 text-yellow-500',
  'Entertainment': 'bg-red-900/40 text-red-500',
  'Salary': 'bg-emerald-900/40 text-emerald-500',
  'Transfer': 'bg-[#1C1C24] text-[#A0A0A0]',
  'Other': 'bg-[#1C1C24] text-[#A0A0A0]'
};

import { IndusIndLogo } from '../components/IndusIndLogo';
import { UnionBankLogo } from '../components/UnionBankLogo';

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.orderBy('dateTime').reverse().limit(5).toArray()) || [];

  const [isAddingManual, setIsAddingManual] = useState(searchParams.get('add') === 'true');

  // Sync state with URL
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setIsAddingManual(true);
    }
  }, [searchParams]);

  const closeMenu = () => {
    setIsAddingManual(false);
    if (searchParams.get('add')) {
      navigate('/', { replace: true });
    }
  };

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'CREDIT' | 'DEBIT' | ''>('');
  const [category, setCategory] = useState('Other');
  const [note, setNote] = useState('');
  const [partyName, setPartyName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [paymentMethod, setPaymentMethod] = useState<'Bank' | 'UPI'>('Bank');
  const [upiApp, setUpiApp] = useState<string>('');
  const [expenseType, setExpenseType] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [timeFilter, setTimeFilter] = useState<'All Time' | 'This Month' | 'This Year'>('All Time');
  
  const { categories: appCategories } = useCategories();

  const handleSaveManual = async () => {
    if (!amount || !type || !selectedAccountId || !expenseType) {
      setStatus('error');
      setErrorMessage('Missing required fields (Amount, Type, Account, or Expense Type).');
      return;
    }

    try {
      await db.transactions.add({
        accountId: Number(selectedAccountId),
        amount: parseFloat(amount),
        type: type as 'CREDIT' | 'DEBIT',
        dateTime: new Date(transactionDate),
        note: note || '',
        category,
        paymentMethod,
        upiApp: paymentMethod === 'UPI' ? upiApp : undefined,
        party: partyName,
        expenseType,
      });
      
      setStatus('success');
      setTimeout(() => {
        closeMenu();
        setStatus('idle');
        setAmount('');
        setType('');
        setNote('');
        setPartyName('');
        setCategory('Other');
        setTransactionDate(new Date().toISOString().slice(0, 16));
        setPaymentMethod('Bank');
        setUpiApp('');
        setExpenseType('');
      }, 1500);
    } catch (error) {
      setStatus('error');
      setErrorMessage('Failed to save transaction.');
      console.error(error);
    }
  };

  const monthlyClosings = useLiveQuery(() => db.monthlyClosings.orderBy('month').reverse().toArray()) || [];
  const latestClosedMonth = monthlyClosings[0];

  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];
  
  const balances = accounts.map(acc => {
    // If we have a closed month, use its balance as the starting point
    let startingBalance = acc.startingBalance;
    let txsToConsider = allTransactions.filter(t => t.accountId === acc.id);

    if (latestClosedMonth) {
      if (latestClosedMonth.accountBalances[acc.id!] !== undefined) {
        startingBalance = latestClosedMonth.accountBalances[acc.id!];
        
        // Only consider transactions AFTER the closed month
        const closedMonthDate = new Date(latestClosedMonth.month + '-01');
        const nextMonthStart = new Date(closedMonthDate.getFullYear(), closedMonthDate.getMonth() + 1, 1);
        
        txsToConsider = txsToConsider.filter(t => t.dateTime >= nextMonthStart);
      }
    }

    const currentBalance = txsToConsider.reduce((accBal, tx) => {
      if (tx.type === 'CREDIT') return accBal + tx.amount;
      if (tx.type === 'DEBIT') return accBal - tx.amount;
      return accBal;
    }, startingBalance);
    
    return { ...acc, currentBalance };
  });

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    if (timeFilter === 'This Month') {
      const monthStart = startOfMonth(now);
      return allTransactions.filter(tx => tx.dateTime >= monthStart);
    }
    if (timeFilter === 'This Year') {
      const yearStart = startOfYear(now);
      return allTransactions.filter(tx => tx.dateTime >= yearStart);
    }
    return allTransactions;
  }, [allTransactions, timeFilter]);

  const { totalIncome, totalSpending } = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => {
        if (tx.type === 'CREDIT') acc.totalIncome += tx.amount;
        if (tx.type === 'DEBIT') acc.totalSpending += tx.amount;
        return acc;
      },
      { totalIncome: 0, totalSpending: 0 }
    );
  }, [filteredTransactions]);

  const netBalance = totalIncome - totalSpending;

  const totalBalance = balances.reduce((sum, acc) => sum + acc.currentBalance, 0);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  return (
    <div className="space-y-6">
      {/* Greeting Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#717171] dark:text-[#A0A0A0] tracking-wide">{greeting},</p>
          <h1 className="text-2xl font-extrabold text-[#222222] dark:text-[#F7F7F7] leading-tight">Anup 👋</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingManual(true)}
            title="Add Transaction"
            className="hidden sm:flex h-10 px-5 items-center gap-2 justify-center rounded-[14px] bg-[#3B3B98] hover:bg-[#2C2C7A] text-white transition-colors shadow-md font-bold text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Transaction
          </button>
          <button
            onClick={() => setIsAddingManual(true)}
            title="Add Transaction"
            className="sm:hidden w-10 h-10 flex items-center justify-center rounded-[14px] bg-[#3B3B98] text-white shadow-md active:scale-95 transition-transform"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div
            title="Anup"
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3B3B98] to-[#6C6CF0] flex items-center justify-center text-white font-bold text-sm select-none shadow-md cursor-pointer"
          >
            A
          </div>
        </div>
      </div>

      {/* Cash Flow Hero Card */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#1C1C24] via-[#1E1A22] to-[#1C1F26] p-6 shadow-xl border border-white/5">
        {/* Subtle glowing orb effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10 flex items-center justify-between mb-8">
          <h2 className="text-xs font-bold text-white/60 tracking-widest uppercase">Cash Flow</h2>
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="appearance-none bg-white/10 hover:bg-white/15 text-white/90 text-sm font-semibold px-4 py-1.5 rounded-full pr-8 cursor-pointer outline-none transition-colors border border-white/10 backdrop-blur-md"
            >
              <option className="text-black bg-white" value="This Month">This Month</option>
              <option className="text-black bg-white" value="This Year">This Year</option>
              <option className="text-black bg-white" value="All Time">All Time</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70 pointer-events-none" />
          </div>
        </div>

        <div className="relative z-10 flex justify-between items-end mb-8">
          <div>
            <p className="text-xs font-bold text-rose-400/90 tracking-wider uppercase mb-1">Spending</p>
            <p className="text-3xl font-bold text-white tracking-tight">
              ₹{totalSpending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-emerald-400/90 tracking-wider uppercase mb-1">Income</p>
            <p className="text-3xl font-bold text-white tracking-tight">
              ₹{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="relative z-10 bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center backdrop-blur-sm">
          <p className="text-sm font-semibold text-white/50 border-b border-dashed border-white/20 pb-0.5">Net Balance</p>
          <p className={`text-lg font-bold ${netBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
            {netBalance < 0 ? '-' : ''}₹{Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accounts List */}
        <div className="bg-white dark:bg-[#0C0C0F] rounded-[24px] shadow-[0_6px_16px_rgba(0,0,0,0.04)] border border-[#EBEBEB] dark:border-[#1A1A1E] overflow-hidden">
          <div className="p-6 border-b border-[#EBEBEB] dark:border-[#1A1A1E] flex justify-between items-center">
            <h2 className="text-lg font-bold text-[#222222] dark:text-[#F7F7F7]">Your Accounts</h2>
            <Link to="/accounts" className="text-sm font-semibold text-[#717171] dark:text-[#A0A0A0] hover:text-[#222222] dark:hover:text-[#F7F7F7] transition-colors">Manage</Link>
          </div>
          <div className="divide-y divide-[#EBEBEB] dark:divide-[#1A1A1E]">
            {balances.length === 0 ? (
              <div className="p-6 text-center text-[#717171] dark:text-[#A0A0A0] text-sm">No accounts added yet.</div>
            ) : (
              balances.map(acc => (
                <div key={acc.id} className="p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-[#15151A] transition-colors group cursor-pointer" onClick={() => navigate('/accounts')}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-neutral-100 dark:bg-[#15151A] rounded-full flex items-center justify-center text-[#717171] dark:text-[#A0A0A0] font-bold overflow-hidden p-1 border border-transparent dark:border-[#1A1A1E]">
                      {acc.bankName.toLowerCase().includes('canara') ? (
                        <img src="https://crystalpng.com/wp-content/uploads/2025/11/Canara-Bank-Logo.png" alt="Canara Bank" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : acc.bankName.toLowerCase().includes('indus') || acc.bankName.toLowerCase().includes('insus') ? (
                        <IndusIndLogo className="w-full h-full object-contain" />
                      ) : acc.bankName.toLowerCase().includes('union') ? (
                        <UnionBankLogo className="w-full h-full object-contain" />
                      ) : (
                        acc.bankName.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-[#222222] dark:text-[#F7F7F7]">{acc.bankName}</p>
                      <p className="text-xs text-[#717171] dark:text-[#A0A0A0] font-medium mt-0.5">**** {acc.accountLast4}</p>
                    </div>
                  </div>
                  <p className="font-bold text-[#222222] dark:text-[#F7F7F7]">
                    ₹{acc.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-transparent overflow-hidden">
          <div className="pb-4 flex justify-between items-center px-1">
            <h2 className="text-lg font-bold text-[#222222] dark:text-[#F7F7F7]">Recent Transactions</h2>
            <Link to="/transactions" className="text-sm font-semibold text-[#717171] dark:text-[#A0A0A0] hover:text-[#222222] dark:hover:text-[#F7F7F7] transition-colors">View All</Link>
          </div>
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-[#717171] dark:text-[#A0A0A0] text-sm bg-white dark:bg-[#0C0C0F] rounded-[24px] border border-[#EBEBEB] dark:border-[#1A1A1E]">No transactions yet.</div>
            ) : (
              transactions.map(tx => {
                const account = accounts.find(a => a.id === tx.accountId);
                
                // Format relative date
                let dateStr = '';
                if (isToday(tx.dateTime)) dateStr = 'Today';
                else if (isYesterday(tx.dateTime)) dateStr = 'Yesterday';
                else dateStr = format(tx.dateTime, 'MMM dd');

                // Helper to get squircle icon styling based on dark mode category
                const catColorClasses = CATEGORY_COLORS[tx.category] || CATEGORY_COLORS['Other'];

                return (
                  <div key={tx.id} className="p-4 bg-white dark:bg-[#0C0C0F] border border-[#EBEBEB] dark:border-[#1A1A1E] rounded-[24px] flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-[#15151A] transition-colors shadow-sm group cursor-pointer" onClick={() => navigate('/transactions')}>
                    <div className="flex items-center gap-4">
                      {/* Squircle Icon */}
                      <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center text-xl shrink-0 ${
                        document.documentElement.classList.contains('dark') ? catColorClasses : 'bg-neutral-100 text-neutral-800'
                      }`}>
                        {CATEGORY_ICONS[tx.category] || '📝'}
                      </div>
                      
                      {/* Title & Subtext */}
                      <div>
                        <p className="font-bold text-[#222222] dark:text-[#F7F7F7] text-base group-hover:text-black dark:group-hover:text-white transition-colors">
                          {tx.party || tx.note || tx.category}
                        </p>
                        <div className="flex items-center text-xs text-[#717171] dark:text-[#A0A0A0] font-medium mt-0.5 gap-1.5">
                          {tx.paymentMethod === 'UPI' ? <Smartphone className="w-3.5 h-3.5" /> : tx.paymentMethod === 'Bank' ? <Landmark className="w-3.5 h-3.5" /> : <Wallet className="w-3.5 h-3.5" />}
                          <span>{tx.paymentMethod === 'UPI' ? `UPI${tx.upiApp ? ` (${tx.upiApp})` : ''}` : tx.paymentMethod === 'Bank' ? 'Bank' : 'Cash'}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Amount & Date (Right Aligned) */}
                    <div className="text-right">
                      <p className={`font-bold text-base tracking-tight ${tx.type === 'CREDIT' ? 'text-emerald-500' : 'text-[#222222] dark:text-[#F7F7F7]'}`}>
                        {tx.type === 'CREDIT' ? '+' : ''}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-[#717171] dark:text-[#A0A0A0] font-medium mt-0.5">
                        {dateStr}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Manual Entry Modal - Full Screen Mobile Redesign */}
      {isAddingManual && (
        <div className="fixed inset-0 bg-white dark:bg-[#0C0C0F] md:bg-black/50 md:backdrop-blur-sm z-[100] flex flex-col md:items-center md:justify-center md:p-4 animate-in slide-in-from-bottom-5 md:fade-in md:slide-in-from-bottom-0 duration-300">
          <div className="bg-white dark:bg-[#0C0C0F] w-full h-full md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-[24px] shadow-2xl flex flex-col pt-safe-top">
            <div className="p-4 md:p-6 border-b border-[#EBEBEB] dark:border-[#1A1A1E] flex justify-between items-center bg-white dark:bg-[#0C0C0F] z-10 md:rounded-t-[24px] shrink-0">
              <h2 className="text-xl font-extrabold text-[#222222] dark:text-[#F7F7F7]">Add Transaction</h2>
              <button
                onClick={closeMenu}
                className="text-[#717171] dark:text-[#A0A0A0] hover:text-[#222222] dark:hover:text-[#F7F7F7] transition-colors p-2 hover:bg-neutral-200 dark:hover:bg-[#1A1A1E] rounded-full bg-neutral-100 dark:bg-[#15151A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 p-4 md:p-6 space-y-5 overflow-y-auto w-full flex flex-col">
              {/* Transaction Type Segmented Control */}
              <div className="flex p-1 bg-neutral-100 dark:bg-[#15151A] rounded-[14px]">
                <button 
                  type="button"
                  onClick={() => setType('DEBIT')} 
                  className={`flex-1 py-2 text-xs font-bold rounded-[10px] transition-all ${type === 'DEBIT' ? 'bg-white dark:bg-[#2A2A35] shadow-sm text-rose-500' : 'text-[#717171] dark:text-[#A0A0A0]'}`}
                >
                  Paid To (Debit)
                </button>
                <button 
                  type="button"
                  onClick={() => setType('CREDIT')} 
                  className={`flex-1 py-2 text-xs font-bold rounded-[10px] transition-all ${type === 'CREDIT' ? 'bg-white dark:bg-[#2A2A35] shadow-sm text-emerald-500' : 'text-[#717171] dark:text-[#A0A0A0]'}`}
                >
                  Received (Credit)
                </button>
              </div>

              {/* Amount Row (Compacted) */}
              <div className="flex items-center justify-between bg-neutral-50 dark:bg-[#15151A] p-3 px-4 rounded-[16px]">
                <span className="text-xs font-bold text-[#717171] dark:text-[#A0A0A0] uppercase tracking-wider">Amount</span>
                <div className="relative w-1/2 flex items-center justify-end">
                  <span className="text-xl font-bold text-[#717171] dark:text-[#A0A0A0] mr-2">₹</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full bg-transparent text-right text-3xl font-black text-[#222222] dark:text-[#F7F7F7] outline-none placeholder:text-neutral-300 dark:placeholder:text-[#444]"
                    required
                  />
                </div>
              </div>

              {/* App Category Pills (Horizontal Scroll) */}
              <div className="col-span-2">
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-2 px-2">
                  {appCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setExpenseType(expenseType === cat ? '' : cat)}
                      className={`px-3 py-1.5 rounded-[10px] text-xs font-bold flex-shrink-0 transition-transform ${
                        expenseType === cat 
                          ? 'bg-[#3B3B98] text-white shadow-sm scale-105' 
                          : 'bg-neutral-100 dark:bg-[#15151A] text-[#717171] dark:text-[#A0A0A0]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compact Field Grid (2 columns) */}
              <div className="grid grid-cols-2 gap-3">
                {/* Party Name / Reason */}
                {type && (
                  <div className="col-span-2 flex gap-3">
                    <input
                      type="text"
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                      placeholder={type === 'DEBIT' ? "Paid To *" : "Received From *"}
                      className="flex-1 px-4 py-3 bg-neutral-50 dark:bg-[#15151A] rounded-[14px] outline-none text-sm font-bold text-[#222222] dark:text-[#F7F7F7] placeholder:font-semibold placeholder:text-[#A0A0A0]"
                      required
                    />
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Note"
                      className="w-1/3 px-4 py-3 bg-neutral-50 dark:bg-[#15151A] rounded-[14px] outline-none text-sm font-bold text-[#222222] dark:text-[#F7F7F7] placeholder:font-semibold placeholder:text-[#A0A0A0]"
                    />
                  </div>
                )}
                
                {/* Account */}
                <div>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(Number(e.target.value) || '')}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#15151A] rounded-[14px] outline-none text-sm font-bold text-[#222222] dark:text-[#F7F7F7] appearance-none"
                    required
                  >
                    <option value="" disabled>Acct *</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bankName} (..{acc.accountLast4})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <input
                    type="datetime-local"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#15151A] rounded-[14px] outline-none text-sm font-bold text-[#222222] dark:text-[#F7F7F7]"
                    required
                  />
                </div>

                {/* Category */}
                <div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#15151A] rounded-[14px] outline-none text-sm font-bold text-[#222222] dark:text-[#F7F7F7] appearance-none"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Method */}
                <div>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'Bank' | 'UPI')}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#15151A] rounded-[14px] outline-none text-sm font-bold text-[#222222] dark:text-[#F7F7F7] appearance-none"
                  >
                    <option value="Bank">Bank</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>

                {paymentMethod === 'UPI' && (
                  <div className="col-span-2">
                    <select
                      value={upiApp}
                      onChange={(e) => setUpiApp(e.target.value)}
                      className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#15151A] rounded-[14px] outline-none text-sm font-bold text-[#222222] dark:text-[#F7F7F7] appearance-none"
                      required
                    >
                      <option value="" disabled>Select UPI App *</option>
                      <option value="GPay">GPay</option>
                      <option value="PhonePe">PhonePe</option>
                      <option value="Paytm">Paytm</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Status Messages */}
              {status === 'error' && (
                <div className="p-3 bg-rose-500/10 text-rose-500 rounded-[12px] flex items-center gap-2 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {errorMessage}
                </div>
              )}
              {status === 'success' && (
                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-[12px] flex items-center gap-2 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Saved!
                </div>
              )}

              {/* Save Button */}
              <div className="pt-2 pb-safe mt-auto">
                <button
                  onClick={handleSaveManual}
                  disabled={!amount || !type || !partyName || !selectedAccountId || (paymentMethod === 'UPI' && !upiApp) || status === 'success'}
                  className="w-full py-4 bg-gradient-to-r from-[#3B3B98] to-[#6C6CF0] text-white font-black text-lg rounded-[16px] shadow-md hover:shadow-lg transform transition-all disabled:opacity-50"
                >
                  Save Transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
