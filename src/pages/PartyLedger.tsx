import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, LedgerTransaction } from '../lib/db';
import { ArrowLeft, Plus, TrendingUp, TrendingDown, Clock, Search, Trash2, Calendar, FileText, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function PartyLedger() {
  const { id } = useParams();
  const partyId = Number(id);
  const navigate = useNavigate();

  const party = useLiveQuery(() => db.parties.get(partyId));
  const transactions = useLiveQuery(() => 
    db.ledgerTransactions.where('partyId').equals(partyId).sortBy('dateTime')
  ) || [];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txType, setTxType] = useState<'CASH_IN' | 'CASH_OUT'>('CASH_OUT');
  const [amount, setAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');

  const runningBalances = useMemo(() => {
    let current = 0;
    return transactions.map(tx => {
      if (tx.type === 'CASH_IN') current -= tx.amount;
      else current += tx.amount;
      return current;
    });
  }, [transactions]);

  const netBalance = runningBalances.length > 0 ? runningBalances[runningBalances.length - 1] : 0;

  const handleAddTransaction = async () => {
    if (!amount || isNaN(parseFloat(amount.toString().replace(/,/g, '')))) return;
    
    await db.ledgerTransactions.add({
      partyId,
      amount: parseFloat(amount.toString().replace(/,/g, '')) || 0,
      type: txType,
      dateTime: new Date(date),
      remarks,
    });

    setAmount('');
    setRemarks('');
    setIsModalOpen(false);
  };

  const handleDelete = async (txId: number) => {
    if (confirm('Are you sure you want to delete this recording?')) {
        await db.ledgerTransactions.delete(txId);
    }
  };

  const exportCSV = () => {
    const headers = ['Date', 'Remarks', 'Cash Out (Given)', 'Cash In (Received)', 'Resulting Balance'];
    const rows = transactions.map((tx, i) => [
      format(tx.dateTime, 'dd/MM/yyyy'),
      tx.remarks || '-',
      tx.type === 'CASH_OUT' ? tx.amount : '0',
      tx.type === 'CASH_IN' ? tx.amount : '0',
      runningBalances[i].toString()
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Ledger_${party?.name}_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!party) return <div className="p-8 text-center text-brand-blue/30 uppercase tracking-[0.2em] font-semibold text-xs">Accessing Secure Vault...</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-32">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate('/ledger')} className="p-2.5 rounded-full bg-brand-blue/5 text-brand-blue hover:bg-brand-blue/10 transition-all shadow-sm">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
            <h1 className="text-3xl font-heading font-semibold text-brand-blue dark:text-[#F7F7F7] tracking-tight">{party.name}</h1>
            <p className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mt-1">
                Security clearance: {party.type}
            </p>
        </div>
        <button onClick={exportCSV} className="p-2.5 rounded-full bg-brand-blue/5 text-brand-blue hover:bg-brand-blue/10 transition-all shadow-sm" title="Download Report">
          <Download className="w-5 h-5" />
        </button>
      </div>

      {/* Main Balance Card */}
      <div className="bg-white dark:bg-[#111111] p-8 rounded-[40px] border border-brand-blue/5 dark:border-[#222222] shadow-xl text-center relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={120} className={netBalance >= 0 ? 'text-brand-green' : 'text-brand-red'} />
        </div>
        <p className="text-[12px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-2">Net Financial Standing</p>
        <h2 className={`text-6xl font-heading font-semibold tracking-tight mb-4 transition-colors ${netBalance >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
            ₹{Math.abs(netBalance).toLocaleString('en-IN')}
        </h2>
        <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full font-semibold text-[10px] uppercase tracking-[0.2em] ${netBalance >= 0 ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-red/10 text-brand-red'}`}>
            {netBalance >= 0 ? "You will get money" : "You will give money"}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button 
            onClick={() => { setTxType('CASH_OUT'); setIsModalOpen(true); }}
            className="group py-6 rounded-[28px] bg-brand-red text-white shadow-lg shadow-brand-red/20 flex flex-col items-center gap-2 hover:bg-brand-red/90 transition-all active:scale-95"
        >
            <TrendingDown className="w-8 h-8 group-hover:-translate-y-1 transition-transform" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.2em]">Cash Out (You Gave)</span>
        </button>
        <button 
            onClick={() => { setTxType('CASH_IN'); setIsModalOpen(true); }}
            className="group py-6 rounded-[28px] bg-brand-green text-white shadow-lg shadow-brand-green/20 flex flex-col items-center gap-2 hover:bg-brand-green/90 transition-all active:scale-95"
        >
            <TrendingUp className="w-8 h-8 group-hover:-translate-y-1 transition-transform" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.2em]">Cash In (You Got)</span>
        </button>
      </div>

      {/* History Table */}
      <div className="bg-white dark:bg-[#111111] rounded-[32px] border border-brand-blue/5 dark:border-[#222222] shadow-sm overflow-hidden">
        <div className="p-6 border-b border-brand-blue/5 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-brand-blue/40 uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Ledger Timeline
            </h3>
        </div>
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-brand-blue/5 dark:bg-brand-blue/10">
                        <th className="px-6 py-4 text-[10px] font-semibold text-brand-blue/40 uppercase tracking-[0.2em]">Entry Detail</th>
                        <th className="px-6 py-4 text-[10px] font-semibold text-brand-blue/40 uppercase tracking-[0.2em] text-right">Cash Out</th>
                        <th className="px-6 py-4 text-[10px] font-semibold text-brand-blue/40 uppercase tracking-[0.2em] text-right">Cash In</th>
                        <th className="px-6 py-4 text-[10px] font-semibold text-brand-blue/40 uppercase tracking-[0.2em] text-right">Balance</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-brand-blue/5">
                    {transactions.slice().reverse().map((tx, idx) => {
                        const originalIndex = transactions.length - 1 - idx;
                        const balance = runningBalances[originalIndex];
                        return (
                            <tr key={tx.id} className="hover:bg-brand-blue/5 transition-colors group">
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 rounded-xl bg-brand-blue/5 dark:bg-[#1A1A1A]">
                                            <Calendar className="w-4 h-4 text-brand-blue/40" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-widest mb-0.5">{format(tx.dateTime, 'MMM dd, yyyy')}</p>
                                            <p className="font-bold text-brand-blue dark:text-white line-clamp-1">{tx.remarks || "No remarks filed"}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-5 text-right font-semibold text-brand-red">
                                    {tx.type === 'CASH_OUT' ? `₹${tx.amount.toLocaleString('en-IN')}` : '-'}
                                </td>
                                <td className="px-6 py-5 text-right font-semibold text-brand-green">
                                    {tx.type === 'CASH_IN' ? `₹${tx.amount.toLocaleString('en-IN')}` : '-'}
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <div className="flex flex-col items-end">
                                        <p className={`font-semibold tracking-tight ${balance >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                                            ₹{Math.abs(balance).toLocaleString('en-IN')}
                                        </p>
                                        <button onClick={() => handleDelete(tx.id!)} className="opacity-0 group-hover:opacity-100 p-1 text-brand-red hover:bg-brand-red/10 rounded transition-all mt-1">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {transactions.length === 0 && (
                        <tr>
                            <td colSpan={4} className="py-20 text-center text-brand-blue/20 font-semibold uppercase tracking-[0.3em] text-[10px]">
                                End of Timeline detected.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111111] rounded-[40px] w-full max-w-sm border border-brand-blue/10 p-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${txType === 'CASH_OUT' ? 'bg-brand-red/10 text-brand-red' : 'bg-brand-green/10 text-brand-green'}`}>
                    {txType === 'CASH_OUT' ? <TrendingDown size={28} /> : <TrendingUp size={28} />}
                </div>
                <div>
                    <h2 className="text-2xl font-heading font-semibold text-brand-blue dark:text-[#F7F7F7] tracking-tight">
                        Log {txType === 'CASH_OUT' ? 'Cash Out' : 'Cash In'}
                    </h2>
                    <p className="text-[10px] font-semibold text-brand-blue/30 uppercase tracking-[0.2em] mt-0.5">Recording Ledger entry</p>
                </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-semibold text-brand-blue/40 uppercase tracking-[0.2em] mb-1.5 ml-1">Recording Date</label>
                <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-blue/20" />
                    <input 
                        type="date" 
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/5 rounded-2xl outline-none font-medium text-brand-blue dark:text-white"
                    />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-brand-blue/40 uppercase tracking-[0.2em] mb-1.5 ml-1">Amount</label>
                <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-brand-blue/20">₹</span>
                    <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        autoFocus
                        className="w-full pl-10 pr-4 py-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/5 rounded-2xl outline-none font-semibold text-brand-blue dark:text-white text-xl"
                    />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-brand-blue/40 uppercase tracking-[0.2em] mb-1.5 ml-1">Notes / Remarks</label>
                <div className="relative">
                    <FileText className="absolute left-4 top-4 w-4 h-4 text-brand-blue/20" />
                    <textarea 
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Why are you logging this?"
                        className="w-full pl-12 pr-4 py-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/5 rounded-2xl outline-none font-medium text-brand-blue dark:text-white h-24 resize-none placeholder:text-brand-blue/10"
                    />
                </div>
              </div>
              
              <div className="flex gap-4 pt-4">
                <button 
                    onClick={() => setIsModalOpen(false)} 
                    className="flex-1 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-blue/40 hover:bg-brand-blue/5 rounded-2xl transition-all"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleAddTransaction} 
                    className={`flex-1 py-4 rounded-2xl font-semibold text-[10px] uppercase tracking-[0.2em] shadow-lg transition-all active:scale-95 ${txType === 'CASH_OUT' ? 'bg-brand-red shadow-brand-red/20' : 'bg-brand-green shadow-brand-green/20'} text-white`}
                >
                    Log Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
