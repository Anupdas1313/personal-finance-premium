import React from 'react';
import { db } from '../models/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../context/AuthContext';

const DEFAULT_TAGS = ['Personal', 'Home'];

let tagsInitialized = false;

export function useTags() {
  const { user } = useAuth();

  const dbTags = useLiveQuery(
    async () => {
      const tags = await db.tags.toArray();
      return tags.map(t => t.name);
    },
    [user?.uid]
  ) || [];

  React.useEffect(() => {
    async function initTags() {
      if (tagsInitialized) return;
      tagsInitialized = true;
      try {
        const count = await db.tags.count();
        if (count === 0) {
          const initial = DEFAULT_TAGS.map(name => ({ name }));
          await db.tags.bulkPut(initial);
        }
      } catch (e) {
        tagsInitialized = false;
        console.error('Failed to init tags:', e);
      }
    }
    if (dbTags.length === 0) {
      initTags();
    }
  }, [dbTags.length]);

  const addTag = async (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || dbTags.includes(trimmed)) return false;

    await db.tags.add({ name: trimmed });
    return true;
  };

  const removeTag = async (tag: string) => {
    if (dbTags.length <= 1) return false;
    const t = await db.tags.where('name').equals(tag).first();
    if (t?.id) {
      await db.tags.delete(t.id);
    }
    return true;
  };

  const resetTags = async () => {
    await db.tags.clear();
    const initial = DEFAULT_TAGS.map(name => ({ name }));
    await db.tags.bulkAdd(initial);
  };

  return { tags: dbTags, addTag, removeTag, resetTags }
}
