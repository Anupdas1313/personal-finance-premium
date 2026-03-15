import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Accounts from './pages/Accounts';
import Summary from './pages/Summary';
import SMSParser from './pages/SMSParser';
import Accounting from './pages/Accounting';
import TransactionTable from './pages/TransactionTable';
import Settings from './pages/Settings';
import Budgets from './pages/Budgets';
import Ledger from './pages/Ledger';
import PartyLedger from './pages/PartyLedger';

import { ThemeProvider } from './components/ThemeProvider';

export default function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="app-theme">
      <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="summary" element={<Summary />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="accounting" element={<Accounting />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="ledger/:id" element={<PartyLedger />} />
          <Route path="parse" element={<SMSParser />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="/transactions/table" element={<TransactionTable />} />
      </Routes>
    </BrowserRouter>
    </ThemeProvider>
  );
}
