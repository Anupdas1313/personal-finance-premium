import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeDB } from '../models/db';

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
  resetPassword: (email: string) => Promise<void>;
  updateProfileName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USER_KEY = 'expense_tracker_local_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem(LOCAL_USER_KEY);
    const initialUser = storedUser ? JSON.parse(storedUser) : {
      uid: 'LOCAL_USER',
      email: 'guest@local.app',
      displayName: 'Guest User',
      photoURL: null
    };
    
    setUser(initialUser);
    initializeDB(initialUser.uid);
    setLoading(false);
  }, []);

  const logout = async () => {
    // No-op since we're removing login page
  };

  const signIn = async (email: string) => {
    const newUser = {
      uid: 'LOCAL_USER',
      email: email,
      displayName: email.split('@')[0],
      photoURL: null
    };
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(newUser));
    setUser(newUser);
    initializeDB(newUser.uid);
  };

  const signUp = async (email: string, _password: string, name?: string) => {
    const newUser = {
      uid: 'LOCAL_USER',
      email: email,
      displayName: name || email.split('@')[0],
      photoURL: null
    };
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(newUser));
    setUser(newUser);
    initializeDB(newUser.uid);
  };

  const resetPassword = async (_email: string) => {
    console.log('Reset password requested in local mode.');
  };

  const updateProfileName = async (name: string) => {
    if (user) {
      const updated = { ...user, displayName: name };
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(updated));
      setUser(updated);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, signIn, signUp, resetPassword, updateProfileName }}>
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
