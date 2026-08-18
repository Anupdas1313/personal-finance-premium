import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useCurrency } from '../hooks/useCurrency';
import { format } from 'date-fns';
import { ArrowLeft, Landmark, List, Calendar, FileText, CheckCircle2, User, HelpCircle, Wallet, ArrowDownCircle, ArrowRightLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UPI_APPS_LIST } from '../constants';

const DEPOSIT_SOURCES = [
  { id: 'SELF_CASH', label: 'Self Deposit (Cash)', category: 'Other', isSelf: true, defaultMethod: 'Cash' },
  { id: 'SELF_TRANSFER', label: 'Self Deposit (Transfer)', category: 'Other', isSelf: true, defaultMethod: 'Bank Transfer' },
  { id: 'SALARY', label: 'Salary', category: 'Salary', isSelf: false, defaultMethod: 'Bank Transfer' },
  { id: 'INVESTMENT', label: 'Investment/Interest', category: 'Investment', isSelf: false, defaultMethod: 'Bank Transfer' },
  { id: 'GIFT', label: 'Gift/Award', category: 'Other', isSelf: false, defaultMethod: 'UPI' },
  { id: 'REFUND', label: 'Refund/Cashback', category: 'Other', isSelf: false, defaultMethod: 'UPI' },
  { id: 'BUSINESS', label: 'Business Inflow', category: 'Other', isSelf: false, defaultMethod: 'Bank Transfer' },
  { id: 'OTHER', label: 'Other', category: 'Other', isSelf: false, defaultMethod: 'UPI' }
];

export default function AddMoney() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currency = useCurrency();
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [sourceType, setSourceType] = useState('SELF_CASH');
  const [party, setParty] = useState('Self Deposit');
  const [paymentMethod, setPaymentMethod] = useState<'Bank' | 'UPI' | 'Credit Card' | 'Cash' | 'Bank Transfer'>('Cash');
  const [upiApp, setUpiApp] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Pre-select account if provided in search parameters
  useEffect(() => {
    const paramAccId = searchParams.get('accountId');
    if (paramAccId) {
      setAccountId(paramAccId);
    } else if (accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id!.toString());
    }
  }, [accounts, searchParams]);

  // Update defaults based on selected source type
  const handleSourceTypeChange = (val: string) => {
    setSourceType(val);
    const source = DEPOSIT_SOURCES.find(s => s.id === val);
    if (source) {
      if (source.isSelf) {
        setParty('Self Deposit');
      } else {
        setParty('');
      }
      setPaymentMethod(source.defaultMethod as any);
      if (source.defaultMethod !== 'UPI') {
        setUpiApp('');
      }
    }
  };

  const handleAddMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId || !amount) {
      setError('Please fill in all required fields.');
      return;
    }
    const amountVal = parseFloat(amount) || 0;
    if (amountVal <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!party.trim()) {
      setError('Please specify the source name or payer.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const selectedAcc = accounts.find(a => a.id === Number(accountId));
      if (!selectedAcc) throw new Error('Selected account not found');

      const isTodaySelected = date === format(new Date(), 'yyyy-MM-dd');
      const finalDateTime = isTodaySelected ? new Date() : new Date(date + 'T12:00:00');

      const selectedSource = DEPOSIT_SOURCES.find(s => s.id === sourceType);
      const category = selectedSource ? selectedSource.category : 'Other';

      await db.transactions.add({
        accountId: Number(accountId),
        amount: amountVal,
        type: 'CREDIT',
        dateTime: finalDateTime,
        note: note || `Deposit via ${sourceType.replace('_', ' ').toLowerCase()}`,
        category,
        party: party.trim(),
        paymentMethod,
        upiApp: paymentMethod === 'UPI' ? upiApp : undefined
      });

      setShowSuccess(true);
      setAmount('');
      setNote('');
      if (!selectedSource?.isSelf) {
        setParty('');
      }
      setTimeout(() => {
        setShowSuccess(false);
        navigate('/accounts');
      }, 1500);
    } catch (err) {
      console.error(err);
      setError('An error occurred while adding money.');
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
            Add Money to Account
          </h1>
          <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">
            Log manual cash deposits, salary, or incoming transfers
          </p>
        </div>
      </div>

      {/* Form Container Card */}
      <div className="bg-white dark:bg-[#111111] p-4 sm:p-6 rounded-[24px] shadow-sm border border-neutral-100 dark:border-white/5 flex flex-col justify-between">
        <form onSubmit={handleAddMoney} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[9px] font-bold uppercase tracking-wider">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Account Select */}
            <div>
              <label className="block text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1 uppercase tracking-widest">
                Target Bank Account
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                  <Landmark className="w-3.5 h-3.5" />
                </div>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-lg outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30"
                  required
                >
                  <option value="" disabled>Select an account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.bankName} (•• {a.accountLast4})</option>
                  ))}
                </select>
              </div>
            </div>

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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Deposit Source Option Selector */}
            <div>
              <label className="block text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1 uppercase tracking-widest">
                Deposit Source Type
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                  <HelpCircle className="w-3.5 h-3.5" />
                </div>
                <select
                  value={sourceType}
                  onChange={e => handleSourceTypeChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-lg outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30"
                >
                  {DEPOSIT_SOURCES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Source Party Name (Who sent it) */}
            <div>
              <label className="block text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1 uppercase tracking-widest">
                Source/Payer Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                  <User className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  placeholder="e.g., Self Deposit, Employer Name, Friend"
                  value={party}
                  onChange={e => setParty(e.target.value)}
                  disabled={DEPOSIT_SOURCES.find(s => s.id === sourceType)?.isSelf}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-white/[0.02] disabled:bg-neutral-100 dark:disabled:bg-white/[0.01] border border-neutral-100 dark:border-white/5 rounded-lg outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 placeholder-neutral-300 dark:placeholder-neutral-600 disabled:opacity-50"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Method Select */}
            <div>
              <label className="block text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1 uppercase tracking-widest">
                Payment/Deposit Method
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
                <select
                  value={paymentMethod}
                  onChange={e => {
                    setPaymentMethod(e.target.value as any);
                    if (e.target.value !== 'UPI') setUpiApp('');
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-lg outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30"
                  required
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/IMPS/RTGS)</option>
                  <option value="Bank">Cheque / Demand Draft</option>
                </select>
              </div>
            </div>

            {/* Date Selection */}
            <div>
              <label className="block text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1 uppercase tracking-widest">
                Deposit Date
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

          <AnimatePresence>
            {paymentMethod === 'UPI' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div>
                  <label className="block text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1 uppercase tracking-widest">
                    UPI Application Used
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                      <Wallet className="w-3.5 h-3.5" />
                    </div>
                    <select
                      value={upiApp}
                      onChange={e => setUpiApp(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-lg outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30"
                      required={paymentMethod === 'UPI'}
                    >
                      <option value="" disabled>Select UPI App</option>
                      {UPI_APPS_LIST.map(app => (
                        <option key={app} value={app}>{app}</option>
                      ))}
                      <option value="Other UPI">Other UPI Apps</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Remarks/Notes */}
          <div>
            <label className="block text-[9px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1 uppercase tracking-widest">
              Remarks / Remarks Notes
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                placeholder="e.g., Salary for July, ATM deposit"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-lg outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 placeholder-neutral-300 dark:placeholder-neutral-600"
              />
            </div>
          </div>

          {/* Preview Widget */}
          <AnimatePresence>
            {amount && Number(amount) > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/20 rounded-2xl flex flex-col gap-2 shadow-sm">
                  <p className="text-[8px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest">
                    Deposit Preview
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-wide">Payer / Source</p>
                      <p className="text-xs font-black text-neutral-850 dark:text-neutral-150">
                        {party || 'Self Deposit'}
                      </p>
                    </div>

                    <div className="text-center">
                      <p className="text-[8px] font-bold text-neutral-400 uppercase tracking-wide">Method</p>
                      <p className="text-xs font-black text-neutral-850 dark:text-neutral-150">
                        {paymentMethod === 'UPI' && upiApp ? `${upiApp} (UPI)` : paymentMethod}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-wide">Amount Credit To</p>
                      <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                        {accounts.find(a => a.id?.toString() === accountId)?.bankName || 'Selected Bank'}
                      </p>
                      <p className="text-sm font-heading font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                        +{currency}{Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isSaving} 
              className="w-full py-2.5 bg-brand-green text-white dark:text-brand-blue rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 shadow-sm disabled:opacity-50 hover:bg-brand-green/90"
            >
              {isSaving ? 'Adding Money...' : 'Add Money to Account'}
            </button>
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
                <p className="text-sm font-black tracking-tight">Money Added Successfully!</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Account balance has been credited</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
