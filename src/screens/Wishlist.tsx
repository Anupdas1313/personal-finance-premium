import React, { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, WishlistItem } from '../models/db';
import { useAuth } from '../context/AuthContext';
import { useCurrencyFormatter } from '../hooks/useCurrency';
import { cn } from '../logic/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Link as LinkIcon, Clock, Coins, Trash2, CheckCircle2, X, Star, ExternalLink, Plus, Landmark, AlertCircle } from 'lucide-react';

const COOLING_OFF_MS = 48 * 60 * 60 * 1000; // 48 Hours

export default function Wishlist() {
  const { user } = useAuth();
  const { formatAmount } = useCurrencyFormatter();
  
  // Database Queries
  const wishlistItems = useLiveQuery(() => db.wishlist.toArray(), [user?.uid]) || [];
  const accounts = useLiveQuery(() => db.accounts.toArray(), [user?.uid]) || [];
  const userSettings = useLiveQuery(() => db.userSettings.toArray(), [user?.uid]);
  
  const isPrivacyMode = userSettings?.find(s => s.key === 'privacy_mode')?.value === true;
  const [revealAmounts, setRevealAmounts] = useState(false);
  const shouldBlur = isPrivacyMode && !revealAmounts;

  // Active Tab state
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ELIMINATED' | 'BOUGHT'>('ACTIVE');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null);

  // Form states for Add modal
  const [pasteLink, setPasteLink] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemPriority, setItemPriority] = useState<number>(3);

  // Form states for Buy modal
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Clock state to trigger re-renders on cooling-off countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Parse store name from URL
  const parseStoreName = (urlStr: string): string => {
    try {
      const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
      const host = url.hostname.replace('www.', '');
      const parts = host.split('.');
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    } catch {
      return '';
    }
  };

  // Autodetect Details when Link is pasted
  useEffect(() => {
    if (pasteLink) {
      const store = parseStoreName(pasteLink);
      if (store && !itemName) {
        setItemName(`${store} Wishlist Item`);
      }
    }
  }, [pasteLink]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const active = wishlistItems.filter(item => item.status === 'ACTIVE');
    const eliminated = wishlistItems.filter(item => item.status === 'ELIMINATED');
    const bought = wishlistItems.filter(item => item.status === 'BOUGHT');
    const moneySaved = eliminated.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const totalWished = wishlistItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
    
    return {
      activeCount: active.length,
      eliminatedCount: eliminated.length,
      boughtCount: bought.length,
      moneySaved,
      totalWished
    };
  }, [wishlistItems]);

  // Filtered List based on Tab
  const filteredItems = useMemo(() => {
    return wishlistItems
      .filter(item => item.status === activeTab)
      .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  }, [wishlistItems, activeTab]);

  // Add Item to Database
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !itemPrice) return;
    
    const priceNum = parseFloat(itemPrice.replace(/,/g, ''));
    if (isNaN(priceNum) || priceNum <= 0) return;

    try {
      await db.wishlist.add({
        name: itemName.trim(),
        price: priceNum,
        link: pasteLink.trim() || undefined,
        priority: itemPriority,
        status: 'ACTIVE',
        dateAdded: new Date()
      });

      // Clear Form & Close
      setItemName('');
      setItemPrice('');
      setPasteLink('');
      setItemPriority(3);
      setShowAddModal(false);
    } catch (err) {
      console.error("Failed to add wishlist item:", err);
    }
  };

  // Eliminate Item (Bye)
  const handleEliminateItem = async (id: number) => {
    try {
      await db.wishlist.update(id, {
        status: 'ELIMINATED',
        dateResolved: new Date()
      });
    } catch (err) {
      console.error("Failed to resolve wishlist item:", err);
    }
  };

  // Convert to Purchase (Buy Flow Step 1)
  const initiateBuyFlow = (item: WishlistItem) => {
    setSelectedItem(item);
    if (accounts.length > 0) {
      setSelectedAccountId(accounts[0].id?.toString() || '');
    }
    setShowBuyModal(true);
  };

  // Execute Purchase & Create Transaction
  const handleBuyConfirm = async () => {
    if (!selectedItem || !selectedAccountId) return;

    try {
      // 1. Add Debit Transaction to DB
      await db.transactions.add({
        accountId: Number(selectedAccountId),
        amount: Number(selectedItem.price),
        type: 'DEBIT',
        dateTime: new Date(),
        category: 'Shopping',
        note: `Purchased Wishlist Item: ${selectedItem.name}${selectedItem.link ? ` (${selectedItem.link})` : ''}`,
        paymentMethod: 'Bank'
      });

      // 2. Mark Wishlist Item as Bought
      await db.wishlist.update(selectedItem.id!, {
        status: 'BOUGHT',
        dateResolved: new Date()
      });

      setShowBuyModal(false);
      setSelectedItem(null);
    } catch (err) {
      console.error("Failed to purchase item:", err);
    }
  };

  // Delete Permanently
  const handleDeleteItem = async (id: number) => {
    if (confirm("Are you sure you want to delete this item permanently?")) {
      try {
        await db.wishlist.delete(id);
      } catch (err) {
        console.error("Failed to delete wishlist item:", err);
      }
    }
  };

  // Countdown Helper
  const getCountdownString = (dateAdded: Date) => {
    const elapsed = now - new Date(dateAdded).getTime();
    const remaining = COOLING_OFF_MS - elapsed;
    if (remaining <= 0) return null;
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    
    return {
      hours,
      minutes,
      seconds,
      pct: Math.max(0, Math.min(100, (elapsed / COOLING_OFF_MS) * 100))
    };
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto pb-28 pt-2">
      
      {/* HEADER */}
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="text-[10px] font-bold text-brand-blue/40 dark:text-neutral-500 tracking-[0.2em] uppercase">Impulse Guard</p>
          <h1 className="text-2xl font-heading font-black text-brand-blue dark:text-white leading-tight tracking-tight">Buy Or Bye</h1>
        </div>
        
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-green text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-brand-green/90 shadow-md shadow-brand-green/10 transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Item
        </button>
      </div>

      {/* SCOREBOARD / STATS */}
      <div className="bg-brand-green rounded-[24px] p-5 text-white relative overflow-hidden shadow-md">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <p className="text-[8px] font-black text-white/70 uppercase tracking-[0.2em] mb-1">Money Saved By Saying Bye</p>
            <p className={cn(
              "text-3xl font-heading font-black tracking-tight transition-all duration-300",
              shouldBlur && "blur-[7px] select-none"
            )} onClick={() => isPrivacyMode && setRevealAmounts(!revealAmounts)}>
              {formatAmount(stats.moneySaved)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-white/70 uppercase tracking-[0.2em] mb-1">Cooling Lock</p>
            <div className="flex items-center gap-1.5 justify-end">
              <Clock className="w-3.5 h-3.5 text-white/90 animate-pulse" />
              <span className="font-bold text-sm">{stats.activeCount} Items locked</span>
            </div>
          </div>
        </div>
      </div>

      {/* SEGMENTED TAB CONTROLLER */}
      <div className="bg-neutral-100 dark:bg-white/5 p-1 rounded-2xl flex w-full relative">
        {(['ACTIVE', 'ELIMINATED', 'BOUGHT'] as const).map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2 text-center text-[10px] font-black uppercase tracking-widest rounded-xl transition-all relative z-10",
                isActive ? "text-brand-blue dark:text-white" : "text-neutral-400 dark:text-neutral-500"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeWishlistTabIndicator"
                  className="absolute inset-0 bg-white dark:bg-[#111115] rounded-xl shadow-sm border border-neutral-200/50 dark:border-white/5 z-[-1]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {tab === 'ACTIVE' ? `Active (${stats.activeCount})` : tab === 'ELIMINATED' ? `Bye (${stats.eliminatedCount})` : `Bought (${stats.boughtCount})`}
            </button>
          );
        })}
      </div>

      {/* WISHLIST ITEMS */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="bg-white dark:bg-[#111115] border border-neutral-100 dark:border-white/5 rounded-[24px] p-10 flex flex-col items-center justify-center opacity-55 text-center">
            <ShoppingBag className="w-10 h-10 text-neutral-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm font-bold text-neutral-800 dark:text-white uppercase tracking-widest">No items found</p>
            <p className="text-xs text-neutral-400 mt-1 max-w-xs">
              {activeTab === 'ACTIVE' ? "Paste a link or add an item to start the 48-hour cooling-off period." :
               activeTab === 'ELIMINATED' ? "Items you decided not to buy will accumulate your total savings here." :
               "Items you confirmed and logged as purchases."}
            </p>
          </div>
        ) : (
          filteredItems.map(item => {
            const cd = getCountdownString(item.dateAdded);
            const isLocked = item.status === 'ACTIVE' && cd !== null;
            const store = item.link ? parseStoreName(item.link) : '';
            
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-[#111115] border border-neutral-100 dark:border-white/5 rounded-[24px] p-4 shadow-sm relative overflow-hidden"
              >
                {/* Visual Lock progress bar */}
                {isLocked && cd && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-neutral-100 dark:bg-white/5">
                    <div className="h-full bg-brand-green transition-all" style={{ width: `${cd.pct}%` }} />
                  </div>
                )}

                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">
                        {store || "Wishlist Item"}
                      </span>
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noreferrer" className="text-neutral-400 hover:text-brand-blue dark:hover:text-white transition-colors">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <h3 className="font-heading font-black text-sm text-brand-blue dark:text-white truncate leading-tight">
                      {item.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-2">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star
                          key={idx}
                          className={cn(
                            "w-3 h-3",
                            idx < item.priority ? "fill-amber-400 text-amber-400" : "text-neutral-200 dark:text-neutral-800"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={cn(
                      "text-base font-heading font-black text-brand-blue dark:text-white tracking-tight leading-none mb-1",
                      shouldBlur && "blur-[5px] select-none"
                    )} onClick={() => isPrivacyMode && setRevealAmounts(!revealAmounts)}>
                      {formatAmount(item.price)}
                    </p>
                    <p className="text-[7px] font-black text-neutral-400 uppercase tracking-widest leading-none">Est. Cost</p>
                  </div>
                </div>

                {/* BOTTOM ACTIONS / TIMERS */}
                <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-neutral-100 dark:border-white/5">
                  <div className="flex-1">
                    {item.status === 'ACTIVE' ? (
                      isLocked && cd ? (
                        <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-bold">
                            Locked for {cd.hours}h {cd.minutes}m
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-brand-green">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-black uppercase tracking-widest">Cooling-off complete</span>
                        </div>
                      )
                    ) : item.status === 'BOUGHT' ? (
                      <span className="text-[9px] font-black uppercase tracking-widest text-brand-green bg-brand-green/5 px-2.5 py-1 rounded-lg">Bought</span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/5 px-2.5 py-1 rounded-lg">Bye / Eliminated</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {item.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => handleEliminateItem(item.id!)}
                          className="px-3.5 py-1.5 border border-rose-500/20 text-rose-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-500/5 transition-all cursor-pointer"
                        >
                          Bye
                        </button>
                        <button
                          onClick={() => initiateBuyFlow(item)}
                          disabled={isLocked}
                          className="px-4 py-1.5 bg-brand-green disabled:bg-neutral-100 dark:disabled:bg-white/5 text-white disabled:text-neutral-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-green/90 transition-all cursor-pointer shadow-md shadow-brand-green/5"
                        >
                          Buy
                        </button>
                      </>
                    )}
                    {item.status !== 'ACTIVE' && (
                      <button
                        onClick={() => handleDeleteItem(item.id!)}
                        className="p-1.5 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg text-neutral-400 hover:text-rose-500 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ADD WISHLIST ITEM                                          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-neutral-900/30 dark:bg-black/50 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative bg-white dark:bg-[#111115] border border-neutral-100 dark:border-white/5 rounded-[28px] w-full max-w-sm overflow-hidden shadow-xl"
            >
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2 text-brand-blue dark:text-white">
                  <ShoppingBag className="w-4.5 h-4.5" />
                  <span className="font-heading font-black text-sm">Add Wishlist Item</span>
                </div>
                <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <form onSubmit={handleAddItem} className="p-5 space-y-4">
                {/* Link */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Product Link (Optional)</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Paste e-commerce link..."
                      value={pasteLink}
                      onChange={(e) => setPasteLink(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-cyan/20 text-brand-blue dark:text-white transition-all"
                    />
                  </div>
                </div>

                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Item Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter item name..."
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-cyan/20 text-brand-blue dark:text-white transition-all"
                  />
                </div>

                {/* Price */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Estimated Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-cyan/20 text-brand-blue dark:text-white transition-all"
                  />
                </div>

                {/* Priority */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block">Priority Level</label>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setItemPriority(idx + 1)}
                        className="focus:outline-none transition-all hover:scale-110 active:scale-95 cursor-pointer"
                      >
                        <Star
                          className={cn(
                            "w-5 h-5",
                            idx < itemPriority ? "fill-amber-400 text-amber-400" : "text-neutral-200 dark:text-neutral-800"
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-brand-green text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-green/90 shadow-md shadow-brand-green/10 transition-all cursor-pointer active:scale-[0.99] mt-2"
                >
                  Start 48h Lock Period
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* MODAL: LOG PURCHASE (BUY CONFIRMATION)                            */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showBuyModal && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-neutral-900/30 dark:bg-black/50 backdrop-blur-sm"
              onClick={() => setShowBuyModal(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative bg-white dark:bg-[#111115] border border-neutral-100 dark:border-white/5 rounded-[28px] w-full max-w-sm overflow-hidden shadow-xl"
            >
              <div className="px-5 py-4 border-b border-neutral-100 dark:border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2 text-brand-blue dark:text-white">
                  <CheckCircle2 className="w-4.5 h-4.5 text-brand-green" />
                  <span className="font-heading font-black text-sm">Log Purchase</span>
                </div>
                <button onClick={() => setShowBuyModal(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-white transition-colors">
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-neutral-50 dark:bg-white/[0.02] p-4 rounded-2xl border border-neutral-200/50 dark:border-white/5 text-center">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">{selectedItem.name}</p>
                  <p className="text-2xl font-heading font-black text-brand-blue dark:text-white">
                    {formatAmount(selectedItem.price)}
                  </p>
                </div>

                {accounts.length === 0 ? (
                  <div className="flex items-center gap-2 text-rose-500 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Please add a payment account first in the Accounts tab before logging purchases.</span>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest">Pay From Account</label>
                    <div className="relative">
                      <Landmark className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-brand-cyan/20 text-brand-blue dark:text-white appearance-none cursor-pointer"
                      >
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id} className="dark:bg-[#111115]">
                            {acc.bankName} (**** {acc.accountLast4})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleBuyConfirm}
                  disabled={!selectedAccountId || accounts.length === 0}
                  className="w-full py-3 bg-brand-green disabled:bg-neutral-100 dark:disabled:bg-white/5 text-white disabled:text-neutral-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-green/90 shadow-md shadow-brand-green/10 transition-all cursor-pointer active:scale-[0.99] mt-2"
                >
                  Confirm Ledger Debit
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
