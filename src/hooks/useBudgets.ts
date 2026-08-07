import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Budget, MonthlyBudget, Transaction } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { startOfMonth, endOfMonth, addMonths, subMonths, differenceInDays, format } from 'date-fns';
import { roundCurrency } from '../logic/utils';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Given a reference date and a cycle start day (1-28), compute the budget
 * period that contains that date.
 *
 * Example: startDay = 15, referenceDate = July 20
 *   → period = July 15 – August 14
 *
 * Example: startDay = 15, referenceDate = July 5
 *   → period = June 15 – July 14
 */
function getBudgetPeriod(referenceDate: Date, startDay: number) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth(); // 0-indexed

  const periodStart = new Date(year, month, startDay, 0, 0, 0, 0);
  const periodEnd = new Date(year, month + 1, startDay - 1, 23, 59, 59, 999);

  return { periodStart, periodEnd };
}

/**
 * Navigate to the next budget period from the current month reference.
 */
export function getNextBudgetMonth(currentMonth: Date, startDay: number): Date {
  if (startDay === 1) return addMonths(currentMonth, 1);
  // Jump forward so we land in the next cycle
  const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, startDay);
  return next;
}

/**
 * Navigate to the previous budget period from the current month reference.
 */
export function getPrevBudgetMonth(currentMonth: Date, startDay: number): Date {
  if (startDay === 1) return subMonths(currentMonth, 1);
  const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, startDay);
  return prev;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BudgetCardData {
  budget: Budget;
  spent: number;
  available: number;
  pct: number;
  isOver: boolean;
  isWarning: boolean;
  barColor: string;
  daysRemaining: number;
  perDay: number;
}

export interface UseBudgetsReturn {
  // Data
  masterPool: MonthlyBudget | null;
  masterBudgetAmt: number;
  envelopeBudgets: Budget[];
  customBudgets: Budget[];
  linkedAccountIds: number[];
  linkedTags: string[];

  // Computed metrics
  totalAllocated: number;
  unallocated: number;
  totalSpent: number;

  // Transaction data
  monthTxs: Transaction[];
  expenses: Transaction[];

  // Helpers
  getSpentForBudget: (budget: Budget, isCustom: boolean) => number;
  getCardData: (budget: Budget, isCustom: boolean) => BudgetCardData;

  // Budget cycle info
  budgetStartDay: number;
  periodStart: Date;
  periodEnd: Date;
  daysRemainingInPeriod: number;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useBudgets(monthStr: string, currentMonth: Date): UseBudgetsReturn {
  const { user } = useAuth();

  // 1. Read the budget_start_day setting
  const budgetStartDaySetting = useLiveQuery(
    () => db.userSettings.where('key').equals('budget_start_day').first(),
    [user?.uid]
  );
  const budgetStartDay: number = budgetStartDaySetting?.value ?? 1;

  // 2. Compute the budget period based on start day
  const { periodStart, periodEnd } = useMemo(
    () => getBudgetPeriod(currentMonth, budgetStartDay),
    [currentMonth, budgetStartDay]
  );

  const periodStartTs = periodStart.getTime();
  const periodEndTs = periodEnd.getTime();

  // 3. Database queries
  const monthlyBudgets = useLiveQuery(
    () => db.monthlyBudgets.where('month').equals(monthStr).toArray(),
    [monthStr, user?.uid]
  ) || [];

  const masterPool = monthlyBudgets.length > 0 ? monthlyBudgets[0] : null;
  const masterBudgetAmt = masterPool?.totalAmount || 0;
  const linkedAccountIds = masterPool?.linkedAccountIds || [];
  const linkedTags = masterPool?.linkedTags || [];

  const budgets = useLiveQuery(
    () => db.budgets.where('month').equals(monthStr).toArray(),
    [monthStr, user?.uid]
  ) || [];

  const allPastBudgets = useLiveQuery(
    () => db.budgets.where('month').below(monthStr).toArray(),
    [monthStr, user?.uid]
  ) || [];

  const allPastTxs = useLiveQuery(
    () => db.transactions.where('dateTime').below(periodStart).toArray(),
    [periodStartTs, user?.uid]
  ) || [];

  const enhancedBudgets = useMemo(() => {
    return budgets.map(b => {
      if (!b.rollover) return b;
      
      const isCustom = b.type === 'CUSTOM';
      const pastBudgetsForCat = allPastBudgets.filter(pb => pb.category === b.category && pb.type === (isCustom ? 'CUSTOM' : 'ENVELOPE'));
      const totalPastBudget = pastBudgetsForCat.reduce((sum, pb) => sum + Number(pb.amount), 0);
      
      const pastTxsForCat = allPastTxs.filter(tx => tx.type === 'DEBIT' && tx.category !== 'Transfer');
      let totalPastSpent = 0;
      
      if (isCustom) {
        const target = b.category.toLowerCase();
        totalPastSpent = pastTxsForCat.filter(tx => 
          (tx.linkedBudgetId && tx.linkedBudgetId === b.id) ||
          tx.category.toLowerCase() === target || 
          (tx.expenseType && tx.expenseType.toLowerCase() === target)
        ).reduce((s, tx) => s + Number(tx.amount), 0);
      } else {
        totalPastSpent = pastTxsForCat.filter(tx => {
          if (tx.linkedBudgetId) {
            return pastBudgetsForCat.some(pb => pb.id === tx.linkedBudgetId);
          }
          return tx.category === b.category;
        }).reduce((s, tx) => s + Number(tx.amount), 0);
      }
      
      const rolloverAmt = totalPastBudget - totalPastSpent;
      return { ...b, amount: Number(b.amount) + rolloverAmt };
    });
  }, [budgets, allPastBudgets, allPastTxs]);

  const envelopeBudgets = useMemo(() => enhancedBudgets.filter(b => b.type !== 'CUSTOM'), [enhancedBudgets]);
  const customBudgets = useMemo(() => enhancedBudgets.filter(b => b.type === 'CUSTOM'), [enhancedBudgets]);

  // 4. Transactions for the budget period
  const monthTxs = useLiveQuery(
    () => {
      return db.transactions
        .where('dateTime')
        .between(periodStart, periodEnd, true, true)
        .toArray();
    },
    [periodStartTs, periodEndTs, user?.uid]
  ) || [];


  const expenses = useMemo(() => {
    let debits = monthTxs.filter(tx => tx.type === 'DEBIT' && tx.category !== 'Transfer');
    if (linkedAccountIds.length > 0) {
      debits = debits.filter(tx => linkedAccountIds.includes(tx.accountId));
    }
    if (linkedTags.length > 0) {
      debits = debits.filter(tx => linkedTags.includes(tx.expenseType || ''));
    }
    return debits;
  }, [monthTxs, linkedAccountIds, linkedTags]);

  // 5. Metrics
  const totalAllocated = useMemo(
    () => roundCurrency(envelopeBudgets.reduce((sum, b) => sum + Number(b.amount || 0), 0)),
    [envelopeBudgets]
  );
  const unallocated = masterBudgetAmt - totalAllocated;

  // 6. Helpers
  const getSpentForBudget = (budget: Budget, isCustom: boolean): number => {
    if (isCustom) {
      const target = budget.category.toLowerCase();
      return roundCurrency(monthTxs
        .filter(tx => tx.type === 'DEBIT' && tx.category !== 'Transfer')
        .filter(tx =>
          (tx.linkedBudgetId && tx.linkedBudgetId === budget.id) ||
          tx.category.toLowerCase() === target ||
          (tx.expenseType && tx.expenseType.toLowerCase() === target)
        )
        .reduce((s, tx) => s + Number(tx.amount), 0));
    }
    return roundCurrency(expenses
      .filter(tx => {
        if (tx.linkedBudgetId) {
          return tx.linkedBudgetId === budget.id;
        }
        return tx.category === budget.category;
      })
      .reduce((s, tx) => s + Number(tx.amount), 0));
  };

  const totalSpent = useMemo(
    () => roundCurrency(envelopeBudgets.reduce((sum, b) => sum + getSpentForBudget(b, false), 0)),
    [envelopeBudgets, expenses]
  );

  const today = new Date();
  const daysRemainingInPeriod = Math.max(differenceInDays(periodEnd, today) + 1, 0);

  const getCardData = (budget: Budget, isCustom: boolean): BudgetCardData => {
    const allocated = Number(budget.amount);
    const spent = getSpentForBudget(budget, isCustom);
    const available = allocated - spent;
    const pct = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 100;
    const isOver = spent > allocated;
    const isWarning = !isOver && pct >= 80;
    const barColor = isOver ? '#E53935' : isWarning ? '#F59E0B' : '#00A86B';
    const daysRemaining = daysRemainingInPeriod;
    const perDay = daysRemaining > 0 && available > 0 ? available / daysRemaining : 0;

    return { budget, spent, available, pct, isOver, isWarning, barColor, daysRemaining, perDay };
  };

  return {
    masterPool,
    masterBudgetAmt,
    envelopeBudgets,
    customBudgets,
    linkedAccountIds,
    linkedTags,
    totalAllocated,
    unallocated,
    totalSpent,
    monthTxs,
    expenses,
    getSpentForBudget,
    getCardData,
    budgetStartDay,
    periodStart,
    periodEnd,
    daysRemainingInPeriod,
  };
}
