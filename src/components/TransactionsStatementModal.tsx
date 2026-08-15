import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Filter, Share2, Download, FileText, ArrowDownLeft, ArrowUpRight, ArrowRightLeft, X, Check } from 'lucide-react';
import { Transaction, normalizeType, Account } from '../models/db';
import { useCurrency } from '../hooks/useCurrency';

interface TransactionsStatementModalProps {
  filteredTxs: Transaction[];
  totals: { income: number; expense: number };
  periodText: string;
  accountsMap: Record<string, Account>;
  onClose: () => void;
}

export function TransactionsStatementModal({
  filteredTxs,
  totals,
  periodText,
  accountsMap,
  onClose
}: TransactionsStatementModalProps) {
  const currency = useCurrency();
  const touchStart = React.useRef({ x: 0, y: 0 });
  
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [showAccountCol, setShowAccountCol] = useState(true);
  const [showCategoryCol, setShowCategoryCol] = useState(true);
  const [showTagCol, setShowTagCol] = useState(true);
  const [showRemarksCol, setShowRemarksCol] = useState(true);
  const [showPaymentMethodCol, setShowPaymentMethodCol] = useState(true);

  const getAccountName = (id: number) => {
    return accountsMap[String(id)]?.bankName || 'Unknown';
  };

  const handleDownloadCSV = () => {
    const headers = ['Date'];
    if (showAccountCol) headers.push('Account');
    if (showCategoryCol) headers.push('Category');
    if (showTagCol) headers.push('Tag');
    if (showRemarksCol) headers.push('Remarks');
    if (showPaymentMethodCol) headers.push('Method');
    headers.push('Outflow', 'Inflow');

    const rows = filteredTxs.map(tx => {
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
    link.setAttribute('download', `Filtered_Transactions_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
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

    const pdfCurr = (!currency || currency === '₹' || /[^\x00-\x7F]/.test(currency)) ? 'Rs. ' : `${currency} `;

    // Header Background Accent Bar
    doc.setFillColor(26, 35, 126); // Brand Blue (#1A237E)
    doc.rect(0, 0, pageWidth, 12, 'F');

    // App/Company Header Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(26, 35, 126);
    doc.text('TRANSACTIONS STATEMENT', 14, 25);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Filtered Activity Report', 14, 31);

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
    doc.text(`+${pdfCurr}${totals.income.toLocaleString('en-IN')}`, margin + 6, boxY + 14);

    // Card 2: Total Outflow
    doc.setFillColor(254, 242, 242); // light red
    doc.roundedRect(margin + cardW + 6, boxY, cardW, boxHeight, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(153, 27, 27);
    doc.text('TOTAL OUTFLOW', margin + cardW + 6 + 6, boxY + 6);
    doc.setFontSize(11);
    doc.text(`-${pdfCurr}${totals.expense.toLocaleString('en-IN')}`, margin + cardW + 6 + 6, boxY + 14);

    // Card 3: Net Movement
    const netFlow = totals.income - totals.expense;
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

    const rows = filteredTxs.map(tx => {
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
      didDrawPage: (data: any) => {
        const str = `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184);
        doc.setDrawColor(226, 232, 240);
        doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
        doc.text('Computer generated filtered statement. No signature required.', 14, pageHeight - 6);
        doc.text(str, pageWidth - 14, pageHeight - 6, { align: 'right' });
      }
    });
    
    return doc;
  };

  const handleDownloadPDF = async () => {
    const doc = await generatePDFDoc();
    doc.save(`Filtered_Transactions_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
  };

  const handleSharePDF = async () => {
    const doc = await generatePDFDoc();
    const pdfBlob = doc.output('blob');
    const filename = `Filtered_Transactions_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `Transactions Statement`,
          text: `Here is the filtered transactions statement for ${periodText}.`
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

  const initialScale = window.innerWidth / 1000;

  return createPortal(
    <div className="fixed inset-0 bg-[#F9FBFF] dark:bg-[#0C0C0F] z-[9999] flex flex-col overflow-hidden animate-fade-in">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-[#111111] border-b border-neutral-100 dark:border-white/5 shadow-sm shrink-0 z-10">
        <div className="flex items-center gap-2.5 pl-1">
          <button onClick={onClose} className="p-1 -ml-1 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-heading font-bold text-brand-blue dark:text-white text-sm leading-none">Statement Preview</h2>
            <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Based on current filters</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button onClick={() => setIsSettingsOpen(true)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isSettingsOpen ? 'bg-brand-blue text-white' : 'bg-neutral-50 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-white/10'}`}>
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Zoomable PDF-like Document Area */}
      <div className="flex-1 overflow-hidden bg-neutral-100/50 dark:bg-black/80 relative">
        <TransformWrapper initialScale={initialScale} minScale={initialScale} maxScale={3} limitToBounds={true} panning={{ velocityDisabled: true }}>
          <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
            <div 
              className="bg-white text-black w-[1000px] h-[var(--doc-height)] print:h-auto print:min-h-[1414px] flex flex-col shadow-xl m-0 relative print:m-0 print:shadow-none" 
              style={{ fontFamily: '"Inter", "Satoshi", sans-serif', '--doc-height': `calc((100vh - 48px) / ${initialScale})` } as React.CSSProperties}
            >
              <div className="shrink-0 p-8 pb-4 print:p-0 print:pb-4">
              <div className="flex justify-between items-center border-b border-neutral-300 pb-4 mb-6 relative">
                <div>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Period</p>
                  <h1 className="text-2xl font-heading font-black text-brand-blue">{periodText}</h1>
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
                            onClick={() => { handleDownloadPDF(); setShowExportMenu(false); }}
                            className="w-full text-left px-5 py-3 text-sm hover:bg-rose-50 text-neutral-800 font-bold flex items-center gap-3 border-b border-neutral-100 transition-colors group"
                          >
                            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                              <FileText className="w-4 h-4 text-rose-600" />
                            </div>
                            PDF Format
                          </button>
                          <button
                            onClick={() => { handleDownloadCSV(); setShowExportMenu(false); }}
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
              
              <div className="bg-neutral-50/90 border border-neutral-200/80 rounded-2xl p-2.5 mb-6 grid grid-cols-3 divide-x divide-neutral-200/80 shadow-sm">
                <div className="px-5 py-2 flex items-center justify-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-xs">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">Total Inflow</span>
                    <span className="text-lg font-black text-emerald-600 tracking-tight">+{currency}{totals.income.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="px-5 py-2 flex items-center justify-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 border border-rose-500/20 shadow-xs">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">Total Outflow</span>
                    <span className="text-lg font-black text-rose-600 tracking-tight">-{currency}{totals.expense.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="px-5 py-2 flex items-center justify-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${totals.income >= totals.expense ? 'bg-brand-blue/10 text-brand-blue border-brand-blue/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'}`}>
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">Net Flow</span>
                    <span className={`text-lg font-black tracking-tight ${totals.income >= totals.expense ? 'text-brand-blue' : 'text-rose-600'}`}>
                      {totals.income >= totals.expense ? '+' : '-'}{currency}{Math.abs(totals.income - totals.expense).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
              </div>

              <div 
                className="flex-1 overflow-auto w-full px-8 pb-4 print:px-0 print:pb-0 print:overflow-visible print:h-auto"
                onWheelCapture={(e) => e.stopPropagation()} 
                onTouchStartCapture={(e) => {
                  if (e.touches.length === 1) {
                    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                  }
                }}
                onTouchMoveCapture={(e) => {
                  if (e.touches.length === 1) {
                    const dx = Math.abs(e.touches[0].clientX - touchStart.current.x);
                    const dy = Math.abs(e.touches[0].clientY - touchStart.current.y);
                    if (dy > dx) e.stopPropagation();
                  }
                }}
              >
                <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-b border-neutral-200">Date</th>
                    {showAccountCol && <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-b border-neutral-200">Account</th>}
                    {showCategoryCol && <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-b border-neutral-200">Category</th>}
                    {showTagCol && <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-b border-neutral-200">Tag</th>}
                    {showRemarksCol && <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-b border-neutral-200">Remarks</th>}
                    {showPaymentMethodCol && <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-b border-neutral-200">Method</th>}
                    <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-right border-b border-neutral-200">Outflow</th>
                    <th className="sticky top-0 z-20 bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-right border-b border-neutral-200">Inflow</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTxs.length > 0 ? filteredTxs.map((tx, idx) => {
                    const type = normalizeType(tx.type);
                    const amount = Number(tx.amount) || 0;
                    return (
                      <tr key={idx} className="even:bg-[#F8F9FF] hover:bg-blue-50/50 transition-colors">
                        <td className="py-3 px-3 font-medium whitespace-nowrap">{format(new Date(tx.dateTime), 'dd MMM yy')}</td>
                        {showAccountCol && <td className="py-3 px-3 font-bold">{getAccountName(tx.accountId)}</td>}
                        {showCategoryCol && <td className="py-3 px-3 font-medium">{tx.category || '-'}</td>}
                        {showTagCol && <td className="py-3 px-3 font-medium text-brand-blue">{tx.expenseType || '-'}</td>}
                        {showRemarksCol && <td className="py-3 px-3 text-neutral-600 max-w-[200px] truncate" title={tx.note || tx.type}>{tx.note || tx.type}</td>}
                        {showPaymentMethodCol && <td className="py-3 px-3 text-neutral-600">{tx.paymentMethod || '-'}</td>}
                        <td className="py-3 px-3 text-right font-medium text-rose-600 whitespace-nowrap">{type === 'DEBIT' ? amount.toLocaleString('en-IN') : '-'}</td>
                        <td className="py-3 px-3 text-right font-medium text-emerald-600 whitespace-nowrap">{type === 'CREDIT' ? amount.toLocaleString('en-IN') : '-'}</td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-neutral-400 font-medium border-b border-neutral-200">No transactions to show</td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
              <div className="shrink-0 pt-3 pb-6 px-8 border-t border-neutral-200 flex justify-end items-center w-full print:px-0">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Page 1 of 1</p>
              </div>
            </div>
          </TransformComponent>
        </TransformWrapper>

        <AnimatePresence>
          {isSettingsOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSettingsOpen(false)}
                className="absolute inset-0 bg-black/40 z-20"
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute top-0 right-0 bottom-0 w-80 max-w-full bg-white dark:bg-[#111111] z-30 shadow-2xl flex flex-col"
              >
                <div className="p-4 border-b border-neutral-100 dark:border-white/5 flex flex-col gap-4 shrink-0 bg-neutral-50/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading font-black text-brand-blue text-lg leading-none">Columns</h3>
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Visible Fields</p>
                    </div>
                    <button onClick={() => setIsSettingsOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {[
                    { id: 'account', label: 'Account', state: showAccountCol, setter: setShowAccountCol },
                    { id: 'category', label: 'Category', state: showCategoryCol, setter: setShowCategoryCol },
                    { id: 'tag', label: 'Tag', state: showTagCol, setter: setShowTagCol },
                    { id: 'remarks', label: 'Remarks', state: showRemarksCol, setter: setShowRemarksCol },
                    { id: 'method', label: 'Payment Method', state: showPaymentMethodCol, setter: setShowPaymentMethodCol }
                  ].map(col => (
                    <label key={col.id} className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border ${col.state ? 'bg-brand-blue/5 border-brand-blue/20' : 'bg-neutral-50 dark:bg-white/5 border-neutral-200 dark:border-white/10 hover:border-brand-blue/30'}`}>
                      <span className={`text-xs font-bold ${col.state ? 'text-brand-blue dark:text-brand-cyan' : 'text-neutral-700 dark:text-neutral-300'}`}>{col.label}</span>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${col.state ? 'bg-brand-blue border-brand-blue text-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                        {col.state && <Check className="w-3 h-3" />}
                      </div>
                      <input type="checkbox" checked={col.state} onChange={() => col.setter(!col.state)} className="hidden" />
                    </label>
                  ))}
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
