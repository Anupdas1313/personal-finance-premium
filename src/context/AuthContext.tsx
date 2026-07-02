import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeDB, db } from '../models/db';
import { auth } from '../lib/firebase';
import { startSync } from '../lib/syncEngine';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  sendEmailVerification,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfileName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      // If the user logs in via Email/Password but their email is NOT verified, 
      // do not expose them to the UI to prevent a brief flash of the Dashboard.
      const isPasswordUser = firebaseUser?.providerData.some(p => p.providerId === 'password');
      if (firebaseUser && isPasswordUser && !firebaseUser.emailVerified) {
        setUser(null);
        startSync(null, db as any);
        setLoading(false);
        return;
      }

      if (firebaseUser) {
        const mappedUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          photoURL: firebaseUser.photoURL
        };
        setUser(mappedUser);
        const activeDB = initializeDB(mappedUser.uid);
        startSync(mappedUser.uid, activeDB);
      } else {
        setUser(null);
        startSync(null, db as any);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const signIn = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    if (!userCredential.user.emailVerified) {
      await signOut(auth);
      const error: any = new Error('Email not verified');
      error.code = 'auth/email-not-verified';
      throw error;
    }
  };

  const signUp = async (email: string, password: string, _name?: string) => {
    // Note: To save profile data (like name), we would use updateProfile or Firestore.
    // The user explicitly requested: "Do NOT save user profile data".
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(userCredential.user);
    await signOut(auth);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const resetPassword = async (_email: string) => {
    // Placeholder for future implementation
    console.log('Reset password requested');
  };

  const updateProfileName = async (name: string) => {
    // Note: The user requested not to save profile data, so this remains a no-op for now.
    if (user) {
      setUser({ ...user, displayName: name });
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, signIn, signUp, signInWithGoogle, resetPassword, updateProfileName }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
