import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { format, startOfMonth } from 'date-fns';
import { Lock, Unlock, TrendingUp, TrendingDown, Wallet, AlertCircle } from 'lucide-react';

import { IndusIndLogo } from '../components/IndusIndLogo';
import { UnionBankLogo } from '../components/UnionBankLogo';

export default function Accounting() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.orderBy('dateTime').toArray()) || [];
  const monthlyClosings = useLiveQuery(() => db.monthlyClosings.orderBy('month').reverse().toArray()) || [];

  // Determine all months from earliest transaction to current month
  const earliestTx = transactions[0];
  const startMonth = earliestTx ? startOfMonth(earliestTx.dateTime) : startOfMonth(new Date());
  const endMonth = startOfMonth(new Date());
  
  const allMonths: string[] = [];
  let current = startMonth;
  while (current <= endMonth) {
    allMonths.push(format(current, 'yyyy-MM'));
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  
  // Calculate balances chronologically
  const monthlyData: Record<string, {
    month: string;
    openingBalance: number;
    totalIncome: number;
    totalExpense: number;
    closingBalance: number;
    dynamicClosingBalance: number;
    isClosed: boolean;
    closedAt?: Date;
    accountBalances: Record<number, number>;
  }> = {};

  let currentAccountBalances: Record<number, number> = {};
  accounts.forEach(acc => {
    currentAccountBalances[acc.id!] = acc.startingBalance;
  });

  let currentTotalBalance = accounts.reduce((sum, acc) => sum + acc.startingBalance, 0);

  const chronologicalMonths = [...allMonths];

  chronologicalMonths.forEach(monthStr => {
    const closedRecord = monthlyClosings.find(c => c.month === monthStr);
    const monthTxs = transactions.filter(tx => format(tx.dateTime, 'yyyy-MM') === monthStr);
    
    const income = monthTxs.filter(t => t.type === 'CREDIT').reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'DEBIT').reduce((sum, t) => sum + t.amount, 0);
    
    const openingBalance = currentTotalBalance;
    
    // Update account balances dynamically
    monthTxs.forEach(tx => {
      if (currentAccountBalances[tx.accountId] === undefined) {
        currentAccountBalances[tx.accountId] = 0;
      }
      if (tx.type === 'CREDIT') currentAccountBalances[tx.accountId] += tx.amount;
      if (tx.type === 'DEBIT') currentAccountBalances[tx.accountId] -= tx.amount;
    });
    
    const dynamicClosingBalance = openingBalance + income - expense;
    
    monthlyData[monthStr] = {
      month: monthStr,
      openingBalance,
      totalIncome: income,
      totalExpense: expense,
      closingBalance: closedRecord ? closedRecord.closingBalance : dynamicClosingBalance,
      dynamicClosingBalance,
      isClosed: !!closedRecord,
      closedAt: closedRecord?.closedAt,
      accountBalances: closedRecord ? closedRecord.accountBalances : { ...currentAccountBalances }
    };
    
    // For the next month, the opening balance is this month's closing balance
    currentTotalBalance = monthlyData[monthStr].closingBalance;
    if (closedRecord) {
      currentAccountBalances = { ...closedRecord.accountBalances };
    }
  });

  // Display newest first
  const displayMonths = [...allMonths].reverse();

  const handleCloseMonth = async (monthStr: string) => {
    if (!window.confirm(`Are you sure you want to close the accounting period for ${format(new Date(monthStr + '-01'), 'MMMM yyyy')}? This will lock the closing balances.`)) {
      return;
    }
    
    const data = monthlyData[monthStr];
    try {
      await db.monthlyClosings.add({
        month: monthStr,
        closedAt: new Date(),
        accountBalances: data.accountBalances,
        totalIncome: data.totalIncome,
        totalExpense: data.totalExpense,
        closingBalance: data.closingBalance
      });
    } catch (error) {
      console.error('Failed to close month:', error);
      alert('Failed to close month.');
    }
  };

  const handleReopenMonth = async (monthStr: string) => {
    if (!window.confirm(`Are you sure you want to reopen ${format(new Date(monthStr + '-01'), 'MMMM yyyy')}? This will recalculate balances for subsequent months.`)) {
      return;
    }
    
    try {
      const record = monthlyClosings.find(c => c.month === monthStr);
      if (record && record.id) {
        await db.monthlyClosings.delete(record.id);
      }
    } catch (error) {
      console.error('Failed to reopen month:', error);
      alert('Failed to reopen month.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounting & Period Close</h1>
          <p className="text-gray-500 mt-1">Analyze monthly transactions and lock accounting periods.</p>
        </div>
      </div>

      <div className="space-y-6">
        {displayMonths.map(monthStr => {
          const data = monthlyData[monthStr];
          const monthDate = new Date(monthStr + '-01');
          const isDiscrepancy = data.isClosed && Math.abs(data.closingBalance - data.dynamicClosingBalance) > 0.01;

          return (
            <div key={monthStr} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-colors ${data.isClosed ? 'border-gray-200' : 'border-indigo-100'}`}>
              <div className={`p-5 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${data.isClosed ? 'bg-gray-50 border-gray-200' : 'bg-indigo-50/50 border-indigo-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${data.isClosed ? 'bg-gray-200 text-gray-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    {data.isClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{format(monthDate, 'MMMM yyyy')}</h2>
                    <p className="text-sm text-gray-500">
                      {data.isClosed ? `Closed on ${format(data.closedAt!, 'MMM dd, yyyy')}` : 'Open Period'}
                    </p>
                  </div>
                </div>
                <div className="w-full sm:w-auto">
                  {data.isClosed ? (
                    <button
                      onClick={() => handleReopenMonth(monthStr)}
                      className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Reopen Month
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCloseMonth(monthStr)}
                      className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Close Month
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6">
                {isDiscrepancy && (
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-amber-800">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Balance Discrepancy Detected</p>
                      <p className="text-sm mt-1">
                        Transactions have been added or modified after this month was closed. 
                        The dynamic closing balance (₹{data.dynamicClosingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) 
                        differs from the locked closing balance (₹{data.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}). 
                        Reopen and close the month to sync.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Opening Balance</p>
                    <p className="text-xl font-semibold text-gray-900">
                      ₹{data.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      Total Income
                    </p>
                    <p className="text-xl font-semibold text-emerald-600">
                      +₹{data.totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                      <TrendingDown className="w-4 h-4 text-rose-500" />
                      Total Expense
                    </p>
                    <p className="text-xl font-semibold text-rose-600">
                      -₹{data.totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  
                  <div className="pt-4 md:pt-0 md:border-l md:border-gray-100 md:pl-6">
                    <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-1">
                      <Wallet className="w-4 h-4 text-indigo-500" />
                      Closing Balance
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      ₹{data.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {data.isClosed && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Account Balances at Close</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(data.accountBalances).map(([accountId, balance]) => {
                        const account = accounts.find(a => a.id === Number(accountId));
                        if (!account) return null;
                        return (
                          <div key={accountId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center text-xs font-medium text-gray-600 border border-gray-200 overflow-hidden p-0.5">
                                {account.bankName.toLowerCase().includes('canara') ? (
                                  <img src="https://crystalpng.com/wp-content/uploads/2025/11/Canara-Bank-Logo.png" alt="Canara Bank" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                                ) : account.bankName.toLowerCase().includes('indus') || account.bankName.toLowerCase().includes('insus') ? (
                                  <IndusIndLogo className="w-full h-full object-contain" />
                                ) : account.bankName.toLowerCase().includes('union') ? (
                                  <UnionBankLogo className="w-full h-full object-contain" />
                                ) : (
                                  account.bankName.substring(0, 1).toUpperCase()
                                )}
                              </div>
                              <span className="text-sm font-medium text-gray-700">{account.bankName}</span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900">
                              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {displayMonths.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No accounting periods yet</h3>
            <p className="text-gray-500 mt-1">Add some transactions to see your monthly analysis.</p>
          </div>
        )}
      </div>
    </div>
  );
}
