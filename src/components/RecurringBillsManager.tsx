import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, RecurringTemplate } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { Repeat, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { cn } from '../logic/utils';
import { format } from 'date-fns';
import { useCurrency } from '../hooks/useCurrency';

export function RecurringBillsManager() {
  const currency = useCurrency();
  const { user } = useAuth();
  const templates = useLiveQuery(() => db.recurringTemplates.toArray(), [user?.uid]) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), [user?.uid]) || [];
  const categories = useLiveQuery(() => db.categories.toArray(), [user?.uid]) || [];

  const [isAdding, setIsAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('');
  const [category, setCategory] = useState('');
  const [frequency, setFrequency] = useState<'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY'>('MONTHLY');
  const [nextRunDate, setNextRunDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'DEBIT'|'CREDIT'>('DEBIT');

  const handleAdd = async () => {
    if (!amount || !accountId || !category) return;
    
    await db.recurringTemplates.add({
      amount: parseFloat(amount),
      accountId: Number(accountId),
      category,
      note,
      frequency,
      nextRunDate: new Date(nextRunDate),
      type,
      isActive: true,
      paymentMethod: 'Bank'
    });

    setIsAdding(false);
    setAmount('');
    setNote('');
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this recurring transaction?')) {
      await db.recurringTemplates.delete(id);
    }
  };

  const toggleActive = async (template: RecurringTemplate) => {
    await db.recurringTemplates.update(template.id!, { isActive: !template.isActive });
  };

  return (
    <section className="mb-8">
      <h2 className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Automation</h2>
      <div className="bg-white dark:bg-[#111111] rounded-[32px] border border-brand-blue/5 dark:border-[#222222] shadow-sm overflow-hidden">
        <div className="p-5">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
              <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                <Repeat className="w-5 h-5 text-brand-blue dark:text-inherit" />
              </div>
              <div>
                <p className="font-semibold text-brand-blue dark:text-[#F7F7F7]">Recurring Transactions</p>
                <p className="text-xs font-medium text-brand-blue/30 dark:text-[#A0A0A0] mt-0.5 uppercase tracking-[0.1em]">Auto-log subscriptions & bills</p>
              </div>
            </div>
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="w-8 h-8 rounded-full bg-brand-blue/5 dark:bg-[#222222] flex items-center justify-center hover:bg-brand-blue/10 dark:hover:bg-[#333333] transition-colors"
            >
              <Plus className={cn("w-4 h-4 text-brand-blue dark:text-[#F7F7F7] transition-transform", isAdding && "rotate-45")} />
            </button>
          </div>

          {isAdding && (
            <div className="bg-[#F8F9FF] dark:bg-[#1A1A1A] p-4 rounded-2xl mb-4 border border-brand-blue/10 dark:border-white/5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input 
                  type="number" 
                  placeholder="Amount" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white dark:bg-[#222222] text-brand-blue dark:text-white px-3 py-2 rounded-xl text-sm outline-none border border-brand-blue/10 dark:border-transparent" 
                />
                <select 
                  value={type} 
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full bg-white dark:bg-[#222222] text-brand-blue dark:text-white px-3 py-2 rounded-xl text-sm outline-none border border-brand-blue/10 dark:border-transparent"
                >
                  <option value="DEBIT">Expense (Debit)</option>
                  <option value="CREDIT">Income (Credit)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select 
                  value={accountId} 
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full bg-white dark:bg-[#222222] text-brand-blue dark:text-white px-3 py-2 rounded-xl text-sm outline-none border border-brand-blue/10 dark:border-transparent"
                >
                  <option value="">Select Account</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.bankName}</option>)}
                </select>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white dark:bg-[#222222] text-brand-blue dark:text-white px-3 py-2 rounded-xl text-sm outline-none border border-brand-blue/10 dark:border-transparent"
                >
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <select 
                  value={frequency} 
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="w-full bg-white dark:bg-[#222222] text-brand-blue dark:text-white px-3 py-2 rounded-xl text-sm outline-none border border-brand-blue/10 dark:border-transparent"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
                <input 
                  type="date" 
                  value={nextRunDate}
                  onChange={(e) => setNextRunDate(e.target.value)}
                  className="w-full bg-white dark:bg-[#222222] text-brand-blue dark:text-white px-3 py-2 rounded-xl text-sm outline-none border border-brand-blue/10 dark:border-transparent" 
                />
              </div>

              <input 
                type="text" 
                placeholder="Note (e.g. Netflix Subscription)" 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-white dark:bg-[#222222] text-brand-blue dark:text-white px-3 py-2 rounded-xl text-sm outline-none border border-brand-blue/10 dark:border-transparent" 
              />
              
              <button 
                onClick={handleAdd}
                className="w-full bg-brand-green text-white font-bold text-sm py-2 rounded-xl shadow-sm"
              >
                Save Recurring Template
              </button>
            </div>
          )}

          {templates.length === 0 ? (
            <p className="text-center text-xs text-brand-blue/40 dark:text-[#A0A0A0] py-4">No recurring transactions set up.</p>
          ) : (
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/5 dark:border-transparent">
                  <div>
                    <p className="text-sm font-bold text-brand-blue dark:text-[#F7F7F7]">{t.note || t.category}</p>
                    <p className="text-[10px] text-brand-blue/50 dark:text-[#A0A0A0] uppercase tracking-widest mt-0.5">
                      {t.frequency} • Next: {format(new Date(t.nextRunDate), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={cn("text-sm font-black", t.type === 'DEBIT' ? "text-brand-red" : "text-brand-green")}>
                      {t.type === 'DEBIT' ? '-' : '+'}{currency}{t.amount.toLocaleString('en-IN')}
                    </p>
                    <button onClick={() => toggleActive(t)}>
                      <CheckCircle2 className={cn("w-5 h-5", t.isActive ? "text-brand-green" : "text-neutral-300 dark:text-[#444]")} />
                    </button>
                    <button onClick={() => handleDelete(t.id!)} className="text-rose-400 hover:text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
