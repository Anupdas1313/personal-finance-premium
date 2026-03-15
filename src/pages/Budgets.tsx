import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { Target, Plus, X, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useCategories } from '../hooks/useCategories';

export default function Budgets() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStr = format(currentMonth, 'yyyy-MM');
  const { categories } = useCategories();
  
  const budgets = useLiveQuery(() => db.budgets.where('month').equals(monthStr).toArray(), [monthStr]) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(categories[0] || 'Other');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const monthExpenses = transactions.filter(tx => 
    tx.type === 'DEBIT' && isWithinInterval(tx.dateTime, { start: monthStart, end: monthEnd })
  );

  const handleSaveBudget = async () => {
    if (!budgetAmount || !selectedCategory) return;
    
    if (editingId) {
      await db.budgets.update(editingId, {
        category: selectedCategory,
        amount: parseFloat(budgetAmount),
      });
    } else {
      // Check if trying to add duplicate category for the same month
      const existing = await db.budgets.where({ category: selectedCategory, month: monthStr }).first();
      if (existing) {
        alert("A budget for this category already exists this month.");
        return;
      }
      
      await db.budgets.add({
        category: selectedCategory,
        amount: parseFloat(budgetAmount),
        month: monthStr
      });
    }

    setIsModalOpen(false);
    setBudgetAmount('');
    setEditingId(null);
  };

  const handleEdit = (budget: any) => {
    setEditingId(budget.id!);
    setSelectedCategory(budget.category);
    setBudgetAmount(budget.amount.toString());
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this budget?")) {
      await db.budgets.delete(id);
    }
  };

  const groupedExpenses = monthExpenses.reduce((acc, tx) => {
    // If expense Type (the new dynamic category system) exists, prioritize it. Otherwise fallback to category.
    const cat = tx.expenseType || tx.category;
    acc[cat] = (acc[cat] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-black text-[#111111] dark:text-[#F7F7F7]">Monthly Budgets</h1>
        <div className="flex items-center gap-4 bg-white dark:bg-[#111111] px-4 py-2 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#EBEBEB] dark:border-[#222222] w-full sm:w-auto justify-between sm:justify-start">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="text-[#111111] dark:text-[#A0A0A0] hover:text-black dark:hover:text-[#F7F7F7] font-black">&lt;</button>
          <span className="font-black text-[#111111] dark:text-[#F7F7F7] min-w-[120px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="text-[#111111] dark:text-[#A0A0A0] hover:text-black dark:hover:text-[#F7F7F7] font-black">&gt;</button>
        </div>

      </div>

      <div className="bg-white dark:bg-[#111111] p-6 rounded-[20px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#EBEBEB] dark:border-[#222222]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-black text-[#111111] dark:text-[#F7F7F7] flex items-center gap-2">
            <Target className="w-5 h-5 text-[#111111] dark:text-[#F7F7F7]" />
            Your Budgets
          </h2>

          <button
            onClick={() => {
              setEditingId(null);
              setBudgetAmount('');
              setSelectedCategory(categories[0] || 'Other');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#222222] dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-xl hover:bg-black dark:hover:bg-neutral-200 transition-colors font-semibold text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Budget
          </button>
        </div>

        {budgets.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-neutral-100 dark:bg-[#1A1A1A] rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-[#B0B0B0] dark:text-[#666666]" />
            </div>
            <p className="text-[#717171] dark:text-[#A0A0A0] font-semibold">No budgets set for {format(currentMonth, 'MMMM')}.</p>
            <p className="text-sm text-[#B0B0B0] dark:text-[#666666] mt-1">Set budgets to track your spending limits.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {budgets.map(budget => {
              const spent = groupedExpenses[budget.category] || 0;
              const percentage = Math.min((spent / budget.amount) * 100, 100);
              const isOverBudget = spent > budget.amount;

              return (
                <div key={budget.id} className="p-5 rounded-2xl border border-[#EBEBEB] dark:border-[#222222] bg-neutral-50 dark:bg-[#1A1A1A]/50 hover:bg-neutral-50 dark:hover:bg-[#1A1A1A] transition-colors">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-[#222222] dark:text-[#F7F7F7]">{budget.category}</h3>
                      {isOverBudget && (
                        <span className="flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-100 px-2 py-1 rounded-full">
                          <AlertCircle className="w-3 h-3" /> Over Budget
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(budget)} className="p-2 text-[#111111] dark:text-[#A0A0A0] hover:text-black dark:hover:text-[#F7F7F7] bg-white dark:bg-[#111111] rounded-lg shadow-md border border-[#EBEBEB] dark:border-[#222222]">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(budget.id!)} className="p-2 text-[#525252] dark:text-[#A0A0A0] hover:text-rose-600 bg-white dark:bg-[#111111] rounded-lg shadow-md border border-[#EBEBEB] dark:border-[#222222]">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                  
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-[#525252] dark:text-[#A0A0A0] text-sm font-bold">
                      <span className={`font-black text-lg ${isOverBudget ? 'text-rose-600' : 'text-[#111111] dark:text-[#F7F7F7]'}`}>
                        ₹{spent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>

                      {' '}spent of ₹{budget.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm font-black text-[#111111] dark:text-[#F7F7F7]">
                      {percentage.toFixed(0)}%
                    </p>

                  </div>

                  <div className="w-full bg-[#EBEBEB] rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-2.5 rounded-full transition-all duration-500 ${isOverBudget ? 'bg-rose-500' : percentage > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111111] rounded-[24px] shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-[#EBEBEB] dark:border-[#222222] flex justify-between items-center">
              <h2 className="text-xl font-black text-[#111111] dark:text-[#F7F7F7]">
                {editingId ? 'Edit Budget' : 'Add New Budget'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#111111] dark:text-[#A0A0A0] hover:text-black dark:hover:text-[#F7F7F7] p-2 hover:bg-neutral-100 dark:hover:bg-[#222222] dark:bg-[#1A1A1A] rounded-full transition-colors border border-neutral-200 dark:border-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-black text-[#111111] dark:text-[#F7F7F7] mb-1.5 uppercase tracking-wider">Category *</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-[#111111] dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] focus:border-[#222222] dark:focus:border-[#F7F7F7] outline-none transition-shadow font-bold bg-white dark:bg-[#111111] text-[#111111] dark:text-white"
                  required
                >

                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-black text-[#111111] dark:text-[#F7F7F7] mb-1.5 uppercase tracking-wider">Monthly Limit (₹) *</label>
                <input
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  step="100"
                  className="w-full px-4 py-3 border border-[#111111] dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] focus:border-[#222222] dark:focus:border-[#F7F7F7] outline-none transition-shadow font-black bg-white dark:bg-[#111111] text-[#111111] dark:text-white"
                  required
                />
              </div>


              <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-[#EBEBEB] dark:border-[#222222]">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 text-[#222222] dark:text-[#F7F7F7] hover:bg-neutral-100 dark:hover:bg-[#222222] dark:bg-[#1A1A1A] font-bold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveBudget}
                  disabled={!budgetAmount || !selectedCategory}
                  className="px-6 py-3 bg-[#111111] dark:bg-[#F7F7F7] text-white dark:text-[#111111] font-black rounded-xl hover:bg-black dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 shadow-md"
                >
                  {editingId ? 'Save Changes' : 'Create Budget'}
                </button>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
