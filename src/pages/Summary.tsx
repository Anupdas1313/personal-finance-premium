import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useState } from 'react';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export default function Summary() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const monthTransactions = transactions.filter(tx => 
    isWithinInterval(tx.dateTime, { start: monthStart, end: monthEnd })
  );

  const expenses = monthTransactions.filter(tx => tx.type === 'DEBIT');
  const income = monthTransactions.filter(tx => tx.type === 'CREDIT');

  const totalExpense = expenses.reduce((sum, tx) => sum + tx.amount, 0);
  const totalIncome = income.reduce((sum, tx) => sum + tx.amount, 0);

  // Group expenses by category
  const expensesByCategory = expenses.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(expensesByCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Monthly Summary</h1>
        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-100 w-full sm:w-auto justify-between sm:justify-start">
          <button onClick={handlePrevMonth} className="text-gray-500 hover:text-indigo-600 font-bold">&lt;</button>
          <span className="font-medium text-gray-900 min-w-[120px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button onClick={handleNextMonth} className="text-gray-500 hover:text-indigo-600 font-bold">&gt;</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
          <p className="text-sm font-medium text-gray-500 mb-1">Total Income</p>
          <p className="text-3xl font-bold text-emerald-600">
            +₹{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
          <p className="text-sm font-medium text-gray-500 mb-1">Total Expenses</p>
          <p className="text-3xl font-bold text-rose-600">
            -₹{totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Expenses by Category</h2>
        {pieData.length > 0 ? (
          <div className="h-[300px] sm:h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="80%"
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No expenses recorded for this month.
          </div>
        )}
      </div>
    </div>
  );
}
