import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, X, AlertCircle, CheckCircle2, Search, ChevronDown, Landmark, Smartphone, ArrowLeft, Calendar, Clock, Calculator, MoreHorizontal, User, AlignLeft, Hash, Paperclip, Save, ChevronRight, CreditCard, Coins } from 'lucide-react';
import { format, startOfMonth, startOfYear, isToday, isYesterday } from 'date-fns';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { BankLogo } from '../components/BankLogo';

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
  const [type, setType] = useState<'CREDIT' | 'DEBIT' | 'TRANSFER' | ''>('');
  const [category, setCategory] = useState('Other');
  const [note, setNote] = useState('');
  const [partyName, setPartyName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const [toAccountId, setToAccountId] = useState<number | ''>('');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [paymentMethod, setPaymentMethod] = useState<'Bank' | 'UPI' | 'Credit Card' | 'Cash' | 'Bank Transfer'>('Bank');
  const [upiApp, setUpiApp] = useState<string>('');
  const [expenseType, setExpenseType] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [timeFilter, setTimeFilter] = useState<'All Time' | 'This Month' | 'This Year'>('All Time');
  
  const { categories: appCategories } = useCategories();

  const handleSaveManual = async () => {
    if (!amount || !type || !selectedAccountId || (type !== 'TRANSFER' && !expenseType)) {
      setStatus('error');
      setErrorMessage('Missing required fields.');
      return;
    }

    try {
      if (type === 'TRANSFER') {
        if (!toAccountId) {
          setStatus('error');
          setErrorMessage('Please select a destination account for the transfer.');
          return;
        }
        if (selectedAccountId === toAccountId) {
          setStatus('error');
          setErrorMessage('Source and destination accounts cannot be the same.');
          return;
        }

        // Add DEBIT transaction for source account
        await db.transactions.add({
          accountId: Number(selectedAccountId),
          amount: parseFloat(amount),
          type: 'DEBIT',
          dateTime: new Date(transactionDate),
          note: note || `Transfer to ${accounts.find(a => a.id === toAccountId)?.bankName}`,
          category: 'Transfer',
          paymentMethod,
          upiApp: paymentMethod === 'UPI' ? upiApp : undefined,
          party: accounts.find(a => a.id === toAccountId)?.bankName || 'Other Account',
          expenseType,
        });

        // Add CREDIT transaction for destination account
        await db.transactions.add({
          accountId: Number(toAccountId),
          amount: parseFloat(amount),
          type: 'CREDIT',
          dateTime: new Date(transactionDate),
          note: note || `Transfer from ${accounts.find(a => a.id === selectedAccountId)?.bankName}`,
          category: 'Transfer',
          paymentMethod,
          upiApp: paymentMethod === 'UPI' ? upiApp : undefined,
          party: accounts.find(a => a.id === selectedAccountId)?.bankName || 'Other Account',
          expenseType,
        });
      } else {
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
      }
      
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
        setToAccountId('');
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
                          {tx.paymentMethod === 'UPI' ? <Smartphone className="w-3.5 h-3.5" /> : 
                           tx.paymentMethod === 'Bank' || tx.paymentMethod === 'Bank Transfer' ? <Landmark className="w-3.5 h-3.5" /> : 
                           tx.paymentMethod === 'Credit Card' ? <CreditCard className="w-3.5 h-3.5" /> :
                           <Coins className="w-3.5 h-3.5" />}
                          <span>{tx.paymentMethod === 'UPI' ? `UPI${tx.upiApp ? ` (${tx.upiApp})` : ''}` : tx.paymentMethod}</span>
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

      {/* Manual Entry Modal - Compact Pill-Based UX Redesign */}
      {isAddingManual && createPortal(
        <div className="fixed inset-0 bg-[#0F0F13] text-white z-[9999] flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300 font-sans">
          <div className="flex items-center justify-between px-4 py-2 pt-safe-top bg-[#1C1C22] border-b border-white/5 z-20">
            <button onClick={closeMenu} className="text-[#A0A0A5] hover:text-white p-1.5 -ml-1 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-[15px] font-bold text-white tracking-tight">Add Transaction</h2>
            <div className="w-8" /> {/* Spacer to balance back arrow */}
          </div>

          <div className="flex-1 overflow-y-auto w-full px-4 pt-3 pb-safe space-y-5 scrollbar-hide no-scrollbar">
            
            {/* 1. Transaction Type Toggle (Top Priority) */}
            <div className="flex bg-[#1C1C22] p-1 rounded-2xl border border-white/5">
              <button 
                onClick={() => setType('DEBIT')}
                className={`flex-1 py-1.5 text-[12px] font-bold rounded-xl transition-all ${type === 'DEBIT' ? 'bg-[#3B3B98] text-white shadow-lg' : 'text-[#717171] hover:text-white'}`}
              >
                Expense
              </button>
              <button 
                onClick={() => setType('CREDIT')}
                className={`flex-1 py-1.5 text-[12px] font-bold rounded-xl transition-all ${type === 'CREDIT' ? 'bg-emerald-600 text-white shadow-lg' : 'text-[#717171] hover:text-white'}`}
              >
                Income
              </button>
              <button 
                onClick={() => setType('TRANSFER')}
                className={`flex-1 py-1.5 text-[12px] font-bold rounded-xl transition-all ${type === 'TRANSFER' ? 'bg-indigo-600 text-white shadow-lg' : 'text-[#717171] hover:text-white'}`}
              >
                Transfer
              </button>
            </div>

            {/* 2. Important Filter Tags (#personal, #home) - Ultra Compact Scrollable */}
            {type !== 'TRANSFER' && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider px-1">Tags</p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                  {['Personal', 'Home'].map(tagName => (
                    <button 
                      key={tagName} 
                      onClick={() => setExpenseType(expenseType === tagName ? '' : tagName)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border whitespace-nowrap ${
                        expenseType === tagName 
                          ? 'bg-[#6C6CF0] text-white border-transparent' 
                          : 'bg-[#1C1C22] border-white/5 text-[#A0A0A5]'
                      }`}
                    >
                      #{tagName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Amount & Account Row */}
            <div className={`bg-[#1C1C22] rounded-xl border border-white/5 flex ${type === 'TRANSFER' ? 'flex-col divide-y' : 'divide-x'} divide-white/5 overflow-hidden shadow-inner`}>
              
              {/* Amount Input (Left) */}
              <div className={`flex items-center gap-1.5 p-3 ${type === 'TRANSFER' ? 'w-full' : 'w-[45%]'} focus-within:bg-white/[0.02] transition-colors shrink-0`}>
                <span className="text-lg font-bold text-[#A0A0A5]">₹</span>
                <input 
                  type="number"
                  inputMode="decimal"
                  autoFocus
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="bg-transparent text-[22px] font-bold text-white outline-none w-full placeholder:text-[#2C2C34] min-w-0"
                />
              </div>

              {/* Account Selection (Right) */}
              <div className={`p-1.5 flex-1 flex items-center overflow-x-auto no-scrollbar bg-black/10`}>
                <div className="flex gap-1.5 items-center">
                  {accounts.map(acc => (
                    <button 
                      key={acc.id} 
                      onClick={() => {
                        if (type === 'TRANSFER') {
                          if (!selectedAccountId) setSelectedAccountId(acc.id!);
                          else if (selectedAccountId === acc.id) setSelectedAccountId('');
                          else setToAccountId(acc.id!);
                        } else {
                          setSelectedAccountId(acc.id!);
                        }
                      }}
                      className={`shrink-0 flex flex-col items-center justify-center gap-1 p-1.5 rounded-xl border transition-all group relative ${
                        selectedAccountId === acc.id || toAccountId === acc.id
                          ? 'bg-[#3B3B98]/20 border-[#3B3B98] text-white shadow-sm' 
                          : 'bg-[#1C1C22] border-white/5 text-[#A0A0A5] hover:bg-[#2C2C34]'
                      }`}
                      style={{ minWidth: '56px' }}
                    >
                      {selectedAccountId === acc.id && type === 'TRANSFER' && (
                        <div className="absolute -top-1.5 bg-[#3B3B98] text-[6px] font-bold px-1 py-0.5 rounded shadow-lg border border-white/10">FROM</div>
                      )}
                      {toAccountId === acc.id && type === 'TRANSFER' && (
                        <div className="absolute -top-1.5 bg-indigo-500 text-[6px] font-bold px-1 py-0.5 rounded shadow-lg border border-white/10">TO</div>
                      )}
                      
                      <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center p-1 shadow-sm">
                        <BankLogo bankName={acc.bankName} className="w-full h-full" />
                      </div>
                      <span className="text-[8px] font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full text-center tracking-wide">
                        {acc.bankName.substring(0, 10)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Identity, Remarks & Payment Group */}
            <div className="bg-[#1C1C22] rounded-xl border border-white/5 divide-y divide-white/5">
              {/* Paid via / Received from (Hide for Transfer) */}
              {type !== 'TRANSFER' && (
                <div className="flex items-center gap-2.5 p-2">
                  <div className="w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center shrink-0 border border-white/5">
                    <User className="w-3.5 h-3.5 text-[#A0A0A5]" />
                  </div>
                  <input 
                    type="text"
                    value={partyName}
                    onChange={e => setPartyName(e.target.value)}
                    placeholder={type === 'DEBIT' ? 'Paid to...' : 'Received from...'}
                    className="bg-transparent flex-1 text-[14px] font-medium text-white outline-none placeholder:text-[#4A4A52]"
                  />
                </div>
              )}

              {/* Remarks */}
              <div className="flex items-center gap-2.5 p-2">
                <div className="w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center shrink-0 border border-white/5">
                  <AlignLeft className="w-3.5 h-3.5 text-[#A0A0A5]" />
                </div>
                <input 
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add remarks..."
                  className="bg-transparent flex-1 text-[13px] text-white/90 outline-none placeholder:text-[#4A4A52]"
                />
              </div>

              {/* Payment Mode Selector (Compact Grid) */}
              <div className="p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold text-[#A0A0A5] uppercase tracking-wider">Payment Method</p>
                  {paymentMethod && <span className="text-[9px] font-bold text-[#6C6CF0]">{paymentMethod}</span>}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'UPI', label: 'UPI', icon: <Smartphone className="w-3 h-3" /> },
                    { id: 'Bank Transfer', label: 'Bank', icon: <Landmark className="w-3 h-3" /> },
                    { id: 'Credit Card', label: 'Card', icon: <CreditCard className="w-3 h-3" /> },
                    { id: 'Cash', label: 'Cash', icon: <Coins className="w-3 h-3" /> },
                  ].map((method) => (
                    <button 
                      key={method.id} 
                      onClick={() => setPaymentMethod(method.id as any)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold transition-all flex flex-col items-center gap-1 border ${
                        paymentMethod === method.id 
                          ? 'bg-[#3B3B98] border-[#3B3B98] text-white shadow-lg scale-95' 
                          : 'bg-black/20 border-white/5 text-[#A0A0A5] active:scale-95'
                      }`}
                    >
                      {method.icon}
                      {method.label}
                    </button>
                  ))}
                </div>

                {paymentMethod === 'UPI' && (
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
                    {['GPay', 'PhonePe', 'Paytm'].map(app => (
                      <button 
                        key={app} 
                        onClick={() => setUpiApp(app)}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                          upiApp === app 
                            ? 'bg-[#6C6CF0]/20 border-[#6C6CF0]/40 text-[#8C8CFF]' 
                            : 'bg-black/20 border-white/5 text-[#717171]'
                        }`}
                      >
                        {app}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 5. Quick Selectors (Category, Account, Payment) */}
            <div className="space-y-4">
              {/* Category */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider px-1">Category</p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
                  {CATEGORIES.map(cat => (
                    <button 
                      key={cat} 
                      onClick={() => setCategory(cat)}
                      className={`px-3.5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                        category === cat 
                          ? 'bg-white text-black' 
                          : 'bg-[#1C1C22] text-[#A0A0A5] border border-white/5'
                      }`}
                    >
                      <span className="text-[15px]">{CATEGORY_ICONS[cat] || '📝'}</span>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>



              {/* Compact Actions inside the form */}
              <div className="pt-2 space-y-2">
                {status === 'success' && (
                  <div className="flex items-center justify-center gap-2 py-1 text-emerald-500 font-bold text-xs animate-in fade-in slide-in-from-bottom-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Transaction saved successfully
                  </div>
                )}
                {status === 'error' && (
                  <div className="flex items-center justify-center gap-2 py-1 text-rose-500 font-bold text-xs">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errorMessage}
                  </div>
                )}
                
                <div className="flex gap-2">
                  <button 
                    onClick={closeMenu}
                    className="flex-1 py-2.5 rounded-xl font-bold text-[13px] text-[#A0A0A5] bg-[#1C1C22] border border-white/5 hover:bg-[#2C2C34] transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveManual}
                    disabled={!amount || !type || !selectedAccountId || (type !== 'TRANSFER' && !expenseType) || (type === 'TRANSFER' && !toAccountId) || (paymentMethod === 'UPI' && !upiApp) || status === 'success'}
                    className={`flex-[2] py-2.5 rounded-xl font-extrabold text-[13px] transition-all transform active:scale-[0.98] ${
                      (!amount || !type || !selectedAccountId || (type !== 'TRANSFER' && !expenseType) || (type === 'TRANSFER' && !toAccountId) || (paymentMethod === 'UPI' && !upiApp))
                      ? 'bg-[#2C2C34] text-[#5A5A62] cursor-not-allowed opacity-50'
                      : 'bg-[#3B3B98] text-white shadow-lg hover:bg-[#4545B0]'
                    }`}
                  >
                    {status === 'success' ? 'Saved!' : 'Save Transaction'}
                  </button>
                </div>
              </div>
            </div>



          </div>


        </div>,
        document.body
      )}
    </div>
  );
}
