import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../models/db';
import { Landmark, ArrowRight, Loader2, Tag, Globe, X, Plus, Sparkles, Send, Bot, CheckCircle2, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTags } from '../hooks/useTags';
import { useCategories } from '../hooks/useCategories';
import { cn } from '../logic/utils';
import { CURRENCY_OPTIONS, CurrencyInfo } from '../constants/currencies';

export default function SetupAccount() {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const { user, updateProfileName } = useAuth();

  // Step 1: Profile & Currency
  const [profileName, setProfileName] = useState(user?.displayName || '');
  const [currency, setCurrency] = useState('$');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Step 2: Account
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [type, setType] = useState<'BANK' | 'CASH' | 'CREDIT_CARD'>('BANK');

  // Step 3 & 5: Classification
  const { tags, addTag, removeTag } = useTags();
  const { categories, addCategory, removeCategory } = useCategories();
  const [newTag, setNewTag] = useState('');
  const [newCat, setNewCat] = useState('');

  // Filter currencies
  const filteredCurrencies = CURRENCY_OPTIONS.filter(c => 
    c.country.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      // Add the account (fallback balance to 0 if empty)
      const balance = parseFloat(startingBalance);
      
      await db.accounts.add({
        bankName: bankName.trim() || 'My Account',
        accountLast4: type === 'CASH' ? '' : (accountLast4 || '0000'),
        startingBalance: isNaN(balance) ? 0 : balance,
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
      alert('An error occurred while saving your setup. Please try again.');
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
      if (!bankName) return;
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
    <div className="flex items-center justify-center gap-2 mb-10">
      {[1, 2, 3, 4, 5].map((s) => (
        <div 
          key={s} 
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            step === s ? "w-10 bg-brand-blue" : step > s ? "w-4 bg-brand-blue/30" : "w-2 bg-neutral-200"
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
              <div className="w-14 h-14 bg-brand-blue/5 border border-brand-blue/10 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Globe className="w-6 h-6 text-brand-blue" />
              </div>
              
              <h1 className="text-3xl font-bold text-neutral-900 mb-2 tracking-tight">
                Welcome to Expensify
              </h1>
              <p className="text-sm font-medium text-neutral-500 mb-8 leading-relaxed">
                Let's personalize your experience. What should we call you, and which currency is used in your country?
              </p>

              <form onSubmit={handleNext} className="flex-1 flex flex-col">
                <div className="space-y-6 flex-1 flex flex-col">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 ml-1">Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue rounded-2xl px-5 py-4 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                      autoFocus
                    />
                  </div>

                  <div className="flex-1 flex flex-col min-h-[300px]">
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 ml-1">Country & Currency</label>
                    
                    <div className="relative mb-3">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text"
                        placeholder="Search country or currency..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                      />
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[300px]">
                      {filteredCurrencies.map(opt => (
                        <button
                          key={opt.country + opt.code}
                          type="button"
                          onClick={() => setCurrency(opt.symbol)}
                          className={cn(
                            "w-full p-4 rounded-xl border flex items-center justify-between transition-all text-left",
                            currency === opt.symbol 
                              ? "bg-brand-blue border-brand-blue text-white shadow-md"
                              : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                          )}
                        >
                          <div>
                            <div className="font-bold text-sm">{opt.country}</div>
                            <div className={cn("text-xs", currency === opt.symbol ? "text-white/80" : "text-neutral-400")}>
                              {opt.name} ({opt.code})
                            </div>
                          </div>
                          <div className={cn("text-xl font-black", currency === opt.symbol ? "text-brand-cyan" : "text-brand-blue")}>
                            {opt.symbol}
                          </div>
                        </button>
                      ))}
                      {filteredCurrencies.length === 0 && (
                        <div className="p-8 text-center text-sm text-neutral-400">
                          No currencies found matching "{searchQuery}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-8 pb-6">
                  <button 
                    type="submit"
                    disabled={!profileName.trim()}
                    className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white h-[56px] rounded-2xl font-bold text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-blue/20 disabled:opacity-50"
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
              <div className="w-14 h-14 bg-brand-blue/5 border border-brand-blue/10 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Landmark className="w-6 h-6 text-brand-blue" />
              </div>
              
              <h1 className="text-3xl font-bold text-neutral-900 mb-2 tracking-tight">
                First Account
              </h1>
              <p className="text-sm font-medium text-neutral-500 mb-8 leading-relaxed">
                Add a bank account, a credit card, or a cash wallet to establish your financial baseline.
              </p>

              <form onSubmit={handleNext} className="flex-1 flex flex-col">
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 ml-1">Account Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['BANK', 'CASH', 'CREDIT_CARD'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={cn(
                            "py-3.5 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                            type === t 
                              ? "bg-brand-blue border-brand-blue text-white shadow-md"
                              : "bg-white border-neutral-200 text-neutral-500 hover:bg-neutral-50"
                          )}
                        >
                          {t.replace('_', ' ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 ml-1">Account Name</label>
                    <input
                      type="text"
                      required
                      placeholder={type === 'CASH' ? 'e.g. Physical Wallet' : 'e.g. Chase Bank'}
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue rounded-2xl px-5 py-4 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                    />
                  </div>

                  {type !== 'CASH' && (
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 ml-1">Last 4 Digits (Optional)</label>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="e.g. 1234"
                        value={accountLast4}
                        onChange={e => setAccountLast4(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue rounded-2xl px-5 py-4 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 ml-1">Current Balance</label>
                    <div className="relative">
                      <span className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-500 font-bold">{currency}</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={startingBalance}
                        onChange={e => setStartingBalance(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue rounded-2xl pl-10 pr-5 py-4 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-8 pb-6">
                  <button 
                    type="submit"
                    disabled={!bankName}
                    className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white h-[56px] rounded-2xl font-bold text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-blue/20 disabled:opacity-50"
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
              <div className="w-14 h-14 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Tag className="w-6 h-6 text-purple-600" />
              </div>
              
              <h1 className="text-3xl font-bold text-neutral-900 mb-2 tracking-tight">
                Tags: A Game Changer
              </h1>
              
              <div className="bg-gradient-to-br from-purple-900 to-brand-blue rounded-3xl p-6 mb-8 shadow-2xl shadow-purple-900/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                  <p className="text-base font-medium text-white/90 leading-relaxed mb-4">
                    Knowing you spent {currency}50 on <span className="font-bold text-white">Food</span> is good...
                  </p>
                  <p className="text-base font-medium text-white/90 leading-relaxed">
                    But knowing {currency}40 of it was an impulsive <span className="bg-white/20 px-2 py-1 rounded-lg text-white font-bold ml-1 border border-white/30 backdrop-blur-sm shadow-sm inline-flex items-center gap-1"><Tag className="w-3 h-3" /> WANT</span> is what actually changes your financial future.
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-[150px]">
                <p className="text-sm font-medium text-neutral-500 mb-4">We've added standard tags for you. Add more if you like!</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {tags.map(tag => (
                    <div key={tag} className="flex items-center gap-2 px-3.5 py-2 bg-white border border-neutral-200 text-neutral-800 rounded-xl text-xs font-bold shadow-sm">
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="text-neutral-400 hover:text-rose-500 transition-colors">
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
                    className="flex-1 bg-neutral-50 border border-neutral-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3.5 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                  />
                  <button type="submit" disabled={!newTag.trim()} className="px-5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all disabled:opacity-50">
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              </div>

              <div className="mt-auto pt-8 pb-6 flex flex-col gap-3">
                <button 
                  onClick={handleNext}
                  className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white h-[56px] rounded-2xl font-bold text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-blue/20"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleNext}
                  className="w-full h-12 rounded-2xl font-bold text-xs text-neutral-400 hover:text-neutral-600 uppercase tracking-widest transition-colors"
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
              <div className="w-14 h-14 bg-brand-cyan/10 border border-brand-cyan/20 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <Sparkles className="w-6 h-6 text-brand-cyan" />
              </div>
              
              <h1 className="text-3xl font-bold text-neutral-900 mb-2 tracking-tight">
                AI Powered Entry
              </h1>
              <p className="text-sm font-medium text-neutral-500 mb-8 leading-relaxed">
                Log transactions naturally using AI. Just type or speak, and let the AI do the heavy lifting.
              </p>

              <div className="bg-neutral-50 border border-neutral-200 rounded-3xl p-5 mb-8 shadow-inner relative overflow-hidden flex-1 flex flex-col justify-center">
                
                {/* Mock User Message */}
                <div className="flex gap-3 mb-6 items-end justify-end">
                  <div className="bg-brand-blue text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-md max-w-[85%]">
                    <p className="text-sm font-medium">Bought a MacBook Pro for {currency}2500 at Apple for work #WANT</p>
                  </div>
                </div>

                {/* Mock AI Response */}
                <div className="flex gap-3 items-end">
                  <div className="w-8 h-8 rounded-full bg-brand-cyan flex flex-shrink-0 items-center justify-center shadow-lg">
                    <Bot className="w-4 h-4 text-brand-blue" />
                  </div>
                  <div className="bg-white border border-neutral-200 text-neutral-800 rounded-2xl rounded-bl-sm p-4 shadow-md max-w-[85%]">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-4 h-4 text-brand-green" />
                      <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Ready to save</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-500">Amount</span>
                        <span className="font-bold text-rose-500">-{currency}2500.00</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-500">Category</span>
                        <span className="font-bold bg-neutral-100 px-2 py-0.5 rounded text-neutral-700">Shopping</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-500">Tag</span>
                        <span className="font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">#WANT</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-neutral-500">Note</span>
                        <span className="font-medium text-neutral-700">MacBook Pro @ Apple</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-4 pb-6 flex flex-col gap-3">
                <button 
                  onClick={handleNext}
                  className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white h-[56px] rounded-2xl font-bold text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-blue/20"
                >
                  Awesome <ArrowRight className="w-4 h-4" />
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
              <div className="w-14 h-14 bg-brand-green/10 border border-brand-green/20 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-brand-green" />
              </div>
              
              <h1 className="text-3xl font-bold text-neutral-900 mb-2 tracking-tight">
                Daily Categories
              </h1>
              <p className="text-sm font-medium text-neutral-500 mb-6 leading-relaxed">
                We've preloaded standard categories for you. You can tailor these exactly to your lifestyle later in Settings.
              </p>

              <div className="flex-1 overflow-y-auto min-h-[200px]">
                <div className="flex flex-wrap gap-2 mb-6">
                  {categories.map(cat => (
                    <div key={cat} className="flex items-center gap-2 px-3.5 py-2 bg-white border border-neutral-200 text-neutral-800 rounded-xl text-xs font-bold shadow-sm">
                      {cat}
                      <button onClick={() => removeCategory(cat)} className="text-neutral-400 hover:text-rose-500 transition-colors">
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
                    className="flex-1 bg-neutral-50 border border-neutral-200 focus:border-brand-green focus:ring-1 focus:ring-brand-green rounded-xl px-4 py-3.5 text-sm font-semibold outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                  />
                  <button type="submit" disabled={!newCat.trim()} className="px-5 bg-brand-green text-white rounded-xl hover:bg-brand-green/90 transition-all disabled:opacity-50">
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              </div>

              <div className="mt-auto pt-8 pb-6 flex flex-col gap-3">
                <button 
                  onClick={handleNext}
                  disabled={isSaving}
                  className="w-full bg-brand-green hover:bg-brand-green/90 text-white h-[56px] rounded-2xl font-bold text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-green/20 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Finalizing...
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
