import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../lib/db';
import { Plus, Trash2, Pencil, ArrowDownLeft, ArrowUpRight, Wallet, CreditCard, Landmark, Download, FileText, CheckCircle2, History, Calendar, ChevronDown, Printer, MoreHorizontal, Scissors, Filter } from 'lucide-react';
import { BankLogo } from '../components/BankLogo';
import { INDIAN_BANKS, getBankByPattern } from '../components/BankLogosData';
import { format, startOfDay, parseISO, endOfMonth, startOfMonth, subMonths, endOfDay, startOfWeek, endOfWeek, startOfYear, endOfYear, addMonths, subWeeks, addWeeks, subDays, addDays, subYears, addYears } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Accounts() {
  const navigate = useNavigate();
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const [isAdding, setIsAdding] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [startingBalanceDate, setStartingBalanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [accountType, setAccountType] = useState<'BANK' | 'CASH' | 'CREDIT_CARD'>('BANK');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const allClosings = useLiveQuery(() => db.accountClosings.toArray()) || [];

  const [searchQuery, setSearchQuery] = useState('');

  const accountBreakdown = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now).getTime();
    const monthEnd = endOfMonth(now).getTime();

    return accounts.reduce((acc, account) => {
      const allAccountTxs = allTransactions
        .filter(tx => Number(tx.accountId) === Number(account.id))
        .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      
      // 1. Calculate Actual Total Balance (Entire History)
      let totalBalance = Number(account.startingBalance) || 0;
      allAccountTxs.forEach(tx => {
        if (tx.type === 'CREDIT') totalBalance += (Number(tx.amount) || 0);
        else if (tx.type === 'DEBIT') totalBalance -= (Number(tx.amount) || 0);
      });

      // 2. Calculate Inflow/Outflow for Current Month
      const currentMonthTxs = allAccountTxs.filter(tx => {
        const time = new Date(tx.dateTime).getTime();
        return time >= monthStart && time <= monthEnd;
      });

      const inflow = currentMonthTxs.filter(tx => tx.type === 'CREDIT').reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const outflow = currentMonthTxs.filter(tx => tx.type === 'DEBIT').reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      
      // 3. Get Recent Activity
      const recentActivity = allAccountTxs.slice(0, 3);

      acc[account.id!] = { inflow, outflow, currentBalance: totalBalance, recentActivity };
      return acc;
    }, {} as Record<number, { inflow: number, outflow: number, currentBalance: number, recentActivity: Transaction[] }>);
  }, [accounts, allTransactions]); // Only depend on accounts and allTransactions

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountLast4 || !startingBalance) return;

    if (editingAccountId) {
      await db.accounts.update(editingAccountId, {
        bankName,
        accountLast4,
        startingBalance: parseFloat(startingBalance.toString().replace(/,/g, '')) || 0,
        startingBalanceDate: new Date(startingBalanceDate),
        type: accountType
      });
    } else {
      await db.accounts.add({
        bankName,
        accountLast4,
        startingBalance: parseFloat(startingBalance.toString().replace(/,/g, '')) || 0,
        startingBalanceDate: new Date(startingBalanceDate),
        type: accountType
      });
    }

    resetForm();
  };

  const resetForm = () => {
    setBankName('');
    setAccountLast4('');
    setStartingBalance('');
    setStartingBalanceDate(new Date().toISOString().split('T')[0]);
    setAccountType('BANK');
    setIsAdding(false);
    setEditingAccountId(null);
  };

  const handleEdit = (account: any) => {
    setBankName(account.bankName);
    setAccountLast4(account.accountLast4);
    setStartingBalance(account.startingBalance.toString());
    setStartingBalanceDate(account.startingBalanceDate ? new Date(account.startingBalanceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    setAccountType(account.type || 'BANK');
    setEditingAccountId(account.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      await db.accounts.delete(id);
      // Also delete associated transactions
      const txs = await db.transactions.where('accountId').equals(id).toArray();
      for (const tx of txs) {
        if (tx.id) await db.transactions.delete(tx.id);
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
    return groups;
  }, [accounts]);

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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-4">
          <h1 className="text-4xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter mb-1">Accounts</h1>
          <div className="flex flex-wrap items-center gap-4">
             <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-[24px] border border-brand-blue/5 dark:border-white/5 shadow-sm min-w-[140px]">
               <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none block mb-1.5">Net Worth</span>
               <p className="text-2xl font-heading font-black text-brand-blue dark:text-brand-cyan tracking-tighter">
                 ₹{Object.values(accountBreakdown).reduce((sum, b) => sum + (b.currentBalance || 0), 0).toLocaleString('en-IN')}
               </p>
             </div>
             <div className="bg-white/50 dark:bg-white/5 backdrop-blur-sm p-4 rounded-[24px] border border-brand-green/10 dark:border-white/5 shadow-sm min-w-[140px]">
               <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none block mb-1.5">Total Liquid</span>
               <p className="text-2xl font-heading font-black text-brand-green tracking-tighter">
                 ₹{(Object.entries(accountBreakdown)
                    .filter(([id]) => accounts.find(a => a.id === Number(id))?.type !== 'CREDIT_CARD')
                    .reduce((sum, [, b]) => sum + (b.currentBalance || 0), 0)).toLocaleString('en-IN')}
               </p>
             </div>
             <div className="bg-[#FFF8F8] dark:bg-rose-500/5 backdrop-blur-sm p-4 rounded-[24px] border border-rose-100 dark:border-white/5 shadow-sm min-w-[140px]">
               <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none block mb-1.5">Liabilities</span>
               <p className="text-2xl font-heading font-black text-rose-500 tracking-tighter">
                 ₹{Math.abs(Object.entries(accountBreakdown)
                    .filter(([id]) => accounts.find(a => a.id === Number(id))?.type === 'CREDIT_CARD')
                    .reduce((sum, [, b]) => sum + (b.currentBalance || 0), 0)).toLocaleString('en-IN')}
               </p>
             </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bank or account..."
              className="pl-10 pr-4 py-3 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 rounded-2xl text-[12px] font-bold outline-none focus:ring-2 focus:ring-brand-blue/10 dark:focus:ring-white/5 transition-all w-full md:w-64"
            />
          </div>
          <button
            onClick={() => {
              if (isAdding) resetForm();
              else setIsAdding(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-brand-green text-white dark:text-brand-blue rounded-2xl hover:brightness-110 active:scale-95 transition-all font-black uppercase tracking-widest text-[11px] shadow-xl shadow-brand-green/20"
          >
            {isAdding && !editingAccountId ? <Plus className="w-4 h-4 rotate-45" /> : <Plus className="w-4 h-4" />}
            {isAdding && !editingAccountId ? 'Close' : 'Add'}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-[#F9FBFF] dark:bg-[#111111] p-6 rounded-[24px] shadow-[0_8px_40px_rgba(26,35,126,0.08)] border border-brand-blue/5 dark:border-[#222222]">
          <h2 className="text-xl font-heading font-semibold text-brand-blue dark:text-[#F7F7F7] mb-5 tracking-tight flex items-center gap-2">
            <div className="w-2 h-6 bg-brand-green rounded-full"></div>
            {editingAccountId ? 'Edit Account' : 'New Account'}
          </h2>

          <form onSubmit={handleAddAccount} className="space-y-5">
            <div className="flex bg-neutral-100 dark:bg-[#1A1A1A] p-1 rounded-xl mb-4">
              {(['BANK', 'CASH', 'CREDIT_CARD'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setAccountType(t);
                    if (t === 'CASH' && !bankName) setBankName('Cash Wallet');
                    if (t === 'CASH' && !accountLast4) setAccountLast4('CASH');
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    accountType === t
                      ? 'bg-brand-blue text-white shadow-lg scale-105'
                      : 'text-brand-blue/40 hover:text-brand-blue dark:hover:text-[#F7F7F7]'
                  }`}
                >
                  {t === 'BANK' && <Landmark className="w-4 h-4" />}
                  {t === 'CASH' && <Wallet className="w-4 h-4" />}
                  {t === 'CREDIT_CARD' && <CreditCard className="w-4 h-4" />}
                  {t.charAt(0) + t.slice(1).toLowerCase().replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-3">
                <label className="block text-sm font-black text-brand-blue dark:text-[#F7F7F7] mb-1.5 flex justify-between items-center uppercase tracking-wider">
                  <span>{accountType === 'BANK' ? 'Bank Name' : accountType === 'CASH' ? 'Wallet Name' : 'Card Name'}</span>
                  {accountType === 'BANK' && getBankByPattern(bankName) && (
                    <span className="text-[10px] bg-brand-green/10 text-brand-green px-2 py-0.5 rounded-full font-black uppercase">Logo Detected</span>
                  )}
                </label>

                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder={accountType === 'BANK' ? "e.g., State Bank of India or just 'SBI'" : accountType === 'CASH' ? "e.g., Cash Wallet" : "e.g., Amazon Pay ICICI Card"}
                  className="w-full px-4 py-3 border border-brand-blue/10 dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-brand-cyan focus:border-brand-blue outline-none transition-shadow mb-3 text-brand-blue font-bold"
                  required
                />
                
                {accountType !== 'CASH' && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-2 px-2">
                    {INDIAN_BANKS.map(bank => {
                      const isSelected = getBankByPattern(bankName)?.id === bank.id;
                      const Icon = bank.logo;
                      return (
                        <button
                          key={bank.id}
                          type="button"
                          onClick={() => setBankName(bank.name)}
                          className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-brand-blue text-white border-transparent shadow-lg scale-105'
                              : 'bg-white dark:bg-[#111111] text-brand-blue/60 dark:text-[#A0A0A0] hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] border-brand-blue/10 dark:border-[#222222] hover:border-brand-cyan'
                          }`}
                        >
                          <div className="w-5 h-5 bg-white rounded flex items-center justify-center p-0.5 shadow-sm shrink-0">
                            <Icon className="w-full h-full object-contain" />
                          </div>
                          <span className="text-[11px] font-semibold">{bank.id}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-brand-blue dark:text-[#F7F7F7] mb-1.5 uppercase tracking-[0.2em]">
                  {accountType === 'CASH' ? 'Reference' : 'Account Last 4'}
                </label>
                <input
                  type="text"
                  value={accountLast4}
                  onChange={(e) => setAccountLast4(e.target.value)}
                  placeholder={accountType === 'CASH' ? "e.g., WALLET" : "e.g., 1234"}
                  maxLength={accountType === 'CASH' ? 20 : 4}
                  className="w-full px-4 py-3 border border-brand-blue/10 dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-brand-cyan focus:border-brand-blue outline-none transition-shadow text-brand-blue font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-brand-blue dark:text-[#F7F7F7] mb-1.5 uppercase tracking-[0.2em]">Starting Balance (₹)</label>
                <input
                  type="number"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-4 py-3 border border-brand-blue/10 dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-brand-cyan focus:border-brand-blue outline-none transition-shadow text-brand-blue font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-brand-blue dark:text-[#F7F7F7] mb-1.5 uppercase tracking-[0.2em]">Starting Date</label>
                <input
                  type="date"
                  value={startingBalanceDate}
                  onChange={(e) => setStartingBalanceDate(e.target.value)}
                  className="w-full px-4 py-3 border border-brand-blue/10 dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-brand-cyan focus:border-brand-blue outline-none transition-shadow text-brand-blue font-bold"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#EBEBEB] dark:border-[#222222]">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 text-brand-blue dark:text-[#F7F7F7] hover:bg-brand-blue/5 dark:hover:bg-[#222222] font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] font-semibold rounded-xl hover:bg-brand-green/90 hover:ring-2 hover:ring-brand-cyan transition-all shadow-lg active:scale-95"
              >
                {editingAccountId ? 'Update Account' : 'Save Account'}
              </button>
            </div>
          </form>
        </div>
      )}      <div className="space-y-10">
        {(Object.entries(groupedAccounts) as [keyof typeof groupedAccounts, any[]][]).map(([type, accList]) => {
          if (accList.length === 0) return null;
          const { title, icon, color } = getGroupTitle(type);
          const total = getGroupTotal(accList);
          
          return (
            <div key={type} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 flex items-center justify-center shadow-sm ${color}`}>
                    {icon}
                  </div>
                  <div>
                    <h2 className="text-sm font-heading font-black text-brand-blue dark:text-white uppercase tracking-tight leading-none mb-1">{title}</h2>
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.2em]">{accList.length} Accounts Connected</span>
                  </div>
                </div>
                
                <div className="text-right">
                   <p className="text-[8px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">Category Total</p>
                   <p className="text-lg font-heading font-black text-brand-blue dark:text-white tracking-tighter">
                     ₹{total.toLocaleString('en-IN')}
                   </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {accList
                  .filter(a => searchQuery === '' || a.bankName.toLowerCase().includes(searchQuery.toLowerCase()) || a.accountLast4.includes(searchQuery))
                  .map(account => {
                    const info = accountBreakdown[account.id!];
                    const currentBalance = info?.currentBalance || 0;
                    const incomeToExpenseRatio = info ? (info.inflow > 0 ? Math.min((info.outflow / info.inflow) * 100, 100) : (info.outflow > 0 ? 100 : 0)) : 0;
                    
                    return (
                      <div 
                        key={account.id} 
                        onClick={() => setSelectedAccountId(account.id!)}
                        className="group relative bg-white dark:bg-[#111111] rounded-[32px] border border-neutral-100 dark:border-white/5 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col"
                      >
                        {/* Status bar top */}
                        <div className={`h-1.5 w-full ${
                          account.type === 'BANK' ? 'bg-brand-blue' : account.type === 'CASH' ? 'bg-brand-green' : 'bg-rose-500'
                        } opacity-40 group-hover:opacity-100 transition-opacity`} />

                        <div className="p-6 flex flex-col flex-1">
                          <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-neutral-100 dark:bg-white/5 rounded-[20px] flex items-center justify-center p-2.5 shadow-sm border border-neutral-200/50 dark:border-white/10 group-hover:scale-110 group-hover:bg-white dark:group-hover:bg-[#1A1A1A] transition-all">
                                <BankLogo bankName={account.bankName} type={account.type} className="w-full h-full object-contain" />
                              </div>
                              <div className="min-w-0">
                                 <h3 className="text-[13px] font-heading font-black text-neutral-800 dark:text-white tracking-tight uppercase truncate">{account.bankName}</h3>
                                 <div className="flex items-center gap-1.5">
                                   <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                                     {account.type === 'CASH' ? 'Liquid Cash' : `**** ${account.accountLast4}`}
                                   </span>
                                   {currentBalance < 2000 && account.type !== 'CREDIT_CARD' && (
                                     <div className="w-1.5 h-1.5 rounded-full bg-brand-red animate-pulse" />
                                   )}
                                 </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                               <button onClick={() => handleEdit(account)} className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-brand-blue hover:bg-brand-blue/5 transition-all"><Pencil className="w-3.5 h-3.5" /></button>
                               <button onClick={() => handleDelete(account.id!)} className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 hover:text-brand-red hover:bg-brand-red/5 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>

                          <div className="mb-6">
                            <div className="flex items-end justify-between mb-1">
                               <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Account Balance</p>
                               <p className={`text-[10px] font-bold ${incomeToExpenseRatio > 80 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                 {incomeToExpenseRatio.toFixed(0)}% Outflow
                               </p>
                            </div>
                            <p className={`text-3xl font-heading font-black tracking-tighter ${currentBalance >= 0 ? (account.type === 'CREDIT_CARD' ? 'text-brand-blue dark:text-white' : 'text-brand-green') : 'text-brand-red'} dark:text-brand-cyan mb-2`}>
                              ₹{currentBalance.toLocaleString('en-IN')}
                            </p>
                            <div className="h-1.5 w-full bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
                               <div className={`h-full transition-all duration-1000 ${incomeToExpenseRatio > 80 ? 'bg-rose-500' : 'bg-brand-green'}`} style={{ width: `${incomeToExpenseRatio}%` }} />
                            </div>
                          </div>

                          {/* Recent Activity Mini-Ledger */}
                          <div className="space-y-2 mb-6">
                             <p className="text-[8px] font-black text-neutral-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                               Recent Activity <div className="w-1 h-1 rounded-full bg-brand-green/30" />
                             </p>
                             {info?.recentActivity && info.recentActivity.length > 0 ? (
                               <div className="space-y-1.5">
                                 {info.recentActivity.map(tx => (
                                   <div key={tx.id} className="flex items-center justify-between py-1 border-b border-neutral-50 dark:border-white/[0.02] last:border-0 hover:bg-neutral-50/50 dark:hover:bg-white/[0.02] transition-colors rounded">
                                     <div className="flex flex-col min-w-0">
                                       <span className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300 truncate tracking-tight">{(tx.note || tx.category || 'Transaction').toUpperCase()}</span>
                                       <span className="text-[7px] font-bold text-neutral-400 uppercase">{format(new Date(tx.dateTime), 'dd MMM')}</span>
                                     </div>
                                     <span className={`text-[10px] font-black tracking-tight ${tx.type === 'CREDIT' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                       {tx.type === 'CREDIT' ? '+' : '-'}₹{Number(tx.amount).toLocaleString()}
                                     </span>
                                   </div>
                                 ))}
                               </div>
                             ) : (
                               <p className="text-[9px] font-bold text-neutral-300 dark:text-neutral-600 py-2 italic text-center">No recent transactions</p>
                             )}
                          </div>

                          <div className="pt-4 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col">
                                <span className="text-[7px] font-black text-neutral-400 uppercase">In</span>
                                <span className="text-[10px] font-black text-emerald-500">₹{info?.inflow.toLocaleString()}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[7px] font-black text-neutral-400 uppercase">Out</span>
                                <span className="text-[10px] font-black text-rose-500">₹{info?.outflow.toLocaleString()}</span>
                              </div>
                            </div>

                            <button 
                              onClick={e => { e.stopPropagation(); setSelectedAccountId(account.id!); }}
                              className="w-9 h-9 rounded-2xl bg-brand-green text-white dark:text-brand-blue flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-brand-green/20"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>

      {selectedAccountId && (
         <AccountStatementDetail 
            accountId={selectedAccountId} 
            onClose={() => setSelectedAccountId(null)} 
         />
      )}
    </div>
  );
}

function PartitionRow({ partition }: { partition: any }) {
  return (
    <tr className="bg-brand-blue/[0.05] dark:bg-brand-blue/[0.15] border-y border-brand-blue/10 dark:border-brand-blue/30">
      <td colSpan={5} className="px-2 py-2">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2.5">
            <span className="text-[8px] font-semibold text-brand-blue/60 dark:text-white/50 uppercase tracking-[0.2em]">New Start Balance</span>
            <span className="text-[11px] font-semibold text-brand-blue dark:text-white tracking-tight">₹{partition.closingBalance.toLocaleString()}</span>
          </div>
        </div>
      </td>
    </tr>
  );
}

function AccountStatementDetail({ accountId, onClose }: { accountId: number, onClose: () => void }) {
  const navigate = useNavigate();
  const account = useLiveQuery(() => db.accounts.get(accountId));
  const transactions = useLiveQuery(() => 
    db.transactions.where('accountId').equals(accountId).sortBy('dateTime')
  ) || [];
  
  const closings = useLiveQuery(() => 
    db.accountClosings.where('accountId').equals(accountId).sortBy('closingDate')
  ) || [];

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [granularity, setGranularity] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM'>('MONTH');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customRange, setCustomRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [showFilterMenu, setShowFilterMenu] = useState(false);




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

    // Calculate initial running balance for transactions before the start date limit
    // to ensure the running balance in the visible list is correct relative to starting balance.
    let runningBalance = baseBalance;
    const allSortedTxs = [...transactions].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    
    // Split transactions into "before current view" and "in current view"
    const txsBefore = allSortedTxs.filter(tx => new Date(tx.dateTime).getTime() < startDateLimit);
    const txsInView = allSortedTxs.filter(tx => {
      const txTime = new Date(tx.dateTime).getTime();
      return txTime >= startDateLimit && txTime <= endDateLimit;
    });

    txsBefore.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'CREDIT') runningBalance += amount;
      else if (tx.type === 'DEBIT') runningBalance -= amount;
    });

    return txsInView.map(tx => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'CREDIT') runningBalance += amount;
      else if (tx.type === 'DEBIT') runningBalance -= amount;
      return { ...tx, amount, runningBalance } as Transaction & { runningBalance: number };
    });
  }, [account, transactions, granularity, referenceDate, customRange]) as (Transaction & { runningBalance: number })[];
    

  const totalCredit = statementData.filter(t => t.type === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);
  const totalDebit = statementData.filter(t => t.type === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0);

  const actualTotalBalance = useMemo(() => {
    let bal = Number(account?.startingBalance) || 0;
    // We must use the full account history for the header balance
    transactions.forEach(tx => {
       if (tx.type === 'CREDIT') bal += (Number(tx.amount) || 0);
       else if (tx.type === 'DEBIT') bal -= (Number(tx.amount) || 0);
    });
    return bal;
  }, [account?.startingBalance, transactions]);

  // Current balance shown in statement summary should be the running balance of the NEWEST transaction in view
  const currentViewStateBalance = statementData.length > 0 
    ? statementData[statementData.length - 1].runningBalance 
    : actualTotalBalance;

  const openingBalanceForView = currentViewStateBalance - totalCredit + totalDebit;


  const downloadCSV = () => {
    if (!account) return;
    const headers = ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'];
    const rows = statementData.map(tx => [
      format(new Date(tx.dateTime), 'yyyy-MM-dd HH:mm'),
      (tx.note || tx.category || '').toUpperCase(),
      tx.type === 'DEBIT' ? tx.amount : '',
      tx.type === 'CREDIT' ? tx.amount : '',
      tx.runningBalance
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

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
    doc.text(`Closing Balance: INR ${currentViewStateBalance.toLocaleString()}`, 14, 45);

    autoTable(doc, {
      startY: 55,
      head: [['Date', 'Particulars', 'Debit (Dr)', 'Credit (Cr)', 'Balance']],
      body: statementData.map(tx => [
        format(new Date(tx.dateTime), 'dd MMM yyyy'),
        (tx.note || tx.category || '').toUpperCase(),
        tx.type === 'DEBIT' ? `INR ${tx.amount.toLocaleString()}` : '-',
        tx.type === 'CREDIT' ? `INR ${tx.amount.toLocaleString()}` : '-',
        `INR ${tx.runningBalance.toLocaleString()}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [26, 35, 126] }
    });

    doc.save(`${account.bankName}_Statement_${format(new Date(), 'dd_MMM_yyyy')}.pdf`);
    setShowExportMenu(false);
  };

  const handleStartNewBalance = async () => {
    if (!account) return;
    const confirmReset = window.confirm(`Start a new balance period? This will create a partition in your history and show the final totals for the current period.`);
    if (!confirmReset) return;

    // Calculate current period totals for the partition
    const lastClosing = closings.length > 0 ? closings[closings.length - 1] : null;
    const startLimit = lastClosing ? new Date(lastClosing.closingDate).getTime() : (account.startingBalanceDate ? new Date(account.startingBalanceDate).getTime() : 0);
    
    // We get ALL transactions to calculate current live period totals correctly
    const liveTxs = transactions.filter(tx => {
      const txTime = new Date(tx.dateTime).getTime();
      // Use a 1ms grace period to ensure we catch everything since the last closure
      return txTime > startLimit;
    });
    const inflow = liveTxs.filter(t => t.type === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);
    const outflow = liveTxs.filter(t => t.type === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0);
    const opening = lastClosing ? lastClosing.closingBalance : account.startingBalance;

    await db.accountClosings.add({
      accountId: account.id!,
      closingDate: new Date(),
      closingBalance: actualTotalBalance,
      periodName: format(new Date(), 'dd MMM yyyy'),
      openingBalance: opening,
      totalInflow: inflow,
      totalOutflow: outflow
    });
    
    alert(`Period closed! Balance of ₹${actualTotalBalance.toLocaleString()} is now your new starting point.`);
  };

  const handleCreatePartitionAt = async (targetTx: Transaction & { runningBalance: number }) => {
    if (!account) return;
    const confirmReset = window.confirm(`Start a new balance period from this transaction? Current balance here is ₹${targetTx.runningBalance.toLocaleString()}.`);
    if (!confirmReset) return;

    // We set the partition time precisely at the transaction time + 1ms to include it
    const partitionTime = new Date(targetTx.dateTime).getTime() + 1;
    const prevClosing = [...closings]
        .filter(c => new Date(c.closingDate).getTime() < partitionTime)
        .sort((a,b) => new Date(b.closingDate).getTime() - new Date(a.closingDate).getTime())[0];

    // If it's the first partition ever, we look back to the start of time
    const startLimit = prevClosing 
      ? new Date(prevClosing.closingDate).getTime() 
      : (account.startingBalanceDate ? new Date(account.startingBalanceDate).setHours(0,0,0,0) - 1 : 0);
    
    const periodTxs = transactions.filter(tx => {
        const time = new Date(tx.dateTime).getTime();
        return time > startLimit && time < partitionTime;
    });

    const inflow = periodTxs.filter(t => t.type === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);
    const outflow = periodTxs.filter(t => t.type === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0);
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
    
    alert(`Success! History partitioned at ₹${targetTx.runningBalance.toLocaleString()}.`);
  };

  if (!account) return null;

  return (
    <div className="fixed inset-0 bg-white dark:bg-[#060608] z-[100] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="bg-neutral-50 dark:bg-[#0C0C0F] border-b border-neutral-200 dark:border-[#222222] px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 bg-white dark:bg-[#1A1A1A] rounded-lg flex items-center justify-center p-0.5 border border-neutral-100 dark:border-[#333333]">
              <BankLogo bankName={account.bankName} type={account.type} className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-[11px] font-semibold text-brand-blue dark:text-[#F7F7F7] uppercase tracking-widest leading-none mb-0.5">{account.bankName}</h2>
              <div className="flex items-center gap-1">
                <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest leading-none">{account.accountLast4}</p>
                <div className="w-0.5 h-0.5 rounded-full bg-neutral-300" />
                <p className="text-[8px] font-semibold text-brand-blue/60 dark:text-white/60 uppercase">₹{actualTotalBalance.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setShowFilterMenu(!showFilterMenu)} 
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${showFilterMenu ? 'bg-brand-blue text-white' : 'bg-neutral-200 dark:bg-[#222222] text-brand-blue dark:text-[#F7F7F7] hover:bg-neutral-300'}`}
            >
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
              <button
                key={g}
                onClick={() => {
                  setGranularity(g);
                  setShowFilterMenu(false);
                }}
                className={`flex-1 px-2.5 py-1.5 rounded-lg text-[8px] font-semibold uppercase tracking-[0.1em] transition-all shrink-0 ${
                  granularity === g 
                    ? 'bg-white dark:bg-[#333333] text-brand-blue dark:text-white shadow-sm' 
                    : 'text-neutral-400 hover:text-neutral-500'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        )}

        <div className="mt-2 flex flex-col gap-1.5">
          <div className="bg-white dark:bg-[#111111] px-2 py-1.5 rounded-xl shadow-sm border border-neutral-100 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <p className="text-[6px] font-semibold text-neutral-400 uppercase tracking-[0.1em]">Opening</p>
                <p className="text-[10px] font-semibold text-brand-blue/50 dark:text-white/40">₹{openingBalanceForView.toLocaleString()}</p>
              </div>
              <div className="w-px h-5 bg-neutral-100 dark:bg-white/10" />
              <div className="flex flex-col">
                <p className="text-[6px] font-semibold text-neutral-400 uppercase tracking-[0.1em]">Closing</p>
                <p className="text-[10px] font-semibold text-brand-blue dark:text-white">₹{currentViewStateBalance.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 italic">
              <span className="text-[8px] font-bold text-brand-green">IN: ₹{totalCredit.toLocaleString()}</span>
              <span className="text-[8px] font-bold text-brand-red">OUT: ₹{totalDebit.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button 
              onClick={handleStartNewBalance}
              className="flex items-center justify-center gap-1.5 bg-brand-green text-white py-1.5 rounded-lg font-semibold text-[8px] uppercase tracking-[0.1em]"
            >
              <Plus className="w-2.5 h-2.5" />
              New Start Balance
            </button>
            <div className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="w-full flex items-center justify-center gap-1.5 bg-white dark:bg-[#1A1A1A] text-brand-blue dark:text-white py-1.5 rounded-lg border border-neutral-100 dark:border-[#222222] font-semibold text-[8px] uppercase tracking-[0.1em]"
              >
                <Download className="w-2.5 h-2.5" />
                Export Ledger
              </button>
              {showExportMenu && (
                <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-[#1C1C22] shadow-2xl shadow-black/20 rounded-xl border border-neutral-100 dark:border-[#222222] z-[110] overflow-hidden flex flex-col">
                  <button onClick={downloadPDF} className="p-3 text-left text-[10px] font-black text-brand-blue dark:text-white hover:bg-neutral-50 dark:hover:bg-white/5 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-brand-red" /> PDF STATEMENT
                  </button>
                  <button onClick={downloadCSV} className="p-3 text-left text-[10px] font-black text-brand-blue dark:text-white hover:bg-neutral-50 dark:hover:bg-white/5 flex items-center gap-2 border-t border-neutral-100 dark:border-white/5">
                    <Printer className="w-3.5 h-3.5 text-brand-green" /> CSV LEDGER
                  </button>
                  <button 
                    onClick={() => navigate(`/reports?accountId=${account.id}`)} 
                    className="p-3 text-left text-[10px] font-black text-brand-blue dark:text-white hover:bg-neutral-50 dark:hover:bg-white/5 flex items-center gap-2 border-t border-neutral-100 dark:border-white/5 bg-brand-blue/5"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5 text-brand-cyan" /> ADVANCED REPORTS
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Date Navigator (condensed) */}
        <div className="mt-1.5 flex flex-col gap-1">
          {granularity === 'CUSTOM' && (
            <div className="flex items-center justify-between bg-neutral-100 dark:bg-[#1A1A1A] px-2 py-1.5 rounded-lg">
              <input 
                type="date"
                value={customRange.start}
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent text-[8px] font-black text-brand-blue dark:text-white outline-none"
              />
              <span className="text-[7px] font-black text-neutral-400 mx-1">TO</span>
              <input 
                type="date"
                value={customRange.end}
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent text-[8px] font-black text-brand-blue dark:text-white outline-none"
              />
            </div>
          )}

          {granularity !== 'ALL' && granularity !== 'CUSTOM' && (
            <div className="flex items-center justify-center gap-2 bg-neutral-100 dark:bg-[#1A1A1A] py-1 rounded-lg">
              <button 
                onClick={() => {
                  if (granularity === 'DAY') setReferenceDate(subDays(referenceDate, 1));
                  if (granularity === 'WEEK') setReferenceDate(subWeeks(referenceDate, 1));
                  if (granularity === 'MONTH') setReferenceDate(subMonths(referenceDate, 1));
                  if (granularity === 'YEAR') setReferenceDate(subYears(referenceDate, 1));
                }}
                className="p-1 text-brand-blue dark:text-neutral-400 active:scale-90"
              >
                <ChevronDown className="w-3.5 h-3.5 rotate-90" />
              </button>
              <span className="text-[9px] font-black text-brand-blue dark:text-white min-w-[70px] text-center uppercase tracking-widest">
                {granularity === 'DAY' && format(referenceDate, 'dd MMM yy')}
                {granularity === 'WEEK' && `Wk ${format(referenceDate, 'ww, yy')}`}
                {granularity === 'MONTH' && format(referenceDate, 'MMM yyyy')}
                {granularity === 'YEAR' && format(referenceDate, 'yyyy')}
              </span>
              <button 
                onClick={() => {
                  if (granularity === 'DAY') setReferenceDate(addDays(referenceDate, 1));
                  if (granularity === 'WEEK') setReferenceDate(addWeeks(referenceDate, 1));
                  if (granularity === 'MONTH') setReferenceDate(addMonths(referenceDate, 1));
                  if (granularity === 'YEAR') setReferenceDate(addYears(referenceDate, 1));
                }}
                className="p-1 text-brand-blue dark:text-neutral-400 active:scale-90"
              >
                <ChevronDown className="w-3.5 h-3.5 -rotate-90" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="flex-1 overflow-auto bg-white dark:bg-[#060608] pb-32">
        <table className="w-full border-collapse border-spacing-0 text-[10px] min-w-[320px]">
          <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-[#111111] shadow-sm">
            <tr className="text-[8.5px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest border-b border-neutral-200 dark:border-[#222222]">
              <th className="w-14 px-2 py-2.5 text-left">Date</th>
              <th className="px-2 py-2.5 text-left">Particulars</th>
              <th className="w-20 px-2 py-2.5 text-right">Debit (Dr)</th>
              <th className="w-20 px-2 py-2.5 text-right">Credit (Cr)</th>
              <th className="w-24 px-2 py-2.5 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#0C0C0F]">
            {/* ABSOLUTE START: Initial Opening Balance Row */}
            {/* Only show if we are looking at the 'ALL' view OR if the start of current period is before/at the first transaction */}
            {(granularity === 'ALL' || startDateLimit <= (account.startingBalanceDate ? new Date(account.startingBalanceDate).getTime() : Date.now())) && (
              <tr className="bg-neutral-50/40 dark:bg-white/[0.02] border-b border-dotted border-neutral-200 dark:border-white/10">
                <td className="px-2 py-2 text-center border-r border-neutral-100 dark:border-white/5">
                  <span className="text-[8px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-tighter">INIT</span>
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-col">
                    <p className="text-[10px] font-black text-brand-blue/50 dark:text-white/40 uppercase tracking-wider leading-none">Opening Balance</p>
                    <p className="text-[8px] text-neutral-500 font-bold mt-1 uppercase tracking-tight">Account System Start</p>
                  </div>
                </td>
                <td className="px-2 py-2 text-right"></td>
                <td className="px-2 py-2 text-right"></td>
                <td className="px-2 py-2 text-right font-black text-brand-blue dark:text-white text-[10.5px]">
                  ₹{account.startingBalance.toLocaleString()}
                </td>
              </tr>
            )}

            {statementData.map((tx, idx) => {
              const prevTx = idx > 0 ? statementData[idx-1] : null;
              const partitionInBetween = closings.find(c => {
                const cTime = new Date(c.closingDate).getTime();
                const txTime = new Date(tx.dateTime).getTime();
                const prevTxTime = prevTx ? new Date(prevTx.dateTime).getTime() : 0;
                return cTime <= txTime && cTime > prevTxTime;
              });

              return (
                <React.Fragment key={tx.id || idx}>
                  {partitionInBetween && <PartitionRow partition={partitionInBetween} />}
                  <tr className="border-b border-neutral-100 dark:border-[#1A1A1A] hover:bg-neutral-50 transition-colors group">
                    <td className="px-2 py-2 text-neutral-600 dark:text-neutral-400 text-[10px] text-center font-black border-r border-neutral-50 dark:border-white/5">
                      <div className="flex flex-col items-center justify-center relative">
                        <button 
                          onClick={() => handleCreatePartitionAt(tx)}
                          title="Start New Balance from here"
                          className="absolute inset-0 z-20 flex items-center justify-center bg-white dark:bg-[#0C0C0F] opacity-0 group-hover:opacity-100 transition-opacity active:scale-90"
                        >
                          <Scissors className="w-4 h-4 text-brand-blue dark:text-brand-cyan" />
                        </button>
                        <span className="leading-tight">{format(new Date(tx.dateTime), 'dd')}</span>
                        <span className="text-[7.5px] uppercase tracking-tighter leading-none font-bold">{format(new Date(tx.dateTime), 'MMM')}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <p className="font-black text-brand-blue dark:text-[#F7F7F7] text-[11px] leading-tight truncate uppercase tracking-tight">
                        {tx.party || tx.category || 'N/A'}
                      </p>
                      {tx.note && (
                        <p className="text-[8.5px] text-neutral-500 dark:text-neutral-400 font-bold mt-0.5 leading-tight uppercase tracking-tight">
                          {tx.note}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-bold text-[10.5px]">
                      {tx.type === 'DEBIT' && <span className="text-brand-red font-black">₹{tx.amount.toLocaleString('en-IN')}</span>}
                      {tx.type !== 'DEBIT' && <span className="text-neutral-200 dark:text-white/5"></span>}
                    </td>
                    <td className="px-2 py-2 text-right font-bold text-[10.5px]">
                      {tx.type === 'CREDIT' && <span className="text-brand-green font-black">₹{tx.amount.toLocaleString('en-IN')}</span>}
                      {tx.type !== 'CREDIT' && <span className="text-neutral-200 dark:text-white/5"></span>}
                    </td>
                    <td className={`px-2 py-2 text-right font-black text-[11px] ${tx.runningBalance >= 0 ? 'text-brand-blue dark:text-white' : 'text-brand-red'}`}>
                      ₹{tx.runningBalance.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}

            {/* Partitions that happened AFTER the last transaction within view limits */}
            {closings
              .filter(c => {
                const cTime = new Date(c.closingDate).getTime();
                const lastTxTime = statementData.length > 0 ? new Date(statementData[statementData.length - 1].dateTime).getTime() : 0;
                // Partition must be after last transaction AND within current selected period
                return cTime > lastTxTime && cTime <= endDateLimit && cTime >= startDateLimit;
              })
              .map(c => (
                <PartitionRow key={c.id} partition={c} />
              ))
            }
            
            {statementData.length === 0 && closings.filter(c => {
               const cTime = new Date(c.closingDate).getTime();
               return cTime >= startDateLimit && cTime <= endDateLimit;
            }).length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center">
                  <p className="text-[9px] font-black text-neutral-200 uppercase tracking-widest">No Transactions in this period</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
