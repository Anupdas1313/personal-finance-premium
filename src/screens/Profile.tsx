import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, ShieldCheck, CheckCircle2, AlertTriangle, Save } from 'lucide-react';
import { cn } from '../logic/utils';

export default function Profile() {
  const { user, updateProfileName, logout, deleteAccount } = useAuth();
  const [name, setName] = useState(user?.displayName || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsUpdating(true);
    try {
      await updateProfileName(name);
      showMessage('success', 'Profile name updated successfully');
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to update name');
    } finally {
      setIsUpdating(false);
    }
  };

  const userInitial = user?.displayName?.[0] || user?.email?.[0] || '?';

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 bg-neutral-100 dark:bg-[#222222] text-brand-blue dark:text-[#F7F7F7] rounded-2xl border border-brand-blue/5 dark:border-transparent ring-2 ring-brand-cyan/20">
          <User className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-4xl font-heading font-semibold tracking-tight text-brand-blue dark:text-[#F7F7F7]">Profile</h1>
          <p className="text-brand-blue/40 dark:text-[#A0A0A0] font-semibold mt-1 uppercase tracking-[0.2em] text-[10px]">User Account Management</p>
        </div>
      </div>

      {message && (
        <div className={cn(
          "p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm",
          message.type === 'success' 
            ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' 
            : 'bg-brand-red/10 text-brand-red border border-brand-red/20'
        )}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <p className="font-bold text-sm">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left: Avatar & Quick Actions */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#111111] rounded-[32px] border border-brand-blue/5 dark:border-[#222222] shadow-sm p-8 flex flex-col items-center">
            <div className="w-24 h-24 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-full flex items-center justify-center text-4xl font-black shadow-xl mb-4 uppercase ring-4 ring-brand-blue/10 dark:ring-brand-cyan/10">
              {userInitial}
            </div>
            <h2 className="text-lg font-bold text-brand-blue dark:text-white text-center line-clamp-1">
              {user?.displayName || 'Anonymous User'}
            </h2>
            <p className="text-xs font-semibold text-brand-blue/40 dark:text-[#A0A0A0] mt-1 text-center truncate w-full">
              {user?.email}
            </p>
          </div>

          <div className="bg-brand-blue/5 dark:bg-brand-cyan/5 rounded-3xl border border-brand-blue/10 dark:border-brand-cyan/10 p-6">
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className="w-5 h-5 text-brand-blue dark:text-brand-cyan" />
              <h3 className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">Account Security</h3>
            </div>
            <p className="text-xs font-medium text-brand-blue/50 dark:text-[#A0A0A0] leading-relaxed">
              Your account is protected by industry-standard encryption. We never share your data with third parties.
            </p>
          </div>
        </div>

        {/* Right: Details & Editing */}
        <div className="md:col-span-2 space-y-8">
          <section>
            <h2 className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Personal Information</h2>
            <div className="bg-white dark:bg-[#111111] rounded-[32px] border border-brand-blue/5 dark:border-[#222222] shadow-sm overflow-hidden">
              <form onSubmit={handleUpdateName} className="p-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-2 ml-1">
                      Full Name
                    </label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-blue/20 dark:text-[#55555E] group-focus-within:text-brand-blue dark:group-focus-within:text-brand-cyan transition-colors" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your display name"
                        className="w-full pl-12 pr-4 py-3.5 bg-neutral-50 dark:bg-[#1A1A1E] border border-brand-blue/5 dark:border-white/5 rounded-2xl text-sm font-bold text-brand-blue dark:text-white outline-none focus:ring-2 ring-brand-blue/10 dark:ring-brand-cyan/10 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-2 ml-1">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-blue/20 dark:text-[#55555E]" />
                      <input
                        type="email"
                        disabled
                        value={user?.email || ''}
                        className="w-full pl-12 pr-4 py-3.5 bg-neutral-100/50 dark:bg-[#15151A] border border-brand-blue/5 dark:border-white/5 rounded-2xl text-sm font-bold text-brand-blue/40 dark:text-[#666666] cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isUpdating || name === user?.displayName}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-xl font-bold hover:brightness-110 transition-all disabled:opacity-50 text-xs uppercase tracking-widest shadow-lg shadow-brand-blue/20 dark:shadow-brand-cyan/10"
                  >
                    <Save className="w-4 h-4" />
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section className="space-y-4">
            <div className="bg-rose-50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10 rounded-[32px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-rose-600 dark:text-rose-400">Sign Out</h3>
                <p className="text-xs text-rose-500/70 dark:text-rose-400/70 mt-1">Log out of your account on this device</p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await logout();
                  } catch (e) {
                    console.error('Logout failed', e);
                  }
                }}
                className="px-6 py-3 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-500/30 rounded-xl font-bold transition-all text-xs uppercase tracking-widest w-full sm:w-auto"
              >
                Log Out
              </button>
            </div>

            <div className="bg-rose-100 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-[32px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-rose-700 dark:text-rose-500">Delete Account</h3>
                <p className="text-xs text-rose-600/70 dark:text-rose-500/70 mt-1">Permanently delete your account and all data</p>
              </div>
              <button
                disabled={isUpdating}
                onClick={async () => {
                  const confirmDelete = window.confirm(
                    'DANGER: This will permanently delete your account, including all your settings, transactions, and preferences from both this device and the cloud. This action CANNOT be undone.\n\nAre you absolutely sure?'
                  );
                  if (!confirmDelete) return;

                  setIsUpdating(true);
                  try {
                    if (!user) return;
                    const uid = user.uid;

                    // 1. Delete from Firestore first
                    const { collection, getDocs, deleteDoc } = await import('firebase/firestore');
                    const { firestoreDb } = await import('../lib/firebase');
                    const tables = [
                      'accounts', 'transactions', 'monthlyClosings', 'budgets', 
                      'parties', 'ledgerTransactions', 'accountClosings', 
                      'categories', 'tags', 'recurringTemplates', 'userSettings'
                    ];

                    for (const table of tables) {
                      try {
                        const qs = await getDocs(collection(firestoreDb, `users/${uid}/${table}`));
                        const deletePromises = qs.docs.map(doc => deleteDoc(doc.ref));
                        await Promise.all(deletePromises);
                      } catch (err) {
                        console.error(`Failed to delete table ${table}`, err);
                      }
                    }

                    // 2. Stop sync to prevent any writes while deleting
                    const { stopSync } = await import('../lib/syncEngine');
                    stopSync();

                    // 3. Delete local data
                    const { db } = await import('../models/db');
                    if (db.isOpen()) {
                      db.close(); // MUST close before delete to prevent hanging
                    }
                    await db.delete(); 
                    localStorage.removeItem(`onboardingComplete_${uid}`);
                    localStorage.removeItem(`tutorialComplete_${uid}`);
                    
                    // 4. Finally delete the Auth user
                    await deleteAccount();
                  } catch (e: any) {
                    if (e.code === 'auth/requires-recent-login') {
                      showMessage('error', 'Please log out and log back in to verify your identity before deleting your account.');
                    } else {
                      showMessage('error', e.message || 'Failed to delete account');
                    }
                  } finally {
                    setIsUpdating(false);
                  }
                }}
                className="px-6 py-3 bg-rose-600 dark:bg-rose-600 text-white hover:bg-rose-700 dark:hover:bg-rose-700 rounded-xl font-bold transition-all text-xs uppercase tracking-widest w-full sm:w-auto disabled:opacity-50"
              >
                {isUpdating ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
