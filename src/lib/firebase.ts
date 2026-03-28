import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD9ha608T6TaWiQABsjfE8f_j8fWTges-4",
  authDomain: "expense-tracker-premium-62275.firebaseapp.com",
  projectId: "expense-tracker-premium-62275",
  storageBucket: "expense-tracker-premium-62275.firebasestorage.app",
  messagingSenderId: "575245322891",
  appId: "1:575245322891:web:f5ba90b43cf1588f62228e",
  measurementId: "G-LFJF1QWHWL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db_cloud = getFirestore(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Enable Multi-Tab Persistence
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db_cloud).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser doesn't support all of the features required to enable persistence
      console.warn('Firestore persistence failed: Browser not supported');
    }
  });
}

export default app;
