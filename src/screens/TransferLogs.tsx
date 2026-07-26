import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useCurrency } from '../hooks/useCurrency';
import { ArrowLeft, Trash2, ArrowRight, ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';

export default function TransferLogs() {
  const navigate = useNavigate();
  const currency = useCurrency();
  
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const allTransactions = useLiveQuery(() => db.transactions.toArray()) || [];

  // Filter for debit transfers to get exactly one record per transfer
  const transfers = allTransactions
    .filter(tx => tx.category === 'Transfer' && tx.type === 'DEBIT')
    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

  const handleDeleteTransfer = async (debitId: number, creditId?: number) => {
    if (!window.confirm('Are you sure you want to delete this transfer? This will restore balances on both accounts.')) {
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
      alert('An error occurred while deleting the transfer.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-1 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Back Header */}
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={() => navigate('/transfer')}
          className="-ml-3 p-1.5 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/5 rounded-full hover:bg-neutral-50 dark:hover:bg-white/10 transition-all text-neutral-600 dark:text-neutral-300"
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
            const fromAccName = fromAcc ? `${fromAcc.bankName} (•• ${fromAcc.accountLast4})` : 'Unknown Account';
            
            const linkedTx = allTransactions.find(t => t.id === tx.linkedTransactionId);
            const toAcc = linkedTx ? accounts.find(a => a.id === linkedTx.accountId) : null;
            const toAccName = toAcc ? `${toAcc.bankName} (•• ${toAcc.accountLast4})` : (tx.party || 'Unknown Account');

            const formattedDate = format(new Date(tx.dateTime), 'dd MMM yyyy, hh:mm a');

            return (
              <div 
                key={tx.id} 
                className="bg-white dark:bg-[#111111] p-4 rounded-[20px] shadow-sm border border-neutral-100 dark:border-white/5 flex items-center justify-between gap-4 animate-in fade-in duration-300"
              >
                <div className="flex-1 min-w-0">
                  {/* Date & Paths */}
                  <div className="flex items-center gap-2 text-[8px] font-black text-neutral-400 uppercase tracking-wider mb-2">
                    <span>{formattedDate}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-brand-blue dark:text-white mb-1 truncate">
                    <span className="truncate">{fromAccName}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="truncate">{toAccName}</span>
                  </div>

                  {tx.note && (
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-bold uppercase tracking-wide truncate">
                      {tx.note}
                    </p>
                  )}
                </div>

                {/* Right side: Amount and Delete button */}
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-sm font-heading font-black text-cyan-500 tracking-tight">
                    {currency}{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  
                  <button 
                    onClick={() => handleDeleteTransfer(tx.id!, tx.linkedTransactionId)}
                    className="p-2 text-neutral-400 hover:text-brand-red dark:hover:text-rose-500 bg-neutral-50 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                    title="Delete Transfer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
