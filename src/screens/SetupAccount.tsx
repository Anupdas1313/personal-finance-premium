import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../models/db';
import { Landmark, ArrowRight, Loader2, User, Tag, Globe, X, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTags } from '../hooks/useTags';
import { useCategories } from '../hooks/useCategories';
import { cn } from '../logic/utils';

const CURRENCY_OPTIONS = [
  { symbol: '$', name: 'US Dollar', code: 'USD' },
  { symbol: '₹', name: 'Indian Rupee', code: 'INR' },
  { symbol: '€', name: 'Euro', code: 'EUR' },
  { symbol: '£', name: 'British Pound', code: 'GBP' },
  { symbol: '¥', name: 'Japanese Yen', code: 'JPY' },
  { symbol: 'A$', name: 'Australian Dollar', code: 'AUD' },
  { symbol: 'C$', name: 'Canadian Dollar', code: 'CAD' }
];

export default function SetupAccount() {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const { user, updateProfileName } = useAuth();

  // Step 1: Profile & Currency
  const [profileName, setProfileName] = useState(user?.displayName || '');
  const [currency, setCurrency] = useState('$');

  // Step 2: Account
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [type, setType] = useState<'BANK' | 'CASH' | 'CREDIT_CARD'>('BANK');

  // Step 3 & 4: Classification
  const { tags, addTag, removeTag } = useTags();
  const { categories, addCategory, removeCategory } = useCategories();
  const [newTag, setNewTag] = useState('');
  const [newCat, setNewCat] = useState('');

  const saveUserSetting = async (key: string, value: any) => {
    const existing = await db.userSettings.where('key').equals(key).first();
    if (existing && existing.id) {
      await db.userSettings.update(existing.id, { value });
    } else {
      await db.userSettings.add({ key, value });
    }
  };

  const completeSetup = async () => {
    setIsSaving(true);
    try {
      // Save global currency preference
      await saveUserSetting('currency', currency);

      // Add the account
      await db.accounts.add({
        bankName,
        accountLast4: accountLast4 || '0000',
        startingBalance: Number(startingBalance),
        startingBalanceDate: new Date(),
        type
      });

      // Mark setup as complete
      if (user) {
        localStorage.setItem(`onboardingComplete_${user.uid}`, 'true');
        await saveUserSetting('setupComplete', true);
      }

      // Go to dashboard
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Failed to setup account:', error);
      setIsSaving(false);
    }
  };

  const handleNext = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (step === 1) {
      if (profileName.trim()) {
        await updateProfileName(profileName.trim());
      }
      setStep(2);
    } else if (step === 2) {
      if (!bankName || !startingBalance) return;
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      await completeSetup();
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-10">
      {[1, 2, 3, 4].map((s) => (
        <div 
          key={s} 
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            step === s ? "w-10 bg-[#1A1A1A]" : step > s ? "w-4 bg-[#1A1A1A]/30" : "w-2 bg-[#F2F2F2]"
          )}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-white flex flex-col z-[200] overflow-y-auto antialiased">
      <div className="flex-1 flex flex-col max-w-md w-full mx-auto p-6 pt-12 relative">
        {renderStepIndicator()}
        
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="w-14 h-14 bg-[#F7F7F7] border border-[#EBEBEB] rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Globe className="w-6 h-6 text-[#1A1A1A]" />
              </div>
              
              <h1 className="text-3xl font-bold text-[#1A1A1A] mb-2 tracking-tight">
                Welcome to Expensify
              </h1>
              <p className="text-sm font-medium text-[#737373] mb-8 leading-relaxed">
                Let's personalize your experience. What should we call you, and which currency do you prefer?
              </p>

              <form onSubmit={handleNext} className="flex-1 flex flex-col">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-[#A3A3A3] uppercase tracking-widest mb-2 ml-1">Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      className="w-full bg-[#F7F7F7] border border-[#EBEBEB] focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] rounded-2xl px-5 py-4 text-sm font-semibold outline-none transition-all placeholder:text-[#A3A3A3] text-[#1A1A1A]"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#A3A3A3] uppercase tracking-widest mb-2 ml-1">Currency</label>
                    <div className="grid grid-cols-4 gap-2">
                      {CURRENCY_OPTIONS.map(opt => (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => setCurrency(opt.symbol)}
                          className={cn(
                            "py-4 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all",
                            currency === opt.symbol 
                              ? "bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-md"
                              : "bg-[#F7F7F7] border-[#EBEBEB] text-[#737373] hover:bg-[#F2F2F2]"
                          )}
                        >
                          <span className="text-lg font-bold leading-none">{opt.symbol}</span>
                          <span className="text-[9px] font-bold uppercase tracking-widest opacity-70">{opt.code}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-8 pb-6">
                  <button 
                    type="submit"
                    disabled={!profileName.trim()}
                    className="w-full bg-[#1A1A1A] hover:bg-black text-white h-[56px] rounded-2xl font-bold text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="w-14 h-14 bg-[#F7F7F7] border border-[#EBEBEB] rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Landmark className="w-6 h-6 text-[#1A1A1A]" />
              </div>
              
              <h1 className="text-3xl font-bold text-[#1A1A1A] mb-2 tracking-tight">
                First Account
              </h1>
              <p className="text-sm font-medium text-[#737373] mb-8 leading-relaxed">
                Add a bank account, a credit card, or a cash wallet to establish your financial baseline.
              </p>

              <form onSubmit={handleNext} className="flex-1 flex flex-col">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-[#A3A3A3] uppercase tracking-widest mb-2 ml-1">Account Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['BANK', 'CASH', 'CREDIT_CARD'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={cn(
                            "py-3.5 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                            type === t 
                              ? "bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-md"
                              : "bg-[#F7F7F7] border-[#EBEBEB] text-[#737373] hover:bg-[#F2F2F2]"
                          )}
                        >
                          {t.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#A3A3A3] uppercase tracking-widest mb-2 ml-1">Account Name</label>
                    <input
                      type="text"
                      required
                      placeholder={type === 'CASH' ? 'e.g. Physical Wallet' : 'e.g. Chase Bank'}
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      className="w-full bg-[#F7F7F7] border border-[#EBEBEB] focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] rounded-2xl px-5 py-4 text-sm font-semibold outline-none transition-all placeholder:text-[#A3A3A3] text-[#1A1A1A]"
                    />
                  </div>

                  {type !== 'CASH' && (
                    <div>
                      <label className="block text-[10px] font-bold text-[#A3A3A3] uppercase tracking-widest mb-2 ml-1">Last 4 Digits (Optional)</label>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="e.g. 1234"
                        value={accountLast4}
                        onChange={e => setAccountLast4(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-[#F7F7F7] border border-[#EBEBEB] focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] rounded-2xl px-5 py-4 text-sm font-semibold outline-none transition-all placeholder:text-[#A3A3A3] text-[#1A1A1A]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-[#A3A3A3] uppercase tracking-widest mb-2 ml-1">Current Balance</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#737373] font-bold">{currency}</span>
                      <input
                        type="number"
                        required
                        placeholder="0.00"
                        value={startingBalance}
                        onChange={e => setStartingBalance(e.target.value)}
                        className="w-full bg-[#F7F7F7] border border-[#EBEBEB] focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] rounded-2xl pl-10 pr-5 py-4 text-sm font-semibold outline-none transition-all placeholder:text-[#A3A3A3] text-[#1A1A1A]"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-8 pb-6">
                  <button 
                    type="submit"
                    disabled={!bankName || !startingBalance}
                    className="w-full bg-[#1A1A1A] hover:bg-black text-white h-[56px] rounded-2xl font-bold text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="w-14 h-14 bg-[#F7F7F7] border border-[#EBEBEB] rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Tag className="w-6 h-6 text-[#1A1A1A]" />
              </div>
              
              <h1 className="text-3xl font-bold text-[#1A1A1A] mb-2 tracking-tight">
                Classification Tags
              </h1>
              
              <div className="bg-[#1A1A1A] rounded-2xl p-5 mb-6 shadow-lg shadow-black/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                <h3 className="text-[10px] font-bold text-white/50 uppercase tracking-[0.2em] mb-2">A Game Changer</h3>
                <p className="text-sm font-medium text-white/90 leading-relaxed relative z-10">
                  Tags transcend basic categories by measuring the <span className="text-white font-bold italic">why</span> behind your spending. Knowing you spent {currency}50 on 'Food' is good; knowing {currency}40 of it was an impulsive <span className="bg-white/20 px-1.5 py-0.5 rounded text-white font-bold">#WANT</span> is a game-changer.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto min-h-[200px]">
                <div className="flex flex-wrap gap-2 mb-6">
                  {tags.map(tag => (
                    <div key={tag} className="flex items-center gap-2 px-3.5 py-2 bg-[#F7F7F7] border border-[#EBEBEB] text-[#1A1A1A] rounded-xl text-xs font-bold shadow-sm">
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="text-[#A3A3A3] hover:text-rose-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (addTag(newTag)) setNewTag('');
                  }} 
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    placeholder="Add a new tag..."
                    className="flex-1 bg-[#F7F7F7] border border-[#EBEBEB] focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] rounded-xl px-4 py-3.5 text-sm font-semibold outline-none transition-all placeholder:text-[#A3A3A3] text-[#1A1A1A]"
                  />
                  <button type="submit" disabled={!newTag.trim()} className="px-5 bg-[#1A1A1A] text-white rounded-xl hover:bg-black transition-all disabled:opacity-50">
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              </div>

              <div className="mt-auto pt-8 pb-6 flex flex-col gap-3">
                <button 
                  onClick={handleNext}
                  className="w-full bg-[#1A1A1A] hover:bg-black text-white h-[56px] rounded-2xl font-bold text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-black/10"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleNext}
                  className="w-full h-12 rounded-2xl font-bold text-xs text-[#A3A3A3] hover:text-[#1A1A1A] uppercase tracking-widest transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="w-14 h-14 bg-[#F7F7F7] border border-[#EBEBEB] rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Tag className="w-6 h-6 text-[#1A1A1A]" />
              </div>
              
              <h1 className="text-3xl font-bold text-[#1A1A1A] mb-2 tracking-tight">
                Daily Categories
              </h1>
              <p className="text-sm font-medium text-[#737373] mb-6 leading-relaxed">
                We've preloaded standard categories for you. You can tailor these exactly to your lifestyle, and edit them later in Settings.
              </p>

              <div className="flex-1 overflow-y-auto min-h-[200px]">
                <div className="flex flex-wrap gap-2 mb-6">
                  {categories.map(cat => (
                    <div key={cat} className="flex items-center gap-2 px-3.5 py-2 bg-[#F7F7F7] border border-[#EBEBEB] text-[#1A1A1A] rounded-xl text-xs font-bold shadow-sm">
                      {cat}
                      <button onClick={() => removeCategory(cat)} className="text-[#A3A3A3] hover:text-rose-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (addCategory(newCat)) setNewCat('');
                  }} 
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={newCat}
                    onChange={e => setNewCat(e.target.value)}
                    placeholder="Add a new category..."
                    className="flex-1 bg-[#F7F7F7] border border-[#EBEBEB] focus:border-[#1A1A1A] focus:ring-1 focus:ring-[#1A1A1A] rounded-xl px-4 py-3.5 text-sm font-semibold outline-none transition-all placeholder:text-[#A3A3A3] text-[#1A1A1A]"
                  />
                  <button type="submit" disabled={!newCat.trim()} className="px-5 bg-[#1A1A1A] text-white rounded-xl hover:bg-black transition-all disabled:opacity-50">
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              </div>

              <div className="mt-auto pt-8 pb-6 flex flex-col gap-3">
                <button 
                  onClick={handleNext}
                  disabled={isSaving}
                  className="w-full bg-[#1A1A1A] hover:bg-black text-white h-[56px] rounded-2xl font-bold text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-black/10 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entering Dashboard...
                    </>
                  ) : (
                    <>
                      Go to Dashboard <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
