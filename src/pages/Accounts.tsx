import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { Plus, Trash2, Pencil, ArrowDownLeft, ArrowUpRight, Wallet, CreditCard, Landmark } from 'lucide-react';
import { BankLogo } from '../components/BankLogo';
import { INDIAN_BANKS, getBankByPattern } from '../components/BankLogosData';

export default function Accounts() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const [isAdding, setIsAdding] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [accountType, setAccountType] = useState<'BANK' | 'CASH' | 'CREDIT_CARD'>('BANK');
  
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];

  const accountBreakdown = accounts.reduce((acc, account) => {
    const txs = allTransactions.filter(tx => tx.accountId === account.id);
    const inflow = txs.filter(tx => tx.type === 'CREDIT').reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const outflow = txs.filter(tx => tx.type === 'DEBIT').reduce((sum, tx) => sum + (tx.amount || 0), 0);
    acc[account.id!] = { inflow, outflow };
    return acc;
  }, {} as Record<number, { inflow: number, outflow: number }>);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountLast4 || !startingBalance) return;

    if (editingAccountId) {
      await db.accounts.update(editingAccountId, {
        bankName,
        accountLast4,
        startingBalance: parseFloat(startingBalance),
        type: accountType
      });
    } else {
      await db.accounts.add({
        bankName,
        accountLast4,
        startingBalance: parseFloat(startingBalance),
        type: accountType
      });
    }

    resetForm();
  };

  const resetForm = () => {
    setBankName('');
    setAccountLast4('');
    setStartingBalance('');
    setAccountType('BANK');
    setIsAdding(false);
    setEditingAccountId(null);
  };

  const handleEdit = (account: any) => {
    setBankName(account.bankName);
    setAccountLast4(account.accountLast4);
    setStartingBalance(account.startingBalance.toString());
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
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map(account => (
          <div key={account.id} className="bg-white dark:bg-[#111111] p-6 rounded-[24px] shadow-[0_6px_16px_rgba(26,35,126,0.04)] border border-[#EBEBEB] dark:border-[#222222] flex flex-col justify-between hover:shadow-[0_12px_30px_rgba(26,35,126,0.1)] transition-all transform hover:-translate-y-1">
            <div>
              <div className="flex justify-between items-start mb-5">
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
              <p className="text-brand-blue opacity-50 dark:text-[#A0A0A0] font-black mt-1">
                {account.type === 'CASH' ? account.accountLast4 : `**** ${account.accountLast4}`}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-[#EBEBEB] dark:border-[#222222] space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs font-black text-brand-blue/40 dark:text-[#A0A0A0] uppercase tracking-wider">Starting</p>
                <p className="text-sm font-black text-brand-blue dark:text-[#F7F7F7]">
                  ₹{account.startingBalance.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                </p>
              </div>

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
        ))}
        {accounts.length === 0 && !isAdding && (
          <div className="col-span-full text-center py-16 bg-white dark:bg-[#111111] rounded-[24px] border border-dashed border-brand-blue/20">
            <p className="text-brand-blue/40 dark:text-[#A0A0A0] font-black">No accounts found. Add one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
