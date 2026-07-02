import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCOmRr_jKay-AwkyNapDo1uD0fSzZ2E4lY",
  authDomain: "expense-tracker-8354.firebaseapp.com",
  projectId: "expense-tracker-8354",
  storageBucket: "expense-tracker-8354.firebasestorage.app",
  messagingSenderId: "101572339117",
  appId: "1:101572339117:web:b0f9c42203c4f845956d24",
  measurementId: "G-E9617J3568"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestoreDb = initializeFirestore(app, {
  localCache: persistentLocalCache()
});
