const fs = require('fs');
const path = require('path');

const filesToFix = [
  path.join(__dirname, 'src/screens/Accounts.tsx'),
  path.join(__dirname, 'src/components/TransactionsStatementModal.tsx')
];

let replacedCount = 0;

for (const filePath of filesToFix) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix document wrapper
  content = content.replace(
    /className="bg-white text-black w-\[1000px\] h-\[var\(--doc-height\)\]/g,
    'className="bg-white dark:bg-[#1C1C1E] text-black dark:text-neutral-200 w-[1000px] h-[var(--doc-height)]'
  );

  // Fix Period text
  content = content.replace(
    /<p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">Period<\/p>/g,
    '<p className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest mb-1">Period</p>'
  );
  content = content.replace(
    /<h1 className="text-2xl font-heading font-black text-brand-blue">/g,
    '<h1 className="text-2xl font-heading font-black text-brand-blue dark:text-blue-400">'
  );

  // Fix Summary Metrics
  content = content.replace(
    /<div className="bg-neutral-50\/90 border border-neutral-200\/80 rounded-2xl p-2.5 mb-6 grid grid-cols-3 divide-x divide-neutral-200\/80 shadow-sm">/g,
    '<div className="bg-neutral-50/90 dark:bg-white/5 border border-neutral-200/80 dark:border-white/10 rounded-2xl p-2.5 mb-6 grid grid-cols-3 divide-x divide-neutral-200/80 dark:divide-white/10 shadow-sm">'
  );
  
  // Total Inflow Text
  content = content.replace(
    /<span className="text-\[10px\] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">Total Inflow<\/span>/g,
    '<span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-0.5">Total Inflow</span>'
  );
  content = content.replace(
    /<span className="text-lg font-black text-emerald-600 tracking-tight">/g,
    '<span className="text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tight">'
  );
  content = content.replace(
    /bg-emerald-500\/10 text-emerald-600/g,
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
  );

  // Total Outflow Text
  content = content.replace(
    /<span className="text-\[10px\] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">Total Outflow<\/span>/g,
    '<span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-0.5">Total Outflow</span>'
  );
  content = content.replace(
    /<span className="text-lg font-black text-rose-600 tracking-tight">/g,
    '<span className="text-lg font-black text-rose-600 dark:text-rose-400 tracking-tight">'
  );
  content = content.replace(
    /bg-rose-500\/10 text-rose-600/g,
    'bg-rose-500/10 text-rose-600 dark:text-rose-400'
  );

  // Net Flow Text
  content = content.replace(
    /<span className="text-\[10px\] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">Net Flow<\/span>/g,
    '<span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-0.5">Net Flow</span>'
  );
  content = content.replace(
    /text-brand-blue border-brand-blue\/20/g,
    'text-brand-blue dark:text-blue-400 border-brand-blue/20'
  );
  content = content.replace(
    /text-brand-blue' : 'text-rose-600'/g,
    "text-brand-blue dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'"
  );

  // Opening & Closing text in AccountStatementDetail
  content = content.replace(
    /<span className="text-\[9px\] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">Opening<\/span>/g,
    '<span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-0.5">Opening</span>'
  );
  content = content.replace(
    /<span className="text-sm font-black text-neutral-800 tracking-tight">/g,
    '<span className="text-sm font-black text-neutral-800 dark:text-neutral-200 tracking-tight">'
  );
  content = content.replace(
    /<span className="text-\[9px\] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">Inflow<\/span>/g,
    '<span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-0.5">Inflow</span>'
  );
  content = content.replace(
    /<span className="text-sm font-black text-emerald-600 tracking-tight">/g,
    '<span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tracking-tight">'
  );
  content = content.replace(
    /<span className="text-\[9px\] font-bold uppercase tracking-wider text-neutral-400 block mb-0.5">Outflow<\/span>/g,
    '<span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 block mb-0.5">Outflow</span>'
  );
  content = content.replace(
    /<span className="text-sm font-black text-rose-600 tracking-tight">/g,
    '<span className="text-sm font-black text-rose-600 dark:text-rose-400 tracking-tight">'
  );
  content = content.replace(
    /<span className="text-\[9px\] font-bold uppercase tracking-wider text-brand-blue\/60 block mb-0.5">Closing<\/span>/g,
    '<span className="text-[9px] font-bold uppercase tracking-wider text-brand-blue/60 dark:text-blue-400/60 block mb-0.5">Closing</span>'
  );
  content = content.replace(
    /<span className="text-sm font-black text-brand-blue tracking-tight">/g,
    '<span className="text-sm font-black text-brand-blue dark:text-blue-400 tracking-tight">'
  );

  // Table header cells
  content = content.replace(
    /bg-white py-3 px-3 font-black uppercase tracking-wider text-xs border-b border-neutral-200/g,
    'bg-white dark:bg-[#1C1C1E] py-3 px-3 font-black uppercase tracking-wider text-xs border-b border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-300'
  );
  content = content.replace(
    /bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-right border-b border-neutral-200/g,
    'bg-white dark:bg-[#1C1C1E] py-3 px-3 font-black uppercase tracking-wider text-xs text-right border-b border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-neutral-300'
  );
  
  // Specific AccountStatementDetail header cells which already have text-neutral-800
  content = content.replace(
    /bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 w-28 border-b border-neutral-200/g,
    'bg-white dark:bg-[#1C1C1E] py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 dark:text-neutral-300 w-28 border-b border-neutral-200 dark:border-white/10'
  );
  content = content.replace(
    /bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 border-b border-neutral-200/g,
    'bg-white dark:bg-[#1C1C1E] py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 dark:text-neutral-300 border-b border-neutral-200 dark:border-white/10'
  );
  content = content.replace(
    /bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 w-56 border-b border-neutral-200/g,
    'bg-white dark:bg-[#1C1C1E] py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 dark:text-neutral-300 w-56 border-b border-neutral-200 dark:border-white/10'
  );
  content = content.replace(
    /bg-white py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 text-right w-28 border-b border-neutral-200/g,
    'bg-white dark:bg-[#1C1C1E] py-3 px-3 font-black uppercase tracking-wider text-xs text-neutral-800 dark:text-neutral-300 text-right w-28 border-b border-neutral-200 dark:border-white/10'
  );

  // Table rows
  content = content.replace(
    /even:bg-\[#F8F9FF\] hover:bg-blue-50\/50 transition-colors/g,
    'even:bg-[#F8F9FF] dark:even:bg-white/5 hover:bg-blue-50/50 dark:hover:bg-white/10 transition-colors'
  );

  // Table cell text (Date, Category, Payment Method)
  content = content.replace(
    /className="py-3 px-3 font-medium whitespace-nowrap"/g,
    'className="py-3 px-3 font-medium whitespace-nowrap text-neutral-800 dark:text-neutral-200"'
  );
  content = content.replace(
    /className="py-3 px-3 font-medium"/g,
    'className="py-3 px-3 font-medium text-neutral-800 dark:text-neutral-200"'
  );
  content = content.replace(
    /className="py-3 px-3 font-bold"/g,
    'className="py-3 px-3 font-bold text-neutral-800 dark:text-neutral-200"'
  );
  content = content.replace(
    /className="py-3 px-3 font-medium text-brand-blue"/g,
    'className="py-3 px-3 font-medium text-brand-blue dark:text-blue-400"'
  );
  content = content.replace(
    /className="py-3 px-3 text-neutral-600 max-w-\[200px\] truncate"/g,
    'className="py-3 px-3 text-neutral-600 dark:text-neutral-400 max-w-[200px] truncate"'
  );
  content = content.replace(
    /className="py-3 px-3 text-neutral-600"/g,
    'className="py-3 px-3 text-neutral-600 dark:text-neutral-400"'
  );

  // Table cell text (AccountStatementDetail)
  content = content.replace(
    /className="px-3 py-4 text-sm font-bold text-neutral-800"/g,
    'className="px-3 py-4 text-sm font-bold text-neutral-800 dark:text-neutral-200"'
  );
  content = content.replace(
    /className="px-3 py-4 whitespace-nowrap text-xs font-bold text-neutral-600 uppercase tracking-wider"/g,
    'className="px-3 py-4 whitespace-nowrap text-xs font-bold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider"'
  );
  content = content.replace(
    /className="px-3 py-4 text-xs font-medium text-neutral-500 italic max-w-\[200px\] truncate"/g,
    'className="px-3 py-4 text-xs font-medium text-neutral-500 dark:text-neutral-400 italic max-w-[200px] truncate"'
  );

  // No transactions text
  content = content.replace(
    /className="py-12 text-center text-neutral-400 font-medium border-b border-neutral-200"/g,
    'className="py-12 text-center text-neutral-400 dark:text-neutral-500 font-medium border-b border-neutral-200 dark:border-white/10"'
  );
  content = content.replace(
    /className="py-16 text-center text-neutral-400 font-medium border-b border-neutral-200"/g,
    'className="py-16 text-center text-neutral-400 dark:text-neutral-500 font-medium border-b border-neutral-200 dark:border-white/10"'
  );

  // Footer
  content = content.replace(
    /className="shrink-0 pt-3 pb-6 px-8 border-t border-neutral-200 flex justify-end items-center w-full print:px-0"/g,
    'className="shrink-0 pt-3 pb-6 px-8 border-t border-neutral-200 dark:border-white/10 flex justify-end items-center w-full print:px-0"'
  );

  // Export Menu
  content = content.replace(
    /w-48 bg-white border border-neutral-100 shadow-2xl shadow-black\/10/g,
    'w-48 bg-white dark:bg-[#2C2C2E] border border-neutral-100 dark:border-white/5 shadow-2xl shadow-black/10'
  );
  content = content.replace(
    /hover:bg-rose-50 text-neutral-800 font-bold flex items-center gap-3 border-b border-neutral-100/g,
    'hover:bg-rose-50 dark:hover:bg-rose-500/10 text-neutral-800 dark:text-neutral-200 font-bold flex items-center gap-3 border-b border-neutral-100 dark:border-white/5'
  );
  content = content.replace(
    /hover:bg-emerald-50 text-neutral-800/g,
    'hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-neutral-800 dark:text-neutral-200'
  );

  // Filter Panel Background Fix
  content = content.replace(
    /bg-neutral-50\/30/g,
    'bg-neutral-50/30 dark:bg-white/5'
  );
  content = content.replace(
    /bg-white shadow-sm text-brand-blue/g,
    'bg-white dark:bg-[#2C2C2E] shadow-sm text-brand-blue dark:text-blue-400'
  );
  content = content.replace(
    /bg-neutral-100\/80/g,
    'bg-neutral-100/80 dark:bg-white/5'
  );
  // Transaction Type Filters etc
  content = content.replace(
    /bg-neutral-100 text-neutral-600 hover:bg-neutral-200/g,
    'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-white/10'
  );

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${filePath}`);
}
