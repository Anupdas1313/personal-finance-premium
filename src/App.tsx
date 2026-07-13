import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './screens/Dashboard';
import Transactions from './screens/Transactions';
import Accounts from './screens/Accounts';
import Summary from './screens/Summary';
import TransactionTable from './screens/TransactionTable';
import Settings from './screens/Settings';
import Budgets from './screens/Budgets';
import BudgetCustomize from './screens/BudgetCustomize';
import Ledger from './screens/Ledger';
import PartyLedger from './screens/PartyLedger';
import Reports from './screens/Reports';
import Profile from './screens/Profile';
import Wishlist from './screens/Wishlist';
import Auth from './screens/Auth';
import Welcome from './screens/Welcome';
import SetupAccount from './screens/SetupAccount';
import PwaInstallPromoter from './components/PwaInstallPromoter';

import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useRecurringEngine } from './logic/useRecurringEngine';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './models/db';

// Protect routes that require authentication
function ProtectedRoute({ children, requireSetup = true }: { children: React.ReactNode, requireSetup?: boolean }) {
  const { user } = useAuth();
  
  // Check local storage first (instant) — use state so it's reactive
  const [isSetupLocal, setIsSetupLocal] = React.useState(() => 
    user ? localStorage.getItem(`onboardingComplete_${user.uid}`) === 'true' : false
  );

  // Re-check localStorage whenever user changes or component mounts
  React.useEffect(() => {
    if (user) {
      const val = localStorage.getItem(`onboardingComplete_${user.uid}`) === 'true';
      setIsSetupLocal(val);
    }
  }, [user]);

  // Listen for localStorage changes from SetupAccount (same tab)
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (user && !isSetupLocal) {
        const val = localStorage.getItem(`onboardingComplete_${user.uid}`) === 'true';
        if (val) setIsSetupLocal(true);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [user, isSetupLocal]);
  
  // Also check Dexie in case it synced from cloud
  const userSettings = useLiveQuery(() => db.userSettings.toArray(), []);
  const isSetupCloud = userSettings?.find(s => s.key === 'setupComplete')?.value === true;

  // Safety net: if accounts already exist in DB, setup is definitely complete
  const accountCount = useLiveQuery(() => db.accounts.count(), []);
  const hasAccounts = (accountCount ?? 0) > 0;
  
  const isSetupDone = isSetupLocal || isSetupCloud || hasAccounts;
  
  const [isCheckingCloud, setIsCheckingCloud] = React.useState(!isSetupLocal);

  React.useEffect(() => {
    if (isSetupDone && user) {
      localStorage.setItem(`onboardingComplete_${user.uid}`, 'true');
      setIsSetupLocal(true);
      setIsCheckingCloud(false);
    }
  }, [isSetupDone, user]);

  React.useEffect(() => {
    if (user && !isSetupDone) {
      // Give the sync engine up to 3 seconds to download the userSettings from Firestore
      const timer = setTimeout(() => {
        setIsCheckingCloud(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setIsCheckingCloud(false);
    }
  }, [user, isSetupDone]);
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If any signal says we're set up, proceed immediately.
  // Otherwise, wait for Dexie to finish its initial load before deciding.
  if (requireSetup && !isSetupDone) {
    if (userSettings === undefined || accountCount === undefined || isCheckingCloud) {
      // Still loading from DB or checking cloud
      return (
        <div className="min-h-screen bg-[#F4F7FF] dark:bg-[#0C0C0F] flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 border-2 border-brand-green/30 border-t-brand-green rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-neutral-500 animate-pulse">Checking cloud backups...</p>
        </div>
      );
    }
    
    return <Navigate to="/welcome" replace />;
  }

  return <>{children}</>;
}

function LoadingWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  // Start the auto-logging engine for recurring transactions if user is logged in
  useRecurringEngine(user?.uid);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7FF] dark:bg-[#0C0C0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin"></div>
      </div>
    );
  }

  return <div className="contents">{children}</div>;
}

export default function App() {
  React.useEffect(() => {
    // Request persistent storage to ensure the browser doesn't evict local Dexie databases under storage pressure.
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(granted => {
        if (granted) {
          console.log("Persistent storage granted by browser.");
        } else {
          console.log("Persistent storage denied by browser.");
        }
      });
    }
  }, []);

  return (
    <ThemeProvider defaultTheme="light" storageKey="app-theme">
      <AuthProvider>
        <HashRouter>
          <LoadingWrapper>
            <PwaInstallPromoter />
            <Routes>
              {/* Public route */}
              <Route path="/auth" element={<Auth />} />

              {/* Onboarding routes */}
              <Route path="/welcome" element={
                <ProtectedRoute requireSetup={false}>
                  <Welcome />
                </ProtectedRoute>
              } />
              <Route path="/setup-account" element={
                <ProtectedRoute requireSetup={false}>
                  <SetupAccount />
                </ProtectedRoute>
              } />

              {/* Protected routes wrapped in Layout */}
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="accounts" element={<Accounts />} />
                <Route path="summary" element={<Summary />} />
                <Route path="budgets" element={<Budgets />} />
                <Route path="budgets/customize/:month" element={<BudgetCustomize />} />
                <Route path="reports" element={<Reports />} />
                <Route path="ledger" element={<Ledger />} />
                <Route path="ledger/:id" element={<PartyLedger />} />
                <Route path="settings" element={<Settings />} />
                <Route path="wishlist" element={<Wishlist />} />
                <Route path="profile" element={<Profile />} />
              </Route>

              {/* Protected routes without Layout */}
              <Route path="/transactions/table" element={
                <ProtectedRoute>
                  <TransactionTable />
                </ProtectedRoute>
              } />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </LoadingWrapper>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
