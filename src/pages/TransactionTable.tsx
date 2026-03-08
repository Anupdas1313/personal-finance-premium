import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Download, ZoomIn, ZoomOut } from 'lucide-react';

export default function TransactionTable() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));
  const handleZoomReset = () => setZoom(1);

  const allTransactionsRaw = useLiveQuery(() => db.transactions.toArray()) || [];
  const allTransactions = [...allTransactionsRaw].sort((a, b) => {
    const dateA = new Date(a.dateTime).getTime();
    const dateB = new Date(b.dateTime).getTime();
    return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
  });
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  const filteredTransactions = allTransactions.filter(tx => {
    if (!startParam || !endParam) return true;
    try {
      const start = new Date(startParam);
      const end = new Date(endParam);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return true;
      
      const txDate = new Date(tx.dateTime);
      if (isNaN(txDate.getTime())) return false;
      
      return txDate.getTime() >= start.getTime() && txDate.getTime() <= end.getTime();
    } catch (e) {
      return true;
    }
  });

  const getHeaderText = () => {
    if (!startParam || !endParam) return 'All Transactions';
    try {
      const start = new Date(startParam);
      const end = new Date(endParam);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'All Transactions';
      return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
    } catch (e) {
      return 'All Transactions';
    }
  };

  const safeFormatDate = (dateVal: any, formatStr: string) => {
    try {
      if (!dateVal) return '—';
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '—';
      return format(d, formatStr);
    } catch (e) {
      return '—';
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Time', 'Type', 'Category', 'Merchant/Note', 'Amount', 'Payment Method', 'Account'];
    const rows = filteredTransactions.map(tx => {
      const typeLabel = tx.type === 'CREDIT' ? '(Received/Credited)' : '(Paid to / Debit)';
      const merchantNote = tx.party && tx.note ? `${tx.party} - ${tx.note}` : tx.party || tx.note || '';
      return [
        safeFormatDate(tx.dateTime, 'yyyy-MM-dd'),
        safeFormatDate(tx.dateTime, 'HH:mm:ss'),
        typeLabel,
        tx.category,
        `"${merchantNote.replace(/"/g, '""')}"`,
        tx.amount || 0,
        tx.paymentMethod === 'UPI' ? `UPI (${tx.upiApp || ''})` : tx.paymentMethod,
        accounts.find(a => a.id === tx.accountId)?.bankName || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${startParam || 'all'}_to_${endParam || 'all'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-10">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 -ml-2 sm:ml-0 text-gray-500 hover:bg-gray-100 rounded-full transition-colors shrink-0"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Transaction Report</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              {getHeaderText()} ({filteredTransactions.length} of {allTransactions.length} transactions)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={handleZoomOut} className="p-1.5 text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all" title="Zoom Out">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={handleZoomReset} className="px-2 text-xs font-medium text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all h-7" title="Reset Zoom">
              {Math.round(zoom * 100)}%
            </button>
            <button onClick={handleZoomIn} className="p-1.5 text-gray-600 hover:bg-white hover:shadow-sm rounded-md transition-all" title="Zoom In">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm w-full overflow-x-auto">
          <div style={{ zoom: zoom as any }} className="min-w-max">
            <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Merchant / Note</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Payment Method</th>
                <th className="px-4 py-3">Account</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">{safeFormatDate(tx.dateTime, 'yyyy-MM-dd')}</td>
                  <td className="px-4 py-3 text-gray-500">{safeFormatDate(tx.dateTime, 'hh:mm a')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tx.type === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {tx.type === 'CREDIT' ? '(Received/Credited)' : '(Paid to / Debit)'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{tx.category}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate" title={tx.party && tx.note ? `${tx.party} - ${tx.note}` : tx.party || tx.note}>
                    {tx.party && tx.note ? `${tx.party} - ${tx.note}` : tx.party || tx.note || '—'}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {tx.type === 'CREDIT' ? '+' : '-'} ₹{(tx.amount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {tx.paymentMethod === 'UPI' ? `UPI${tx.upiApp ? ` (${tx.upiApp})` : ''}` : tx.paymentMethod === 'Bank' ? 'Bank' : 'Cash'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {accounts.find(a => a.id === tx.accountId)?.bankName || '—'}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No transactions found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </main>
    </div>
  );
}
