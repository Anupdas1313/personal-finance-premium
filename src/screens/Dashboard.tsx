import { useLiveQuery } from 'dexie-react-hooks';
import { db, normalizeType } from '../models/db';
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, X, AlertCircle, CheckCircle2, Search, ChevronDown, Landmark, Smartphone, ArrowLeft, Calendar, Clock, Calculator, MoreHorizontal, User, AlignLeft, Hash, Paperclip, Save, ChevronRight, CreditCard, Coins, PlaneTakeoff, Eye, EyeOff, Wand2, BarChart3, Target } from 'lucide-react';

import { format, startOfMonth, endOfMonth, startOfYear, isToday, isYesterday, startOfDay } from 'date-fns';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';
import { useBudgets } from '../hooks/useBudgets';

import { CATEGORY_ICONS, CATEGORY_COLORS } from '../constants';



import { useAuth } from '../context/AuthContext';
import { AIChatEntry } from '../components/AIChatEntry';
import { IndusIndLogo } from '../components/IndusIndLogo';
import { UnionBankLogo } from '../components/UnionBankLogo';
import { BankLogo } from '../components/BankLogo';
import TutorialOverlay from '../components/TutorialOverlay';
import { useCurrency, useCurrencyFormatter } from '../hooks/useCurrency';
import { cn } from '../logic/utils';

// ── Budget Health Widget ────────────────────────────────────────────────────
function BudgetHealthWidget({ formatAmount, shouldBlur }: { formatAmount: (n: number) => string; shouldBlur: boolean }) {
  const now = new Date();
  const currentMonthStr = format(startOfMonth(now), 'yyyy-MM');
  const {
    masterBudgetAmt, envelopeBudgets, totalAllocated, totalSpent, unallocated, getCardData,
  } = useBudgets(currentMonthStr, now);

  // Don't render if no budgets are set up
  if (masterBudgetAmt === 0 && envelopeBudgets.length === 0) return null;

  const remaining = masterBudgetAmt - totalSpent;
  const pctUsed = masterBudgetAmt > 0 ? Math.min((totalSpent / masterBudgetAmt) * 100, 100) : 0;
  const barColor = pctUsed >= 100 ? '#E53935' : pctUsed >= 80 ? '#F59E0B' : '#00A86B';

  // Top 2 envelopes closest to limit
  const topEnvelopes = envelopeBudgets
    .map(b => getCardData(b, false))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2);

  return (
    <div className="bg-white dark:bg-[#0F0F12] rounded-[24px] border border-neutral-200 dark:border-[#1E1E24] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-green/10 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-brand-green" />
          </div>
          <h3 className="text-[13px] font-semibold text-neutral-700 dark:text-[#F7F7F7]">Budget Health</h3>
        </div>
        <Link to="/budgets" className="text-[10px] font-black text-brand-green bg-brand-green/5 px-2.5 py-1 rounded-lg uppercase tracking-widest hover:bg-brand-green/10 transition-all">
          View All
        </Link>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between items-end mb-1.5">
          <span className={cn(
            "text-xs font-bold tracking-tight transition-all duration-300",
            shouldBlur && "blur-[4px] select-none"
          )}>
            <span className="text-neutral-500 dark:text-neutral-400">{formatAmount(totalSpent)}</span>
            <span className="text-neutral-300 dark:text-neutral-600 mx-1">/</span>
            <span className="text-neutral-700 dark:text-[#F7F7F7]">{formatAmount(masterBudgetAmt)}</span>
          </span>
          <span className={cn(
            "text-[10px] font-bold",
            remaining < 0 ? "text-rose-500" : "text-brand-green"
          )}>
            {remaining >= 0 ? `${formatAmount(remaining)} left` : `${formatAmount(Math.abs(remaining))} over`}
          </span>
        </div>
        <div className="w-full h-2 bg-neutral-100 dark:bg-[#1A1A1E] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pctUsed}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* Top envelopes */}
      {topEnvelopes.length > 0 && (
        <div className="space-y-2">
          {topEnvelopes.map(card => (
            <div key={card.budget.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">{CATEGORY_ICONS[card.budget.category] || '📦'}</span>
                <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 truncate">{card.budget.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1 bg-neutral-100 dark:bg-[#222] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${card.pct}%`, backgroundColor: card.barColor }}
                  />
                </div>
                <span className={cn(
                  "text-[10px] font-bold w-8 text-right",
                  card.isOver ? "text-rose-500" : card.isWarning ? "text-amber-500" : "text-neutral-400"
                )}>
                  {Math.round(card.pct)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { currency, hideDecimals, formatAmount } = useCurrencyFormatter();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const accounts = useLiveQuery(async () => {
    const arr = await db.accounts.toArray();
    return [...arr].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [user?.uid]) || [];
  const transactions = useLiveQuery(() => db.transactions.orderBy('dateTime').reverse().limit(5).toArray(), [user?.uid]) || [];




  const [isAddingManual, setIsAddingManual] = useState(searchParams.get('add') === 'true');
  const [showTutorial, setShowTutorial] = useState(false);
  const userSettings = useLiveQuery(() => db.userSettings.toArray(), [user?.uid]);
  const isPrivacyMode = userSettings?.find(s => s.key === 'privacy_mode')?.value === true;
  const defaultAccountId = userSettings?.find(s => s.key === 'default_account_id')?.value;
  const [revealBalances, setRevealBalances] = useState(false);
  const shouldBlur = isPrivacyMode && !revealBalances;

  const handleTogglePrivacyMode = async () => {
    try {
      const existing = await db.userSettings.where('key').equals('privacy_mode').first();
      if (existing) {
        await db.userSettings.update(existing.id!, { value: !isPrivacyMode });
      } else {
        await db.userSettings.add({ key: 'privacy_mode', value: !isPrivacyMode });
      }
    } catch (err) {
      console.error('Failed to toggle privacy mode:', err);
    }
  };

  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % 3);
    }, 2000); // auto transitions every 2 seconds
    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    if (userSettings && user) {
      const isTutorialCompleteLocal = localStorage.getItem(`tutorialComplete_${user.uid}`) === 'true';
      const isTutorialCompleteCloud = userSettings.find(s => s.key === 'tutorialComplete')?.value === true;
      if (!isTutorialCompleteLocal && !isTutorialCompleteCloud) {
        setShowTutorial(true);
      }
    }
  }, [userSettings, user]);

  const handleTutorialComplete = async () => {
    setShowTutorial(false);
    if (user) {
      localStorage.setItem(`tutorialComplete_${user.uid}`, 'true');
      await db.userSettings.put({ key: 'tutorialComplete', value: true });
    }
  };

  // Sync state with URL and ensure fresh current time on open
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      db.transactions.get(Number(editId)).then(tx => {
        if (tx) {
          setAmount(tx.amount.toString());
          setCategory(tx.category || 'Other');
          setNote(tx.note || '');
          setPartyName(tx.party || '');
          setTransactionDate(format(new Date(tx.dateTime), "yyyy-MM-dd'T'HH:mm"));
          setPaymentMethod(tx.paymentMethod as any || 'UPI');
          setUpiApp((tx as any).upiApp || 'GPay');
          setExpenseType(tx.expenseType || '');
          setSelectedBudgetId(tx.linkedBudgetId || 'auto');
          setEntryMode('MANUAL');
          setEditingTransactionId(Number(editId));
          setIsAddingManual(true);

          if (tx.category === 'Transfer' || tx.linkedTransactionId) {
            setType('TRANSFER');
            if (tx.type === 'DEBIT') {
              setSelectedAccountId(tx.accountId);
              if (tx.linkedTransactionId) {
                db.transactions.get(tx.linkedTransactionId).then(linked => {
                  if (linked) setToAccountId(linked.accountId);
                });
              }
            } else {
              setToAccountId(tx.accountId);
              if (tx.linkedTransactionId) {
                db.transactions.get(tx.linkedTransactionId).then(linked => {
                  if (linked) setSelectedAccountId(linked.accountId);
                });
              }
            }
          } else {
            setType(tx.type);
            setSelectedAccountId(tx.accountId);
            setToAccountId('');
          }
        }
      });
    } else if (searchParams.get('add') === 'true') {
      setIsAddingManual(true);
      setTransactionDate(new Date().toISOString().slice(0, 16));
      const paramAccountId = searchParams.get('accountId');
      if (paramAccountId) {
        setSelectedAccountId(Number(paramAccountId));
      }
    }
  }, [searchParams]);



  const closeMenu = () => {
    setIsAddingManual(false);
    setEditingTransactionId(null);
    if (searchParams.get('add') || searchParams.get('edit')) {
      navigate('/', { replace: true });
    }
  };

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'CREDIT' | 'DEBIT' | 'TRANSFER' | ''>('DEBIT');
  const [category, setCategory] = useState('Other');
  const [note, setNote] = useState('');
  const [partyName, setPartyName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const [toAccountId, setToAccountId] = useState<number | ''>('');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Bank' | 'Cash' | 'Credit Card' | 'Bank Transfer'>('UPI');
  const [upiApp, setUpiApp] = useState('GPay');
  const { tags } = useTags();
  const [expenseType, setExpenseType] = useState<string>('');
  const [entryMode, setEntryMode] = useState<'MANUAL' | 'CHAT'>('CHAT');
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);

  useEffect(() => {
    // Only reset date for NEW transactions, not when editing existing ones
    if (isAddingManual && !editingTransactionId) {
      setTransactionDate(new Date().toISOString().slice(0, 16));
    }
  }, [isAddingManual, editingTransactionId]);

  const currentMonthStr = format(new Date(transactionDate), 'yyyy-MM');
  const activeMonthBudgets = useLiveQuery(() => db.budgets.where('month').equals(currentMonthStr).toArray(), [currentMonthStr, user?.uid]) || [];
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | 'auto'>('auto');

  useEffect(() => {
    if (activeMonthBudgets.length > 0) {
      const matchingBudget = activeMonthBudgets.find(b => b.category === category);
      if (matchingBudget) {
        setSelectedBudgetId(matchingBudget.id!);
      } else {
        setSelectedBudgetId('auto');
      }
    }
  }, [category, activeMonthBudgets]);

  const selectedBudget = activeMonthBudgets.find(b => b.id === selectedBudgetId);
  const selectedBudgetSpent = useLiveQuery(async () => {
    if (!selectedBudget) return 0;
    const start = startOfMonth(new Date(transactionDate));
    const end = endOfMonth(new Date(transactionDate));
    const txs = await db.transactions.where('dateTime').between(start, end).toArray();
    return txs.reduce((sum, tx) => {
      if (tx.type !== 'DEBIT') return sum;
      if (tx.linkedBudgetId) {
        return tx.linkedBudgetId === selectedBudget.id ? sum + Number(tx.amount) : sum;
      }
      return tx.category === selectedBudget.category ? sum + Number(tx.amount) : sum;
    }, 0);
  }, [selectedBudget, transactionDate]) || 0;

  // Set default expense type once tags load
  useEffect(() => {
    if (tags.length > 0 && !expenseType) {
      setExpenseType(tags[0]);
    }
  }, [tags]);

  // Auto-select preferred or first account when accounts load and none selected
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      const preferredAcc = accounts.find(a => Number(a.id) === Number(defaultAccountId)) || accounts[0];
      setSelectedAccountId(preferredAcc.id!);
      if ((preferredAcc as any).type === 'CASH') setPaymentMethod('Cash');
      else if ((preferredAcc as any).type === 'CREDIT_CARD') setPaymentMethod('Credit Card');
    }
  }, [accounts, selectedAccountId, defaultAccountId]);

  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [timeFilter, setTimeFilter] = useState<'All Time' | 'This Month' | 'This Year'>('All Time');
  const [isAmountsHidden, setIsAmountsHidden] = useState(false);
  
  const { categories: appCategories } = useCategories();

  const handleSaveManual = async (txData?: any) => {
    const isFromChat = !!txData;
    const currentAmount = isFromChat ? txData.amount : amount;
    const currentType = normalizeType(isFromChat ? txData.type : type);
    const currentSelectedAccountId = isFromChat ? txData.selectedAccountId : selectedAccountId;
    const currentToAccountId = isFromChat ? txData.toAccountId : toAccountId;
    const currentPaymentMethod = isFromChat ? txData.paymentMethod : paymentMethod;
    const currentUpiApp = isFromChat ? txData.upiApp : upiApp;
    const currentExpenseType = isFromChat ? txData.expenseType : expenseType;
    const currentPartyName = isFromChat ? txData.party : partyName;
    const currentNote = isFromChat ? txData.note : note;
    
    let currentCategory = isFromChat ? txData.category : category;
    if (!currentCategory || currentCategory.trim() === '') {
      currentCategory = currentType === 'TRANSFER' ? 'Transfer' : 'Other';
    }

    const currentTransactionDate = isFromChat ? txData.transactionDate : transactionDate;

    setIsSaving(true);
    setStatus('idle');
    try {
      if (currentType === 'TRANSFER') {
        if (!currentToAccountId) {
          setStatus('error');
          setErrorMessage('Please select a destination account for the transfer.');
          return;
        }
        if (Number(currentSelectedAccountId) === Number(currentToAccountId)) {
          setStatus('error');
          setErrorMessage('Source and destination accounts cannot be the same.');
          return;
        }

        const isTodaySelected = format(new Date(currentTransactionDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        const finalDateTime = isTodaySelected ? new Date() : new Date(currentTransactionDate);
        const amountVal = parseFloat(currentAmount.toString().replace(/,/g, '')) || 0;

        // Base Debit Payload
        const debitPayload = {
          accountId: Number(currentSelectedAccountId),
          amount: amountVal,
          type: 'DEBIT' as const,
          dateTime: finalDateTime,
          note: currentNote || `Transfer to ${accounts.find(a => a.id === Number(currentToAccountId))?.bankName || 'Other Account'}`,
          category: 'Transfer',
          paymentMethod: currentPaymentMethod,
          upiApp: currentPaymentMethod === 'UPI' ? currentUpiApp : undefined,
          party: accounts.find(a => a.id === Number(currentToAccountId))?.bankName || 'Other Account',
          expenseType: currentExpenseType
        };

        // Base Credit Payload
        const creditPayload = {
          accountId: Number(currentToAccountId),
          amount: amountVal,
          type: 'CREDIT' as const,
          dateTime: finalDateTime,
          note: currentNote || `Transfer from ${accounts.find(a => a.id === Number(currentSelectedAccountId))?.bankName || 'Other Account'}`,
          category: 'Transfer',
          paymentMethod: currentPaymentMethod,
          upiApp: currentPaymentMethod === 'UPI' ? currentUpiApp : undefined,
          party: accounts.find(a => a.id === Number(currentSelectedAccountId))?.bankName || 'Other Account',
          expenseType: currentExpenseType
        };

        Object.keys(debitPayload).forEach(k => (debitPayload as any)[k] === undefined && delete (debitPayload as any)[k]);
        Object.keys(creditPayload).forEach(k => (creditPayload as any)[k] === undefined && delete (creditPayload as any)[k]);

        if (editingTransactionId) {
          const existing = await db.transactions.get(editingTransactionId);
          if (existing) {
            if (existing.linkedTransactionId) {
              // Existing linked transfer, update both
              await db.transactions.update(editingTransactionId, {
                ...debitPayload,
                linkedTransactionId: existing.linkedTransactionId
              });
              await db.transactions.update(existing.linkedTransactionId, {
                ...creditPayload,
                linkedTransactionId: editingTransactionId
              });
            } else {
              // Legacy transfer, create a counterpart and link it
              const counterpartId = await db.transactions.add({
                ...creditPayload,
                linkedTransactionId: editingTransactionId
              });
              await db.transactions.update(editingTransactionId, {
                ...debitPayload,
                linkedTransactionId: counterpartId
              });
            }
          }
        } else {
          // New transfer: Add Debit side first, get ID, add Credit side, update Debit side.
          const debitId = await db.transactions.add(debitPayload);
          const creditId = await db.transactions.add({
            ...creditPayload,
            linkedTransactionId: debitId
          });
          await db.transactions.update(debitId, {
            linkedTransactionId: creditId
          });
        }
      } else {
        const isTodaySelected = format(new Date(currentTransactionDate), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        const finalDateTime = isTodaySelected ? new Date() : new Date(currentTransactionDate);

        // If editing an existing transaction that was previously a transfer, delete its counterpart
        if (editingTransactionId) {
          const existing = await db.transactions.get(editingTransactionId);
          if (existing?.linkedTransactionId) {
            await db.transactions.delete(existing.linkedTransactionId);
          }
        }

        const txPayload = {
          accountId: Number(currentSelectedAccountId),
          amount: parseFloat(currentAmount.toString().replace(/,/g, '')) || 0,
          type: currentType as 'CREDIT' | 'DEBIT',
          dateTime: finalDateTime,
          note: currentNote || '',
          category: currentCategory,
          paymentMethod: currentPaymentMethod,
          upiApp: currentPaymentMethod === 'UPI' ? currentUpiApp : undefined,
          party: currentPartyName,
          expenseType: currentExpenseType,
          linkedBudgetId: txData && 'linkedBudgetId' in txData
            ? (txData.linkedBudgetId ? Number(txData.linkedBudgetId) : undefined)
            : (selectedBudgetId === 'auto' ? undefined : Number(selectedBudgetId)),
          linkedTransactionId: undefined // ensure link is cleared
        };

        // Remove undefined properties to prevent Dexie/Firestore errors
        Object.keys(txPayload).forEach(key => {
          if ((txPayload as any)[key] === undefined) {
            delete (txPayload as any)[key];
          }
        });

        if (editingTransactionId) {
          await db.transactions.update(editingTransactionId, txPayload);
        } else {
          await db.transactions.add(txPayload as any);
        }
      }
      
      setIsSaving(false);
      setStatus('success');
      setTimeout(() => {
        closeMenu();
        setStatus('idle');
        setAmount('');
        setType('DEBIT');
        setNote('');
        setPartyName('');
        setCategory('Other');
        setTransactionDate(new Date().toISOString().slice(0, 16));
        setPaymentMethod('UPI');
        setUpiApp('GPay');
        setExpenseType(tags[0] || '');
        setEditingTransactionId(null);
        setSelectedBudgetId('auto');
      }, 800);
    } catch (error) {
      setIsSaving(false);
      setStatus('error');
      setErrorMessage('Failed to save transaction.');
      console.error(error);
    }
  };

  const monthlyClosings = useLiveQuery(() => db.monthlyClosings.orderBy('month').reverse().toArray(), [user?.uid]) || [];
  const allClosings = useLiveQuery(() => db.accountClosings.toArray(), [user?.uid]) || [];

  // Optimized balance and metrics calculation
  const { balances, totalIncome, totalSpending, totalWealth, thisMonthSpendingToDate, lastMonthSpendingToDate, todaySpending, yesterdaySpending, thisWeekSpending, lastWeekSpending } = useLiveQuery(async () => {
    const rawAccs = await db.accounts.toArray();
    const accs = [...rawAccs].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const closings = await db.accountClosings.toArray();
    const monthlyClosings = await db.monthlyClosings.orderBy('month').reverse().toArray();
    const latestMonthly = monthlyClosings[0];

    let income = 0;
    let spending = 0;

    const now = new Date();
    const monthStart = startOfMonth(now).getTime();
    const yearStart = startOfYear(now).getTime();

    // 1. Calculate REAL-TIME balances for all accounts from the entire history
    const allTxs = await db.transactions.toArray();
    
    const calculatedBalances = accs.map(acc => {
      let bal = Number(acc.startingBalance) || 0;
      const accountTxs = allTxs.filter(t => Number(t.accountId) === Number(acc.id));
      accountTxs.forEach(tx => {
        const txType = normalizeType(tx.type);
        if (txType === 'CREDIT') bal += (Number(tx.amount) || 0);
        else if (txType === 'DEBIT') bal -= (Number(tx.amount) || 0);
      });
      return bal;
    });

    // 2. Calculate metrics (Income/Spending) based on time filter
    allTxs.forEach(tx => {
      const txTime = new Date(tx.dateTime).getTime();
      let isInRange = false;
      
      if (timeFilter === 'This Month') {
        isInRange = txTime >= monthStart;
      } else if (timeFilter === 'This Year') {
        isInRange = txTime >= yearStart;
      } else {
        isInRange = true; // All Time
      }

      // Exclude transfers from income/spending metrics to avoid double-counting
      if (isInRange && tx.category !== 'Transfer') {
        const txType = normalizeType(tx.type);
        if (txType === 'CREDIT') income += (Number(tx.amount) || 0);
        else if (txType === 'DEBIT') spending += (Number(tx.amount) || 0);
      }
    });

    const totalWealth = calculatedBalances.reduce((sum, b) => sum + b, 0);

    // 3. Insights calculations
    let thisMonthSpendingToDate = 0;
    let lastMonthSpendingToDate = 0;
    const currentDayOfMonth = now.getDate();
    
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const lastMonthCurrentDay = new Date(now.getFullYear(), now.getMonth() - 1, currentDayOfMonth, 23, 59, 59).getTime();

    // Daily
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
    const yesterdaySameTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, now.getHours(), now.getMinutes(), now.getSeconds()).getTime();

    // Weekly
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now.getTime() - 14 * 24 * 60 * 60 * 1000;

    let todaySpending = 0;
    let yesterdaySpending = 0;
    let thisWeekSpending = 0;
    let lastWeekSpending = 0;

    allTxs.forEach(tx => {
      if (tx.category !== 'Transfer' && normalizeType(tx.type) === 'DEBIT') {
        const txTime = new Date(tx.dateTime).getTime();
        // Monthly
        if (txTime >= monthStart && txTime <= now.getTime()) {
          thisMonthSpendingToDate += (Number(tx.amount) || 0);
        } else if (txTime >= lastMonthStart && txTime <= lastMonthCurrentDay) {
          lastMonthSpendingToDate += (Number(tx.amount) || 0);
        }
        // Daily
        if (txTime >= todayStart && txTime <= now.getTime()) {
          todaySpending += (Number(tx.amount) || 0);
        } else if (txTime >= yesterdayStart && txTime <= yesterdaySameTime) {
          yesterdaySpending += (Number(tx.amount) || 0);
        }
        // Weekly
        if (txTime >= sevenDaysAgo && txTime <= now.getTime()) {
          thisWeekSpending += (Number(tx.amount) || 0);
        } else if (txTime >= fourteenDaysAgo && txTime <= sevenDaysAgo) {
          lastWeekSpending += (Number(tx.amount) || 0);
        }
      }
    });

    return { 
      balances: accs.map((acc, i) => ({ ...acc, currentBalance: calculatedBalances[i] })), 
      totalIncome: income, 
      totalSpending: spending,
      totalWealth,
      thisMonthSpendingToDate,
      lastMonthSpendingToDate,
      todaySpending,
      yesterdaySpending,
      thisWeekSpending,
      lastWeekSpending
    };
  }, [timeFilter, user?.uid]) || { balances: [], totalIncome: 0, totalSpending: 0, totalWealth: 0, thisMonthSpendingToDate: 0, lastMonthSpendingToDate: 0, todaySpending: 0, yesterdaySpending: 0, thisWeekSpending: 0, lastWeekSpending: 0 };
  
  const monthDelta = totalIncome - totalSpending;
  const totalBalance = balances.reduce((sum, acc) => sum + acc.currentBalance, 0);

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, typeof balances> = {
      'BANK': [],
      'CASH': [],
      'CREDIT_CARD': []
    };
    balances.forEach(acc => {
      const type = (acc as any).type || 'BANK';
      if (!groups[type]) groups[type] = [];
      groups[type].push(acc);
    });

    const getMinSortOrder = (type: string) => {
       const arr = groups[type];
       if (arr.length === 0) return 999999;
       return Math.min(...arr.map((a: any) => a.sortOrder || 0));
    };

    const sortedTypes = ['BANK', 'CASH', 'CREDIT_CARD'].sort((a, b) => getMinSortOrder(a) - getMinSortOrder(b));
    const sortedGroups: Record<string, any[]> = {};
    for (const type of sortedTypes) {
       sortedGroups[type] = groups[type];
    }
    return sortedGroups;
  }, [balances]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const renderAccountItem = (acc: any) => (
    <div 
      key={acc.id} 
      className="p-4 mb-2 rounded-2xl flex items-center justify-between bg-white dark:bg-[#111111] border border-neutral-100/80 dark:border-white/5 hover:border-brand-green/20 dark:hover:border-white/10 transition-all group cursor-pointer shadow-sm active:scale-[0.99]" 
      onClick={() => navigate('/accounts')}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-neutral-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center overflow-hidden p-1 shadow-sm border border-[#EBEBEB] dark:border-white/10 shrink-0 group-hover:scale-105 transition-transform">
          <BankLogo bankName={acc.bankName} type={acc.type} className="w-full h-full" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-xs text-[#111111] dark:text-[#F7F7F7] truncate tracking-tight">{acc.bankName}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-widest">
              {acc.type === 'CASH' ? 'Cash' : `**** ${acc.accountLast4}`}
            </span>
            {acc.currentBalance < 1000 && acc.type !== 'CREDIT_CARD' && (
              <span className="w-1 h-1 rounded-full bg-brand-red animate-pulse"></span>
            )}
          </div>
        </div>
      </div>
      <div className="text-right" onClick={(e) => {
        if (isPrivacyMode) {
          e.stopPropagation();
          setRevealBalances(!revealBalances);
        }
      }}>
        <p className={cn(
          "font-heading font-black text-sm tracking-tighter transition-all duration-300",
          acc.currentBalance < 0 ? 'text-brand-red' : 'text-brand-green',
          shouldBlur && "blur-[5px] select-none cursor-pointer"
        )}>
          {formatAmount(acc.currentBalance)}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Greeting Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-[#1A237E]/40 dark:text-[#777777] tracking-[0.2em] uppercase">{greeting},</p>
          <h1 className="text-2xl font-heading font-black text-[#1A237E] dark:text-[#F7F7F7] leading-tight tracking-tight">{user?.displayName || 'Guest User'} 👋</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTogglePrivacyMode}
            title={isPrivacyMode ? "Show Balances" : "Hide Balances"}
            className="p-2 bg-neutral-100 dark:bg-[#222226] text-neutral-600 dark:text-neutral-300 rounded-full hover:bg-neutral-200 dark:hover:bg-[#2B2B32] transition-colors flex items-center justify-center cursor-pointer outline-none"
          >
            {isPrivacyMode ? <EyeOff className="w-5 h-5 text-rose-500" /> : <Eye className="w-5 h-5" />}
          </button>
          
          <div
            title={user?.displayName || 'Guest User'}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1A237E] to-[#4A4ABF] flex items-center justify-center text-white select-none shadow-lg cursor-pointer border-2 border-white dark:border-[#1A1A1E]"
          >
            {user?.displayName ? (
              <span className="font-black text-sm">{user.displayName[0].toUpperCase()}</span>
            ) : (
              <User className="w-5 h-5" />
            )}
          </div>
        </div>
      </div>

      {/* Cash Flow Hero Card - REDUCED SIZE */}
      <div 
        className="relative overflow-hidden rounded-[24px] bg-white p-4 shadow-sm border border-neutral-200 group"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
        
        <div className="relative z-10 flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-semibold text-neutral-500 tracking-tight">Cash Flow</h2>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as any)}
              className="appearance-none bg-neutral-50 text-neutral-700 text-[12px] font-semibold px-2.5 py-1 rounded-lg pr-6 cursor-pointer outline-none transition-colors border border-neutral-200"
            >
              <option value="This Month">This Month</option>
              <option value="This Year">This Year</option>
              <option value="All Time">All Time</option>
            </select>
            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
          </div>
        </div>

        <div className="relative z-10 flex justify-between items-center mb-5 px-1" onClick={() => isPrivacyMode && setRevealBalances(!revealBalances)}>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-rose-500 mb-1">Outflow</p>
            <p className={cn(
              "text-xl font-bold text-neutral-900 tracking-tight transition-all duration-300",
              shouldBlur && "blur-[6px] select-none cursor-pointer"
            )}>
              {formatAmount(totalSpending)}
            </p>
          </div>
          
          <div className="w-px h-8 bg-neutral-200 mx-4"></div>

          <div className="flex-1">
            <p className="text-[13px] font-semibold text-brand-green mb-1">Inflow</p>
            <p className={cn(
              "text-xl font-bold text-neutral-900 tracking-tight transition-all duration-300",
              shouldBlur && "blur-[6px] select-none cursor-pointer"
            )}>
              {formatAmount(totalIncome)}
            </p>
          </div>
        </div>

        <div className="relative z-10 bg-neutral-50 border border-neutral-200 rounded-2xl p-3 flex justify-between items-center" onClick={() => isPrivacyMode && setRevealBalances(!revealBalances)}>
          <div className="flex flex-col">
            <p className="text-[13px] font-semibold text-neutral-500 leading-none mb-1">Total Cash</p>
            {timeFilter !== 'All Time' && (
              <p className={cn(
                `text-[11px] font-semibold tracking-tight transition-all duration-300 ${monthDelta >= 0 ? 'text-brand-green' : 'text-rose-500'}`,
                shouldBlur && "blur-[4px] select-none cursor-pointer"
              )}>
                {monthDelta >= 0 ? '↑' : '↓'} {formatAmount(Math.abs(monthDelta))}
              </p>
            )}
          </div>
          <p className={cn(
            "text-lg font-bold tracking-tight text-neutral-900 transition-all duration-300",
            shouldBlur && "blur-[6px] select-none cursor-pointer"
          )}>
            {formatAmount(totalWealth)}
          </p>
        </div>
      </div>

      {/* Sliding Insights Card */}
      <div 
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
        className="bg-brand-green/5 border border-brand-green/10 rounded-[24px] p-4 relative overflow-hidden group hover:border-brand-green/20 transition-colors min-h-[148px] flex flex-col justify-between"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full flex-1 flex flex-col justify-between"
          >
            {activeSlide === 0 && (
              <div onClick={() => isPrivacyMode && setRevealBalances(!revealBalances)}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-brand-green mb-1">Daily Insights</h3>
                    <p className="text-sm font-semibold text-neutral-800 leading-tight">
                      {todaySpending > yesterdaySpending ? (
                        <>You've spent <span className={cn("text-rose-500 font-bold transition-all duration-300", shouldBlur && "blur-[5px] select-none")}>{formatAmount(todaySpending - yesterdaySpending)} more</span> than yesterday at this time.</>
                      ) : (
                        <>You've spent <span className={cn("text-brand-green font-bold transition-all duration-300", shouldBlur && "blur-[5px] select-none")}>{formatAmount(yesterdaySpending - todaySpending)} less</span> than yesterday at this time.</>
                      )}
                    </p>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${todaySpending > yesterdaySpending ? 'bg-rose-500/10 text-rose-500' : 'bg-brand-green/10 text-brand-green'}`}>
                    <BarChart3 className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-auto">
                  <div>
                    <p className="text-[12px] font-medium text-neutral-500">Today</p>
                    <p className={cn("text-xs font-bold text-neutral-800 transition-all duration-300", shouldBlur && "blur-[4px] select-none")}>{formatAmount(todaySpending)}</p>
                  </div>
                  <div className="w-px h-6 bg-neutral-200"></div>
                  <div>
                    <p className="text-[12px] font-medium text-neutral-500">Yesterday (to this hour)</p>
                    <p className={cn("text-xs font-bold text-neutral-800 transition-all duration-300", shouldBlur && "blur-[4px] select-none")}>{formatAmount(yesterdaySpending)}</p>
                  </div>
                </div>
              </div>
            )}

            {activeSlide === 1 && (
              <div onClick={() => isPrivacyMode && setRevealBalances(!revealBalances)}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-brand-green mb-1">Weekly Insights</h3>
                    <p className="text-sm font-semibold text-neutral-800 leading-tight">
                      {thisWeekSpending > lastWeekSpending ? (
                        <>You've spent <span className={cn("text-rose-500 font-bold transition-all duration-300", shouldBlur && "blur-[5px] select-none")}>{formatAmount(thisWeekSpending - lastWeekSpending)} more</span> than the previous 7 days.</>
                      ) : (
                        <>You've spent <span className={cn("text-brand-green font-bold transition-all duration-300", shouldBlur && "blur-[5px] select-none")}>{formatAmount(lastWeekSpending - thisWeekSpending)} less</span> than the previous 7 days.</>
                      )}
                    </p>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${thisWeekSpending > lastWeekSpending ? 'bg-rose-500/10 text-rose-500' : 'bg-brand-green/10 text-brand-green'}`}>
                    <BarChart3 className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-auto">
                  <div>
                    <p className="text-[12px] font-medium text-neutral-500">This Week</p>
                    <p className={cn("text-xs font-bold text-neutral-800 transition-all duration-300", shouldBlur && "blur-[4px] select-none")}>{formatAmount(thisWeekSpending)}</p>
                  </div>
                  <div className="w-px h-6 bg-neutral-200"></div>
                  <div>
                    <p className="text-[12px] font-medium text-neutral-500">Previous Week</p>
                    <p className={cn("text-xs font-bold text-neutral-800 transition-all duration-300", shouldBlur && "blur-[4px] select-none")}>{formatAmount(lastWeekSpending)}</p>
                  </div>
                </div>
              </div>
            )}

            {activeSlide === 2 && (
              <div onClick={() => isPrivacyMode && setRevealBalances(!revealBalances)}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-[13px] font-semibold text-brand-green mb-1">Monthly Insights</h3>
                    <p className="text-sm font-semibold text-neutral-800 leading-tight">
                      {thisMonthSpendingToDate > lastMonthSpendingToDate ? (
                        <>You've spent <span className={cn("text-rose-500 font-bold transition-all duration-300", shouldBlur && "blur-[5px] select-none")}>{formatAmount(thisMonthSpendingToDate - lastMonthSpendingToDate)} more</span> than last month at this time.</>
                      ) : (
                        <>You've spent <span className={cn("text-brand-green font-bold transition-all duration-300", shouldBlur && "blur-[5px] select-none")}>{formatAmount(lastMonthSpendingToDate - thisMonthSpendingToDate)} less</span> than last month at this time.</>
                      )}
                    </p>
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${thisMonthSpendingToDate > lastMonthSpendingToDate ? 'bg-rose-500/10 text-rose-500' : 'bg-brand-green/10 text-brand-green'}`}>
                    <BarChart3 className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-auto">
                  <div>
                    <p className="text-[12px] font-medium text-neutral-500">This Month</p>
                    <p className={cn("text-xs font-bold text-neutral-800 transition-all duration-300", shouldBlur && "blur-[4px] select-none")}>{formatAmount(thisMonthSpendingToDate)}</p>
                  </div>
                  <div className="w-px h-6 bg-neutral-200"></div>
                  <div>
                    <p className="text-[12px] font-medium text-neutral-500">Last Month (to this day)</p>
                    <p className={cn("text-xs font-bold text-neutral-800 transition-all duration-300", shouldBlur && "blur-[4px] select-none")}>{formatAmount(lastMonthSpendingToDate)}</p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Small Dot Navigation indicators */}
        <div className="absolute bottom-3 right-4 flex gap-1">
          {[0, 1, 2].map(idx => (
            <div 
              key={idx}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${activeSlide === idx ? 'bg-brand-green w-3' : 'bg-brand-green/20'}`}
            />
          ))}
        </div>
      </div>

      {/* Budget Health Widget */}
      <BudgetHealthWidget formatAmount={formatAmount} shouldBlur={shouldBlur} />

      {/* Improved Partitioned Portfolio */}
      <div className="space-y-4 mb-10">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-heading font-black text-brand-blue dark:text-white tracking-tight flex items-center gap-2">
            Net Worth <span className="w-1.5 h-1.5 rounded-full bg-brand-green"></span>
          </h2>
          <Link to="/accounts" className="text-[10px] font-bold text-[#888] dark:text-neutral-500 hover:text-brand-green transition-all">Manage</Link>
        </div>

        {balances.length === 0 ? (
          <div className="bg-white dark:bg-[#0C0C0F] p-8 text-center text-neutral-400 text-xs font-bold uppercase tracking-widest rounded-3xl border border-dashed border-neutral-200 dark:border-white/5">No accounts discovered</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedAccounts).map(([type, accList]) => {
              if (accList.length === 0) return null;
              let title;
              if (type === 'BANK') {
                title = 'Checking & Savings';
              } else if (type === 'CREDIT_CARD') {
                title = 'Credit Lines';
              } else {
                title = 'Cash & Wallets';
              }
              const total = accList.reduce((sum, a) => sum + ((a as any).currentBalance || 0), 0);
              
              return (
                <div key={type} className="space-y-2">
                  {/* Clean Muted Header Row */}
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#888] dark:text-neutral-500">{title}</span>
                    <span className={cn("text-[10px] font-bold text-neutral-500 dark:text-neutral-400 tracking-tight transition-all duration-300", shouldBlur && "blur-[4px] select-none cursor-pointer")} onClick={() => isPrivacyMode && setRevealBalances(!revealBalances)}>
                      {formatAmount(total)}
                    </span>
                  </div>
                  {/* Accounts List */}
                  <div className="space-y-2">
                    {accList.map(renderAccountItem)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Entry Modal - Full Screen Restored */}
      {isAddingManual && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white dark:bg-[#0C0C0F] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-hidden font-sans">
          <div className="flex-1 flex flex-col overflow-hidden">
          {/* Elegant Header — More compact */}
          <div className="flex items-center justify-between px-3 py-1.5 pt-safe-top bg-white dark:bg-[#111111] border-b border-[#EBEBEB] dark:border-white/5 shadow-sm z-20">
            <button onClick={closeMenu} className="text-[#717171] dark:text-[#A0A0A5] hover:text-brand-blue dark:hover:text-brand-cyan transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
            <div className="flex bg-[#F7F7F7] dark:bg-white/5 p-0.5 rounded-xl border border-[#EBEBEB] dark:border-white/5">
              <button 
                onClick={() => setEntryMode('MANUAL')}
                className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all ${entryMode === 'MANUAL' ? 'bg-white dark:bg-white/10 text-brand-green dark:text-brand-green shadow-sm' : 'text-neutral-400'}`}
              >
                Manual
              </button>
              <button 
                onClick={() => setEntryMode('CHAT')}
                className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all flex items-center gap-1.5 ${entryMode === 'CHAT' ? 'bg-white dark:bg-white/10 text-brand-green dark:text-brand-green shadow-sm' : 'text-neutral-400'}`}
              >
                <Wand2 className="w-3 h-3" /> AI Chat
              </button>
            </div>
            <div className="w-6"></div> {/* Spacer to keep title centered */}
          </div>

          {/* Status Feedback */}
          {status === 'success' && (
            <div className="flex items-center justify-center gap-2 py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Transaction saved!
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center justify-center gap-2 py-2 bg-rose-50 dark:bg-rose-500/10 text-rose-500 font-bold text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              {errorMessage}
            </div>
          )}
          {/* Main Content Area */}
          {entryMode === 'CHAT' ? (
            <div className="flex-1 overflow-hidden">
               <AIChatEntry 
                 accounts={accounts} 
                 tags={tags} 
                 isSaving={isSaving}
                 showSuccess={status === 'success'}
                 onSave={(tx) => {
                   handleSaveManual(tx);
                 }} 
               />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto w-full px-4 pt-4 pb-24 space-y-2 scrollbar-hide no-scrollbar">
                
                {/* 1. Hero Card: Consolidates Flow, Amount, and Bank */}
                <div className="bg-[#F9FBFF] dark:bg-[#111111] rounded-2xl border border-brand-blue/5 dark:border-white/5 p-1 flex flex-col gap-1.5 shadow-sm">
                  {/* Top Row: Full-width Type Toggle */}
                  <div className="flex bg-[#F9FBFF] dark:bg-white/5 p-0.5 rounded-2xl w-full shrink-0">
                    <button onClick={() => setType('DEBIT')} className={`flex-1 py-1 text-[10px] font-bold rounded-xl transition-all uppercase tracking-[0.1em] ${type === 'DEBIT' ? 'bg-white dark:bg-[#2C2C34] text-brand-red shadow-sm' : 'text-neutral-400'}`}>Outflow</button>
                    <button onClick={() => setType('CREDIT')} className={`flex-1 py-1 text-[10px] font-bold rounded-xl transition-all uppercase tracking-[0.1em] ${type === 'CREDIT' ? 'bg-white dark:bg-[#2C2C34] text-brand-green shadow-sm' : 'text-neutral-400'}`}>Inflow</button>
                    <button onClick={() => setType('TRANSFER')} className={`flex-1 py-1 text-[10px] font-bold rounded-xl transition-all uppercase tracking-[0.1em] ${type === 'TRANSFER' ? 'bg-white dark:bg-[#2C2C34] text-brand-green shadow-sm' : 'text-neutral-400'}`}>Transfer</button>
                  </div>

                  {/* Middle Row: Split 50/50 (Amount Left, Bank Right) */}
                  <div className="grid grid-cols-2 gap-2 items-center h-[90px]">
                    {/* LEFT: Amount Segment */}
                    <div className="flex flex-col items-center gap-1 border-r border-[#EBEBEB] dark:border-white/5 pr-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-bold text-neutral-300 dark:text-[#333333]">{currency}</span>
                        <input 
                          type="number" inputMode="decimal" autoFocus value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" step="0.01"
                          className="bg-transparent text-xl font-heading font-bold text-center outline-none min-w-0 w-full text-brand-green dark:text-white tracking-tight caret-brand-green"
                        />
                      </div>
                      <div className="relative">
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F9FBFF] dark:bg-white/5 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors">
                          <Calendar className="w-2.5 h-2.5" />
                          <span className="text-[8px] font-bold uppercase tracking-wider">{format(new Date(transactionDate), 'dd MMM, hh:mm a')}</span>
                        </div>
                        <input type="datetime-local" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                      </div>
                    </div>

                    {/* RIGHT: Compact Account Selector */}
                    <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar max-h-full">
                      {accounts.map(acc => (
                        <button 
                          key={acc.id} 
                          onClick={() => {
                              if (type === 'TRANSFER') {
                                if (!selectedAccountId) setSelectedAccountId(acc.id!);
                                else if (selectedAccountId === acc.id) setSelectedAccountId('');
                                else setToAccountId(acc.id!);
                              } else {
                                setSelectedAccountId(acc.id!);
                                if ((acc as any).type === 'CASH') setPaymentMethod('Cash');
                                else if ((acc as any).type === 'CREDIT_CARD') setPaymentMethod('Credit Card');
                                else if (paymentMethod === 'Cash' || paymentMethod === 'Credit Card') setPaymentMethod('Bank');
                              }
                          }}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl border transition-all relative ${selectedAccountId === acc.id || toAccountId === acc.id ? 'bg-brand-green/5 dark:bg-brand-green/5 border-brand-green dark:border-brand-green shadow-sm' : 'bg-[#F9FBFF] dark:bg-white/[0.02] border-transparent'}`}
                        >
                          {selectedAccountId === acc.id && type === 'TRANSFER' && <div className="absolute -top-1 right-1 bg-brand-green text-white text-[5px] font-bold px-1 py-0.5 rounded-full uppercase tracking-tighter">F</div>}
                          {toAccountId === acc.id && type === 'TRANSFER' && <div className="absolute -top-1 right-1 bg-brand-cyan text-brand-blue text-[5px] font-bold px-1 py-0.5 rounded-full uppercase tracking-tighter">T</div>}
                          <div className="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center p-0.5 shadow-sm shrink-0"><BankLogo bankName={acc.bankName} type={(acc as any).type} className="w-full h-full" /></div>
                          <span className={`text-[9px] font-bold truncate ${(selectedAccountId === acc.id || toAccountId === acc.id) ? 'text-brand-green dark:text-brand-green' : 'text-neutral-500 dark:text-[#A0A0A5]'}`}>{acc.bankName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. Classification Tags — Right after Amount */}
                {type !== 'TRANSFER' && tags.length > 0 && (
                  <div className="flex flex-col gap-1 px-1">
                    <label className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest pl-1">Classification Tag</label>
                    <div className="flex flex-wrap gap-2 w-full">
                      {tags.map(tagName => (
                        <button 
                          key={tagName} 
                          onClick={() => setExpenseType(expenseType === tagName ? '' : tagName)} 
                          className={`flex-[1_0_21%] sm:flex-none sm:px-3 py-1.5 rounded-xl text-[9px] font-bold transition-all border ${
                            expenseType === tagName 
                              ? 'bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue border-transparent shadow-sm' 
                              : 'bg-[#F9FBFF] dark:bg-[#111111] dark:bg-white/[0.02] border-[#EBEBEB] dark:border-white/5 text-neutral-400 dark:text-neutral-500'
                          }`}
                        >
                          #{tagName}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Recipient & Remark Card */}
                <div className="bg-[#F9FBFF] dark:bg-[#111111] rounded-2xl border border-brand-blue/5 dark:border-white/5 p-0 shadow-sm divide-y divide-[#EBEBEB] dark:divide-white/5 mx-1">
                  {type !== 'TRANSFER' && (
                    <div className="flex items-center gap-4 px-4 py-5 group">
                      <User className="w-5 h-5 text-neutral-400 dark:text-[#555555]" />
                      <input type="text" value={partyName} onChange={e => setPartyName(e.target.value)} placeholder={type === 'DEBIT' ? 'Payee…' : 'Source…'} className="bg-transparent flex-1 text-base font-bold text-brand-green dark:text-white outline-none placeholder:text-neutral-300 dark:placeholder:text-[#333333]" />
                    </div>
                  )}
                  <div className="flex items-center gap-4 px-4 py-5 group">
                    <AlignLeft className="w-5 h-5 text-neutral-400 dark:text-[#555555]" />
                    <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Add specific details…" className="bg-transparent flex-1 text-base font-bold text-brand-green dark:text-white outline-none placeholder:text-neutral-300 dark:placeholder:text-[#333333]" />
                  </div>
                </div>

                {/* 5. Category Grid — Integrated */}
                <div className="bg-[#F9FBFF] dark:bg-[#111111] rounded-2xl border border-brand-blue/5 dark:border-white/5 p-2 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Choose Category</span>
                    <span className="text-[10px] font-bold text-brand-green dark:text-brand-green px-2 py-0.5 bg-brand-green/5 dark:bg-brand-green/5 rounded-full lowercase tracking-wider">{category}</span>
                  </div>
                  <div className="grid grid-cols-10 gap-1">
                    {appCategories.map(cat => (
                      <button key={cat} onClick={() => setCategory(cat)} title={cat} className={`aspect-square rounded-lg flex items-center justify-center text-[18px] transition-all ${category === cat ? 'bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue shadow-lg scale-110' : 'bg-[#F9FBFF] dark:bg-white/[0.02] text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/10 active:scale-95'}`}>{CATEGORY_ICONS[cat] || '📝'}</button>
                    ))}
                  </div>
                </div>

                {/* 5.5 Budget Allocation */}
                {type === 'DEBIT' && activeMonthBudgets.length > 0 && (
                  <div className="bg-[#F9FBFF] dark:bg-[#111111] rounded-2xl border border-brand-blue/5 dark:border-white/5 p-3 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Draw From Budget</span>
                      <select 
                        value={selectedBudgetId} 
                        onChange={(e) => setSelectedBudgetId(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                        className="bg-transparent text-[10px] font-bold text-brand-green dark:text-brand-green outline-none border-b border-brand-green/20 dark:border-brand-green/20 pb-0.5 cursor-pointer"
                      >
                        <option value="auto">Auto-match by Category</option>
                        {activeMonthBudgets.map(b => (
                          <option key={b.id} value={b.id}>{b.category} ({currency}{b.amount})</option>
                        ))}
                      </select>
                    </div>
                    {selectedBudget && (
                      <div className="px-1 space-y-1">
                        <div className="flex justify-between items-end text-[9px] font-bold">
                          <span className="text-neutral-500">{selectedBudget.category} Budget</span>
                          <span className={(selectedBudgetSpent + (Number(amount) || 0)) > selectedBudget.amount ? 'text-brand-red' : 'text-brand-green'}>
                            {currency}{(selectedBudgetSpent + (Number(amount) || 0)).toLocaleString()} / {currency}{selectedBudget.amount.toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full overflow-hidden flex">
                          <div className="h-full bg-brand-green dark:bg-brand-green opacity-40 transition-all duration-300" style={{ width: `${Math.min((selectedBudgetSpent / selectedBudget.amount) * 100, 100)}%` }} />
                          {(Number(amount) || 0) > 0 && (
                            <div className={`h-full transition-all duration-300 ${((selectedBudgetSpent + Number(amount)) > selectedBudget.amount) ? 'bg-brand-red' : 'bg-brand-green'}`} style={{ width: `${Math.min(((Number(amount) || 0) / selectedBudget.amount) * 100, 100 - Math.min((selectedBudgetSpent / selectedBudget.amount) * 100, 100))}%` }} />
                          )}
                        </div>
                        {((selectedBudgetSpent + (Number(amount) || 0)) > selectedBudget.amount) && (
                          <p className="text-[8px] font-bold text-brand-red uppercase tracking-widest pt-0.5">⚠️ Breaches budget by {currency}{((selectedBudgetSpent + (Number(amount) || 0)) - selectedBudget.amount).toLocaleString()}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Payment Method — Intelligence Layer */}
                <div className="bg-[#F9FBFF] dark:bg-[#111111] rounded-2xl border border-brand-blue/5 dark:border-white/5 p-2 space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1">Payment Logistics</span>
                    <span className="text-[10px] font-bold text-brand-green dark:text-brand-green px-2 py-0.5 bg-brand-green/5 dark:bg-brand-green/5 rounded-full lowercase tracking-wider">{paymentMethod}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'UPI', label: 'UPI', icon: <Smartphone className="w-3 h-3" /> },
                      { id: 'Bank Transfer', label: 'Bank', icon: <Landmark className="w-3 h-3" /> },
                      { id: 'Credit Card', label: 'Card', icon: <CreditCard className="w-3 h-3" /> },
                      { id: 'Cash', label: 'Cash', icon: <Coins className="w-3 h-3" /> },
                    ].map((method) => (
                      <button key={method.id} onClick={() => setPaymentMethod(method.id as any)} className={`flex items-center justify-center gap-1 py-1.5 rounded-xl border transition-all ${paymentMethod === method.id ? 'bg-brand-green dark:bg-brand-green border-brand-green dark:border-brand-green text-white dark:text-brand-blue shadow-md' : 'bg-[#F9FBFF] dark:bg-white/[0.02] border-transparent text-neutral-400'}`}>
                        {method.icon}
                        <span className="text-[8px] font-bold uppercase tracking-tighter">{method.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Contextual Sub-Selection */}
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    {paymentMethod === 'UPI' && (
                      <div className="flex gap-2">
                        {['GPay', 'PhonePe', 'Paytm'].map(app => (
                          <button key={app} onClick={() => setUpiApp(app)} className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all border ${upiApp === app ? 'bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue border-transparent' : 'bg-neutral-50 dark:bg-white/[0.02] border-neutral-100 dark:border-white/5 text-neutral-400'}`}>{app}</button>
                        ))}
                      </div>
                    )}
                    {paymentMethod === 'Credit Card' && (
                      <div className="flex flex-wrap gap-1.5">
                        {accounts.filter(a => (a as any).type === 'CREDIT_CARD').map(card => (
                          <button key={card.id} onClick={() => setSelectedAccountId(card.id!)} className={`px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase transition-all border ${selectedAccountId === card.id ? 'bg-brand-green text-white border-transparent' : 'bg-neutral-50 dark:bg-white/5 border-neutral-100 dark:border-white/5 text-neutral-400'}`}>{card.bankName}</button>
                        ))}
                      </div>
                    )}
                    {paymentMethod === 'Cash' && (
                      <div className="flex flex-wrap gap-1.5">
                        {accounts.filter(a => (a as any).type === 'CASH').map(wallet => (
                          <button key={wallet.id} onClick={() => setSelectedAccountId(wallet.id!)} className={`px-2.5 py-1 rounded-lg text-[8px] font-bold uppercase transition-all border ${selectedAccountId === wallet.id ? 'bg-brand-green text-white border-transparent' : 'bg-neutral-50 dark:bg-white/5 border-neutral-100 dark:border-white/5 text-neutral-400'}`}>{wallet.bankName}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Low Balance Warning */}
                {type === 'DEBIT' && amount && parseFloat(amount.toString().replace(/,/g, '')) > (balances.find(a => a.id === selectedAccountId)?.currentBalance || 0) && (
                  <div className="flex items-center gap-1.5 text-brand-red animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Low Balance Warning</span>
                  </div>
                )}
              </div>

              {/* Persistent Action Bar — Fixed Bottom Optimized */}
              <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-t border-[#EBEBEB] dark:border-white/5 z-50 flex justify-end items-center gap-3">
                <button 
                  onClick={handleSaveManual}
                  disabled={!amount || !type || !selectedAccountId || (tags.length > 0 && type !== 'TRANSFER' && !expenseType) || (type === 'TRANSFER' && !toAccountId) || (paymentMethod === 'UPI' && !upiApp) || isSaving || status === 'success'}
                  className={`px-8 py-2.5 rounded-2xl text-[10px] font-black transition-all active:scale-[0.98] shadow-2xl flex items-center justify-center gap-2 uppercase tracking-widest ${
                    (!amount || !type || !selectedAccountId || (tags.length > 0 && type !== 'TRANSFER' && !expenseType) || (type === 'TRANSFER' && !toAccountId) || (paymentMethod === 'UPI' && !upiApp))
                    ? 'bg-neutral-100 dark:bg-[#1C1C22] text-neutral-300 dark:text-[#4A4A52] cursor-not-allowed border border-[#EBEBEB] dark:border-transparent opacity-50'
                    : (status === 'success' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue shadow-brand-green/30 dark:shadow-brand-green/20')
                  } disabled:opacity-70`}
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>SAVING...</span>
                    </>
                  ) : status === 'success' ? (
                    <> <CheckCircle2 className="w-4 h-4" /> SAVED </>
                  ) : (
                    <> <Save className="w-4 h-4 text-current opacity-60" /> SAVE ENTRY </>
                  )}
                </button>
                <button onClick={() => setEntryMode('CHAT')} className="w-11 h-11 bg-brand-green/5 dark:bg-brand-green/5 text-brand-green dark:text-brand-green rounded-2xl flex items-center justify-center border border-brand-green/10 dark:border-brand-green/10 transition-all active:scale-90 shadow-sm">
                   <Wand2 className="w-5 h-5" />
                </button>
              </div>
            </>
          )}
          </div>
        </div>,
        document.body
      )}

      {showTutorial && <TutorialOverlay onComplete={handleTutorialComplete} />}
    </div>
  );
}
