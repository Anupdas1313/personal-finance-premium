import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { PlaneTakeoff, Plus, Calendar, ChevronRight, Target, MoreHorizontal } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function Trips() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [newTripDesc, setNewTripDesc] = useState('');

  const trips = useLiveQuery(() => db.trips.toArray()) || [];

  const handleCreateTrip = async () => {
    if (!newTripName.trim()) return;
    const tripId = await db.trips.add({
      name: newTripName,
      description: newTripDesc,
      startDate: new Date(),
      status: 'ACTIVE'
    });
    // Add creator as first member automatically
    await db.tripMembers.add({
      tripId: Number(tripId),
      name: 'Me'
    });
    setIsModalOpen(false);
    setNewTripName('');
    setNewTripDesc('');
    navigate(`/trips/${tripId}`);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-brand-blue/5 dark:bg-[#1A1A1A] rounded-full flex items-center justify-center mx-auto mb-4 border border-brand-blue/5 dark:border-[#222222]">
          <PlaneTakeoff className="w-10 h-10 text-brand-blue dark:text-brand-cyan" />
        </div>
        <h1 className="text-4xl font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">Expeditions</h1>
        <p className="text-brand-blue/40 dark:text-[#A0A0A0] mt-2 font-black uppercase tracking-widest text-[10px]">Managed split-group finance pipelines</p>
      </div>

      <div className="bg-white dark:bg-[#111111] p-1.5 rounded-2xl border border-brand-blue/5 dark:border-[#222222] flex items-center justify-between shadow-sm mb-6">
        <div className="px-4 py-2">
            <h2 className="text-xs font-black text-brand-blue dark:text-[#F7F7F7] uppercase tracking-widest">{trips.length} Active Missions</h2>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-2 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] font-black rounded-xl hover:bg-brand-green/90 transition-all text-[10px] uppercase tracking-widest shadow-lg shadow-brand-green/10"
        >
          Initialize
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {trips.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#111111] rounded-[32px] border border-dashed border-brand-blue/10">
            <Target className="w-12 h-12 text-brand-blue/20 mx-auto mb-4" />
            <p className="text-brand-blue/40 font-black uppercase tracking-widest text-[10px]">Zero active expeditions detected.</p>
          </div>
        ) : (
          trips.map(trip => (
            <Link 
              key={trip.id} 
              to={`/trips/${trip.id}`}
              className="bg-white dark:bg-[#111111] p-6 rounded-[28px] border border-brand-blue/5 dark:border-[#222222] hover:bg-brand-blue/5 hover:border-brand-blue/10 transition-all group relative overflow-hidden shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black text-brand-blue dark:text-[#F7F7F7] group-hover:text-brand-green transition-colors">{trip.name}</h3>
                  <p className="text-xs font-black text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-widest mt-1">{trip.description || 'No brief provided'}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${trip.status === 'ACTIVE' ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-blue/10 text-brand-blue'}`}>
                  {trip.status}
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2 text-brand-blue/40 text-[10px] font-black uppercase tracking-widest">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(trip.startDate, 'MMM d, yyyy')}
                </div>
                <div className="w-8 h-8 rounded-full bg-brand-blue/5 flex items-center justify-center text-brand-blue group-hover:bg-brand-green group-hover:text-white transition-all">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111111] rounded-[32px] w-full max-w-sm border border-brand-blue/10 p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black text-brand-blue dark:text-[#F7F7F7] mb-6 tracking-tighter">New Expedition</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-brand-blue/40 uppercase tracking-widest mb-1">Mission Name</label>
                <input 
                  type="text" 
                  value={newTripName}
                  onChange={(e) => setNewTripName(e.target.value)}
                  placeholder="e.g. Manali 2024"
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/10 rounded-xl outline-none font-black text-brand-blue dark:text-[#F7F7F7] focus:ring-2 focus:ring-brand-cyan"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-brand-blue/40 uppercase tracking-widest mb-1">Brief (Optional)</label>
                <textarea 
                  value={newTripDesc}
                  onChange={(e) => setNewTripDesc(e.target.value)}
                  placeholder="Notes about the trip..."
                  className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/10 rounded-xl outline-none font-black text-brand-blue dark:text-[#F7F7F7] focus:ring-2 focus:ring-brand-cyan h-24 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-brand-blue/40 hover:bg-brand-blue/5 rounded-xl transition-all"
                >
                  Abort
                </button>
                <button 
                  onClick={handleCreateTrip}
                  className="flex-1 py-3 bg-brand-blue text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-brand-blue/90 shadow-lg shadow-brand-blue/20 transition-all"
                >
                  Deploy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
