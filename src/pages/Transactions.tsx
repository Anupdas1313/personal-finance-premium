import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { format } from 'date-fns';
import { ArrowDownRight, ArrowUpRight, Trash2, Search } from 'lucide-react';
import { useState } from 'react';

export default function Transactions() {
  const transactions = useLiveQuery(() => db.transactions.orderBy('dateTime').reverse().toArray()) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const [searchQuery, setSearchQuery] = useState('');

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      await db.transactions.delete(id);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const query = searchQuery.toLowerCase();
    return (
      tx.note.toLowerCase().includes(query) ||
      tx.category.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">All Transactions</h1>
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search notes or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500 uppercase tracking-wider">
                <th className="p-4">Date</th>
                <th className="p-4">Details</th>
                <th className="p-4">Category</th>
                <th className="p-4">Account</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    {searchQuery ? 'No transactions match your search.' : 'No transactions found.'}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(tx => {
                  const account = accounts.find(a => a.id === tx.accountId);
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-sm text-gray-500 whitespace-nowrap">
                        {format(tx.dateTime, 'MMM dd, yyyy')}
                        <br />
                        <span className="text-xs">{format(tx.dateTime, 'hh:mm a')}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            tx.type === 'CREDIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                          }`}>
                            {tx.type === 'CREDIT' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{tx.party || tx.note || 'No note'}</p>
                            {(tx.paymentMethod || (tx.party && tx.note)) && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                {tx.party && tx.note ? `${tx.note} • ` : ''}
                                {tx.paymentMethod === 'UPI' ? `UPI (${tx.upiApp})` : tx.paymentMethod === 'Bank' ? 'Bank Transfer' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {tx.category}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {account ? `${account.bankName} ****${account.accountLast4}` : 'Unknown'}
                      </td>
                      <td className={`p-4 text-right font-semibold whitespace-nowrap ${
                        tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-gray-900'
                      }`}>
                        {tx.type === 'CREDIT' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDelete(tx.id!)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50 inline-flex"
                          title="Delete Transaction"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-gray-100">
          {filteredTransactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 'No transactions match your search.' : 'No transactions found.'}
            </div>
          ) : (
            filteredTransactions.map(tx => {
              const account = accounts.find(a => a.id === tx.accountId);
              return (
                <div key={tx.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        tx.type === 'CREDIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {tx.type === 'CREDIT' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{tx.party || tx.note || 'No note'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {format(tx.dateTime, 'MMM dd, yyyy • hh:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold whitespace-nowrap ${
                        tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-gray-900'
                      }`}>
                        {tx.type === 'CREDIT' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pl-13">
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {tx.category}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                        {account ? `${account.bankName} ****${account.accountLast4}` : 'Unknown'}
                      </span>
                      {(tx.paymentMethod || (tx.party && tx.note)) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200">
                          {tx.party && tx.note ? `${tx.note} • ` : ''}
                          {tx.paymentMethod === 'UPI' ? `UPI (${tx.upiApp})` : tx.paymentMethod === 'Bank' ? 'Bank' : ''}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(tx.id!)}
                      className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded-full hover:bg-red-50 shrink-0"
                      title="Delete Transaction"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
