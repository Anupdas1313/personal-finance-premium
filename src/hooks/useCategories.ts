import React from 'react';
import { db } from '../models/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../context/AuthContext';

const DEFAULT_CATEGORIES = ['Personal', 'Home', 'Miscellaneous', 'Tenant / Customer'];

let categoriesInitialized = false;

export function useCategories() {
  const { user } = useAuth();
  
  // Use useLiveQuery to subscribe to the categories table for the current user's DB
  const dbCategories = useLiveQuery(
    async () => {
      const cats = await db.categories.toArray();
      return cats.map(c => c.name);
    },
    [user?.uid]
  ) || [];

  React.useEffect(() => {
    async function initCategories() {
      if (categoriesInitialized) return;
      categoriesInitialized = true;
      try {
        const count = await db.categories.count();
        if (count === 0) {
          const initial = DEFAULT_CATEGORIES.map(name => ({ name }));
          await db.categories.bulkPut(initial);
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
    if (!trimmed || dbCategories.includes(trimmed)) return false;
    
    await db.categories.add({ name: trimmed });
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
    const initial = DEFAULT_CATEGORIES.map(name => ({ name }));
    await db.categories.bulkAdd(initial);
  };

  return { categories: dbCategories, addCategory, removeCategory, resetCategories };
}
