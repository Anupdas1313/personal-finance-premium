import { collection, onSnapshot, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { firestoreDb } from './firebase';
import { FinanceDatabase } from '../models/db';

let syncingKeys = new Set<string>();
let syncUnsubscribes: (() => void)[] = [];

// Helper to convert Firestore Timestamps to JS Dates
function convertTimestampsToDates(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) return obj.toDate();
  if (Array.isArray(obj)) return obj.map(convertTimestampsToDates);
  if (typeof obj === 'object') {
    const newObj: Record<string, unknown> = {};
    for (const key in obj as Record<string, unknown>) {
      newObj[key] = convertTimestampsToDates((obj as Record<string, unknown>)[key]);
    }
    return newObj;
  }
  return obj;
}

export function stopSync() {
  syncUnsubscribes.forEach(unsub => unsub());
  syncUnsubscribes = [];
  syncingKeys.clear();
}

export function startSync(uid: string | null, db: FinanceDatabase) {
  stopSync();
  syncingKeys.clear();

  if (!uid || uid === 'demo-user') return;

  const mode = localStorage.getItem('appMode') === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL';
  const pathPrefix = `users/${uid}/${mode}`;

  const tables = [
    'accounts', 'transactions', 'monthlyClosings', 'budgets', 
    'parties', 'ledgerTransactions', 'accountClosings', 
    'categories', 'tags', 'recurringTemplates', 'userSettings',
    'monthlyBudgets', 'inventory', 'sales', 'saleItems', 'wishlist'
  ];

  tables.forEach(tableName => {
    // Some tables might not exist if they are not in the db object (though our DB schema has all of them now)
    const table = db.table(tableName);
    if (!table) return;

    // 1. Listen to Firestore changes and update Dexie
    const unsub = onSnapshot(collection(firestoreDb, `${pathPrefix}_${tableName}`), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const id = Number(change.doc.id);
        const syncKey = `${tableName}-${id}`;
        
        syncingKeys.add(syncKey);
        try {
          const rawData = change.doc.data();
          const data = convertTimestampsToDates(rawData) as any;
          
          if (change.type === 'added' || change.type === 'modified') {
            const existingRecord = await table.get(id);
            if (existingRecord && existingRecord.updatedAt && data.updatedAt) {
              const localTime = new Date(existingRecord.updatedAt).getTime();
              const remoteTime = new Date(data.updatedAt).getTime();
              if (localTime > remoteTime) {
                // Local is newer, ignore remote
                return;
              }
            }
            await table.put({ ...data, id });
          } else if (change.type === 'removed') {
            await table.delete(id);
          }
        } catch (e) {
          console.error(`Sync error for ${tableName}:`, e);
        } finally {
          syncingKeys.delete(syncKey);
        }
      });
    });
    syncUnsubscribes.push(unsub);

    // 2. Listen to Dexie changes and update Firestore
    const creatingFn: any = function (this: any, primKey: any, obj: any, transaction: any) {
      if (!obj.updatedAt) obj.updatedAt = new Date();
      if (!obj.createdAt) obj.createdAt = new Date();
      // Use Dexie's this.onsuccess callback to get the actual generated ID for auto-increment keys
      this.onsuccess = function (actualPrimKey: any) {
        const id = Number(actualPrimKey);
        const syncKey = `${tableName}-${id}`;
        if (syncingKeys.has(syncKey)) return;
        
        const objWithId = { ...obj, id };
        // Firestore rejects undefined values synchronously, which would crash this callback
        Object.keys(objWithId).forEach(key => {
          if ((objWithId as any)[key] === undefined) delete (objWithId as any)[key];
        });
        
        setDoc(doc(firestoreDb, `${pathPrefix}_${tableName}`, String(id)), objWithId).catch(console.error);
      };
    };
    table.hook('creating', creatingFn);
    syncUnsubscribes.push(() => table.hook('creating').unsubscribe(creatingFn));

    const updatingFn: any = function (mods: any, primKey: any, obj: any) {
      const syncKey = `${tableName}-${primKey}`;
      
      let finalMods = mods;
      if (!mods.updatedAt && !syncingKeys.has(syncKey)) {
         finalMods = { ...mods, updatedAt: new Date() };
      }

      if (syncingKeys.has(syncKey)) return finalMods === mods ? undefined : finalMods;
      
      const updatedObj = { ...obj, ...finalMods };
      for (const key in finalMods) {
         if (finalMods[key] === undefined) delete (updatedObj as any)[key];
      }
      
      setDoc(doc(firestoreDb, `${pathPrefix}_${tableName}`, String(primKey)), updatedObj).catch(console.error);
      
      if (finalMods !== mods) return finalMods;
    };
    table.hook('updating', updatingFn);
    syncUnsubscribes.push(() => table.hook('updating').unsubscribe(updatingFn));

    const deletingFn: any = function (primKey: any, obj: any) {
      const syncKey = `${tableName}-${primKey}`;
      if (syncingKeys.has(syncKey)) return;
      
      deleteDoc(doc(firestoreDb, `${pathPrefix}_${tableName}`, String(primKey))).catch(console.error);
    };
    table.hook('deleting', deletingFn);
    syncUnsubscribes.push(() => table.hook('deleting').unsubscribe(deletingFn));
  });
}
