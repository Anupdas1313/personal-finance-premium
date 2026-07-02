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
import Ledger from './screens/Ledger';
import PartyLedger from './screens/PartyLedger';
import Reports from './screens/Reports';
import Profile from './screens/Profile';
import Auth from './screens/Auth';

import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useRecurringEngine } from './logic/useRecurringEngine';

// Protect routes that require authentication
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/auth" replace />;
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
    <ThemeProvider defaultTheme="dark" storageKey="app-theme">
      <AuthProvider>
        <HashRouter>
          <LoadingWrapper>
            <Routes>
              {/* Public route */}
              <Route path="/auth" element={<Auth />} />

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
                <Route path="reports" element={<Reports />} />
                <Route path="ledger" element={<Ledger />} />
                <Route path="ledger/:id" element={<PartyLedger />} />
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
          </LoadingWrapper>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
