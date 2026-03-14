import { useState, useRef } from 'react';
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
        <div className="p-3 bg-neutral-100 dark:bg-[#222222] text-[#222222] dark:text-[#F7F7F7] rounded-2xl">
          <SettingsIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#222222] dark:text-[#F7F7F7]">Settings</h1>
          <p className="text-[#717171] dark:text-[#A0A0A0] font-medium mt-1">Manage app preferences and data</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' 
            : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <p className="font-bold">{message.text}</p>
        </div>
      )}



      {/* SECTION: CATEGORIES */}
      <section>
        <h2 className="text-xs font-bold text-[#717171] dark:text-[#A0A0A0] uppercase tracking-wider mb-3 px-2">Categories</h2>
        <div className="bg-white dark:bg-[#111111] rounded-3xl border border-[#EBEBEB] dark:border-[#222222] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden divide-y divide-[#EBEBEB] dark:divide-[#222222]">
          
          <div className="p-5 flex flex-col gap-5">
            <div className="flex items-center gap-4 text-[#222222] dark:text-[#F7F7F7]">
              <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-[#222222] dark:text-[#F7F7F7]">Manage Categories</p>
                <p className="text-sm font-medium text-[#717171] dark:text-[#A0A0A0] mt-0.5">Customize tags for tracking your spending</p>
              </div>
            </div>

            <div className="pl-0 sm:pl-[3.25rem] space-y-4">
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <div key={category} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 dark:bg-[#222222] text-[#222222] dark:text-[#F7F7F7] rounded-full text-sm font-bold border border-transparent dark:border-[#333333]">
                    {category}
                    <button onClick={() => removeCategory(category)} className="text-[#B0B0B0] dark:text-[#666666] hover:text-rose-600 transition-colors">
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
                    className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-[#EBEBEB] dark:border-[#333333] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#222222] dark:focus:ring-[#F7F7F7] transition-all text-sm font-medium text-[#222222] dark:text-[#F7F7F7] placeholder-[#B0B0B0] dark:placeholder-[#666666]"
                  />
                  <button
                    type="submit"
                    disabled={!newCategory.trim()}
                    className="px-5 py-2.5 bg-[#222222] dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-xl font-bold hover:bg-black dark:hover:bg-neutral-200 transition-colors disabled:opacity-50 text-sm"
                  >
                    Add
                  </button>
                </form>

                <button
                  onClick={() => {
                    if (window.confirm('Are you sure you want to restore default categories?')) {
                      resetCategories();
                      showMessage('success', 'Categories reset to default');
                    }
                  }}
                  className="px-4 py-2.5 text-sm font-bold text-[#717171] dark:text-[#A0A0A0] hover:text-[#222222] dark:hover:text-[#F7F7F7] hover:bg-neutral-100 dark:hover:bg-[#222222] rounded-xl transition-colors"
                >
                  Reset Defaults
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION: DATA MANAGEMENT */}
      <section>
        <h2 className="text-xs font-bold text-[#717171] dark:text-[#A0A0A0] uppercase tracking-wider mb-3 px-2">Data & Storage</h2>
        <div className="bg-white dark:bg-[#111111] rounded-3xl border border-[#EBEBEB] dark:border-[#222222] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden divide-y divide-[#EBEBEB] dark:divide-[#222222]">
          
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-[#222222] dark:text-[#F7F7F7]">
              <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-[#222222] dark:text-[#F7F7F7]">Export Backup</p>
                <p className="text-sm font-medium text-[#717171] dark:text-[#A0A0A0] mt-0.5">Save a local file with all transactions</p>
              </div>
            </div>
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="px-5 py-2.5 bg-white dark:bg-[#111111] border-2 border-[#EBEBEB] dark:border-[#333333] text-[#222222] dark:text-[#F7F7F7] rounded-xl font-bold hover:border-[#B0B0B0] dark:hover:border-[#666666] transition-colors disabled:opacity-50 text-sm w-full sm:w-auto text-center shadow-sm"
            >
              {isExporting ? 'Exporting...' : 'Export JSON'}
            </button>
          </div>

          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-[#222222] dark:text-[#F7F7F7]">
              <div className="p-2.5 bg-neutral-100 dark:bg-[#222222] rounded-xl flex-shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-[#222222] dark:text-[#F7F7F7]">Import Backup</p>
                <p className="text-sm font-medium text-[#717171] dark:text-[#A0A0A0] mt-0.5">Restore data from a JSON file</p>
              </div>
            </div>
            <div className="w-full sm:w-auto">
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportData} className="hidden" id="import-file" />
              <label
                htmlFor="import-file"
                className={`block w-full sm:w-auto px-5 py-2.5 bg-white dark:bg-[#111111] border-2 border-[#EBEBEB] dark:border-[#333333] text-[#222222] dark:text-[#F7F7F7] rounded-xl font-bold hover:border-[#B0B0B0] dark:hover:border-[#666666] transition-colors cursor-pointer text-center text-sm shadow-sm ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {isImporting ? 'Importing...' : 'Import JSON'}
              </label>
            </div>
          </div>

        </div>
      </section>

      {/* SECTION: DANGER ZONE */}
      <section>
        <h2 className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-3 px-2">Danger Zone</h2>
        <div className="bg-rose-50/50 dark:bg-rose-500/5 rounded-3xl border border-rose-100 dark:border-rose-500/20 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden divide-y divide-rose-100 dark:divide-rose-500/20">
          
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-100 dark:bg-rose-500/20 rounded-xl flex-shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-rose-700 dark:text-rose-400">Clear All Data</p>
                <p className="text-sm font-medium text-rose-600/70 dark:text-rose-400/70 mt-0.5">Permanently delete everything on this device</p>
              </div>
            </div>
            <button
              onClick={handleClearData}
              disabled={isClearing}
              className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors disabled:opacity-50 text-sm w-full sm:w-auto flex justify-center items-center gap-2 shadow-sm"
            >
              <Trash2 className="w-4 h-4"/>
              {isClearing ? 'Clearing...' : 'Wipe Data'}
            </button>
          </div>

        </div>
      </section>

    </div>
  );
}
