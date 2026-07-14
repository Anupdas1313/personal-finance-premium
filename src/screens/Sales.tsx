import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Sale, SaleItem, Party, InventoryItem } from '../models/db';
import { Plus, Search, Receipt, CheckCircle, Clock, FileText } from 'lucide-react';
import { cn } from '../logic/utils';

export default function Sales() {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // New Sale Form State
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [skuId, setSkuId] = useState<number | ''>('');
  const [quantity, setQuantity] = useState('1');
  const [status, setStatus] = useState<'PENDING' | 'PAID'>('PAID');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank' | 'UPI' | 'Other'>('Cash');
  const [note, setNote] = useState('');

  const sales = useLiveQuery(() => db.sales.orderBy('date').reverse().toArray());
  const parties = useLiveQuery(() => db.parties.where('type').equals('CUSTOMER').toArray());
  const inventory = useLiveQuery(() => db.inventory.toArray());

  // To display sales elegantly, we need to map customerId to party name
  const partyMap = new Map((parties || []).map(p => [p.id, p]));
  const itemMap = new Map((inventory || []).map(i => [i.id, i]));

  const filteredSales = sales?.filter(s => {
    const party = partyMap.get(s.customerId);
    const partyMatch = party?.name.toLowerCase().includes(search.toLowerCase());
    const statusMatch = s.status.toLowerCase().includes(search.toLowerCase());
    return partyMatch || statusMatch;
  });

  const selectedItem = itemMap.get(Number(skuId));
  const totalAmount = selectedItem ? selectedItem.sellingPrice * Number(quantity) : 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !skuId) return;

    if (selectedItem && selectedItem.stockQuantity < Number(quantity)) {
        alert("Not enough stock available!");
        return;
    }

    try {
      // 1. Create Sale
      const newSaleId = await db.sales.add({
        customerId: Number(customerId),
        date: new Date(),
        totalAmount,
        status,
        paymentMethod: status === 'PAID' ? paymentMethod : undefined,
        note
      });

      // 2. Create SaleItem
      await db.saleItems.add({
        saleId: newSaleId,
        skuId: Number(skuId),
        quantity: Number(quantity),
        unitPrice: selectedItem!.sellingPrice,
        total: totalAmount
      });

      // 3. Deduct Stock
      if (selectedItem) {
          await db.inventory.update(selectedItem.id!, {
              stockQuantity: selectedItem.stockQuantity - Number(quantity)
          });
      }

      setIsAdding(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Error saving sale");
    }
  };

  const markAsPaid = async (sale: Sale) => {
    await db.sales.update(sale.id!, { status: 'PAID', paymentMethod: 'Cash' });
  };

  const resetForm = () => {
    setCustomerId('');
    setSkuId('');
    setQuantity('1');
    setStatus('PAID');
    setPaymentMethod('Cash');
    setNote('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue dark:text-white">Sales & Invoices</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Record sales, track pending payments.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue/90 text-white px-4 py-2 rounded-xl transition-colors font-medium shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Record Sale
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-neutral-400" />
        </div>
        <input
          type="text"
          placeholder="Search sales by customer or status..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="block w-full pl-10 pr-3 py-3 border border-neutral-200 dark:border-neutral-800 rounded-xl leading-5 bg-white dark:bg-[#15151A] text-brand-blue dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all"
        />
      </div>

      <div className="bg-white dark:bg-[#15151A] rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 overflow-hidden">
        {filteredSales && filteredSales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-800">
              <thead className="bg-neutral-50 dark:bg-[#0C0C0F]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Sale Details</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wider">Status & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-neutral-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20 flex items-center justify-center flex-shrink-0">
                          <Receipt className="w-5 h-5 text-brand-blue" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-brand-blue dark:text-white">
                            {new Date(sale.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          {sale.note && <div className="text-xs text-neutral-500 mt-0.5">{sale.note}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-brand-blue dark:text-white">{partyMap.get(sale.customerId)?.name || 'Unknown'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-brand-blue dark:text-white">₹{sale.totalAmount.toLocaleString('en-IN')}</div>
                      {sale.paymentMethod && <div className="text-xs text-neutral-500">{sale.paymentMethod}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right flex items-center justify-end gap-3 h-full">
                      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        sale.status === 'PAID' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                      )}>
                        {sale.status === 'PAID' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {sale.status}
                      </span>
                      {sale.status === 'PENDING' && (
                        <button onClick={() => markAsPaid(sale)} className="text-xs font-medium text-brand-blue hover:underline">
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="text-lg font-semibold text-brand-blue dark:text-white mb-1">No Sales Yet</h3>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mb-6">You haven't recorded any sales in this mode yet. Start selling to track your revenue.</p>
            <button onClick={() => setIsAdding(true)} className="text-brand-blue font-medium hover:underline">Record first sale</button>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#15151A] rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl relative overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-brand-blue dark:text-white mb-6">Record Sale</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Customer</label>
                {parties && parties.length > 0 ? (
                  <select required value={customerId} onChange={(e) => setCustomerId(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black text-brand-blue dark:text-white focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors">
                    <option value="" disabled>Select Customer</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                ) : (
                   <p className="text-sm text-red-500">Please add a Customer in the Parties screen first.</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Product / SKU</label>
                {inventory && inventory.length > 0 ? (
                  <select required value={skuId} onChange={(e) => setSkuId(Number(e.target.value))} className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black text-brand-blue dark:text-white focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors">
                    <option value="" disabled>Select SKU</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.stockQuantity})</option>)}
                  </select>
                ) : (
                  <p className="text-sm text-red-500">Please add SKUs to Inventory first.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Quantity</label>
                  <input required type="number" min="1" max={selectedItem?.stockQuantity || undefined} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black text-brand-blue dark:text-white focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Total (₹)</label>
                  <div className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 text-brand-blue dark:text-white font-medium cursor-not-allowed">
                    {totalAmount.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black text-brand-blue dark:text-white focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors">
                    <option value="PAID">Paid</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
                {status === 'PAID' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Payment Method</label>
                    <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black text-brand-blue dark:text-white focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors">
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank</option>
                      <option value="UPI">UPI</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                 <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">Note (Optional)</label>
                 <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-black text-brand-blue dark:text-white focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue transition-colors" placeholder="e.g. Invoice #001" />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => {setIsAdding(false); resetForm();}} className="flex-1 px-4 py-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-xl font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={!customerId || !skuId} className="flex-1 px-4 py-3 bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-blue/20">
                  Save Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
