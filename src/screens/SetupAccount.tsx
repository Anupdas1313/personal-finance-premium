import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../models/db';
import { Landmark, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SetupAccount() {
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [type, setType] = useState<'BANK' | 'CASH' | 'CREDIT_CARD'>('BANK');
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !startingBalance) return;
    
    setIsSaving(true);
    try {
      // 1. Add the account
      await db.accounts.add({
        bankName,
        accountLast4: accountLast4 || '0000',
        startingBalance: Number(startingBalance),
        startingBalanceDate: new Date(),
        type
      });

      // 2. Mark setup as complete
      if (user) {
        localStorage.setItem(`onboardingComplete_${user.uid}`, 'true');
        await db.userSettings.put({ key: 'setupComplete', value: true });
      }

      // 3. Go to dashboard
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Failed to setup account:', error);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-[#060608] flex flex-col z-[200] overflow-y-auto">
      <div className="flex-1 flex flex-col max-w-md w-full mx-auto p-6 pt-12">
        <div className="w-16 h-16 bg-brand-blue/10 dark:bg-white/10 rounded-2xl flex items-center justify-center mb-6">
          <Landmark className="w-8 h-8 text-brand-blue dark:text-white" />
        </div>
        
        <h1 className="text-3xl font-black text-brand-blue dark:text-white mb-2 tracking-tight">
          Set up your first account
        </h1>
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
          Expensify needs an account to track your money. You can add a bank account, a credit card, or just a cash wallet.
        </p>

        <form onSubmit={handleSave} className="flex-1 flex flex-col">
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Account Type</label>
              <div className="grid grid-cols-3 gap-2">
                {(['BANK', 'CASH', 'CREDIT_CARD'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      type === t 
                        ? 'bg-brand-blue dark:bg-white text-white dark:text-brand-blue shadow-lg shadow-brand-blue/20 dark:shadow-white/10' 
                        : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Account Name</label>
              <input
                type="text"
                required
                placeholder={type === 'CASH' ? 'e.g. Physical Wallet' : 'e.g. Chase Bank'}
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                className="w-full bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-brand-blue dark:focus:border-white/20 rounded-xl px-4 py-3.5 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 dark:text-white"
              />
            </div>

            {type !== 'CASH' && (
              <div>
                <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Last 4 Digits (Optional)</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="e.g. 1234"
                  value={accountLast4}
                  onChange={e => setAccountLast4(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-brand-blue dark:focus:border-white/20 rounded-xl px-4 py-3.5 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Current Balance</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-semibold">₹</span>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={startingBalance}
                  onChange={e => setStartingBalance(e.target.value)}
                  className="w-full bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-brand-blue dark:focus:border-white/20 rounded-xl pl-8 pr-4 py-3.5 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="mt-auto pt-8 pb-6">
            <button 
              type="submit"
              disabled={isSaving || !bankName || !startingBalance}
              className="w-full bg-brand-blue dark:bg-white text-white dark:text-brand-blue h-14 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-blue/20 dark:shadow-white/10 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Complete Setup
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
