import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, X, AlertCircle, CheckCircle2, Search, ChevronDown, Landmark, Smartphone, ArrowLeft, Calendar, Clock, Calculator, MoreHorizontal, User, AlignLeft, Hash, Paperclip, Save, ChevronRight, CreditCard, Coins, PlaneTakeoff, Eye, EyeOff, Wand2 } from 'lucide-react';

import { format, startOfMonth, startOfYear, isToday, isYesterday, startOfDay } from 'date-fns';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';

import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';



import { useAuth } from '../context/AuthContext';
import { AIChatEntry } from '../components/AIChatEntry';
import { IndusIndLogo } from '../components/IndusIndLogo';
import { UnionBankLogo } from '../components/UnionBankLogo';
import { BankLogo } from '../components/BankLogo';

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const accounts = useLiveQuery(() => db.accounts.toArray(), [user?.uid]) || [];
  const transactions = useLiveQuery(() => db.transactions.orderBy('dateTime').reverse().limit(5).toArray(), [user?.uid]) || [];




  const [isAddingManual, setIsAddingManual] = useState(searchParams.get('add') === 'true');

  // Sync state with URL and ensure fresh current time on open
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      db.transactions.get(Number(editId)).then(tx => {
        if (tx) {
          setAmount(tx.amount.toString());
          setType(tx.type);
          setCategory(tx.category || 'Other');
          setNote(tx.note || '');
          setPartyName(tx.party || '');
          setSelectedAccountId(tx.accountId);
          setTransactionDate(format(new Date(tx.dateTime), "yyyy-MM-dd'T'HH:mm"));
          setPaymentMethod(tx.paymentMethod as any || 'UPI');
          setUpiApp((tx as any).upiApp || 'GPay');
          setExpenseType(tx.expenseType || '');
          setEntryMode('MANUAL');
          setIsAddingManual(true);
          setEditingTransactionId(Number(editId));
        }
      });
    } else if (searchParams.get('add') === 'true') {
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
    setEditingTransactionId(null);
    if (searchParams.get('add') || searchParams.get('edit')) {
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
  const [entryMode, setEntryMode] = useState<'MANUAL' | 'CHAT'>('CHAT');
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);

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
  const [isSaving, setIsSaving] = useState(false);
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

    setIsSaving(true);
    setStatus('idle');
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
          expenseType: currentExpenseType
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
          expenseType: currentExpenseType
        });
      } else {
        const isTodaySelected = format(new Date(currentTransactionDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        const finalDateTime = isTodaySelected ? new Date() : new Date(currentTransactionDate);

        const txPayload = {
          accountId: Number(currentSelectedAccountId),
          amount: parseFloat(currentAmount.toString().replace(/,/g, '')) || 0,
          type: currentType as 'CREDIT' | 'DEBIT',
          dateTime: finalDateTime,
          note: currentNote || '',
          category: currentCategory,
          paymentMethod: currentPaymentMethod,
          upiApp: currentPaymentMethod === 'UPI' ? currentUpiApp : undefined,
          party: currentPartyName,
          expenseType: currentExpenseType
        };

        if (editingTransactionId) {
          await db.transactions.update(editingTransactionId, txPayload);
        } else {
          await db.transactions.add(txPayload as any);
        }
        

      }
      
      setIsSaving(false);
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
        setEditingTransactionId(null);
      }, 800);
    } catch (error) {
      setIsSaving(false);
      setStatus('error');
      setErrorMessage('Failed to save transaction.');
      console.error(error);
    }
  };

  const monthlyClosings = useLiveQuery(() => db.monthlyClosings.orderBy('month').reverse().toArray(), [user?.uid]) || [];
  const allClosings = useLiveQuery(() => db.accountClosings.toArray(), [user?.uid]) || [];

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
  }, [timeFilter, user?.uid]) || { balances: [], totalIncome: 0, totalSpending: 0, totalWealth: 0 };
  
  const monthDelta = totalIncome - totalSpending;
  const totalBalance = balances.reduce((sum, acc) => sum + acc.currentBalance, 0);

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, typeof balances> = {
      'BANK': [],
      'CASH': [],
      'CREDIT_CARD': []
    };
    balances.forEach(acc => {
      const type = (acc as any).type || 'BANK';
      if (!groups[type]) groups[type] = [];
      groups[type].push(acc);
    });
    return groups;
  }, [balances]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const renderAccountItem = (acc: any) => (
    <div 
      key={acc.id} 
      className="p-3 mb-1.5 rounded-2xl flex items-center justify-between bg-white/50 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.08] transition-all group cursor-pointer border border-transparent hover:border-brand-blue/5 dark:hover:border-white/5 shadow-sm active:scale-[0.99]" 
      onClick={() => navigate('/accounts')}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-white dark:bg-neutral-800 rounded-xl flex items-center justify-center overflow-hidden p-1 shadow-sm border border-[#EBEBEB] dark:border-white/10 shrink-0 group-hover:scale-105 transition-transform">
          <BankLogo bankName={acc.bankName} type={acc.type} className="w-full h-full" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-xs text-[#111111] dark:text-[#F7F7F7] truncate tracking-tight">{acc.bankName}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest">
              {acc.type === 'CASH' ? 'Liquid' : `**** ${acc.accountLast4}`}
            </span>
            {acc.currentBalance < 1000 && acc.type !== 'CREDIT_CARD' && (
              <span className="w-1 h-1 rounded-full bg-brand-red animate-pulse"></span>
            )}

          </div>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-heading font-black text-sm tracking-tighter ${acc.currentBalance < 0 ? 'text-brand-red' : 'text-brand-green'} dark:text-brand-cyan`}>
          ₹{acc.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
        </p>
        <p className="text-[7px] font-black text-neutral-400 uppercase tracking-widest leading-none mt-0.5">Balance</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Greeting Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-[#1A237E]/40 dark:text-[#777777] tracking-[0.2em] uppercase">{greeting},</p>
          <h1 className="text-2xl font-heading font-black text-[#1A237E] dark:text-[#F7F7F7] leading-tight tracking-tight">{user?.displayName || 'Guest User'} 👋</h1>
        </div>

        <div className="flex items-center gap-3">
          <div
            title={user?.displayName || 'Guest User'}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1A237E] to-[#4A4ABF] flex items-center justify-center text-white select-none shadow-lg cursor-pointer border-2 border-white dark:border-[#1A1A1E]"
          >
            {user?.displayName ? (
              <span className="font-black text-sm">{user.displayName[0].toUpperCase()}</span>
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
        </div>
      </div>

      {/* Cash Flow Hero Card - REDUCED SIZE */}
      <div 
        className="relative overflow-hidden rounded-[24px] bg-[#F4F7FF] dark:bg-[#0C0C0F] p-4 shadow-sm border border-brand-blue/5 dark:border-white/5 group"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between mb-4">
          <h2 className="text-[9px] font-black text-brand-blue/40 dark:text-white/30 tracking-[0.2em] uppercase">Cash Flow</h2>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="appearance-none bg-white dark:bg-[#1A1A1A] text-brand-blue/60 dark:text-white/70 text-[8px] font-black uppercase tracking-[0.1em] px-2.5 py-1 rounded-lg pr-6 cursor-pointer outline-none transition-colors border border-brand-blue/5"
            >
              <option value="This Month">This Month</option>
              <option value="This Year">This Year</option>
              <option value="All Time">All Time</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-blue/20 pointer-events-none" />
          </div>
        </div>

        <div className="relative z-10 flex justify-between items-center mb-5 px-1">
          <div className="flex-1">
            <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest mb-1">Outflow</p>
            <p className="text-xl font-heading font-black text-brand-blue dark:text-white tracking-tighter">
              ₹{totalSpending.toLocaleString('en-IN')}
            </p>
          </div>
          
          <div className="w-px h-8 bg-brand-blue/5 dark:bg-white/5 mx-4"></div>

          <div className="flex-1">
            <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-1">Inflow</p>
            <p className="text-xl font-heading font-black text-brand-blue dark:text-white tracking-tighter">
              ₹{totalIncome.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div className="relative z-10 bg-white/40 dark:bg-white/5 border border-white dark:border-white/5 rounded-2xl p-3 flex justify-between items-center backdrop-blur-sm">
          <div className="flex flex-col">
            <p className="text-[8px] font-black text-brand-blue/30 dark:text-white/20 uppercase tracking-widest leading-none mb-1">Total Liquidity</p>
            {timeFilter !== 'All Time' && (
              <p className={`text-[8px] font-bold ${monthDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'} uppercase tracking-tight`}>
                {monthDelta >= 0 ? '↑' : '↓'} ₹{Math.abs(monthDelta).toLocaleString('en-IN')}
              </p>
            )}
          </div>
          <p className={`text-lg font-heading font-black tracking-tighter text-brand-blue dark:text-brand-cyan`}>
            ₹{totalWealth.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Improved Partitioned Portfolio */}
      <div className="space-y-4 mb-10">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-heading font-black text-brand-blue dark:text-white uppercase tracking-tight flex items-center gap-2">
            Portfolio <span className="w-1.5 h-1.5 rounded-full bg-brand-green"></span>
          </h2>
          <Link to="/accounts" className="text-[10px] font-black text-brand-green bg-brand-green/5 px-2.5 py-1 rounded-lg uppercase tracking-widest hover:bg-brand-green/10 transition-all">Manage All</Link>
        </div>

        {balances.length === 0 ? (
          <div className="bg-white dark:bg-[#0C0C0F] p-8 text-center text-neutral-400 text-xs font-bold uppercase tracking-widest rounded-3xl border border-dashed border-neutral-200 dark:border-white/5">No accounts discovered</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {/* Bank Category Card */}
            {groupedAccounts['BANK'].length > 0 && (
              <div className="bg-[#F8F9FF] dark:bg-[#0C0C0F] rounded-[28px] p-1 border border-brand-blue/5 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="px-4 py-3 flex justify-between items-center bg-white/40 dark:bg-white/[0.02] rounded-[24px] mb-1">
                   <div className="flex items-center gap-2.5">
                     <div className="w-6 h-6 rounded-lg bg-brand-blue/5 dark:bg-brand-blue/10 flex items-center justify-center">
                       <Landmark className="w-3.5 h-3.5 text-brand-blue dark:text-brand-cyan" />
                     </div>
                     <span className="text-[10px] font-black text-brand-blue/60 dark:text-white/40 uppercase tracking-[0.2em]">Checking & Savings</span>
                   </div>
                   <span className="text-xs font-heading font-black text-brand-blue dark:text-white tracking-tighter">
                     ₹{groupedAccounts['BANK'].reduce((sum, a) => sum + (a.currentBalance || 0), 0).toLocaleString('en-IN')}
                   </span>
                </div>
                <div className="px-1 pb-1">
                  {groupedAccounts['BANK'].map(renderAccountItem)}
                </div>
              </div>
            )}

            {/* Credit Cards & Liabilites Card */}
            {groupedAccounts['CREDIT_CARD'].length > 0 && (
              <div className="bg-[#FFF8F8] dark:bg-[#0C0C0F] rounded-[28px] p-1 border border-brand-red/5 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="px-4 py-3 flex justify-between items-center bg-white/40 dark:bg-white/[0.02] rounded-[24px] mb-1">
                   <div className="flex items-center gap-2.5">
                     <div className="w-6 h-6 rounded-lg bg-rose-500/5 dark:bg-rose-500/10 flex items-center justify-center">
                       <CreditCard className="w-3.5 h-3.5 text-rose-500" />
                     </div>
                     <span className="text-[10px] font-black text-rose-500/60 dark:text-rose-500/40 uppercase tracking-[0.2em]">Credit Lines</span>
                   </div>
                   <span className="text-xs font-heading font-black text-rose-500 dark:text-rose-400 tracking-tighter">
                     ₹{groupedAccounts['CREDIT_CARD'].reduce((sum, a) => sum + (a.currentBalance || 0), 0).toLocaleString('en-IN')}
                   </span>
                </div>
                <div className="px-1 pb-1">
                  {groupedAccounts['CREDIT_CARD'].map(renderAccountItem)}
                </div>
              </div>
            )}

            {/* Cash Wallets Card */}
            {groupedAccounts['CASH'].length > 0 && (
              <div className="bg-[#F8FFF9] dark:bg-[#0C0C0F] rounded-[28px] p-1 border border-brand-green/5 dark:border-white/5 shadow-sm overflow-hidden">
                <div className="px-4 py-3 flex justify-between items-center bg-white/40 dark:bg-white/[0.02] rounded-[24px] mb-1">
                   <div className="flex items-center gap-2.5">
                     <div className="w-6 h-6 rounded-lg bg-brand-green/5 dark:bg-brand-green/10 flex items-center justify-center">
                       <Coins className="w-3.5 h-3.5 text-brand-green" />
                     </div>
                     <span className="text-[10px] font-black text-brand-green/60 dark:text-brand-green/40 uppercase tracking-[0.2em]">Cash & Wallets</span>
                   </div>
                   <span className="text-xs font-heading font-black text-brand-green dark:text-brand-green tracking-tighter">
                     ₹{groupedAccounts['CASH'].reduce((sum, a) => sum + (a.currentBalance || 0), 0).toLocaleString('en-IN')}
                   </span>
                </div>
                <div className="px-1 pb-1">
                  {groupedAccounts['CASH'].map(renderAccountItem)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Entry Modal - Full Screen Restored */}
      {isAddingManual && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white dark:bg-[#0C0C0F] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden font-sans">
          <div className="flex-1 flex flex-col overflow-hidden">
          {/* Elegant Header — More compact */}
          <div className="flex items-center justify-between px-3 py-1.5 pt-safe-top bg-white dark:bg-[#111111] border-b border-[#EBEBEB] dark:border-white/5 shadow-sm z-20">
            <button onClick={closeMenu} className="text-[#717171] dark:text-[#A0A0A5] hover:text-brand-blue dark:hover:text-brand-cyan transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
            <div className="flex bg-[#F7F7F7] dark:bg-white/5 p-0.5 rounded-xl border border-[#EBEBEB] dark:border-white/5">
              <button 
                onClick={() => setEntryMode('MANUAL')}
                className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${entryMode === 'MANUAL' ? 'bg-white dark:bg-white/10 text-brand-green dark:text-brand-green shadow-sm' : 'text-neutral-400'}`}
              >
                Manual
              </button>
              <button 
                onClick={() => setEntryMode('CHAT')}
                className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all flex items-center gap-1.5 ${entryMode === 'CHAT' ? 'bg-white dark:bg-white/10 text-brand-green dark:text-brand-green shadow-sm' : 'text-neutral-400'}`}
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
                 isSaving={isSaving}
                 showSuccess={status === 'success'}
                 onSave={(tx) => {
                   handleSaveManual(tx);
                 }} 
               />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto w-full px-4 pt-4 pb-24 space-y-2 scrollbar-hide no-scrollbar">
                
                {/* 1. Hero Card: Consolidates Flow, Amount, and Bank */}
                <div className="bg-[#F9FBFF] dark:bg-[#111111] rounded-2xl border border-brand-blue/5 dark:border-white/5 p-1 flex flex-col gap-1.5 shadow-sm">
                  {/* Top Row: Full-width Type Toggle */}
                  <div className="flex bg-[#F9FBFF] dark:bg-white/5 p-0.5 rounded-2xl w-full shrink-0">
                    <button onClick={() => setType('DEBIT')} className={`flex-1 py-1 text-[10px] font-bold rounded-xl transition-all uppercase tracking-[0.1em] ${type === 'DEBIT' ? 'bg-white dark:bg-[#2C2C34] text-brand-red shadow-sm' : 'text-neutral-400'}`}>Outflow</button>
                    <button onClick={() => setType('CREDIT')} className={`flex-1 py-1 text-[10px] font-bold rounded-xl transition-all uppercase tracking-[0.1em] ${type === 'CREDIT' ? 'bg-white dark:bg-[#2C2C34] text-brand-green shadow-sm' : 'text-neutral-400'}`}>Inflow</button>
                    <button onClick={() => setType('TRANSFER')} className={`flex-1 py-1 text-[10px] font-bold rounded-xl transition-all uppercase tracking-[0.1em] ${type === 'TRANSFER' ? 'bg-white dark:bg-[#2C2C34] text-brand-green shadow-sm' : 'text-neutral-400'}`}>Transfer</button>
                  </div>

                  {/* Middle Row: Split 50/50 (Amount Left, Bank Right) */}
                  <div className="grid grid-cols-2 gap-2 items-center h-[90px]">
                    {/* LEFT: Amount Segment */}
                    <div className="flex flex-col items-center gap-1 border-r border-[#EBEBEB] dark:border-white/5 pr-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-neutral-300 dark:text-[#333333]">₹</span>
                        <input 
                          type="number" inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" step="0.01"
                          className="bg-transparent text-xl font-heading font-bold text-center outline-none min-w-0 w-full text-brand-green dark:text-white tracking-tight caret-brand-green"
                        />
                      </div>
                      <div className="relative">
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F9FBFF] dark:bg-white/5 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
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
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl border transition-all relative ${selectedAccountId === acc.id || toAccountId === acc.id ? 'bg-brand-green/5 dark:bg-brand-green/5 border-brand-green dark:border-brand-green shadow-sm' : 'bg-[#F9FBFF] dark:bg-white/[0.02] border-transparent'}`}
                        >
                          {selectedAccountId === acc.id && type === 'TRANSFER' && <div className="absolute -top-1 right-1 bg-brand-green text-white text-[5px] font-bold px-1 py-0.5 rounded-full uppercase tracking-tighter">F</div>}
                          {toAccountId === acc.id && type === 'TRANSFER' && <div className="absolute -top-1 right-1 bg-brand-cyan text-brand-blue text-[5px] font-bold px-1 py-0.5 rounded-full uppercase tracking-tighter">T</div>}
                          <div className="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center p-0.5 shadow-sm shrink-0"><BankLogo bankName={acc.bankName} type={(acc as any).type} className="w-full h-full" /></div>
                          <span className={`text-[9px] font-bold truncate ${(selectedAccountId === acc.id || toAccountId === acc.id) ? 'text-brand-green dark:text-brand-green' : 'text-neutral-500 dark:text-[#A0A0A5]'}`}>{acc.bankName}</span>
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
                              ? 'bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue border-transparent shadow-sm' 
                              : 'bg-[#F9FBFF] dark:bg-[#111111] dark:bg-white/[0.02] border-[#EBEBEB] dark:border-white/5 text-neutral-400 dark:text-neutral-500'
                          }`}
                        >
                          #{tagName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Recipient & Remark Card */}
                <div className="bg-[#F9FBFF] dark:bg-[#111111] rounded-2xl border border-brand-blue/5 dark:border-white/5 p-0 shadow-sm divide-y divide-[#EBEBEB] dark:divide-white/5 mx-1">
                  {type !== 'TRANSFER' && (
                    <div className="flex items-center gap-4 px-4 py-5 group">
                      <User className="w-5 h-5 text-neutral-400 dark:text-[#555555]" />
                      <input type="text" value={partyName} onChange={e => setPartyName(e.target.value)} placeholder={type === 'DEBIT' ? 'Payee…' : 'Source…'} className="bg-transparent flex-1 text-base font-bold text-brand-green dark:text-white outline-none placeholder:text-neutral-300 dark:placeholder:text-[#333333]" />
                    </div>
                  )}
                  <div className="flex items-center gap-4 px-4 py-5 group">
                    <AlignLeft className="w-5 h-5 text-neutral-400 dark:text-[#555555]" />
                    <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Add specific details…" className="bg-transparent flex-1 text-base font-bold text-brand-green dark:text-white outline-none placeholder:text-neutral-300 dark:placeholder:text-[#333333]" />
                  </div>
                </div>

                {/* 5. Category Grid — Integrated */}
                <div className="bg-[#F9FBFF] dark:bg-[#111111] rounded-2xl border border-brand-blue/5 dark:border-white/5 p-2 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Choose Category</span>
                    <span className="text-[10px] font-bold text-brand-green dark:text-brand-green px-2 py-0.5 bg-brand-green/5 dark:bg-brand-green/5 rounded-full lowercase tracking-wider">{category}</span>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    {CATEGORIES.map(cat => (
                      <button key={cat} onClick={() => setCategory(cat)} title={cat} className={`aspect-square rounded-lg flex items-center justify-center text-[18px] transition-all ${category === cat ? 'bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue shadow-lg scale-110' : 'bg-[#F9FBFF] dark:bg-white/[0.02] text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10 active:scale-95'}`}>{CATEGORY_ICONS[cat] || '📝'}</button>
                    ))}
                  </div>
                </div>

                {/* 6. Payment Method — Intelligence Layer */}
                <div className="bg-[#F9FBFF] dark:bg-[#111111] rounded-2xl border border-brand-blue/5 dark:border-white/5 p-2 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Payment Logistics</span>
                    <span className="text-[10px] font-bold text-brand-green dark:text-brand-green px-2 py-0.5 bg-brand-green/5 dark:bg-brand-green/5 rounded-full lowercase tracking-wider">{paymentMethod}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'UPI', label: 'UPI', icon: <Smartphone className="w-3 h-3" /> },
                      { id: 'Bank Transfer', label: 'Bank', icon: <Landmark className="w-3 h-3" /> },
                      { id: 'Credit Card', label: 'Card', icon: <CreditCard className="w-3 h-3" /> },
                      { id: 'Cash', label: 'Cash', icon: <Coins className="w-3 h-3" /> },
                    ].map((method) => (
                      <button key={method.id} onClick={() => setPaymentMethod(method.id as any)} className={`flex items-center justify-center gap-1 py-1.5 rounded-xl border transition-all ${paymentMethod === method.id ? 'bg-brand-green dark:bg-brand-green border-brand-green dark:border-brand-green text-white dark:text-brand-blue shadow-md' : 'bg-[#F9FBFF] dark:bg-white/[0.02] border-transparent text-neutral-400'}`}>
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
                          <button key={app} onClick={() => setUpiApp(app)} className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all border ${upiApp === app ? 'bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue border-transparent' : 'bg-neutral-50 dark:bg-white/[0.02] border-neutral-100 dark:border-white/5 text-neutral-400'}`}>{app}</button>
                        ))}
                      </div>
                    )}
                    {paymentMethod === 'Credit Card' && (
                      <div className="flex flex-wrap gap-1.5">
                        {accounts.filter(a => (a as any).type === 'CREDIT_CARD').map(card => (
                          <button key={card.id} onClick={() => setSelectedAccountId(card.id!)} className={`px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase transition-all border ${selectedAccountId === card.id ? 'bg-brand-green text-white border-transparent' : 'bg-neutral-50 dark:bg-white/5 border-neutral-100 dark:border-white/5 text-neutral-400'}`}>{card.bankName}</button>
                        ))}
                      </div>
                    )}
                    {paymentMethod === 'Cash' && (
                      <div className="flex flex-wrap gap-1.5">
                        {accounts.filter(a => (a as any).type === 'CASH').map(wallet => (
                          <button key={wallet.id} onClick={() => setSelectedAccountId(wallet.id!)} className={`px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase transition-all border ${selectedAccountId === wallet.id ? 'bg-brand-green text-white border-transparent' : 'bg-neutral-50 dark:bg-white/5 border-neutral-100 dark:border-white/5 text-neutral-400'}`}>{wallet.bankName}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Low Balance Warning */}
                {type === 'DEBIT' && amount && parseFloat(amount.toString().replace(/,/g, '')) > (balances.find(a => a.id === selectedAccountId)?.currentBalance || 0) && (
                  <div className="flex items-center gap-1.5 text-brand-red animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Low Balance Warning</span>
                  </div>
                )}
              </div>

              {/* Persistent Action Bar — Fixed Bottom Optimized */}
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-t border-[#EBEBEB] dark:border-white/5 z-50 flex justify-end items-center gap-3">
                <button 
                  onClick={handleSaveManual}
                  disabled={!amount || !type || !selectedAccountId || (type !== 'TRANSFER' && !expenseType) || (type === 'TRANSFER' && !toAccountId) || (paymentMethod === 'UPI' && !upiApp) || isSaving || status === 'success'}
                  className={`px-8 py-2.5 rounded-2xl text-[10px] font-black transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-2 uppercase tracking-widest ${
                    (!amount || !type || !selectedAccountId || (type !== 'TRANSFER' && !expenseType) || (type === 'TRANSFER' && !toAccountId) || (paymentMethod === 'UPI' && !upiApp))
                    ? 'bg-neutral-100 dark:bg-[#1C1C22] text-neutral-300 dark:text-[#4A4A52] cursor-not-allowed border border-[#EBEBEB] dark:border-transparent opacity-50'
                    : (status === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue shadow-brand-green/30 dark:shadow-brand-green/20')
                  } disabled:opacity-70`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>SAVING...</span>
                    </>
                  ) : status === 'success' ? (
                    <> <CheckCircle2 className="w-4 h-4" /> SAVED </>
                  ) : (
                    <> <Save className="w-4 h-4 text-current opacity-60" /> SAVE ENTRY </>
                  )}
                </button>
                <button onClick={() => setEntryMode('CHAT')} className="w-11 h-11 bg-brand-green/5 dark:bg-brand-green/5 text-brand-green dark:text-brand-green rounded-2xl flex items-center justify-center border border-brand-green/10 dark:border-brand-green/10 transition-all active:scale-90 shadow-sm">
                   <Wand2 className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
