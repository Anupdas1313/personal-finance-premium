import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import Login from './screens/Login';
import VerifyEmail from './screens/VerifyEmail';

import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider, useAuth } from './context/AuthContext';
import './logic/sync';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7FF] dark:bg-[#0C0C0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.emailVerified && localStorage.getItem('app_bypass_verification') !== 'true') {
    return <Navigate to="/verify" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="app-theme">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/verify" element={<VerifyEmail />} />
            
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="summary" element={<Summary />} />
              <Route path="budgets" element={<Budgets />} />
              <Route path="reports" element={<Reports />} />
              <Route path="ledger" element={<Ledger />} />
              <Route path="ledger/:id" element={<PartyLedger />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="/transactions/table" element={<ProtectedRoute><TransactionTable /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
