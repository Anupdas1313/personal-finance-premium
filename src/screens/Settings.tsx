import { useState, useRef } from 'react';
import { cn } from '../logic/utils';
import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '../models/db';
import { Download, Upload, Trash2, AlertTriangle, CheckCircle2, Settings as SettingsIcon, X, Moon, Sun, Monitor, Palette, Tag, ShieldAlert, Coins, Sliders, CalendarClock, Database, ArrowUpDown, GripVertical, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { useTags } from '../hooks/useTags';
import { useTheme } from '../components/ThemeProvider';
import { useCurrency } from '../hooks/useCurrency';
import { RecurringBillsManager } from '../components/RecurringBillsManager';
import { CURRENCY_OPTIONS, CurrencyInfo } from '../constants/currencies';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'preferences' | 'organization' | 'automation' | 'data'>('preferences');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [selectedSwapIndex, setSelectedSwapIndex] = useState<number | null>(null);
  const [isTagReorderOpen, setIsTagReorderOpen] = useState(false);
  const [selectedTagSwapIndex, setSelectedTagSwapIndex] = useState<number | null>(null);
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);
  const [isThemeExpanded, setIsThemeExpanded] = useState(false);
  const [isCurrencyExpanded, setIsCurrencyExpanded] = useState(false);
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(false);
  const [isDecimalsExpanded, setIsDecimalsExpanded] = useState(false);
  const [isDefaultAccountExpanded, setIsDefaultAccountExpanded] = useState(false);
  const [isBudgetCycleExpanded, setIsBudgetCycleExpanded] = useState(false);
  
  const { categories, rawCategories, addCategory, removeCategory, resetCategories, updateCategoryOrder } = useCategories();
  const { tags, rawTags, addTag, removeTag, resetTags, updateTagOrder } = useTags();
  const { theme, setTheme } = useTheme();
  const currency = useCurrency();
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const countrySetting = useLiveQuery(
    () => db.userSettings.where('key').equals('currency_country').first()
  );
  const activeCountry = countrySetting?.value || (currency === '₹' ? 'India' : currency === '€' ? 'Eurozone' : currency === '£' ? 'United Kingdom' : 'United States');
  
  const privacySetting = useLiveQuery(
    () => db.userSettings.where('key').equals('privacy_mode').first()
  );
  const isPrivacyMode = privacySetting?.value === true;

  const hideDecimalsSetting = useLiveQuery(
    () => db.userSettings.where('key').equals('hide_decimals').first()
  );
  const isHideDecimals = hideDecimalsSetting?.value === true;

  const defaultAccountSetting = useLiveQuery(
    () => db.userSettings.where('key').equals('default_account_id').first()
  );
  const defaultAccountId = defaultAccountSetting?.value || '';

  const budgetStartDaySetting = useLiveQuery(
    () => db.userSettings.where('key').equals('budget_start_day').first()
  );
  const budgetStartDay = budgetStartDaySetting?.value || 1;
  
  const [currencySearchQuery, setCurrencySearchQuery] = useState('');
  const [newTag, setNewTag] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (isNaN(draggedIndex) || draggedIndex === targetIndex) return;

    const reordered = [...rawCategories];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, draggedItem);

    await updateCategoryOrder(reordered);
  };

  const handleSwapCategory = async (index: number) => {
    if (selectedSwapIndex === null) {
      setSelectedSwapIndex(index);
    } else {
      if (selectedSwapIndex !== index) {
        const reordered = [...rawCategories];
        const temp = reordered[index];
        reordered[index] = reordered[selectedSwapIndex];
        reordered[selectedSwapIndex] = temp;
        await updateCategoryOrder(reordered);
      }
      setSelectedSwapIndex(null);
    }
  };

  const handleTagDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/tag-plain', index.toString());
  };

  const handleTagDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const draggedIndex = parseInt(e.dataTransfer.getData('text/tag-plain'), 10);
    if (isNaN(draggedIndex) || draggedIndex === targetIndex) return;

    const reordered = [...rawTags];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, draggedItem);

    await updateTagOrder(reordered);
  };

  const handleSwapTag = async (index: number) => {
    if (selectedTagSwapIndex === null) {
      setSelectedTagSwapIndex(index);
    } else {
      if (selectedTagSwapIndex !== index) {
        const reordered = [...rawTags];
        const temp = reordered[index];
        reordered[index] = reordered[selectedTagSwapIndex];
        reordered[selectedTagSwapIndex] = temp;
        await updateTagOrder(reordered);
      }
      setSelectedTagSwapIndex(null);
    }
  };

  const handleUpdateCountry = async (opt: CurrencyInfo) => {
    try {
      // Update currency symbol
      const existingSymbol = await db.userSettings.where('key').equals('currency').first();
      if (existingSymbol) {
        await db.userSettings.update(existingSymbol.id!, { value: opt.symbol });
      } else {
        await db.userSettings.add({ key: 'currency', value: opt.symbol });
      }

      // Update currency country
      const existingCountry = await db.userSettings.where('key').equals('currency_country').first();
      if (existingCountry) {
        await db.userSettings.update(existingCountry.id!, { value: opt.country });
      } else {
        await db.userSettings.add({ key: 'currency_country', value: opt.country });
      }
      showMessage('success', `Currency updated to ${opt.name} (${opt.symbol})`);
    } catch (err) {
      console.error(err);
      showMessage('error', 'Failed to update currency settings');
    }
  };
  const handleTogglePrivacy = async () => {
    try {
      const existing = await db.userSettings.where('key').equals('privacy_mode').first();
      if (existing) {
        await db.userSettings.update(existing.id!, { value: !isPrivacyMode });
      } else {
        await db.userSettings.add({ key: 'privacy_mode', value: !isPrivacyMode });
      }
      showMessage('success', `Privacy Mode ${!isPrivacyMode ? 'enabled' : 'disabled'}`);
    } catch (err) {
      showMessage('error', 'Failed to update privacy settings');
    }
  };

  const handleToggleDecimals = async () => {
    try {
      const existing = await db.userSettings.where('key').equals('hide_decimals').first();
      if (existing) {
        await db.userSettings.update(existing.id!, { value: !isHideDecimals });
      } else {
        await db.userSettings.add({ key: 'hide_decimals', value: !isHideDecimals });
      }
      showMessage('success', `Decimals format updated`);
    } catch (err) {
      showMessage('error', 'Failed to update formatting settings');
    }
  };

  const handleUpdateDefaultAccount = async (acctId: string | number) => {
    try {
      const val = acctId === '' ? '' : Number(acctId);
      const existing = await db.userSettings.where('key').equals('default_account_id').first();
      if (existing) {
        await db.userSettings.update(existing.id!, { value: val });
      } else {
        await db.userSettings.add({ key: 'default_account_id', value: val });
      }
      showMessage('success', `Default transaction account updated`);
    } catch (err) {
      showMessage('error', 'Failed to update default account');
    }
  };

  const handleUpdateBudgetStartDay = async (day: number) => {
    try {
      const existing = await db.userSettings.where('key').equals('budget_start_day').first();
      if (existing) {
        await db.userSettings.update(existing.id!, { value: day });
      } else {
        await db.userSettings.add({ key: 'budget_start_day', value: day });
      }
      showMessage('success', `Budget cycle starts on day ${day} of the month`);
    } catch (err) {
      showMessage('error', 'Failed to update budget cycle settings');
    }
  };
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      const transactions = await db.transactions.toArray();
      const accounts = await db.accounts.toArray();
      const budgets = await db.budgets.toArray();
      
      const data = {
        version: 1,
        exportDate: new Date().toISOString(),
        transactions,
        accounts,
        budgets
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `finance-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showMessage('success', 'Data exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      showMessage('error', 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.transactions || !data.accounts) {
        throw new Error('Invalid backup file format');
      }

      const confirmImport = window.confirm(
        'Warning: Importing data will overwrite your current data. Are you sure you want to proceed?'
      );

      if (!confirmImport) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      await db.transaction('rw', db.transactions, db.accounts, db.budgets, async () => {
        await db.transactions.clear();
        await db.accounts.clear();
        await db.budgets.clear();
        
        if (data.accounts.length > 0) {
          await db.accounts.bulkAdd(data.accounts);
        }
        if (data.transactions.length > 0) {
          await db.transactions.bulkAdd(data.transactions);
        }
        if (data.budgets && data.budgets.length > 0) {
          await db.budgets.bulkAdd(data.budgets);
        }
      });

      showMessage('success', 'Data imported successfully');
    } catch (error) {
      console.error('Import error:', error);
      showMessage('error', 'Failed to import data. Please check the file format.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClearData = async () => {
    const confirmClear = window.confirm(
      'DANGER: This will permanently delete all your transactions and accounts. This action cannot be undone. Are you absolutely sure?'
    );

    if (!confirmClear) return;

    try {
      setIsClearing(true);
      await db.transaction('rw', db.transactions, db.accounts, db.budgets, async () => {
        await db.transactions.clear();
        await db.accounts.clear();
        await db.budgets.clear();
      });
      showMessage('success', 'All data has been cleared');
    } catch (error) {
      console.error('Clear data error:', error);
      showMessage('error', 'Failed to clear data');
    } finally {
      setIsClearing(false);
    }
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (addCategory(newCategory)) {
      setNewCategory('');
      showMessage('success', 'Category added successfully');
    } else {
      showMessage('error', 'Category already exists or is invalid');
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (addTag(newTag)) {
      setNewTag('');
      showMessage('success', 'Tag added successfully');
    } else {
      showMessage('error', 'Tag already exists or is invalid');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 bg-neutral-100 dark:bg-[#222222] text-brand-blue dark:text-[#F7F7F7] rounded-2xl border border-brand-blue/5 dark:border-transparent ring-2 ring-brand-cyan/20">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-3xl font-heading font-black text-brand-blue dark:text-[#F7F7F7] tracking-tighter">Settings</h1>
          <p className="text-neutral-400 font-bold mt-0.5 uppercase tracking-widest text-[8px]">Global Control Dashboard</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm text-xs ${
          message.type === 'success' 
            ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' 
            : 'bg-brand-red/10 text-brand-red border border-brand-red/20'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <p className="font-bold">{message.text}</p>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex border-b border-neutral-100 dark:border-[#222222] overflow-x-auto whitespace-nowrap scrollbar-none gap-2 px-1">
        {[
          { id: 'preferences', label: 'Preferences', icon: <Sliders className="w-3.5 h-3.5" /> },
          { id: 'organization', label: 'Organization', icon: <Tag className="w-3.5 h-3.5" /> },
          { id: 'automation', label: 'Automation', icon: <CalendarClock className="w-3.5 h-3.5" /> },
          { id: 'data', label: 'Backup & Danger', icon: <Database className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all rounded-t-xl",
              activeTab === tab.id
                ? "border-brand-green text-brand-green bg-brand-green/5 dark:bg-brand-green/10"
                : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENTS */}
      <div className="mt-4">
        {activeTab === 'preferences' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left duration-300">
            {/* Theme Selector */}
            <section>
              <h2 className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Appearance</h2>
              <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm overflow-hidden">
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => setIsThemeExpanded(!isThemeExpanded)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-[#151518] transition-colors"
                >
                  <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
                    <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                      <Palette className="w-4 h-4 text-brand-blue dark:text-inherit" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">App Theme</p>
                      <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Toggle light, dark, or system mode aesthetics</p>
                    </div>
                  </div>
                  <div className="text-neutral-400 mr-1">
                    {isThemeExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Collapsible Body */}
                {isThemeExpanded && (
                  <div className="border-t border-neutral-100 dark:border-[#222222] p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-xs font-bold",
                          theme === 'light' 
                            ? "border-brand-green bg-brand-green/5 text-brand-green" 
                            : "border-transparent bg-neutral-50 dark:bg-[#1A1A1E] text-neutral-400 hover:bg-neutral-100"
                        )}
                      >
                        <Sun className="w-4 h-4" />
                        <span>Light Mode</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-xs font-bold",
                          theme === 'dark' 
                            ? "border-brand-green bg-brand-green/10 text-brand-green dark:text-[#F7F7F7]" 
                            : "border-transparent bg-neutral-50 dark:bg-[#1A1A1E] text-neutral-400 hover:bg-neutral-100"
                        )}
                      >
                        <Moon className="w-4 h-4" />
                        <span>Dark Mode</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTheme('system')}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-xs font-bold",
                          theme === 'system' 
                            ? "border-brand-green bg-brand-green/10 text-brand-green dark:text-[#F7F7F7]" 
                            : "border-transparent bg-neutral-50 dark:bg-[#1A1A1E] text-neutral-400 hover:bg-neutral-100"
                        )}
                      >
                        <Monitor className="w-4 h-4" />
                        <span>System Settings</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Currency Selector */}
            <section>
              <h2 className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Currency Settings</h2>
              <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm overflow-hidden">
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => setIsCurrencyExpanded(!isCurrencyExpanded)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-[#151518] transition-colors"
                >
                  <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
                    <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                      <Coins className="w-4 h-4 text-brand-blue dark:text-inherit" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">Primary Currency</p>
                      <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Selected country: {activeCountry}</p>
                    </div>
                  </div>
                  <div className="text-neutral-400 mr-1">
                    {isCurrencyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Collapsible Body */}
                {isCurrencyExpanded && (
                  <div className="border-t border-neutral-100 dark:border-[#222222] p-5 flex flex-col">
                    <div className="relative mb-4">
                      <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search country or currency..."
                        value={currencySearchQuery}
                        onChange={e => setCurrencySearchQuery(e.target.value)}
                        className="w-full bg-neutral-50 dark:bg-[#1A1A1E] border border-neutral-100 dark:border-[#222222] focus:border-brand-green focus:ring-1 focus:ring-brand-green rounded-2xl pl-10 pr-4 py-3 text-xs outline-none transition-all placeholder:text-neutral-400 text-neutral-900 dark:text-[#F7F7F7]"
                      />
                    </div>

                    <div className="overflow-y-auto pr-1 space-y-2 max-h-64 scrollbar-thin">
                      {CURRENCY_OPTIONS.filter(opt =>
                        opt.country.toLowerCase().includes(currencySearchQuery.toLowerCase()) || 
                        opt.name.toLowerCase().includes(currencySearchQuery.toLowerCase()) ||
                        opt.code.toLowerCase().includes(currencySearchQuery.toLowerCase())
                      ).map(opt => {
                        const isSelected = activeCountry === opt.country;
                        return (
                          <button
                            key={opt.country + opt.code}
                            type="button"
                            onClick={() => handleUpdateCountry(opt)}
                            className={cn(
                              "w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between",
                              isSelected 
                                ? "bg-brand-green border-brand-green text-white shadow-md shadow-brand-green/10"
                                : "bg-neutral-50 dark:bg-[#1A1A1E] border-transparent text-neutral-700 dark:text-[#F7F7F7] hover:bg-neutral-100 dark:hover:bg-[#22222A]"
                            )}
                          >
                            <div>
                              <div className="font-bold text-xs">{opt.country}</div>
                              <div className={cn("text-[9px] font-medium mt-0.5", isSelected ? "text-white/80" : "text-neutral-400")}>
                                {opt.name} ({opt.code})
                              </div>
                            </div>
                            <div className={cn("text-base font-black", isSelected ? "text-white" : "text-brand-green")}>
                              {opt.symbol}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Privacy Settings */}
            <section>
              <h2 className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Privacy & Security</h2>
              <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm overflow-hidden">
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-[#151518] transition-colors"
                >
                  <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
                    <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                      <ShieldAlert className="w-4 h-4 text-brand-blue dark:text-inherit" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">Privacy Mode</p>
                      <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Status: {isPrivacyMode ? 'Enabled (Balances Hidden)' : 'Disabled'}</p>
                    </div>
                  </div>
                  <div className="text-neutral-400 mr-1">
                    {isPrivacyExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Collapsible Body */}
                {isPrivacyExpanded && (
                  <div className="border-t border-neutral-100 dark:border-[#222222] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-xs text-brand-blue dark:text-[#F7F7F7]">Hide Balances</p>
                        <p className="text-[10px] text-neutral-400 mt-1">Blurs total values and balances on Dashboard and Accounts. Tap to temporarily reveal.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleTogglePrivacy}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all duration-300 relative outline-none",
                          isPrivacyMode ? "bg-brand-green" : "bg-neutral-200 dark:bg-[#2B2B36]"
                        )}
                      >
                        <span 
                          className={cn(
                            "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-md",
                            isPrivacyMode ? "left-6.5" : "left-0.5"
                          )}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Decimal Formatting */}
            <section>
              <h2 className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Number Formatting</h2>
              <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm overflow-hidden">
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => setIsDecimalsExpanded(!isDecimalsExpanded)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-[#151518] transition-colors"
                >
                  <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
                    <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                      <Sliders className="w-4 h-4 text-brand-blue dark:text-inherit" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">Precision & Decimals</p>
                      <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Status: {isHideDecimals ? 'Hide Decimals ($150)' : 'Show Decimals ($150.00)'}</p>
                    </div>
                  </div>
                  <div className="text-neutral-400 mr-1">
                    {isDecimalsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Collapsible Body */}
                {isDecimalsExpanded && (
                  <div className="border-t border-neutral-100 dark:border-[#222222] p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-xs text-brand-blue dark:text-[#F7F7F7]">Hide Decimal Formats</p>
                        <p className="text-[10px] text-neutral-400 mt-1">Rounds decimal amounts to integers globally across reports and balances.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleDecimals}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all duration-300 relative outline-none",
                          isHideDecimals ? "bg-brand-green" : "bg-neutral-200 dark:bg-[#2B2B36]"
                        )}
                      >
                        <span 
                          className={cn(
                            "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-md",
                            isHideDecimals ? "left-6.5" : "left-0.5"
                          )}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Smart Defaults */}
            <section>
              <h2 className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Automation</h2>
              <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm overflow-hidden">
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => setIsDefaultAccountExpanded(!isDefaultAccountExpanded)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-[#151518] transition-colors"
                >
                  <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
                    <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                      <Database className="w-4 h-4 text-brand-blue dark:text-inherit" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">Smart Defaults</p>
                      <p className="text-[10px] font-medium text-neutral-400 mt-0.5">
                        Default Card/Account: {defaultAccountId ? (accounts.find(a => a.id === defaultAccountId)?.bankName || 'Selected') : 'First Account in List'}
                      </p>
                    </div>
                  </div>
                  <div className="text-neutral-400 mr-1">
                    {isDefaultAccountExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Collapsible Body */}
                {isDefaultAccountExpanded && (
                  <div className="border-t border-neutral-100 dark:border-[#222222] p-5">
                    <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-wider mb-2">Default Transaction Account</label>
                    <select
                      value={defaultAccountId}
                      onChange={e => handleUpdateDefaultAccount(e.target.value)}
                      className="w-full bg-neutral-50 dark:bg-[#1A1A1E] border border-neutral-100 dark:border-[#222222] text-neutral-800 dark:text-[#F7F7F7] focus:border-brand-green rounded-xl px-4 py-3 text-xs outline-none transition-all"
                    >
                      <option value="">First Account in List (Default)</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.bankName} {acc.accountLast4 ? `(..${acc.accountLast4})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </section>

            {/* Budget Cycle Start Day */}
            <section>
              <h2 className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Cycle Settings</h2>
              <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm overflow-hidden">
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => setIsBudgetCycleExpanded(!isBudgetCycleExpanded)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-[#151518] transition-colors"
                >
                  <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
                    <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                      <CalendarClock className="w-4 h-4 text-brand-blue dark:text-inherit" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">Budgeting Cycle</p>
                      <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Monthly period starts on day {budgetStartDay}</p>
                    </div>
                  </div>
                  <div className="text-neutral-400 mr-1">
                    {isBudgetCycleExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Collapsible Body */}
                {isBudgetCycleExpanded && (
                  <div className="border-t border-neutral-100 dark:border-[#222222] p-5">
                    <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-wider mb-2">Month Start Day (Payday)</label>
                    <select
                      value={budgetStartDay}
                      onChange={e => handleUpdateBudgetStartDay(Number(e.target.value))}
                      className="w-full bg-neutral-50 dark:bg-[#1A1A1E] border border-neutral-100 dark:border-[#222222] text-neutral-800 dark:text-[#F7F7F7] focus:border-brand-green rounded-xl px-4 py-3 text-xs outline-none transition-all"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>Day {day} of the month</option>
                      ))}
                    </select>
                    <p className="text-[9px] text-neutral-400 mt-2">Shifts the monthly budget calculator queries to start on this date relative to salary cycles.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'organization' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left duration-300">
            {/* Category manager */}
            <section>
              <h2 className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Category Manager</h2>
              <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm overflow-hidden">
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-[#151518] transition-colors"
                >
                  <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
                    <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                      <Tag className="w-4 h-4 text-brand-blue dark:text-inherit" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">Custom Categories</p>
                      <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Manage transaction classification categories ({categories.length} active)</p>
                    </div>
                  </div>
                  <div className="text-neutral-400 mr-1">
                    {isCategoriesExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Collapsible Body */}
                {isCategoriesExpanded && (
                  <div className="p-5 border-t border-neutral-100 dark:border-[#222222] flex flex-col gap-5 animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2 mb-2">
                        {categories.map((category) => (
                          <div key={category} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 dark:bg-[#222222] text-brand-blue dark:text-[#F7F7F7] rounded-full text-xs font-semibold border border-neutral-100 dark:border-[#333333] shadow-sm">
                            {category}
                            <button type="button" onClick={() => removeCategory(category)} className="text-brand-blue/20 dark:text-[#666666] hover:text-brand-red transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <form onSubmit={handleAddCategory} className="flex flex-1 gap-2 w-full">
                          <input
                            type="text"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            placeholder="E.g., Pet Supplies"
                            className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all text-xs font-semibold text-brand-blue dark:text-[#F7F7F7]"
                          />
                          <button
                            type="submit"
                            disabled={!newCategory.trim()}
                            className="px-5 py-2.5 bg-brand-green text-white rounded-xl font-bold hover:brightness-110 transition-all disabled:opacity-50 text-[9px] uppercase tracking-widest shadow-lg shadow-brand-green/10"
                          >
                            Add
                          </button>
                        </form>

                        <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                          <button
                            type="button"
                            onClick={() => setIsReorderOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2.5 border border-brand-green/20 hover:bg-brand-green/5 text-brand-green rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            Arrange Order
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Are you sure you want to restore default categories?')) {
                                resetCategories();
                                showMessage('success', 'Categories reset to default');
                              }
                            }}
                            className="px-4 py-2.5 text-[9px] font-black text-neutral-400 hover:text-brand-blue dark:hover:text-[#F7F7F7] hover:bg-neutral-50 rounded-xl transition-all uppercase tracking-widest"
                          >
                            Restore Defaults
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Tag manager */}
            <section>
              <h2 className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Tag Manager</h2>
              <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm overflow-hidden">
                {/* Collapsible Header */}
                <button
                  type="button"
                  onClick={() => setIsTagsExpanded(!isTagsExpanded)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-[#151518] transition-colors"
                >
                  <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
                    <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                      <Tag className="w-4 h-4 text-brand-blue dark:text-inherit" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">Transaction Tags</p>
                      <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Customize global index hashtag labels ({tags.length} active)</p>
                    </div>
                  </div>
                  <div className="text-neutral-400 mr-1">
                    {isTagsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Collapsible Body */}
                {isTagsExpanded && (
                  <div className="p-5 border-t border-neutral-100 dark:border-[#222222] flex flex-col gap-5 animate-in fade-in slide-in-from-top-4 duration-200">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <div key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-50 dark:bg-[#222222] text-brand-blue dark:text-[#F7F7F7] rounded-full text-xs font-semibold border border-neutral-100 dark:border-[#333333] shadow-sm">
                            #{tag}
                            <button type="button" onClick={() => removeTag(tag)} className="text-brand-blue/20 dark:text-[#666666] hover:text-brand-red transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <form onSubmit={handleAddTag} className="flex flex-1 gap-2 w-full">
                          <input
                            type="text"
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            placeholder="E.g., Business, Urgent"
                            className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/20 transition-all text-xs font-semibold text-brand-blue dark:text-[#F7F7F7]"
                          />
                          <button
                            type="submit"
                            disabled={!newTag.trim()}
                            className="px-5 py-2.5 bg-brand-green text-white rounded-xl font-bold hover:brightness-110 transition-all disabled:opacity-50 text-[9px] uppercase tracking-widest shadow-lg shadow-brand-green/10"
                          >
                            Add
                          </button>
                        </form>

                        <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                          <button
                            type="button"
                            onClick={() => setIsTagReorderOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2.5 border border-brand-green/20 hover:bg-brand-green/5 text-brand-green rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            Arrange Order
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Are you sure you want to restore default tags?')) {
                                resetTags();
                                showMessage('success', 'Tags reset to default');
                              }
                            }}
                            className="px-4 py-2.5 text-[9px] font-black text-neutral-400 hover:text-brand-blue dark:hover:text-[#F7F7F7] hover:bg-neutral-50 rounded-xl transition-all uppercase tracking-widest"
                          >
                            Restore Defaults
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'automation' && (
          <div className="animate-in fade-in slide-in-from-left duration-300">
            <RecurringBillsManager />
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-left duration-300">
            {/* Backup/Restore */}
            <section>
              <h2 className="text-[10px] font-semibold text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Backup & Recovery</h2>
              <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm overflow-hidden divide-y divide-neutral-100 dark:divide-[#222222]">
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
                    <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                      <Download className="w-4 h-4 text-brand-blue dark:text-inherit" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">Export Backup File</p>
                      <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Download your accounts and transactions as a JSON file</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportData}
                    disabled={isExporting}
                    className="px-5 py-2.5 bg-white dark:bg-[#111111] border border-neutral-200 dark:border-[#333333] hover:bg-neutral-50 dark:hover:bg-[#222222] text-neutral-600 dark:text-neutral-400 rounded-xl font-bold transition-all disabled:opacity-50 text-[9px] uppercase tracking-widest w-full sm:w-auto text-center shadow-sm"
                  >
                    {isExporting ? 'Exporting...' : 'Export JSON'}
                  </button>
                </div>

                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
                    <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                      <Upload className="w-4 h-4 text-brand-blue dark:text-inherit" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-brand-blue dark:text-[#F7F7F7]">Restore from Backup</p>
                      <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Upload a backup JSON file to restore your database</p>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto">
                    <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportData} className="hidden" id="import-file" />
                    <label
                      htmlFor="import-file"
                      className={`block w-full sm:w-auto px-5 py-2.5 bg-white dark:bg-[#111111] border border-neutral-200 dark:border-[#333333] hover:bg-neutral-50 dark:hover:bg-[#222222] text-neutral-600 dark:text-neutral-400 rounded-xl font-bold transition-all cursor-pointer text-center text-[9px] uppercase tracking-widest shadow-sm ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {isImporting ? 'Importing...' : 'Import JSON'}
                    </label>
                  </div>
                </div>
              </div>
            </section>

            {/* Danger Zone */}
            <section>
              <h2 className="text-[10px] font-semibold text-brand-red uppercase tracking-[0.2em] mb-4 px-2">Danger Zone</h2>
              <div className="bg-brand-red/5 rounded-[24px] border border-brand-red/10 overflow-hidden divide-y divide-brand-red/10">
                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-brand-red">
                    <div className="p-2.5 bg-brand-red/10 rounded-xl flex-shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-brand-red">Purge Local Storage</p>
                      <p className="text-[10px] font-medium text-brand-red/60 mt-0.5">Wipe IndexedDB browser storage (WARNING: Permanent data loss)</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearData}
                    disabled={isClearing}
                    className="px-5 py-2.5 bg-brand-red text-white rounded-xl font-bold hover:brightness-110 transition-all disabled:opacity-50 text-[9px] uppercase tracking-widest w-full sm:w-auto flex justify-center items-center gap-2 shadow-lg shadow-brand-red/10"
                  >
                    <Trash2 className="w-3.5 h-3.5"/>
                    {isClearing ? 'Purging...' : 'Purge Database'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* REORDER CATEGORIES MODAL OVERLAY */}
      {isReorderOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111111] w-full max-w-md rounded-[32px] border border-neutral-100 dark:border-[#222222] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-100 dark:border-[#222222] flex items-center justify-between">
              <div>
                <h3 className="font-heading font-black text-base text-brand-blue dark:text-white tracking-tight flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-brand-green" />
                  Arrange Categories
                </h3>
                <p className="text-[9px] text-neutral-400 font-bold mt-0.5">Drag & drop or tap two items to swap their positions</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsReorderOpen(false);
                  setSelectedSwapIndex(null);
                }}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#222222] hover:bg-neutral-200 dark:hover:bg-[#333333] flex items-center justify-center text-neutral-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-2 flex-1 scrollbar-none">
              {rawCategories.map((category, index) => {
                const isSelected = selectedSwapIndex === index;
                return (
                  <div
                    key={category.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    onClick={() => handleSwapCategory(index)}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl text-xs font-bold transition-all border cursor-pointer select-none group",
                      isSelected
                        ? "border-brand-green bg-brand-green/5 text-brand-green ring-2 ring-brand-green/20"
                        : "border-neutral-100 dark:border-white/5 bg-neutral-50 dark:bg-[#1A1A1E] text-brand-blue dark:text-white hover:bg-neutral-100 dark:hover:bg-[#222222]"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-neutral-300 dark:text-neutral-600 group-hover:text-brand-green select-none shrink-0"><GripVertical className="w-3.5 h-3.5" /></span>
                      <span className="truncate">{category.name}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[7px] font-black uppercase tracking-widest bg-brand-green/10 px-2 py-0.5 rounded-full">
                        Swap Source
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-neutral-50 dark:bg-[#151515] border-t border-neutral-100 dark:border-[#222222] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsReorderOpen(false);
                  setSelectedSwapIndex(null);
                }}
                className="px-6 py-2 bg-brand-green text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all text-[9px] uppercase tracking-widest shadow-lg shadow-brand-green/10"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REORDER TAGS MODAL OVERLAY */}
      {isTagReorderOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#111111] w-full max-w-md rounded-[32px] border border-neutral-100 dark:border-[#222222] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-100 dark:border-[#222222] flex items-center justify-between">
              <div>
                <h3 className="font-heading font-black text-base text-brand-blue dark:text-white tracking-tight flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-brand-green" />
                  Arrange Tags
                </h3>
                <p className="text-[9px] text-neutral-400 font-bold mt-0.5">Drag & drop or tap two items to swap their positions</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTagReorderOpen(false);
                  setSelectedTagSwapIndex(null);
                }}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-[#222222] hover:bg-neutral-200 dark:hover:bg-[#333333] flex items-center justify-center text-neutral-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-2 flex-1 scrollbar-none">
              {rawTags.map((tag, index) => {
                const isSelected = selectedTagSwapIndex === index;
                return (
                  <div
                    key={tag.id}
                    draggable
                    onDragStart={(e) => handleTagDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleTagDrop(e, index)}
                    onClick={() => handleSwapTag(index)}
                    className={cn(
                      "flex items-center justify-between p-3.5 rounded-xl text-xs font-bold transition-all border cursor-pointer select-none group",
                      isSelected
                        ? "border-brand-green bg-brand-green/5 text-brand-green ring-2 ring-brand-green/20"
                        : "border-neutral-100 dark:border-white/5 bg-neutral-50 dark:bg-[#1A1A1E] text-brand-blue dark:text-white hover:bg-neutral-100 dark:hover:bg-[#222222]"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-neutral-300 dark:text-neutral-600 group-hover:text-brand-green select-none shrink-0"><GripVertical className="w-3.5 h-3.5" /></span>
                      <span className="truncate">#{tag.name}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[7px] font-black uppercase tracking-widest bg-brand-green/10 px-2 py-0.5 rounded-full">
                        Swap Source
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-neutral-50 dark:bg-[#151515] border-t border-neutral-100 dark:border-[#222222] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsTagReorderOpen(false);
                  setSelectedTagSwapIndex(null);
                }}
                className="px-6 py-2 bg-brand-green text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all text-[9px] uppercase tracking-widest shadow-lg shadow-brand-green/10"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
