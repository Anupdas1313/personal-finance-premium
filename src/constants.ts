export const CATEGORIES = ['Food', 'Transport', 'Rent', 'Shopping', 'Bills', 'Entertainment', 'Salary', 'Transfer', 'Groceries', 'Travel', 'Health', 'Investment', 'Loan', 'Housing', 'Education', 'Donations', 'Other'];

export const CATEGORY_ICONS: Record<string, string> = {
  'Food': '🍔',
  'Transport': '🚗',
  'Rent': '🏠',
  'Shopping': '🛍️',
  'Bills': '⚡',
  'Entertainment': '🎬',
  'Salary': '💰',
  'Transfer': '💸',
  'Groceries': '🛒',
  'Travel': '✈️',
  'Health': '💊',
  'Investment': '📈',
  'Loan': '🏦',
  'Housing': '🏡',
  'Education': '📚',
  'Donations': '🙏',
  'Other': '📝'
};

export const UPI_APPS_LIST = [
  'Google Pay (GPay)',
  'PhonePe',
  'Paytm',
  'BHIM UPI',
  'CRED',
  'Amazon Pay',
  'Jupiter',
  'Fi Money',
  'WhatsApp Pay',
  'Super.money',
  'Navi UPI',
  'Slice',
  'Mobikwik',
  'Freecharge',
  'Tata Neu',
  'Bajaj Pay',
  'Airtel Payments Bank',
  'JioPay',
  'YONO SBI',
  'iMobile Pay (ICICI)',
  'HDFC PayZapp',
  'Kotak Mahindra Bank',
  'Axis Mobile (PayAuto)',
  'BOB World (Baroda)',
  'Canara ai1',
  'IndusInd Pockets'
];

export const UPI_APP_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  'Google Pay (GPay)': { icon: '🌐', bg: 'bg-blue-500/10 dark:bg-blue-500/20', color: 'text-blue-600 dark:text-blue-400' },
  'GPay': { icon: '🌐', bg: 'bg-blue-500/10 dark:bg-blue-500/20', color: 'text-blue-600 dark:text-blue-400' },
  'PhonePe': { icon: '🟣', bg: 'bg-purple-500/10 dark:bg-purple-500/20', color: 'text-purple-600 dark:text-purple-400' },
  'Paytm': { icon: '🔷', bg: 'bg-sky-500/10 dark:bg-sky-500/20', color: 'text-sky-600 dark:text-sky-400' },
  'BHIM UPI': { icon: '🇮🇳', bg: 'bg-orange-500/10 dark:bg-orange-500/20', color: 'text-orange-600 dark:text-orange-400' },
  'BHIM': { icon: '🇮🇳', bg: 'bg-orange-500/10 dark:bg-orange-500/20', color: 'text-orange-600 dark:text-orange-400' },
  'CRED': { icon: '⚡', bg: 'bg-neutral-800/10 dark:bg-white/10', color: 'text-neutral-800 dark:text-neutral-200' },
  'Amazon Pay': { icon: '📦', bg: 'bg-amber-500/10 dark:bg-amber-500/20', color: 'text-amber-600 dark:text-amber-400' },
  'Jupiter': { icon: '🪐', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', color: 'text-emerald-600 dark:text-emerald-400' },
  'Fi Money': { icon: '🟢', bg: 'bg-teal-500/10 dark:bg-teal-500/20', color: 'text-teal-600 dark:text-teal-400' },
  'WhatsApp Pay': { icon: '💬', bg: 'bg-green-500/10 dark:bg-green-500/20', color: 'text-green-600 dark:text-green-400' },
  'Super.money': { icon: '🚀', bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', color: 'text-indigo-600 dark:text-indigo-400' },
  'Navi UPI': { icon: '🧭', bg: 'bg-lime-500/10 dark:bg-lime-500/20', color: 'text-lime-600 dark:text-lime-400' },
  'Slice': { icon: '🍕', bg: 'bg-violet-500/10 dark:bg-violet-500/20', color: 'text-violet-600 dark:text-violet-400' },
  'Mobikwik': { icon: '💙', bg: 'bg-cyan-500/10 dark:bg-cyan-500/20', color: 'text-cyan-600 dark:text-cyan-400' },
  'Freecharge': { icon: '⚡', bg: 'bg-orange-500/10 dark:bg-orange-500/20', color: 'text-orange-600 dark:text-orange-400' },
  'Tata Neu': { icon: '💎', bg: 'bg-rose-500/10 dark:bg-rose-500/20', color: 'text-rose-600 dark:text-rose-400' },
  'Bajaj Pay': { icon: '🛡️', bg: 'bg-blue-600/10 dark:bg-blue-600/20', color: 'text-blue-700 dark:text-blue-300' },
  'Airtel Payments Bank': { icon: '🔴', bg: 'bg-red-500/10 dark:bg-red-500/20', color: 'text-red-600 dark:text-red-400' },
  'JioPay': { icon: '🔵', bg: 'bg-blue-500/10 dark:bg-blue-500/20', color: 'text-blue-600 dark:text-blue-400' },
  'YONO SBI': { icon: '🏛️', bg: 'bg-blue-700/10 dark:bg-blue-700/20', color: 'text-blue-700 dark:text-blue-400' },
  'iMobile Pay (ICICI)': { icon: '🏦', bg: 'bg-amber-600/10 dark:bg-amber-600/20', color: 'text-amber-700 dark:text-amber-400' },
  'HDFC PayZapp': { icon: '💳', bg: 'bg-blue-800/10 dark:bg-blue-800/20', color: 'text-blue-800 dark:text-blue-400' },
  'Kotak Mahindra Bank': { icon: '📕', bg: 'bg-red-600/10 dark:bg-red-600/20', color: 'text-red-700 dark:text-red-400' },
  'Axis Mobile (PayAuto)': { icon: '🏛️', bg: 'bg-pink-700/10 dark:bg-pink-700/20', color: 'text-pink-700 dark:text-pink-400' },
  'BOB World (Baroda)': { icon: '🌅', bg: 'bg-orange-600/10 dark:bg-orange-600/20', color: 'text-orange-700 dark:text-orange-400' },
  'Canara ai1': { icon: '🟡', bg: 'bg-yellow-500/10 dark:bg-yellow-500/20', color: 'text-yellow-600 dark:text-yellow-400' },
  'IndusInd Pockets': { icon: '🦁', bg: 'bg-red-800/10 dark:bg-red-800/20', color: 'text-red-800 dark:text-red-400' },
};

export function getUpiAppIcon(appName: string): { icon: string; bg: string; color: string } {
  if (!appName) return { icon: '📱', bg: 'bg-neutral-50 dark:bg-[#222222]', color: 'text-brand-blue dark:text-[#F7F7F7]' };
  if (UPI_APP_ICONS[appName]) return UPI_APP_ICONS[appName];
  
  const lower = appName.toLowerCase();
  if (lower.includes('gpay') || lower.includes('google pay')) return UPI_APP_ICONS['Google Pay (GPay)'];
  if (lower.includes('phonepe') || lower.includes('phone pe')) return UPI_APP_ICONS['PhonePe'];
  if (lower.includes('paytm')) return UPI_APP_ICONS['Paytm'];
  if (lower.includes('bhim')) return UPI_APP_ICONS['BHIM UPI'];
  if (lower.includes('cred')) return UPI_APP_ICONS['CRED'];
  if (lower.includes('amazon')) return UPI_APP_ICONS['Amazon Pay'];
  if (lower.includes('jupiter')) return UPI_APP_ICONS['Jupiter'];
  if (lower.includes('fi')) return UPI_APP_ICONS['Fi Money'];
  if (lower.includes('whatsapp')) return UPI_APP_ICONS['WhatsApp Pay'];
  if (lower.includes('super')) return UPI_APP_ICONS['Super.money'];
  if (lower.includes('navi')) return UPI_APP_ICONS['Navi UPI'];
  if (lower.includes('slice')) return UPI_APP_ICONS['Slice'];
  if (lower.includes('mobikwik')) return UPI_APP_ICONS['Mobikwik'];
  if (lower.includes('freecharge')) return UPI_APP_ICONS['Freecharge'];
  if (lower.includes('tata') || lower.includes('neu')) return UPI_APP_ICONS['Tata Neu'];
  if (lower.includes('bajaj')) return UPI_APP_ICONS['Bajaj Pay'];
  if (lower.includes('airtel')) return UPI_APP_ICONS['Airtel Payments Bank'];
  if (lower.includes('jio')) return UPI_APP_ICONS['JioPay'];
  if (lower.includes('sbi') || lower.includes('yono')) return UPI_APP_ICONS['YONO SBI'];
  if (lower.includes('icici') || lower.includes('imobile')) return UPI_APP_ICONS['iMobile Pay (ICICI)'];
  if (lower.includes('hdfc') || lower.includes('payzapp')) return UPI_APP_ICONS['HDFC PayZapp'];
  if (lower.includes('kotak')) return UPI_APP_ICONS['Kotak Mahindra Bank'];
  if (lower.includes('axis')) return UPI_APP_ICONS['Axis Mobile (PayAuto)'];
  if (lower.includes('bob') || lower.includes('baroda')) return UPI_APP_ICONS['BOB World (Baroda)'];
  if (lower.includes('canara')) return UPI_APP_ICONS['Canara ai1'];
  if (lower.includes('indusind')) return UPI_APP_ICONS['IndusInd Pockets'];

  return { icon: '📱', bg: 'bg-neutral-50 dark:bg-[#222222]', color: 'text-brand-blue dark:text-[#F7F7F7]' };
}
