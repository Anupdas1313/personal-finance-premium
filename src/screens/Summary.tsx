import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useState } from 'react';

const COLORS = ['#1A237E', '#00A86B', '#D4AF37', '#82EEFD', '#E53935', '#3B3B98', '#10B981', '#F59E0B'];


export default function Summary() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const transactions = useLiveQuery(() => db.transactions.toArray(), [user?.uid]) || [];

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
        <h1 className="text-4xl font-heading font-semibold text-brand-blue dark:text-[#F7F7F7] tracking-tight">Summary</h1>


        <div className="flex items-center gap-4 bg-white dark:bg-[#111111] px-6 py-2.5 rounded-[24px] shadow-[0_12px_40px_rgba(26,35,126,0.06)] border border-brand-blue/5 dark:border-[#222222] w-full sm:w-auto justify-between sm:justify-start">
          <button onClick={handlePrevMonth} className="text-brand-blue hover:text-brand-green font-semibold transition-colors">&lt;</button>
          <span className="font-semibold text-brand-blue dark:text-[#F7F7F7] min-w-[140px] text-center uppercase tracking-[0.2em] text-[10px]">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button onClick={handleNextMonth} className="text-brand-blue hover:text-brand-green font-semibold transition-colors">&gt;</button>
        </div>


      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#111111] p-6 rounded-[28px] shadow-[0_8px_40px_rgba(26,35,126,0.04)] border border-brand-blue/5 dark:border-[#222222] flex flex-col justify-center items-center">
          <p className="text-[10px] font-semibold text-brand-blue/40 dark:text-[#A0A0A0] mb-2 uppercase tracking-[0.2em]">Total Income</p>
          <p className="text-3xl font-heading font-semibold text-brand-green tracking-tight">
            +₹{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </p>
        </div>


        <div className="bg-white dark:bg-[#111111] p-6 rounded-[28px] shadow-[0_8px_40px_rgba(26,35,126,0.04)] border border-brand-blue/5 dark:border-[#222222] flex flex-col justify-center items-center">
          <p className="text-[10px] font-semibold text-brand-blue/40 dark:text-[#A0A0A0] mb-2 uppercase tracking-[0.2em]">Total Expenses</p>
          <p className="text-3xl font-heading font-semibold text-brand-red tracking-tight">
            -₹{totalExpense.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </p>
        </div>

      </div>

      <div className="bg-white dark:bg-[#111111] p-6 rounded-[32px] shadow-[0_8px_40px_rgba(26,35,126,0.04)] border border-brand-blue/5 dark:border-[#222222]">
        <h2 className="text-xl font-heading font-semibold text-brand-blue dark:text-[#F7F7F7] mb-8 tracking-tight">Expenses by Category</h2>



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
          <div className="text-center py-12 text-[#717171] dark:text-[#A0A0A0] font-medium">
            No expenses recorded for this month.
          </div>
        )}
      </div>
    </div>
  );
}
