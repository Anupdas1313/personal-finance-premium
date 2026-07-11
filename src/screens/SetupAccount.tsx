import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../models/db';
import { Landmark, ArrowRight, Loader2, Tag, Globe, X, Plus, Sparkles, Send, Bot, CheckCircle2, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../logic/utils';
import { CURRENCY_OPTIONS, CurrencyInfo } from '../constants/currencies';

export default function SetupAccount() {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const { user, updateProfileName } = useAuth();

  // Step 1: Profile & Currency
  const [profileName, setProfileName] = useState(user?.displayName || '');
  const [selectedCurrency, setSelectedCurrency] = useState(
    CURRENCY_OPTIONS.find(c => c.code === 'USD') || CURRENCY_OPTIONS[0]
  );
  const [currency, setCurrency] = useState('$');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Step 2: Account
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [type, setType] = useState<'BANK' | 'CASH' | 'CREDIT_CARD'>('BANK');

  // Step 3 & 5: Classification
  const [selectedTags, setSelectedTags] = useState<string[]>([
    'Personal', 'Household', 'Miscellaneous', 'Want', 'Need'
  ]);
  const [selectedCats, setSelectedCats] = useState<string[]>([
    'Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Entertainment', 'Salary', 'Groceries', 'Travel', 'Health', 'Other'
  ]);
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
    // Prevent duplicate submissions
    if (isSaving) return;
    setIsSaving(true);
    try {
      await saveUserSetting('currency', currency);
      await saveUserSetting('currency_country', selectedCurrency.country);
      const balance = parseFloat(startingBalance);
      
      await db.accounts.add({
        bankName: bankName.trim() || 'My Account',
        accountLast4: type === 'CASH' ? '' : (accountLast4 || '0000'),
        startingBalance: isNaN(balance) ? 0 : balance,
        startingBalanceDate: new Date(),
        type
      });
      
      // Save tags and categories customized during onboarding
      await db.tags.clear();
      await db.tags.bulkAdd(selectedTags.map((name, index) => ({ name, sortOrder: index })));

      await db.categories.clear();
      await db.categories.bulkAdd(selectedCats.map((name, index) => ({ name, sortOrder: index })));

      // Set localStorage FIRST so ProtectedRoute sees it immediately on navigation
      if (user) {
        localStorage.setItem(`onboardingComplete_${user.uid}`, 'true');
      }
      await saveUserSetting('setupComplete', true);

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
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3, 4, 5].map((s) => (
        <div 
          key={s} 
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            step === s ? "w-10 bg-brand-green" : step > s ? "w-4 bg-brand-green/30" : "w-2 bg-neutral-200"
          )}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-white flex flex-col z-[200] overflow-hidden antialiased">
      <div className="flex-1 flex flex-col max-w-md w-full mx-auto p-5 pt-8 relative h-full">
        {renderStepIndicator()}
        
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col h-full"
            >
              <div className="w-12 h-12 bg-brand-green/5 border border-brand-green/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm flex-shrink-0">
                <Globe className="w-6 h-6 text-brand-green" />
              </div>
              
              <h1 className="text-2xl font-extrabold text-neutral-900 mb-2 tracking-tight flex-shrink-0">
                Welcome to Expensify
              </h1>
              <p className="text-[15px] text-neutral-500 mb-6 flex-shrink-0">
                Let's personalize your experience. What should we call you, and which currency is used in your country?
              </p>

              <form onSubmit={handleNext} className="flex-1 flex flex-col min-h-0">
                <div className="space-y-4 flex-1 flex flex-col min-h-0">
                  <div className="flex-shrink-0">
                    <label className="block text-[13px] font-semibold text-neutral-700 mb-1.5 ml-1">Your Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-green focus:ring-1 focus:ring-brand-green rounded-xl px-4 py-3 text-[15px] font-medium outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                    />
                  </div>

                  <div className="flex-1 flex flex-col min-h-0">
                    <label className="block text-[13px] font-semibold text-neutral-700 mb-1.5 ml-1">Country & Currency</label>
                    
                    <div className="relative mb-2 flex-shrink-0">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input 
                        type="text"
                        placeholder="Search country or currency..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-green focus:ring-1 focus:ring-brand-green rounded-xl pl-10 pr-4 py-3 text-[15px] outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                      />
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 space-y-1.5">
                      {filteredCurrencies.map(opt => {
                        const isSelected = selectedCurrency.code === opt.code && selectedCurrency.country === opt.country;
                        return (
                          <button
                            key={opt.country + opt.code}
                            type="button"
                            onClick={() => {
                              setSelectedCurrency(opt);
                              setCurrency(opt.symbol);
                            }}
                            className={cn(
                              "w-full p-3.5 rounded-xl border flex items-center justify-between transition-all text-left",
                              isSelected 
                                ? "bg-brand-green border-brand-green text-white shadow-md"
                                : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                            )}
                          >
                            <div>
                              <div className="font-semibold text-[15px]">{opt.country}</div>
                              <div className={cn("text-xs font-medium", isSelected ? "text-white/80" : "text-neutral-500")}>
                                {opt.name} ({opt.code})
                              </div>
                            </div>
                            <div className={cn("text-xl font-bold", isSelected ? "text-white" : "text-brand-green")}>
                              {opt.symbol}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-4 pb-2 flex-shrink-0">
                  <button 
                    type="submit"
                    disabled={!profileName.trim()}
                    className="w-full bg-brand-green hover:bg-brand-green/90 text-white h-[52px] rounded-xl font-semibold text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    Continue
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
              className="flex-1 flex flex-col h-full"
            >
              <div className="w-12 h-12 bg-brand-green/5 border border-brand-green/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm flex-shrink-0">
                <Landmark className="w-6 h-6 text-brand-green" />
              </div>
              
              <h1 className="text-2xl font-extrabold text-neutral-900 mb-2 tracking-tight flex-shrink-0">
                First Account
              </h1>
              <p className="text-[15px] text-neutral-500 mb-6 flex-shrink-0">
                Add a bank account, a credit card, or a cash wallet to establish your financial baseline.
              </p>

              <form onSubmit={handleNext} className="flex-1 flex flex-col min-h-0">
                <div className="space-y-4 overflow-y-auto pr-1 pb-4 flex-1">
                  <div>
                    <label className="block text-[13px] font-semibold text-neutral-700 mb-1.5 ml-1">Account Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['BANK', 'CASH', 'CREDIT_CARD'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={cn(
                            "py-3 rounded-xl border text-[13px] font-semibold transition-all",
                            type === t 
                              ? "bg-brand-green border-brand-green text-white shadow-md"
                              : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                          )}
                        >
                          {t === 'CREDIT_CARD' ? 'Credit' : t.charAt(0) + t.slice(1).toLowerCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-semibold text-neutral-700 mb-1.5 ml-1">Account Name</label>
                    <input
                      type="text"
                      required
                      placeholder={type === 'CASH' ? 'e.g. Physical Wallet' : 'e.g. Chase Bank'}
                      value={bankName}
                      onChange={e => setBankName(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-green focus:ring-1 focus:ring-brand-green rounded-xl px-4 py-3 text-[15px] font-medium outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                    />
                  </div>

                  {type !== 'CASH' && (
                    <div>
                      <label className="block text-[13px] font-semibold text-neutral-700 mb-1.5 ml-1">Last 4 Digits <span className="text-neutral-400 font-normal">(Optional)</span></label>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="e.g. 1234"
                        value={accountLast4}
                        onChange={e => setAccountLast4(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-green focus:ring-1 focus:ring-brand-green rounded-xl px-4 py-3 text-[15px] font-medium outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[13px] font-semibold text-neutral-700 mb-1.5 ml-1">Current Balance</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 font-semibold text-[15px]">{currency}</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={startingBalance}
                        onChange={e => setStartingBalance(e.target.value)}
                        className="w-full bg-neutral-50 border border-neutral-200 focus:border-brand-green focus:ring-1 focus:ring-brand-green rounded-xl pl-8 pr-4 py-3 text-[15px] font-medium outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 pb-2 flex-shrink-0">
                  <button 
                    type="submit"
                    disabled={!bankName}
                    className="w-full bg-brand-green hover:bg-brand-green/90 text-white h-[52px] rounded-xl font-semibold text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    Continue
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
              className="flex-1 flex flex-col h-full"
            >
              <div className="w-12 h-12 bg-brand-green/5 border border-brand-green/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm flex-shrink-0">
                <Tag className="w-6 h-6 text-brand-green" />
              </div>
              
              <h1 className="text-2xl font-extrabold text-neutral-900 mb-2 tracking-tight flex-shrink-0">
                Tags: A Game Changer
              </h1>
              
              <div className="bg-brand-green/5 border border-brand-green/10 rounded-2xl p-5 mb-6 shadow-sm relative overflow-hidden flex-shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                  <p className="text-[15px] text-neutral-700 leading-relaxed mb-3">
                    Knowing you spent {currency}50 on <span className="font-semibold text-brand-green">Food</span> is good...
                  </p>
                  <p className="text-[15px] text-neutral-700 leading-relaxed">
                    But knowing {currency}40 of it was an impulsive <span className="bg-white px-1.5 py-0.5 rounded-md text-brand-green font-semibold ml-1 border border-brand-green/20 shadow-sm inline-flex items-center gap-1 text-sm"><Tag className="w-3 h-3" /> WANT</span> is what actually changes your financial future.
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                <p className="text-[14px] text-neutral-500 mb-3">We've added standard tags for you. Add more if you like!</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedTags.map(tag => (
                    <div key={tag} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-200 text-neutral-800 rounded-lg text-[13px] font-semibold shadow-sm">
                      #{tag}
                      <button 
                        type="button" 
                        onClick={() => setSelectedTags(selectedTags.filter(t => t !== tag))} 
                        className="text-neutral-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = newTag.trim();
                    if (trimmed && !selectedTags.includes(trimmed)) {
                      setSelectedTags([...selectedTags, trimmed]);
                      setNewTag('');
                    }
                  }} 
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    placeholder="Add a new tag..."
                    className="flex-1 bg-neutral-50 border border-neutral-200 focus:border-brand-green focus:ring-1 focus:ring-brand-green rounded-xl px-4 py-3 text-[15px] font-medium outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                  />
                  <button type="submit" disabled={!newTag.trim()} className="px-5 bg-brand-green text-white rounded-xl hover:bg-brand-green/90 transition-all disabled:opacity-50">
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              </div>

              <div className="pt-4 pb-2 flex-shrink-0 flex flex-col gap-2">
                <button 
                  onClick={handleNext}
                  className="w-full bg-brand-green hover:bg-brand-green/90 text-white h-[52px] rounded-xl font-semibold text-base flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  Continue
                </button>
                <button 
                  onClick={handleNext}
                  className="w-full h-10 rounded-xl font-medium text-[14px] text-neutral-500 hover:text-neutral-700 transition-colors"
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
              className="flex-1 flex flex-col h-full"
            >
              <div className="w-12 h-12 bg-brand-green/10 border border-brand-green/20 rounded-2xl flex items-center justify-center mb-4 shadow-sm flex-shrink-0">
                <Sparkles className="w-6 h-6 text-brand-green" />
              </div>
              
              <h1 className="text-2xl font-extrabold text-neutral-900 mb-2 tracking-tight flex-shrink-0">
                AI Powered Entry
              </h1>
              <p className="text-[15px] text-neutral-500 mb-6 flex-shrink-0">
                Log transactions naturally using AI. Just type or speak, and let the AI do the heavy lifting.
              </p>

              <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 mb-6 shadow-inner relative overflow-hidden flex-1 flex flex-col justify-center">
                
                {/* Mock User Message */}
                <div className="flex gap-3 mb-5 items-end justify-end">
                  <div className="bg-brand-green text-white rounded-2xl rounded-br-sm px-4 py-2.5 shadow-sm max-w-[85%]">
                    <p className="text-[14px] font-medium">Bought a MacBook Pro for {currency}2500 at Apple for work #WANT</p>
                  </div>
                </div>

                {/* Mock AI Response */}
                <div className="flex gap-3 items-end">
                  <div className="w-7 h-7 rounded-full bg-white border border-brand-green/20 flex flex-shrink-0 items-center justify-center shadow-sm">
                    <Bot className="w-3.5 h-3.5 text-brand-green" />
                  </div>
                  <div className="bg-white border border-neutral-200 text-neutral-800 rounded-2xl rounded-bl-sm p-3.5 shadow-sm max-w-[85%]">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-green" />
                      <span className="text-xs font-bold text-neutral-500">Ready to save</span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[13px]">
                        <span className="text-neutral-500">Amount</span>
                        <span className="font-semibold text-rose-500">-{currency}2500.00</span>
                      </div>
                      <div className="flex justify-between items-center text-[13px]">
                        <span className="text-neutral-500">Category</span>
                        <span className="font-medium bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700">Shopping</span>
                      </div>
                      <div className="flex justify-between items-center text-[13px]">
                        <span className="text-neutral-500">Tag</span>
                        <span className="font-medium bg-brand-green/10 text-brand-green px-1.5 py-0.5 rounded">#WANT</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 pb-2 flex-shrink-0">
                <button 
                  onClick={handleNext}
                  className="w-full bg-brand-green hover:bg-brand-green/90 text-white h-[52px] rounded-xl font-semibold text-base flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  Awesome
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
              className="flex-1 flex flex-col h-full"
            >
              <div className="w-12 h-12 bg-brand-green/10 border border-brand-green/20 rounded-2xl flex items-center justify-center mb-4 shadow-sm flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-brand-green" />
              </div>
              
              <h1 className="text-2xl font-extrabold text-neutral-900 mb-2 tracking-tight flex-shrink-0">
                Daily Categories
              </h1>
              <p className="text-[15px] text-neutral-500 mb-6 flex-shrink-0">
                We've preloaded standard categories for you. You can tailor these exactly to your lifestyle later in Settings.
              </p>

              <div className="flex-1 overflow-y-auto pr-1">
                <div className="flex flex-wrap gap-2 mb-5">
                  {selectedCats.map(cat => (
                    <div key={cat} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-neutral-200 text-neutral-800 rounded-lg text-[13px] font-semibold shadow-sm">
                      {cat}
                      <button 
                        type="button" 
                        onClick={() => setSelectedCats(selectedCats.filter(c => c !== cat))} 
                        className="text-neutral-400 hover:text-rose-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = newCat.trim();
                    if (trimmed && !selectedCats.includes(trimmed)) {
                      setSelectedCats([...selectedCats, trimmed]);
                      setNewCat('');
                    }
                  }} 
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={newCat}
                    onChange={e => setNewCat(e.target.value)}
                    placeholder="Add a new category..."
                    className="flex-1 bg-neutral-50 border border-neutral-200 focus:border-brand-green focus:ring-1 focus:ring-brand-green rounded-xl px-4 py-3 text-[15px] font-medium outline-none transition-all placeholder:text-neutral-400 text-neutral-900"
                  />
                  <button type="submit" disabled={!newCat.trim()} className="px-5 bg-brand-green text-white rounded-xl hover:bg-brand-green/90 transition-all disabled:opacity-50">
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
              </div>

              <div className="pt-4 pb-2 flex-shrink-0">
                <button 
                  onClick={handleNext}
                  disabled={isSaving}
                  className="w-full bg-brand-green hover:bg-brand-green/90 text-white h-[52px] rounded-xl font-semibold text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Finalizing...
                    </>
                  ) : (
                    "Go to Dashboard"
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
