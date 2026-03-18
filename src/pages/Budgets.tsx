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
        amount: parseFloat(budgetAmount.toString().replace(/,/g, '')) || 0,
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
        amount: parseFloat(budgetAmount.toString().replace(/,/g, '')) || 0,
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
    const cat = tx.expenseType || tx.category;
    acc[cat] = (acc[cat] || 0) + tx.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-4xl font-heading font-semibold text-brand-blue dark:text-[#F7F7F7] tracking-tight">Budgets</h1>
        <div className="flex items-center gap-4 bg-white dark:bg-[#111111] px-4 py-2 rounded-[24px] shadow-sm border border-brand-blue/5 dark:border-[#222222] w-full sm:w-auto justify-between sm:justify-start">
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="text-brand-blue/40 dark:text-[#A0A0A0] hover:text-brand-blue dark:hover:text-[#F7F7F7] font-semibold">&lt;</button>
          <span className="font-semibold text-brand-blue dark:text-[#F7F7F7] min-w-[120px] text-center uppercase tracking-[0.2em] text-[10px]">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="text-brand-blue/40 dark:text-[#A0A0A0] hover:text-brand-blue dark:hover:text-[#F7F7F7] font-semibold">&gt;</button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111111] p-6 rounded-[20px] shadow-sm border border-brand-blue/5 dark:border-[#222222]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-heading font-semibold text-brand-blue dark:text-[#F7F7F7] flex items-center gap-2">
            <Target className="w-5 h-5 text-brand-blue/40" />
            Set Thresholds
          </h2>

          <button
            onClick={() => {
              setEditingId(null);
              setBudgetAmount('');
              setSelectedCategory(categories[0] || 'Other');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-xl hover:bg-brand-green/90 transition-all font-semibold text-[10px] uppercase tracking-[0.2em] shadow-lg shadow-brand-green/10"
          >
            <Plus className="w-4 h-4" />
            Define
          </button>
        </div>

        {budgets.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-neutral-100 dark:bg-[#1A1A1A] rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-[#B0B0B0] dark:text-[#666666]" />
            </div>
            <p className="text-brand-blue/40 dark:text-[#A0A0A0] font-semibold uppercase tracking-[0.2em] text-[10px]">Zero definitions for {format(currentMonth, 'MMMM')}.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {budgets.map(budget => {
              const spent = groupedExpenses[budget.category] || 0;
              const percentage = Math.min((spent / budget.amount) * 100, 100);
              const isOverBudget = spent > budget.amount;

              return (
                <div key={budget.id} className="p-5 rounded-2xl border border-brand-blue/5 bg-neutral-50 dark:bg-[#1A1A1A]/50 hover:bg-brand-blue/5 transition-colors">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-brand-blue dark:text-[#F7F7F7]">{budget.category}</h3>
                      {isOverBudget && (
                        <span className="flex items-center gap-1 text-[9px] font-semibold text-brand-red bg-brand-red/10 px-2 py-0.5 rounded-full uppercase tracking-widest shadow-sm border border-brand-red/10">
                          <AlertCircle className="w-3 h-3" /> Breach
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(budget)} className="p-2 text-brand-blue/40 hover:text-brand-blue transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(budget.id!)} className="p-2 text-brand-blue/10 hover:text-brand-red transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-brand-blue/40 dark:text-[#A0A0A0] text-sm font-medium">
                      <span className={`font-semibold text-lg ${isOverBudget ? 'text-brand-red' : 'text-brand-blue dark:text-[#F7F7F7]'}`}>
                        ₹{spent.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </span>
                      {' '} / ₹{budget.amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </p>
                    <p className="text-sm font-semibold text-brand-blue dark:text-[#F7F7F7]">
                      {percentage.toFixed(0)}%
                    </p>
                  </div>

                  <div className="w-full bg-neutral-100 dark:bg-[#222222] rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-500 ${isOverBudget ? 'bg-brand-red shadow-[0_0_8px_rgba(229,57,53,0.4)]' : percentage > 80 ? 'bg-brand-gold' : 'bg-brand-green'}`}
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
        <div className="fixed inset-0 bg-brand-blue/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#111111] rounded-[24px] shadow-2xl w-full max-w-md border border-brand-blue/5">
            <div className="p-6 border-b border-brand-blue/5 flex justify-between items-center">
              <h2 className="text-xl font-heading font-semibold text-brand-blue dark:text-[#F7F7F7]">
                {editingId ? 'Modify Threshold' : 'Define Threshold'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-brand-blue/40 hover:text-brand-blue p-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-semibold text-brand-blue/40 mb-1.5 uppercase tracking-[0.2em]">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 border border-brand-blue/10 rounded-xl focus:ring-2 focus:ring-brand-cyan outline-none transition-shadow font-medium bg-white dark:bg-[#111111] text-brand-blue"
                  required
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-brand-blue/40 mb-1.5 uppercase tracking-[0.2em]">Threshold Amount (₹)</label>
                <input
                  type="number"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  step="100"
                  className="w-full px-4 py-3 border border-brand-blue/10 rounded-xl focus:ring-2 focus:ring-brand-cyan outline-none transition-shadow font-medium bg-white dark:bg-[#111111] text-brand-blue"
                  required
                />
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-brand-blue/5">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 text-brand-blue/40 hover:text-brand-blue font-semibold rounded-xl transition-colors uppercase text-[10px] tracking-[0.2em]"
                >
                  Reject
                </button>
                <button
                  onClick={handleSaveBudget}
                  disabled={!budgetAmount || !selectedCategory}
                   className="px-6 py-3 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] font-semibold rounded-xl hover:bg-brand-green/90 transition-all shadow-lg shadow-brand-green/20 uppercase text-[10px] tracking-[0.2em]"
                >
                  {editingId ? 'Update' : 'Commit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
