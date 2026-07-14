import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, InventoryItem } from '../models/db';
import { Plus, Search, Edit2, Package, Tag, IndianRupee } from 'lucide-react';

export default function Inventory() {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');

  const items = useLiveQuery(() => 
    db.inventory
      .filter(item => item.name.toLowerCase().includes(search.toLowerCase()) || item.sku.toLowerCase().includes(search.toLowerCase()))
      .toArray()
  , [search]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemData = {
      name,
      sku,
      stockQuantity: Number(stockQuantity),
      costPrice: Number(costPrice),
      sellingPrice: Number(sellingPrice),
      lastUpdated: new Date()
    };

    if (editingItem?.id) {
      await db.inventory.update(editingItem.id, itemData);
    } else {
      await db.inventory.add(itemData);
    }
    
    closeForm();
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setName(item.name);
    setSku(item.sku);
    setStockQuantity(String(item.stockQuantity));
    setCostPrice(String(item.costPrice));
    setSellingPrice(String(item.sellingPrice));
    setIsAdding(true);
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingItem(null);
    setName('');
    setSku('');
    setStockQuantity('');
    setCostPrice('');
    setSellingPrice('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue dark:text-white">Inventory & SKUs</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Manage your stock, cost, and selling prices.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue/90 text-white px-4 py-2 rounded-xl transition-colors font-medium shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Add SKU
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-neutral-400" />
        </div>
        <input
          type="text"
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full pl-10 pr-3 py-3 border border-neutral-200 dark:border-neutral-800 rounded-xl leading-5 bg-white dark:bg-[#15151A] text-brand-blue dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 sm:text-sm transition-all"
        />
      </div>

      <div className="bg-white dark:bg-[#15151A] rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 overflow-hidden">
        {items && items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
              <thead className="bg-neutral-50 dark:bg-[#0C0C0F]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Item Details</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Pricing</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-brand-blue" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-brand-blue dark:text-white">{item.name}</div>
                          <div className="text-xs text-neutral-500 font-mono mt-0.5">{item.sku}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.stockQuantity <= 5 ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {item.stockQuantity} in stock
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-brand-blue dark:text-white">₹{item.sellingPrice.toLocaleString('en-IN')}</div>
                      <div className="text-xs text-neutral-500">Cost: ₹{item.costPrice.toLocaleString('en-IN')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => openEdit(item)} className="text-brand-blue hover:text-brand-blue/80 dark:text-brand-cyan transition-colors p-2 rounded-lg hover:bg-brand-blue/5">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-semibold text-brand-blue dark:text-white mb-1">No SKUs found</h3>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mb-6">You haven't added any items to your inventory yet. Add your first product to start tracking stock.</p>
            <button onClick={() => setIsAdding(true)} className="text-brand-blue font-medium hover:underline">Add your first SKU</button>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#15151A] rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-brand-blue dark:text-white mb-6">
              {editingItem ? 'Edit SKU' : 'Add New SKU'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Product Name</label>
                <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black text-brand-blue dark:text-white focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors" placeholder="e.g. Premium T-Shirt" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">SKU</label>
                  <input required type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black text-brand-blue dark:text-white focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors font-mono text-sm" placeholder="TSHIRT-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Stock Quantity</label>
                  <input required type="number" min="0" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black text-brand-blue dark:text-white focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Cost Price (₹)</label>
                  <input required type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black text-brand-blue dark:text-white focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Selling Price (₹)</label>
                  <input required type="number" min="0" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black text-brand-blue dark:text-white focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors" placeholder="0.00" />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeForm} className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-blue/90 transition-colors shadow-lg shadow-brand-blue/20">
                  Save SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
