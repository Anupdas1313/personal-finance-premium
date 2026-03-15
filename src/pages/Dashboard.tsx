import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, X, AlertCircle, CheckCircle2, Search, ChevronDown, Landmark, Smartphone, ArrowLeft, Calendar, Clock, Calculator, MoreHorizontal, User, AlignLeft, Hash, Paperclip, Save, ChevronRight, CreditCard, Coins, PlaneTakeoff } from 'lucide-react';

import { format, startOfMonth, startOfYear, isToday, isYesterday, startOfDay } from 'date-fns';
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
  'Food': 'bg-brand-blue/5 text-brand-blue dark:text-brand-cyan',
  'Transport': 'bg-brand-blue/5 text-brand-blue dark:text-brand-cyan',
  'Rent': 'bg-brand-blue/5 text-brand-blue dark:text-brand-cyan',
  'Shopping': 'bg-brand-blue/5 text-brand-blue dark:text-brand-cyan',
  'Bills': 'bg-brand-blue/5 text-brand-blue dark:text-brand-cyan',
  'Entertainment': 'bg-brand-blue/5 text-brand-blue dark:text-brand-cyan',
  'Salary': 'bg-brand-green/10 text-brand-green',
  'Transfer': 'bg-brand-blue/5 text-brand-blue dark:text-brand-cyan',
  'Other': 'bg-brand-blue/5 text-brand-blue dark:text-brand-cyan'
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
    // Use startingBalanceDate as the anchor
    const startLimit = acc.startingBalanceDate ? startOfDay(new Date(acc.startingBalanceDate)).getTime() : 0;
    
    let startingBalance = Number(acc.startingBalance) || 0;
    let txsToConsider = allTransactions.filter(t => Number(t.accountId) === Number(acc.id));

    if (latestClosedMonth) {
      if (latestClosedMonth.accountBalances[acc.id!] !== undefined) {
        startingBalance = Number(latestClosedMonth.accountBalances[acc.id!]);
        
        // Only consider transactions AFTER the closed month
        const closedMonthDate = new Date(latestClosedMonth.month + '-01');
        const nextMonthStart = new Date(closedMonthDate.getFullYear(), closedMonthDate.getMonth() + 1, 1).getTime();
        
        txsToConsider = txsToConsider.filter(t => new Date(t.dateTime).getTime() >= nextMonthStart);
      } else {
        // No close for this account, respect starting date
        if (startLimit) {
          txsToConsider = txsToConsider.filter(t => startOfDay(new Date(t.dateTime)).getTime() >= startLimit);
        }
      }
    } else if (startLimit) {
      // No closed months at all, just respect starting date
      txsToConsider = txsToConsider.filter(t => startOfDay(new Date(t.dateTime)).getTime() >= startLimit);
    }

    const currentBalance = txsToConsider.reduce((accBal, tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'CREDIT') return accBal + amt;
      if (tx.type === 'DEBIT') return accBal - amt;
      return accBal;
    }, startingBalance);
    
    return { ...acc, currentBalance };
  });

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    if (timeFilter === 'This Month') {
      const monthStart = startOfMonth(now).getTime();
      return allTransactions.filter(tx => new Date(tx.dateTime).getTime() >= monthStart);
    }
    if (timeFilter === 'This Year') {
      const yearStart = startOfYear(now).getTime();
      return allTransactions.filter(tx => new Date(tx.dateTime).getTime() >= yearStart);
    }
    return allTransactions;
  }, [allTransactions, timeFilter]);

  const { totalIncome, totalSpending } = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'CREDIT') acc.totalIncome += amt;
        if (tx.type === 'DEBIT') acc.totalSpending += amt;
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
          <p className="text-sm font-black text-[#1A237E] dark:text-[#A0A0A0] tracking-wide uppercase opacity-70">{greeting},</p>
          <h1 className="text-3xl font-black text-[#1A237E] dark:text-[#F7F7F7] leading-tight">Proshanjit 👋</h1>
        </div>

        <div className="flex items-center gap-3">
          <div
            title="Proshanjit"
            className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1A237E] to-[#4A4ABF] flex items-center justify-center text-white font-black text-lg select-none shadow-lg cursor-pointer border-2 border-white dark:border-[#1A1A1E]"
          >
            A
          </div>

        </div>
      </div>




      {/* Cash Flow Hero Card */}
      <div className="relative overflow-hidden rounded-[28px] bg-[#1A237E] dark:bg-gradient-to-br dark:from-[#1C1C24] dark:to-[#1C1F26] p-8 shadow-[0_20px_50px_rgba(26,35,126,0.3)] border border-white/10">

        {/* Subtle glowing orb effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
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
            <p className="text-xs font-bold text-brand-red tracking-wider uppercase mb-1">Spending</p>
            <p className="text-3xl font-bold text-white tracking-tight">
              ₹{totalSpending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-brand-green tracking-wider uppercase mb-1">Income</p>
            <p className="text-3xl font-bold text-white tracking-tight">
              ₹{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>

        </div>

        <div className="relative z-10 bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center backdrop-blur-sm">
          <p className="text-sm font-semibold text-white/50 border-b border-dashed border-white/20 pb-0.5">Net Balance</p>
          <p className={`text-lg font-bold ${netBalance >= 0 ? 'text-white' : 'text-brand-red'}`}>
            {netBalance < 0 ? '-' : ''}₹{Math.abs(netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accounts List */}
        <div className="bg-white dark:bg-[#0C0C0F] rounded-[28px] shadow-[0_8px_40px_rgba(26,35,126,0.08)] dark:shadow-none border border-[#EBEBEB] dark:border-[#1A1A1E] overflow-hidden">
          <div className="p-6 border-b border-[#EBEBEB] dark:border-[#1A1A1E] flex justify-between items-center">
            <h2 className="text-xl font-black text-[#1A237E] dark:text-[#F7F7F7]">Your Accounts</h2>
            <Link to="/accounts" className="text-sm font-black text-[#00A86B] dark:text-[#A0A0A0] hover:underline transition-colors uppercase tracking-wider">Manage</Link>
          </div>


          <div className="divide-y divide-[#EBEBEB] dark:divide-[#1A1A1E]">
            {balances.length === 0 ? (
              <div className="p-6 text-center text-[#717171] dark:text-[#A0A0A0] text-sm">No accounts added yet.</div>
            ) : (
              balances.map(acc => (
                <div key={acc.id} className="p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-[#15151A] transition-colors group cursor-pointer" onClick={() => navigate('/accounts')}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center overflow-hidden p-1.5 shadow-sm border border-[#EBEBEB] dark:border-[#1A1A1E]">
                      <BankLogo bankName={acc.bankName} type={(acc as any).type} className="w-full h-full" />
                    </div>
                    <div>
                      <p className="font-black text-[#111111] dark:text-[#F7F7F7]">{acc.bankName}</p>
                      <p className="text-xs text-[#525252] dark:text-[#A0A0A0] font-bold mt-0.5">
                        {(acc as any).type === 'CASH' ? acc.accountLast4 : `**** ${acc.accountLast4}`}
                      </p>
                    </div>
                  </div>
                  <p className="font-black text-[#111111] dark:text-[#F7F7F7]">
                    ₹{acc.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>

                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-transparent overflow-hidden">
          <div className="pb-5 flex justify-between items-center px-1">
            <h2 className="text-xl font-black text-[#1A237E] dark:text-[#F7F7F7]">Recent Transactions</h2>
            <Link to="/transactions" className="text-sm font-black text-[#00A86B] dark:text-[#A0A0A0] hover:underline transition-colors uppercase tracking-wider">View All</Link>
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
                  <div key={tx.id} className="p-4 bg-white dark:bg-[#0C0C0F] border border-[#EBEBEB] dark:border-[#1A1A1E] rounded-[24px] flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-[#15151A] transition-colors shadow-[0_8px_30px_rgba(26,35,126,0.06)] dark:shadow-none group cursor-pointer" onClick={() => navigate('/transactions')}>

                    <div className="flex items-center gap-4">

                      {/* Squircle Icon */}
                      <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center text-xl shrink-0 ${catColorClasses}`}>
                        {CATEGORY_ICONS[tx.category] || '📝'}
                      </div>

                      
                      {/* Title & Subtext */}
                      <div>
                        <p className="font-black text-brand-blue dark:text-[#F7F7F7] text-base group-hover:text-brand-green dark:group-hover:text-white transition-colors">
                          {tx.party || tx.note || tx.category}
                        </p>


                        <div className="flex items-center text-xs text-[#525252] dark:text-[#A0A0A0] font-bold mt-0.5 gap-1.5">

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
                      <p className={`font-black text-base tracking-tight ${tx.type === 'CREDIT' ? 'text-brand-green' : 'text-brand-blue dark:text-[#F7F7F7]'}`}>
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
        <div className="fixed inset-0 bg-[#F7F7F7] dark:bg-[#0F0F13] text-[#222222] dark:text-white z-[9999] flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300 font-sans">
          <div className="flex items-center justify-between px-4 py-1 pt-safe-top bg-white dark:bg-[#1C1C22] border-b border-[#EBEBEB] dark:border-white/5 z-20">
            <button onClick={closeMenu} className="text-[#717171] dark:text-[#A0A0A5] hover:text-[#222222] dark:hover:text-white p-1.5 -ml-1 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h2 className="text-[14px] font-bold text-[#222222] dark:text-white tracking-tight">Add Transaction</h2>

            <div className="w-6" /> {/* Spacer to balance back arrow */}
          </div>

          <div className="flex-1 overflow-y-auto w-full px-4 pt-2 pb-safe space-y-3.5 scrollbar-hide no-scrollbar">
            
            {/* 1. Transaction Type Toggle (Top Priority) */}
            <div className="flex bg-white dark:bg-[#1C1C22] p-1 rounded-2xl border border-[#EBEBEB] dark:border-white/5">

              <button 
                onClick={() => setType('DEBIT')}
                className={`flex-1 py-1.5 text-[12px] font-black rounded-xl transition-all uppercase tracking-widest ${type === 'DEBIT' ? 'bg-brand-red text-white shadow-lg' : 'text-brand-blue/30 hover:text-brand-blue'}`}
              >
                Outflow
              </button>
              <button 
                onClick={() => setType('CREDIT')}
                className={`flex-1 py-1.5 text-[12px] font-black rounded-xl transition-all uppercase tracking-widest ${type === 'CREDIT' ? 'bg-brand-green text-white shadow-lg' : 'text-brand-blue/30 hover:text-brand-blue'}`}
              >
                Inflow
              </button>
              <button 
                onClick={() => setType('TRANSFER')}
                className={`flex-1 py-1.5 text-[12px] font-black rounded-xl transition-all uppercase tracking-widest ${type === 'TRANSFER' ? 'bg-brand-blue text-white shadow-lg' : 'text-brand-blue/30 hover:text-brand-blue'}`}
              >
                Transfer
              </button>

            </div>
            {/* Date and Time Selector */}
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider px-1">Date & Time</p>
              <div className="relative">
                <div className="bg-white dark:bg-[#1C1C22] p-3 rounded-xl border border-[#EBEBEB] dark:border-white/5 flex items-center justify-between active:bg-neutral-50 dark:active:bg-[#2C2C34] transition-colors">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-[#1A237E] dark:text-[#6C6CF0]" />
                    <span className="text-[13px] font-black text-[#1A237E] dark:text-white">
                      {isToday(new Date(transactionDate)) ? 'Today, ' : isYesterday(new Date(transactionDate)) ? 'Yesterday, ' : format(new Date(transactionDate), 'dd MMM, ')}
                      {format(new Date(transactionDate), 'hh:mm a')}
                    </span>
                  </div>
                  <input 
                    type="datetime-local"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <ChevronDown className="w-4 h-4 text-[#1A237E] dark:text-[#717171]" />


                </div>
              </div>
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
                          ? 'bg-brand-blue text-white border-transparent shadow-md' 
                          : 'bg-white dark:bg-[#1C1C22] border-[#EBEBEB] dark:border-white/5 text-brand-blue/60 dark:text-[#A0A0A5] hover:ring-1 hover:ring-brand-cyan'
                      }`}


                    >
                      #{tagName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Amount & Account Row */}
            <div className={`bg-white dark:bg-[#1C1C22] rounded-xl border border-[#EBEBEB] dark:border-white/5 flex ${type === 'TRANSFER' ? 'flex-col divide-y' : 'divide-x'} divide-[#EBEBEB] dark:divide-white/5 overflow-hidden shadow-inner`}>

              
              {/* Amount Input (Left) */}
              <div className={`flex items-center gap-1.5 p-2 ${type === 'TRANSFER' ? 'w-full' : 'w-[45%]'} focus-within:bg-neutral-50 dark:focus-within:bg-white/[0.02] transition-colors shrink-0`}>
                <span className="text-base font-bold text-[#717171] dark:text-[#A0A0A5]">₹</span>

                <input 
                  type="number"
                  inputMode="decimal"
                  autoFocus
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="bg-transparent text-[20px] font-black text-brand-blue dark:text-white outline-none w-full placeholder:text-[#D1D1D1] dark:placeholder:text-[#2C2C34] min-w-0"



                />
              </div>

              {/* Account Selection (Right) */}
              <div className={`p-1 flex-1 flex items-center overflow-x-auto no-scrollbar bg-neutral-100/50 dark:bg-black/10`}>

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
                          // Auto-select payment method based on account type
                          if ((acc as any).type === 'CASH') setPaymentMethod('Cash');
                          else if ((acc as any).type === 'CREDIT_CARD') setPaymentMethod('Credit Card');
                          else if (paymentMethod === 'Cash' || paymentMethod === 'Credit Card') setPaymentMethod('Bank');
                        }
                      }}
                      className={`shrink-0 flex flex-col items-center justify-center gap-0.5 p-1 rounded-lg border transition-all group relative ${
                        selectedAccountId === acc.id || toAccountId === acc.id
                          ? 'bg-brand-blue/10 dark:bg-brand-blue/20 border-brand-blue text-brand-blue dark:text-white shadow-sm ring-1 ring-brand-cyan/30' 
                          : 'bg-white dark:bg-[#1C1C22] border-[#EBEBEB] dark:border-white/5 text-brand-blue/60 dark:text-[#A0A0A5] hover:bg-neutral-50 dark:hover:bg-[#2C2C34]'
                      }`}


                      style={{ minWidth: '52px' }}
                    >
                      {selectedAccountId === acc.id && type === 'TRANSFER' && (
                        <div className="absolute -top-1.5 bg-[#3B3B98] text-[6px] font-bold px-1 py-0.5 rounded shadow-lg border border-white/10">FROM</div>
                      )}
                      {toAccountId === acc.id && type === 'TRANSFER' && (
                        <div className="absolute -top-1.5 bg-brand-blue text-[6px] font-bold px-1 py-0.5 rounded shadow-lg border border-white/10">TO</div>
                      )}

                      
                      <div className="w-5 h-5 rounded-lg bg-white flex items-center justify-center p-1 shadow-sm">
                        <BankLogo bankName={acc.bankName} type={(acc as any).type} className="w-full h-full" />
                      </div>
                      <span className="text-[7.5px] font-bold whitespace-nowrap overflow-hidden text-ellipsis w-full text-center tracking-wide">
                        {acc.bankName.substring(0, 10)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Identity, Remarks & Payment Group */}
            <div className="bg-white dark:bg-[#1C1C22] rounded-xl border border-[#EBEBEB] dark:border-white/5 divide-y divide-[#EBEBEB] dark:divide-white/5">

              {/* Paid via / Received from (Hide for Transfer) */}
              {type !== 'TRANSFER' && (
                <div className="flex items-center gap-2.5 p-2">
                  <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-black/40 flex items-center justify-center shrink-0 border border-[#EBEBEB] dark:border-white/5">
                    <User className="w-3.5 h-3.5 text-[#717171] dark:text-[#A0A0A5]" />

                  </div>
                  <input 
                    type="text"
                    value={partyName}
                    onChange={e => setPartyName(e.target.value)}
                    placeholder={type === 'DEBIT' ? 'Paid to...' : 'Received from...'}
                    className="bg-transparent flex-1 text-[14px] font-black text-brand-blue dark:text-white outline-none placeholder:text-[#A0A0A0] dark:placeholder:text-[#4A4A52]"
                  />


                </div>
              )}

              {/* Remarks */}
              <div className="flex items-center gap-2.5 p-2">
                <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-black/40 flex items-center justify-center shrink-0 border border-[#EBEBEB] dark:border-white/5">
                  <AlignLeft className="w-3.5 h-3.5 text-[#717171] dark:text-[#A0A0A5]" />

                </div>
                <input 
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add remarks..."
                  className="bg-transparent flex-1 text-[13px] font-bold text-brand-blue dark:text-white/90 outline-none placeholder:text-[#A0A0A0] dark:placeholder:text-[#4A4A52]"


                />
              </div>

              {/* Payment Mode Selector (Compact Grid) */}
              <div className="p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold text-[#A0A0A5] uppercase tracking-wider">Payment Method</p>
                  {paymentMethod && <span className="text-[9px] font-bold text-brand-blue dark:text-brand-cyan">{paymentMethod}</span>}



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
                          ? 'bg-brand-green border-brand-green text-white shadow-lg scale-95' 
                          : 'bg-[#F7F7F7] dark:bg-black/20 border-[#EBEBEB] dark:border-white/5 text-[#717171] dark:text-[#A0A0A5] active:scale-95 hover:border-brand-cyan'
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
                          ? 'bg-brand-blue text-white border-brand-blue shadow-md' 
                          : 'bg-[#F7F7F7] dark:bg-black/20 border-[#EBEBEB] dark:border-white/5 text-[#717171] hover:border-brand-cyan'
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
                          ? 'bg-brand-blue text-white dark:bg-white dark:text-black shadow-md scale-105' 
                          : 'bg-white dark:bg-[#1C1C22] text-brand-blue/60 dark:text-[#A0A0A5] border border-[#EBEBEB] dark:border-white/5 hover:border-brand-cyan'
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
                  <div className="flex items-center justify-center gap-2 py-1 text-emerald-600 dark:text-emerald-500 font-bold text-xs animate-in fade-in slide-in-from-bottom-1">

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
                    className="flex-1 py-2.5 rounded-xl font-bold text-[13px] text-[#717171] dark:text-[#A0A0A5] bg-white dark:bg-[#1C1C22] border border-[#EBEBEB] dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-[#2C2C34] transition-colors"

                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveManual}
                    disabled={!amount || !type || !selectedAccountId || (type !== 'TRANSFER' && !expenseType) || (type === 'TRANSFER' && !toAccountId) || (paymentMethod === 'UPI' && !upiApp) || status === 'success'}
                    className={`flex-[2] py-2.5 rounded-xl font-extrabold text-[13px] transition-all transform active:scale-[0.98] ${
                      (!amount || !type || !selectedAccountId || (type !== 'TRANSFER' && !expenseType) || (type === 'TRANSFER' && !toAccountId) || (paymentMethod === 'UPI' && !upiApp))
                      ? 'bg-[#2C2C34] text-[#5A5A62] cursor-not-allowed opacity-50'
                      : 'bg-[#00A86B] text-white shadow-lg shadow-emerald-500/10 dark:shadow-none hover:bg-[#00925d] hover:ring-2 hover:ring-[#82EEFD]'
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
