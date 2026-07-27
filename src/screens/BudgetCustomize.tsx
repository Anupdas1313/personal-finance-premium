import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Check, Wallet, Tag as TagIcon } from 'lucide-react';
import { cn } from '../logic/utils';
import { format, parse } from 'date-fns';

// ── Native UI Components ──────────────────────────────────────────────────────
function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white dark:bg-[#111111] p-5 rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm", className)}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, label, action }: { icon: React.ReactNode; label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
          <span className="text-brand-blue dark:text-[#F7F7F7]">{icon}</span>
        </div>
        <div>
          <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">{label}</p>
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export default function BudgetCustomize() {
  const { month } = useParams(); // e.g., '2026-07'
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const formattedMonth = month ? format(parse(month, 'yyyy-MM', new Date()), 'MMMM yyyy') : '';

  const accounts = useLiveQuery(() => db.accounts.toArray(), [user?.uid]) || [];
  const tags = useLiveQuery(() => db.tags.toArray(), [user?.uid]) || [];
  
  const monthlyBudgets = useLiveQuery(() => month ? db.monthlyBudgets.where('month').equals(month).toArray() : [], [month, user?.uid]);
  const masterPool = monthlyBudgets && monthlyBudgets.length > 0 ? monthlyBudgets[0] : null;

  const currentMonthBudgets = useLiveQuery(() => month ? db.budgets.where('month').equals(month).toArray() : [], [month, user?.uid]) || [];

  const [tempLinkedAccounts, setTempLinkedAccounts] = useState<number[]>([]);
  const [tempLinkedTags, setTempLinkedTags] = useState<string[]>([]);
  const [tempRollovers, setTempRollovers] = useState<number[]>([]);
  
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (monthlyBudgets && currentMonthBudgets && !isInitialized) {
      if (masterPool) {
        setTempLinkedAccounts(masterPool.linkedAccountIds || []);
        setTempLinkedTags(masterPool.linkedTags || []);
      }
      setTempRollovers(currentMonthBudgets.filter(b => b.rollover).map(b => b.id!).filter(Boolean));
      setIsInitialized(true);
    }
  }, [monthlyBudgets, currentMonthBudgets, masterPool, isInitialized]);

  const toggleAccount = (accId: number) => {
    setTempLinkedAccounts(prev => 
      prev.includes(accId) ? prev.filter(id => id !== accId) : [...prev, accId]
    );
  };

  const toggleTag = (tagName: string) => {
    setTempLinkedTags(prev => 
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  const toggleRollover = (budgetId: number) => {
    setTempRollovers(prev => 
      prev.includes(budgetId) ? prev.filter(id => id !== budgetId) : [...prev, budgetId]
    );
  };

  const handleSave = async () => {
    if (!month) return;
    
    if (masterPool && masterPool.id) {
      await db.monthlyBudgets.update(masterPool.id, {
        linkedAccountIds: tempLinkedAccounts,
        linkedTags: tempLinkedTags
      });
    } else {
      await db.monthlyBudgets.add({
        month: month,
        totalAmount: 0,
        linkedAccountIds: tempLinkedAccounts,
        linkedTags: tempLinkedTags
      });
    }

    const updates = currentMonthBudgets.map(b => {
      if (!b.id) return Promise.resolve();
      const shouldRollover = tempRollovers.includes(b.id);
      if (!!b.rollover !== shouldRollover) {
        return db.budgets.update(b.id, { rollover: shouldRollover });
      }
      return Promise.resolve();
    });
    await Promise.all(updates);

    navigate('/budgets');
  };

  const renderToggleRow = (label: string, isSelected: boolean, onClick: () => void, isPrimary: boolean = false) => (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-3.5 border-b border-neutral-100 dark:border-[#222222] last:border-0 group text-left outline-none"
    >
      <span className={cn(
        "text-xs font-bold transition-colors",
        isSelected 
          ? "text-brand-blue dark:text-white" 
          : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300",
        isPrimary && isSelected && "text-brand-green dark:text-brand-green font-black uppercase tracking-wider text-[10px]",
        isPrimary && !isSelected && "text-neutral-400 dark:text-neutral-500 font-black uppercase tracking-wider text-[10px]"
      )}>
        {label}
      </span>
      <div className={cn(
        "w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center transition-all duration-200",
        isSelected 
          ? "bg-brand-green border-brand-green scale-100" 
          : "border-neutral-200 dark:border-[#333] bg-transparent scale-95 group-hover:border-neutral-400"
      )}>
        {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </div>
    </button>
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/budgets')} 
            className="p-3 bg-neutral-100 dark:bg-[#222222] text-brand-blue dark:text-[#F7F7F7] rounded-2xl border border-brand-blue/5 dark:border-transparent transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">Budget Filters</h1>
            <p className="text-neutral-400 font-bold mt-0.5 uppercase tracking-widest text-[8px]">{formattedMonth}</p>
          </div>
        </div>
        
        <button 
          onClick={handleSave} 
          className="px-5 py-2.5 bg-brand-green text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-brand-green/10"
        >
          Save Filters
        </button>
      </div>

      <p className="text-[10px] font-semibold text-neutral-400/80 leading-relaxed px-2">
        Select which funding sources and transaction tags feed into your Monthly Pool envelopes. Unselected elements mean no filter is applied (defaulting to all).
      </p>

      {/* ── ACCOUNTS SECTION ── */}
      <SectionCard>
        <SectionTitle 
          icon={<Wallet className="w-4 h-4" />} 
          label="Target Accounts" 
          action={
            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
              {tempLinkedAccounts.length === 0 ? 'All' : `${tempLinkedAccounts.length} Selected`}
            </span>
          }
        />

        <div className="flex flex-col divide-y divide-neutral-100 dark:divide-[#222222]">
          {renderToggleRow("All Accounts", tempLinkedAccounts.length === 0, () => setTempLinkedAccounts([]), true)}
          
          {accounts.map(acc => {
            if (!acc.id) return null;
            return renderToggleRow(acc.bankName, tempLinkedAccounts.includes(acc.id), () => toggleAccount(acc.id!));
          })}
        </div>
      </SectionCard>

      {/* ── TAGS SECTION ── */}
      <SectionCard>
        <SectionTitle 
          icon={<TagIcon className="w-4 h-4" />} 
          label="Target Tags" 
          action={
            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
              {tempLinkedTags.length === 0 ? 'All' : `${tempLinkedTags.length} Selected`}
            </span>
          }
        />

        <div className="flex flex-col divide-y divide-neutral-100 dark:divide-[#222222]">
          {renderToggleRow("All Tags", tempLinkedTags.length === 0, () => setTempLinkedTags([]), true)}
          
          {tags.map(tag => {
            return renderToggleRow(`#${tag.name}`, tempLinkedTags.includes(tag.name), () => toggleTag(tag.name));
          })}
        </div>
      </SectionCard>

      {/* ── ENVELOPES ROLLOVER SECTION ── */}
      <SectionCard>
        <SectionTitle 
          icon={<Check className="w-4 h-4" />} 
          label="Envelope Rollovers" 
          action={
            <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">
              {tempRollovers.length === 0 ? 'None' : `${tempRollovers.length} Enabled`}
            </span>
          }
        />
        
        <p className="text-[10px] font-semibold text-neutral-400/80 leading-relaxed px-2 mb-4">
          Enable rollover to carry forward unspent funds from previous months into the current month's budget.
        </p>

        <div className="flex flex-col divide-y divide-neutral-100 dark:divide-[#222222]">
          {currentMonthBudgets.length === 0 && (
            <p className="text-[10px] text-neutral-400 text-center py-4">No envelopes defined for this month.</p>
          )}
          {currentMonthBudgets.map(b => {
            if (!b.id) return null;
            return renderToggleRow(b.category, tempRollovers.includes(b.id), () => toggleRollover(b.id!));
          })}
        </div>
      </SectionCard>

    </div>
  );
}
