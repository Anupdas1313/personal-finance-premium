import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Accounts from './pages/Accounts';
import Summary from './pages/Summary';
import SMSParser from './pages/SMSParser';
import Accounting from './pages/Accounting';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="summary" element={<Summary />} />
          <Route path="accounting" element={<Accounting />} />
          <Route path="parse" element={<SMSParser />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
