import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useCurrency } from '../hooks/useCurrency';
import { ArrowLeft, Landmark, List, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Transfer() {
  const navigate = useNavigate();
  const currency = useCurrency();
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (accounts.length > 0 && !fromAccountId) {
      setFromAccountId(accounts[0].id!.toString());
      if (accounts.length > 1 && !toAccountId) {
        setToAccountId(accounts[1].id!.toString());
      }
    }
  }, [accounts, fromAccountId, toAccountId]);

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
      
      setShowSuccess(true);
      setAmount('');
      setNote('');
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      setError('An error occurred during transfer.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-1 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Back Header */}
      <div className="flex items-center gap-3 mb-4">
        <button 
          onClick={() => navigate('/accounts')}
          className="-ml-3 p-1.5 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/5 rounded-full hover:bg-neutral-50 dark:hover:bg-white/10 transition-all text-neutral-600 dark:text-neutral-300"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter leading-none">
            Inter-Account Transfer
          </h1>
          <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">
            Move funds between your accounts
          </p>
        </div>
        <button 
          onClick={() => navigate('/transfer/logs')} 
          className="px-3 py-1.5 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/5 rounded-xl text-[9px] font-black text-neutral-600 dark:text-neutral-300 flex items-center gap-1 hover:bg-neutral-50 dark:hover:bg-white/10 transition-all uppercase tracking-wider shadow-sm"
        >
          <List className="w-3.5 h-3.5 text-brand-cyan" />
          <span>Logs</span>
        </button>
      </div>

      {/* Form Container Card */}
      <div className="bg-white dark:bg-[#111111] p-4 sm:p-6 rounded-[24px] shadow-sm border border-neutral-100 dark:border-white/5 min-h-[calc(100vh-180px)] md:min-h-0 flex flex-col justify-between">
        <form onSubmit={handleTransfer} className="space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[9px] font-bold uppercase tracking-wider">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Source Account select */}
              <div>
                <label className="block text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1 uppercase tracking-widest">
                  Source Account (Transfer From)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                    <Landmark className="w-3.5 h-3.5" />
                  </div>
                  <select
                    value={fromAccountId}
                    onChange={e => setFromAccountId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-lg outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30"
                    required
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id} className="text-black">{a.bankName} (•• {a.accountLast4})</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Destination Account select */}
              <div>
                <label className="block text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1 uppercase tracking-widest">
                  Destination Account (Transfer To)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                    <Landmark className="w-3.5 h-3.5" />
                  </div>
                  <select
                    value={toAccountId}
                    onChange={e => setToAccountId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-lg outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30"
                    required
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id} className="text-black" disabled={a.id!.toString() === fromAccountId}>{a.bankName} (•• {a.accountLast4})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Amount Input */}
              <div>
                <label className="block text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1 uppercase tracking-widest">
                  Amount ({currency})
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500 text-xs font-bold">
                    {currency}
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-lg outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 placeholder-neutral-300 dark:placeholder-neutral-600"
                    required
                  />
                </div>
              </div>

              {/* Date Input */}
              <div>
                <label className="block text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1 uppercase tracking-widest">
                  Date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-lg outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Remarks input */}
            <div>
              <label className="block text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1 uppercase tracking-widest">
                Remarks / Optional Notes
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  placeholder="e.g., Credit card bill payment, Wallet refill"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-lg outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 placeholder-neutral-300 dark:placeholder-neutral-600"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 mt-auto">
            <button 
              type="submit" 
              disabled={isSaving || accounts.length < 2} 
              className="w-full py-2.5 bg-brand-green text-white dark:text-brand-blue rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 shadow-sm disabled:opacity-50 hover:bg-brand-green/90"
            >
              {isSaving ? 'Processing...' : 'Execute Transfer'}
            </button>
            {accounts.length < 2 && (
               <p className="text-center text-[8px] text-rose-500 mt-2 font-bold uppercase tracking-wider">You need at least 2 accounts to perform a transfer.</p>
            )}
          </div>
        </form>
      </div>

      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed bottom-24 sm:bottom-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-brand-green text-white dark:text-brand-blue px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6" />
              <div>
                <p className="text-sm font-black tracking-tight">Transfer Successful!</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Balances have been updated</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
