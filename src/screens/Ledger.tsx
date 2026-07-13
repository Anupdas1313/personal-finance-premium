import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, UserPlus, Phone, ChevronRight, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrency } from '../hooks/useCurrency';
import { cn } from '../logic/utils';

export default function Ledger() {
  const currency = useCurrency();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyType, setNewPartyType] = useState<'CUSTOMER' | 'SUPPLIER' | 'FRIEND'>('CUSTOMER');

  const parties = useLiveQuery(() => db.parties.toArray(), [user?.uid]) || [];
  const transactions = useLiveQuery(() => db.ledgerTransactions.toArray(), [user?.uid]) || [];

  const partyBalances = useMemo(() => {
    const balances: Record<number, number> = {};
    parties.forEach(p => balances[p.id!] = 0);
    transactions.forEach(tx => {
      if (tx.type === 'CASH_IN') {
        balances[tx.partyId] -= tx.amount;
      } else {
        balances[tx.partyId] += tx.amount;
      }
    });
    return balances;
  }, [parties, transactions]);

  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    let totalGet = 0;
    let totalGive = 0;
    Object.values(partyBalances).forEach(bal => {
      if (bal > 0) totalGet += bal;
      else totalGive += Math.abs(bal);
    });
    return { totalGet, totalGive };
  }, [partyBalances]);

  const handleAddParty = async () => {
    if (!newPartyName.trim()) return;
    await db.parties.add({
      name: newPartyName,
      phoneNumber: newPartyPhone,
      type: newPartyType,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    setNewPartyName('');
    setNewPartyPhone('');
    setIsPartyModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ── HEADER ── */}
      <div className="flex items-center gap-4 mb-2 px-1">
        <div className="p-3 bg-brand-blue/5 dark:bg-brand-blue/10 text-brand-blue dark:text-brand-cyan rounded-2xl border border-brand-blue/10 dark:border-brand-blue/5">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">Ledger Book</h1>
          <p className="text-neutral-400 font-bold mt-0.5 uppercase tracking-widest text-[8px]">Track cash flow with parties & friends</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-[#111111] p-5 rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Total You'll Get</p>
                <p className="text-3xl font-heading font-black text-brand-green tracking-tighter">{currency}{stats.totalGet.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-10 h-10 bg-brand-green/10 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-brand-green" />
            </div>
        </div>
        
        <div className="bg-white dark:bg-[#111111] p-5 rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Total You'll Give</p>
                <p className="text-3xl font-heading font-black text-brand-red tracking-tighter">{currency}{stats.totalGive.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-10 h-10 bg-brand-red/10 rounded-xl flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-brand-red" />
            </div>
        </div>
        
        <div className="bg-white dark:bg-[#111111] p-5 rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-1">Net Standing</p>
                <p className={`text-3xl font-heading font-black tracking-tighter ${stats.totalGet - stats.totalGive >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                    {currency}{Math.abs(stats.totalGet - stats.totalGive).toLocaleString('en-IN')}
                </p>
            </div>
            <div className="w-10 h-10 bg-neutral-100 dark:bg-[#222222] rounded-xl flex items-center justify-center">
                <TrendingUp className={`w-5 h-5 ${stats.totalGet - stats.totalGive >= 0 ? 'text-brand-green' : 'text-brand-red'}`} />
            </div>
        </div>
      </div>

      {/* Search and Action */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-[#111111] p-3 rounded-[20px] border border-neutral-100 dark:border-[#222222] shadow-sm">
        <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 dark:text-neutral-600" />
            <input 
                type="text"
                placeholder="Search party by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-neutral-50 dark:bg-[#1A1A1E] border border-neutral-100 dark:border-white/5 rounded-xl text-xs font-bold text-brand-blue dark:text-white outline-none focus:ring-2 focus:ring-brand-green/10 focus:border-brand-green transition-all placeholder:text-neutral-300"
            />
        </div>
        <button 
            onClick={() => setIsPartyModalOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-brand-green text-white rounded-xl font-black uppercase tracking-widest text-[9px] hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-brand-green/10 flex items-center justify-center gap-2"
        >
            <UserPlus className="w-3.5 h-3.5" />
            Add Party
        </button>
      </div>

      {/* Parties List */}
      <div className="grid grid-cols-1 gap-3">
        {filteredParties.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-[#111111] rounded-[24px] border border-dashed border-neutral-200 dark:border-white/10">
                <Users className="w-12 h-12 text-neutral-300 dark:text-neutral-700 mx-auto mb-4" />
                <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">No parties found in your records.</p>
            </div>
        ) : (
            filteredParties.map(party => {
                const balance = partyBalances[party.id!] || 0;
                return (
                    <Link 
                        key={party.id}
                        to={`/ledger/${party.id}`}
                        className="bg-white dark:bg-[#111111] p-5 rounded-[24px] border border-neutral-100 dark:border-[#222222] hover:bg-brand-blue/5 transition-all group shadow-sm flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-brand-blue/5 text-brand-blue font-black flex items-center justify-center text-lg uppercase">
                                {party.name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-brand-blue dark:text-[#F7F7F7] flex items-center gap-2">
                                    {party.name}
                                    <span className="px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-[#222222] text-[8px] uppercase tracking-widest text-neutral-400 font-bold">{party.type}</span>
                                </h3>
                                {party.phoneNumber && (
                                    <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 flex items-center gap-1 mt-0.5">
                                        <Phone className="w-3 h-3" />
                                        {party.phoneNumber}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="text-right">
                                <p className="text-[8px] font-bold uppercase tracking-widest text-neutral-400 mb-1">
                                    {balance >= 0 ? "You'll Get" : "You'll Give"}
                                </p>
                                <p className={`text-lg font-heading font-black tracking-tighter ${balance >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                                    {currency}{Math.abs(balance).toLocaleString('en-IN')}
                                </p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-neutral-50 dark:bg-white/5 flex items-center justify-center text-neutral-400 group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm">
                                <ChevronRight className="w-4 h-4" />
                            </div>
                        </div>
                    </Link>
                );
            })
        )}
      </div>

      {/* Add Party Modal */}
      {isPartyModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111111] rounded-[24px] w-full max-w-sm border border-neutral-200 dark:border-[#222222] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold text-brand-blue dark:text-[#F7F7F7] mb-5 tracking-tighter">Add Party</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Party Name</label>
                <input 
                  type="text" 
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1E] border border-neutral-100 dark:border-white/5 rounded-xl text-xs font-bold text-brand-blue dark:text-white outline-none focus:ring-2 focus:ring-brand-green/10 focus:border-brand-green transition-all"
                />
              </div>
              <div>
                <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Phone (Optional)</label>
                <input 
                  type="text" 
                  value={newPartyPhone}
                  onChange={(e) => setNewPartyPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1E] border border-neutral-100 dark:border-white/5 rounded-xl text-xs font-bold text-brand-blue dark:text-white outline-none focus:ring-2 focus:ring-brand-green/10 focus:border-brand-green transition-all"
                />
              </div>
              <div>
                <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Type</label>
                <div className="grid grid-cols-3 gap-2">
                    {(['CUSTOMER', 'SUPPLIER', 'FRIEND'] as const).map(type => (
                        <button 
                            key={type}
                            onClick={() => setNewPartyType(type)}
                            className={`py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${newPartyType === type ? 'bg-brand-blue text-white shadow-lg' : 'bg-brand-blue/5 text-brand-blue/40 hover:bg-brand-blue/10 dark:text-[#A0A0A0]'}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                    onClick={() => setIsPartyModalOpen(false)} 
                    className="flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest text-neutral-500 hover:bg-neutral-50 dark:hover:bg-[#1A1A1E] border border-neutral-200 dark:border-[#333] rounded-xl transition-all"
                >
                    Abort
                </button>
                <button 
                    onClick={handleAddParty} 
                    className="flex-1 py-2.5 text-[9px] font-black uppercase tracking-widest text-white bg-brand-green hover:brightness-110 active:scale-95 rounded-xl shadow-sm transition-all shadow-brand-green/10"
                >
                    Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
