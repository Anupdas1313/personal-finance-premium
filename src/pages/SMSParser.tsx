import { useState } from 'react';
import { parseBankSMS } from '../lib/parser';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { MessageSquareText, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '../hooks/useCategories';

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
  const [expenseType, setExpenseType] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const navigate = useNavigate();
  
  const { categories: appCategories } = useCategories();

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
    if (!amount || !type || !selectedAccountId || !expenseType) {
      setStatus('error');
      setErrorMessage('Missing required fields (Amount, Type, Account, or Expense Type).');
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
        expenseType,
      });
      
      setStatus('success');
      setSmsText('');
      setParsedData(null);
      setNote('');
      setPartyName('');
      setExpenseType('');
      
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
        <div className="w-20 h-20 bg-neutral-100 dark:bg-[#1A1A1A] rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-blue/5 dark:border-[#222222]">
          <MessageSquareText className="w-10 h-10 text-brand-blue dark:text-[#F7F7F7]" />
        </div>
        <h1 className="text-4xl font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">SMS Pipeline</h1>
        <p className="text-brand-blue/40 dark:text-[#A0A0A0] mt-2 font-black uppercase tracking-widest text-xs">Automated transaction extraction</p>
      </div>


      <div className="bg-white dark:bg-[#111111] p-6 rounded-[24px] shadow-sm border border-brand-blue/5 dark:border-[#222222]">
        <label className="block text-[10px] font-black text-brand-blue/40 dark:text-[#F7F7F7] mb-2 uppercase tracking-widest">Input Buffer</label>

        <textarea
          value={smsText}
          onChange={(e) => setSmsText(e.target.value)}
          placeholder="e.g., Rs.500 debited from A/c XX1234..."
          className="w-full h-32 px-4 py-3 border border-brand-blue/10 dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-brand-cyan outline-none resize-none font-bold text-brand-blue dark:text-[#F7F7F7] bg-neutral-50 dark:bg-[#1A1A1A]"
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleParse}
            disabled={!smsText.trim()}
            className="px-6 py-2.5 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] font-black rounded-xl hover:bg-brand-green/90 transition-all disabled:opacity-50 uppercase text-[10px] tracking-widest shadow-lg shadow-brand-green/10"
          >
            Extract Details
          </button>
        </div>
      </div>


      {parsedData && (
        <div className="bg-white dark:bg-[#111111] p-6 rounded-[24px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#EBEBEB] dark:border-[#222222] animate-in fade-in slide-in-from-bottom-4">
          <h2 className="text-lg font-black text-[#111111] dark:text-[#F7F7F7] mb-6">Extracted Details</h2>

          
        <div className="flex flex-wrap gap-2 mb-6">
            {appCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setExpenseType(expenseType === cat ? '' : cat)}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  expenseType === cat 
                    ? 'bg-brand-blue text-white shadow-lg' 
                    : 'bg-brand-blue/5 text-brand-blue/40 hover:text-brand-blue border border-brand-blue/10 dark:border-[#222222]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-[10px] font-black text-brand-blue/40 dark:text-[#F7F7F7] mb-1 uppercase tracking-widest">Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full px-4 py-3 border border-brand-blue/10 dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-brand-cyan outline-none font-black text-brand-blue dark:text-[#F7F7F7] bg-white dark:bg-[#111111]"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-brand-blue/40 dark:text-[#F7F7F7] mb-1 uppercase tracking-widest">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'CREDIT' | 'DEBIT' | '')}
                className="w-full px-4 py-3 border border-brand-blue/10 dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-brand-cyan outline-none font-black text-brand-blue dark:text-[#F7F7F7] bg-white dark:bg-[#111111]"
                required
              >
                <option value="" disabled>Select type</option>
                <option value="DEBIT">Outflow (Debit)</option>
                <option value="CREDIT">Inflow (Credit)</option>
              </select>
            </div>

          </div>

          {type && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1">
                  {type === 'DEBIT' ? 'Paid To *' : 'Received From *'}
                </label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder={type === 'DEBIT' ? "e.g., Grocery Store" : "e.g., Employer"}
                  className="w-full px-4 py-2 border border-[#EBEBEB] dark:border-[#222222] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] focus:border-[#222222] dark:focus:border-[#F7F7F7]"
                  required
                />
              </div>
              {partyName && (
                <div className="animate-in fade-in slide-in-from-left-2">
                  <label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1">Reason</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g., Monthly groceries"
                    className="w-full px-4 py-2 border border-[#EBEBEB] dark:border-[#222222] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] focus:border-[#222222] dark:focus:border-[#F7F7F7]"
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1">Account Last 4</label>
              <div className="px-4 py-2 bg-neutral-50 dark:bg-[#1A1A1A] border border-[#EBEBEB] dark:border-[#222222] rounded-xl text-[#222222] dark:text-[#F7F7F7] font-mono">
                {parsedData.accountLast4 ? `**** ${parsedData.accountLast4}` : 'Not found'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1">Available Balance</label>
              <div className="px-4 py-2 bg-neutral-50 dark:bg-[#1A1A1A] border border-[#EBEBEB] dark:border-[#222222] rounded-xl text-[#222222] dark:text-[#F7F7F7]">
                {parsedData.balance ? `₹${parsedData.balance.toLocaleString('en-IN')}` : 'Not found'}
              </div>
            </div>
          </div>

          <hr className="border-[#EBEBEB] dark:border-[#222222] my-6" />
          
          <h3 className="text-md font-bold text-[#222222] dark:text-[#F7F7F7] mb-4">Complete Transaction</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-brand-blue/40 dark:text-[#F7F7F7] mb-1 uppercase tracking-widest">Select Account</label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(Number(e.target.value) || '')}
                  className="w-full px-4 py-3 border border-brand-blue/10 dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-brand-cyan outline-none font-black text-brand-blue dark:text-[#F7F7F7] bg-white dark:bg-[#111111]"
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
                <label className="block text-[10px] font-black text-brand-blue/40 dark:text-[#F7F7F7] mb-1 uppercase tracking-widest">Timestamp</label>
                <input
                  type="datetime-local"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-4 py-3 border border-brand-blue/10 dark:border-[#444444] rounded-xl focus:ring-2 focus:ring-brand-cyan outline-none font-black text-brand-blue dark:text-[#F7F7F7] bg-white dark:bg-[#111111]"
                  required
                />
              </div>

            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2 border border-[#EBEBEB] dark:border-[#222222] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] focus:border-[#222222] dark:focus:border-[#F7F7F7]"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as 'Bank' | 'UPI')}
                  className="w-full px-4 py-2 border border-[#EBEBEB] dark:border-[#222222] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] focus:border-[#222222] dark:focus:border-[#F7F7F7]"
                >
                  <option value="Bank">Bank</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
            </div>

            {paymentMethod === 'UPI' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#222222] dark:text-[#F7F7F7] mb-1">UPI App *</label>
                  <select
                    value={upiApp}
                    onChange={(e) => setUpiApp(e.target.value)}
                    className="w-full px-4 py-2 border border-[#EBEBEB] dark:border-[#222222] rounded-xl focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] focus:border-[#222222] dark:focus:border-[#F7F7F7]"
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
              <div className="p-3 bg-brand-red/10 border border-brand-red/20 text-brand-red rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                <AlertCircle className="w-4 h-4" />
                {errorMessage}
              </div>
            )}


            {status === 'success' && (
              <div className="p-3 bg-brand-green/10 border border-brand-green/20 text-brand-green rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                <CheckCircle2 className="w-4 h-4" />
                Deployed successfully!
              </div>
            )}


            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setParsedData(null)}
                className="px-6 py-2.5 text-brand-blue/40 dark:text-[#F7F7F7] hover:bg-brand-blue/5 font-black rounded-xl transition-colors uppercase text-[10px] tracking-widest"
              >
                Abort
              </button>
              <button
                onClick={handleSave}
                disabled={!amount || !type || !partyName || !selectedAccountId || (paymentMethod === 'UPI' && !upiApp) || status === 'success'}
                className="px-6 py-2.5 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] font-black rounded-xl hover:bg-brand-green/90 transition-all disabled:opacity-50 uppercase text-[10px] tracking-widest shadow-lg shadow-brand-green/10"
              >
                Commit Transaction
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
