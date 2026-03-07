import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { Plus, Trash2, Pencil } from 'lucide-react';

import { IndusIndLogo } from '../components/IndusIndLogo';
import { UnionBankLogo } from '../components/UnionBankLogo';

export default function Accounts() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const [isAdding, setIsAdding] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [startingBalance, setStartingBalance] = useState('');

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountLast4 || !startingBalance) return;

    if (editingAccountId) {
      await db.accounts.update(editingAccountId, {
        bankName,
        accountLast4,
        startingBalance: parseFloat(startingBalance)
      });
    } else {
      await db.accounts.add({
        bankName,
        accountLast4,
        startingBalance: parseFloat(startingBalance)
      });
    }

    resetForm();
  };

  const resetForm = () => {
    setBankName('');
    setAccountLast4('');
    setStartingBalance('');
    setIsAdding(false);
    setEditingAccountId(null);
  };

  const handleEdit = (account: any) => {
    setBankName(account.bankName);
    setAccountLast4(account.accountLast4);
    setStartingBalance(account.startingBalance.toString());
    setEditingAccountId(account.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      await db.accounts.delete(id);
      // Also delete associated transactions
      const txs = await db.transactions.where('accountId').equals(id).toArray();
      for (const tx of txs) {
        if (tx.id) await db.transactions.delete(tx.id);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Manage Accounts</h1>
        <button
          onClick={() => {
            if (isAdding) {
              resetForm();
            } else {
              setIsAdding(true);
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {isAdding && !editingAccountId ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingAccountId ? 'Edit Account' : 'New Account'}
          </h2>
          <form onSubmit={handleAddAccount} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g., SBI, HDFC"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Last 4 Digits</label>
                <input
                  type="text"
                  value={accountLast4}
                  onChange={(e) => setAccountLast4(e.target.value)}
                  placeholder="e.g., 1234"
                  maxLength={4}
                  pattern="\d{3,4}"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Starting Balance (₹)</label>
                <input
                  type="number"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {editingAccountId ? 'Update Account' : 'Save Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map(account => (
          <div key={account.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg overflow-hidden p-1">
                  {account.bankName.toLowerCase().includes('canara') ? (
                    <img src="https://crystalpng.com/wp-content/uploads/2025/11/Canara-Bank-Logo.png" alt="Canara Bank" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : account.bankName.toLowerCase().includes('indus') || account.bankName.toLowerCase().includes('insus') ? (
                    <IndusIndLogo className="w-full h-full object-contain" />
                  ) : account.bankName.toLowerCase().includes('union') ? (
                    <UnionBankLogo className="w-full h-full object-contain" />
                  ) : (
                    account.bankName.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(account)}
                    className="text-gray-400 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-indigo-50"
                    title="Edit Account"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(account.id!)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
                    title="Delete Account"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900">{account.bankName}</h3>
              <p className="text-gray-500 font-mono mt-1">**** {account.accountLast4}</p>
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">Starting Balance</p>
              <p className="text-lg font-semibold text-gray-900">
                ₹{account.startingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        ))}
        {accounts.length === 0 && !isAdding && (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500">No accounts found. Add one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
