import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Party } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, UserPlus, Phone, ChevronRight, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Ledger() {
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
    <div className="space-y-6 max-w-4xl mx-auto pb-32">
      <div className="text-center mb-10">
        <div className="w-20 h-20 bg-brand-blue/5 dark:bg-[#1A1A1A] rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-blue/5 dark:border-[#222222]">
          <Users className="w-10 h-10 text-brand-blue dark:text-brand-cyan" />
        </div>
        <h1 className="text-4xl font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">Ledger Book</h1>
        <p className="text-brand-blue/40 dark:text-[#A0A0A0] mt-2 font-black uppercase tracking-widest text-[10px]">Track cash flow with parties & friends</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#111111] p-6 rounded-[32px] border border-brand-blue/5 dark:border-[#222222] shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-widest mb-1">Total You'll Get</p>
                <p className="text-3xl font-black text-brand-green tracking-tighter">₹{stats.totalGet.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-12 h-12 bg-brand-green/10 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-brand-green" />
            </div>
        </div>
        <div className="bg-white dark:bg-[#111111] p-6 rounded-[32px] border border-brand-blue/5 dark:border-[#222222] shadow-sm flex items-center justify-between">
            <div>
                <p className="text-[10px] font-black text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-widest mb-1">Total You'll Give</p>
                <p className="text-3xl font-black text-brand-red tracking-tighter">₹{stats.totalGive.toLocaleString('en-IN')}</p>
            </div>
            <div className="w-12 h-12 bg-brand-red/10 rounded-2xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-brand-red" />
            </div>
        </div>
        <div className="bg-white dark:bg-[#111111] p-6 rounded-[32px] border border-brand-blue/5 dark:border-[#222222] shadow-sm flex items-center justify-between md:col-span-1">
            <div>
                <p className="text-[10px] font-black text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-widest mb-1">Net Ledger Standing</p>
                <p className={`text-3xl font-black tracking-tighter ${stats.totalGet - stats.totalGive >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                    ₹{Math.abs(stats.totalGet - stats.totalGive).toLocaleString('en-IN')}
                </p>
            </div>
            <div className="w-12 h-12 bg-brand-blue/5 rounded-2xl flex items-center justify-center">
                <TrendingUp className={`w-6 h-6 ${stats.totalGet - stats.totalGive >= 0 ? 'text-brand-green' : 'text-brand-red'}`} />
            </div>
        </div>
      </div>

      {/* Search and Action */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-[#111111] p-2 rounded-[24px] border border-brand-blue/5 dark:border-[#222222] shadow-sm">
        <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-blue/30" />
            <input 
                type="text"
                placeholder="Search party by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-neutral-50 dark:bg-[#1A1A1A] border-none rounded-xl outline-none font-black text-brand-blue dark:text-white placeholder:text-brand-blue/20"
            />
        </div>
        <button 
            onClick={() => setIsPartyModalOpen(true)}
            className="w-full sm:w-auto px-8 py-3 bg-brand-blue text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-blue/20 flex items-center justify-center gap-2 hover:bg-brand-blue/90 transition-all active:scale-95"
        >
            <UserPlus className="w-4 h-4" />
            Add Party
        </button>
      </div>

      {/* Parties List */}
      <div className="grid grid-cols-1 gap-3">
        {filteredParties.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-[#111111] rounded-[32px] border border-dashed border-brand-blue/10">
                <Users className="w-12 h-12 text-brand-blue/20 mx-auto mb-4" />
                <p className="text-brand-blue/40 font-black uppercase tracking-widest text-[10px]">No parties found in your records.</p>
            </div>
        ) : (
            filteredParties.map(party => {
                const balance = partyBalances[party.id!] || 0;
                return (
                    <Link 
                        key={party.id}
                        to={`/ledger/${party.id}`}
                        className="bg-white dark:bg-[#111111] p-5 rounded-[24px] border border-brand-blue/5 dark:border-[#222222] hover:bg-brand-blue/5 transition-all group shadow-sm flex items-center justify-between"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-brand-blue/5 text-brand-blue font-black flex items-center justify-center text-xl uppercase tracking-tighter">
                                {party.name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-black text-brand-blue dark:text-[#F7F7F7] flex items-center gap-2">
                                    {party.name}
                                    <span className="px-1.5 py-0.5 rounded-md bg-brand-blue/5 text-[8px] uppercase tracking-widest text-brand-blue/40">{party.type}</span>
                                </h3>
                                {party.phoneNumber && (
                                    <p className="text-[10px] font-black text-brand-blue/30 dark:text-[#A0A0A0] flex items-center gap-1 mt-0.5">
                                        <Phone className="w-3 h-3" />
                                        {party.phoneNumber}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <p className="text-[8px] font-black uppercase tracking-widest text-brand-blue/20 mb-1">
                                    {balance >= 0 ? "You'll Get" : "You'll Give"}
                                </p>
                                <p className={`text-xl font-black ${balance >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                                    ₹{Math.abs(balance).toLocaleString('en-IN')}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-brand-blue/5 flex items-center justify-center text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm">
                                <ChevronRight className="w-5 h-5" />
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
          <div className="bg-white dark:bg-[#111111] rounded-[32px] w-full max-w-sm border border-brand-blue/10 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-brand-blue dark:text-[#F7F7F7] mb-6 tracking-tighter">Add Party</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-brand-blue/40 uppercase tracking-widest mb-1">Party Name</label>
                <input 
                  type="text" 
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/10 rounded-xl outline-none font-black text-brand-blue dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-brand-blue/40 uppercase tracking-widest mb-1">Phone (Optional)</label>
                <input 
                  type="text" 
                  value={newPartyPhone}
                  onChange={(e) => setNewPartyPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/10 rounded-xl outline-none font-black text-brand-blue dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-brand-blue/40 uppercase tracking-widest mb-1">Type</label>
                <div className="grid grid-cols-3 gap-2">
                    {(['CUSTOMER', 'SUPPLIER', 'FRIEND'] as const).map(type => (
                        <button 
                            key={type}
                            onClick={() => setNewPartyType(type)}
                            className={`py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${newPartyType === type ? 'bg-brand-blue text-white shadow-lg' : 'bg-brand-blue/5 text-brand-blue/40 hover:bg-brand-blue/10'}`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                    onClick={() => setIsPartyModalOpen(false)} 
                    className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-brand-blue/40 hover:bg-brand-blue/5 rounded-xl transition-all"
                >
                    Abort
                </button>
                <button 
                    onClick={handleAddParty} 
                    className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-blue/20 hover:bg-brand-blue/90 transition-all active:scale-95"
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
