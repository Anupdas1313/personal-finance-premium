import React from 'react';
import { db, UpiApp } from '../models/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '../context/AuthContext';
import { UPI_APPS_LIST } from '../constants';

export const DEFAULT_UPI_APPS = UPI_APPS_LIST;

let initializedForUid: string | null = null;

export function useUpiApps() {
  const { user } = useAuth();

  const dbUpiApps = useLiveQuery(
    async () => {
      const apps = await db.upiApps?.toArray() || [];
      apps.sort((a: UpiApp, b: UpiApp) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0));
      return apps;
    },
    [user?.uid]
  ) || [];

  const upiApps = React.useMemo(() => {
    if (dbUpiApps.length > 0) {
      return dbUpiApps.map((a: UpiApp) => a.name);
    }
    return DEFAULT_UPI_APPS;
  }, [dbUpiApps]);

  React.useEffect(() => {
    async function initUpiApps() {
      if (!user?.uid || initializedForUid === user.uid) return;
      initializedForUid = user.uid;
      try {
        if (db.upiApps) {
          const count = await db.upiApps.count();
          if (count === 0) {
            const initial = DEFAULT_UPI_APPS.map((name, index) => ({ name, sortOrder: index }));
            await db.upiApps.bulkPut(initial);
          }
        }
      } catch (e) {
        initializedForUid = null;
        console.error('Failed to init UPI apps:', e);
      }
    }
    if (dbUpiApps.length === 0 && user?.uid) {
      initUpiApps();
    }
  }, [dbUpiApps.length, user?.uid]);

  const addUpiApp = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || upiApps.includes(trimmed)) return false;

    if (db.upiApps) {
      const count = await db.upiApps.count();
      await db.upiApps.add({ name: trimmed, sortOrder: count });
    }
    return true;
  };

  const removeUpiApp = async (name: string) => {
    if (db.upiApps) {
      const app = await db.upiApps.where('name').equals(name).first();
      if (app && app.id) {
        await db.upiApps.delete(app.id);
      }
    }
  };

  const resetUpiApps = async () => {
    if (db.upiApps) {
      await db.upiApps.clear();
      const initial = DEFAULT_UPI_APPS.map((name, index) => ({ name, sortOrder: index }));
      await db.upiApps.bulkPut(initial);
    }
  };

  const updateUpiAppOrder = async (orderedNames: string[]) => {
    if (!db.upiApps) return;
    const all = await db.upiApps.toArray();
    for (let i = 0; i < orderedNames.length; i++) {
      const name = orderedNames[i];
      const match = all.find(a => a.name === name);
      if (match && match.id) {
        await db.upiApps.update(match.id, { sortOrder: i });
      }
    }
  };

  return {
    upiApps,
    rawUpiApps: dbUpiApps,
    addUpiApp,
    removeUpiApp,
    resetUpiApps,
    updateUpiAppOrder,
  };
}
