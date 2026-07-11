import React from 'react';
import { db } from '../models/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../context/AuthContext';

const DEFAULT_TAGS = ['Personal', 'Household', 'Miscellaneous', 'Tenant / Customer'];

let tagsInitialized = false;

export function useTags() {
  const { user } = useAuth();

  const dbTags = useLiveQuery(
    async () => {
      const tags = await db.tags.toArray();
      // Sort by sortOrder first, then fallback to id
      tags.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0));
      return tags;
    },
    [user?.uid]
  ) || [];

  const tags = React.useMemo(() => dbTags.map(t => t.name), [dbTags]);

  React.useEffect(() => {
    async function initTags() {
      if (tagsInitialized) return;
      tagsInitialized = true;
      try {
        const count = await db.tags.count();
        if (count === 0) {
          const initial = DEFAULT_TAGS.map((name, index) => ({ name, sortOrder: index }));
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
    if (!trimmed || tags.includes(trimmed)) return false;

    const count = await db.tags.count();
    await db.tags.add({ name: trimmed, sortOrder: count });
    return true;
  };

  const removeTag = async (tag: string) => {
    if (tags.length <= 1) return false;
    const t = await db.tags.where('name').equals(tag).first();
    if (t?.id) {
      await db.tags.delete(t.id);
    }
    return true;
  };

  const resetTags = async () => {
    await db.tags.clear();
    const initial = DEFAULT_TAGS.map((name, index) => ({ name, sortOrder: index }));
    await db.tags.bulkAdd(initial);
  };

  const updateTagOrder = async (orderedTags: typeof dbTags) => {
    await db.transaction('rw', db.tags, async () => {
      for (let i = 0; i < orderedTags.length; i++) {
        const t = orderedTags[i];
        if (t.id) {
          await db.tags.update(t.id, { sortOrder: i });
        }
      }
    });
  };

  return { 
    tags, 
    rawTags: dbTags, 
    addTag, 
    removeTag, 
    resetTags,
    updateTagOrder
  };
}
