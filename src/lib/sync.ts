import { db, Transaction, Account } from './db';
import { db_cloud, auth } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';

export const syncTransactionToCloud = async (transaction: Transaction) => {
  if (!auth.currentUser) return;

  const userId = auth.currentUser.uid;
  const txRef = doc(db_cloud, `users/${userId}/transactions`, transaction.id!.toString());

  try {
    const txDoc = await getDoc(txRef);
    if (txDoc.exists()) {
      const cloudData = txDoc.data();
      const cloudLastUpdated = cloudData.lastUpdated?.toDate() || new Date(0);
      const localLastUpdated = transaction.lastUpdated || new Date(0);

      if (cloudLastUpdated > localLastUpdated) {
        // Cloud is newer, sync back to local (Conflict Resolution)
        await db.transactions.update(transaction.id!, {
          ...cloudData,
          id: transaction.id,
          dateTime: cloudData.dateTime?.toDate() || transaction.dateTime,
          syncStatus: 'synced'
        });
        return;
      }
    }

    // Push local to cloud
    await setDoc(txRef, {
      ...transaction,
      dateTime: Timestamp.fromDate(new Date(transaction.dateTime)),
      lastUpdated: Timestamp.fromDate(new Date(transaction.lastUpdated || new Date())),
      syncStatus: 'synced'
    });

    await db.transactions.update(transaction.id!, { syncStatus: 'synced' });
  } catch (error) {
    console.error('Error syncing transaction:', error);
    await db.transactions.update(transaction.id!, { syncStatus: 'error' });
  }
};

export const syncAccountToCloud = async (account: Account) => {
  if (!auth.currentUser) return;

  const userId = auth.currentUser.uid;
  const accRef = doc(db_cloud, `users/${userId}/accounts`, account.id!.toString());

  try {
    const accDoc = await getDoc(accRef);
    if (accDoc.exists()) {
      const cloudData = accDoc.data();
      const cloudLastUpdated = cloudData.lastUpdated?.toDate() || new Date(0);
      const localLastUpdated = account.lastUpdated || new Date(0);

      if (cloudLastUpdated > localLastUpdated) {
        // Cloud is newer
        await db.accounts.update(account.id!, {
          ...cloudData,
          id: account.id,
          syncStatus: 'synced'
        });
        return;
      }
    }

    await setDoc(accRef, {
      ...account,
      lastUpdated: Timestamp.fromDate(new Date(account.lastUpdated || new Date())),
      syncStatus: 'synced'
    });

    await db.accounts.update(account.id!, { syncStatus: 'synced' });
  } catch (error) {
    console.error('Error syncing account:', error);
    await db.accounts.update(account.id!, { syncStatus: 'error' });
  }
};

export const syncAllPending = async () => {
  if (!navigator.onLine || !auth.currentUser) return;

  const pendingTransactions = await db.transactions.where('syncStatus').equals('pending').toArray();
  const pendingAccounts = await db.accounts.where('syncStatus').equals('pending').toArray();

  for (const tx of pendingTransactions) {
    await syncTransactionToCloud(tx);
  }

  for (const acc of pendingAccounts) {
    await syncAccountToCloud(acc);
  }
};

// Initial Sync and Listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Online detected, starting sync...');
    syncAllPending();
  });

  // Check on load
  if (navigator.onLine) {
    syncAllPending();
  }
}
