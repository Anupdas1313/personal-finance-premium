import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { firestoreDb } from './firebase';
import { FinanceDatabase } from '../models/db';

let isSyncingFromCloud = false;
let syncUnsubscribes: (() => void)[] = [];

export function startSync(uid: string | null, db: FinanceDatabase) {
  // Stop existing sync if any
  syncUnsubscribes.forEach(unsub => unsub());
  syncUnsubscribes = [];

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
        isSyncingFromCloud = true;
        try {
          const data = change.doc.data();
          const id = Number(change.doc.id);
          if (change.type === 'added' || change.type === 'modified') {
            await table.put({ ...data, id });
          } else if (change.type === 'removed') {
            await table.delete(id);
          }
        } catch (e) {
          console.error(`Sync error for ${tableName}:`, e);
        } finally {
          isSyncingFromCloud = false;
        }
      });
    });
    syncUnsubscribes.push(unsub);

    // 2. Listen to Dexie changes and update Firestore
    // Note: The creating hook is already attached in db.ts to generate the ID
    table.hook('creating', function (primKey, obj) {
      if (isSyncingFromCloud) return;
      // primKey might be assigned by the db.ts hook, wait for next tick or use the generated obj.id
      setTimeout(() => {
        setDoc(doc(firestoreDb, `users/${uid}/${tableName}`, String(obj.id)), obj);
      }, 0);
    });

    table.hook('updating', function (mods, primKey, obj) {
      if (isSyncingFromCloud) return;
      
      const updatedObj = { ...obj };
      for (const key in mods) {
         if (mods[key] === undefined) delete updatedObj[key as keyof typeof updatedObj];
         else updatedObj[key as keyof typeof updatedObj] = mods[key];
      }
      
      setDoc(doc(firestoreDb, `users/${uid}/${tableName}`, String(primKey)), updatedObj);
    });

    table.hook('deleting', function (primKey, obj) {
      if (isSyncingFromCloud) return;
      deleteDoc(doc(firestoreDb, `users/${uid}/${tableName}`, String(primKey)));
    });
  });
}
