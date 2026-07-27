import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
const Dashboard = lazy(() => import('./screens/Dashboard'));
const Transactions = lazy(() => import('./screens/Transactions'));
const Accounts = lazy(() => import('./screens/Accounts'));
const Transfer = lazy(() => import('./screens/Transfer'));
const TransferLogs = lazy(() => import('./screens/TransferLogs'));
const Summary = lazy(() => import('./screens/Summary'));
const TransactionTable = lazy(() => import('./screens/TransactionTable'));
const Settings = lazy(() => import('./screens/Settings'));
const Budgets = lazy(() => import('./screens/Budgets'));
const BudgetCustomize = lazy(() => import('./screens/BudgetCustomize'));
const Ledger = lazy(() => import('./screens/Ledger'));
const PartyLedger = lazy(() => import('./screens/PartyLedger'));
const Reports = lazy(() => import('./screens/Reports'));
const Profile = lazy(() => import('./screens/Profile'));
const Wishlist = lazy(() => import('./screens/Wishlist'));
const Auth = lazy(() => import('./screens/Auth'));
const Welcome = lazy(() => import('./screens/Welcome'));
const SetupAccount = lazy(() => import('./screens/SetupAccount'));
import PwaInstallPromoter from './components/PwaInstallPromoter';
import ErrorBoundary from './components/ErrorBoundary';

import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppModeProvider, useAppMode } from './context/AppModeContext';
import { ToastProvider } from './context/ToastContext';
import { useRecurringEngine } from './logic/useRecurringEngine';
const BusinessDashboard = lazy(() => import('./screens/BusinessDashboard'));
const Inventory = lazy(() => import('./screens/Inventory'));
const Sales = lazy(() => import('./screens/Sales'));
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
    const handleStorageChange = (e: StorageEvent) => {
      if (user && !isSetupLocal && e.key === `onboardingComplete_${user.uid}` && e.newValue === 'true') {
        setIsSetupLocal(true);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
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

function AppRoutes() {
  const { appMode } = useAppMode();
  
  return (
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
        {appMode === 'PERSONAL' ? (
          <>
            <Route index element={<Dashboard />} />
            <Route path="budgets" element={<Budgets />} />
            <Route path="budgets/customize/:month" element={<BudgetCustomize />} />
            <Route path="ledger" element={<Ledger />} />
            <Route path="ledger/:id" element={<PartyLedger />} />
            <Route path="wishlist" element={<Wishlist />} />
          </>
        ) : (
          <>
            <Route index element={<BusinessDashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="sales" element={<Sales />} />
          </>
        )}
        
        {/* Shared Routes */}
        <Route path="transactions" element={<Transactions />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="transfer" element={<Transfer />} />
        <Route path="transfer/logs" element={<TransferLogs />} />
        <Route path="summary" element={<Summary />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
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
  );
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
      <AppModeProvider>
        <AuthProvider>
          <ToastProvider>
            <HashRouter>
              <LoadingWrapper>
                <PwaInstallPromoter />
                <ErrorBoundary>
                  <Suspense fallback={
                    <div className="flex items-center justify-center h-screen bg-white dark:bg-[#060608]">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-3 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
                        <p className="text-sm font-medium text-neutral-400">Loading...</p>
                      </div>
                    </div>
                  }>
                    <AppRoutes />
                  </Suspense>
                </ErrorBoundary>
              </LoadingWrapper>
            </HashRouter>
          </ToastProvider>
        </AuthProvider>
      </AppModeProvider>
    </ThemeProvider>
  );
}
