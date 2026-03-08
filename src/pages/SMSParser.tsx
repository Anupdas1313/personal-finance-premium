import { useState } from 'react';
import { parseBankSMS } from '../lib/parser';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { MessageSquareText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Entertainment', 'Salary', 'Transfer', 'Other'];

export default function SMSParser() {
  const [smsText, setSmsText] = useState('');
  const [parsedData, setParsedData] = useState<ReturnType<typeof parseBankSMS> | null>(null);
  const [category, setCategory] = useState('Other');
  const [note, setNote] = useState('');
  const [partyName, setPartyName] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | ''>('');
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [paymentMethod, setPaymentMethod] = useState<'Bank' | 'UPI'>('Bank');
  const [upiApp, setUpiApp] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [type, setType] = useState<'CREDIT' | 'DEBIT' | ''>('');
  const [expenseType, setExpenseType] = useState<'Personal' | 'Home' | 'Miscellaneous' | 'Other'>('Other');
  const [isPersonalExpense, setIsPersonalExpense] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const navigate = useNavigate();

  const handleParse = () => {
    if (!smsText.trim()) return;
    const data = parseBankSMS(smsText);
    setParsedData(data);
    
    // Auto-select account if possible
    if (data.accountLast4) {
      const match = accounts.find(a => a.accountLast4 === data.accountLast4);
      if (match && match.id) {
        setSelectedAccountId(match.id);
      }
    }
    
    // Auto-select category based on type
    if (data.type === 'CREDIT') {
      setCategory('Salary');
    } else {
      setCategory('Other');
    }
    
    // Auto-detect UPI
    const lowerSms = smsText.toLowerCase();
    if (lowerSms.includes('upi') || lowerSms.includes('vpa')) {
      setPaymentMethod('UPI');
      if (lowerSms.includes('gpay') || lowerSms.includes('google pay')) setUpiApp('GPay');
      else if (lowerSms.includes('phonepe')) setUpiApp('PhonePe');
      else if (lowerSms.includes('paytm')) setUpiApp('Paytm');
      else setUpiApp('Other');
    } else {
      setPaymentMethod('Bank');
      setUpiApp('');
    }

    setAmount(data.amount ? data.amount.toString() : '');
    setType(data.type || '');
    setPartyName('');
    setTransactionDate(data.date ? new Date(data.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16));
    setStatus('idle');
  };

  const handleSave = async () => {
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
        balanceAfterTransaction: parsedData?.balance || undefined,
        paymentMethod,
        upiApp: paymentMethod === 'UPI' ? upiApp : undefined,
        party: partyName,
        isPersonalExpense,
        expenseType,
      });
      
      setStatus('success');
      setSmsText('');
      setParsedData(null);
      setNote('');
      setPartyName('');
      setExpenseType('Other');
      setIsPersonalExpense(false);
      
      setTimeout(() => {
        navigate('/transactions');
      }, 1500);
    } catch (error) {
      setStatus('error');
      setErrorMessage('Failed to save transaction.');
      console.error(error);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <MessageSquareText className="w-8 h-8 text-indigo-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Parse Bank SMS</h1>
        <p className="text-gray-500 mt-2">Paste your bank SMS here to automatically extract transaction details.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <label className="block text-sm font-medium text-gray-700 mb-2">SMS Message</label>
        <textarea
          value={smsText}
          onChange={(e) => setSmsText(e.target.value)}
          placeholder="e.g., Rs.500 debited from A/c XX1234 on 05-Mar. Avl Bal Rs.20,000"
          className="w-full h-32 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleParse}
            disabled={!smsText.trim()}
            className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Extract Details
          </button>
        </div>
      </div>

      {parsedData && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 border-t-4 border-t-indigo-500 animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Extracted Details</h2>
          
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="isPersonalExpenseSms"
              checked={isPersonalExpense}
              onChange={(e) => {
                setIsPersonalExpense(e.target.checked);
                if (e.target.checked) setExpenseType('Personal');
              }}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="isPersonalExpenseSms" className="text-sm font-medium text-gray-700">
              Personal Expense
            </label>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <button
              type="button"
              onClick={() => {
                setExpenseType(expenseType === 'Personal' ? 'Other' : 'Personal');
                setIsPersonalExpense(expenseType !== 'Personal');
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                expenseType === 'Personal' 
                  ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-500' 
                  : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
              }`}
            >
              Personal
            </button>
            <button
              type="button"
              onClick={() => {
                setExpenseType(expenseType === 'Home' ? 'Other' : 'Home');
                if (expenseType !== 'Home') setIsPersonalExpense(false);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                expenseType === 'Home' 
                  ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500' 
                  : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
              }`}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => {
                setExpenseType(expenseType === 'Miscellaneous' ? 'Other' : 'Miscellaneous');
                if (expenseType !== 'Miscellaneous') setIsPersonalExpense(false);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                expenseType === 'Miscellaneous' 
                  ? 'bg-amber-100 text-amber-700 border-2 border-amber-500' 
                  : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
              }`}
            >
              Miscellaneous
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Account Last 4</label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 font-mono">
                {parsedData.accountLast4 ? `**** ${parsedData.accountLast4}` : 'Not found'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Available Balance</label>
              <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                {parsedData.balance ? `₹${parsedData.balance.toLocaleString('en-IN')}` : 'Not found'}
              </div>
            </div>
          </div>

          <hr className="border-gray-100 my-6" />
          
          <h3 className="text-md font-medium text-gray-900 mb-4">Complete Transaction</h3>
          
          <div className="space-y-4">
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
                Transaction saved successfully! Redirecting...
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setParsedData(null)}
                className="px-6 py-2 text-gray-700 hover:bg-gray-100 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!amount || !type || !partyName || !selectedAccountId || (paymentMethod === 'UPI' && !upiApp) || status === 'success'}
                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
