import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, X, AlertCircle, CheckCircle2, Search, ChevronDown, Landmark, Smartphone, ArrowLeft, Calendar, Clock, Calculator, MoreHorizontal, User, AlignLeft, Hash, Paperclip, Save, ChevronRight } from 'lucide-react';
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

      {/* Manual Entry Modal - Native Android Clone Redesign */}
      {isAddingManual && createPortal(
        <div className="fixed inset-0 bg-[#0F0F13] text-white z-[9999] flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300 font-sans">
          {/* Header */}
          <div className="flex items-center px-2 py-4 gap-2 shrink-0 pt-safe-top">
            <button onClick={closeMenu} className="p-2 rounded-full hover:bg-white/10 transition-colors active:bg-white/20">
              <ArrowLeft className="w-6 h-6 text-[#E1E1E5]" />
            </button>
            <h2 className="text-xl font-medium tracking-wide text-[#F7F7F7]">Add transaction</h2>
          </div>

          <div className="flex-1 overflow-y-auto w-full px-5 pb-20 space-y-4 scrollbar-hide no-scrollbar">
            {/* Segmented Control */}
            <div className="flex bg-[#1C1C22] p-1 rounded-full w-full max-w-sm mx-auto mt-2">
              <button 
                type="button"
                onClick={() => setType('DEBIT')}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors ${type === 'DEBIT' ? 'bg-[#2A2A32] text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-300'}`}
              >
                Expense
              </button>
              <button 
                type="button"
                onClick={() => setType('CREDIT')}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-colors ${type === 'CREDIT' ? 'bg-[#2A2A32] text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-300'}`}
              >
                Income
              </button>
              <button disabled className="flex-1 py-2 px-4 rounded-full text-sm font-medium text-neutral-500 opacity-50 cursor-not-allowed">
                Transfer
              </button>
            </div>

            {/* Date and Time Row */}
            <div className="flex items-center gap-6 py-1">
              <label className="flex items-center gap-3 text-[#E1E1E5] relative cursor-pointer group flex-1">
                <Calendar className="w-5 h-5 text-[#A0A0A5]" />
                <span className="text-[15px] font-medium tracking-wide">{format(new Date(transactionDate), 'dd MMM yyyy')}</span>
                <input 
                  type="date" 
                  value={transactionDate.split('T')[0]} 
                  onChange={(e) => setTransactionDate(e.target.value + 'T' + transactionDate.split('T')[1])}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full custom-date-input"
                />
              </label>
              <label className="flex items-center gap-3 text-[#E1E1E5] relative cursor-pointer group flex-1">
                <Clock className="w-5 h-5 text-[#A0A0A5]" />
                <span className="text-[15px] font-medium tracking-wide">{format(new Date(transactionDate), 'hh:mm a')}</span>
                <input 
                  type="time" 
                  value={transactionDate.split('T')[1]} 
                  onChange={(e) => setTransactionDate(transactionDate.split('T')[0] + 'T' + e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full custom-time-input"
                />
              </label>
            </div>

            {/* Amount */}
            <div className="py-1">
              <label className="text-xs text-[#A0A0A5] mb-1 block font-medium">Amount</label>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <span className="text-3xl text-[#E1E1E5] font-medium">₹</span>
                  <input 
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0"
                    step="0.01"
                    className="bg-transparent text-4xl text-white outline-none w-full placeholder:text-[#4A4A52] font-normal"
                  />
                </div>
                <button className="w-10 h-10 rounded-full bg-[#1C1C22] flex items-center justify-center shrink-0 hover:bg-[#2A2A32] transition-colors">
                  <Calculator className="w-5 h-5 text-[#A0A0A5]" />
                </button>
              </div>
            </div>

            {/* Field List */}
            <div className="space-y-4 pt-1">
              {/* Category */}
              <label className="flex items-center justify-between cursor-pointer relative group">
                <div className="flex items-center gap-4">
                  <MoreHorizontal className="w-[20px] h-[20px] text-[#A0A0A5]" />
                  <div>
                    <p className="text-xs text-[#A0A0A5] mb-0">Category</p>
                    <p className="text-[14px] font-medium text-[#E1E1E5]">{category}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#A0A0A5]" />
                <select 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                >
                  {CATEGORIES.map(c => <option key={c} value={c} className="text-black">{c}</option>)}
                </select>
              </label>

              {/* Payment Mode */}
              <label className="flex items-center justify-between cursor-pointer relative group">
                <div className="flex items-center gap-4">
                  <Wallet className="w-[20px] h-[20px] text-[#A0A0A5]" />
                  <div>
                    <p className="text-xs text-[#A0A0A5] mb-0">Payment mode</p>
                    <p className="text-[14px] font-medium text-[#E1E1E5]">{paymentMethod}</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#A0A0A5]" />
                <select 
                  value={paymentMethod} 
                  onChange={e => setPaymentMethod(e.target.value as 'Bank'|'UPI')}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                >
                  <option value="Bank" className="text-black">Bank</option>
                  <option value="UPI" className="text-black">UPI</option>
                </select>
              </label>

              {/* UPI App (conditional) */}
              {paymentMethod === 'UPI' && (
                <label className="flex items-center justify-between cursor-pointer relative group animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-4">
                    <Smartphone className="w-[20px] h-[20px] text-[#A0A0A5]" />
                    <div>
                      <p className="text-xs text-[#A0A0A5] mb-0">UPI App *</p>
                      <p className="text-[14px] font-medium text-[#E1E1E5]">{upiApp || 'Select App'}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#A0A0A5]" />
                  <select 
                    value={upiApp} 
                    onChange={e => setUpiApp(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  >
                    <option value="" disabled className="text-black">Select App</option>
                    <option value="GPay" className="text-black">GPay</option>
                    <option value="PhonePe" className="text-black">PhonePe</option>
                    <option value="Paytm" className="text-black">Paytm</option>
                    <option value="Other" className="text-black">Other</option>
                  </select>
                </label>
              )}

              {/* Account */}
              <label className="flex items-center justify-between cursor-pointer relative group">
                <div className="flex items-center gap-4">
                  <Landmark className="w-[20px] h-[20px] text-[#A0A0A5]" />
                  <div>
                    <p className="text-xs text-[#A0A0A5] mb-0">Account *</p>
                    <p className="text-[14px] font-medium text-[#E1E1E5]">
                      {selectedAccountId ? accounts.find(a => a.id === selectedAccountId)?.bankName || 'Unknown Bank' : 'Select Account'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#A0A0A5]" />
                <select 
                  value={selectedAccountId} 
                  onChange={e => setSelectedAccountId(Number(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                >
                  <option value="" disabled className="text-black">Select Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id} className="text-black">{a.bankName}</option>)}
                </select>
              </label>

              {/* Party Name */}
              <label className="flex items-center justify-between cursor-pointer relative group">
                <div className="flex items-center gap-4 w-full">
                  <User className="w-[20px] h-[20px] text-[#A0A0A5] shrink-0" />
                  <div className="w-full">
                    <p className="text-xs text-[#A0A0A5] mb-0">{type === 'DEBIT' ? 'Paid To *' : 'Received From *'}</p>
                    <input 
                      type="text"
                      value={partyName}
                      onChange={e => setPartyName(e.target.value)}
                      placeholder="Enter name"
                      className="bg-transparent text-[14px] font-medium text-[#E1E1E5] outline-none w-full placeholder:text-[#4A4A52]"
                    />
                  </div>
                </div>
              </label>
            </div>

            {/* Other details Header */}
            <div className="pt-2">
              <h3 className="text-[12px] font-semibold text-[#E1E1E5] tracking-wide mb-3">Other details</h3>
              
              <div className="space-y-4">
                {/* Note */}
                <div className="flex items-center gap-4">
                  <AlignLeft className="w-[20px] h-[20px] text-[#A0A0A5] shrink-0" />
                  <input 
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Write a note"
                    className="bg-transparent text-[14px] text-[#E1E1E5] outline-none w-full placeholder:text-[#4A4A52] font-medium"
                  />
                </div>

                {/* Tags (Expense Type) */}
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <Hash className="w-[20px] h-[20px] text-[#A0A0A5] shrink-0" />
                    <span className="text-[14px] text-[#4A4A52] font-medium">Add tags (Expense Type)</span>
                  </div>
                  <div className="flex flex-wrap gap-2 pl-[36px]">
                    {appCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setExpenseType(expenseType === cat ? '' : cat)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                          expenseType === cat 
                            ? 'bg-[#2A2A32] text-[#E1E1E5]' 
                            : 'bg-[#1C1C22] text-[#A0A0A5] hover:bg-[#2A2A32]'
                        }`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full ${expenseType === cat ? 'bg-indigo-500' : 'bg-[#2A2A32]'}`}></div>
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Attachment */}
                <div className="flex items-center justify-between cursor-not-allowed opacity-50 pt-1">
                  <div className="flex items-center gap-4">
                    <Paperclip className="w-[20px] h-[20px] text-[#A0A0A5] shrink-0" />
                    <span className="text-[14px] text-[#A0A0A5] font-medium">Add attachment</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[#A0A0A5]" />
                </div>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {(status === 'error' || status === 'success') && (
            <div className="absolute bottom-28 left-4 right-24 z-10 animate-in fade-in slide-in-from-bottom-2">
              {status === 'error' && (
                <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl flex items-center gap-3 text-[13px] font-medium border border-rose-500/20 shadow-lg backdrop-blur-md">
                  <AlertCircle className="w-5 h-5 shrink-0" /> {errorMessage}
                </div>
              )}
              {status === 'success' && (
                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center gap-3 text-[13px] font-medium border border-emerald-500/20 shadow-lg backdrop-blur-md">
                  <CheckCircle2 className="w-5 h-5 shrink-0" /> Transaction saved!
                </div>
              )}
            </div>
          )}

          {/* Floating Action Button for Save */}
          <div className="absolute bottom-6 right-6 z-20">
            <button
              onClick={handleSaveManual}
              disabled={!amount || !type || !partyName || !selectedAccountId || (paymentMethod === 'UPI' && !upiApp) || status === 'success'}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Save className="w-7 h-7" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
