import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { ArrowUpRight, ArrowDownRight, Wallet, Plus, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { useState } from 'react';

const CATEGORIES = ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Entertainment', 'Salary', 'Transfer', 'Other'];

import { IndusIndLogo } from '../components/IndusIndLogo';
import { UnionBankLogo } from '../components/UnionBankLogo';

export default function Dashboard() {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.orderBy('dateTime').reverse().limit(5).toArray()) || [];

  const [isAddingManual, setIsAddingManual] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'CREDIT' | 'DEBIT' | ''>('');
  const [category, setCategory] = useState('Other');
  const [note, setNote] = useState('');
  const [partyName, setPartyName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [paymentMethod, setPaymentMethod] = useState<'Bank' | 'UPI'>('Bank');
  const [upiApp, setUpiApp] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSaveManual = async () => {
    if (!amount || !type || !selectedAccountId) {
      setStatus('error');
      setErrorMessage('Missing required fields (Amount, Type, or Account).');
      return;
    }

    try {
      await db.transactions.add({
        accountId: Number(selectedAccountId),
        amount: parseFloat(amount),
        type: type as 'CREDIT' | 'DEBIT',
        dateTime: new Date(transactionDate),
        note: note || '',
        category,
        paymentMethod,
        upiApp: paymentMethod === 'UPI' ? upiApp : undefined,
        party: partyName,
      });
      
      setStatus('success');
      setTimeout(() => {
        setIsAddingManual(false);
        setStatus('idle');
        setAmount('');
        setType('');
        setNote('');
        setPartyName('');
        setCategory('Other');
        setTransactionDate(new Date().toISOString().slice(0, 16));
        setPaymentMethod('Bank');
        setUpiApp('');
      }, 1500);
    } catch (error) {
      setStatus('error');
      setErrorMessage('Failed to save transaction.');
      console.error(error);
    }
  };

  const monthlyClosings = useLiveQuery(() => db.monthlyClosings.orderBy('month').reverse().toArray()) || [];
  const latestClosedMonth = monthlyClosings[0];

  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];
  
  const balances = accounts.map(acc => {
    // If we have a closed month, use its balance as the starting point
    let startingBalance = acc.startingBalance;
    let txsToConsider = allTransactions.filter(t => t.accountId === acc.id);

    if (latestClosedMonth) {
      if (latestClosedMonth.accountBalances[acc.id!] !== undefined) {
        startingBalance = latestClosedMonth.accountBalances[acc.id!];
        
        // Only consider transactions AFTER the closed month
        const closedMonthDate = new Date(latestClosedMonth.month + '-01');
        const nextMonthStart = new Date(closedMonthDate.getFullYear(), closedMonthDate.getMonth() + 1, 1);
        
        txsToConsider = txsToConsider.filter(t => t.dateTime >= nextMonthStart);
      }
    }

    const currentBalance = txsToConsider.reduce((accBal, tx) => {
      if (tx.type === 'CREDIT') return accBal + tx.amount;
      if (tx.type === 'DEBIT') return accBal - tx.amount;
      return accBal;
    }, startingBalance);
    
    return { ...acc, currentBalance };
  });

  const totalBalance = balances.reduce((sum, acc) => sum + acc.currentBalance, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button
          onClick={() => setIsAddingManual(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </button>
      </div>

      {/* Total Balance Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Total Balance</p>
          <p className="text-4xl font-bold text-gray-900 mt-1">
            ₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
          <Wallet className="w-8 h-8 text-indigo-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Accounts List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Your Accounts</h2>
            <Link to="/accounts" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Manage</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {balances.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No accounts added yet.</div>
            ) : (
              balances.map(acc => (
                <div key={acc.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 font-medium overflow-hidden p-1">
                      {acc.bankName.toLowerCase().includes('canara') ? (
                        <img src="https://crystalpng.com/wp-content/uploads/2025/11/Canara-Bank-Logo.png" alt="Canara Bank" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : acc.bankName.toLowerCase().includes('indus') || acc.bankName.toLowerCase().includes('insus') ? (
                        <IndusIndLogo className="w-full h-full object-contain" />
                      ) : acc.bankName.toLowerCase().includes('union') ? (
                        <UnionBankLogo className="w-full h-full object-contain" />
                      ) : (
                        acc.bankName.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{acc.bankName}</p>
                      <p className="text-xs text-gray-500">**** {acc.accountLast4}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900">
                    ₹{acc.currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
            <Link to="/transactions" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View All</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {transactions.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No transactions yet.</div>
            ) : (
              transactions.map(tx => {
                const account = accounts.find(a => a.id === tx.accountId);
                return (
                  <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === 'CREDIT' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {tx.type === 'CREDIT' ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{tx.party || tx.note || tx.category}</p>
                        <p className="text-xs text-gray-500">
                          {tx.note && tx.party ? `${tx.note} • ` : ''}
                          {format(tx.dateTime, 'MMM dd, yyyy • hh:mm a')}
                          {account && ` • ${account.bankName} ****${account.accountLast4}`}
                          {tx.paymentMethod && ` • ${tx.paymentMethod === 'UPI' ? `UPI (${tx.upiApp})` : 'Bank'}`}
                        </p>
                      </div>
                    </div>
                    <p className={`font-semibold ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {tx.type === 'CREDIT' ? '+' : '-'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {isAddingManual && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-900">Manual Transaction Entry</h2>
              <button
                onClick={() => setIsAddingManual(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Type *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'CREDIT' | 'DEBIT' | '')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="" disabled>Select type</option>
                    <option value="DEBIT">Paid To (Debit)</option>
                    <option value="CREDIT">Received From (Credit)</option>
                  </select>
                </div>
              </div>

              {type && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {type === 'DEBIT' ? 'Paid To *' : 'Received From *'}
                    </label>
                    <input
                      type="text"
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                      placeholder={type === 'DEBIT' ? "e.g., Grocery Store" : "e.g., Employer"}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                  {partyName && (
                    <div className="animate-in fade-in slide-in-from-left-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="e.g., Monthly groceries"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Account *</label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(Number(e.target.value) || '')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  >
                    <option value="" disabled>Select an account</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bankName} (**** {acc.accountLast4})
                      </option>
                    ))}
                  </select>
                  {accounts.length === 0 && (
                    <p className="text-sm text-rose-500 mt-1">Please add an account first from the Accounts tab.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as 'Bank' | 'UPI')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="Bank">Bank</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
              </div>

              {paymentMethod === 'UPI' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">UPI App *</label>
                    <select
                      value={upiApp}
                      onChange={(e) => setUpiApp(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="" disabled>Select UPI App</option>
                      <option value="GPay">GPay</option>
                      <option value="PhonePe">PhonePe</option>
                      <option value="Paytm">Paytm</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              )}

              {status === 'error' && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {errorMessage}
                </div>
              )}

              {status === 'success' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Transaction saved successfully!
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => setIsAddingManual(false)}
                  className="px-6 py-2 text-gray-700 hover:bg-gray-100 font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveManual}
                  disabled={!amount || !type || !partyName || !selectedAccountId || (paymentMethod === 'UPI' && !upiApp) || status === 'success'}
                  className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Transaction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
