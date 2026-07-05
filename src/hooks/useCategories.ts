import React from 'react';
import { db } from '../models/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../context/AuthContext';

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Entertainment', 'Salary', 'Transfer', 'Groceries', 'Travel', 'Health', 'Investment', 'Loan', 'Housing', 'Education', 'Donations', 'Other'];

let categoriesInitialized = false;

export function useCategories() {
  const { user } = useAuth();
  
  // Use useLiveQuery to subscribe to the categories table for the current user's DB
  const dbCategories = useLiveQuery(
    async () => {
      const cats = await db.categories.toArray();
      // Sort by sortOrder first, then fallback to id
      cats.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0));
      return cats;
    },
    [user?.uid]
  ) || [];

  const categories = React.useMemo(() => dbCategories.map(c => c.name), [dbCategories]);

  React.useEffect(() => {
    async function initCategories() {
      if (categoriesInitialized) return;
      categoriesInitialized = true;
      try {
        const count = await db.categories.count();
        if (count === 0) {
          const initial = DEFAULT_CATEGORIES.map((name, index) => ({ name, sortOrder: index }));
          await db.categories.bulkPut(initial);
        } else {
          // Migration: if the database accidentally got populated with Tags instead of Categories (due to a previous bug)
          const cats = await db.categories.toArray();
          const names = cats.map(c => c.name);
          if (names.includes('Personal') && names.includes('Tenant / Customer') && !names.includes('Food')) {
            await db.categories.clear();
            const initial = DEFAULT_CATEGORIES.map((name, index) => ({ name, sortOrder: index }));
            await db.categories.bulkAdd(initial);
          }
          // Migration: ensure new categories exist for existing users
          const newCats = ['Groceries', 'Travel', 'Health', 'Investment', 'Loan', 'Housing', 'Education', 'Donations'];
          const existingNames = (await db.categories.toArray()).map(c => c.name);
          const missing = newCats.filter(c => !existingNames.includes(c));
          if (missing.length > 0) {
            const startOrder = existingNames.length;
            await db.categories.bulkAdd(missing.map((name, index) => ({ name, sortOrder: startOrder + index })));
          }
        }
      } catch (e) {
        categoriesInitialized = false;
        console.error('Failed to init categories:', e);
      }
    }
    if (dbCategories.length === 0) {
      initCategories();
    }
  }, [dbCategories.length]);

  const addCategory = async (category: string) => {
    const trimmed = category.trim();
    if (!trimmed || categories.includes(trimmed)) return false;
    
    const count = await db.categories.count();
    await db.categories.add({ name: trimmed, sortOrder: count });
    return true;
  };

  const removeCategory = async (category: string) => {
    const cat = await db.categories.where('name').equals(category).first();
    if (cat?.id) {
      await db.categories.delete(cat.id);
    }
  };

  const resetCategories = async () => {
    await db.categories.clear();
    const initial = DEFAULT_CATEGORIES.map((name, index) => ({ name, sortOrder: index }));
    await db.categories.bulkAdd(initial);
  };

  const updateCategoryOrder = async (orderedCategories: typeof dbCategories) => {
    await db.transaction('rw', db.categories, async () => {
      for (let i = 0; i < orderedCategories.length; i++) {
        const cat = orderedCategories[i];
        if (cat.id) {
          await db.categories.update(cat.id, { sortOrder: i });
        }
      }
    });
  };

  return { 
    categories, 
    rawCategories: dbCategories, 
    addCategory, 
    removeCategory, 
    resetCategories,
    updateCategoryOrder
  };
}
