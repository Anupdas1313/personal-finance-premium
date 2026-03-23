import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, X, AlertCircle, CheckCircle2, Search, ChevronDown, Landmark, Smartphone, ArrowLeft, Calendar, Clock, Calculator, MoreHorizontal, User, AlignLeft, Hash, Paperclip, Save, ChevronRight, CreditCard, Coins, PlaneTakeoff, Eye, EyeOff, Wand2 } from 'lucide-react';

import { format, startOfMonth, startOfYear, isToday, isYesterday, startOfDay } from 'date-fns';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';

import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';



import { AIChatEntry } from '../components/AIChatEntry';
import { IndusIndLogo } from '../components/IndusIndLogo';
import { UnionBankLogo } from '../components/UnionBankLogo';
import { BankLogo } from '../components/BankLogo';

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.orderBy('dateTime').reverse().limit(5).toArray()) || [];


  const [isAddingManual, setIsAddingManual] = useState(searchParams.get('add') === 'true');

  // Sync state with URL and ensure fresh current time on open
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setIsAddingManual(true);
      setTransactionDate(new Date().toISOString().slice(0, 16));
    }
  }, [searchParams]);

  useEffect(() => {
    if (isAddingManual) {
      setTransactionDate(new Date().toISOString().slice(0, 16));
    }
  }, [isAddingManual]);

  const closeMenu = () => {
    setIsAddingManual(false);
    if (searchParams.get('add')) {
      navigate('/', { replace: true });
    }
  };

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'CREDIT' | 'DEBIT' | 'TRANSFER' | ''>('DEBIT');
  const [category, setCategory] = useState('Other');
  const [note, setNote] = useState('');
  const [partyName, setPartyName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const [toAccountId, setToAccountId] = useState<number | ''>('');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Bank' | 'Cash' | 'Credit Card' | 'Bank Transfer'>('UPI');
  const [upiApp, setUpiApp] = useState('GPay');
  const { tags } = useTags();
  const [expenseType, setExpenseType] = useState<string>('');
  const [entryMode, setEntryMode] = useState<'MANUAL' | 'CHAT'>('MANUAL');

  // Set default expense type once tags load
  useEffect(() => {
    if (tags.length > 0 && !expenseType) {
      setExpenseType(tags[0]);
    }
  }, [tags]);

  // Auto-select first account when accounts load and none selected
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      const firstAcc = accounts[0];
      setSelectedAccountId(firstAcc.id!);
      if ((firstAcc as any).type === 'CASH') setPaymentMethod('Cash');
      else if ((firstAcc as any).type === 'CREDIT_CARD') setPaymentMethod('Credit Card');
    }
  }, [accounts, selectedAccountId]);

  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [timeFilter, setTimeFilter] = useState<'All Time' | 'This Month' | 'This Year'>('All Time');
  const [isAmountsHidden, setIsAmountsHidden] = useState(false);
  
  const { categories: appCategories } = useCategories();

  const handleSaveManual = async (txData?: any) => {
    const currentAmount = txData?.amount || amount;
    const currentType = txData?.type || type;
    const currentSelectedAccountId = txData?.selectedAccountId || selectedAccountId;
    const currentToAccountId = txData?.toAccountId || toAccountId;
    const currentPaymentMethod = txData?.paymentMethod || paymentMethod;
    const currentUpiApp = txData?.upiApp || upiApp;
    const currentExpenseType = txData?.expenseType || expenseType;
    const currentPartyName = txData?.partyName || partyName;
    const currentNote = txData?.note || note;
    const currentCategory = txData?.category || category;
    const currentTransactionDate = txData?.transactionDate || transactionDate;

    if (!currentAmount || !currentType || !currentSelectedAccountId || (currentType !== 'TRANSFER' && !currentExpenseType)) {
      setStatus('error');
      setErrorMessage('Missing required fields.');
      return;
    }

    try {
      if (currentType === 'TRANSFER') {
        if (!currentToAccountId) {
          setStatus('error');
          setErrorMessage('Please select a destination account for the transfer.');
          return;
        }
        if (currentSelectedAccountId === currentToAccountId) {
          setStatus('error');
          setErrorMessage('Source and destination accounts cannot be the same.');
          return;
        }

        const isTodaySelected = format(new Date(currentTransactionDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        const finalDateTime = isTodaySelected ? new Date() : new Date(currentTransactionDate);

        // Add DEBIT transaction for source account
        await db.transactions.add({
          accountId: Number(currentSelectedAccountId),
          amount: parseFloat(currentAmount.toString().replace(/,/g, '')) || 0,
          type: 'DEBIT',
          dateTime: finalDateTime,
          note: currentNote || `Transfer to ${accounts.find(a => a.id === currentToAccountId)?.bankName}`,
          category: 'Transfer',
          paymentMethod: currentPaymentMethod,
          upiApp: currentPaymentMethod === 'UPI' ? currentUpiApp : undefined,
          party: accounts.find(a => a.id === currentToAccountId)?.bankName || 'Other Account',
          expenseType: currentExpenseType,
        });

        // Add CREDIT transaction for destination account
        await db.transactions.add({
          accountId: Number(currentToAccountId),
          amount: parseFloat(currentAmount.toString().replace(/,/g, '')) || 0,
          type: 'CREDIT',
          dateTime: finalDateTime,
          note: currentNote || `Transfer from ${accounts.find(a => a.id === currentSelectedAccountId)?.bankName}`,
          category: 'Transfer',
          paymentMethod: currentPaymentMethod,
          upiApp: currentPaymentMethod === 'UPI' ? currentUpiApp : undefined,
          party: accounts.find(a => a.id === currentSelectedAccountId)?.bankName || 'Other Account',
          expenseType: currentExpenseType,
        });
      } else {
        const isTodaySelected = format(new Date(currentTransactionDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        const finalDateTime = isTodaySelected ? new Date() : new Date(currentTransactionDate);

        await db.transactions.add({
          accountId: Number(currentSelectedAccountId),
          amount: parseFloat(currentAmount.toString().replace(/,/g, '')) || 0,
          type: currentType as 'CREDIT' | 'DEBIT',
          dateTime: finalDateTime,
          note: currentNote || '',
          category: currentCategory,
          paymentMethod: currentPaymentMethod,
          upiApp: currentPaymentMethod === 'UPI' ? currentUpiApp : undefined,
          party: currentPartyName,
          expenseType: currentExpenseType,
        });
      }
      
      setStatus('success');
      setTimeout(() => {
        closeMenu();
        setStatus('idle');
        setAmount('');
        setType('DEBIT');
        setNote('');
        setPartyName('');
        setCategory('Other');
        setTransactionDate(new Date().toISOString().slice(0, 16));
        setPaymentMethod('UPI');
        setUpiApp('GPay');
        setExpenseType(tags[0] || '');
        setToAccountId('');
      }, 800);
    } catch (error) {
      setStatus('error');
      setErrorMessage('Failed to save transaction.');
      console.error(error);
    }
  };

  const monthlyClosings = useLiveQuery(() => db.monthlyClosings.orderBy('month').reverse().toArray()) || [];
  const allClosings = useLiveQuery(() => db.accountClosings.toArray()) || [];

  // Optimized balance and metrics calculation
  const { balances, totalIncome, totalSpending, totalWealth } = useLiveQuery(async () => {
    const accs = await db.accounts.toArray();
    const closings = await db.accountClosings.toArray();
    const monthlyClosings = await db.monthlyClosings.orderBy('month').reverse().toArray();
    const latestMonthly = monthlyClosings[0];

    let income = 0;
    let spending = 0;

    const now = new Date();
    const monthStart = startOfMonth(now).getTime();
    const yearStart = startOfYear(now).getTime();

    // 1. Calculate REAL-TIME balances for all accounts from the entire history
    const allTxs = await db.transactions.toArray();
    
    const calculatedBalances = accs.map(acc => {
      let bal = Number(acc.startingBalance) || 0;
      const accountTxs = allTxs.filter(t => Number(t.accountId) === Number(acc.id));
      accountTxs.forEach(tx => {
        if (tx.type === 'CREDIT') bal += (Number(tx.amount) || 0);
        else if (tx.type === 'DEBIT') bal -= (Number(tx.amount) || 0);
      });
      return bal;
    });

    // 2. Calculate metrics (Income/Spending) based on time filter
    allTxs.forEach(tx => {
      const txTime = new Date(tx.dateTime).getTime();
      let isInRange = false;
      
      if (timeFilter === 'This Month') {
        isInRange = txTime >= monthStart;
      } else if (timeFilter === 'This Year') {
        isInRange = txTime >= yearStart;
      } else {
        isInRange = true; // All Time
      }

      // Exclude transfers from income/spending metrics to avoid double-counting
      if (isInRange && tx.category !== 'Transfer') {
        if (tx.type === 'CREDIT') income += (Number(tx.amount) || 0);
        else if (tx.type === 'DEBIT') spending += (Number(tx.amount) || 0);
      }
    });

    const totalWealth = calculatedBalances.reduce((sum, b) => sum + b, 0);

    return { 
      balances: accs.map((acc, i) => ({ ...acc, currentBalance: calculatedBalances[i] })), 
      totalIncome: income, 
      totalSpending: spending,
      totalWealth
    };
  }, [timeFilter]) || { balances: [], totalIncome: 0, totalSpending: 0, totalWealth: 0 };
  
  const monthDelta = totalIncome - totalSpending;
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
          <p className="text-sm font-semibold text-[#1A237E]/60 dark:text-[#A0A0A0] tracking-[0.1em] uppercase">{greeting},</p>
          <h1 className="text-3xl font-heading font-semibold text-[#1A237E] dark:text-[#F7F7F7] leading-tight tracking-tight">Guest User 👋</h1>
        </div>

        <div className="flex items-center gap-3">
          <div
            title="Guest User"
            className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1A237E] to-[#4A4ABF] flex items-center justify-center text-white select-none shadow-lg cursor-pointer border-2 border-white dark:border-[#1A1A1E]"
          >
            <User className="w-6 h-6" />
          </div>

        </div>
      </div>




      {/* Cash Flow Hero Card */}
      <div 
        className="relative overflow-hidden rounded-[28px] bg-[#F0F4FF] dark:bg-[#111111] p-6 shadow-[0_20px_50px_rgba(26,35,126,0.04)] border border-brand-blue/5 dark:border-white/5 group"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-brand-blue/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10 flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-[10px] font-semibold text-brand-blue/60 dark:text-[#A0A0A0] tracking-[0.2em] uppercase">Cash Flow</h2>
          </div>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="appearance-none bg-white dark:bg-[#1A1A1A] hover:bg-neutral-50 text-brand-blue/60 dark:text-white/90 text-[9px] font-semibold uppercase tracking-[0.1em] px-3 py-1 rounded-full pr-7 cursor-pointer outline-none transition-colors border border-brand-blue/10"
            >
              <option value="This Month">This Month</option>
              <option value="This Year">This Year</option>
              <option value="All Time">All Time</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-blue/30 pointer-events-none" />
          </div>
        </div>

        <div className="relative z-10 flex justify-between items-stretch mb-8 gap-10">
          <div className="flex-1 overflow-hidden py-2">
            <p className="text-[10px] font-semibold text-rose-500/80 tracking-[0.2em] uppercase mb-2">Spending</p>
            <p className="text-3xl font-heading font-semibold text-brand-blue dark:text-white tracking-tight truncate">
              ₹{totalSpending.toLocaleString('en-IN')}
            </p>
          </div>
          
          <div className="w-[1px] bg-brand-blue/10 dark:bg-white/10 self-stretch my-2"></div>

          <div className="flex-1 text-right overflow-hidden py-2">
            <p className="text-[10px] font-semibold text-emerald-500/80 tracking-[0.2em] uppercase mb-2">Income</p>
            <p className="text-3xl font-heading font-semibold text-brand-blue dark:text-white tracking-tight truncate">
              ₹{totalIncome.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div className="relative z-10 bg-white/60 dark:bg-white/5 border border-brand-blue/5 dark:border-white/10 rounded-2xl p-4 flex justify-between items-center backdrop-blur-sm">
          <div className="flex flex-col">
            <p className="text-[10px] font-semibold text-brand-blue/50 dark:text-white/40 uppercase tracking-widest leading-none mb-1.5">Total Wealth</p>
            {timeFilter !== 'All Time' && (
              <p className={`text-[9px] font-semibold ${monthDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'} uppercase tracking-[0.1em]`}>
                {monthDelta >= 0 ? '+' : ''}₹{monthDelta.toLocaleString('en-IN')} this {timeFilter === 'This Month' ? 'month' : 'year'}
              </p>
            )}
          </div>
          <p className={`text-xl font-heading font-semibold tracking-tight text-brand-blue dark:text-brand-cyan`}>
            ₹{totalWealth.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accounts List */}
        <div className="bg-white dark:bg-[#0C0C0F] rounded-[28px] shadow-[0_8px_40px_rgba(26,35,126,0.08)] dark:shadow-none border border-[#EBEBEB] dark:border-[#1A1A1E] overflow-hidden">
          <div className="p-6 border-b border-[#EBEBEB] dark:border-[#1A1A1E] flex justify-between items-center">
            <h2 className="text-xl font-heading font-semibold text-[#1A237E] dark:text-[#F7F7F7] tracking-tight">Your Accounts</h2>
            <Link to="/accounts" className="text-sm font-semibold text-[#00A86B] dark:text-emerald-500/70 hover:underline transition-colors uppercase tracking-[0.2em]">Manage</Link>
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
                      <p className="font-semibold text-[#111111] dark:text-[#F7F7F7]">{acc.bankName}</p>
                      <p className="text-xs text-[#525252] dark:text-[#A0A0A0] font-medium mt-0.5">
                        {(acc as any).type === 'CASH' ? acc.accountLast4 : `**** ${acc.accountLast4}`}
                      </p>
                    </div>
                  </div>
                  <p className="font-heading font-semibold text-brand-blue dark:text-brand-cyan tracking-tight">
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
            <h2 className="text-xl font-heading font-semibold text-[#1A237E] dark:text-[#F7F7F7] tracking-tight">Recent Transactions</h2>
            <Link to="/transactions" className="text-sm font-semibold text-[#00A86B] dark:text-emerald-500/70 hover:underline transition-colors uppercase tracking-[0.2em]">View All</Link>
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
                        <p className="font-semibold text-brand-blue dark:text-[#F7F7F7] text-base group-hover:text-brand-green dark:group-hover:text-white transition-colors">
                          {tx.party || tx.note || tx.category}
                        </p>


                        <div className="flex items-center text-xs text-[#525252] dark:text-[#A0A0A0] font-medium mt-0.5 gap-1.5">

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
                      <p className={`font-heading font-semibold text-base tracking-tight ${tx.type === 'CREDIT' ? 'text-brand-green' : 'text-rose-500'}`}>
                        {tx.type === 'CREDIT' ? '+' : ''}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>


                      <p className="text-[10px] text-[#717171] dark:text-[#A0A0A0] font-medium mt-0.5 uppercase tracking-[0.1em]">
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
        <div className="fixed inset-0 bg-[#F7F7F7] dark:bg-[#0A0A0A] text-[#222222] dark:text-white z-[9999] flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-300 font-sans">
          {/* Elegant Header — More compact */}
          <div className="flex items-center justify-between px-3 py-1.5 pt-safe-top bg-white dark:bg-[#111111] border-b border-[#EBEBEB] dark:border-white/5 shadow-sm z-20">
            <button onClick={closeMenu} className="text-[#717171] dark:text-[#A0A0A5] hover:text-brand-blue dark:hover:text-brand-cyan transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
            <div className="flex bg-[#F7F7F7] dark:bg-white/5 p-0.5 rounded-xl border border-[#EBEBEB] dark:border-white/5">
              <button 
                onClick={() => setEntryMode('MANUAL')}
                className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${entryMode === 'MANUAL' ? 'bg-white dark:bg-white/10 text-brand-blue dark:text-brand-cyan shadow-sm' : 'text-neutral-400'}`}
              >
                Manual
              </button>
              <button 
                onClick={() => setEntryMode('CHAT')}
                className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all flex items-center gap-1.5 ${entryMode === 'CHAT' ? 'bg-white dark:bg-white/10 text-brand-blue dark:text-brand-cyan shadow-sm' : 'text-neutral-400'}`}
              >
                <Wand2 className="w-3 h-3" /> AI Chat
              </button>
            </div>
            <div className="w-6"></div> {/* Spacer to keep title centered */}
          </div>

          {/* Status Feedback */}
          {status === 'success' && (
            <div className="flex items-center justify-center gap-2 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Transaction saved!
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center justify-center gap-2 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-500 font-bold text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              {errorMessage}
            </div>
          )}
          {/* Main Content Area */}
          {entryMode === 'CHAT' ? (
            <div className="flex-1 overflow-hidden">
               <AIChatEntry 
                 accounts={accounts} 
                 tags={tags} 
                 onSave={(tx) => {
                   handleSaveManual(tx);
                 }} 
               />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto w-full px-4 pt-2 pb-24 space-y-1 scrollbar-hide no-scrollbar">
                
                {/* 1. Hero Card: Consolidates Flow, Amount, and Bank */}
                <div className="bg-[#F7F7F7] dark:bg-[#111111] rounded-2xl border border-[#EBEBEB] dark:border-white/5 p-1 flex flex-col gap-1.5 shadow-sm">
                  {/* Top Row: Full-width Type Toggle */}
                  <div className="flex bg-[#F7F7F7] dark:bg-white/5 p-0.5 rounded-2xl w-full shrink-0">
                    <button onClick={() => setType('DEBIT')} className={`flex-1 py-1 text-[10px] font-bold rounded-xl transition-all uppercase tracking-[0.1em] ${type === 'DEBIT' ? 'bg-white dark:bg-[#2C2C34] text-brand-red shadow-sm' : 'text-neutral-400'}`}>Outflow</button>
                    <button onClick={() => setType('CREDIT')} className={`flex-1 py-1 text-[10px] font-bold rounded-xl transition-all uppercase tracking-[0.1em] ${type === 'CREDIT' ? 'bg-white dark:bg-[#2C2C34] text-brand-green shadow-sm' : 'text-neutral-400'}`}>Inflow</button>
                    <button onClick={() => setType('TRANSFER')} className={`flex-1 py-1 text-[10px] font-bold rounded-xl transition-all uppercase tracking-[0.1em] ${type === 'TRANSFER' ? 'bg-white dark:bg-[#2C2C34] text-brand-blue dark:text-brand-cyan shadow-sm' : 'text-neutral-400'}`}>Transfer</button>
                  </div>

                  {/* Middle Row: Split 50/50 (Amount Left, Bank Right) */}
                  <div className="grid grid-cols-2 gap-2 items-center h-[80px]">
                    {/* LEFT: Amount Segment */}
                    <div className="flex flex-col items-center gap-1 border-r border-[#EBEBEB] dark:border-white/5 pr-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-neutral-300 dark:text-[#333333]">₹</span>
                        <input 
                          type="number" inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" step="0.01"
                          className="bg-transparent text-xl font-heading font-bold text-center outline-none min-w-0 w-full text-brand-blue dark:text-white tracking-tight caret-brand-cyan"
                        />
                      </div>
                      <div className="relative">
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F7F7F7] dark:bg-white/5 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
                          <Calendar className="w-2.5 h-2.5" />
                          <span className="text-[8px] font-bold uppercase tracking-wider">{format(new Date(transactionDate), 'dd MMM, hh:mm a')}</span>
                        </div>
                        <input type="datetime-local" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                      </div>
                    </div>

                    {/* RIGHT: Compact Account Selector */}
                    <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar max-h-full">
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
                                if ((acc as any).type === 'CASH') setPaymentMethod('Cash');
                                else if ((acc as any).type === 'CREDIT_CARD') setPaymentMethod('Credit Card');
                                else if (paymentMethod === 'Cash' || paymentMethod === 'Credit Card') setPaymentMethod('Bank');
                              }
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl border transition-all relative ${selectedAccountId === acc.id || toAccountId === acc.id ? 'bg-brand-blue/5 dark:bg-brand-cyan/5 border-brand-blue dark:border-brand-cyan shadow-sm' : 'bg-[#F7F7F7] dark:bg-white/[0.02] border-transparent'}`}
                        >
                          {selectedAccountId === acc.id && type === 'TRANSFER' && <div className="absolute -top-1 right-1 bg-brand-blue text-white text-[5px] font-bold px-1 py-0.5 rounded-full uppercase tracking-tighter">F</div>}
                          {toAccountId === acc.id && type === 'TRANSFER' && <div className="absolute -top-1 right-1 bg-brand-cyan text-brand-blue text-[5px] font-bold px-1 py-0.5 rounded-full uppercase tracking-tighter">T</div>}
                          <div className="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center p-0.5 shadow-sm shrink-0"><BankLogo bankName={acc.bankName} type={(acc as any).type} className="w-full h-full" /></div>
                          <span className={`text-[9px] font-bold truncate ${(selectedAccountId === acc.id || toAccountId === acc.id) ? 'text-brand-blue dark:text-brand-cyan' : 'text-neutral-500 dark:text-[#A0A0A5]'}`}>{acc.bankName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Classification Tags — Right after Amount */}
                {type !== 'TRANSFER' && tags.length > 0 && (
                  <div className="flex flex-col gap-1 px-1">
                    <label className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest pl-1">Classification Tag</label>
                    <div className="flex flex-wrap gap-2 w-full">
                      {tags.map(tagName => (
                        <button 
                          key={tagName} 
                          onClick={() => setExpenseType(expenseType === tagName ? '' : tagName)} 
                          className={`flex-[1_0_21%] sm:flex-none sm:px-3 py-1.5 rounded-xl text-[9px] font-bold transition-all border ${
                            expenseType === tagName 
                              ? 'bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue border-transparent shadow-sm' 
                              : 'bg-white dark:bg-[#111111] dark:bg-white/[0.02] border-[#EBEBEB] dark:border-white/5 text-neutral-400 dark:text-neutral-500'
                          }`}
                        >
                          #{tagName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Recipient & Remark Card */}
                <div className="bg-[#F7F7F7] dark:bg-[#111111] rounded-2xl border border-[#EBEBEB] dark:border-white/5 p-0 shadow-sm divide-y divide-[#EBEBEB] dark:divide-white/5 mx-1">
                  {type !== 'TRANSFER' && (
                    <div className="flex items-center gap-2.5 px-3 py-1.5 group">
                      <User className="w-3.5 h-3.5 text-neutral-400 dark:text-[#555555]" />
                      <input type="text" value={partyName} onChange={e => setPartyName(e.target.value)} placeholder={type === 'DEBIT' ? 'Payee…' : 'Source…'} className="bg-transparent flex-1 text-xs font-bold text-brand-blue dark:text-white outline-none placeholder:text-neutral-300 dark:placeholder:text-[#333333]" />
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 px-3 py-1.5 group">
                    <AlignLeft className="w-3.5 h-3.5 text-neutral-400 dark:text-[#555555]" />
                    <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Add specific details…" className="bg-transparent flex-1 text-xs font-bold text-brand-blue dark:text-white outline-none placeholder:text-neutral-300 dark:placeholder:text-[#333333]" />
                  </div>
                </div>

                {/* 5. Category Grid — Integrated */}
                <div className="bg-[#F7F7F7] dark:bg-[#111111] rounded-2xl border border-[#EBEBEB] dark:border-white/5 p-2 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Choose Category</span>
                    <span className="text-[10px] font-bold text-brand-blue dark:text-brand-cyan px-2 py-0.5 bg-brand-blue/5 dark:bg-brand-cyan/5 rounded-full lowercase tracking-wider">{category}</span>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    {CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setCategory(cat)} title={cat} className={`aspect-square rounded-lg flex items-center justify-center text-[16px] transition-all ${category === cat ? 'bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue shadow-lg scale-110' : 'bg-[#F7F7F7] dark:bg-white/[0.02] text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10 active:scale-95'}`}>{CATEGORY_ICONS[cat] || '📝'}</button>
                    ))}
                  </div>
                </div>

                {/* 6. Payment Method — Intelligence Layer */}
                <div className="bg-[#F7F7F7] dark:bg-[#111111] rounded-2xl border border-[#EBEBEB] dark:border-white/5 p-2 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Payment Logistics</span>
                    <span className="text-[10px] font-bold text-brand-blue dark:text-brand-cyan px-2 py-0.5 bg-brand-blue/5 dark:bg-brand-cyan/5 rounded-full lowercase tracking-wider">{paymentMethod}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'UPI', label: 'UPI', icon: <Smartphone className="w-3 h-3" /> },
                      { id: 'Bank Transfer', label: 'Bank', icon: <Landmark className="w-3 h-3" /> },
                      { id: 'Credit Card', label: 'Card', icon: <CreditCard className="w-3 h-3" /> },
                      { id: 'Cash', label: 'Cash', icon: <Coins className="w-3 h-3" /> },
                    ].map((method) => (
                      <button key={method.id} onClick={() => setPaymentMethod(method.id as any)} className={`flex items-center justify-center gap-1 py-1.5 rounded-xl border transition-all ${paymentMethod === method.id ? 'bg-brand-blue dark:bg-brand-cyan border-brand-blue dark:border-brand-cyan text-white dark:text-brand-blue shadow-md' : 'bg-[#F7F7F7] dark:bg-white/[0.02] border-transparent text-neutral-400'}`}>
                        {method.icon}
                        <span className="text-[8px] font-bold uppercase tracking-tighter">{method.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Contextual Sub-Selection */}
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    {paymentMethod === 'UPI' && (
                      <div className="flex gap-2">
                        {['GPay', 'PhonePe', 'Paytm'].map(app => (
                          <button key={app} onClick={() => setUpiApp(app)} className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all border ${upiApp === app ? 'bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue border-transparent' : 'bg-neutral-50 dark:bg-white/[0.02] border-neutral-100 dark:border-white/5 text-neutral-400'}`}>{app}</button>
                        ))}
                      </div>
                    )}
                    {paymentMethod === 'Credit Card' && (
                      <div className="flex flex-wrap gap-1.5">
                        {accounts.filter(a => (a as any).type === 'CREDIT_CARD').map(card => (
                          <button key={card.id} onClick={() => setSelectedAccountId(card.id!)} className={`px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase transition-all border ${selectedAccountId === card.id ? 'bg-brand-blue text-white border-transparent' : 'bg-neutral-50 dark:bg-white/5 border-neutral-100 dark:border-white/5 text-neutral-400'}`}>{card.bankName}</button>
                        ))}
                      </div>
                    )}
                    {paymentMethod === 'Cash' && (
                      <div className="flex flex-wrap gap-1.5">
                        {accounts.filter(a => (a as any).type === 'CASH').map(wallet => (
                          <button key={wallet.id} onClick={() => setSelectedAccountId(wallet.id!)} className={`px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase transition-all border ${selectedAccountId === wallet.id ? 'bg-brand-blue text-white border-transparent' : 'bg-neutral-50 dark:bg-white/5 border-neutral-100 dark:border-white/5 text-neutral-400'}`}>{wallet.bankName}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {status === 'error' && <div className="px-5 py-2 rounded-2xl bg-rose-50 dark:bg-brand-red/10 text-brand-red text-center text-[10px] font-bold uppercase tracking-wider">{errorMessage}</div>}
              </div>

              {/* Persistent Action Bar — Fixed Bottom Optimized */}
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-t border-[#EBEBEB] dark:border-white/5 z-50 flex justify-end items-center gap-3">
                <button 
                  onClick={handleSaveManual}
                  disabled={!amount || !type || !selectedAccountId || (type !== 'TRANSFER' && !expenseType) || (type === 'TRANSFER' && !toAccountId) || (paymentMethod === 'UPI' && !upiApp) || status === 'success'}
                  className={`px-8 py-2.5 rounded-2xl text-[10px] font-black transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-2 uppercase tracking-widest ${
                    (!amount || !type || !selectedAccountId || (type !== 'TRANSFER' && !expenseType) || (type === 'TRANSFER' && !toAccountId) || (paymentMethod === 'UPI' && !upiApp))
                    ? 'bg-neutral-100 dark:bg-[#1C1C22] text-neutral-300 dark:text-[#4A4A52] cursor-not-allowed border border-[#EBEBEB] dark:border-transparent opacity-50'
                    : 'bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue shadow-brand-blue/30 dark:shadow-brand-cyan/20'
                  }`}
                >
                  {status === 'success' ? (
                    <> <CheckCircle2 className="w-4 h-4" /> SAVED </>
                  ) : (
                    <> <Save className="w-4 h-4 text-current opacity-60" /> SAVE ENTRY </>
                  )}
                </button>
                <button onClick={() => setEntryMode('CHAT')} className="w-11 h-11 bg-brand-blue/5 dark:bg-brand-cyan/5 text-brand-blue dark:text-brand-cyan rounded-2xl flex items-center justify-center border border-brand-blue/10 dark:border-brand-cyan/10 transition-all active:scale-90 shadow-sm">
                   <Wand2 className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
