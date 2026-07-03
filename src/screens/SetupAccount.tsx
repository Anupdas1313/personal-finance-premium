import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../models/db';
import { Landmark, ArrowRight, Loader2, User, Tag, Sparkles, X, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTags } from '../hooks/useTags';
import { useCategories } from '../hooks/useCategories';

export default function SetupAccount() {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const { user, updateProfileName } = useAuth();

  // Step 1: Profile
  const [profileName, setProfileName] = useState(user?.displayName || '');

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

  const completeSetup = async () => {
    setIsSaving(true);
    try {
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
        await db.userSettings.put({ key: 'setupComplete', value: true });
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
      setStep(5);
    } else if (step === 5) {
      await completeSetup();
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3, 4, 5].map((s) => (
        <div 
          key={s} 
          className={`h-1.5 rounded-full transition-all duration-300 ${
            step === s 
              ? 'w-8 bg-brand-blue dark:bg-brand-cyan' 
              : step > s 
                ? 'w-4 bg-brand-blue/50 dark:bg-brand-cyan/50' 
                : 'w-2 bg-neutral-200 dark:bg-[#222222]'
          }`} 
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-white dark:bg-[#060608] flex flex-col z-[200] overflow-y-auto">
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
              <div className="w-16 h-16 bg-brand-blue/10 dark:bg-brand-cyan/10 rounded-2xl flex items-center justify-center mb-6">
                <User className="w-8 h-8 text-brand-blue dark:text-brand-cyan" />
              </div>
              
              <h1 className="text-3xl font-black text-brand-blue dark:text-white mb-2 tracking-tight">
                What should we call you?
              </h1>
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
                Let's personalize your experience. You can always change this later in your profile settings.
              </p>

              <form onSubmit={handleNext} className="flex-1 flex flex-col">
                <div className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-brand-blue dark:focus:border-brand-cyan/50 rounded-xl px-4 py-3.5 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 dark:text-white"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="mt-auto pt-8 pb-6">
                  <button 
                    type="submit"
                    disabled={!profileName.trim()}
                    className="w-full bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue h-14 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-blue/20 dark:shadow-brand-cyan/10 disabled:opacity-50"
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
              <div className="w-16 h-16 bg-brand-blue/10 dark:bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                <Landmark className="w-8 h-8 text-brand-blue dark:text-white" />
              </div>
              
              <h1 className="text-3xl font-black text-brand-blue dark:text-white mb-2 tracking-tight">
                Set up your first account
              </h1>
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
                Expensify needs an account to track your money. You can add a bank account, a credit card, or just a cash wallet.
              </p>

              <form onSubmit={handleNext} className="flex-1 flex flex-col">
                <div className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Account Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['BANK', 'CASH', 'CREDIT_CARD'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            type === t 
                              ? 'bg-brand-blue dark:bg-white text-white dark:text-brand-blue shadow-lg shadow-brand-blue/20 dark:shadow-white/10' 
                              : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-white/10'
                          }`}
                        >
                          {t.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Account Name</label>
                    <input
                      type="text"
                      required
                      placeholder={type === 'CASH' ? 'e.g. Physical Wallet' : 'e.g. Chase Bank'}
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-brand-blue dark:focus:border-white/20 rounded-xl px-4 py-3.5 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 dark:text-white"
                    />
                  </div>

                  {type !== 'CASH' && (
                    <div>
                      <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Last 4 Digits (Optional)</label>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="e.g. 1234"
                        value={accountLast4}
                        onChange={e => setAccountLast4(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-brand-blue dark:focus:border-white/20 rounded-xl px-4 py-3.5 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 dark:text-white"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 ml-1">Current Balance</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-semibold">$</span>
                      <input
                        type="number"
                        required
                        placeholder="0.00"
                        value={startingBalance}
                        onChange={e => setStartingBalance(e.target.value)}
                        className="w-full bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-brand-blue dark:focus:border-white/20 rounded-xl pl-8 pr-4 py-3.5 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-8 pb-6">
                  <button 
                    type="submit"
                    disabled={!bankName || !startingBalance}
                    className="w-full bg-brand-blue dark:bg-white text-white dark:text-brand-blue h-14 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-blue/20 dark:shadow-white/10 disabled:opacity-50"
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
              <div className="w-16 h-16 bg-brand-purple/10 dark:bg-[#7C3AED]/20 rounded-2xl flex items-center justify-center mb-6">
                <Tag className="w-8 h-8 text-brand-purple dark:text-[#A78BFA]" />
              </div>
              
              <h1 className="text-3xl font-black text-brand-blue dark:text-white mb-2 tracking-tight">
                Classification Tags
              </h1>
              <div className="bg-brand-purple/5 dark:bg-[#7C3AED]/10 border border-brand-purple/10 dark:border-[#7C3AED]/20 rounded-2xl p-4 mb-6">
                <p className="text-sm font-semibold text-brand-purple dark:text-[#A78BFA] leading-relaxed">
                  <span className="font-black uppercase tracking-wider text-[10px] block mb-1">A Game Changer</span>
                  Tags like <span className="px-1.5 py-0.5 bg-brand-purple/20 rounded mx-0.5">#NEED</span> and <span className="px-1.5 py-0.5 bg-brand-purple/20 rounded mx-0.5">#WANT</span> transcend basic categories. They allow you to instantly visualize exactly how much of your spending was necessary versus impulsive, giving you unparalleled clarity over your financial habits.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto min-h-[200px]">
                <div className="flex flex-wrap gap-2 mb-6">
                  {tags.map(tag => (
                    <div key={tag} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-[#1A1A1E] text-brand-blue dark:text-white rounded-xl text-sm font-semibold border border-transparent shadow-sm">
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="text-neutral-400 hover:text-rose-500 transition-colors">
                        <X className="w-4 h-4" />
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
                    className="flex-1 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-brand-purple dark:focus:border-[#7C3AED]/50 rounded-xl px-4 py-3 text-sm font-semibold outline-none transition-all dark:text-white"
                  />
                  <button type="submit" disabled={!newTag.trim()} className="px-4 bg-brand-purple dark:bg-[#7C3AED] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              </div>

              <div className="mt-auto pt-8 pb-6 flex flex-col gap-3">
                <button 
                  onClick={handleNext}
                  className="w-full bg-brand-blue dark:bg-white text-white dark:text-brand-blue h-14 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-blue/20 dark:shadow-white/10"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleNext}
                  className="w-full h-12 rounded-2xl font-bold text-xs text-neutral-500 hover:text-brand-blue dark:hover:text-white uppercase tracking-widest transition-colors"
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
              <div className="w-16 h-16 bg-brand-green/10 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6">
                <Tag className="w-8 h-8 text-brand-green dark:text-emerald-400" />
              </div>
              
              <h1 className="text-3xl font-black text-brand-blue dark:text-white mb-2 tracking-tight">
                Daily Categories
              </h1>
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed">
                We've preloaded standard categories for you. You can tailor these exactly to your lifestyle, and edit them later in Settings.
              </p>

              <div className="flex-1 overflow-y-auto min-h-[200px]">
                <div className="flex flex-wrap gap-2 mb-6">
                  {categories.map(cat => (
                    <div key={cat} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 dark:bg-[#1A1A1E] text-brand-blue dark:text-white rounded-xl text-sm font-semibold border border-transparent shadow-sm">
                      {cat}
                      <button onClick={() => removeCategory(cat)} className="text-neutral-400 hover:text-rose-500 transition-colors">
                        <X className="w-4 h-4" />
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
                    className="flex-1 bg-neutral-100 dark:bg-white/5 border border-transparent focus:border-brand-green dark:focus:border-emerald-500/50 rounded-xl px-4 py-3 text-sm font-semibold outline-none transition-all dark:text-white"
                  />
                  <button type="submit" disabled={!newCat.trim()} className="px-4 bg-brand-green dark:bg-emerald-500 text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              </div>

              <div className="mt-auto pt-8 pb-6 flex flex-col gap-3">
                <button 
                  onClick={handleNext}
                  className="w-full bg-brand-blue dark:bg-white text-white dark:text-brand-blue h-14 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-blue/20 dark:shadow-white/10"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleNext}
                  className="w-full h-12 rounded-2xl font-bold text-xs text-neutral-500 hover:text-brand-blue dark:hover:text-white uppercase tracking-widest transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-brand-blue to-brand-cyan rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-brand-blue/20">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              
              <h1 className="text-3xl font-black text-brand-blue dark:text-white mb-2 tracking-tight">
                AI Powered Entry
              </h1>
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-8 leading-relaxed">
                Skip the manual forms. Just tell our AI what you spent, and it will magically categorize, tag, and log your transaction.
              </p>

              <div className="flex-1 flex items-center justify-center py-8">
                {/* AI Chat Animation Mockup */}
                <div className="w-full max-w-[280px] space-y-4">
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    className="bg-brand-blue text-white rounded-2xl rounded-tr-sm p-4 text-sm font-medium self-end ml-auto w-fit shadow-md"
                  >
                    "Spent $24 on Uber to work"
                  </motion.div>
                  
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2, duration: 0.4 }}
                    className="flex gap-2 items-center"
                  >
                    <div className="w-6 h-6 rounded-full bg-brand-cyan/20 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3 h-3 text-brand-cyan" />
                    </div>
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ delay: 1.2, duration: 1.5, ease: "linear" }}
                      className="h-1 bg-brand-cyan/20 rounded-full overflow-hidden"
                    >
                      <div className="h-full bg-brand-cyan w-full origin-left animate-pulse" />
                    </motion.div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 2.8, duration: 0.5, type: "spring" }}
                    className="bg-white dark:bg-[#1A1A1E] border border-neutral-100 dark:border-white/5 rounded-2xl p-4 shadow-xl shadow-brand-blue/5 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-brand-blue dark:text-white text-sm">Uber to work</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 dark:bg-white/5 px-2 py-0.5 rounded uppercase">Transport</span>
                        <span className="text-[10px] font-bold text-brand-purple bg-brand-purple/10 px-2 py-0.5 rounded uppercase">#NEED</span>
                      </div>
                    </div>
                    <p className="font-black text-rose-500">-$24.00</p>
                  </motion.div>
                </div>
              </div>

              <div className="mt-auto pt-8 pb-6">
                <button 
                  onClick={handleNext}
                  disabled={isSaving}
                  className="w-full bg-gradient-to-r from-brand-blue to-brand-cyan hover:brightness-110 text-white h-14 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-blue/20 disabled:opacity-50"
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
