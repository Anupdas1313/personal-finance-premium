import { useState, useRef } from 'react';
import { cn } from '../lib/utils';

import { db } from '../lib/db';
import { Download, Upload, Trash2, AlertTriangle, CheckCircle2, Settings as SettingsIcon, X, Moon, Sun, Monitor, Palette, Tag, ShieldAlert } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { useTheme } from '../components/ThemeProvider';

export default function Settings() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [newCategory, setNewCategory] = useState('');
  
  const { categories, addCategory, removeCategory, resetCategories } = useCategories();
  const { theme, setTheme } = useTheme();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      link.download = `sms-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
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

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-8">
      <div className="flex items-center gap-4 mb-2">
        <div className="p-3 bg-neutral-100 dark:bg-[#222222] text-brand-blue dark:text-[#F7F7F7] rounded-2xl border border-brand-blue/5 dark:border-transparent ring-2 ring-brand-cyan/20">
          <SettingsIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-brand-blue dark:text-[#F7F7F7]">Settings</h1>
          <p className="text-brand-blue/40 dark:text-[#A0A0A0] font-black mt-1 uppercase tracking-wider text-[10px]">Cloud Infrastructure Control</p>
        </div>
      </div>


      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 shadow-sm ${
          message.type === 'success' 
            ? 'bg-brand-green/10 text-brand-green border border-brand-green/20' 
            : 'bg-brand-red/10 text-brand-red border border-brand-red/20'
        }`}>

          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <p className="font-bold">{message.text}</p>
        </div>
      )}

      {/* SECTION: THEME */}
      <section>
        <h2 className="text-[10px] font-black text-brand-blue/30 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Appearance</h2>
        <div className="bg-white dark:bg-[#111111] rounded-[32px] border border-brand-blue/5 dark:border-[#222222] shadow-sm overflow-hidden">



          <div className="p-5">
            <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7] mb-6">
              <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                <Palette className="w-5 h-5 text-brand-blue dark:text-inherit" />
              </div>
              <div>
                <p className="font-black text-brand-blue dark:text-[#F7F7F7]">App Theme</p>
                <p className="text-xs font-black text-brand-blue/30 dark:text-[#A0A0A0] mt-0.5 uppercase tracking-wider">Choose individual aesthetic context</p>
              </div>
            </div>




            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pl-0 sm:pl-[3.25rem]">
              <button
                onClick={() => setTheme('light')}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all",
                  theme === 'light' 
                    ? "border-brand-blue bg-brand-blue/5 dark:bg-[#1A1A1A]" 
                    : "border-transparent bg-neutral-100 dark:bg-[#222222] hover:bg-brand-blue/5 hover:border-brand-cyan"
                )}


              >
                <Sun className={cn("w-5 h-5", theme === 'light' ? "text-[#222222] dark:text-[#F7F7F7]" : "text-[#717171] dark:text-[#A0A0A0]")} />
                <span className={cn("font-bold text-sm", theme === 'light' ? "text-[#222222] dark:text-[#F7F7F7]" : "text-[#717171] dark:text-[#A0A0A0]")}>Light Mode</span>
              </button>

              <button
                onClick={() => setTheme('dark')}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all",
                  theme === 'dark' 
                    ? "border-brand-blue dark:border-[#F7F7F7] bg-brand-blue/5 dark:bg-[#1A1A1A]" 
                    : "border-transparent bg-neutral-100 dark:bg-[#222222] hover:bg-brand-blue/5 hover:border-brand-cyan"
                )}


              >
                <Moon className={cn("w-5 h-5", theme === 'dark' ? "text-[#222222] dark:text-[#F7F7F7]" : "text-[#717171] dark:text-[#A0A0A0]")} />
                <span className={cn("font-bold text-sm", theme === 'dark' ? "text-[#222222] dark:text-[#F7F7F7]" : "text-[#717171] dark:text-[#A0A0A0]")}>Dark Mode</span>
              </button>

              <button
                onClick={() => setTheme('system')}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all",
                  theme === 'system' 
                    ? "border-brand-blue dark:border-[#F7F7F7] bg-brand-blue/5 dark:bg-[#1A1A1A]" 
                    : "border-transparent bg-neutral-100 dark:bg-[#222222] hover:bg-brand-blue/5 hover:border-brand-cyan"
                )}


              >
                <Monitor className={cn("w-5 h-5", theme === 'system' ? "text-[#222222] dark:text-[#F7F7F7]" : "text-[#717171] dark:text-[#A0A0A0]")} />
                <span className={cn("font-bold text-sm", theme === 'system' ? "text-[#222222] dark:text-[#F7F7F7]" : "text-[#717171] dark:text-[#A0A0A0]")}>System</span>
              </button>
            </div>
          </div>
        </div>
      </section>


      {/* SECTION: CATEGORIES */}
      <section>
        <h2 className="text-xs font-black text-[#1A237E] dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2 opacity-70">Categories</h2>
        <div className="bg-white dark:bg-[#111111] rounded-[32px] border border-[#EBEBEB] dark:border-[#222222] shadow-[0_20px_50px_rgba(26,35,126,0.05)] dark:shadow-none overflow-hidden divide-y divide-[#EBEBEB] dark:divide-[#222222]">


          
          <div className="p-5 flex flex-col gap-5">
            <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
              <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                <Tag className="w-5 h-5 text-brand-blue dark:text-inherit" />
              </div>
              <div>
                <p className="font-black text-brand-blue dark:text-[#F7F7F7]">Categorization Engine</p>
                <p className="text-xs font-black text-brand-blue/30 dark:text-[#A0A0A0] mt-0.5 uppercase tracking-wider">Configure meta-tags for financial data</p>
              </div>
            </div>




            <div className="pl-0 sm:pl-[3.25rem] space-y-4">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <div key={category} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-[#222222] text-brand-blue dark:text-[#F7F7F7] rounded-full text-xs font-black border border-brand-blue/10 dark:border-[#333333] shadow-sm">
                    {category}

                    <button onClick={() => removeCategory(category)} className="text-brand-blue/20 dark:text-[#666666] hover:text-brand-red transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              
              <div className="flex flex-col sm:flex-row gap-3">
                <form onSubmit={handleAddCategory} className="flex flex-1 gap-2">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="E.g., Pet Supplies"
                    className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-brand-blue/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan transition-all text-sm font-black text-brand-blue dark:text-[#F7F7F7] placeholder-brand-blue/20"
                  />
                  <button
                    type="submit"
                    disabled={!newCategory.trim()}
                    className="px-6 py-2.5 bg-brand-green dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-xl font-black hover:bg-brand-green/90 hover:ring-2 hover:ring-brand-cyan transition-all disabled:opacity-50 text-xs uppercase tracking-widest shadow-lg shadow-brand-green/10"
                  >
                    Deploy
                  </button>



                </form>

                  <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to restore default categories?')) {
                      resetCategories();
                      showMessage('success', 'Categories reset to default');
                    }
                  }}
                  className="px-4 py-2.5 text-xs font-black text-brand-blue/40 dark:text-[#A0A0A0] hover:text-brand-blue dark:hover:text-[#F7F7F7] hover:bg-brand-blue/5 rounded-xl transition-colors uppercase tracking-widest"
                >
                  Restore Defaults
                </button>

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION: DATA MANAGEMENT */}
      <section>
        <h2 className="text-xs font-black text-[#525252] dark:text-[#A0A0A0] uppercase tracking-wider mb-3 px-2">Data & Storage</h2>
        <div className="bg-white dark:bg-[#111111] rounded-3xl border border-[#EBEBEB] dark:border-[#222222] shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-none overflow-hidden divide-y divide-[#EBEBEB] dark:divide-[#222222]">

          
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
              <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                <Download className="w-5 h-5 text-brand-blue dark:text-inherit" />
              </div>
              <div>
                <p className="font-black text-brand-blue dark:text-[#F7F7F7]">Archive Pipeline</p>
                <p className="text-xs font-black text-brand-blue/30 dark:text-[#A0A0A0] mt-0.5 uppercase tracking-wider">Export data cluster to JSON</p>
              </div>
            </div>



            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="px-5 py-2.5 bg-white dark:bg-[#111111] border border-brand-blue/10 text-brand-blue dark:text-[#F7F7F7] rounded-xl font-black hover:bg-brand-blue/5 transition-all disabled:opacity-50 text-xs uppercase tracking-widest w-full sm:w-auto text-center shadow-sm"
            >

              {isExporting ? 'Exporting...' : 'Export JSON'}
            </button>

          </div>

          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-brand-blue dark:text-[#F7F7F7]">
              <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0 border border-brand-blue/5 dark:border-transparent">
                <Upload className="w-5 h-5 text-brand-blue dark:text-inherit" />
              </div>
              <div>
                <p className="font-black text-brand-blue dark:text-[#F7F7F7]">Restore Protocol</p>
                <p className="text-xs font-black text-brand-blue/30 dark:text-[#A0A0A0] mt-0.5 uppercase tracking-wider">Sync data cluster from file</p>
              </div>
            </div>



            <div className="w-full sm:w-auto">
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportData} className="hidden" id="import-file" />
              <label
                htmlFor="import-file"
                className={`block w-full sm:w-auto px-5 py-2.5 bg-white dark:bg-[#111111] border border-brand-blue/10 text-brand-blue dark:text-[#F7F7F7] rounded-xl font-black hover:bg-brand-blue/5 transition-all cursor-pointer text-center text-xs uppercase tracking-widest shadow-sm ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}
              >

                {isImporting ? 'Importing...' : 'Import JSON'}
              </label>

            </div>
          </div>

        </div>
      </section>

      {/* SECTION: DANGER ZONE */}
      <section>
        <h2 className="text-[10px] font-black text-brand-red uppercase tracking-[0.2em] mb-4 px-2">Terminal Phase</h2>
        <div className="bg-brand-red/5 rounded-3xl border border-brand-red/10 overflow-hidden divide-y divide-brand-red/10">

          
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-brand-red">
              <div className="p-2.5 bg-brand-red/10 rounded-xl flex-shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="font-black text-brand-red">Purge Local Cluster</p>
                <p className="text-xs font-black text-brand-red/40 mt-0.5 uppercase tracking-wider">Zero-out all local storage points</p>
              </div>
            </div>
            <button
              onClick={handleClearData}
              disabled={isClearing}
              className="px-6 py-3 bg-brand-red text-white rounded-xl font-black hover:bg-brand-red/90 transition-all disabled:opacity-50 text-[10px] uppercase tracking-[0.2em] w-full sm:w-auto flex justify-center items-center gap-2 shadow-lg shadow-brand-red/10"
            >
              <Trash2 className="w-4 h-4"/>
              {isClearing ? 'Purging...' : 'Wipe System'}
            </button>
          </div>


        </div>
      </section>

    </div>
  );
}
