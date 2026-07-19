import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction, normalizeType } from '../models/db';
import { Plus, Trash2, Pencil, ArrowDownLeft, ArrowUpRight, Wallet, CreditCard, Landmark, Download, FileText, CheckCircle2, History, Calendar, ChevronDown, Printer, MoreHorizontal, Scissors, Filter, Search, ArrowUpDown, ArrowRightLeft, X } from 'lucide-react';
import { BankLogo } from '../components/BankLogo';
import { INDIAN_BANKS, getBankByPattern } from '../components/BankLogosData';
import { format, startOfDay, parseISO, endOfMonth, startOfMonth, subMonths, endOfDay, startOfWeek, endOfWeek, startOfYear, endOfYear, addMonths, subWeeks, addWeeks, subDays, addDays, subYears, addYears } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Reorder, motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useCurrency, useCurrencyFormatter } from '../hooks/useCurrency';
import { cn } from '../logic/utils';

export default function Accounts() {
  const { currency, hideDecimals, formatAmount } = useCurrencyFormatter();
  const { user } = useAuth();
  const navigate = useNavigate();
  const accounts = useLiveQuery(async () => {
    const arr = await db.accounts.toArray();
    return [...arr].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [user?.uid]) || [];
  const userSettings = useLiveQuery(() => db.userSettings.toArray(), [user?.uid]) || [];
  const isPrivacyMode = userSettings.find(s => s.key === 'privacy_mode')?.value === true;
  const [revealBalances, setRevealBalances] = useState(false);
  const shouldBlur = isPrivacyMode && !revealBalances;
  const [isAdding, setIsAdding] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [startingBalanceDate, setStartingBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountType, setAccountType] = useState<'BANK' | 'CASH' | 'CREDIT_CARD'>('BANK');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDate, setStatementDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const isSectionCollapsed = (type: string, index: number) => {
    if (collapsedSections[type] !== undefined) {
      return collapsedSections[type];
    }
    return index !== 0;
  };

  const toggleSection = (type: string, index: number) => {
    setCollapsedSections(prev => ({
      ...prev,
      [type]: !isSectionCollapsed(type, index)
    }));
  };
  
  const getDaysLeftToPay = (dueDay: number) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const today = startOfDay(now);
    
    let target = new Date(currentYear, currentMonth, dueDay);
    if (target.getTime() < today.getTime()) {
      target = new Date(currentYear, currentMonth + 1, dueDay);
    }
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const allTransactions = useLiveQuery(() => db.transactions.toArray(), [user?.uid]) || [];
  const allClosings = useLiveQuery(() => db.accountClosings.toArray(), [user?.uid]) || [];

  const [searchQuery, setSearchQuery] = useState('');

  const accountBreakdown = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now).getTime();
    const monthEnd = endOfMonth(now).getTime();

    return accounts.reduce((acc, account) => {
      const allAccountTxs = allTransactions
        .filter(tx => Number(tx.accountId) === Number(account.id))
        .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      
      let totalBalance = Number(account.startingBalance) || 0;
      allAccountTxs.forEach(tx => {
        const txType = normalizeType(tx.type);
        if (txType === 'CREDIT') totalBalance += (Number(tx.amount) || 0);
        else if (txType === 'DEBIT') totalBalance -= (Number(tx.amount) || 0);
      });

      // Calculate Inflow/Outflow for Current Month
      const currentMonthTxs = allAccountTxs.filter(tx => {
        const time = new Date(tx.dateTime).getTime();
        return time >= monthStart && time <= monthEnd;
      });

      const inflow = currentMonthTxs.filter(tx => normalizeType(tx.type) === 'CREDIT').reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const outflow = currentMonthTxs.filter(tx => normalizeType(tx.type) === 'DEBIT').reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      
      // Get Recent Activity
      const recentActivity = allAccountTxs.slice(0, 3);

      acc[account.id!] = { inflow, outflow, currentBalance: totalBalance, recentActivity };
      return acc;
    }, {} as Record<number, { inflow: number, outflow: number, currentBalance: number, recentActivity: Transaction[] }>);
  }, [accounts, allTransactions]);

  const totalNetWorth = useMemo(() => 
    Object.values(accountBreakdown).reduce((sum, b) => sum + (b.currentBalance || 0), 0)
  , [accountBreakdown]);

  const totalLiquid = useMemo(() => 
    Object.entries(accountBreakdown)
      .filter(([id]) => accounts.find(a => a.id === Number(id))?.type !== 'CREDIT_CARD')
      .reduce((sum, [, b]) => sum + (b.currentBalance || 0), 0)
  , [accountBreakdown, accounts]);

  const totalLiabilities = useMemo(() => 
    Math.abs(Object.entries(accountBreakdown)
      .filter(([id]) => accounts.find(a => a.id === Number(id))?.type === 'CREDIT_CARD')
      .reduce((sum, [, b]) => sum + (b.currentBalance || 0), 0))
  , [accountBreakdown, accounts]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountLast4 || !startingBalance) return;

    setIsSaving(true);
    try {
      const creditCardFields = accountType === 'CREDIT_CARD' ? {
        creditLimit: parseFloat(creditLimit) || 0,
        statementDate: parseInt(statementDate) || 0,
        dueDate: parseInt(dueDate) || 0
      } : {
        creditLimit: undefined,
        statementDate: undefined,
        dueDate: undefined
      };

      const parsedStartingBalance = parseFloat(startingBalance.toString().replace(/,/g, '')) || 0;
      const finalStartingBalance = accountType === 'CREDIT_CARD' ? -Math.abs(parsedStartingBalance) : parsedStartingBalance;

      if (editingAccountId) {
        await db.accounts.update(editingAccountId, {
          bankName,
          accountLast4,
          startingBalance: finalStartingBalance,
          startingBalanceDate: new Date(startingBalanceDate),
          type: accountType,
          ...creditCardFields
        });
      } else {
        const maxOrder = accounts.reduce((max, a) => Math.max(max, a.sortOrder || 0), 0);
        await db.accounts.add({
          bankName,
          accountLast4,
          startingBalance: finalStartingBalance,
          startingBalanceDate: new Date(startingBalanceDate),
          type: accountType,
          sortOrder: maxOrder + 1,
          ...creditCardFields
        });
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsSaving(false);
        resetForm();
      }, 700);
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setBankName('');
    setAccountLast4('');
    setStartingBalance('');
    setStartingBalanceDate(new Date().toISOString().split('T')[0]);
    setAccountType('BANK');
    setCreditLimit('');
    setStatementDate('');
    setDueDate('');
    setIsAdding(false);
    setEditingAccountId(null);
  };

  const handleEdit = (account: any) => {
    setBankName(account.bankName);
    setAccountLast4(account.accountLast4);
    const balanceVal = account.type === 'CREDIT_CARD' ? Math.abs(account.startingBalance) : account.startingBalance;
    setStartingBalance(balanceVal.toString());
    setStartingBalanceDate(account.startingBalanceDate ? new Date(account.startingBalanceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setAccountType(account.type || 'BANK');
    setCreditLimit(account.creditLimit ? account.creditLimit.toString() : '');
    setStatementDate(account.statementDate ? account.statementDate.toString() : '');
    setDueDate(account.dueDate ? account.dueDate.toString() : '');
    setEditingAccountId(account.id);
    setIsAdding(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      await db.accounts.delete(id);
      const txs = await db.transactions.where('accountId').equals(id).toArray();
      for (const tx of txs) {
        if (tx.id) {
          if (tx.linkedTransactionId) {
            await db.transactions.delete(tx.linkedTransactionId);
          }
          await db.transactions.delete(tx.id);
        }
      }
    }
  };

  const groupedAccounts = useMemo(() => {
    const groups = {
      BANK: [] as any[],
      CASH: [] as any[],
      CREDIT_CARD: [] as any[]
    };
    accounts.forEach(acc => {
      const type = acc.type || 'BANK';
      if (groups[type as keyof typeof groups]) {
        groups[type as keyof typeof groups].push(acc);
      }
    });

    const getMinSortOrder = (type: string) => {
       const arr = groups[type as keyof typeof groups];
       if (arr.length === 0) return 999999;
       return Math.min(...arr.map(a => a.sortOrder || 0));
    };

    const sortedTypes = ['BANK', 'CASH', 'CREDIT_CARD'].sort((a, b) => getMinSortOrder(a) - getMinSortOrder(b));
    const sortedGroups: Record<string, any[]> = {};
    for (const type of sortedTypes) {
       sortedGroups[type] = groups[type as keyof typeof groups];
    }
    return sortedGroups;
  }, [accounts]);

  const activeGroupedAccounts = useMemo(() => {
    return Object.entries(groupedAccounts).filter(([_, list]) => list.length > 0);
  }, [groupedAccounts]);

  const getGroupTitle = (type: string) => {
    switch(type) {
      case 'BANK': return { title: 'Bank Accounts', icon: <Landmark className="w-5 h-5" />, color: 'text-brand-blue' };
      case 'CASH': return { title: 'Cash & Wallets', icon: <Wallet className="w-5 h-5" />, color: 'text-brand-green' };
      case 'CREDIT_CARD': return { title: 'Credit Cards', icon: <CreditCard className="w-5 h-5" />, color: 'text-brand-red' };
      default: return { title: 'Other Assets', icon: <MoreHorizontal className="w-5 h-5" />, color: 'text-neutral-400' };
    }
  };

  const getGroupTotal = (accList: any[]) => {
    return accList.reduce((sum, acc) => sum + (accountBreakdown[acc.id!]?.currentBalance || 0), 0);
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col gap-6 px-1 mb-8">
        {/* Title & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">Accounts</h1>
            <p className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mt-0.5">Institutional Wealth</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative group min-w-[120px] sm:min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="pl-8 pr-3 py-2 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-brand-blue/10 dark:focus:ring-white/5 transition-all w-full"
              />
            </div>
            <button
              onClick={() => setIsTransferOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 text-brand-blue dark:text-white rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 transition-all font-bold uppercase tracking-wider text-[9px]"
              title="Quick Transfer"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-brand-green mr-0.5 shrink-0" />
              <span className="hidden sm:inline">Transfer</span>
            </button>
            <button
              onClick={() => setIsReorderOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 text-brand-blue dark:text-white rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 transition-all font-bold uppercase tracking-wider text-[9px]"
              title="Arrange Accounts"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-brand-cyan mr-0.5 shrink-0" />
              <span className="hidden sm:inline">Arrange</span>
            </button>
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-green text-white dark:text-brand-blue rounded-xl hover:brightness-110 active:scale-95 transition-all font-black uppercase tracking-widest text-[9px] shadow-lg shadow-brand-green/10"
            >
              {isAdding && !editingAccountId ? <Plus className="w-3 h-3 rotate-45" /> : <Plus className="w-3 h-3" />}
              <span>{isAdding && !editingAccountId ? 'Close' : 'Add Account'}</span>
            </button>
          </div>
        </div>

        {/* Minimalist Stats Panel */}
        <div 
          onClick={() => isPrivacyMode && setRevealBalances(!revealBalances)}
          className="grid grid-cols-3 gap-2 sm:gap-6 p-4 sm:p-5 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/5 rounded-2xl sm:rounded-3xl shadow-sm cursor-pointer hover:border-neutral-200 dark:hover:border-white/10 transition-all"
        >
          <div className="flex flex-col gap-0.5 sm:gap-1">
            <span className="text-[8px] sm:text-[9px] font-black text-neutral-400 uppercase tracking-widest">Net Worth</span>
            <p className={cn(
              "text-sm sm:text-xl font-heading font-black text-brand-blue dark:text-white tracking-tighter transition-all duration-300",
              shouldBlur && "blur-[5px] select-none"
            )}>
              {formatAmount(totalNetWorth)}
            </p>
          </div>
          
          <div className="flex flex-col gap-0.5 sm:gap-1 border-x border-neutral-100 dark:border-white/5 px-2 sm:px-6">
            <span className="text-[8px] sm:text-[9px] font-black text-neutral-400 uppercase tracking-widest">Cash</span>
            <p className={cn(
              "text-sm sm:text-xl font-heading font-black text-brand-green tracking-tighter transition-all duration-300",
              shouldBlur && "blur-[5px] select-none"
            )}>
              {formatAmount(totalLiquid)}
            </p>
          </div>
          
          <div className="flex flex-col gap-0.5 sm:gap-1 pl-2 sm:pl-6">
            <span className="text-[8px] sm:text-[9px] font-black text-neutral-400 uppercase tracking-widest">Total Debt</span>
            <p className={cn(
              "text-sm sm:text-xl font-heading font-black text-rose-500 tracking-tighter transition-all duration-300",
              shouldBlur && "blur-[5px] select-none"
            )}>
              {formatAmount(totalLiabilities)}
            </p>
          </div>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white dark:bg-[#111111] p-5 sm:p-6 rounded-[24px] shadow-sm border border-neutral-100 dark:border-white/5 transition-all">
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-neutral-50 dark:border-white/5">
            <h2 className="text-xs font-heading font-black text-brand-blue dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-green"></span>
              {editingAccountId ? 'Edit Account' : 'New Account'}
            </h2>
            <button onClick={resetForm} className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 hover:text-brand-red uppercase tracking-wider transition-colors">Cancel</button>
          </div>

          <form onSubmit={handleAddAccount} className="space-y-4">
            <div className="flex bg-neutral-50 dark:bg-[#1A1A1A] p-0.5 rounded-xl border border-neutral-100 dark:border-white/5">
              {(['BANK', 'CASH', 'CREDIT_CARD'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setAccountType(t);
                    if (t === 'CASH' && !bankName) setBankName('Cash Wallet');
                    if (t === 'CASH' && !accountLast4) setAccountLast4('CASH');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    accountType === t
                      ? 'bg-brand-green text-white dark:text-brand-blue shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-white'
                  }`}
                >
                  {t === 'BANK' && <Landmark className="w-3.5 h-3.5" />}
                  {t === 'CASH' && <Wallet className="w-3.5 h-3.5" />}
                  {t === 'CREDIT_CARD' && <CreditCard className="w-3.5 h-3.5" />}
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">
                  {accountType === 'BANK' ? 'Bank Name' : accountType === 'CASH' ? 'Wallet Name' : 'Card Name'}
                </label>

                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Enter name"
                  className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all placeholder-neutral-300 dark:placeholder-neutral-600 mb-3"
                  required
                />

                {accountType === 'BANK' && (
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-2 px-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {INDIAN_BANKS.map((bank) => (
                      <button
                        key={bank.id}
                        type="button"
                        onClick={() => setBankName(bank.name)}
                        className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
                          bankName === bank.name
                            ? 'bg-brand-green/10 text-brand-green border-brand-green/20 shadow-sm'
                            : 'bg-white dark:bg-[#1A1A1A] text-neutral-400 border-neutral-100 dark:border-white/5 hover:bg-neutral-50 dark:hover:bg-[#222222]'
                        }`}
                      >
                        <div className="w-4 h-4 bg-white rounded flex items-center justify-center p-0.5 shadow-xs">
                          <bank.logo className="w-full h-full object-contain" />
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-wider">{bank.id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">Reference/Last 4</label>
                <input
                  type="text"
                  value={accountLast4}
                  onChange={(e) => setAccountLast4(e.target.value)}
                  placeholder="e.g., 1234"
                  className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all placeholder-neutral-300 dark:placeholder-neutral-600"
                  required
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">
                  {accountType === 'CREDIT_CARD' ? 'Outstanding Balance (Owed)' : `Starting Balance (${currency})`}
                </label>
                <input
                  type="number"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all placeholder-neutral-300 dark:placeholder-neutral-600"
                  required
                />
                {accountType === 'CREDIT_CARD' && (
                  <p className="text-[9px] font-medium text-neutral-400 dark:text-[#A0A0A0] mt-1.5 leading-normal">
                    Enter what you owe. Internally stored as a liability.
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">Starting Date</label>
                <input
                  type="date"
                  value={startingBalanceDate}
                  onChange={(e) => setStartingBalanceDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all text-neutral-800 dark:text-neutral-200"
                  required
                />
              </div>
              
              {accountType === 'CREDIT_CARD' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">Credit Limit ({currency})</label>
                    <input
                      type="number"
                      value={creditLimit}
                      onChange={(e) => setCreditLimit(e.target.value)}
                      placeholder="e.g., 100000"
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all placeholder-neutral-300 dark:placeholder-neutral-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">Statement Date (Day)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={statementDate}
                      onChange={(e) => setStatementDate(e.target.value)}
                      placeholder="e.g., 15"
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all placeholder-neutral-300 dark:placeholder-neutral-600"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">Payment Due Date (Day)</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      placeholder="e.g., 5"
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all placeholder-neutral-300 dark:placeholder-neutral-600"
                      required
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-5 border-t border-neutral-50 dark:border-white/5">
              <button 
                type="button" 
                onClick={resetForm} 
                disabled={isSaving}
                className="px-4 py-2 text-[10px] font-bold text-neutral-400 hover:text-neutral-500 uppercase transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isSaving || showSuccess}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 ${
                  showSuccess 
                    ? 'bg-emerald-500 text-white dark:text-brand-blue shadow-emerald-500/10' 
                    : 'bg-brand-green text-white dark:text-brand-blue shadow-brand-green/10 hover:brightness-110'
                } disabled:opacity-70`}
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : showSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <span>{editingAccountId ? 'Update Account' : 'Save Account'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-6">
        {activeGroupedAccounts.map(([type, accList], idx) => {
          const { title, icon, color } = getGroupTitle(type);
          const total = getGroupTotal(accList);
          const isCollapsed = isSectionCollapsed(type, idx);
          
          return (
            <div key={type} className="space-y-4 bg-[#F9FBFF] dark:bg-white/[0.01] p-4 sm:p-5 rounded-[28px] border border-brand-blue/5 dark:border-white/5 shadow-sm">
              {/* Clickable Header Card */}
              <div 
                onClick={() => toggleSection(type, idx)}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 flex items-center justify-center shadow-sm ${color}`}>{icon}</div>
                  <div>
                    <h2 className="text-sm font-heading font-black text-brand-blue dark:text-white uppercase tracking-tight leading-none mb-1">{title}</h2>
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">{accList.length} Accounts</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                     <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">Total</p>
                     <p className="text-sm font-heading font-black text-brand-blue dark:text-white tracking-tighter">{currency}{total.toLocaleString('en-IN')}</p>
                  </div>
                  {/* Toggle Button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSection(type, idx);
                    }}
                    className="w-8 h-8 rounded-xl bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 flex items-center justify-center text-neutral-400 dark:text-[#A0A0A0] transition-transform duration-200 shadow-sm"
                    style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Collapsible Accounts List */}
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-3 pb-1">
                      {[...accList]
                        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                        .filter(a => searchQuery === '' || a.bankName.toLowerCase().includes(searchQuery.toLowerCase()) || a.accountLast4.includes(searchQuery))
                        .map(account => {
                          const info = accountBreakdown[account.id!];
                          const currentBalance = info?.currentBalance || 0;
                          const isCash = account.type === 'CASH';
                          const isCc = account.type === 'CREDIT_CARD';
                          
                          return (
                            <div 
                              key={account.id} 
                              onClick={() => setSelectedAccountId(account.id!)} 
                              className="group relative bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm hover:shadow-md hover:border-brand-green/20 dark:hover:border-white/10 transition-all cursor-pointer overflow-hidden flex flex-col"
                            >
                              <div className="p-6 flex flex-col flex-1">
                                <div className="flex justify-between items-start mb-6">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-neutral-50 dark:bg-white/5 rounded-[20px] flex items-center justify-center p-2.5 border border-neutral-100 dark:border-white/5 shadow-sm shrink-0">
                                      <BankLogo bankName={account.bankName} type={account.type} className="w-full h-full object-contain" />
                                    </div>
                                    <div className="min-w-0">
                                      <h3 className="text-[13px] font-heading font-black text-brand-blue dark:text-white tracking-tight uppercase truncate">{account.bankName}</h3>
                                      <p className="font-mono text-[9px] tracking-wider text-neutral-400 dark:text-[#A0A0A0] font-semibold mt-0.5">
                                        {isCash ? 'TOTAL CASH' : `••••   ${account.accountLast4}`}
                                      </p>
                                      {isCc && account.dueDate && (() => {
                                        const daysLeft = getDaysLeftToPay(account.dueDate);
                                        const isUrgent = daysLeft <= 5;
                                        return (
                                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider mt-1 ${
                                            isUrgent 
                                              ? 'bg-rose-50/10 text-rose-500 border border-rose-500/20' 
                                              : 'bg-neutral-100 dark:bg-white/5 text-neutral-400 dark:text-neutral-500'
                                          }`}>
                                            <span>Due in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-0.5">

                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(account); }} className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 dark:text-[#A0A0A0] hover:text-brand-blue dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-white/5 transition-all relative z-10"><Pencil className="w-3.5 h-3.5" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(account.id!); }} className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 dark:text-[#A0A0A0] hover:text-brand-red hover:bg-neutral-50 dark:hover:bg-white/5 transition-all relative z-10"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>

                                <div className="mb-6">
                                  <p className="text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-1">
                                    {isCc ? 'Outstanding Balance' : 'Account Balance'}
                                  </p>
                                  <p 
                                    className={cn(
                                      "text-3xl font-heading font-black tracking-tighter transition-all duration-300",
                                      currentBalance >= 0 ? (isCc ? 'text-brand-blue dark:text-white' : 'text-brand-green') : 'text-brand-red',
                                      shouldBlur && "blur-[7px] select-none cursor-pointer"
                                    )}
                                    onClick={() => isPrivacyMode && setRevealBalances(!revealBalances)}
                                  >
                                    {formatAmount(currentBalance)}
                                  </p>
                                  {isCc && account.creditLimit ? (() => {
                              const used = Math.abs(currentBalance);
                              const limit = account.creditLimit;
                              const available = Math.max(limit - used, 0);
                              const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                              const barColor = pct >= 80 ? 'bg-rose-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-green';
                              
                              return (
                                <div className="space-y-2 mt-3 p-3 bg-neutral-50 dark:bg-white/[0.02] rounded-xl border border-neutral-100 dark:border-white/5" onClick={(e) => { e.stopPropagation(); if (isPrivacyMode) setRevealBalances(!revealBalances); }}>
                                  <div className="flex justify-between text-[11px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest">
                                    <span className="flex items-center gap-1">
                                      <span className={cn("inline-block w-1.5 h-1.5 rounded-full", pct >= 80 ? 'bg-rose-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-green')}></span>
                                      Used: <span className={cn("text-neutral-700 dark:text-neutral-200 font-bold", shouldBlur && "blur-[4px] select-none")}>{formatAmount(used)}</span>
                                    </span>
                                    <span>
                                      Limit: <span className="text-neutral-700 dark:text-neutral-200 font-bold">{formatAmount(limit)}</span>
                                    </span>
                                  </div>
                                  
                                  {/* Progress Bar */}
                                  <div className="w-full h-1.5 bg-neutral-200/60 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                      className={cn("h-full rounded-full transition-all duration-500", barColor)}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  
                                  <div className="flex justify-between items-center text-[10px] font-bold text-neutral-400 uppercase">
                                    <span>{Math.round(pct)}% Utilized</span>
                                    <span className={cn("text-neutral-500", shouldBlur && "blur-[3px] select-none")}>Available: {formatAmount(available)}</span>
                                  </div>
                                </div>
                              );
                            })() : null}
                                </div>

                                <div className="pt-4 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between mt-auto">
                                  <div className="flex items-center gap-4" onClick={() => isPrivacyMode && setRevealBalances(!revealBalances)}>
                                    <div className="flex flex-col">
                                      <span className="text-[7px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase">Inflow</span>
                                      <span className={cn("text-[10px] font-black text-emerald-500 transition-all duration-300", shouldBlur && "blur-[4px] select-none")}>{formatAmount(info?.inflow || 0)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[7px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase">Outflow</span>
                                      <span className={cn("text-[10px] font-black text-rose-500 transition-all duration-300", shouldBlur && "blur-[4px] select-none")}>{formatAmount(info?.outflow || 0)}</span>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={e => { e.stopPropagation(); setSelectedAccountId(account.id!); }} 
                                    className="w-9 h-9 rounded-2xl bg-brand-green dark:bg-brand-green/20 text-white dark:text-brand-green flex items-center justify-center transition-all hover:brightness-105"
                                    title="Statement History"
                                  >
                                    <History className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {selectedAccountId && (
         <AccountStatementDetail accountId={selectedAccountId} onClose={() => setSelectedAccountId(null)} />
      )}

      {isReorderOpen && (
        <AccountsReorderModal onClose={() => setIsReorderOpen(false)} />
      )}

      {isTransferOpen && (
        <QuickTransferModal onClose={() => setIsTransferOpen(false)} />
      )}
    </div>
  );
}

function PartitionRow({ partition }: { partition: any }) {
  const currency = useCurrency();
  return (
    <tr className="bg-brand-blue/[0.05] dark:bg-brand-blue/[0.15] border-y border-brand-blue/10 dark:border-brand-blue/30">
      <td colSpan={4} className="px-2 py-2">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2.5">
            <span className="text-[8px] font-semibold text-brand-blue/60 dark:text-white/50 uppercase tracking-[0.2em]">New Start Balance</span>
            <span className="text-[11px] font-semibold text-brand-blue dark:text-white tracking-tight">{currency}{partition.closingBalance.toLocaleString()}</span>
          </div>
        </div>
      </td>
    </tr>
  );
}

function AccountStatementDetail({ accountId, onClose }: { accountId: number, onClose: () => void }) {
  const currency = useCurrency();
  const { user } = useAuth();
  const navigate = useNavigate();
  const account = useLiveQuery(() => db.accounts.get(accountId), [accountId, user?.uid]);
  const transactions = useLiveQuery(() => db.transactions.where('accountId').equals(accountId).sortBy('dateTime'), [accountId, user?.uid]) || [];
  const closings = useLiveQuery(() => db.accountClosings.where('accountId').equals(accountId).sortBy('closingDate'), [accountId, user?.uid]) || [];

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [granularity, setGranularity] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM'>('MONTH');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customRange, setCustomRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isProcessingPartition, setIsProcessingPartition] = useState(false);
  const [showPartitionSuccess, setShowPartitionSuccess] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');

  const { startDateLimit, endDateLimit } = useMemo(() => {
    let start = 0;
    let end = Infinity;
    if (granularity !== 'ALL') {
      const d = referenceDate;
      if (granularity === 'DAY') {
        start = startOfDay(d).getTime();
        end = endOfDay(d).getTime();
      } else if (granularity === 'WEEK') {
        start = startOfWeek(d, { weekStartsOn: 1 }).getTime();
        end = endOfWeek(d, { weekStartsOn: 1 }).getTime();
      } else if (granularity === 'MONTH') {
        start = startOfMonth(d).getTime();
        end = endOfMonth(d).getTime();
      } else if (granularity === 'YEAR') {
        start = startOfYear(d).getTime();
        end = endOfYear(d).getTime();
      } else if (granularity === 'CUSTOM') {
        start = startOfDay(new Date(customRange.start)).getTime();
        end = endOfDay(new Date(customRange.end)).getTime();
      }
    }
    return { startDateLimit: start, endDateLimit: end };
  }, [granularity, referenceDate, customRange]);

  const statementData = useMemo(() => {
    if (!account) return [];
    let baseBalance = Number(account.startingBalance) || 0;
    let runningBalance = baseBalance;
    const allSortedTxs = [...transactions].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    const txsBefore = allSortedTxs.filter(tx => new Date(tx.dateTime).getTime() < startDateLimit);
    const txsInView = allSortedTxs.filter(tx => {
      const txTime = new Date(tx.dateTime).getTime();
      return txTime >= startDateLimit && txTime <= endDateLimit;
    });
    txsBefore.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      const txType = normalizeType(tx.type);
      if (txType === 'CREDIT') runningBalance += amount;
      else if (txType === 'DEBIT') runningBalance -= amount;
    });
    return txsInView.map(tx => {
      const amount = Number(tx.amount) || 0;
      const txType = normalizeType(tx.type);
      if (txType === 'CREDIT') runningBalance += amount;
      else if (txType === 'DEBIT') runningBalance -= amount;
      return { ...tx, amount, runningBalance } as Transaction & { runningBalance: number };
    });
  }, [account, transactions, granularity, referenceDate, customRange]);

  const filteredStatementData = useMemo(() => {
    return statementData.filter(tx => {
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const noteMatch = tx.note?.toLowerCase().includes(q);
        const catMatch = tx.category?.toLowerCase().includes(q);
        const partyMatch = tx.party?.toLowerCase().includes(q);
        const tagMatch = tx.expenseType?.toLowerCase().includes(q);
        if (!noteMatch && !catMatch && !partyMatch && !tagMatch) return false;
      }
      return true;
    });
  }, [statementData, typeFilter, searchTerm]);

  const totalCredit = statementData.filter(t => normalizeType(t.type) === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);
  const totalDebit = statementData.filter(t => normalizeType(t.type) === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0);

  const actualTotalBalance = useMemo(() => {
    let bal = Number(account?.startingBalance) || 0;
    transactions.forEach(tx => {
       const txType = normalizeType(tx.type);
       if (txType === 'CREDIT') bal += (Number(tx.amount) || 0);
       else if (txType === 'DEBIT') bal -= (Number(tx.amount) || 0);
    });
    return bal;
  }, [account?.startingBalance, transactions]);

  const currentViewStateBalance = statementData.length > 0 
    ? statementData[statementData.length - 1].runningBalance 
    : actualTotalBalance;

  const openingBalanceForView = currentViewStateBalance - totalCredit + totalDebit;

  const chartData = useMemo(() => {
    if (statementData.length === 0) {
      return [{ date: 'Start', Balance: openingBalanceForView }];
    }
    const sorted = [...statementData].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    const pts = sorted.map(tx => ({
      date: format(new Date(tx.dateTime), 'dd MMM'),
      Balance: tx.runningBalance
    }));
    return [{ date: 'Start', Balance: openingBalanceForView }, ...pts];
  }, [statementData, openingBalanceForView]);

  const downloadCSV = () => {
    if (!account) return;
    const headers = ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'];
    const rows = statementData.map(tx => [
      format(new Date(tx.dateTime), 'yyyy-MM-dd HH:mm'),
      (tx.note || tx.category || '').toUpperCase(),
      normalizeType(tx.type) === 'DEBIT' ? tx.amount : '',
      normalizeType(tx.type) === 'CREDIT' ? tx.amount : '',
      tx.runningBalance
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${account.bankName}_Statement_${format(new Date(), 'dd_MMM_yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const downloadPDF = () => {
    if (!account) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Account Statement', 14, 22);
    doc.setFontSize(10);
    doc.text(`Bank: ${account.bankName}`, 14, 30);
    doc.text(`Account: **** ${account.accountLast4}`, 14, 35);
    doc.text(`Closing Balance: ${currency} ${currentViewStateBalance.toLocaleString()}`, 14, 45);
    autoTable(doc, {
      startY: 55,
      head: [['Date', 'Particulars', 'Debit (Dr)', 'Credit (Cr)', 'Balance']],
      body: statementData.map(tx => [
        format(new Date(tx.dateTime), 'dd MMM yyyy'),
        (tx.note || tx.category || '').toUpperCase(),
        normalizeType(tx.type) === 'DEBIT' ? `${currency} ${tx.amount.toLocaleString()}` : '-',
        normalizeType(tx.type) === 'CREDIT' ? `${currency} ${tx.amount.toLocaleString()}` : '-',
        `${currency} ${tx.runningBalance.toLocaleString()}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [26, 35, 126] }
    });
    doc.save(`${account.bankName}_Statement_${format(new Date(), 'dd_MMM_yyyy')}.pdf`);
    setShowExportMenu(false);
  };

  const handleStartNewBalance = async () => {
    if (!account) return;
    const confirmReset = window.confirm(`Start a new balance period using the current balance?`);
    if (!confirmReset) return;

    setIsProcessingPartition(true);
    try {
      // Use current time or 1ms after last tx
      const lastTxTime = transactions.length > 0 
        ? new Date(transactions[transactions.length - 1].dateTime).getTime() 
        : (account.startingBalanceDate ? new Date(account.startingBalanceDate).getTime() : 0);
      const partitionTime = Math.max(lastTxTime + 1, Date.now());

      const lastClosing = closings.length > 0 ? closings[closings.length - 1] : null;
      const startLimit = lastClosing ? new Date(lastClosing.closingDate).getTime() : (account.startingBalanceDate ? new Date(account.startingBalanceDate).getTime() : 0);
      const liveTxs = transactions.filter(tx => new Date(tx.dateTime).getTime() > startLimit);
      const inflow = liveTxs.filter(t => normalizeType(t.type) === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);
      const outflow = liveTxs.filter(t => normalizeType(t.type) === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0);
      const opening = lastClosing ? lastClosing.closingBalance : account.startingBalance;

      await db.accountClosings.add({
        accountId: account.id!,
        closingDate: new Date(partitionTime),
        closingBalance: actualTotalBalance,
        periodName: format(new Date(partitionTime), 'dd MMM yyyy'),
        openingBalance: opening,
        totalInflow: inflow,
        totalOutflow: outflow
      });

      setShowPartitionSuccess(true);
      setTimeout(() => {
        setShowPartitionSuccess(false);
        setIsProcessingPartition(false);
      }, 700);
    } catch (err) {
      console.error(err);
      setIsProcessingPartition(false);
    }
  };

  const handleCreatePartitionAt = async (targetTx: Transaction & { runningBalance: number }) => {
    if (!account) return;
    const confirmReset = window.confirm(`Start a new balance period from this transaction?`);
    if (!confirmReset) return;
    const partitionTime = new Date(targetTx.dateTime).getTime() + 1;
    const prevClosing = [...closings].filter(c => new Date(c.closingDate).getTime() < partitionTime).sort((a,b) => new Date(b.closingDate).getTime() - new Date(a.closingDate).getTime())[0];
    const startLimit = prevClosing ? new Date(prevClosing.closingDate).getTime() : (account.startingBalanceDate ? new Date(account.startingBalanceDate).getTime() : 0);
    const periodTxs = transactions.filter(tx => {
        const time = new Date(tx.dateTime).getTime();
        return time > startLimit && time < partitionTime;
    });
    const inflow = periodTxs.filter(t => normalizeType(t.type) === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);
    const outflow = periodTxs.filter(t => normalizeType(t.type) === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0);
    const opening = prevClosing ? prevClosing.closingBalance : account.startingBalance;
    await db.accountClosings.add({
      accountId: account.id!,
      closingDate: new Date(partitionTime),
      closingBalance: targetTx.runningBalance,
      periodName: format(new Date(partitionTime), 'dd MMM yyyy HH:mm'),
      openingBalance: opening,
      totalInflow: inflow,
      totalOutflow: outflow
    });
  };

  if (!account) return null;

  return (
    <div className="fixed inset-0 bg-white dark:bg-[#060608] z-[100] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 touch-pan-y overscroll-none" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="bg-neutral-50 dark:bg-[#0C0C0F] border-b border-neutral-200 dark:border-[#222222] px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-white dark:bg-[#1A1A1A] rounded-lg flex items-center justify-center p-0.5 border border-neutral-100 dark:border-[#333333]">
              <BankLogo bankName={account.bankName} type={account.type} className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-[11px] font-semibold text-brand-blue dark:text-[#F7F7F7] uppercase tracking-widest leading-none mb-0.5">{account.bankName}</h2>
              <div className="flex items-center gap-1">
                <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest leading-none">
                  {account.type === 'CASH' ? 'CASH' : `•••• ${account.accountLast4}`}
                </p>
                <div className="w-0.5 h-0.5 rounded-full bg-neutral-300" />
                <p className="text-[8px] font-semibold text-brand-blue/60 dark:text-white/60 uppercase">{currency}{actualTotalBalance.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowFilterMenu(!showFilterMenu)} className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${showFilterMenu ? 'bg-brand-blue text-white' : 'bg-neutral-200 dark:bg-[#222222] text-brand-blue dark:text-[#F7F7F7] hover:bg-neutral-300'}`}>
              <Filter className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-[#222222] flex items-center justify-center text-brand-blue dark:text-[#F7F7F7] hover:bg-neutral-300 transition-all">
              <Plus className="w-5 h-5 rotate-45" />
            </button>
          </div>
        </div>

        {showFilterMenu && (
          <div className="mt-2 p-1 bg-neutral-100 dark:bg-[#1A1A1A] rounded-xl flex overflow-x-auto gap-1 animate-in slide-in-from-top-2 duration-200">
            {(['ALL', 'YEAR', 'MONTH', 'WEEK', 'DAY', 'CUSTOM'] as const).map((g) => (
              <button key={g} onClick={() => { setGranularity(g); setShowFilterMenu(false); }} className={`flex-1 px-2.5 py-1.5 rounded-lg text-[8px] font-semibold uppercase tracking-[0.1em] transition-all shrink-0 ${granularity === g ? 'bg-white dark:bg-[#333333] text-brand-blue dark:text-white shadow-sm' : 'text-neutral-400 hover:text-neutral-500'}`}>{g}</button>
            ))}
          </div>
        )}

        {/* Search & Flow Filters Row */}
        <div className="mt-2 flex flex-col sm:flex-row gap-2 items-center">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Search notes, category, tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-8 pl-8 pr-8 bg-white dark:bg-[#111111] border border-neutral-200 dark:border-white/5 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-brand-blue/15 dark:focus:ring-white/5 transition-all text-brand-blue dark:text-white"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          
          {/* Flow Tabs */}
          <div className="flex bg-neutral-100 dark:bg-[#1A1A1A] p-0.5 rounded-xl shrink-0 w-full sm:w-auto">
            {(['ALL', 'CREDIT', 'DEBIT'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTypeFilter(f)}
                className={`flex-1 sm:flex-initial px-3 h-7 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  typeFilter === f
                    ? 'bg-white dark:bg-[#333333] text-brand-blue dark:text-white shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-500'
                }`}
              >
                {f === 'CREDIT' ? 'Inflow' : f === 'DEBIT' ? 'Outflow' : 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-1.5">
          <div className="bg-white dark:bg-[#111111] px-2 py-1.5 rounded-xl shadow-sm border border-neutral-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <p className="text-[6px] font-semibold text-neutral-400 uppercase tracking-[0.1em]">Opening</p>
                <p className="text-[10px] font-semibold text-brand-blue/50 dark:text-white/40">{currency}{openingBalanceForView.toLocaleString()}</p>
              </div>
              <div className="w-px h-5 bg-neutral-100 dark:bg-white/10" />
              <div className="flex flex-col">
                <p className="text-[6px] font-semibold text-neutral-400 uppercase tracking-[0.1em]">Closing</p>
                <p className="text-[10px] font-semibold text-brand-blue dark:text-white">{currency}{currentViewStateBalance.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 italic">
              <span className="text-[8px] font-bold text-brand-green">IN: {currency}{totalCredit.toLocaleString()}</span>
              <span className="text-[8px] font-bold text-brand-red">OUT: {currency}{totalDebit.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button 
              onClick={handleStartNewBalance} 
              disabled={isProcessingPartition || showPartitionSuccess}
              className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-black text-[8px] uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
                showPartitionSuccess 
                  ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                  : 'bg-brand-green text-white shadow-brand-green/20'
              } disabled:opacity-70`}
            >
              {isProcessingPartition ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Reconciling...</span>
                </>
              ) : showPartitionSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Closed!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Close Period</span>
                </>
              )}
            </button>
            <div className="relative">
              <button onClick={() => setShowExportMenu(!showExportMenu)} className="w-full h-full flex items-center justify-center gap-1.5 bg-brand-blue dark:bg-white/10 text-white py-1.5 rounded-lg font-black text-[8px] uppercase tracking-widest active:scale-95 transition-all">
                <Download className="w-3 h-3" />
                Export
              </button>
              {showExportMenu && (
                <div className="absolute top-full right-0 mt-1 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#333333] rounded-lg shadow-xl py-1 w-32 z-10 overflow-hidden">
                  <button onClick={downloadPDF} className="w-full px-3 py-2 text-left text-[9px] font-bold hover:bg-neutral-50 dark:hover:bg-[#222222] transition-colors flex items-center gap-2 border-b border-neutral-100 dark:border-white/5">
                    <FileText className="w-3 h-3 text-red-500" /> PDF Document
                  </button>
                  <button onClick={downloadCSV} className="w-full px-3 py-2 text-left text-[9px] font-bold hover:bg-neutral-50 dark:hover:bg-[#222222] transition-colors flex items-center gap-2 border-b border-neutral-100 dark:border-white/5">
                    <FileText className="w-3 h-3 text-green-500" /> CSV Spreadsheet
                  </button>
                  <button onClick={() => navigate('/reports')} className="w-full px-3 py-2 text-left text-[9px] font-bold hover:bg-neutral-50 dark:hover:bg-[#222222] transition-colors flex items-center gap-2">
                    <History className="w-3 h-3 text-brand-blue" /> Advanced Audit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="px-4 py-3 bg-neutral-50 dark:bg-[#0C0C0F] border-b border-neutral-200 dark:border-[#222222] shrink-0">
          <div className="h-28 w-full bg-white dark:bg-[#111111] rounded-xl border border-neutral-100 dark:border-white/5 p-2 shadow-inner">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={account.type === 'CREDIT_CARD' ? '#f43f5e' : '#10b981'} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={account.type === 'CREDIT_CARD' ? '#f43f5e' : '#10b981'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  stroke="#888888" 
                  fontSize={6} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#888888" 
                  fontSize={6} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(v) => `${currency}${v.toLocaleString()}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(0,0,0,0.85)', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontSize: '7px', 
                    color: '#fff' 
                  }}
                  labelStyle={{ fontWeight: 'black', color: '#10b981' }}
                  formatter={(v: any) => [`${currency}${parseFloat(v).toLocaleString()}`, 'Balance']}
                />
                <Area 
                  type="monotone" 
                  dataKey="Balance" 
                  stroke={account.type === 'CREDIT_CARD' ? '#f43f5e' : '#10b981'} 
                  strokeWidth={1.5}
                  fillOpacity={1} 
                  fill="url(#colorBalance)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-white dark:bg-[#0C0C0F] z-10 border-b border-neutral-100 dark:border-[#222222]">
            <tr>
              <th className="px-2 py-1.5 text-left text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em] w-20">Date</th>
              <th className="px-2 py-1.5 text-left text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em]">Particulars</th>
              <th className="px-2 py-1.5 text-left text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em] md:w-48 whitespace-nowrap overflow-hidden">Remarks</th>
              <th className="px-2 py-1.5 text-right text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em] w-20">Amount</th>
              <th className="px-2 py-1.5 text-right text-[7px] font-black text-neutral-400 uppercase tracking-[0.2em] w-20">Balance</th>
            </tr>
          </thead>
          <tbody>
            {/* System Start Balance - Always at the Peak */}
            <tr className="bg-brand-blue/[0.02] dark:bg-white/[0.01] border-b border-neutral-100/50 dark:border-[#222222]">
              <td className="px-2 py-2 whitespace-nowrap"><span className="text-[9px] font-black text-neutral-400 uppercase tracking-tighter">{account.startingBalanceDate ? format(new Date(account.startingBalanceDate), 'dd MMM yyyy') : '-'}</span></td>
              <td className="px-2 py-2"><span className="text-[9px] font-black text-brand-blue/50 dark:text-white/40 uppercase tracking-widest">System Start Balance</span></td>
              <td className="px-2 py-2 opacity-50"><span className="text-[9px]">-</span></td>
              <td className="px-2 py-2 text-right whitespace-nowrap"><span className="text-[11px] font-black text-neutral-200">-</span></td>
              <td className="px-2 py-2 text-right whitespace-nowrap"><span className="text-[10px] font-black text-brand-blue/70 dark:text-white/60 tracking-tighter">{currency}{account.startingBalance.toLocaleString()}</span></td>
            </tr>

            {filteredStatementData.map((tx, idx) => {
              // Find any partitions that occurred between the previous transaction and this one
              const txTime = new Date(tx.dateTime).getTime();
              const originalIdx = statementData.findIndex(t => t.id === tx.id);
              const prevTxTime = originalIdx > 0 
                ? new Date(statementData[originalIdx - 1].dateTime).getTime() 
                : (account.startingBalanceDate ? new Date(account.startingBalanceDate).getTime() : 0);
              
              const matchingClosings = closings.filter(c => {
                const cTime = new Date(c.closingDate).getTime();
                return cTime > prevTxTime && cTime <= txTime;
              });

              return (
                <React.Fragment key={tx.id}>
                  {matchingClosings.map(c => (
                    <PartitionRow key={c.id} partition={c} />
                  ))}
                  <tr onDoubleClick={() => handleCreatePartitionAt(tx)} className="border-b border-neutral-50 dark:border-white/[0.02] hover:bg-neutral-50/50 dark:hover:bg-white/[0.01] transition-colors">
                    <td className="px-2 py-2 whitespace-nowrap"><span className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">{format(new Date(tx.dateTime), 'dd MMM HH:mm')}</span></td>
                    <td className="px-2 py-2"><span className="text-[10px] font-black text-neutral-700 dark:text-neutral-300 uppercase truncate max-w-[120px] block">{tx.party || '-'}</span></td>
                    <td className="px-2 py-2"><span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 italic truncate max-w-[150px] block">{tx.note || '-'}</span></td>
                    <td className="px-2 py-2 text-right whitespace-nowrap"><span className={`text-[11px] font-black tracking-tighter ${normalizeType(tx.type) === 'CREDIT' ? 'text-emerald-500' : 'text-rose-500'}`}>{normalizeType(tx.type) === 'CREDIT' ? '+' : '-'}{currency}{tx.amount.toLocaleString()}</span></td>
                    <td className="px-2 py-2 text-right whitespace-nowrap"><span className="text-[10px] font-black text-brand-blue/70 dark:text-white/60 tracking-tighter">{currency}{tx.runningBalance.toLocaleString()}</span></td>
                  </tr>
                </React.Fragment>
              );
            })}

            {/* Handle Partitions that happened AFTER the last transaction in the current view */}
            {(() => {
                const lastTxTimeInView = filteredStatementData.length > 0 
                    ? new Date(filteredStatementData[filteredStatementData.length - 1].dateTime).getTime() 
                    : (account.startingBalanceDate ? new Date(account.startingBalanceDate).getTime() : 0);
                
                const trailingClosings = closings.filter(c => {
                    const cTime = new Date(c.closingDate).getTime();
                    return cTime > lastTxTimeInView && cTime <= endDateLimit;
                });

                return trailingClosings.map(c => (
                    <PartitionRow key={c.id} partition={c} />
                ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── ACCOUNTS REORDER MODAL ──────────────────────────────────────────────────
function AccountsReorderModal({ onClose }: { onClose: () => void }) {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const [localAccounts, setLocalAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (accounts.length > 0 && localAccounts.length === 0) {
      const sorted = [...accounts].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      setLocalAccounts(sorted);
    }
  }, [accounts, localAccounts.length]);

  const handleSave = async () => {
    try {
      await db.transaction('rw', db.accounts, async () => {
        for (let i = 0; i < localAccounts.length; i++) {
          const acc = localAccounts[i];
          if (acc.id) {
            await db.accounts.update(acc.id, { sortOrder: i + 1 });
          }
        }
      });
      onClose();
    } catch (err) {
      console.error('Failed to save accounts order:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-2xl p-6 max-w-md w-full mx-4 animate-scale-up">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-neutral-50 dark:border-white/5">
          <h3 className="text-sm font-heading font-black text-brand-blue dark:text-white uppercase tracking-wider">Arrange Accounts Order</h3>
          <button onClick={onClose} className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 hover:text-brand-red uppercase tracking-wider transition-colors">Cancel</button>
        </div>

        {localAccounts.length === 0 ? (
          <p className="text-[10px] text-center text-neutral-400 py-10 uppercase tracking-widest font-bold">No accounts found</p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto no-scrollbar pr-1 -mx-2 px-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            <p className="text-[9px] font-bold text-neutral-400 mb-3 uppercase tracking-widest text-center">Drag and drop to reorder</p>
            <Reorder.Group axis="y" values={localAccounts} onReorder={setLocalAccounts} className="space-y-2 pb-2">
              {localAccounts.map(acc => {
                const isCash = acc.type === 'CASH';
                return (
                  <Reorder.Item 
                    key={acc.id} 
                    value={acc}
                    className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#1A1A1A] border border-neutral-100 dark:border-white/5 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow relative z-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 pointer-events-none">
                      <div className="w-8 h-8 bg-neutral-50 dark:bg-white/5 rounded-lg flex items-center justify-center p-1.5 shadow-sm shrink-0 border border-neutral-100 dark:border-white/5">
                        <BankLogo bankName={acc.bankName} type={acc.type} className="w-full h-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-neutral-800 dark:text-white truncate uppercase tracking-tight leading-none mb-0.5">{acc.bankName}</p>
                        <p className="text-[8px] font-bold text-neutral-400 font-mono">
                          {isCash ? 'TOTAL CASH' : `•••• ${acc.accountLast4}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-neutral-400 cursor-grab">
                      <div className="w-7 h-7 flex items-center justify-center bg-neutral-50 dark:bg-white/5 rounded-lg">
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-neutral-50 dark:border-white/5">
          <button onClick={onClose} className="px-4 py-2 text-[10px] font-bold text-neutral-400 hover:text-neutral-500 uppercase transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-5 py-2 bg-brand-green text-white dark:text-brand-blue rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-brand-green/10 transition-all hover:brightness-110 active:scale-95">Save Order</button>
        </div>
      </div>
    </div>
  );
}

// ── QUICK TRANSFER WIZARD ───────────────────────────────────────────────────
function QuickTransferModal({ onClose }: { onClose: () => void }) {
  const currency = useCurrency();
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Default select accounts
  useEffect(() => {
    if (accounts.length > 0) {
      setFromAccountId(accounts[0].id!.toString());
      if (accounts.length > 1) {
        setToAccountId(accounts[1].id!.toString());
      }
    }
  }, [accounts]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccountId || !toAccountId || !amount) return;
    if (fromAccountId === toAccountId) {
      setError('Source and destination accounts cannot be the same.');
      return;
    }
    const amountVal = parseFloat(amount) || 0;
    if (amountVal <= 0) {
      setError('Please enter a valid transfer amount.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const fromAcc = accounts.find(a => a.id === Number(fromAccountId));
      const toAcc = accounts.find(a => a.id === Number(toAccountId));
      if (!fromAcc || !toAcc) throw new Error('Selected accounts not found');

      const isTodaySelected = date === new Date().toISOString().split('T')[0];
      const finalDateTime = isTodaySelected ? new Date() : new Date(date);

      // Create linked DEBIT and CREDIT transactions
      const debitId = await db.transactions.add({
        accountId: Number(fromAccountId),
        amount: amountVal,
        type: 'DEBIT',
        dateTime: finalDateTime,
        note: note || `Transfer to ${toAcc.bankName}`,
        category: 'Transfer',
        party: toAcc.bankName
      });

      const creditId = await db.transactions.add({
        accountId: Number(toAccountId),
        amount: amountVal,
        type: 'CREDIT',
        dateTime: finalDateTime,
        note: note || `Transfer from ${fromAcc.bankName}`,
        category: 'Transfer',
        party: fromAcc.bankName,
        linkedTransactionId: debitId
      });

      await db.transactions.update(debitId, { linkedTransactionId: creditId });
      onClose();
    } catch (err) {
      console.error(err);
      setError('An error occurred during transfer.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-2xl p-6 max-w-md w-full mx-4 animate-scale-up">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-neutral-50 dark:border-white/5">
          <h3 className="text-sm font-heading font-black text-brand-blue dark:text-white uppercase tracking-wider">Quick Inter-Account Transfer</h3>
          <button onClick={onClose} className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 hover:text-brand-red uppercase tracking-wider">Cancel</button>
        </div>

        <form onSubmit={handleTransfer} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold uppercase tracking-wider">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[8px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-1.5">Source Account (Transfer From)</label>
            <select
              value={fromAccountId}
              onChange={e => setFromAccountId(e.target.value)}
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-[#333333] rounded-xl text-[11px] font-bold outline-none text-brand-blue dark:text-white"
              required
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id} className="text-black">{a.bankName} (•• {a.accountLast4})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[8px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-1.5">Destination Account (Transfer To)</label>
            <select
              value={toAccountId}
              onChange={e => setToAccountId(e.target.value)}
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-[#333333] rounded-xl text-[11px] font-bold outline-none text-brand-blue dark:text-white"
              required
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id} className="text-black" disabled={a.id!.toString() === fromAccountId}>{a.bankName} (•• {a.accountLast4})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[8px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-1.5">Amount ({currency})</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-[#333333] rounded-xl text-[11px] font-bold outline-none text-brand-blue dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-[8px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-[#333333] rounded-xl text-[11px] font-bold outline-none text-brand-blue dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[8px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-1.5">Remarks / Optional Notes</label>
            <input
              type="text"
              placeholder="e.g., Credit card bill payment, Wallet refill"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-[#333333] rounded-xl text-[11px] font-bold outline-none text-brand-blue dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-neutral-50 dark:border-white/5">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[10px] font-bold text-neutral-400 hover:text-neutral-500 uppercase">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-5 py-2 bg-brand-green text-white dark:text-brand-blue rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-brand-green/10">
              {isSaving ? 'Processing...' : 'Execute Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
