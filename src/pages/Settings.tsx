import { useState, useRef } from 'react';
import { db } from '../lib/db';
import { Download, Upload, Trash2, AlertTriangle, CheckCircle2, Settings as SettingsIcon, Database, ListPlus, X } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';

export default function Settings() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [newCategory, setNewCategory] = useState('');
  
  const { categories, addCategory, removeCategory, resetCategories } = useCategories();
  
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
      
      const data = {
        version: 1,
        exportDate: new Date().toISOString(),
        transactions,
        accounts
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

      await db.transaction('rw', db.transactions, db.accounts, async () => {
        await db.transactions.clear();
        await db.accounts.clear();
        
        if (data.accounts.length > 0) {
          await db.accounts.bulkAdd(data.accounts);
        }
        if (data.transactions.length > 0) {
          await db.transactions.bulkAdd(data.transactions);
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
      await db.transaction('rw', db.transactions, db.accounts, async () => {
        await db.transactions.clear();
        await db.accounts.clear();
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
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-neutral-100 text-[#222222] rounded-2xl">
          <SettingsIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#222222]">Settings</h1>
          <p className="text-[#717171] font-medium mt-1">Manage your app data and preferences</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-[20px] flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <p className="font-bold">{message.text}</p>
        </div>
      )}

      {/* App Settings */}
      <div className="bg-white rounded-[24px] border border-[#EBEBEB] shadow-[0_6px_16px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="p-6 border-b border-[#EBEBEB]">
          <h2 className="text-xl font-bold text-[#222222] flex items-center gap-2">
            <ListPlus className="w-5 h-5 text-[#717171]" />
            App Settings
          </h2>
          <p className="text-[#717171] font-medium mt-1">Customize your transaction categories.</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="font-bold text-[#222222] mb-3">Transaction Categories</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((category) => (
                <div key={category} className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 text-[#222222] rounded-full text-sm font-medium">
                  {category}
                  <button
                    onClick={() => removeCategory(category)}
                    className="text-[#717171] hover:text-rose-600 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Add new category..."
                className="flex-1 px-4 py-2 bg-neutral-50 border border-[#EBEBEB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#222222] focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={!newCategory.trim()}
                className="px-5 py-2 bg-[#222222] text-white rounded-xl font-bold hover:bg-black transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </form>
            
            <div className="mt-4 pt-4 border-t border-[#EBEBEB]">
              <button
                onClick={() => {
                  if (window.confirm('Are you sure you want to reset categories to default?')) {
                    resetCategories();
                    showMessage('success', 'Categories reset to default');
                  }
                }}
                className="text-sm text-[#717171] hover:text-[#222222] font-medium transition-colors"
              >
                Reset to default categories
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[24px] border border-[#EBEBEB] shadow-[0_6px_16px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="p-6 border-b border-[#EBEBEB]">
          <h2 className="text-xl font-bold text-[#222222] flex items-center gap-2">
            <Database className="w-5 h-5 text-[#717171]" />
            Data Management
          </h2>
          <p className="text-[#717171] font-medium mt-1">Export your data for backup, or import from a previous backup.</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Export */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#EBEBEB]">
            <div>
              <h3 className="font-bold text-[#222222]">Export Data</h3>
              <p className="text-sm text-[#717171] font-medium mt-1">Download all your transactions and accounts as a JSON file.</p>
            </div>
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-[#B0B0B0] text-[#222222] rounded-xl hover:border-[#222222] transition-colors disabled:opacity-50 font-bold shrink-0"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exporting...' : 'Export JSON'}
            </button>
          </div>

          {/* Import */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#EBEBEB]">
            <div>
              <h3 className="font-bold text-[#222222]">Import Data</h3>
              <p className="text-sm text-[#717171] font-medium mt-1">Restore your data from a previously exported JSON backup file.</p>
            </div>
            <div>
              <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                onChange={handleImportData}
                className="hidden"
                id="import-file"
              />
              <label
                htmlFor="import-file"
                className={`flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-100 text-[#222222] rounded-xl hover:bg-neutral-200 transition-colors font-bold cursor-pointer shrink-0 ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <Upload className="w-4 h-4" />
                {isImporting ? 'Importing...' : 'Import JSON'}
              </label>
            </div>
          </div>

          {/* Clear Data */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-rose-600">Clear All Data</h3>
              <p className="text-sm text-[#717171] font-medium mt-1">Permanently delete all transactions and accounts from this device.</p>
            </div>
            <button
              onClick={handleClearData}
              disabled={isClearing}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-50 transition-colors disabled:opacity-50 font-bold shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              {isClearing ? 'Clearing...' : 'Clear Data'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
