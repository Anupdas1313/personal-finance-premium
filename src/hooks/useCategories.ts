import { useState, useEffect } from 'react';

const DEFAULT_CATEGORIES = ['Personal', 'Home', 'Miscellaneous', 'Tenant / Customer'];

export function useCategories() {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('app_categories');
    if (stored) {
      try {
        setCategories(JSON.parse(stored));
      } catch (e) {
        setCategories(DEFAULT_CATEGORIES);
      }
    } else {
      setCategories(DEFAULT_CATEGORIES);
      localStorage.setItem('app_categories', JSON.stringify(DEFAULT_CATEGORIES));
    }
  }, []);

  const addCategory = (category: string) => {
    const trimmed = category.trim();
    if (!trimmed || categories.includes(trimmed)) return false;
    
    const newCategories = [...categories, trimmed];
    setCategories(newCategories);
    localStorage.setItem('app_categories', JSON.stringify(newCategories));
    return true;
  };

  const removeCategory = (category: string) => {
    const newCategories = categories.filter(c => c !== category);
    setCategories(newCategories);
    localStorage.setItem('app_categories', JSON.stringify(newCategories));
  };

  const resetCategories = () => {
    setCategories(DEFAULT_CATEGORIES);
    localStorage.setItem('app_categories', JSON.stringify(DEFAULT_CATEGORIES));
  };

  return { categories, addCategory, removeCategory, resetCategories };
}
