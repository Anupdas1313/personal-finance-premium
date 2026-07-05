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
    <div className="space-y-6 max-w-2xl mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4 mb-2 px-1">
        <div className="p-3 bg-brand-green/5 dark:bg-[#111612] text-brand-green dark:text-brand-cyan rounded-2xl border border-brand-green/10 dark:border-brand-green/5">
          <User className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">Profile</h1>
          <p className="text-neutral-400 font-bold mt-0.5 uppercase tracking-widest text-[8px]">User Account Management</p>
        </div>
      </div>

      {message && (
        <div className={cn(
          "p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm text-xs",
          message.type === 'success' 
            ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' 
            : 'bg-brand-red/10 text-brand-red border border-brand-red/20'
        )}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <p className="font-bold">{message.text}</p>
        </div>
      )}

      {/* Main Profile Info Card */}
      <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm overflow-hidden">
        {/* Banner area / Profile Summary */}
        <div className="bg-brand-green/5 dark:bg-[#152016] px-6 py-6 border-b border-brand-green/10 dark:border-[#222222] flex flex-col sm:flex-row items-center gap-5">
          <div className="w-14 h-14 bg-brand-green text-white dark:bg-brand-cyan dark:text-brand-blue rounded-[20px] flex items-center justify-center text-xl font-black uppercase shadow-sm ring-4 ring-brand-green/10 dark:ring-brand-cyan/15 shrink-0">
            {userInitial}
          </div>
          <div className="text-center sm:text-left flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-0.5">
              <h2 className="text-base font-heading font-bold text-brand-blue dark:text-[#F7F7F7] truncate">
                {user?.displayName || 'Anonymous User'}
              </h2>
              <span className="px-2 py-0.5 bg-brand-green/10 dark:bg-brand-cyan/15 text-brand-green dark:text-brand-cyan rounded-full text-[8px] font-black uppercase tracking-widest">
                Premium
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 font-semibold truncate">
              {user?.email}
            </p>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleUpdateName} className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">
                Full Name
              </label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 dark:text-neutral-600 group-focus-within:text-brand-green transition-colors" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your display name"
                  className="w-full pl-11 pr-4 py-3 bg-neutral-50 dark:bg-[#1A1A1E] border border-neutral-100 dark:border-white/5 rounded-xl text-xs font-bold text-brand-blue dark:text-white outline-none focus:ring-2 focus:ring-brand-green/10 dark:focus:ring-brand-cyan/10 focus:border-brand-green transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[8px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300 dark:text-neutral-600" />
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full pl-11 pr-4 py-3 bg-neutral-100/50 dark:bg-[#15151A] border border-neutral-100 dark:border-white/5 rounded-xl text-xs font-bold text-neutral-400 dark:text-neutral-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isUpdating || name === user?.displayName}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-green text-white rounded-xl font-black uppercase tracking-widest text-[9px] hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all shadow-lg shadow-brand-green/10"
            >
              <Save className="w-3.5 h-3.5" />
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Security Info Card */}
        <div className="bg-brand-green/5 dark:bg-[#111612] rounded-[24px] border border-brand-green/10 dark:border-brand-green/5 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-brand-green" />
              <h3 className="font-bold text-[10px] text-brand-blue dark:text-[#F7F7F7] uppercase tracking-widest">Account Security</h3>
            </div>
            <p className="text-[10px] font-semibold text-neutral-400/80 leading-relaxed">
              Your financial connection is encrypted. Data remains fully synced with Google cloud and cached locally for swift offline access.
            </p>
          </div>
        </div>

        {/* Actions Card (Sign Out / Delete merged) */}
        <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] p-5 shadow-sm flex flex-col justify-between divide-y divide-neutral-100 dark:divide-[#222222]">
          {/* Sign Out Row */}
          <div className="pb-3.5 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-xs text-brand-blue dark:text-[#F7F7F7]">Sign Out</h3>
              <p className="text-[9px] text-neutral-400 font-semibold mt-0.5">Disconnect device session</p>
            </div>
            <button
              onClick={async () => {
                try {
                  await logout();
                } catch (e) {
                  console.error('Logout failed', e);
                }
              }}
              className="px-4 py-2 border border-neutral-200 dark:border-[#333333] hover:bg-neutral-50 dark:hover:bg-[#222222] text-neutral-600 dark:text-neutral-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
            >
              Log Out
            </button>
          </div>

          {/* Delete Row */}
          <div className="pt-3.5 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-xs text-brand-red">Delete Account</h3>
              <p className="text-[9px] text-brand-red/60 font-semibold mt-0.5">Purge profile & databases</p>
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
                  // 1. Delete from Firestore concurrently
                  const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
                  const { firestoreDb } = await import('../lib/firebase');
                  const { db } = await import('../models/db');
                  
                  const tableNames = db.tables.map(t => t.name);

                  await Promise.all(tableNames.map(async (table) => {
                    try {
                      const qs = await getDocs(collection(firestoreDb, `users/${uid}/${table}`));
                      const deletePromises = qs.docs.map(d => deleteDoc(d.ref));
                      await Promise.all(deletePromises);
                    } catch (err) {
                      console.error(`Failed to delete table ${table}`, err);
                    }
                  }));

                  // Delete the user root folder/document itself
                  try {
                    await deleteDoc(doc(firestoreDb, 'users', uid));
                  } catch (err) {
                    console.error('Failed to delete user root doc', err);
                  }

                  // 2. Stop sync to prevent any writes while deleting
                  const { stopSync } = await import('../lib/syncEngine');
                  stopSync();

                  // 3. Clear local data safely before unmounting
                  await Promise.all(db.tables.map(table => table.clear()));
                  localStorage.removeItem(`onboardingComplete_${uid}`);
                  localStorage.removeItem(`tutorialComplete_${uid}`);

                  // 4. Delete the Auth user last. 
                  await deleteAccount();
                  
                } catch (e: any) {
                  if (e.code === 'auth/requires-recent-login') {
                    try {
                      const { EmailAuthProvider, reauthenticateWithCredential } = await import('firebase/auth');
                      const { auth } = await import('../lib/firebase');
                      
                      const providerId = auth.currentUser?.providerData[0]?.providerId;
                      
                      if (providerId === 'password') {
                        const pwd = window.prompt("Security requirement: Please enter your password to confirm account deletion:");
                        if (!pwd) {
                          setIsUpdating(false);
                          return;
                        }
                        const credential = EmailAuthProvider.credential(user.email!, pwd);
                        await reauthenticateWithCredential(auth.currentUser!, credential);
                        
                        // Retry deletion after successful re-auth
                        await deleteAccount();
                      } else {
                        alert("For security purposes, you must verify your identity to delete your account. You will be logged out now. Please log back in and try deleting your account again.");
                        logout();
                        return;
                      }
                    } catch (reauthError: any) {
                      showMessage('error', reauthError.message || 'Authentication failed. Please log out and log back in.');
                    }
                  } else {
                    showMessage('error', e.message || 'Failed to delete account');
                  }
                } finally {
                  setIsUpdating(false);
                }
              }}
              className="px-4 py-2 bg-brand-red text-white hover:brightness-110 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {isUpdating ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
