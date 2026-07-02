import { collection, onSnapshot, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { firestoreDb } from './firebase';
import { FinanceDatabase } from '../models/db';

let syncingKeys = new Set<string>();
let syncUnsubscribes: (() => void)[] = [];

// Helper to convert Firestore Timestamps to JS Dates
function convertTimestampsToDates(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Timestamp) return obj.toDate();
  if (Array.isArray(obj)) return obj.map(convertTimestampsToDates);
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      newObj[key] = convertTimestampsToDates(obj[key]);
    }
    return newObj;
  }
  return obj;
}

export function startSync(uid: string | null, db: FinanceDatabase) {
  syncUnsubscribes.forEach(unsub => unsub());
  syncUnsubscribes = [];
  syncingKeys.clear();

  if (!uid) return;

  const tables = [
    'accounts', 'transactions', 'monthlyClosings', 'budgets', 
    'parties', 'ledgerTransactions', 'accountClosings', 
    'categories', 'tags', 'recurringTemplates'
  ];

  tables.forEach(tableName => {
    const table = db.table(tableName);

    // 1. Listen to Firestore changes and update Dexie
    const unsub = onSnapshot(collection(firestoreDb, `users/${uid}/${tableName}`), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const id = Number(change.doc.id);
        const syncKey = `${tableName}-${id}`;
        
        syncingKeys.add(syncKey);
        try {
          const rawData = change.doc.data();
          const data = convertTimestampsToDates(rawData);
          
          if (change.type === 'added' || change.type === 'modified') {
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
    table.hook('creating', function (primKey, obj) {
      const syncKey = `${tableName}-${primKey}`;
      if (syncingKeys.has(syncKey)) return;
      
      setTimeout(() => {
        setDoc(doc(firestoreDb, `users/${uid}/${tableName}`, String(obj.id)), obj).catch(console.error);
      }, 0);
    });

    table.hook('updating', function (mods, primKey, obj) {
      const syncKey = `${tableName}-${primKey}`;
      if (syncingKeys.has(syncKey)) return;
      
      const updatedObj = { ...obj };
      for (const key in mods) {
         if (mods[key] === undefined) delete updatedObj[key as keyof typeof updatedObj];
         else updatedObj[key as keyof typeof updatedObj] = mods[key];
      }
      
      setDoc(doc(firestoreDb, `users/${uid}/${tableName}`, String(primKey)), updatedObj).catch(console.error);
    });

    table.hook('deleting', function (primKey, obj) {
      const syncKey = `${tableName}-${primKey}`;
      if (syncingKeys.has(syncKey)) return;
      
      deleteDoc(doc(firestoreDb, `users/${uid}/${tableName}`, String(primKey))).catch(console.error);
    });
  });
}
