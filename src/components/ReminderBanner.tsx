import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Zap } from 'lucide-react';
import { useReminders } from '../context/ReminderContext';
import { db } from '../models/db';
import { useCategories } from '../hooks/useCategories';
import { cn } from '../logic/utils';

export const ReminderBanner: React.FC = () => {
  const { settings, showBanner, setShowBanner } = useReminders();
  const { categories } = useCategories();
  
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    // Load accounts for quick add
    db.accounts.toArray().then(setAccounts);
  }, [showBanner]);

  useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  if (!showBanner || !settings.enabled) return null;

  const handleSave = async () => {
    if (!amount || !note || !category) return;
    
    // Pick the first account as default for quick entry
    const defaultAccount = accounts[0];
    if (!defaultAccount) {
      alert("Please create an account first!");
      return;
    }

    try {
      setIsSaving(true);
      await db.transactions.add({
        accountId: defaultAccount.id!,
        amount: parseFloat(amount),
        type: 'DEBIT',
        dateTime: new Date(),
        note: note,
        category: category,
        paymentMethod: defaultAccount.type === 'CASH' ? 'Cash' : 'UPI',
        isPersonalExpense: true,
        expenseType: 'Personal'
      });
      
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setShowBanner(false);
        setAmount('');
        setNote('');
      }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const positionClasses = {
    top: 'top-4 left-4 right-4 md:left-auto md:right-4 md:w-96',
    center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] md:w-96',
    bottom: 'bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-96' // bottom-20 to clear nav bar
  };

  return (
    <div className={cn("fixed z-50 animate-in fade-in slide-in-from-top-4 duration-300", positionClasses[settings.position])}>
      <div className="bg-white dark:bg-[#111111] border border-brand-green/20 dark:border-brand-green/10 shadow-2xl rounded-3xl p-5 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-green/10 rounded-full blur-3xl pointer-events-none" />
        
        <button 
          onClick={() => setShowBanner(false)}
          className="absolute top-4 right-4 text-brand-blue/30 hover:text-brand-red transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-brand-green/10 rounded-xl text-brand-green">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-brand-blue dark:text-white">Time to log your expenses!</h3>
            <p className="text-[10px] font-bold text-brand-blue/40 uppercase tracking-wider">Daily Reminder</p>
          </div>
        </div>

        {showSuccess ? (
          <div className="py-6 flex flex-col items-center justify-center gap-3 text-brand-green animate-in zoom-in duration-300">
            <CheckCircle2 className="w-12 h-12" />
            <p className="font-bold text-sm">Saved Successfully!</p>
          </div>
        ) : (
          <div className="space-y-3 relative z-10">
            <div className="flex gap-2">
              <div className="flex-1 bg-neutral-50 dark:bg-[#1A1A1A] rounded-xl flex items-center px-3 border border-brand-blue/5 focus-within:border-brand-green/50 focus-within:ring-1 focus-within:ring-brand-green/50 transition-all">
                <span className="text-brand-blue/30 font-bold">₹</span>
                <input 
                  type="number" 
                  placeholder="Amount" 
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-transparent px-2 py-3 outline-none font-bold text-brand-blue dark:text-white text-sm"
                />
              </div>
              <select 
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-1/2 bg-neutral-50 dark:bg-[#1A1A1A] rounded-xl px-3 border border-brand-blue/5 text-[11px] font-bold text-brand-blue dark:text-white outline-none"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <input 
              type="text" 
              placeholder="What was this for?" 
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full bg-neutral-50 dark:bg-[#1A1A1A] rounded-xl px-4 py-3 border border-brand-blue/5 focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/50 outline-none font-medium text-brand-blue dark:text-white text-sm transition-all"
            />
            
            <button 
              onClick={handleSave}
              disabled={!amount || !note || isSaving}
              className="w-full py-3.5 bg-brand-green text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-green/90 active:scale-95 transition-all shadow-lg shadow-brand-green/20 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Add Expense'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
