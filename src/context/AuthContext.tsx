import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  deleteUser,
  updateProfile
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { startSync, stopSync } from '../lib/syncEngine';
import { db, initializeDB } from '../models/db';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfileName: (name: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // For email/password users, require email verification
      const isPasswordUser = firebaseUser?.providerData.some(p => p.providerId === 'password');
      
      if (firebaseUser && isPasswordUser && !firebaseUser.emailVerified) {
        // If not verified, sign them out and don't set user state
        setUser(null);
        startSync(null, db as any);
        setLoading(false);
        return;
      }

      if (firebaseUser) {
        // Create a stable copy of the user object to avoid proxy issues
        const mappedUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          emailVerified: firebaseUser.emailVerified,
          photoURL: firebaseUser.photoURL,
        } as User;
        
        setUser(mappedUser);
        const savedMode = localStorage.getItem('appMode');
        const mode = savedMode === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL';
        const activeDB = initializeDB(mappedUser.uid, mode);
        startSync(mappedUser.uid, activeDB);
      } else {
        setUser(null);
        stopSync();
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

  const signUp = async (email: string, password: string, name?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (name && userCredential.user) {
        await updateProfile(userCredential.user, { displayName: name });
    }
    await sendEmailVerification(userCredential.user);
    await signOut(auth);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateProfileName = async (name: string) => {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: name });
      // Update local state to reflect change immediately
      if (user) {
        setUser({ ...user, displayName: name });
      }
    }
  };

  const deleteAccount = async () => {
    if (auth.currentUser) {
      await deleteUser(auth.currentUser);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, signIn, signUp, signInWithGoogle, resetPassword, updateProfileName, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
