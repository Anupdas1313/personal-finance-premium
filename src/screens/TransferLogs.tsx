import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useCurrency } from '../hooks/useCurrency';
import { ArrowLeft, Trash2, Landmark, Wallet, CreditCard, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../context/ToastContext';

export default function TransferLogs() {
  const navigate = useNavigate();
  const currency = useCurrency();
  const { confirm, error } = useToast();
  
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];

  // Filter for debit transfers to get exactly one record per transfer
  const transfers = allTransactions
    .filter(tx => tx.category === 'Transfer' && tx.type === 'DEBIT')
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

  const handleDeleteTransfer = async (debitId: number, creditId?: number) => {
    if (!await confirm('Are you sure you want to delete this transfer? This will restore balances on both accounts.')) {
      return;
    }

    try {
      await db.transaction('rw', db.transactions, async () => {
        await db.transactions.delete(debitId);
        if (creditId) {
          await db.transactions.delete(creditId);
        }
      });
    } catch (err) {
      console.error('Failed to delete transfer:', err);
      error('An error occurred while deleting the transfer.');
    }
  };

  const getAccountIcon = (type?: string) => {
    if (type === 'CASH') return <Wallet className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    if (type === 'CREDIT_CARD') return <CreditCard className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    return <Landmark className="w-3.5 h-3.5 text-cyan-500 shrink-0" />;
  };

  return (
    <div className="max-w-2xl mx-auto py-1 pb-4">
      {/* Back Header */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={() => navigate('/transfer')}
          className="-ml-1.5 p-1.5 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/5 rounded-full hover:bg-neutral-50 dark:hover:bg-white/10 transition-all text-neutral-600 dark:text-neutral-300"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter leading-none">
            Transfer Logs
          </h1>
          <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">
            History of inter-account movements
          </p>
        </div>
      </div>

      {/* Logs List Container */}
      <div className="space-y-3">
        {transfers.length === 0 ? (
          <div className="bg-white dark:bg-[#111111] p-10 text-center rounded-[24px] shadow-sm border border-neutral-100 dark:border-white/5 flex flex-col items-center justify-center gap-3">
            <ArrowLeftRight className="w-8 h-8 text-neutral-300 dark:text-neutral-700" />
            <p className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">No transfers recorded yet</p>
          </div>
        ) : (
          transfers.map(tx => {
            const fromAcc = accounts.find(a => a.id === tx.accountId);
            const fromAccName = fromAcc ? fromAcc.bankName : 'Unknown Account';
            const fromAccLast4 = fromAcc ? fromAcc.accountLast4 : '••••';
            const fromAccType = fromAcc ? fromAcc.type : 'BANK';
            
            const linkedTx = allTransactions.find(t => t.id === tx.linkedTransactionId);
            const toAcc = linkedTx ? accounts.find(a => a.id === linkedTx.accountId) : null;
            const toAccName = toAcc ? toAcc.bankName : (tx.party || 'Unknown Account');
            const toAccLast4 = toAcc ? toAcc.accountLast4 : '••••';
            const toAccType = toAcc ? toAcc.type : 'BANK';

            const formattedDate = format(new Date(tx.dateTime), 'dd MMM yyyy, hh:mm a');

            return (
              <div 
                key={tx.id} 
                className="bg-white dark:bg-[#111111] p-4 rounded-[20px] shadow-sm border border-neutral-100 dark:border-white/5 flex flex-col gap-3"
              >
                {/* Header: Date and Delete button */}
                <div className="flex justify-between items-center pb-2 border-b border-neutral-50 dark:border-white/5">
                  <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">
                    {formattedDate}
                  </span>
                  
                  <button 
                    onClick={() => handleDeleteTransfer(tx.id!, tx.linkedTransactionId)}
                    className="p-1.5 text-neutral-400 hover:text-brand-red dark:hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Delete Transfer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Structured Money Flow (Stacked FROM/TO to prevent mobile truncation) */}
                <div className="space-y-2">
                  {/* From Row */}
                  <div className="flex items-center gap-2">
                    <span className="w-9 px-1.5 py-0.5 rounded text-[8px] font-black text-center bg-rose-50 dark:bg-rose-500/10 text-rose-500 shrink-0">
                      FROM
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getAccountIcon(fromAccType)}
                      <span className="text-xs font-black text-brand-blue dark:text-white truncate">
                        {fromAccName} <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 ml-1">•• {fromAccLast4}</span>
                      </span>
                    </div>
                  </div>

                  {/* To Row */}
                  <div className="flex items-center gap-2">
                    <span className="w-9 px-1.5 py-0.5 rounded text-[8px] font-black text-center bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 shrink-0">
                      TO
                    </span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getAccountIcon(toAccType)}
                      <span className="text-xs font-black text-brand-blue dark:text-white truncate">
                        {toAccName} <span className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 ml-1">•• {toAccLast4}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer: Amount & Remarks */}
                <div className="flex items-center justify-between mt-1 pt-2 border-t border-neutral-50 dark:border-white/5">
                  <div className="min-w-0 pr-4">
                    <p className="text-[9px] text-neutral-400 dark:text-neutral-500 font-bold truncate">
                      {tx.note || 'Inter-Account Transfer'}
                    </p>
                  </div>
                  <span className="text-sm font-heading font-black text-cyan-500 tracking-tight shrink-0">
                    {currency}{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
