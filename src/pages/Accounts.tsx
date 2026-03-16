import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction } from '../lib/db';
import { Plus, Trash2, Pencil, ArrowDownLeft, ArrowUpRight, Wallet, CreditCard, Landmark, Download, FileText, CheckCircle2, History, Calendar, ChevronDown, Printer, MoreHorizontal } from 'lucide-react';
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

  const accountBreakdown = useMemo(() => {
    return accounts.reduce((acc, account) => {
      const accountClosings = allClosings
        .filter(c => c.accountId === account.id)
        .sort((a, b) => new Date(b.closingDate).getTime() - new Date(a.closingDate).getTime());
      
      const latestClosing = accountClosings[0];
      const startLimit = latestClosing 
        ? new Date(latestClosing.closingDate).getTime() + 1
        : (account.startingBalanceDate ? startOfDay(new Date(account.startingBalanceDate)).getTime() : 0);

      const txs = allTransactions.filter(tx => 
        Number(tx.accountId) === Number(account.id) && 
        new Date(tx.dateTime).getTime() >= startLimit
      );

      const inflow = txs.filter(tx => tx.type === 'CREDIT').reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      const outflow = txs.filter(tx => tx.type === 'DEBIT').reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
      
      const baseBalance = latestClosing ? latestClosing.closingBalance : Number(account.startingBalance);
      const currentBalance = baseBalance + inflow - outflow;

      acc[account.id!] = { inflow, outflow, currentBalance };
      return acc;
    }, {} as Record<number, { inflow: number, outflow: number, currentBalance: number }>);
  }, [accounts, allTransactions, allClosings]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountLast4 || !startingBalance) return;

    if (editingAccountId) {
      await db.accounts.update(editingAccountId, {
        bankName,
        accountLast4,
        startingBalance: parseFloat(startingBalance),
        startingBalanceDate: new Date(startingBalanceDate),
        type: accountType
      });
    } else {
      await db.accounts.add({
        bankName,
        accountLast4,
        startingBalance: parseFloat(startingBalance),
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">Accounts</h1>

        <button
          onClick={() => {
            if (isAdding) {
              resetForm();
            } else {
              setIsAdding(true);
            }
          }}
          className="flex items-center gap-2 px-6 py-3 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-xl hover:bg-brand-green/90 hover:ring-2 hover:ring-brand-cyan transition-all font-black shadow-lg shadow-brand-green/10 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          {isAdding && !editingAccountId ? 'Cancel' : 'Add New'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white dark:bg-[#111111] p-6 rounded-[24px] shadow-[0_8px_40px_rgba(26,35,126,0.08)] border border-brand-blue/5 dark:border-[#222222]">
          <h2 className="text-xl font-black text-brand-blue dark:text-[#F7F7F7] mb-5 tracking-tight flex items-center gap-2">
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
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black transition-all ${
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
                          <span className="text-[11px] font-bold">{bank.id}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-black text-brand-blue dark:text-[#F7F7F7] mb-1.5 uppercase tracking-wider">
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
                <label className="block text-sm font-black text-brand-blue dark:text-[#F7F7F7] mb-1.5 uppercase tracking-wider">Starting Balance (₹)</label>
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
                <label className="block text-sm font-black text-brand-blue dark:text-[#F7F7F7] mb-1.5 uppercase tracking-wider">Starting Date</label>
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
                className="px-6 py-3 text-brand-blue dark:text-[#F7F7F7] hover:bg-brand-blue/5 dark:hover:bg-[#222222] font-black rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] font-black rounded-xl hover:bg-brand-green/90 hover:ring-2 hover:ring-brand-cyan transition-all shadow-lg active:scale-95"
              >
                {editingAccountId ? 'Update Account' : 'Save Account'}
              </button>
            </div>
          </form>
        </div>
      )}      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map(account => {
          const info = accountBreakdown[account.id!];
          const currentBalance = info?.currentBalance || 0;
          return (
            <div 
              key={account.id} 
              onClick={() => setSelectedAccountId(account.id!)}
              className="bg-white dark:bg-[#111111] p-6 rounded-[24px] shadow-[0_6px_16px_rgba(26,35,126,0.04)] border border-[#EBEBEB] dark:border-[#222222] flex flex-col justify-between hover:shadow-[0_12px_30px_rgba(26,35,126,0.1)] transition-all transform hover:-translate-y-1 cursor-pointer"
            >
              <div>
                <div className="flex justify-between items-start mb-5" onClick={(e) => e.stopPropagation()}>
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center p-2 shadow-sm border border-[#EBEBEB] shrink-0">
                    <BankLogo bankName={account.bankName} type={account.type} className="w-full h-full object-contain" />
                  </div>
                  {account.type && (
                    <div className={`ml-3 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                      account.type === 'CASH' ? 'bg-brand-green/10 text-brand-green' : 
                      account.type === 'CREDIT_CARD' ? 'bg-brand-gold/10 text-brand-gold' : 
                      'bg-brand-blue/10 text-brand-blue'
                    }`}>
                      {account.type.replace('_', ' ')}
                    </div>
                  )}
                  <div className="flex-1" />
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEdit(account)}
                      className="text-brand-blue/40 dark:text-[#A0A0A0] hover:text-brand-blue dark:hover:text-[#F7F7F7] transition-colors p-2 rounded-full hover:bg-brand-blue/5 dark:hover:bg-[#222222]"
                      title="Edit Account"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(account.id!)}
                      className="text-brand-blue/40 dark:text-[#A0A0A0] hover:text-brand-red transition-colors p-2 rounded-full hover:bg-brand-red/5"
                      title="Delete Account"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <h3 className="text-2xl font-black text-brand-blue dark:text-[#F7F7F7] truncate">{account.bankName}</h3>
                <p className="text-brand-blue opacity-50 dark:text-[#A0A0A0] font-black mt-0.5">
                  {account.type === 'CASH' ? account.accountLast4 : `**** ${account.accountLast4}`}
                </p>
                <div className="mt-4">
                  <p className="text-[10px] font-black text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-widest mb-1">Current Balance</p>
                  <p className={`text-2xl font-black tracking-tighter ${currentBalance >= 0 ? 'text-brand-blue dark:text-white' : 'text-brand-red'}`}>
                    ₹{currentBalance.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[#EBEBEB] dark:border-[#222222] space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-brand-green/5 dark:bg-brand-green/10 p-2.5 rounded-xl border border-brand-green/10">
                    <div className="flex items-center gap-1.5 text-brand-green mb-1">
                      <ArrowDownLeft className="w-3 h-3" />
                      <span className="text-[10px] font-black uppercase tracking-tight">Inflow</span>
                    </div>
                    <p className="text-sm font-black text-brand-green">
                      ₹{(accountBreakdown[account.id!]?.inflow || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <div className="bg-brand-red/5 dark:bg-brand-red/10 p-2.5 rounded-xl border border-brand-red/10">
                    <div className="flex items-center gap-1.5 text-brand-red mb-1">
                      <ArrowUpRight className="w-3 h-3" />
                      <span className="text-[10px] font-black uppercase tracking-tight">Outflow</span>
                    </div>
                    <p className="text-sm font-black text-brand-red">
                      ₹{(accountBreakdown[account.id!]?.outflow || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
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




  const statementData = useMemo(() => {
    if (!account) return [];
    
    let baseBalance = Number(account.startingBalance) || 0;
    let startDateLimit = account.startingBalanceDate ? startOfDay(new Date(account.startingBalanceDate)).getTime() : 0;
    let endDateLimit = Infinity;

    // Apply granularity filters
    if (granularity !== 'ALL') {
      const d = referenceDate;
      if (granularity === 'DAY') {
        startDateLimit = Math.max(startDateLimit, startOfDay(d).getTime());
        endDateLimit = endOfDay(d).getTime();
      } else if (granularity === 'WEEK') {
        startDateLimit = Math.max(startDateLimit, startOfWeek(d, { weekStartsOn: 1 }).getTime());
        endDateLimit = endOfWeek(d, { weekStartsOn: 1 }).getTime();
      } else if (granularity === 'MONTH') {
        startDateLimit = Math.max(startDateLimit, startOfMonth(d).getTime());
        endDateLimit = endOfMonth(d).getTime();
      } else if (granularity === 'YEAR') {
        startDateLimit = Math.max(startDateLimit, startOfYear(d).getTime());
        endDateLimit = endOfYear(d).getTime();
      } else if (granularity === 'CUSTOM') {
        startDateLimit = Math.max(startDateLimit, startOfDay(new Date(customRange.start)).getTime());
        endDateLimit = endOfDay(new Date(customRange.end)).getTime();
      }
    }

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
    

  const currentBalance = statementData.length > 0 
    ? statementData[statementData.length - 1].runningBalance 
    : (Number(account?.startingBalance) || 0);

  const totalCredit = statementData.filter(t => t.type === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);
  const totalDebit = statementData.filter(t => t.type === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0);


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
    doc.text(`Closing Balance: INR ${currentBalance.toLocaleString()}`, 14, 45);

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
    const liveTxs = transactions.filter(tx => new Date(tx.dateTime).getTime() > startLimit);
    const inflow = liveTxs.filter(t => t.type === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);
    const outflow = liveTxs.filter(t => t.type === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0);
    const opening = lastClosing ? lastClosing.closingBalance : account.startingBalance;

    await db.accountClosings.add({
      accountId: account.id!,
      closingDate: new Date(),
      closingBalance: currentBalance,
      periodName: format(new Date(), 'dd MMM yyyy'),
      openingBalance: opening,
      totalInflow: inflow,
      totalOutflow: outflow
    });
    
    alert(`Period closed! Balance of ₹${currentBalance.toLocaleString()} is now your new starting point.`);
  };

  if (!account) return null;

  return (
    <div className="fixed inset-0 bg-white dark:bg-[#060608] z-[100] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="bg-neutral-50 dark:bg-[#0C0C0F] border-b border-neutral-200 dark:border-[#222222] px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white dark:bg-[#1A1A1A] rounded-xl flex items-center justify-center p-1.5 border border-neutral-100 dark:border-[#333333]">
              <BankLogo bankName={account.bankName} type={account.type} className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-sm font-black text-brand-blue dark:text-[#F7F7F7] uppercase tracking-tighter">{account.bankName}</h2>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-none">**** {account.accountLast4}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-[#222222] flex items-center justify-center text-brand-blue dark:text-[#F7F7F7] hover:bg-neutral-300 transition-all">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white dark:bg-[#111111] p-4 rounded-2xl shadow-[0_10px_30px_rgba(26,35,126,0.05)] border border-neutral-100 dark:border-white/5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8px] font-black text-brand-blue/30 dark:text-white/30 uppercase tracking-widest mb-1">Starting</p>
                <p className="text-sm font-black text-brand-blue/60 dark:text-white/60">
                  ₹{(Number(account.startingBalance) || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black text-brand-blue/30 dark:text-white/30 uppercase tracking-widest mb-1">Current Balance</p>
                <p className="text-sm font-black text-brand-blue dark:text-white">
                  ₹{currentBalance.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-white/5 flex gap-4">
              <div className="flex-1">
                <p className="text-[7px] font-black text-brand-green uppercase tracking-widest mb-0.5">Inflow (+)</p>
                <p className="text-[10px] font-black text-brand-green">₹{totalCredit.toLocaleString('en-IN')}</p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-[7px] font-black text-brand-red uppercase tracking-widest mb-0.5">Outflow (-)</p>
                <p className="text-[10px] font-black text-brand-red">₹{totalDebit.toLocaleString('en-IN')}</p>
              </div>
            </div>
          </div>

            <div className="flex flex-col justify-center gap-2">
              <button 
                onClick={handleStartNewBalance}
                className="w-full flex items-center justify-center gap-2 bg-brand-green text-white py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-brand-green/20"
              >
                <Plus className="w-3.5 h-3.5" />
                New Balance
              </button>
              <div className="relative">
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="w-full flex items-center justify-center gap-2 bg-white dark:bg-[#1A1A1A] text-brand-blue dark:text-white py-3 rounded-xl border border-neutral-100 dark:border-[#222222] font-black text-[10px] uppercase shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
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

        {/* Filters */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="flex bg-neutral-100 dark:bg-[#1A1A1A] p-0.5 rounded-xl flex-1 overflow-x-auto">
            {(['ALL', 'YEAR', 'MONTH', 'WEEK', 'DAY', 'CUSTOM'] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={`flex-1 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all shrink-0 ${
                  granularity === g 
                    ? 'bg-white dark:bg-[#333333] text-brand-blue dark:text-white shadow-sm' 
                    : 'text-neutral-400'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {granularity === 'CUSTOM' && (
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#1A1A1A] px-2 py-1 rounded-xl">
              <input 
                type="date"
                value={customRange.start}
                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                className="bg-transparent text-[9px] font-black text-brand-blue dark:text-white outline-none"
              />
              <span className="text-[9px] font-black text-neutral-400">TO</span>
              <input 
                type="date"
                value={customRange.end}
                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                className="bg-transparent text-[9px] font-black text-brand-blue dark:text-white outline-none"
              />
            </div>
          )}

          {granularity !== 'ALL' && granularity !== 'CUSTOM' && (
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#1A1A1A] px-2 py-1 rounded-xl">
              <button 
                onClick={() => {
                  if (granularity === 'DAY') setReferenceDate(subDays(referenceDate, 1));
                  if (granularity === 'WEEK') setReferenceDate(subWeeks(referenceDate, 1));
                  if (granularity === 'MONTH') setReferenceDate(subMonths(referenceDate, 1));
                  if (granularity === 'YEAR') setReferenceDate(subYears(referenceDate, 1));
                }}
                className="p-1 text-brand-blue dark:text-neutral-400"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
              </button>
              <span className="text-[9px] font-black text-brand-blue dark:text-white min-w-[70px] text-center uppercase tracking-tighter">
                {granularity === 'DAY' && format(referenceDate, 'dd MMM yyyy')}
                {granularity === 'WEEK' && `Week ${format(referenceDate, 'ww, yyyy')}`}
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
                className="p-1 text-brand-blue dark:text-neutral-400"
              >
                <ChevronDown className="w-4 h-4 -rotate-90" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="flex-1 overflow-auto bg-white dark:bg-[#060608]">
        <table className="w-full border-collapse border-spacing-0 text-[10px] min-w-[320px]">
          <thead className="sticky top-0 z-10 bg-neutral-50 dark:bg-[#111111]">
            <tr className="text-[8px] font-black text-neutral-400 uppercase tracking-widest border-b border-neutral-100 dark:border-[#222222]">
              <th className="w-16 px-2 py-3 text-left">Date</th>
              <th className="px-2 py-3 text-left">Particulars</th>
              <th className="w-20 px-2 py-3 text-right">Debit (Dr)</th>
              <th className="w-20 px-2 py-3 text-right">Credit (Cr)</th>
              <th className="w-24 px-2 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-[#0C0C0F]">
            {statementData.map((tx, idx) => {
              const prevTx = idx > 0 ? statementData[idx-1] : null;
              // Check if any "closing/partition" happened between prevTx and current tx
              const partitionInBetween = closings.find(c => {
                const cTime = new Date(c.closingDate).getTime();
                const txTime = new Date(tx.dateTime).getTime();
                const prevTxTime = prevTx ? new Date(prevTx.dateTime).getTime() : 0;
                return cTime < txTime && cTime > prevTxTime;
              });

              return (
                <React.Fragment key={tx.id || idx}>
                  {partitionInBetween && (
                    <tr className="bg-neutral-50 dark:bg-[#1A1A1A] border-y-2 border-brand-blue/10">
                      <td colSpan={5} className="px-3 py-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="px-2 py-0.5 bg-brand-blue text-white text-[8px] font-black rounded-full uppercase">Partition</div>
                              <span className="text-[10px] font-black text-brand-blue dark:text-white uppercase">{format(new Date(partitionInBetween.closingDate), 'dd MMM yyyy')}</span>
                            </div>
                            <div className="text-[10px] font-black text-brand-blue/40 uppercase">Closing Balance: ₹{partitionInBetween.closingBalance.toLocaleString()}</div>
                          </div>
                          <div className="flex gap-4 pt-2 border-t border-neutral-100 dark:border-white/5">
                            <div className="flex-1">
                              <p className="text-[7px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">Period Inflow</p>
                              <p className="text-[10px] font-black text-brand-green">+ ₹{partitionInBetween.totalInflow.toLocaleString()}</p>
                            </div>
                            <div className="flex-1">
                              <p className="text-[7px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">Period Outflow</p>
                              <p className="text-[10px] font-black text-brand-red">- ₹{partitionInBetween.totalOutflow.toLocaleString()}</p>
                            </div>
                            <div className="flex-1 text-right">
                              <p className="text-[7px] font-black text-neutral-400 uppercase tracking-widest mb-0.5">Prev. Balance</p>
                              <p className="text-[10px] font-black text-brand-blue dark:text-white">₹{partitionInBetween.openingBalance.toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="mt-2 py-1.5 px-3 bg-brand-blue/5 dark:bg-brand-blue/20 rounded-lg flex items-center justify-between">
                            <span className="text-[8px] font-black text-brand-blue dark:text-brand-cyan uppercase">New Starting Balance initialized</span>
                            <span className="text-[10px] font-black text-brand-blue dark:text-white">₹{partitionInBetween.closingBalance.toLocaleString()}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr className="border-b border-neutral-50 dark:border-[#1A1A1A] hover:bg-neutral-50/50 transition-colors">
                    <td className="px-2 py-3 text-neutral-400 text-[9px] text-center font-bold">
                      <div className="flex flex-col">
                        <span>{format(new Date(tx.dateTime), 'dd')}</span>
                        <span className="text-[7px] uppercase">{format(new Date(tx.dateTime), 'MMM')}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 max-w-[180px]">
                      <p className="font-black text-brand-blue dark:text-[#F7F7F7] text-[10px] leading-tight truncate uppercase tracking-tighter">
                        {tx.party || tx.category || 'N/A'}
                      </p>
                      {tx.note && (
                        <p className="text-[8px] text-neutral-400 font-bold mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis uppercase tracking-tighter">
                          {tx.note}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1 opacity-40">
                        <div className="w-1 h-1 rounded-full bg-neutral-300" />
                        <span className="text-[7px] font-black uppercase tracking-widest">{tx.category}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right">
                      {tx.type === 'DEBIT' && <span className="text-brand-red font-bold">₹{tx.amount.toLocaleString('en-IN')}</span>}
                      {tx.type !== 'DEBIT' && <span className="text-neutral-300">-</span>}
                    </td>
                    <td className="px-2 py-3 text-right">
                      {tx.type === 'CREDIT' && <span className="text-brand-green font-bold">₹{tx.amount.toLocaleString('en-IN')}</span>}
                      {tx.type !== 'CREDIT' && <span className="text-neutral-300">-</span>}
                    </td>
                    <td className={`px-2 py-3 text-right font-black ${tx.runningBalance >= 0 ? 'text-brand-blue dark:text-white' : 'text-brand-red'}`}>
                      ₹{tx.runningBalance.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
            
            {statementData.length === 0 && (
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
