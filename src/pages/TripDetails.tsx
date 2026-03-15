import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, TripMember, TripTransaction, TripSplit } from '../lib/db';
import { Users, Receipt, Plus, ArrowLeft, Trash2, CheckCircle2, AlertCircle, ShoppingBag, Landmark, UserPlus, Calculator } from 'lucide-react';
import { format } from 'date-fns';

export default function TripDetails() {
  const { id } = useParams();
  const tripId = Number(id);
  const navigate = useNavigate();

  const trip = useLiveQuery(() => db.trips.get(tripId));
  const members = useLiveQuery(() => db.tripMembers.where('tripId').equals(tripId).toArray()) || [];
  const tripTransactions = useLiveQuery(() => db.tripTransactions.where('tripId').equals(tripId).toArray()) || [];
  const allSplits = useLiveQuery(() => db.tripSplits.toArray()) || [];

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [newTxDesc, setNewTxDesc] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [paidByMemberId, setPaidByMemberId] = useState<number | ''>('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');

  const [activeTab, setActiveTab] = useState<'LEDGER' | 'BALANCES'>('LEDGER');

  const handleAddMember = async () => {
    if (!newMemberName.trim()) return;
    await db.tripMembers.add({
      tripId,
      name: newMemberName
    });
    setNewMemberName('');
    setIsMemberModalOpen(false);
  };

  const handleAddTransaction = async () => {
    if (!newTxDesc || !newTxAmount || !paidByMemberId || selectedMembers.length === 0) return;
    
    const amount = parseFloat(newTxAmount);
    const splitAmount = amount / selectedMembers.length;

    const txId = await db.tripTransactions.add({
      tripId,
      amount,
      description: newTxDesc,
      dateTime: new Date(),
      paidByMemberId: Number(paidByMemberId),
      category: 'Trip'
    });

    for (const memberId of selectedMembers) {
      await db.tripSplits.add({
        tripTransactionId: Number(txId),
        memberId,
        amount: splitAmount
      });
    }

    setIsTxModalOpen(false);
    setNewTxDesc('');
    setNewTxAmount('');
    setPaidByMemberId('');
    setSelectedMembers([]);
  };

  const getBalances = () => {
    const balances: Record<number, number> = {};
    members.forEach(m => balances[m.id!] = 0);

    tripTransactions.forEach(tx => {
      balances[tx.paidByMemberId] += tx.amount;
    });

    const tripTxIds = tripTransactions.map(t => t.id);
    allSplits.filter(s => tripTxIds.includes(s.tripTransactionId)).forEach(split => {
      if (balances[split.memberId] !== undefined) {
        balances[split.memberId] -= split.amount;
      }
    });

    return balances;
  };

  const balances = getBalances();

  const getSettlements = (balMap: Record<number, number>) => {
    const sorted = Object.entries(balMap)
      .map(([id, amt]) => ({ id: Number(id), amt }))
      .sort((a, b) => a.amt - b.amt);

    const debtors = sorted.filter(m => m.amt < -0.01);
    const creditors = sorted.filter(m => m.amt > 0.01).sort((a, b) => b.amt - a.amt);

    const results: { from: number; to: number; amount: number }[] = [];
    
    let i = 0, j = 0;
    const d = debtors.map(x => ({ ...x }));
    const c = creditors.map(x => ({ ...x }));

    while (i < d.length && j < c.length) {
      const settle = Math.min(Math.abs(d[i].amt), c[j].amt);
      results.push({ from: d[i].id, to: c[j].id, amount: settle });
      d[i].amt += settle;
      c[j].amt -= settle;
      if (Math.abs(d[i].amt) < 0.01) i++;
      if (Math.abs(c[j].amt) < 0.01) j++;
    }

    return results;
  };

  const settlements = getSettlements(balances);

  const handleDeleteTx = async (id: number) => {
    if (confirm('Delete this transaction?')) {
      await db.tripTransactions.delete(id);
      const splits = await db.tripSplits.where('tripTransactionId').equals(id).toArray();
      for (const s of splits) {
        await db.tripSplits.delete(s.id!);
      }
    }
  };

  if (!trip) return <div className="p-8 text-center text-brand-blue/40 uppercase tracking-widest font-black text-xs">Mission Intel Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-32">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate('/trips')} className="p-2.5 rounded-full bg-brand-blue/5 text-brand-blue hover:bg-brand-blue/10 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
            <h1 className="text-3xl font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">{trip.name}</h1>
            <p className="text-[10px] font-black text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-widest mt-1">Operational Manifest</p>
        </div>
        <button onClick={() => setIsMemberModalOpen(true)} className="p-2.5 rounded-full bg-brand-blue/5 text-brand-blue hover:bg-brand-blue/10 transition-all" title="Enlist Operatives">
          <UserPlus className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-neutral-100 dark:bg-[#0C0C0F] p-1 rounded-2xl flex items-center mb-6">
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${
            activeTab === 'LEDGER' ? 'bg-brand-blue text-white shadow-lg' : 'text-brand-blue/40 hover:text-brand-blue'
          }`}
        >
          <Receipt className="w-4 h-4 inline-block mr-2 mb-0.5" />
          Ledger
        </button>
        <button
          onClick={() => setActiveTab('BALANCES')}
          className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all uppercase tracking-widest ${
            activeTab === 'BALANCES' ? 'bg-brand-blue text-white shadow-lg' : 'text-brand-blue/40 hover:text-brand-blue'
          }`}
        >
          <Calculator className="w-4 h-4 inline-block mr-2 mb-0.5" />
          Net Settlement
        </button>
      </div>

      {activeTab === 'LEDGER' ? (
        <div className="space-y-4">
          {tripTransactions.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-[#111111] rounded-[32px] border border-dashed border-brand-blue/10">
              <ShoppingBag className="w-10 h-10 text-brand-blue/20 mx-auto mb-4" />
              <p className="text-brand-blue/40 font-black uppercase tracking-widest text-[10px]">No operational expenses logged.</p>
            </div>
          ) : (
            tripTransactions.sort((a,b) => b.dateTime.getTime() - a.dateTime.getTime()).map(tx => (
              <div key={tx.id} className="bg-white dark:bg-[#111111] p-5 rounded-[24px] border border-brand-blue/5 dark:border-[#222222] shadow-sm flex items-center justify-between group">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-[12px] bg-brand-blue/5 flex items-center justify-center text-brand-blue">
                        <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-black text-brand-blue dark:text-[#F7F7F7]">{tx.description}</h4>
                        <p className="text-[10px] font-black text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-widest mt-0.5">
                            Paid by {members.find(m => m.id === tx.paidByMemberId)?.name} • {format(tx.dateTime, 'h:mm a')}
                        </p>
                    </div>
                </div>
                <div className="text-right flex items-center gap-4">
                    <div>
                        <p className="font-black text-brand-blue dark:text-[#F7F7F7]">₹{tx.amount.toLocaleString('en-IN')}</p>
                        <p className="text-[9px] font-black text-brand-green uppercase tracking-tighter">Verified</p>
                    </div>
                    <button onClick={() => handleDeleteTx(tx.id!)} className="opacity-0 group-hover:opacity-100 p-2 text-brand-red hover:bg-brand-red/10 rounded-full transition-all">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {members.map(member => (
              <div key={member.id} className="bg-white dark:bg-[#111111] p-5 rounded-[24px] border border-brand-blue/5 dark:border-[#222222] text-center shadow-sm">
                <p className="text-[10px] font-black text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-widest mb-1">{member.name}</p>
                <p className={`text-xl font-black ${balances[member.id!] >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                  {balances[member.id!] >= 0 ? '+' : ''}₹{balances[member.id!].toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-[#111111] p-6 rounded-[32px] border border-brand-blue/5 dark:border-[#222222] shadow-sm">
            <h3 className="text-xs font-black text-brand-blue dark:text-[#F7F7F7] uppercase tracking-widest mb-6">Settlement Blueprint</h3>
            <div className="space-y-3">
              {settlements.length === 0 ? (
                <div className="flex items-center gap-3 p-4 bg-brand-green/5 rounded-2xl border border-brand-green/10">
                    <CheckCircle2 className="w-5 h-5 text-brand-green" />
                    <p className="text-[10px] font-black text-brand-green uppercase tracking-widest">All accounts are zeroed out.</p>
                </div>
              ) : (
                settlements.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-brand-blue/5 rounded-2xl border border-brand-blue/10">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-brand-red uppercase">{members.find(m => m.id === s.from)?.name}</span>
                        <div className="h-0.5 w-8 bg-brand-blue/10 rounded-full" />
                        <span className="text-[10px] font-black text-brand-green uppercase">{members.find(m => m.id === s.to)?.name}</span>
                    </div>
                    <p className="text-sm font-black text-brand-blue">₹{s.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Add Expense Button */}
      <button 
        onClick={() => setIsTxModalOpen(true)}
        className="fixed bottom-24 right-6 w-16 h-16 bg-brand-green text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-brand-green/90 transition-all transform active:scale-95 z-40"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Transcation Modal */}
      {isTxModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111111] rounded-t-[32px] sm:rounded-[32px] w-full max-w-md border border-brand-blue/10 p-8 shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
            <h2 className="text-2xl font-black text-brand-blue dark:text-[#F7F7F7] mb-6 tracking-tighter">File Expense</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-brand-blue/40 uppercase tracking-widest mb-1">Description</label>
                <input 
                  type="text" 
                  value={newTxDesc}
                  onChange={(e) => setNewTxDesc(e.target.value)}
                  placeholder="e.g. Dinner at Hilton"
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/10 rounded-xl outline-none font-black text-brand-blue"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-brand-blue/40 uppercase tracking-widest mb-1">Amount</label>
                  <input 
                    type="number" 
                    value={newTxAmount}
                    onChange={(e) => setNewTxAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/10 rounded-xl outline-none font-black text-brand-blue"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-brand-blue/40 uppercase tracking-widest mb-1">Payer</label>
                  <select 
                    value={paidByMemberId}
                    onChange={(e) => setPaidByMemberId(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/10 rounded-xl outline-none font-black text-brand-blue"
                  >
                    <option value="">Select Member</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-brand-blue/40 uppercase tracking-widest mb-3">Split Between</label>
                <div className="flex flex-wrap gap-2">
                    <button 
                        onClick={() => setSelectedMembers(members.map(m => m.id!))}
                        className="text-[9px] font-black uppercase tracking-widest text-brand-blue/40 hover:text-brand-blue mr-2"
                    >
                        Select All
                    </button>
                    {members.map(m => (
                        <button
                            key={m.id}
                            onClick={() => {
                                setSelectedMembers(prev => 
                                    prev.includes(m.id!) ? prev.filter(x => x !== m.id) : [...prev, m.id!]
                                );
                            }}
                            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                                selectedMembers.includes(m.id!) ? 'bg-brand-blue text-white' : 'bg-brand-blue/5 text-brand-blue/40'
                            }`}
                        >
                            {m.name}
                        </button>
                    ))}
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button 
                  onClick={() => setIsTxModalOpen(false)}
                  className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-brand-blue/40 hover:bg-brand-blue/5 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddTransaction}
                  className="flex-1 py-3 bg-brand-green text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-green/90 shadow-lg"
                >
                  Commit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Member Modal */}
      {isMemberModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111111] rounded-[32px] w-full max-w-sm border border-brand-blue/10 p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-brand-blue dark:text-[#F7F7F7] mb-6 tracking-tighter">Add Operative</h2>
            <div className="space-y-4">
              <input 
                type="text" 
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Name"
                className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/10 rounded-xl outline-none font-black text-brand-blue"
              />
              <div className="flex gap-3">
                <button onClick={() => setIsMemberModalOpen(false)} className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-brand-blue/40">Abort</button>
                <button onClick={handleAddMember} className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-black text-[10px] uppercase tracking-widest">Enlist</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
