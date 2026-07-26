import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useCurrency } from '../hooks/useCurrency';
import { ArrowLeftRight, List, CheckCircle2 } from 'lucide-react';
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
    <div className="space-y-6 max-w-2xl mx-auto pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-4xl font-heading font-black text-brand-blue dark:text-white flex items-center gap-3">
          <ArrowLeftRight className="w-8 h-8 text-brand-green" />
          Transfer
        </h1>
        <button 
          onClick={() => navigate('/transactions?type=TRANSFER')} 
          className="px-4 py-2 bg-neutral-100 dark:bg-white/5 rounded-xl text-[11px] font-bold text-brand-blue dark:text-white flex items-center gap-2 hover:bg-neutral-200 dark:hover:bg-white/10 transition uppercase tracking-wider"
        >
          <List className="w-4 h-4" />
          Transfer Logs
        </button>
      </div>

      <div className="bg-[#F9FBFF] dark:bg-white/[0.01] p-5 sm:p-8 rounded-[32px] border border-brand-blue/5 dark:border-white/5 shadow-sm">
        <form onSubmit={handleTransfer} className="space-y-6">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-bold uppercase tracking-wider">
              {error}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-2">Source Account (Transfer From)</label>
              <select
                value={fromAccountId}
                onChange={e => setFromAccountId(e.target.value)}
                className="w-full px-5 py-4 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 rounded-2xl text-[13px] font-bold outline-none text-brand-blue dark:text-white focus:border-brand-green/50 transition-colors"
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id} className="text-black">{a.bankName} (•• {a.accountLast4})</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-2">Destination Account (Transfer To)</label>
              <select
                value={toAccountId}
                onChange={e => setToAccountId(e.target.value)}
                className="w-full px-5 py-4 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 rounded-2xl text-[13px] font-bold outline-none text-brand-blue dark:text-white focus:border-brand-green/50 transition-colors"
                required
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id} className="text-black" disabled={a.id!.toString() === fromAccountId}>{a.bankName} (•• {a.accountLast4})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-2">Amount ({currency})</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full px-5 py-4 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 rounded-2xl text-xl font-black outline-none text-brand-blue dark:text-white focus:border-brand-green/50 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-2">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-5 py-4 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 rounded-2xl text-[13px] font-bold outline-none text-brand-blue dark:text-white focus:border-brand-green/50 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-2">Remarks / Optional Notes</label>
            <input
              type="text"
              placeholder="e.g., Credit card bill payment, Wallet refill"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-5 py-4 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 rounded-2xl text-[13px] font-bold outline-none text-brand-blue dark:text-white focus:border-brand-green/50 transition-colors"
            />
          </div>

          <div className="pt-4">
            <button 
              type="submit" 
              disabled={isSaving || accounts.length < 2} 
              className="w-full py-4 bg-brand-green text-white dark:text-brand-blue rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-green/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
            >
              {isSaving ? 'Processing...' : 'Execute Transfer'}
            </button>
            {accounts.length < 2 && (
               <p className="text-center text-[10px] text-neutral-400 mt-3 font-bold uppercase tracking-wider">You need at least 2 accounts to transfer.</p>
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
