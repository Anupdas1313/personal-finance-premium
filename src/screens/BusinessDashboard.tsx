import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../models/db';
import { IndianRupee, Clock, AlertTriangle, TrendingUp, Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function BusinessDashboard() {
  const sales = useLiveQuery(() => db.sales.toArray()) || [];
  const inventory = useLiveQuery(() => db.inventory.toArray()) || [];

  const metrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todaysSales = 0;
    let pendingAmount = 0;
    let lowStockCount = 0;

    sales.forEach(sale => {
      const saleDate = new Date(sale.date);
      if (saleDate >= today) {
        todaysSales += sale.totalAmount;
      }
      if (sale.status === 'PENDING') {
        pendingAmount += sale.totalAmount;
      }
    });

    inventory.forEach(item => {
      if (item.stockQuantity <= 5) {
        lowStockCount++;
      }
    });

    return { todaysSales, pendingAmount, lowStockCount };
  }, [sales, inventory]);

  const recentSales = sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue dark:text-white">Business Dashboard</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Here's what's happening with your business today.</p>
        </div>
        <Link
          to="/sales"
          className="flex items-center justify-center gap-2 bg-brand-blue hover:bg-brand-blue/90 text-white px-4 py-2 rounded-xl transition-colors font-medium shadow-sm"
        >
          <Receipt className="w-5 h-5" />
          Record Sale
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Today's Sales */}
        <div className="bg-white dark:bg-[#15151A] rounded-3xl p-6 border border-neutral-100 dark:border-neutral-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp className="w-24 h-24 text-green-500" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-medium text-neutral-600 dark:text-neutral-400">Today's Sales</h3>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-bold text-brand-blue dark:text-white mb-1">
              ₹{metrics.todaysSales.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bg-white dark:bg-[#15151A] rounded-3xl p-6 border border-neutral-100 dark:border-neutral-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="w-24 h-24 text-orange-500" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="font-medium text-neutral-600 dark:text-neutral-400">Pending Receivables</h3>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-bold text-brand-blue dark:text-white mb-1">
              ₹{metrics.pendingAmount.toLocaleString('en-IN')}
            </div>
            <Link to="/sales" className="text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline">
              View pending sales →
            </Link>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-[#15151A] rounded-3xl p-6 border border-neutral-100 dark:border-neutral-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertTriangle className="w-24 h-24 text-red-500" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="font-medium text-neutral-600 dark:text-neutral-400">Low Stock SKUs</h3>
          </div>
          <div className="relative z-10">
            <div className="text-3xl font-bold text-brand-blue dark:text-white mb-1">
              {metrics.lowStockCount}
            </div>
            <Link to="/inventory" className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline">
              Restock inventory →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Sales List */}
      <div className="bg-white dark:bg-[#15151A] rounded-3xl p-6 md:p-8 shadow-sm border border-neutral-100 dark:border-neutral-800">
         <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-brand-blue dark:text-white">Recent Sales</h2>
            <Link to="/sales" className="text-sm font-medium text-brand-blue hover:underline">View All</Link>
         </div>
         
         <div className="space-y-4">
            {recentSales.length > 0 ? recentSales.map(sale => (
               <div key={sale.id} className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 dark:bg-[#0C0C0F] border border-neutral-100 dark:border-neutral-800">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-xl bg-brand-blue/10 dark:bg-brand-blue/20 flex items-center justify-center">
                        <Receipt className="w-6 h-6 text-brand-blue" />
                     </div>
                     <div>
                        <div className="font-semibold text-brand-blue dark:text-white">₹{sale.totalAmount.toLocaleString('en-IN')}</div>
                        <div className="text-sm text-neutral-500">{new Date(sale.date).toLocaleDateString()} • {sale.status}</div>
                     </div>
                  </div>
               </div>
            )) : (
               <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">No sales recorded yet.</div>
            )}
         </div>
      </div>
    </div>
  );
}
