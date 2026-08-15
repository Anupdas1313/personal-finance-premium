import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, Transaction, normalizeType } from '../models/db';
import { Plus, Trash2, Pencil, ArrowDownLeft, ArrowUpRight, Wallet, CreditCard, Landmark, Download, FileText, CheckCircle2, History, Calendar, ChevronDown, ChevronLeft, ChevronRight, Printer, MoreHorizontal, Scissors, Filter, Search, ArrowUpDown, ArrowRightLeft, X, Hash, Share2 } from 'lucide-react';
import { BankLogo } from '../components/BankLogo';
import { INDIAN_BANKS, getBankByPattern } from '../components/BankLogosData';
import { format, startOfDay, parseISO, endOfMonth, startOfMonth, subMonths, endOfDay, startOfWeek, endOfWeek, startOfYear, endOfYear, addMonths, subWeeks, addWeeks, subDays, addDays, subYears, addYears } from 'date-fns';

import { Reorder, motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useCurrency, useCurrencyFormatter } from '../hooks/useCurrency';
import { cn, roundCurrency } from '../logic/utils';
import { useToast } from '../context/ToastContext';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

function AllAccountsStatementModal({ onClose }: { onClose: () => void }) {
  const currency = useCurrency();
  const { user } = useAuth();
  
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  
  const allAccounts = useLiveQuery(() => db.accounts.toArray(), [user?.uid]) || [];
  const allTransactions = useLiveQuery(() => db.transactions.toArray(), [user?.uid]) || [];
  
  const allCategories = useLiveQuery(() => db.categories.toArray(), [user?.uid]) || [];
  const allTags = useLiveQuery(() => db.tags.toArray(), [user?.uid]) || [];
  
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'filters' | 'columns'>('filters');
  const [periodMode, setPeriodMode] = useState<'MONTH' | 'CUSTOM'>('MONTH');
  
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTransactionTypes, setSelectedTransactionTypes] = useState<string[]>([]);
  
  const [showAccountCol, setShowAccountCol] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCategoryCol, setShowCategoryCol] = useState(false);
  const [showTagCol, setShowTagCol] = useState(false);
  const [showRemarksCol, setShowRemarksCol] = useState(true);
  const [showPaymentMethodCol, setShowPaymentMethodCol] = useState(false);

  const monthStart = startOfDay(dateRange.start).getTime();
  const monthEnd = endOfDay(dateRange.end).getTime();
  
  const statementTxs = useMemo(() => {
    return allTransactions
      .filter(tx => {
        const time = new Date(tx.dateTime).getTime();
        const inMonth = time >= monthStart && time <= monthEnd;
        if (!inMonth) return false;
        
        if (selectedAccounts.length > 0 && !selectedAccounts.includes(tx.accountId)) return false;
        if (selectedCategories.length > 0 && !selectedCategories.includes(tx.category)) return false;
        if (selectedPaymentMethods.length > 0 && tx.paymentMethod && !selectedPaymentMethods.includes(tx.paymentMethod)) return false;
        if (selectedTags.length > 0 && (!tx.expenseType || !selectedTags.includes(tx.expenseType))) return false;
        if (selectedTransactionTypes.length > 0) {
          const type = normalizeType(tx.type);
          if (!selectedTransactionTypes.includes(type)) return false;
        }
        
        return true;
      })
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [allTransactions, monthStart, monthEnd, selectedAccounts, selectedCategories, selectedPaymentMethods, selectedTags, selectedTransactionTypes]);
  
  const getAccountName = (id: number) => {
    return allAccounts.find(a => a.id === id)?.bankName || 'Unknown';
  };
  
  let totalInflow = 0;
  let totalOutflow = 0;
  statementTxs.forEach(tx => {
    const amount = Number(tx.amount) || 0;
    const type = normalizeType(tx.type);
    if (type === 'CREDIT') totalInflow += amount;
    else if (type === 'DEBIT') totalOutflow += amount;
  });

  const handleDownloadCSV = () => {
    const headers = ['Date'];
    if (showAccountCol) headers.push('Account');
    if (showCategoryCol) headers.push('Category');
    if (showTagCol) headers.push('Tag');
    if (showRemarksCol) headers.push('Remarks');
    if (showPaymentMethodCol) headers.push('Payment Method');
    headers.push('Outflow', 'Inflow');

    const rows = statementTxs.map(tx => {
      const type = normalizeType(tx.type);
      const amount = Number(tx.amount) || 0;
      const row = [format(new Date(tx.dateTime), 'yyyy-MM-dd HH:mm')];
      if (showAccountCol) row.push(`"${getAccountName(tx.accountId).replace(/"/g, '""')}"`);
      if (showCategoryCol) row.push(`"${(tx.category || '').replace(/"/g, '""')}"`);
      if (showTagCol) row.push(`"${(tx.expenseType || '').replace(/"/g, '""')}"`);
      if (showRemarksCol) row.push(`"${(tx.note || tx.type || '').replace(/"/g, '""')}"`);
      if (showPaymentMethodCol) row.push(`"${(tx.paymentMethod || '').replace(/"/g, '""')}"`);
      row.push(type === 'DEBIT' ? String(amount) : '');
      row.push(type === 'CREDIT' ? String(amount) : '');
      return row;
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `Account_Statement_${format(dateRange.start, 'MMM_yyyy')}_to_${format(dateRange.end, 'MMM_yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePDFDoc = async () => {
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width || 210;
    const pageHeight = doc.internal.pageSize.height || 297;

    const periodText = periodMode === 'MONTH' 
      ? format(dateRange.start, 'MMMM yyyy') 
      : `${format(dateRange.start, 'dd MMM yyyy')} - ${format(dateRange.end, 'dd MMM yyyy')}`;

    const pdfCurr = (!currency || currency === '₹' || /[^\x00-\x7F]/.test(currency)) ? 'Rs. ' : `${currency} `;

    // Header Background Accent Bar
    doc.setFillColor(26, 35, 126); // Brand Blue (#1A237E)
    doc.rect(0, 0, pageWidth, 12, 'F');

    // App/Company Header Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(26, 35, 126);
    doc.text('ACCOUNT STATEMENT', 14, 25);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Consolidated Multi-Account Financial Report', 14, 31);

    // Right Side Metadata
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Statement Period: ${periodText}`, pageWidth - 14, 25, { align: 'right' });
    doc.text(`Generated On: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, pageWidth - 14, 31, { align: 'right' });

    // Decorative Line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 35, pageWidth - 14, 35);

    // Summary Metric Cards Box (3 columns)
    const boxY = 40;
    const boxHeight = 18;
    const margin = 14;
    const totalW = pageWidth - margin * 2;
    const cardW = (totalW - 12) / 3;

    // Card 1: Total Inflow
    doc.setFillColor(240, 253, 244); // light green
    doc.roundedRect(margin, boxY, cardW, boxHeight, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52);
    doc.text('TOTAL INFLOW', margin + 6, boxY + 6);
    doc.setFontSize(11);
    doc.text(`+${pdfCurr}${totalInflow.toLocaleString('en-IN')}`, margin + 6, boxY + 14);

    // Card 2: Total Outflow
    doc.setFillColor(254, 242, 242); // light red
    doc.roundedRect(margin + cardW + 6, boxY, cardW, boxHeight, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(153, 27, 27);
    doc.text('TOTAL OUTFLOW', margin + cardW + 6 + 6, boxY + 6);
    doc.setFontSize(11);
    doc.text(`-${pdfCurr}${totalOutflow.toLocaleString('en-IN')}`, margin + cardW + 6 + 6, boxY + 14);

    // Card 3: Net Movement
    const netFlow = totalInflow - totalOutflow;
    doc.setFillColor(241, 245, 249); // light slate
    doc.roundedRect(margin + (cardW + 6) * 2, boxY, cardW, boxHeight, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text('NET MOVEMENT', margin + (cardW + 6) * 2 + 6, boxY + 6);
    doc.setFontSize(11);
    doc.setTextColor(netFlow >= 0 ? 22 : 153, netFlow >= 0 ? 101 : 27, netFlow >= 0 ? 52 : 27);
    doc.text(`${netFlow >= 0 ? '+' : '-'}${pdfCurr}${Math.abs(netFlow).toLocaleString('en-IN')}`, margin + (cardW + 6) * 2 + 6, boxY + 14);

    // Table Headers
    const headers = ['Date'];
    if (showAccountCol) headers.push('Account');
    if (showCategoryCol) headers.push('Category');
    if (showTagCol) headers.push('Tag');
    if (showRemarksCol) headers.push('Remarks');
    if (showPaymentMethodCol) headers.push('Method');
    headers.push('Outflow', 'Inflow');

    // Column Styles mapping
    const colStyles: any = {};
    let colIdx = 0;
    headers.forEach((h) => {
      if (h === 'Outflow') {
        colStyles[colIdx] = { halign: 'right', textColor: [220, 38, 38] };
      } else if (h === 'Inflow') {
        colStyles[colIdx] = { halign: 'right', textColor: [22, 163, 74] };
      } else if (h === 'Date') {
        colStyles[colIdx] = { cellWidth: 24 };
      }
      colIdx++;
    });

    const rows = statementTxs.map(tx => {
      const type = normalizeType(tx.type);
      const amount = Number(tx.amount) || 0;
      const row = [format(new Date(tx.dateTime), 'dd MMM yy')];
      if (showAccountCol) row.push(getAccountName(tx.accountId));
      if (showCategoryCol) row.push(tx.category || '-');
      if (showTagCol) row.push(tx.expenseType || '-');
      if (showRemarksCol) row.push(tx.note || tx.type || '-');
      if (showPaymentMethodCol) row.push(tx.paymentMethod || '-');
      row.push(type === 'DEBIT' ? `${pdfCurr}${amount.toLocaleString('en-IN')}` : '-');
      row.push(type === 'CREDIT' ? `${pdfCurr}${amount.toLocaleString('en-IN')}` : '-');
      return row;
    });

    autoTable(doc, {
      startY: 65,
      head: [headers],
      body: rows,
      theme: 'striped',
      headStyles: {
        fillColor: [26, 35, 126],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 4
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 3.5,
        overflow: 'linebreak',
        textColor: [30, 41, 59]
      },
      columnStyles: colStyles,
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didDrawPage: (data) => {
        const str = `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
        doc.text('Computer generated consolidated statement. No signature required.', 14, pageHeight - 6);
        doc.text(str, pageWidth - 14, pageHeight - 6, { align: 'right' });
      }
    });
    
    return doc;
  };

  const handleDownloadPDF = async () => {
    const doc = await generatePDFDoc();
    doc.save(`Account_Statement_${format(dateRange.start, 'MMM_yyyy')}_to_${format(dateRange.end, 'MMM_yyyy')}.pdf`);
  };

  const handleSharePDF = async () => {
    const doc = await generatePDFDoc();
    const pdfBlob = doc.output('blob');
    const filename = `Account_Statement_${format(dateRange.start, 'MMM_yyyy')}_to_${format(dateRange.end, 'MMM_yyyy')}.pdf`;
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Account Statement - ${periodMode === 'MONTH' ? format(dateRange.start, 'MMMM yyyy') : format(dateRange.start, 'MMM yyyy')}`,
          text: `Here is the consolidated account statement for ${periodMode === 'MONTH' ? format(dateRange.start, 'MMMM yyyy') : `${format(dateRange.start, 'dd MMM yyyy')} to ${format(dateRange.end, 'dd MMM yyyy')}`}.`
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleDownloadPDF();
        }
      }
    } else {
      handleDownloadPDF();
    }
  };

  const initialScale = window.innerWidth / 800;

  return createPortal(
    <div className="fixed inset-0 bg-[#F9FBFF] dark:bg-[#0C0C0F] z-[9999] flex flex-col overflow-hidden animate-fade-in">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-[#111111] border-b border-neutral-100 dark:border-white/5 shadow-sm shrink-0 z-10">
        <div className="flex items-center gap-2.5 pl-1">
          <button onClick={onClose} className="p-1 -ml-1 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-heading font-bold text-brand-blue dark:text-white text-sm leading-none">Account Statement</h2>
            <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Consolidated report</p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Filter Toggle */}
          <button onClick={() => setIsFilterPanelOpen(true)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isFilterPanelOpen ? 'bg-brand-blue text-white' : 'bg-neutral-50 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10'}`}>
            <Filter className="w-4 h-4" />
          </button>
          
        </div>
      </div>
      
      {/* Zoomable PDF-like Document Area */}
      <div className="flex-1 overflow-hidden bg-neutral-100/50 dark:bg-black/80 relative">
        <TransformWrapper initialScale={initialScale} minScale={initialScale} maxScale={3} limitToBounds={true} panning={{ velocityDisabled: true }}>
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
            {/* The Document */}
            <div 
              className="bg-white text-black w-[800px] h-[var(--doc-height)] print:h-auto print:min-h-[1131px] flex flex-col shadow-xl m-0 relative print:m-0 print:shadow-none" 
              style={{ fontFamily: '"Inter", "Satoshi", sans-serif', '--doc-height': `calc((100vh - 48px) / ${initialScale})` } as React.CSSProperties}
            >
              <div className="shrink-0 p-8 pb-4 print:p-0 print:pb-4">
              {/* Doc Header */}
              <div className="flex justify-between items-center border-b border-neutral-300 pb-4 mb-6 relative">
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Period</p>
                  <h1 className="text-2xl font-heading font-black text-brand-blue">{periodMode === 'MONTH' ? format(dateRange.start, 'MMMM yyyy') : `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`}</h1>
                </div>
                <div className="flex items-center gap-5 print:hidden relative">
                  <button 
                    onClick={handleSharePDF} 
                    title="Share Statement"
                    className="w-11 h-11 flex items-center justify-center rounded-2xl bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue transition-colors"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <div className="relative">
                    <button 
                      onClick={() => setShowExportMenu(!showExportMenu)}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-brand-blue hover:bg-blue-700 text-white transition-all text-sm font-bold shadow-lg shadow-brand-blue/20 hover:shadow-xl hover:shadow-brand-blue/30 active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                    <AnimatePresence>
                      {showExportMenu && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 top-full mt-3 w-48 bg-white border border-neutral-100 shadow-2xl shadow-black/10 rounded-2xl overflow-hidden z-20"
                        >
                          <button
                            onClick={() => {
                              handleDownloadPDF();
                              setShowExportMenu(false);
                            }}
                            className="w-full text-left px-5 py-3 text-sm hover:bg-rose-50 text-neutral-800 font-bold flex items-center gap-3 border-b border-neutral-100 transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <FileText className="w-4 h-4 text-rose-600" />
                            </div>
                            PDF Format
                          </button>
                          <button
                            onClick={() => {
                              handleDownloadCSV();
                              setShowExportMenu(false);
                            }}
                            className="w-full text-left px-5 py-3 text-sm hover:bg-emerald-50 text-neutral-800 font-bold flex items-center gap-3 transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <FileText className="w-4 h-4 text-emerald-600" />
                            </div>
                            CSV Format
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              
              {/* Summary Metrics */}
              <div className="flex gap-4 mb-6">
                <div className="flex items-center gap-4 bg-emerald-50/50 border border-emerald-100/50 rounded-2xl px-5 py-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Total Inflow</p>
                    <p className="text-lg font-black text-emerald-600 leading-none">+{currency}{totalInflow.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-rose-50/50 border border-rose-100/50 rounded-2xl px-5 py-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Total Outflow</p>
                    <p className="text-lg font-black text-rose-600 leading-none">-{currency}{totalOutflow.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-neutral-50/50 border border-neutral-100/80 rounded-2xl px-5 py-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${totalInflow >= totalOutflow ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Net Flow</p>
                    <p className={`text-lg font-black leading-none ${totalInflow >= totalOutflow ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {totalInflow >= totalOutflow ? '+' : '-'}{currency}{Math.abs(totalInflow - totalOutflow).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>

              </div>
              {/* Transactions Table */}
              <div 
                className="flex-1 overflow-auto w-full px-8 pb-4 print:px-0 print:pb-0 print:overflow-visible print:h-auto"
                onWheelCapture={(e) => e.stopPropagation()} 
                onTouchMoveCapture={(e) => e.stopPropagation()}
              >
                <table className="w-full text-left text-sm border-separate border-spacing-0 border-t border-l border-neutral-200">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-r border-neutral-200 border-b-2 border-black">Date</th>
                    {showAccountCol && <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-r border-neutral-200 border-b-2 border-black">Account</th>}
                    {showCategoryCol && <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-r border-neutral-200 border-b-2 border-black">Category</th>}
                    {showTagCol && <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-r border-neutral-200 border-b-2 border-black">Tag</th>}
                    {showRemarksCol && <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-r border-neutral-200 border-b-2 border-black">Remarks</th>}
                    {showPaymentMethodCol && <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-r border-neutral-200 border-b-2 border-black">Method</th>}
                    <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-right border-r border-neutral-200 border-b-2 border-black">Outflow</th>
                    <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-right border-r border-neutral-200 border-b-2 border-black">Inflow</th>
                  </tr>
                </thead>
                <tbody>
                  {statementTxs.length > 0 ? statementTxs.map((tx, idx) => {
                    const type = normalizeType(tx.type);
                    const amount = Number(tx.amount) || 0;
                    return (
                      <tr key={idx} className="hover:bg-neutral-50/50">
                        <td className="py-3 px-3 font-medium whitespace-nowrap border-r border-b border-neutral-200">{format(new Date(tx.dateTime), 'dd MMM yy')}</td>
                        {showAccountCol && <td className="py-3 px-3 font-bold border-r border-b border-neutral-200">{getAccountName(tx.accountId)}</td>}
                        {showCategoryCol && <td className="py-3 px-3 font-medium border-r border-b border-neutral-200">{tx.category || '-'}</td>}
                        {showTagCol && <td className="py-3 px-3 font-medium text-brand-blue border-r border-b border-neutral-200">{tx.expenseType || '-'}</td>}
                        {showRemarksCol && <td className="py-3 px-3 text-neutral-600 max-w-[200px] truncate border-r border-b border-neutral-200" title={tx.note || tx.type}>{tx.note || tx.type}</td>}
                        {showPaymentMethodCol && <td className="py-3 px-3 text-neutral-600 border-r border-b border-neutral-200">{tx.paymentMethod || '-'}</td>}
                        <td className="py-3 px-3 text-right font-medium text-rose-600 whitespace-nowrap border-r border-b border-neutral-200">{type === 'DEBIT' ? amount.toLocaleString('en-IN') : '-'}</td>
                        <td className="py-3 px-3 text-right font-medium text-emerald-600 whitespace-nowrap border-r border-b border-neutral-200">{type === 'CREDIT' ? amount.toLocaleString('en-IN') : '-'}</td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-400 font-medium border-b border-r border-neutral-200">No transactions for this period</td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>

              {/* Footer */}
              <div className="shrink-0 pt-3 pb-6 px-8 border-t border-neutral-200 flex justify-end items-center w-full print:px-0">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Page 1 of 1</p>
              </div>
            </div>
          </TransformComponent>
        </TransformWrapper>

        {/* Filter Panel */}
        <AnimatePresence>
          {isFilterPanelOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsFilterPanelOpen(false)}
                className="absolute inset-0 bg-black/40 z-20"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
                className="absolute top-0 right-0 bottom-0 w-96 max-w-full bg-white dark:bg-[#111111] z-30 shadow-[0_0_40px_rgba(0,0,0,0.1)] flex flex-col"
              >
                <div className="p-6 border-b border-neutral-100 dark:border-white/5 flex flex-col gap-6 shrink-0 bg-neutral-50/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading font-black text-brand-blue text-lg leading-none">Report Settings</h3>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Customize Output</p>
                    </div>
                    <button onClick={() => setIsFilterPanelOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex bg-neutral-100/80 p-1.5 rounded-2xl">
                    <button 
                      onClick={() => setFilterTab('filters')} 
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${filterTab === 'filters' ? 'bg-white shadow-sm text-brand-blue' : 'text-neutral-500 hover:text-neutral-700'}`}
                    >
                      Filters
                    </button>
                    <button 
                      onClick={() => setFilterTab('columns')} 
                      className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${filterTab === 'columns' ? 'bg-white shadow-sm text-brand-blue' : 'text-neutral-500 hover:text-neutral-700'}`}
                    >
                      Columns
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-8">
                  {filterTab === 'columns' ? (
                    <div className="space-y-4 px-2">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-2">Display Columns</h4>
                      <p className="text-[11px] font-medium text-neutral-500 mb-4">Toggle the columns you want to appear in the PDF report.</p>
                      <div className="space-y-3">
                        {[
                          { id: 'account', label: 'Account', state: showAccountCol, set: setShowAccountCol },
                          { id: 'category', label: 'Category', state: showCategoryCol, set: setShowCategoryCol },
                          { id: 'tag', label: 'Tag', state: showTagCol, set: setShowTagCol },
                          { id: 'remarks', label: 'Remarks', state: showRemarksCol, set: setShowRemarksCol },
                          { id: 'method', label: 'Payment Method', state: showPaymentMethodCol, set: setShowPaymentMethodCol },
                        ].map(col => (
                          <label key={col.id} className="flex items-center justify-between p-4 rounded-2xl border border-neutral-100 cursor-pointer hover:bg-brand-blue/5 hover:border-brand-blue/20 transition-all group">
                            <span className="text-sm font-bold text-neutral-700 group-hover:text-brand-blue transition-colors">{col.label}</span>
                            <input type="checkbox" checked={col.state} onChange={(e) => col.set(e.target.checked)} className="w-5 h-5 rounded-lg border-neutral-300 text-brand-blue focus:ring-brand-blue focus:ring-offset-0 transition-colors" />
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8 px-2 pb-8">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-neutral-500">Filter your transactions.</p>
                        {(selectedAccounts.length > 0 || selectedCategories.length > 0 || selectedTags.length > 0 || selectedPaymentMethods.length > 0 || selectedTransactionTypes.length > 0) && (
                          <button 
                            onClick={() => {
                              setSelectedAccounts([]);
                              setSelectedCategories([]);
                              setSelectedTags([]);
                              setSelectedPaymentMethods([]);
                              setSelectedTransactionTypes([]);
                            }}
                            className="px-3 py-1.5 rounded-full bg-rose-50 text-[10px] font-black text-rose-600 hover:bg-rose-100 transition-colors uppercase tracking-wider"
                          >
                            Clear All
                          </button>
                        )}
                      </div>

                      {/* Period Selection */}
                      <div className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm shadow-black/5">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400">Time Period</h4>
                          <div className="flex bg-neutral-100/80 p-1 rounded-xl">
                            <button onClick={() => {
                              setPeriodMode('MONTH');
                              setDateRange(prev => ({ start: startOfMonth(prev.start), end: endOfMonth(prev.start) }));
                            }} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${periodMode === 'MONTH' ? 'bg-white text-brand-blue shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>Month</button>
                            <button onClick={() => setPeriodMode('CUSTOM')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${periodMode === 'CUSTOM' ? 'bg-white text-brand-blue shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>Custom</button>
                          </div>
                        </div>
                        <div className="w-full">
                          {periodMode === 'MONTH' ? (
                            <div className="flex items-center justify-between bg-neutral-50 border border-neutral-100 rounded-2xl p-1.5 w-full">
                              <button onClick={() => setDateRange(prev => ({ start: startOfMonth(subMonths(prev.start, 1)), end: endOfMonth(subMonths(prev.start, 1)) }))} className="p-2.5 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-neutral-200 active:scale-95 text-neutral-500 hover:text-brand-blue">
                                <ChevronLeft className="w-5 h-5" />
                              </button>
                              <div className="flex-1 text-center font-heading font-black text-brand-blue uppercase tracking-widest text-sm">
                                {format(dateRange.start, 'MMMM yyyy')}
                              </div>
                              <button onClick={() => setDateRange(prev => ({ start: startOfMonth(addMonths(prev.start, 1)), end: endOfMonth(addMonths(prev.start, 1)) }))} className="p-2.5 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-neutral-200 active:scale-95 text-neutral-500 hover:text-brand-blue">
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="flex-1 relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 group-focus-within:text-brand-blue transition-colors">
                                  <Calendar className="w-4 h-4" />
                                </div>
                                <input
                                  type="date"
                                  value={format(dateRange.start, 'yyyy-MM-dd')}
                                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value ? new Date(e.target.value) : new Date() }))}
                                  className="w-full pl-10 pr-3 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none text-xs font-bold text-neutral-800 transition-all uppercase tracking-wider"
                                />
                              </div>
                              <span className="text-neutral-400 font-bold text-[10px] uppercase">to</span>
                              <div className="flex-1 relative group">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 group-focus-within:text-brand-blue transition-colors">
                                  <Calendar className="w-4 h-4" />
                                </div>
                                <input
                                  type="date"
                                  value={format(dateRange.end, 'yyyy-MM-dd')}
                                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value ? new Date(e.target.value) : new Date() }))}
                                  className="w-full pl-10 pr-3 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:border-brand-blue focus:ring-1 focus:ring-brand-blue outline-none text-xs font-bold text-neutral-800 transition-all uppercase tracking-wider"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Transaction Type Filter */}
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-3">Transaction Type</h4>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: 'DEBIT', label: 'Outflow' },
                            { key: 'CREDIT', label: 'Inflow' },
                            { key: 'TRANSFER', label: 'Transfers' }
                          ].map(t => {
                            const isSelected = selectedTransactionTypes.includes(t.key);
                            return (
                              <button
                                key={t.key}
                                onClick={() => {
                                  if (isSelected) setSelectedTransactionTypes(selectedTransactionTypes.filter(type => type !== t.key));
                                  else setSelectedTransactionTypes([...selectedTransactionTypes, t.key]);
                                }}
                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95 ${isSelected ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/20' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                              >
                                {t.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Account Filter */}
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-3">Accounts</h4>
                        <div className="flex flex-wrap gap-2">
                          {allAccounts.map(acc => {
                            const isSelected = selectedAccounts.includes(acc.id as number);
                            return (
                              <button
                                key={acc.id}
                                onClick={() => {
                                  if (isSelected) setSelectedAccounts(selectedAccounts.filter(id => id !== acc.id));
                                  else setSelectedAccounts([...selectedAccounts, acc.id as number]);
                                }}
                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95 ${isSelected ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/20' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                              >
                                {acc.bankName}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Payment Methods */}
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-3">Payment Methods</h4>
                        <div className="flex flex-wrap gap-2">
                          {['Bank', 'UPI', 'Credit Card', 'Cash', 'Bank Transfer'].map(method => {
                            const isSelected = selectedPaymentMethods.includes(method);
                            return (
                              <button
                                key={method}
                                onClick={() => {
                                  if (isSelected) setSelectedPaymentMethods(selectedPaymentMethods.filter(m => m !== method));
                                  else setSelectedPaymentMethods([...selectedPaymentMethods, method]);
                                }}
                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95 ${isSelected ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/20' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                              >
                                {method}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Category Filter */}
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-3">Categories</h4>
                        <div className="flex flex-wrap gap-2">
                          {allCategories.map(cat => {
                            const isSelected = selectedCategories.includes(cat.name);
                            return (
                              <button
                                key={cat.id}
                                onClick={() => {
                                  if (isSelected) setSelectedCategories(selectedCategories.filter(name => name !== cat.name));
                                  else setSelectedCategories([...selectedCategories, cat.name]);
                                }}
                                className={`px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95 ${isSelected ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/20' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                              >
                                {cat.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Tag Filter */}
                      {allTags.length > 0 && (
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-3">Tags</h4>
                          <div className="flex flex-wrap gap-2">
                            {allTags.map(tag => {
                              const isSelected = selectedTags.includes(tag.name);
                              return (
                                <button
                                  key={tag.id}
                                  onClick={() => {
                                    if (isSelected) setSelectedTags(selectedTags.filter(name => name !== tag.name));
                                    else setSelectedTags([...selectedTags, tag.name]);
                                  }}
                                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95 ${isSelected ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/20' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                                >
                                  {tag.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>,
    document.body
  );
}

export default function Accounts() {
  const { currency, hideDecimals, formatAmount } = useCurrencyFormatter();
  const { confirm, success } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const accounts = useLiveQuery(async () => {
    const arr = await db.accounts.toArray();
    return [...arr].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }, [user?.uid]) || [];
  const userSettings = useLiveQuery(() => db.userSettings.toArray(), [user?.uid]) || [];
  const isPrivacyMode = userSettings.find(s => s.key === 'privacy_mode')?.value === true;
  const [revealBalances, setRevealBalances] = useState(false);
  const shouldBlur = isPrivacyMode && !revealBalances;
  const [isAdding, setIsAdding] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [startingBalance, setStartingBalance] = useState('');
  const [startingBalanceDate, setStartingBalanceDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [accountType, setAccountType] = useState<'BANK' | 'CASH' | 'CREDIT_CARD'>('BANK');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [creditLimit, setCreditLimit] = useState('');
  const [statementDate, setStatementDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isReorderOpen, setIsReorderOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const isSectionCollapsed = (type: string, index: number) => {
    if (collapsedSections[type] !== undefined) {
      return collapsedSections[type];
    }
    return true;
  };

  const toggleSection = (type: string, index: number) => {
    setCollapsedSections(prev => ({
      ...prev,
      [type]: !isSectionCollapsed(type, index)
    }));
  };
  
  const getDaysLeftToPay = (dueDay: number) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const today = startOfDay(now);
    
    let target = new Date(currentYear, currentMonth, dueDay);
    if (target.getTime() < today.getTime()) {
      target = new Date(currentYear, currentMonth + 1, dueDay);
    }
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const allTransactions = useLiveQuery(() => db.transactions.toArray(), [user?.uid]) || [];
  const allClosings = useLiveQuery(() => db.accountClosings.toArray(), [user?.uid]) || [];


  const accountBreakdown = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now).getTime();
    const monthEnd = endOfMonth(now).getTime();

    return accounts.reduce((acc, account) => {
      const allAccountTxs = allTransactions
        .filter(tx => Number(tx.accountId) === Number(account.id))
        .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      
      let totalBalance = Number(account.startingBalance) || 0;
      allAccountTxs.forEach(tx => {
        const txType = normalizeType(tx.type);
        if (txType === 'CREDIT') totalBalance += (Number(tx.amount) || 0);
        else if (txType === 'DEBIT') totalBalance -= (Number(tx.amount) || 0);
      });

      // Calculate Inflow/Outflow for Current Month
      const currentMonthTxs = allAccountTxs.filter(tx => {
        const time = new Date(tx.dateTime).getTime();
        return time >= monthStart && time <= monthEnd;
      });

      const inflow = roundCurrency(currentMonthTxs.filter(tx => normalizeType(tx.type) === 'CREDIT').reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0));
      const outflow = roundCurrency(currentMonthTxs.filter(tx => normalizeType(tx.type) === 'DEBIT').reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0));
      
      // Get Recent Activity
      const recentActivity = allAccountTxs.slice(0, 3);

      acc[account.id!] = { inflow, outflow, currentBalance: totalBalance, recentActivity };
      return acc;
    }, {} as Record<number, { inflow: number, outflow: number, currentBalance: number, recentActivity: Transaction[] }>);
  }, [accounts, allTransactions]);

  const totalNetWorth = useMemo(() => 
    roundCurrency(Object.values(accountBreakdown).reduce((sum, b) => sum + (b.currentBalance || 0), 0))
  , [accountBreakdown]);

  const totalLiquid = useMemo(() => 
    roundCurrency(Object.entries(accountBreakdown)
      .filter(([id]) => accounts.find(a => a.id === Number(id))?.type !== 'CREDIT_CARD')
      .reduce((sum, [, b]) => sum + (b.currentBalance || 0), 0))
  , [accountBreakdown, accounts]);

  const totalLiabilities = useMemo(() => 
    Math.abs(roundCurrency(Object.entries(accountBreakdown)
      .filter(([id]) => accounts.find(a => a.id === Number(id))?.type === 'CREDIT_CARD')
      .reduce((sum, [, b]) => sum + (b.currentBalance || 0), 0)))
  , [accountBreakdown, accounts]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName || !accountLast4 || !startingBalance) return;

    setIsSaving(true);
    try {
      const creditCardFields = accountType === 'CREDIT_CARD' ? {
        creditLimit: parseFloat(creditLimit) || 0,
        statementDate: parseInt(statementDate) || 0,
        dueDate: parseInt(dueDate) || 0
      } : {
        creditLimit: undefined,
        statementDate: undefined,
        dueDate: undefined
      };

      const parsedStartingBalance = parseFloat(startingBalance.toString().replace(/,/g, '')) || 0;
      const finalStartingBalance = accountType === 'CREDIT_CARD' ? -Math.abs(parsedStartingBalance) : parsedStartingBalance;

      const payload = {
        bankName,
        accountLast4,
        startingBalance: finalStartingBalance,
        startingBalanceDate: new Date(startingBalanceDate),
        type: accountType,
        ...creditCardFields
      };

      if (editingAccountId) {
        // Map undefined to null to clear optional fields in DB
        const updatePayload = { ...payload };
        Object.keys(updatePayload).forEach(key => {
          if ((updatePayload as any)[key] === undefined) {
            (updatePayload as any)[key] = null;
          }
        });
        await db.accounts.update(editingAccountId, updatePayload);
      } else {
        const maxOrder = accounts.reduce((max, a) => Math.max(max, a.sortOrder || 0), 0);
        const addPayload = { ...payload, sortOrder: maxOrder + 1 };
        Object.keys(addPayload).forEach(key => {
          if ((addPayload as any)[key] === undefined) {
            delete (addPayload as any)[key];
          }
        });
        await db.accounts.add(addPayload as any);
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setIsSaving(false);
        resetForm();
      }, 700);
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setBankName('');
    setAccountLast4('');
    setStartingBalance('');
    setStartingBalanceDate(format(new Date(), 'yyyy-MM-dd'));
    setAccountType('BANK');
    setCreditLimit('');
    setStatementDate('');
    setDueDate('');
    setIsAdding(false);
    setEditingAccountId(null);
  };

  const handleEdit = (account: any) => {
    setBankName(account.bankName);
    setAccountLast4(account.accountLast4);
    const balanceVal = account.type === 'CREDIT_CARD' ? Math.abs(account.startingBalance) : account.startingBalance;
    setStartingBalance(balanceVal.toString());
    setStartingBalanceDate(account.startingBalanceDate ? format(new Date(account.startingBalanceDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
    setAccountType(account.type || 'BANK');
    setCreditLimit(account.creditLimit ? account.creditLimit.toString() : '');
    setStatementDate(account.statementDate ? account.statementDate.toString() : '');
    setDueDate(account.dueDate ? account.dueDate.toString() : '');
    setEditingAccountId(account.id);
    setIsAdding(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };

  const handleDelete = async (id: number) => {
    if (await confirm('Are you sure you want to delete this account?')) {
      await db.accounts.delete(id);
      const txs = await db.transactions.where('accountId').equals(id).toArray();
      for (const tx of txs) {
        if (tx.id) {
          if (tx.linkedTransactionId) {
            await db.transactions.delete(tx.linkedTransactionId);
          }
          await db.transactions.delete(tx.id);
        }
      }
    }
  };

  const groupedAccounts = useMemo(() => {
    const groups = {
      BANK: [] as any[],
      CASH: [] as any[],
      CREDIT_CARD: [] as any[]
    };
    accounts.forEach(acc => {
      const type = acc.type || 'BANK';
      if (groups[type as keyof typeof groups]) {
        groups[type as keyof typeof groups].push(acc);
      }
    });

    const getMinSortOrder = (type: string) => {
       const arr = groups[type as keyof typeof groups];
       if (arr.length === 0) return 999999;
       return Math.min(...arr.map(a => a.sortOrder || 0));
    };

    const sortedTypes = ['BANK', 'CASH', 'CREDIT_CARD'].sort((a, b) => getMinSortOrder(a) - getMinSortOrder(b));
    const sortedGroups: Record<string, any[]> = {};
    for (const type of sortedTypes) {
       sortedGroups[type] = groups[type as keyof typeof groups];
    }
    return sortedGroups;
  }, [accounts]);

  const activeGroupedAccounts = useMemo(() => {
    return Object.entries(groupedAccounts).filter(([_, list]) => list.length > 0);
  }, [groupedAccounts]);

  const getGroupTitle = (type: string) => {
    switch(type) {
      case 'BANK': return { title: 'Bank Accounts', icon: <Landmark className="w-5 h-5" />, color: 'text-brand-blue' };
      case 'CASH': return { title: 'Cash & Wallets', icon: <Wallet className="w-5 h-5" />, color: 'text-brand-green' };
      case 'CREDIT_CARD': return { title: 'Credit Cards', icon: <CreditCard className="w-5 h-5" />, color: 'text-brand-red' };
      default: return { title: 'Other Assets', icon: <MoreHorizontal className="w-5 h-5" />, color: 'text-neutral-400' };
    }
  };

  const getGroupTotal = (accList: any[]) => {
    return roundCurrency(accList.reduce((sum, acc) => sum + (accountBreakdown[acc.id!]?.currentBalance || 0), 0));
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col gap-4 px-1 mb-6 animate-fade-in">
        {/* Title & Top Right Actions */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold text-brand-blue dark:text-[#F7F7F7] tracking-tight">Accounts</h1>
            <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 mt-0.5">Manage your financial accounts, cash & credit lines</p>
          </div>

          {/* Top Right Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Download Report Button */}
            <button
              onClick={() => setIsReportOpen(true)}
              className="w-9 h-9 flex items-center justify-center bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 text-neutral-600 dark:text-neutral-300 rounded-full hover:bg-neutral-50 dark:hover:bg-white/5 transition-all shadow-sm"
              title="Download Statement"
            >
              <Download className="w-4 h-4 text-brand-green" />
            </button>

            {/* Arrange Accounts Button */}
            <button
              onClick={() => setIsReorderOpen(true)}
              className="w-9 h-9 flex items-center justify-center bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 text-neutral-600 dark:text-neutral-300 rounded-full hover:bg-neutral-50 dark:hover:bg-white/5 transition-all shadow-sm"
              title="Arrange Accounts"
            >
              <ArrowUpDown className="w-4 h-4 text-brand-cyan" />
            </button>
          </div>
        </div>

        {/* Action Pills Toolbar - Equally Spaced */}
        <div className="flex w-full gap-2">
          {/* Add Account Pill */}
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-brand-green/10 text-brand-green border border-brand-green/20 dark:border-brand-green/30 rounded-2xl hover:bg-brand-green/20 transition-all font-black uppercase text-[10px] tracking-wider"
            title="Add Account"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Account</span>
          </button>

          {/* Quick Transfer Pill */}
          <button
            onClick={() => navigate('/transfer')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-neutral-50 dark:bg-white/5 border border-neutral-100 dark:border-white/5 text-neutral-600 dark:text-neutral-300 rounded-2xl hover:bg-neutral-100 dark:hover:bg-white/10 transition-all font-bold uppercase text-[10px] tracking-wider"
            title="Quick Transfer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-brand-green" />
            <span>Transfer</span>
          </button>
        </div>
      </div>

        {/* Minimalist Stats Panel */}
        <div 
          onClick={() => isPrivacyMode && setRevealBalances(!revealBalances)}
          className="grid grid-cols-3 gap-2 sm:gap-6 p-4 sm:p-5 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/5 rounded-2xl sm:rounded-3xl shadow-sm cursor-pointer hover:border-neutral-200 dark:hover:border-white/10 transition-all"
        >
          <div className="flex flex-col gap-0.5 sm:gap-1">
            <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">Net Worth</span>
            <p className={cn(
              "text-sm sm:text-lg font-bold text-brand-blue dark:text-white tracking-tight transition-all duration-300",
              shouldBlur && "blur-[5px] select-none"
            )}>
              {formatAmount(totalNetWorth)}
            </p>
          </div>
          
          <div className="flex flex-col gap-0.5 sm:gap-1 border-x border-neutral-100 dark:border-white/5 px-2 sm:px-6">
            <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">Cash</span>
            <p className={cn(
              "text-sm sm:text-lg font-bold text-brand-green tracking-tight transition-all duration-300",
              shouldBlur && "blur-[5px] select-none"
            )}>
              {formatAmount(totalLiquid)}
            </p>
          </div>
          
          <div className="flex flex-col gap-0.5 sm:gap-1 pl-2 sm:pl-6">
            <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">Total Debt</span>
            <p className={cn(
              "text-sm sm:text-lg font-bold text-rose-500 tracking-tight transition-all duration-300",
              shouldBlur && "blur-[5px] select-none"
            )}>
              {formatAmount(totalLiabilities)}
            </p>
          </div>
        </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 bg-[#F9FBFF] dark:bg-[#0C0C0F] z-50 overflow-y-auto"
          >
            <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
              {/* Back Header */}
              <div className="flex items-center gap-3 mb-8">
                <button 
                  onClick={resetForm}
                  className="p-2 bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/5 rounded-full hover:bg-neutral-50 dark:hover:bg-white/10 transition-all text-neutral-600 dark:text-neutral-300"
                >
                  <X className="w-4 h-4" />
                </button>
                <div>
                  <h1 className="text-xl font-heading font-black text-brand-blue dark:text-white uppercase tracking-wider leading-none mb-1">
                    {editingAccountId ? 'Edit Account' : 'New Account'}
                  </h1>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                    {editingAccountId ? 'Update your account configuration' : 'Add a new bank, wallet, or card'}
                  </p>
                </div>
              </div>

              {/* Form Container */}
              <div className="bg-white dark:bg-[#111111] p-6 sm:p-8 rounded-[28px] shadow-sm border border-neutral-100 dark:border-white/5">
                <form onSubmit={handleAddAccount} className="space-y-6">
                  {/* Category Switcher */}
                  <div className="flex bg-neutral-50 dark:bg-[#1A1A1A] p-1 rounded-2xl border border-neutral-100 dark:border-white/5">
                    {(['BANK', 'CASH', 'CREDIT_CARD'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setAccountType(t);
                          if (t === 'CASH' && !bankName) setBankName('Cash Wallet');
                          if (t === 'CASH' && !accountLast4) setAccountLast4('CASH');
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                          accountType === t
                            ? 'bg-brand-green text-white dark:text-brand-blue shadow-sm'
                            : 'text-neutral-400 hover:text-neutral-700 dark:hover:text-white'
                        }`}
                      >
                        {t === 'BANK' && <Landmark className="w-3.5 h-3.5" />}
                        {t === 'CASH' && <Wallet className="w-3.5 h-3.5" />}
                        {t === 'CREDIT_CARD' && <CreditCard className="w-3.5 h-3.5" />}
                        {t.replace('_', ' ')}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-5">
                    {/* Account Name */}
                    <div>
                      <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">
                        {accountType === 'BANK' ? 'Bank Name' : accountType === 'CASH' ? 'Wallet Name' : 'Card Name'}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                          {accountType === 'BANK' && <Landmark className="w-4 h-4" />}
                          {accountType === 'CASH' && <Wallet className="w-4 h-4" />}
                          {accountType === 'CREDIT_CARD' && <CreditCard className="w-4 h-4" />}
                        </div>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder={accountType === 'BANK' ? "e.g., HDFC Bank" : accountType === 'CASH' ? "e.g., Cash Wallet" : "e.g., Amazon Pay ICICI"}
                          className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all placeholder-neutral-300 dark:placeholder-neutral-600"
                          required
                        />
                      </div>

                      {accountType === 'BANK' && (
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 pt-2 -mx-2 px-2 mt-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                          {INDIAN_BANKS.map((bank) => (
                            <button
                              key={bank.id}
                              type="button"
                              onClick={() => setBankName(bank.name)}
                              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full border transition-all duration-200 ${
                                bankName === bank.name
                                  ? 'bg-brand-green/10 text-brand-green border-brand-green/20'
                                  : 'bg-neutral-50/50 dark:bg-white/5 text-neutral-400 border-neutral-100 dark:border-white/5 hover:bg-neutral-100 dark:hover:bg-white/10'
                              }`}
                            >
                              <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center p-0.5 shadow-sm shrink-0 overflow-hidden">
                                <bank.logo className="w-full h-full object-contain" />
                              </div>
                              <span className="text-[8px] font-black uppercase tracking-wider">{bank.id}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dynamic Inputs Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Reference / Last 4 */}
                      <div>
                        <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">Reference / Last 4</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                            <Hash className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type="text"
                            value={accountLast4}
                            onChange={(e) => setAccountLast4(e.target.value)}
                            placeholder="e.g., 1234"
                            className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all placeholder-neutral-300 dark:placeholder-neutral-600"
                            required
                          />
                        </div>
                      </div>

                      {/* Starting / Outstanding Balance */}
                      <div>
                        <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">
                          {accountType === 'CREDIT_CARD' ? 'Outstanding Balance (Owed)' : `Starting Balance (${currency})`}
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500 font-bold text-xs pl-4">
                            {currency}
                          </div>
                          <input
                            type="number"
                            value={startingBalance}
                            onChange={(e) => setStartingBalance(e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all placeholder-neutral-300 dark:placeholder-neutral-600 font-mono"
                            required
                          />
                        </div>
                        {accountType === 'CREDIT_CARD' && (
                          <p className="text-[9px] font-medium text-neutral-400 dark:text-[#A0A0A0] mt-1.5 leading-normal">
                            Enter what you owe. Internally stored as a liability.
                          </p>
                        )}
                      </div>

                      {/* Starting Date */}
                      <div>
                        <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">Starting Date</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <input
                            type="date"
                            value={startingBalanceDate}
                            onChange={(e) => setStartingBalanceDate(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all"
                            required
                          />
                        </div>
                      </div>

                      {/* Credit Card Specific Inputs */}
                      {accountType === 'CREDIT_CARD' && (
                        <>
                          <div>
                            <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">Credit Limit ({currency})</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500 font-bold text-xs pl-4">
                                {currency}
                              </div>
                              <input
                                type="number"
                                value={creditLimit}
                                onChange={(e) => setCreditLimit(e.target.value)}
                                placeholder="e.g., 100000"
                                className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all placeholder-neutral-300 dark:placeholder-neutral-600 font-mono"
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">Statement Date (Day)</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                                <Calendar className="w-3.5 h-3.5" />
                              </div>
                              <input
                                type="number"
                                min="1"
                                max="31"
                                value={statementDate}
                                onChange={(e) => setStatementDate(e.target.value)}
                                placeholder="e.g., 15"
                                className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all placeholder-neutral-300 dark:placeholder-neutral-600"
                                required
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-neutral-400 dark:text-[#A0A0A0] mb-1.5 uppercase tracking-widest">Payment Due Date (Day)</label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 dark:text-neutral-500">
                                <Calendar className="w-3.5 h-3.5" />
                              </div>
                              <input
                                type="number"
                                min="1"
                                max="31"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                placeholder="e.g., 5"
                                className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-xl focus:border-brand-green/30 focus:ring-1 focus:ring-brand-green/30 outline-none text-xs font-bold text-neutral-800 dark:text-neutral-200 transition-all placeholder-neutral-300 dark:placeholder-neutral-600"
                                required
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-6 border-t border-neutral-50 dark:border-white/5">
                    <button 
                      type="button" 
                      onClick={resetForm} 
                      disabled={isSaving}
                      className="px-5 py-2.5 text-[10px] font-bold text-neutral-400 hover:text-neutral-500 uppercase transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSaving || showSuccess}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 ${
                        showSuccess 
                          ? 'bg-emerald-500 text-white dark:text-brand-blue shadow-emerald-500/10' 
                          : 'bg-brand-green text-white dark:text-brand-blue shadow-brand-green/10 hover:brightness-110'
                      } disabled:opacity-70`}
                    >
                      {isSaving ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : showSuccess ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Saved!</span>
                        </>
                      ) : (
                        <span>{editingAccountId ? 'Update Account' : 'Save Account'}</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {activeGroupedAccounts.map(([type, accList], idx) => {
          const { title, icon, color } = getGroupTitle(type);
          const total = getGroupTotal(accList);
          const isCollapsed = isSectionCollapsed(type, idx);
          
          return (
            <div key={type} className="space-y-4 bg-[#F9FBFF] dark:bg-white/[0.01] p-3 sm:p-5 rounded-[28px] border border-brand-blue/5 dark:border-white/5 shadow-sm">
              {/* Clickable Header Card */}
              <div 
                onClick={() => toggleSection(type, idx)}
                className="flex items-center justify-between cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 flex items-center justify-center shadow-sm ${color}`}>{icon}</div>
                  <div>
                    <h2 className="text-sm font-heading font-bold text-brand-blue dark:text-white tracking-tight leading-none mb-1">{title}</h2>
                    <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">{accList.length === 1 ? '1 account' : `${accList.length} accounts`}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                     <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 mb-0.5">Total</p>
                     <p className="text-sm font-heading font-bold text-brand-blue dark:text-white tracking-tight">{currency}{total.toLocaleString('en-IN')}</p>
                  </div>
                  {/* Toggle Button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSection(type, idx);
                    }}
                    className="w-8 h-8 rounded-xl bg-white dark:bg-[#111111] border border-neutral-100 dark:border-white/10 flex items-center justify-center text-neutral-400 dark:text-[#A0A0A0] transition-transform duration-200 shadow-sm"
                    style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Collapsible Accounts List */}
              <AnimatePresence initial={false}>
                {!isCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pt-3 pb-1">
                      {[...accList]
                        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                        .map(account => {
                          const info = accountBreakdown[account.id!];
                          const currentBalance = info?.currentBalance || 0;
                          const isCash = account.type === 'CASH';
                          const isCc = account.type === 'CREDIT_CARD';
                          
                          return (
                            <div 
                              key={account.id} 
                              onClick={() => setSelectedAccountId(account.id!)} 
                              className="group relative bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-sm hover:shadow-md hover:border-brand-green/20 dark:hover:border-white/10 transition-all cursor-pointer overflow-hidden flex flex-col"
                            >
                              <div className="p-5 flex flex-col flex-1">
                                <div className="flex justify-between items-start mb-6">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-neutral-50 dark:bg-white/5 rounded-[20px] flex items-center justify-center p-2.5 border border-neutral-100 dark:border-white/5 shadow-sm shrink-0">
                                      <BankLogo bankName={account.bankName} type={account.type} className="w-full h-full object-contain" />
                                    </div>
                                    <div className="min-w-0">
                                      <h3 className="text-[13px] font-semibold text-brand-blue dark:text-white tracking-tight truncate">{account.bankName}</h3>
                                      <p className={cn("text-[10px] text-neutral-400 dark:text-[#A0A0A0] font-medium mt-0.5", !isCash && "font-mono tracking-wider")}>
                                        {isCash ? 'Total Cash' : `••••   ${account.accountLast4}`}
                                      </p>
                                      {isCc && account.dueDate && (() => {
                                        const daysLeft = getDaysLeftToPay(account.dueDate);
                                        const isUrgent = daysLeft <= 5;
                                        return (
                                          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider mt-1 ${
                                            isUrgent 
                                              ? 'bg-rose-50/10 text-rose-500 border border-rose-500/20' 
                                              : 'bg-neutral-100 dark:bg-white/5 text-neutral-400 dark:text-neutral-500'
                                          }`}>
                                            <span>Due in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</span>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); handleEdit(account); }} className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 dark:text-[#A0A0A0] hover:text-brand-blue dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-white/5 transition-all relative z-10"><Pencil className="w-3.5 h-3.5" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(account.id!); }} className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-400 dark:text-[#A0A0A0] hover:text-brand-red hover:bg-neutral-50 dark:hover:bg-white/5 transition-all relative z-10"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
 
                                <div className="mb-6">
                                  <p className="text-[10px] font-medium text-neutral-400 dark:text-[#A0A0A0] mb-1">
                                    {isCc ? 'Outstanding Balance' : 'Account Balance'}
                                  </p>
                                  <p 
                                    className={cn(
                                      "text-2xl font-bold tracking-tight transition-all duration-300",
                                      currentBalance >= 0 ? (isCc ? 'text-brand-blue dark:text-white' : 'text-brand-green') : 'text-brand-red',
                                      shouldBlur && "blur-[7px] select-none cursor-pointer"
                                    )}
                                    onClick={(e) => { e.stopPropagation(); isPrivacyMode && setRevealBalances(!revealBalances); }}
                                  >
                                    {formatAmount(currentBalance)}
                                  </p>
                                  {isCc && account.creditLimit ? (() => {
                                    const used = Math.abs(currentBalance);
                                    const limit = account.creditLimit;
                                    const available = Math.max(limit - used, 0);
                                    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
                                    const barColor = pct >= 80 ? 'bg-rose-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-green';
                                    
                                    return (
                                      <div className="space-y-2 mt-3 p-3 bg-neutral-50 dark:bg-white/[0.02] rounded-xl border border-neutral-100 dark:border-white/5" onClick={(e) => { e.stopPropagation(); if (isPrivacyMode) setRevealBalances(!revealBalances); }}>
                                        <div className="flex justify-between text-[11px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase tracking-widest">
                                          <span className="flex items-center gap-1">
                                            <span className={cn("inline-block w-1.5 h-1.5 rounded-full", pct >= 80 ? 'bg-rose-500' : pct >= 50 ? 'bg-amber-500' : 'bg-brand-green')}></span>
                                            Used: <span className={cn("text-neutral-700 dark:text-neutral-200 font-bold", shouldBlur && "blur-[4px] select-none")}>{formatAmount(used)}</span>
                                          </span>
                                          <span>Limit: <span className="text-neutral-700 dark:text-neutral-200 font-bold">{formatAmount(limit)}</span></span>
                                        </div>
                                        
                                        <div className="w-full h-1.5 bg-neutral-200/60 dark:bg-white/10 rounded-full overflow-hidden">
                                          <div className={cn("h-full rounded-full transition-all duration-500", barColor)} style={{ width: `${pct}%` }} />
                                        </div>
                                        
                                        <div className="flex justify-between items-center text-[10px] font-bold text-neutral-400 uppercase">
                                          <span>{Math.round(pct)}% Utilized</span>
                                          <span className={cn("text-neutral-500", shouldBlur && "blur-[3px] select-none")}>Available: {formatAmount(available)}</span>
                                        </div>
                                      </div>
                                    );
                                  })() : null}
                                </div>

                                <div className="pt-4 border-t border-neutral-100 dark:border-white/5 flex items-center justify-between mt-auto">
                                  <div className="flex items-center gap-4" onClick={(e) => { e.stopPropagation(); isPrivacyMode && setRevealBalances(!revealBalances); }}>
                                    <div className="flex flex-col">
                                      <span className="text-[7px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase">Inflow</span>
                                      <span className={cn("text-[10px] font-black text-emerald-500 transition-all duration-300", shouldBlur && "blur-[4px] select-none")}>{formatAmount(info?.inflow || 0)}</span>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[7px] font-black text-neutral-400 dark:text-[#A0A0A0] uppercase">Outflow</span>
                                      <span className={cn("text-[10px] font-black text-rose-500 transition-all duration-300", shouldBlur && "blur-[4px] select-none")}>{formatAmount(info?.outflow || 0)}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button 
                                      onClick={e => { e.stopPropagation(); navigate(`/add-money?accountId=${account.id}`); }} 
                                      className="w-9 h-9 rounded-2xl bg-brand-blue dark:bg-white/10 text-white flex items-center justify-center transition-all hover:brightness-105 active:scale-95 border border-transparent dark:border-white/5"
                                      title="Add Transaction"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </button>
                                    <button 
                                      onClick={e => { e.stopPropagation(); setSelectedAccountId(account.id!); }} 
                                      className="w-9 h-9 rounded-2xl bg-brand-green dark:bg-brand-green/20 text-white dark:text-brand-green flex items-center justify-center transition-all hover:brightness-105 active:scale-95"
                                      title="Statement History"
                                    >
                                      <History className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {selectedAccountId && (
         <AccountStatementDetail accountId={selectedAccountId} onClose={() => setSelectedAccountId(null)} />
      )}

      {isReorderOpen && (
        <AccountsReorderModal onClose={() => setIsReorderOpen(false)} />
      )}

      <AnimatePresence>
        {isReportOpen && (
          <AllAccountsStatementModal onClose={() => setIsReportOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function PartitionRow({ partition }: { partition: any }) {
  const currency = useCurrency();
  return (
    <tr className="bg-brand-blue/[0.05] dark:bg-brand-blue/[0.15] border-y border-brand-blue/10 dark:border-brand-blue/30">
      <td colSpan={4} className="px-2 py-2">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2.5">
            <span className="text-[8px] font-semibold text-brand-blue/60 dark:text-white/50 uppercase tracking-[0.2em]">New Start Balance</span>
            <span className="text-[11px] font-semibold text-brand-blue dark:text-white tracking-tight">{currency}{partition.closingBalance.toLocaleString()}</span>
          </div>
        </div>
      </td>
    </tr>
  );
}

function AccountStatementDetail({ accountId, onClose }: { accountId: number, onClose: () => void }) {
  const currency = useCurrency();
  const { confirm } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const account = useLiveQuery(() => db.accounts.get(accountId), [accountId, user?.uid]);
  const transactions = useLiveQuery(() => db.transactions.where('accountId').equals(accountId).sortBy('dateTime'), [accountId, user?.uid]) || [];
  const closings = useLiveQuery(() => db.accountClosings.where('accountId').equals(accountId).sortBy('closingDate'), [accountId, user?.uid]) || [];

  const initialScale = typeof window !== 'undefined' ? window.innerWidth / 800 : 0.8;

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [granularity, setGranularity] = useState<'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM'>('MONTH');
  const [referenceDate, setReferenceDate] = useState(new Date());
  const [customRange, setCustomRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [isProcessingPartition, setIsProcessingPartition] = useState(false);
  const [showPartitionSuccess, setShowPartitionSuccess] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');

  const { startDateLimit, endDateLimit } = useMemo(() => {
    let start = 0;
    let end = Infinity;
    if (granularity !== 'ALL') {
      const d = referenceDate;
      if (granularity === 'DAY') {
        start = startOfDay(d).getTime();
        end = endOfDay(d).getTime();
      } else if (granularity === 'WEEK') {
        start = startOfWeek(d, { weekStartsOn: 1 }).getTime();
        end = endOfWeek(d, { weekStartsOn: 1 }).getTime();
      } else if (granularity === 'MONTH') {
        start = startOfMonth(d).getTime();
        end = endOfMonth(d).getTime();
      } else if (granularity === 'YEAR') {
        start = startOfYear(d).getTime();
        end = endOfYear(d).getTime();
      } else if (granularity === 'CUSTOM') {
        start = startOfDay(new Date(customRange.start)).getTime();
        end = endOfDay(new Date(customRange.end)).getTime();
      }
    }
    return { startDateLimit: start, endDateLimit: end };
  }, [granularity, referenceDate, customRange]);

  const statementData = useMemo(() => {
    if (!account) return [];
    let baseBalance = Number(account.startingBalance) || 0;
    let runningBalance = baseBalance;
    const allSortedTxs = [...transactions].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    const txsBefore = allSortedTxs.filter(tx => new Date(tx.dateTime).getTime() < startDateLimit);
    const txsInView = allSortedTxs.filter(tx => {
      const txTime = new Date(tx.dateTime).getTime();
      return txTime >= startDateLimit && txTime <= endDateLimit;
    });
    txsBefore.forEach(tx => {
      const amount = Number(tx.amount) || 0;
      const txType = normalizeType(tx.type);
      if (txType === 'CREDIT') runningBalance += amount;
      else if (txType === 'DEBIT') runningBalance -= amount;
    });
    return txsInView.map(tx => {
      const amount = Number(tx.amount) || 0;
      const txType = normalizeType(tx.type);
      if (txType === 'CREDIT') runningBalance += amount;
      else if (txType === 'DEBIT') runningBalance -= amount;
      return { ...tx, amount, runningBalance } as Transaction & { runningBalance: number };
    });
  }, [account, transactions, granularity, referenceDate, customRange]);

  const filteredStatementData = useMemo(() => {
    return statementData.filter(tx => {
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const noteMatch = tx.note?.toLowerCase().includes(q);
        const catMatch = tx.category?.toLowerCase().includes(q);
        const partyMatch = tx.party?.toLowerCase().includes(q);
        const tagMatch = tx.expenseType?.toLowerCase().includes(q);
        if (!noteMatch && !catMatch && !partyMatch && !tagMatch) return false;
      }
      return true;
    });
  }, [statementData, typeFilter, searchTerm]);

  const totalCredit = roundCurrency(statementData.filter(t => normalizeType(t.type) === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0));
  const totalDebit = roundCurrency(statementData.filter(t => normalizeType(t.type) === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0));

  const actualTotalBalance = useMemo(() => {
    let bal = Number(account?.startingBalance) || 0;
    transactions.forEach(tx => {
       const txType = normalizeType(tx.type);
       if (txType === 'CREDIT') bal += (Number(tx.amount) || 0);
       else if (txType === 'DEBIT') bal -= (Number(tx.amount) || 0);
    });
    return bal;
  }, [account?.startingBalance, transactions]);

  const openingBalanceForView = useMemo(() => {
    if (!account) return 0;
    let bal = Number(account.startingBalance) || 0;
    if (granularity === 'ALL') return bal;
    
    const allSortedTxs = [...transactions].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    const txsBefore = allSortedTxs.filter(tx => new Date(tx.dateTime).getTime() < startDateLimit);
    
    txsBefore.forEach(tx => {
       const amount = Number(tx.amount) || 0;
       const txType = normalizeType(tx.type);
       if (txType === 'CREDIT') bal += amount;
       else if (txType === 'DEBIT') bal -= amount;
    });
    return bal;
  }, [account, transactions, granularity, startDateLimit]);

  const currentViewStateBalance = openingBalanceForView + totalCredit - totalDebit;

  const chartData = useMemo(() => {
    if (statementData.length === 0) {
      return [{ date: 'Start', Balance: openingBalanceForView }];
    }
    const sorted = [...statementData].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    const pts = sorted.map(tx => ({
      date: format(new Date(tx.dateTime), 'dd MMM'),
      Balance: tx.runningBalance
    }));
    return [{ date: 'Start', Balance: openingBalanceForView }, ...pts];
  }, [statementData, openingBalanceForView]);

  const downloadCSV = () => {
    if (!account) return;
    const headers = ['Date', 'Particulars', 'Debit', 'Credit', 'Balance'];
    const rows = statementData.map(tx => [
      format(new Date(tx.dateTime), 'yyyy-MM-dd HH:mm'),
      (tx.note || tx.category || '').toUpperCase(),
      normalizeType(tx.type) === 'DEBIT' ? tx.amount : '',
      normalizeType(tx.type) === 'CREDIT' ? tx.amount : '',
      tx.runningBalance
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${account.bankName}_Statement_${format(new Date(), 'dd_MMM_yyyy')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const downloadPDF = async () => {
    if (!account) return;
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width || 210;
    const pageHeight = doc.internal.pageSize.height || 297;

    let periodStr = 'All Time';
    if (granularity === 'MONTH') periodStr = format(referenceDate, 'MMMM yyyy');
    else if (granularity === 'YEAR') periodStr = format(referenceDate, 'yyyy');
    else if (granularity === 'WEEK') periodStr = `Week of ${format(startOfWeek(referenceDate, { weekStartsOn: 1 }), 'dd MMM yyyy')}`;
    else if (granularity === 'DAY') periodStr = format(referenceDate, 'dd MMM yyyy');
    else if (granularity === 'CUSTOM') periodStr = `${format(new Date(customRange.start), 'dd MMM yyyy')} - ${format(new Date(customRange.end), 'dd MMM yyyy')}`;

    const pdfCurr = (!currency || currency === '₹' || /[^\x00-\x7F]/.test(currency)) ? 'Rs. ' : `${currency} `;

    // Header Accent Bar
    doc.setFillColor(26, 35, 126); // Brand Blue (#1A237E)
    doc.rect(0, 0, pageWidth, 12, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(26, 35, 126);
    doc.text('ACCOUNT STATEMENT', 14, 25);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 35, 126); // Brand Blue
    doc.text(`${account.bankName} ${account.type === 'CASH' ? '(CASH)' : `(•••• ${account.accountLast4})`}`, 14, 31);

    // Right Side Metadata
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Period: ${periodStr}`, pageWidth - 14, 25, { align: 'right' });
    doc.text(`Generated On: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, pageWidth - 14, 31, { align: 'right' });

    // Line Divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 35, pageWidth - 14, 35);

    // Financial Summary Cards (4 Cards)
    const boxY = 40;
    const boxHeight = 18;
    const margin = 14;
    const totalW = pageWidth - margin * 2;
    const cardW = (totalW - 18) / 4;

    // Box 1: Opening Balance
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, boxY, cardW, boxHeight, 2, 2, 'F');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('OPENING BALANCE', margin + 4, boxY + 6);
    doc.setFontSize(10);
    doc.text(`${pdfCurr}${openingBalanceForView.toLocaleString('en-IN')}`, margin + 4, boxY + 14);

    // Box 2: Total Credits (Inflow)
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(margin + cardW + 6, boxY, cardW, boxHeight, 2, 2, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(22, 101, 52);
    doc.text('TOTAL INFLOW (+)', margin + cardW + 10, boxY + 6);
    doc.setFontSize(10);
    doc.text(`+${pdfCurr}${totalCredit.toLocaleString('en-IN')}`, margin + cardW + 10, boxY + 14);

    // Box 3: Total Debits (Outflow)
    doc.setFillColor(254, 242, 242);
    doc.roundedRect(margin + (cardW + 6) * 2, boxY, cardW, boxHeight, 2, 2, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(153, 27, 27);
    doc.text('TOTAL OUTFLOW (-)', margin + (cardW + 6) * 2 + 10, boxY + 6);
    doc.setFontSize(10);
    doc.text(`-${pdfCurr}${totalDebit.toLocaleString('en-IN')}`, margin + (cardW + 6) * 2 + 10, boxY + 14);

    // Box 4: Closing Balance
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(margin + (cardW + 6) * 3, boxY, cardW, boxHeight, 2, 2, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(49, 46, 129);
    doc.text('CLOSING BALANCE', margin + (cardW + 6) * 3 + 10, boxY + 6);
    doc.setFontSize(10);
    doc.text(`${pdfCurr}${currentViewStateBalance.toLocaleString('en-IN')}`, margin + (cardW + 6) * 3 + 10, boxY + 14);

    // Table Data
    const headers = ['Date', 'Particulars / Note', 'Category', 'Debit (Dr)', 'Credit (Cr)', 'Balance'];
    const rows = statementData.map(tx => {
      const type = normalizeType(tx.type);
      const amount = Number(tx.amount) || 0;
      return [
        format(new Date(tx.dateTime), 'dd MMM yyyy'),
        (tx.note || tx.type || '-').toUpperCase(),
        tx.category || '-',
        type === 'DEBIT' ? `${pdfCurr}${amount.toLocaleString('en-IN')}` : '-',
        type === 'CREDIT' ? `${pdfCurr}${amount.toLocaleString('en-IN')}` : '-',
        `${pdfCurr}${tx.runningBalance.toLocaleString('en-IN')}`
      ];
    });

    autoTable(doc, {
      startY: 65,
      head: [headers],
      body: rows,
      theme: 'striped',
      headStyles: {
        fillColor: [26, 35, 126],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: 4
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 3.5,
        overflow: 'linebreak',
        textColor: [30, 41, 59]
      },
      columnStyles: {
        0: { cellWidth: 24 },
        3: { halign: 'right', textColor: [220, 38, 38] },
        4: { halign: 'right', textColor: [22, 163, 74] },
        5: { halign: 'right', fontStyle: 'bold' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      didDrawPage: (data) => {
        const str = `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
        doc.text('Computer generated official bank account statement. No signature required.', 14, pageHeight - 6);
        doc.text(str, pageWidth - 14, pageHeight - 6, { align: 'right' });
      }
    });

    doc.save(`${account.bankName}_Statement_${periodStr.replace(/ /g, '_')}.pdf`);
    setShowExportMenu(false);
  };

  const handleStartNewBalance = async () => {
    if (!account) return;
    const confirmReset = await confirm(`Start a new balance period using the current balance?`);
    if (!confirmReset) return;

    setIsProcessingPartition(true);
    try {
      // Use current time or 1ms after last tx
      const lastTxTime = transactions.length > 0 
        ? new Date(transactions[transactions.length - 1].dateTime).getTime() 
        : (account.startingBalanceDate ? new Date(account.startingBalanceDate).getTime() : 0);
      const partitionTime = Math.max(lastTxTime + 1, Date.now());

      const lastClosing = closings.length > 0 ? closings[closings.length - 1] : null;
      const startLimit = lastClosing ? new Date(lastClosing.closingDate).getTime() : (account.startingBalanceDate ? new Date(account.startingBalanceDate).getTime() : 0);
      const liveTxs = transactions.filter(tx => new Date(tx.dateTime).getTime() > startLimit);
      const inflow = roundCurrency(liveTxs.filter(t => normalizeType(t.type) === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0));
      const outflow = roundCurrency(liveTxs.filter(t => normalizeType(t.type) === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0));
      const opening = lastClosing ? lastClosing.closingBalance : account.startingBalance;

      await db.accountClosings.add({
        accountId: account.id!,
        closingDate: new Date(partitionTime),
        closingBalance: actualTotalBalance,
        periodName: format(new Date(partitionTime), 'dd MMM yyyy'),
        openingBalance: opening,
        totalInflow: inflow,
        totalOutflow: outflow
      });

      setShowPartitionSuccess(true);
      setTimeout(() => {
        setShowPartitionSuccess(false);
        setIsProcessingPartition(false);
      }, 700);
    } catch (err) {
      console.error(err);
      setIsProcessingPartition(false);
    }
  };

  const handleCreatePartitionAt = async (targetTx: Transaction & { runningBalance: number }) => {
    if (!account) return;
    const confirmReset = await confirm(`Start a new balance period from this transaction?`);
    if (!confirmReset) return;
    const partitionTime = new Date(targetTx.dateTime).getTime() + 1;
    const prevClosing = [...closings].filter(c => new Date(c.closingDate).getTime() < partitionTime).sort((a,b) => new Date(b.closingDate).getTime() - new Date(a.closingDate).getTime())[0];
    const startLimit = prevClosing ? new Date(prevClosing.closingDate).getTime() : (account.startingBalanceDate ? new Date(account.startingBalanceDate).getTime() : 0);
    const periodTxs = transactions.filter(tx => {
        const time = new Date(tx.dateTime).getTime();
        return time > startLimit && time < partitionTime;
    });
    const inflow = roundCurrency(periodTxs.filter(t => normalizeType(t.type) === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0));
    const outflow = roundCurrency(periodTxs.filter(t => normalizeType(t.type) === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0));
    const opening = prevClosing ? prevClosing.closingBalance : account.startingBalance;
    await db.accountClosings.add({
      accountId: account.id!,
      closingDate: new Date(partitionTime),
      closingBalance: targetTx.runningBalance,
      periodName: format(new Date(partitionTime), 'dd MMM yyyy HH:mm'),
      openingBalance: opening,
      totalInflow: inflow,
      totalOutflow: outflow
    });
  };

  if (!account) return null;

  return (
    <div className="fixed inset-0 bg-[#F9FBFF] dark:bg-[#0C0C0F] z-[9999] flex flex-col overflow-hidden animate-fade-in" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Compact Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-[#111111] border-b border-neutral-100 dark:border-white/5 shadow-sm shrink-0 z-10">
        <div className="flex items-center gap-2.5 pl-1">
          <button onClick={onClose} className="p-1 -ml-1 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-heading font-bold text-brand-blue dark:text-white text-sm leading-none">Account Statement</h2>
            <p className="text-[10px] font-medium text-neutral-400 mt-0.5">{account.bankName}</p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-50 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10 transition-colors" title="Export">
              <Download className="w-4 h-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-neutral-200 shadow-xl rounded-xl overflow-hidden z-[9999]">
                <button onClick={() => { downloadPDF(); setShowExportMenu(false); }} className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-neutral-50 text-neutral-800 flex items-center gap-2 border-b border-neutral-100 transition-colors">
                  <FileText className="w-4 h-4 text-rose-500" /> PDF Document
                </button>
                <button onClick={() => { downloadCSV(); setShowExportMenu(false); }} className="w-full px-4 py-3 text-left text-xs font-bold hover:bg-neutral-50 text-neutral-800 flex items-center gap-2 transition-colors">
                  <FileText className="w-4 h-4 text-green-500" /> CSV Spreadsheet
                </button>
              </div>
            )}
          </div>
          <button 
            onClick={handleStartNewBalance} 
            disabled={isProcessingPartition || showPartitionSuccess}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-70 ${showPartitionSuccess ? 'bg-emerald-500 text-white' : 'bg-neutral-50 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10'}`}
            title={showPartitionSuccess ? 'Closed!' : isProcessingPartition ? 'Reconciling...' : 'Close Period'}
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
          <button onClick={() => setShowFilterMenu(true)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${showFilterMenu ? 'bg-brand-blue text-white' : 'bg-neutral-50 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10'}`} title="Filters">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Zoomable PDF-like Document Area */}
      <div className="flex-1 overflow-hidden bg-neutral-100/50 dark:bg-black/80 relative">
        <TransformWrapper initialScale={initialScale} minScale={initialScale} maxScale={3} limitToBounds={true} panning={{ velocityDisabled: true }}>
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
            {/* The Document */}
            <div 
              className="bg-white text-black w-[800px] h-[var(--doc-height)] print:h-auto print:min-h-[1131px] flex flex-col shadow-xl m-0 relative print:m-0 print:shadow-none" 
              style={{ fontFamily: '"Inter", "Satoshi", sans-serif', '--doc-height': `calc((100vh - 48px) / ${initialScale})` } as React.CSSProperties}
            >
              <div className="shrink-0 p-8 md:p-12 pb-4 print:p-0 print:pb-4">
              {/* Doc Header & Top Controls */}
              <div className="flex justify-between items-end pb-5 mb-5 border-b border-neutral-200 relative">
                {/* Left: Bank Info */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 border border-neutral-200/80 bg-neutral-50/50 rounded-2xl flex items-center justify-center p-2 shadow-sm">
                    <BankLogo bankName={account.bankName} type={account.type} className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-heading font-black text-brand-blue uppercase tracking-tight">{account.bankName}</h1>
                  </div>
                </div>


                {/* Print Only Period Label */}
                <div className="hidden print:block text-right">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Period</p>
                  <h2 className="text-sm font-black text-brand-blue">
                    {granularity === 'YEAR' && format(referenceDate, 'yyyy')}
                    {granularity === 'MONTH' && format(referenceDate, 'MMMM yyyy')}
                    {granularity === 'WEEK' && `Week of ${format(startOfWeek(referenceDate, { weekStartsOn: 1 }), 'MMM d')}`}
                    {granularity === 'DAY' && format(referenceDate, 'MMM d, yyyy')}
                    {granularity === 'ALL' && 'All Time'}
                  </h2>
                </div>
              </div>

              {/* Summary Metrics Row */}
              <div className="flex gap-4 mb-8 justify-end flex-wrap">
                <div className="flex items-center gap-3 bg-neutral-50/50 border border-neutral-100/80 rounded-2xl px-4 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Opening</p>
                    <p className="text-sm font-black text-brand-blue leading-none">{currency}{openingBalanceForView.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-emerald-50/50 border border-emerald-100/50 rounded-2xl px-4 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <ArrowDownLeft className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Inflow</p>
                    <p className="text-sm font-black text-emerald-600 leading-none">+{currency}{totalCredit.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-rose-50/50 border border-rose-100/50 rounded-2xl px-4 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Outflow</p>
                    <p className="text-sm font-black text-rose-600 leading-none">-{currency}{totalDebit.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-brand-blue/5 border border-brand-blue/10 rounded-2xl px-4 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-brand-blue/60 uppercase tracking-widest mb-0.5">Closing</p>
                    <p className="text-sm font-black text-brand-blue leading-none">{currency}{currentViewStateBalance.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>

              </div>
              {/* Transactions Table */}
              <div 
                className="flex-1 overflow-auto w-full px-8 md:px-12 pb-8 print:px-0 print:pb-0 print:overflow-visible print:h-auto"
                onWheelCapture={(e) => e.stopPropagation()} 
                onTouchMoveCapture={(e) => e.stopPropagation()}
              >
                <table className="w-full text-left text-sm border-separate border-spacing-0 border-t border-l border-neutral-200">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 w-28 border-r border-neutral-200 border-b-2 border-black">Date</th>
                    <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 border-r border-neutral-200 border-b-2 border-black">Particulars</th>
                    <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 w-56 border-r border-neutral-200 border-b-2 border-black">Remarks</th>
                    <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 text-right w-28 border-r border-neutral-200 border-b-2 border-black">Amount</th>
                    <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 text-right w-28 border-r border-neutral-200 border-b-2 border-black">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {granularity === 'ALL' && (
                    <tr className="bg-neutral-50">
                      <td className="px-3 py-4 whitespace-nowrap text-xs font-bold text-neutral-500 uppercase tracking-wider border-r border-b border-neutral-200">
                        {account.startingBalanceDate ? format(new Date(account.startingBalanceDate), 'dd MMM yyyy') : '-'}
                      </td>
                      <td className="px-3 py-4 text-sm font-black text-brand-blue uppercase tracking-widest border-r border-b border-neutral-200">
                        System Start Balance
                      </td>
                      <td className="px-3 py-4 text-neutral-400 text-sm border-r border-b border-neutral-200">-</td>
                      <td className="px-3 py-4 text-right text-neutral-400 text-sm border-r border-b border-neutral-200">-</td>
                      <td className="px-3 py-4 text-right whitespace-nowrap text-sm font-black text-brand-blue border-r border-b border-neutral-200">{currency}{account.startingBalance.toLocaleString('en-IN')}</td>
                    </tr>
                  )}

                  {filteredStatementData.length > 0 ? filteredStatementData.map((tx, idx) => {
                    const txTime = new Date(tx.dateTime).getTime();
                    const originalIdx = statementData.findIndex(t => t.id === tx.id);
                    const prevTxTime = originalIdx > 0 
                      ? new Date(statementData[originalIdx - 1].dateTime).getTime() 
                      : (account.startingBalanceDate ? new Date(account.startingBalanceDate).getTime() : 0);
                    
                    const matchingClosings = closings.filter(c => {
                      const cTime = new Date(c.closingDate).getTime();
                      return cTime > prevTxTime && cTime <= txTime;
                    });

                    return (
                      <React.Fragment key={tx.id}>
                        {matchingClosings.map(c => (
                          <PartitionRow key={c.id} partition={c} />
                        ))}
                        <tr onDoubleClick={() => handleCreatePartitionAt(tx)} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-3 py-4 whitespace-nowrap text-xs font-bold text-neutral-600 uppercase tracking-wider border-r border-b border-neutral-200">{format(new Date(tx.dateTime), 'dd MMM HH:mm')}</td>
                          <td className="px-3 py-4 text-sm font-bold text-neutral-800 border-r border-b border-neutral-200">{tx.party || '-'}</td>
                          <td className="px-3 py-4 text-xs font-medium text-neutral-500 italic max-w-[200px] truncate border-r border-b border-neutral-200">{tx.note || '-'}</td>
                          <td className={`px-3 py-4 text-right whitespace-nowrap text-sm font-black border-r border-b border-neutral-200 ${normalizeType(tx.type) === 'CREDIT' ? 'text-emerald-600' : 'text-rose-600'}`}>{normalizeType(tx.type) === 'CREDIT' ? '+' : '-'}{currency}{tx.amount.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-4 text-right whitespace-nowrap text-sm font-black text-brand-blue border-r border-b border-neutral-200">{currency}{tx.runningBalance.toLocaleString('en-IN')}</td>
                        </tr>
                      </React.Fragment>
                    );
                  }) : (
                    <tr>
                      <td colSpan={5} className="py-16 text-center text-neutral-400 font-medium border-b border-r border-neutral-200">No transactions found for this period</td>
                    </tr>
                  )}

                  {(() => {
                      const lastTxTimeInView = filteredStatementData.length > 0 
                          ? new Date(filteredStatementData[filteredStatementData.length - 1].dateTime).getTime() 
                          : (account.startingBalanceDate ? new Date(account.startingBalanceDate).getTime() : 0);
                      
                      const trailingClosings = closings.filter(c => {
                          const cTime = new Date(c.closingDate).getTime();
                          return cTime > lastTxTimeInView && cTime <= endDateLimit;
                      });

                      return trailingClosings.map(c => (
                          <PartitionRow key={c.id} partition={c} />
                      ));
                  })()}
                </tbody>
              </table>
              </div>
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* Slide-out Filter Panel */}
      <AnimatePresence>
        {showFilterMenu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilterMenu(false)}
              className="absolute inset-0 bg-black/40 z-20"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute top-0 right-0 bottom-0 w-80 max-w-full bg-white dark:bg-[#111111] z-30 shadow-2xl flex flex-col"
            >
              <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex flex-col gap-4 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-black uppercase text-sm">Statement Filters</h3>
                  <button onClick={() => setShowFilterMenu(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-white/5">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4 overflow-y-auto space-y-6 flex-1">
                {/* Search Input */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-3">Search</h4>
                  <div className="relative w-full">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search notes, category, tags..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-10 pl-9 pr-8 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-white/10 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-blue/15 dark:focus:ring-white/5 transition-all text-brand-blue dark:text-white"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Granularity */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-3">Time Period</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {(['ALL', 'YEAR', 'MONTH', 'WEEK', 'DAY', 'CUSTOM'] as const).map((g) => (
                      <button 
                        key={g} 
                        onClick={() => setGranularity(g)} 
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${granularity === g ? 'bg-brand-blue border-brand-blue text-white' : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300'}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Flow Tabs */}
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-neutral-400 mb-3">Transaction Type</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {(['ALL', 'CREDIT', 'DEBIT'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setTypeFilter(f)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${
                          typeFilter === f
                            ? (f === 'CREDIT' ? 'bg-emerald-600 border-emerald-600 text-white' : f === 'DEBIT' ? 'bg-rose-600 border-rose-600 text-white' : 'bg-brand-blue border-brand-blue text-white')
                            : 'border-neutral-200 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300'
                        }`}
                      >
                        {f === 'CREDIT' ? 'Inflow' : f === 'DEBIT' ? 'Outflow' : 'All'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-neutral-100 dark:border-white/5 shrink-0 bg-neutral-50 dark:bg-[#0C0C0F]">
                <button onClick={() => setShowFilterMenu(false)} className="w-full py-3 bg-brand-blue text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all">Apply Filters</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── ACCOUNTS REORDER MODAL ──────────────────────────────────────────────────
function AccountsReorderModal({ onClose }: { onClose: () => void }) {
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const [localAccounts, setLocalAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (accounts.length > 0 && localAccounts.length === 0) {
      const sorted = [...accounts].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      setLocalAccounts(sorted);
    }
  }, [accounts, localAccounts.length]);

  const handleSave = async () => {
    try {
      await db.transaction('rw', db.accounts, async () => {
        for (let i = 0; i < localAccounts.length; i++) {
          const acc = localAccounts[i];
          if (acc.id) {
            await db.accounts.update(acc.id, { sortOrder: i + 1 });
          }
        }
      });
      onClose();
    } catch (err) {
      console.error('Failed to save accounts order:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white dark:bg-[#111111] rounded-[24px] border border-neutral-100 dark:border-[#222222] shadow-2xl p-6 max-w-md w-full mx-4 animate-scale-up">
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-neutral-50 dark:border-white/5">
          <h3 className="text-sm font-heading font-black text-brand-blue dark:text-white uppercase tracking-wider">Arrange Accounts Order</h3>
          <button onClick={onClose} className="text-[10px] font-black text-neutral-400 dark:text-neutral-500 hover:text-brand-red uppercase tracking-wider transition-colors">Cancel</button>
        </div>

        {localAccounts.length === 0 ? (
          <p className="text-[10px] text-center text-neutral-400 py-10 uppercase tracking-widest font-bold">No accounts found</p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto no-scrollbar pr-1 -mx-2 px-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            <p className="text-[9px] font-bold text-neutral-400 mb-3 uppercase tracking-widest text-center">Drag and drop to reorder</p>
            <Reorder.Group axis="y" values={localAccounts} onReorder={setLocalAccounts} className="space-y-2 pb-2">
              {localAccounts.map(acc => {
                const isCash = acc.type === 'CASH';
                return (
                  <Reorder.Item 
                    key={acc.id} 
                    value={acc}
                    className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#1A1A1A] border border-neutral-100 dark:border-white/5 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow relative z-0"
                  >
                    <div className="flex items-center gap-3 min-w-0 pointer-events-none">
                      <div className="w-8 h-8 bg-neutral-50 dark:bg-white/5 rounded-lg flex items-center justify-center p-1.5 shadow-sm shrink-0 border border-neutral-100 dark:border-white/5">
                        <BankLogo bankName={acc.bankName} type={acc.type} className="w-full h-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-neutral-800 dark:text-white truncate uppercase tracking-tight leading-none mb-0.5">{acc.bankName}</p>
                        <p className="text-[8px] font-bold text-neutral-400 font-mono">
                          {isCash ? 'TOTAL CASH' : `•••• ${acc.accountLast4}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-neutral-400 cursor-grab">
                      <div className="w-7 h-7 flex items-center justify-center bg-neutral-50 dark:bg-white/5 rounded-lg">
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-neutral-50 dark:border-white/5">
          <button onClick={onClose} className="px-4 py-2 text-[10px] font-bold text-neutral-400 hover:text-neutral-500 uppercase transition-colors">Cancel</button>
          <button onClick={handleSave} className="px-5 py-2 bg-brand-green text-white dark:text-brand-blue rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-brand-green/10 transition-all hover:brightness-110 active:scale-95">Save Order</button>
        </div>
      </div>
    </div>
  );
}
