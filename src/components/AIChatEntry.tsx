import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Bot, CheckCircle2, Sparkles, Landmark, Lightbulb,
  ChevronRight, Hash, AppWindow, Pencil, Mic, MicOff, X,
  RotateCcw, Clock, Zap, TrendingUp, Camera, Image as ImageIcon
} from 'lucide-react';
import { format, subDays, subWeeks } from 'date-fns';
import { CATEGORY_ICONS } from '../constants';
import { db } from '../models/db';
import { useCategories } from '../hooks/useCategories';

interface AIChatEntryProps {
  onSave: (transaction: any) => void;
  accounts: any[];
  tags: string[];
  isSaving?: boolean;
  showSuccess?: boolean;
}

type ChatStage = 'IDLE' | 'ASK_AMOUNT' | 'ASK_TYPE' | 'ASK_BANK' | 'ASK_PAYMENT_METHOD'
  | 'ASK_UPI_APP' | 'ASK_CATEGORY' | 'ASK_TAG' | 'ASK_PAYEE' | 'ASK_NOTE' | 'ASK_DATE' | 'PREVIEW';

// ─── Emoji → Category Shortcuts ──────────────────────────────────────────
const EMOJI_CATEGORY: Record<string, string> = {
  '🍕': 'Food', '🍔': 'Food', '🍜': 'Food', '🥘': 'Food', '☕': 'Food', '🍩': 'Food',
  '🚗': 'Transport', '🛵': 'Transport', '🚌': 'Transport', '✈️': 'Travel', '🚂': 'Travel',
  '🛒': 'Groceries', '🛍️': 'Shopping', '👗': 'Shopping', '👟': 'Shopping',
  '💊': 'Health', '🏥': 'Health', '🏋️': 'Health',
  '📺': 'Bills', '📱': 'Bills', '💡': 'Bills',
  '📚': 'Education', '🎓': 'Education',
  '🎬': 'Entertainment', '🎮': 'Entertainment', '🎵': 'Entertainment',
  '🏠': 'Housing', '🏡': 'Housing',
  '💰': 'Investment', '📈': 'Investment',
};

const EMOJI_TAG: Record<string, string> = {
  '💼': 'Work', '🏢': 'Work', '🏠': 'Household', '👤': 'Personal',
};

// ─── Merchant Knowledge Base ──────────────────────────────────────────────
const MERCHANT_KNOWLEDGE: Record<string, { category: string; tag: string }> = {
  zomato: { category: 'Food', tag: 'Personal' },
  swiggy: { category: 'Food', tag: 'Personal' },
  blinkit: { category: 'Groceries', tag: 'Personal' },
  zepto: { category: 'Groceries', tag: 'Personal' },
  dunzo: { category: 'Groceries', tag: 'Personal' },
  bigbasket: { category: 'Groceries', tag: 'Personal' },
  grofers: { category: 'Groceries', tag: 'Personal' },
  jiomart: { category: 'Groceries', tag: 'Personal' },
  instamart: { category: 'Groceries', tag: 'Personal' },
  starbucks: { category: 'Food', tag: 'Personal' },
  mcdonalds: { category: 'Food', tag: 'Personal' },
  dominos: { category: 'Food', tag: 'Personal' },
  domino: { category: 'Food', tag: 'Personal' },
  kfc: { category: 'Food', tag: 'Personal' },
  subway: { category: 'Food', tag: 'Personal' },
  'pizza hut': { category: 'Food', tag: 'Personal' },
  pizzahut: { category: 'Food', tag: 'Personal' },
  'burger king': { category: 'Food', tag: 'Personal' },
  burgerking: { category: 'Food', tag: 'Personal' },
  chai: { category: 'Food', tag: 'Personal' },
  coffee: { category: 'Food', tag: 'Personal' },
  cafe: { category: 'Food', tag: 'Personal' },
  uber: { category: 'Transport', tag: 'Personal' },
  ola: { category: 'Transport', tag: 'Personal' },
  rapido: { category: 'Transport', tag: 'Personal' },
  irctc: { category: 'Transport', tag: 'Personal' },
  makemytrip: { category: 'Travel', tag: 'Personal' },
  goibibo: { category: 'Travel', tag: 'Personal' },
  redbus: { category: 'Travel', tag: 'Personal' },
  cleartrip: { category: 'Travel', tag: 'Personal' },
  ixigo: { category: 'Travel', tag: 'Personal' },
  petrol: { category: 'Transport', tag: 'Personal' },
  fuel: { category: 'Transport', tag: 'Personal' },
  diesel: { category: 'Transport', tag: 'Personal' },
  metro: { category: 'Transport', tag: 'Personal' },
  amazon: { category: 'Shopping', tag: 'Personal' },
  flipkart: { category: 'Shopping', tag: 'Personal' },
  myntra: { category: 'Shopping', tag: 'Personal' },
  meesho: { category: 'Shopping', tag: 'Personal' },
  ajio: { category: 'Shopping', tag: 'Personal' },
  nykaa: { category: 'Shopping', tag: 'Personal' },
  snapdeal: { category: 'Shopping', tag: 'Personal' },
  netflix: { category: 'Bills', tag: 'Personal' },
  hotstar: { category: 'Bills', tag: 'Personal' },
  disney: { category: 'Bills', tag: 'Personal' },
  primevideo: { category: 'Bills', tag: 'Personal' },
  spotify: { category: 'Entertainment', tag: 'Personal' },
  jio: { category: 'Bills', tag: 'Personal' },
  airtel: { category: 'Bills', tag: 'Personal' },
  vi: { category: 'Bills', tag: 'Personal' },
  bsnl: { category: 'Bills', tag: 'Personal' },
  electricity: { category: 'Bills', tag: 'Household' },
  water: { category: 'Bills', tag: 'Household' },
  gas: { category: 'Bills', tag: 'Household' },
  pharmeasy: { category: 'Health', tag: 'Personal' },
  netmeds: { category: 'Health', tag: 'Personal' },
  apollo: { category: 'Health', tag: 'Personal' },
  medplus: { category: 'Health', tag: 'Personal' },
  medicine: { category: 'Health', tag: 'Personal' },
  pharmacy: { category: 'Health', tag: 'Personal' },
  hospital: { category: 'Health', tag: 'Personal' },
  doctor: { category: 'Health', tag: 'Personal' },
  gym: { category: 'Health', tag: 'Personal' },
  insurance: { category: 'Bills', tag: 'Personal' },
  lic: { category: 'Bills', tag: 'Personal' },
  mutual: { category: 'Investment', tag: 'Personal' },
  zerodha: { category: 'Investment', tag: 'Personal' },
  groww: { category: 'Investment', tag: 'Personal' },
  loan: { category: 'Loan', tag: 'Personal' },
  emi: { category: 'Loan', tag: 'Personal' },
  rent: { category: 'Housing', tag: 'Household' },
  lenskart: { category: 'Shopping', tag: 'Personal' },
};

// ─── UPI Apps ─────────────────────────────────────────────────────────────
const UPI_APPS: Record<string, string> = {
  gpay: 'GPay', 'google pay': 'GPay', googlepay: 'GPay',
  phonepe: 'PhonePe', 'phone pe': 'PhonePe',
  paytm: 'Paytm', bhim: 'BHIM', cred: 'CRED',
  slice: 'Slice', amazonpay: 'Amazon Pay', 'amazon pay': 'Amazon Pay',
  mobikwik: 'MobiKwik',
};

// ─── Bank Nicknames ───────────────────────────────────────────────────────
const BANK_NICKNAMES: Record<string, string> = {
  sbi: 'state bank', pnb: 'punjab national', hdfc: 'hdfc bank',
  icici: 'icici bank', axis: 'axis bank', kotak: 'kotak mahindra',
  bob: 'bank of baroda', canara: 'canara bank', yes: 'yes bank',
  indusind: 'indusind bank', idfc: 'idfc', rbl: 'rbl bank',
};

// ─── Fuzzy Match (Levenshtein distance) ─────────────────────────────────
const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
};

const fuzzyMatch = (input: string, candidates: string[]): string | null => {
  const t = input.toLowerCase().trim();
  if (!t || t.length < 3) return null;
  let best = { word: '', dist: Infinity };
  for (const c of candidates) {
    const dist = levenshtein(t, c);
    const threshold = Math.max(1, Math.floor(c.length / 4));
    if (dist < best.dist && dist <= threshold) best = { word: c, dist };
  }
  return best.word || null;
};

// ─── Date Parser ──────────────────────────────────────────────────────────
const parseDate = (text: string): { date: string; confirmed: boolean } => {
  const t = text.toLowerCase();
  const now = new Date();
  if (t.match(/\b(today|aaj|abhi)\b/)) return { date: format(now, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  if (t.match(/\b(yesterday|kal)\b/)) return { date: format(subDays(now, 1), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  if (t.match(/\b(parso|day before yesterday)\b/)) return { date: format(subDays(now, 2), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  const daysAgo = t.match(/(\d+)\s+days?\s+ago/);
  if (daysAgo) return { date: format(subDays(now, parseInt(daysAgo[1])), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  if (t.includes('last week')) return { date: format(subWeeks(now, 1), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  for (let i = 0; i < weekdays.length; i++) {
    if (t.includes(`last ${weekdays[i]}`)) {
      const diff = (now.getDay() - i + 7) % 7 || 7;
      return { date: format(subDays(now, diff), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
    }
  }
  const dayNum = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dayNum) {
    const day = parseInt(dayNum[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      if (d <= now) return { date: format(d, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
    }
  }
  const slashDate = text.match(/\b(\d{1,2})[\/\-](\d{1,2})\b/);
  if (slashDate) {
    const d = new Date(now.getFullYear(), parseInt(slashDate[2]) - 1, parseInt(slashDate[1]));
    if (d <= now) return { date: format(d, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  }
  return { date: format(now, "yyyy-MM-dd'T'HH:mm"), confirmed: false };
};

// ─── Amount Parser ────────────────────────────────────────────────────────
const parseAmount = (text: string): string => {
  const t = text.toLowerCase().replace(/,/g, '');

  // Math: "150 + 200" or "1200 / 3"
  const mathMatch = t.match(/\b(\d+(?:\.\d+)?)\s*([+*/-])\s*(\d+(?:\.\d+)?)\b/);
  if (mathMatch) {
    const a = parseFloat(mathMatch[1]);
    const op = mathMatch[2];
    const b = parseFloat(mathMatch[3]);
    let res = a;
    if (op === '+') res = a + b;
    else if (op === '-') res = a - b;
    else if (op === '*') res = a * b;
    else if (op === '/') res = a / b;
    return String(res);
  }

  // Split: "split 1200 3 ways" or "split 1200 with rahul" (assumes / 2)
  const splitWaysMatch = t.match(/split\s+(\d+(?:\.\d+)?)\s+(\d+)\s+ways?/i);
  if (splitWaysMatch) {
    return String(parseFloat(splitWaysMatch[1]) / parseFloat(splitWaysMatch[2]));
  }
  const splitWithMatch = t.match(/split\s+(\d+(?:\.\d+)?)\s+with\s+/i);
  if (splitWithMatch) {
    return String(parseFloat(splitWithMatch[1]) / 2);
  }

  const kMatch = t.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return String(parseFloat(kMatch[1]) * 1000);
  const lakhMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:l(?:akh)?)\b/i);
  if (lakhMatch) return String(parseFloat(lakhMatch[1]) * 100000);
  const rsMatch = t.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
  if (rsMatch) return rsMatch[1];
  const numMatch = t.match(/\b(\d+(?:\.\d+)?)\b/);
  return numMatch ? numMatch[1] : '';
};

// ─── Multi-transaction split ──────────────────────────────────────────────
const splitMultiTransaction = (text: string): string[] => {
  // "200 zomato and 150 uber" → ["200 zomato", "150 uber"]
  const parts = text.split(/\s+and\s+|\s*,\s*/i).filter(p => p.trim().length > 2 && /\d/.test(p));
  return parts.length > 1 ? parts : [];
};

// ─── Resolve bank account ────────────────────────────────────────────────
const resolveBank = (snippet: string, accounts: any[]) => {
  const s = snippet.toLowerCase();
  for (const acc of accounts) {
    const name = acc.bankName.toLowerCase();
    if (s.includes(name)) return acc;
    const words = name.split(/[\s-]+/);
    const acronym = words.filter((w: string) => w.length > 1).map((w: string) => w[0]).join('');
    if (acronym.length > 1 && s.match(new RegExp(`\\b${acronym}\\b`, 'i'))) return acc;
    for (const [nick, main] of Object.entries(BANK_NICKNAMES)) {
      if (s.includes(nick) && name.includes(main)) return acc;
    }
  }
  // Fuzzy match bank names
  const bankNames = accounts.map(a => a.bankName.toLowerCase());
  const fuzzy = fuzzyMatch(s, bankNames);
  if (fuzzy) return accounts.find(a => a.bankName.toLowerCase() === fuzzy) || null;
  return null;
};

// ─── Universal Parser ────────────────────────────────────────────────────
const parseUniversal = (text: string, accounts: any[], appCategories: string[]) => {
  const t = text.toLowerCase();

  // Emoji shortcuts
  let emojiCategory = '', emojiTag = '';
  for (const [em, cat] of Object.entries(EMOJI_CATEGORY)) { if (t.includes(em)) { emojiCategory = cat; break; } }
  for (const [em, tag] of Object.entries(EMOJI_TAG)) { if (t.includes(em)) { emojiTag = tag; break; } }

  const amount = parseAmount(text);

  let type = '';
  if (t.match(/\b(received|got|salary|income|credit|added|deposit|inflow|credited|mila|aaya)\b/)) type = 'CREDIT';
  else if (t.match(/\b(transfer(?:red)?|moved?|sent|send|shifted|bheja)\b/)) type = 'TRANSFER';
  else if (t.match(/\b(paid|spent|bought|expense|debit|gave|withdrawn?|purchased?|kharcha|diya|de diya)\b/)) type = 'DEBIT';

  const acc = resolveBank(t, accounts);
  let accountId = acc?.id || '';
  let autoPaymentMethod = acc ? (acc.type === 'CREDIT_CARD' ? 'Credit Card' : acc.type === 'CASH' ? 'Cash' : 'UPI') : '';

  let upiApp = '';
  for (const [key, val] of Object.entries(UPI_APPS)) { if (t.includes(key)) { upiApp = val; break; } }

  let paymentMethod = autoPaymentMethod;
  if (!paymentMethod) {
    if (t.match(/\b(cash|nakit)\b/)) paymentMethod = 'Cash';
    else if (t.match(/\b(credit\s+card|cc)\b/)) paymentMethod = 'Credit Card';
    else if (t.match(/\b(neft|rtgs|imps|bank\s+transfer)\b/)) paymentMethod = 'Bank Transfer';
    else if (upiApp) paymentMethod = 'UPI';
  }

  // Merchant matching with fuzzy
  let category = emojiCategory, tag = emojiTag, isPredicted = false;
  if (!category) {
    for (const cat of appCategories) { if (t.includes(cat.toLowerCase())) { category = cat; break; } }
  }
  if (!category) {
    const merchantKeys = Object.keys(MERCHANT_KNOWLEDGE);
    for (const merchant of merchantKeys) {
      if (t.includes(merchant)) { category = MERCHANT_KNOWLEDGE[merchant].category; tag = tag || MERCHANT_KNOWLEDGE[merchant].tag; isPredicted = true; break; }
    }
    if (!category) {
      const fuzzyMerchant = fuzzyMatch(t, merchantKeys);
      if (fuzzyMerchant) { category = MERCHANT_KNOWLEDGE[fuzzyMerchant].category; tag = tag || MERCHANT_KNOWLEDGE[fuzzyMerchant].tag; isPredicted = true; }
    }
  }

  let parsedPayee = '';
  const payeeMatch = text.match(/\b(?:to|paid\s+to|at|@|from|received\s+from)\s+([A-Za-z][A-Za-z0-9\s]{0,20}?)(?:\s+(?:via|using|on|for|from|today|yesterday|\d)|$)/i);
  if (payeeMatch && type !== 'TRANSFER') parsedPayee = payeeMatch[1].trim();

  let parsedNote = '';
  const forMatch = text.match(/\b(?:for|remark[:\s]+|note[:\s]+)(.+?)(?:\s+(?:via|using|from|to|today|yesterday|on \d|\d+\s*(?:days|week))\b|$)/i);
  if (forMatch) parsedNote = forMatch[1].trim();

  const { date, confirmed: dateConfirmed } = parseDate(text);

  // Compute confidence score (0–100)
  let confidence = 0;
  if (amount) confidence += 25;
  if (type) confidence += 15;
  if (accountId) confidence += 20;
  if (paymentMethod) confidence += 10;
  if (category) confidence += 20;
  if (parsedNote || parsedPayee) confidence += 10;

  return { amount, type, accountId, autoPaymentMethod, upiApp, paymentMethod, category, tag, parsedPayee, parsedNote, date, dateConfirmed, isPredicted, confidence };
};

// ─── Voice Recognition Hook ───────────────────────────────────────────────
const useSpeechRecognition = () => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const supported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const start = (onResult: (text: string) => void) => {
    if (!supported) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'en-IN'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e: any) => onResult(e.results[0][0].transcript);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec; rec.start();
  };
  const stop = () => { recognitionRef.current?.stop(); setListening(false); };
  return { start, stop, listening, supported };
};

// ─── Personal Learning Hook ───────────────────────────────────────────────
const usePersonalLearning = () => {
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [smartDefaults, setSmartDefaults] = useState<{ accountId: string; paymentMethod: string; upiApp: string }>({
    accountId: '', paymentMethod: '', upiApp: ''
  });
  const [payeeMemory, setPayeeMemory] = useState<Record<string, { category: string; accountId: string; paymentMethod: string; upiApp: string }>>({});

  useEffect(() => {
    db.transactions.orderBy('dateTime').reverse().limit(30).toArray().then(txs => {
      setRecentTx(txs.slice(0, 5));

      // Most used account
      const accCount: Record<string, number> = {};
      const methodCount: Record<string, number> = {};
      const upiCount: Record<string, number> = {};
      const payeeMap: Record<string, any> = {};

      txs.forEach(tx => {
        if (tx.accountId) accCount[tx.accountId] = (accCount[tx.accountId] || 0) + 1;
        if (tx.paymentMethod) methodCount[tx.paymentMethod] = (methodCount[tx.paymentMethod] || 0) + 1;
        if (tx.upiApp) upiCount[tx.upiApp] = (upiCount[tx.upiApp] || 0) + 1;
        // Build payee → category/account memory
        if (tx.partyName) {
          const key = tx.partyName.toLowerCase().trim();
          if (!payeeMap[key]) payeeMap[key] = { category: tx.category, accountId: tx.accountId, paymentMethod: tx.paymentMethod, upiApp: tx.upiApp, count: 0 };
          payeeMap[key].count++;
        }
      });

      const topAccount = Object.entries(accCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      const topMethod = Object.entries(methodCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      const topUpi = Object.entries(upiCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

      setSmartDefaults({ accountId: topAccount, paymentMethod: topMethod, upiApp: topUpi });
      setPayeeMemory(payeeMap);
    });
  }, []);

  return { recentTx, smartDefaults, payeeMemory };
};

// ─── Main Component ───────────────────────────────────────────────────────
export default function AIChatEntry({ onSave, accounts, tags, isSaving, showSuccess }: AIChatEntryProps) {
  const { categories: appCategories } = useCategories();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', content: "Hi! 👋 Describe your expense naturally — I'll fill everything in.\n\nTry: *\"paid 500 to Zomato via GPay from HDFC yesterday for dinner\"*\nOr say *\"same\"* to repeat your last entry." }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<ChatStage>('IDLE');
  const [pendingTx, setPendingTx] = useState<any>({
    type: '', amount: '', category: '', selectedAccountId: '', toAccountId: '',
    paymentMethod: '', upiApp: '', expenseType: '', partyName: '', note: '',
    transactionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), _dateConfirmed: false, _isPredicted: false, _confidence: 0
  });
  const [multiQueue, setMultiQueue] = useState<string[]>([]);
  const [autocomplete, setAutocomplete] = useState<any[]>([]);
  const [lastSaved, setLastSaved] = useState<any>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechRecognition();
  const { recentTx, smartDefaults, payeeMemory } = usePersonalLearning();

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  // Load autocomplete suggestions from past transactions
  useEffect(() => {
    if (input.trim().length < 2) { setAutocomplete([]); return; }
    const q = input.toLowerCase();
    db.transactions.filter(tx =>
      (tx.note && tx.note.toLowerCase().includes(q)) ||
      (tx.partyName && tx.partyName.toLowerCase().includes(q))
    ).limit(3).toArray().then(setAutocomplete);
  }, [input]);

  const addAIMessage = (content: string, options: string[] = []) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', content, options }]);
      setIsTyping(false);
    }, 350);
  };

  const getGroupedAccountOptions = (tx: any) => {
    const available = tx.type === 'TRANSFER' && tx.selectedAccountId
      ? accounts.filter(a => a.id !== tx.selectedAccountId) : accounts;
    return available.map(a => {
      const emoji = a.type === 'BANK' ? '🏦' : a.type === 'CASH' ? '💵' : '💳';
      return `${emoji} ${a.bankName}`;
    });
  };

  const checkNextStep = (tx: any) => {
    if (!tx.amount) { setStage('ASK_AMOUNT'); addAIMessage("How much was it? (e.g. 250, 2k, ₹500)"); }
    else if (!tx.type) { setStage('ASK_TYPE'); addAIMessage("Was this an Expense, Income, or Transfer?", ['💸 Expense', '💰 Income', '🔄 Transfer']); }
    else if (!tx.selectedAccountId) {
      setStage('ASK_BANK');
      const prompt = tx.type === 'CREDIT' ? "Which account received this?" : "Which account did you pay from?";
      addAIMessage(prompt, getGroupedAccountOptions(tx));
    } else if (tx.type === 'TRANSFER' && !tx.toAccountId) {
      setStage('ASK_BANK'); addAIMessage("Transfer to which account?", getGroupedAccountOptions(tx));
    } else if (!tx.paymentMethod) {
      setStage('ASK_PAYMENT_METHOD'); addAIMessage("How did you pay?", ['📱 UPI', '💳 Credit Card', '💵 Cash', '🏦 Bank Transfer']);
    } else if (tx.paymentMethod === 'UPI' && !tx.upiApp) {
      setStage('ASK_UPI_APP'); addAIMessage("Which UPI app?", ['GPay', 'PhonePe', 'Paytm', 'BHIM', 'CRED']);
    } else if (!tx.category) {
      setStage('ASK_CATEGORY'); addAIMessage("Pick a category:", appCategories);
      setAutocomplete(appCategories);
    } else if (!tx.expenseType && tx.type !== 'TRANSFER') {
      setStage('ASK_TAG'); addAIMessage("Tag this as:", tags);
    } else if (!tx.note) {
      setStage('ASK_NOTE'); addAIMessage("Add a short remark (what was this for?):");
    } else if (!tx._dateConfirmed) {
      setStage('ASK_DATE'); addAIMessage("When did this happen?", ['Today', 'Yesterday', '2 days ago', '3 days ago']);
    } else {
      setStage('PREVIEW');
      const conf = tx._confidence;
      const confLabel = conf >= 80 ? '🟢 High' : conf >= 50 ? '🟡 Medium' : '🔴 Low';
      addAIMessage(`✅ Entry ready! Confidence: ${confLabel} (${conf}%)\n${tx._isPredicted ? '🤖 Smart-filled from your history' : ''}\nReview below and tap Save.`);
    }
  };

  // ─── Handle correction commands in PREVIEW ────────────────────────────
  const handleCorrectionCommand = (userMsg: string, updated: any): boolean => {
    const t = userMsg.toLowerCase();
    const amtOverride = t.match(/(?:make it|change to|no,?\s*it'?s?|actually)\s*([\d.,k]+)/i);
    if (amtOverride) {
      const newAmt = parseAmount(amtOverride[1]);
      if (newAmt) { updated.amount = newAmt; setPendingTx(updated); setStage('PREVIEW'); addAIMessage(`✏️ Amount updated to ₹${newAmt}. Tap Save!`); return true; }
    }
    if (stage === 'ASK_CATEGORY') {
      const catOverride = userMsg.match(/^\[(.*)\]$/);
      const cat = appCategories.find(c => c.toLowerCase().includes(catOverride ? catOverride[1].toLowerCase() : userMsg.toLowerCase()));
      if (cat) { updated.category = cat; setPendingTx(updated); setStage('PREVIEW'); addAIMessage(`✏️ Category changed to ${cat}. Tap Save!`); return true; }
    }
    if (t.match(/\b(undo|revert|cancel|delete last)\b/) && lastSaved) {
      addAIMessage("⚠️ To undo, go to Transactions and delete the last entry.");
      return true;
    }
    return false;
  };

  // ─── Ask Your Data (Universal Deep Search Engine) ────────────────────────────────
  const handleChatQuery = async (query: string) => {
    let q = query.toLowerCase().replace(/[^a-z0-9\s]/g, ''); // strip punctuation
    const allTxs = await db.transactions.toArray();
    let answer = "I couldn't find anything matching that query.";

    // 1. Time Awareness
    const now = new Date();
    let startDate = new Date(0); // Epoch
    let endDate = new Date('2100-01-01');
    let timeRangeName = 'overall';

    if (q.match(/\b(this month)\b/)) {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      timeRangeName = 'this month';
    } else if (q.match(/\b(last month)\b/)) {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      timeRangeName = 'last month';
    } else if (q.match(/\b(today)\b/)) {
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date(now.setHours(23, 59, 59, 999));
      timeRangeName = 'today';
    } else if (q.match(/\b(yesterday)\b/)) {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      startDate = new Date(y.setHours(0, 0, 0, 0));
      endDate = new Date(y.setHours(23, 59, 59, 999));
      timeRangeName = 'yesterday';
    } else if (q.match(/\b(this year)\b/)) {
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      timeRangeName = 'this year';
    }

    // Filter by time immediately
    const timeFilteredTxs = allTxs.filter(t => {
      const d = new Date(t.dateTime);
      return d >= startDate && d <= endDate;
    });

    // Handle Balance Queries
    if (q.includes('balance') || q.includes('total in')) {
      const bankNames = accounts.map(a => a.bankName.toLowerCase());
      const fuzzy = fuzzyMatch(q, bankNames);
      if (fuzzy) {
        const acc = accounts.find(a => a.bankName.toLowerCase() === fuzzy);
        if (acc) {
          let bal = Number(acc.startingBalance) || 0;
          allTxs.filter(t => Number(t.accountId) === Number(acc.id)).forEach(tx => {
            if (tx.type === 'CREDIT') bal += Number(tx.amount);
            else if (tx.type === 'DEBIT') bal -= Number(tx.amount);
          });
          answer = `Your current balance in ${acc.bankName} is ₹${bal.toLocaleString('en-IN')}.`;
        }
      } else {
        answer = "I couldn't identify the bank account. Try asking 'What is my HDFC balance?'";
      }
      addAIMessage(`🔍 **Data Query:**\n${answer}`);
      return;
    }

    // 2. Extract Target Subject
    // Remove filler words to isolate the core noun/subject
    let subject = q.replace(/\b(how much|did i|what is|show me|when did|last time|total|spent|spend|paid|pay|give|gave|to|on|at|for|about|this month|last month|today|yesterday|this year|and|the|a|my)\b/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Category aliases mapper
    const categoryAliases: Record<string, string[]> = { 
      'home': ['rent', 'housing', 'house'], 
      'house': ['rent', 'housing', 'home'], 
      'grocery': ['shopping', 'food', 'groceries'], 
      'cab': ['transport', 'taxi', 'uber', 'ola'], 
      'flight': ['travel'], 
      'movie': ['entertainment'] 
    };
    
    let searchTerms = [subject];
    for (const [alias, mapped] of Object.entries(categoryAliases)) {
      if (subject.includes(alias) || q.includes(alias)) { 
        searchTerms.push(...mapped);
      }
    }

    // If query is totally empty after stripping, default to all DEBITs
    if (!subject || subject.length < 2) {
       const sum = timeFilteredTxs.filter(t => t.type === 'DEBIT').reduce((s, t) => s + Number(t.amount), 0);
       answer = `You have spent a total of ₹${sum.toLocaleString('en-IN')} ${timeRangeName}. Specify a category or payee for details!`;
       addAIMessage(`🔍 **Data Query:**\n${answer}`);
       return;
    }

    // 3. Universal Deep Search
    const matches = timeFilteredTxs.filter(t => {
      const fields = [
        t.category, t.expenseType, t.partyName, t.note, t.paymentMethod, t.upiApp
      ].map(f => (f || '').toLowerCase());
      
      // Exact substring match in any field against ANY search term
      return fields.some(f => searchTerms.some(term => term.length > 2 && f.includes(term)));
    });

    if (matches.length > 0) {
      // Distinguish between Credit and Debit if user asked about income vs expense
      const isIncomeQuery = q.match(/\b(earned|income|received|salary|got)\b/);
      const targetType = isIncomeQuery ? 'CREDIT' : 'DEBIT';
      const filteredMatches = matches.filter(t => t.type === targetType);
      
      const txCount = filteredMatches.length;
      const sum = filteredMatches.reduce((s, t) => s + Number(t.amount), 0);
      
      if (txCount === 0) {
        answer = `You have ₹0 ${isIncomeQuery ? 'income' : 'expenses'} for '${subject}' ${timeRangeName}.`;
      } else {
        // Find best match property name to show user context
        let matchedProperty = `'${subject}'`;
        const sample = filteredMatches[0];
        if (sample.category?.toLowerCase().includes(subject)) matchedProperty = `Category: ${sample.category}`;
        else if (sample.partyName?.toLowerCase().includes(subject)) matchedProperty = `Payee: ${sample.partyName}`;
        else if (sample.expenseType?.toLowerCase().includes(subject)) matchedProperty = `Tag: ${sample.expenseType}`;
        else if (sample.note?.toLowerCase().includes(subject)) matchedProperty = `Remarks`;

        answer = `You have ${isIncomeQuery ? 'received' : 'spent'} ₹${sum.toLocaleString('en-IN')} on **${matchedProperty}** ${timeRangeName} (across ${txCount} entries).`;
      }
    } else {
       answer = `I found 0 records for '${subject}' ${timeRangeName}.`;
    }

    addAIMessage(`🔍 **Data Query:**\n${answer}`);
  };

  const handleSend = useCallback((msgOverride?: string) => {
    const userMsg = (msgOverride || input).trim();
    if (!userMsg) return;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setAutocomplete([]);

    let updated = { ...pendingTx };

    // ── Special commands ──────────────────────────────────────────────────
    const t = userMsg.toLowerCase();
    
    // Check if the previous AI message was a Data Query for conversational follow-ups
    const lastMsg = messages[messages.length - 1];
    const isFollowUpQuery = lastMsg?.role === 'ai' && lastMsg.content.includes('Data Query:');

    // "Ask Your Data" Query Detection
    if (t.match(/\b(how much|what is|when did|show me|total|query|balance|spent|spend)\b/i) || t.endsWith('?') || (isFollowUpQuery && !t.match(/\d/))) {
      if (!t.match(/^(add|record|log|paid)/i)) { // Prevent 'paid 500' from being intercepted
        handleChatQuery(t);
        return;
      }
    }

    // "same" / "repeat" → copy last transaction
    if (t.match(/^(same|repeat|again|same as last)$/i)) {
      if (recentTx.length > 0) {
        const last = recentTx[0];
        const cloned = {
          ...pendingTx,
          amount: last.amount, type: last.type, selectedAccountId: last.accountId,
          paymentMethod: last.paymentMethod, upiApp: last.upiApp || '',
          category: last.category, expenseType: last.expenseType || '', partyName: last.partyName || '',
          note: last.note, transactionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
          _dateConfirmed: true, _isPredicted: false, _confidence: 90
        };
        setPendingTx(cloned);
        setStage('PREVIEW');
        addAIMessage(`♻️ Copied last entry: ₹${last.amount} — ${last.note || 'No note'}\nReview and save!`);
        return;
      } else {
        addAIMessage("No previous transactions found yet. Tell me about your expense!");
        return;
      }
    }

    // Multi-transaction: "200 zomato and 150 uber"
    if (stage === 'IDLE' || stage === 'PREVIEW') {
      const parts = splitMultiTransaction(userMsg);
      if (parts.length > 1) {
        addAIMessage(`📋 Found ${parts.length} transactions! Processing one by one...`);
        setMultiQueue(parts.slice(1));
        // Process first one
        const p = parseUniversal(parts[0], accounts, appCategories);
        applyParsed(p, updated);
        return;
      }
    }

    // Correction command in preview
    if (stage === 'PREVIEW') {
      if (handleCorrectionCommand(userMsg, updated)) return;
    }

    if (stage === 'IDLE' && !t.match(/^(edit|change|update)/)) {
      const p = parseUniversal(userMsg, accounts, appCategories);

      // Apply personal learning: fill gaps from smart defaults & payee memory
      if (!p.accountId && smartDefaults.accountId) p.accountId = smartDefaults.accountId;
      if (!p.paymentMethod && smartDefaults.paymentMethod) p.paymentMethod = smartDefaults.paymentMethod;
      if (!p.upiApp && smartDefaults.upiApp && p.paymentMethod === 'UPI') p.upiApp = smartDefaults.upiApp;

      // Check payee memory
      if (p.parsedPayee) {
        const mem = payeeMemory[p.parsedPayee.toLowerCase()];
        if (mem) {
          if (!p.category) p.category = mem.category;
          if (!p.accountId) p.accountId = mem.accountId;
          if (!p.paymentMethod) p.paymentMethod = mem.paymentMethod;
          if (!p.upiApp && mem.upiApp) p.upiApp = mem.upiApp;
          p.isPredicted = true;
        }
      }

      applyParsed(p, updated);
    } else if (stage === 'ASK_AMOUNT') {
      const amt = parseAmount(userMsg);
      if (amt && !isNaN(parseFloat(amt))) { updated.amount = parseFloat(amt); setPendingTx(updated); checkNextStep(updated); }
      else addAIMessage("Hmm, try: 500, 2k, ₹250");
    } else if (stage === 'ASK_TYPE') {
      if (t.match(/\b(transfer|move|send|🔄)\b/)) updated.type = 'TRANSFER';
      else if (t.match(/\b(income|inflow|received|credit|salary|💰)\b/)) updated.type = 'CREDIT';
      else updated.type = 'DEBIT';
      setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_BANK') {
      const cleanName = userMsg.replace(/^(🏦|💵|💳)\s*/, '').trim();
      const acc = accounts.find(a => a.bankName === cleanName) || resolveBank(cleanName, accounts);
      if (acc) {
        if (updated.type === 'TRANSFER' && updated.selectedAccountId && !updated.toAccountId) updated.toAccountId = acc.id;
        else { updated.selectedAccountId = acc.id; updated.paymentMethod = acc.type === 'CREDIT_CARD' ? 'Credit Card' : acc.type === 'CASH' ? 'Cash' : 'UPI'; }
        setPendingTx(updated); checkNextStep(updated);
      } else addAIMessage("Couldn't find that account. Pick one:", getGroupedAccountOptions(updated));
    } else if (stage === 'ASK_PAYMENT_METHOD') {
      if (t.includes('upi') || t.includes('📱')) updated.paymentMethod = 'UPI';
      else if (t.includes('credit') || t.includes('💳')) updated.paymentMethod = 'Credit Card';
      else if (t.includes('cash') || t.includes('💵')) updated.paymentMethod = 'Cash';
      else if (t.includes('bank') || t.includes('🏦')) updated.paymentMethod = 'Bank Transfer';
      else updated.paymentMethod = userMsg;
      setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_UPI_APP') {
      updated.upiApp = userMsg; setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_CATEGORY') {
      const cat = appCategories.find(c => c.toLowerCase().includes(userMsg.toLowerCase()));
      if (cat) { updated.category = cat; setPendingTx(updated); checkNextStep(updated); }
      else addAIMessage("Please pick from the options:", appCategories);
    } else if (stage === 'ASK_TAG') {
      updated.expenseType = userMsg; setPendingTx(updated); checkNextStep(updated);
    } else if (stage === 'ASK_NOTE') {
      if (!userMsg.trim() || userMsg.match(/^(skip|no|na|-)$/i)) addAIMessage("Please add a short remark!");
      else { updated.note = userMsg; setPendingTx(updated); checkNextStep(updated); }
    } else if (stage === 'ASK_DATE') {
      const { date } = parseDate(userMsg);
      updated.transactionDate = date; updated._dateConfirmed = true;
      setPendingTx(updated); checkNextStep(updated);
    }
  }, [input, pendingTx, stage, accounts, tags, recentTx, smartDefaults, payeeMemory, multiQueue, messages, appCategories]);

  const applyParsed = (p: ReturnType<typeof parseUniversal>, updated: any) => {
    const newTx = {
      ...updated,
      ...(p.amount && { amount: p.amount }),
      ...(p.type && { type: p.type }),
      ...(p.accountId && { selectedAccountId: p.accountId }),
      ...(p.autoPaymentMethod && { paymentMethod: p.autoPaymentMethod }),
      ...(p.upiApp && { upiApp: p.upiApp }),
      ...(p.paymentMethod && !updated.paymentMethod && { paymentMethod: p.paymentMethod }),
      ...(p.category && { category: p.category }),
      ...(p.tag && { expenseType: p.tag }),
      ...(p.parsedPayee && { partyName: p.parsedPayee }),
      ...(p.parsedNote && { note: p.parsedNote }),
      transactionDate: p.date || updated.transactionDate,
      _dateConfirmed: p.dateConfirmed || updated._dateConfirmed,
      _isPredicted: p.isPredicted,
      _confidence: p.confidence,
    };
    setPendingTx(newTx);
    checkNextStep(newTx);
  };

  const handleEdit = (field: string) => {
    const updated = { ...pendingTx };
    if (field === 'amount') { updated.amount = ''; setStage('ASK_AMOUNT'); addAIMessage("Correct Amount:"); }
    if (field === 'bank') { updated.selectedAccountId = ''; setStage('ASK_BANK'); addAIMessage("Correct Account:", getGroupedAccountOptions(updated)); }
    if (field === 'category') { updated.category = ''; setStage('ASK_CATEGORY'); addAIMessage("Correct Category:", appCategories); }
    if (field === 'tag') { updated.expenseType = ''; setStage('ASK_TAG'); addAIMessage("Correct Tag:", tags); }
    if (field === 'remark') { updated.note = ''; setStage('ASK_NOTE'); addAIMessage("Correct Remark:"); }
    if (field === 'date') { updated._dateConfirmed = false; setStage('ASK_DATE'); addAIMessage("When did this happen?", ['Today', 'Yesterday', '2 days ago', '3 days ago']); }
    setPendingTx(updated);
  };

  const handleReset = () => {
    setStage('IDLE');
    setPendingTx({ type: '', amount: '', category: '', selectedAccountId: '', toAccountId: '', paymentMethod: '', upiApp: '', expenseType: '', partyName: '', note: '', transactionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), _dateConfirmed: false, _isPredicted: false, _confidence: 0 });
    setMultiQueue([]);
    setMessages([{ role: 'ai', content: "Reset! Tell me about your next expense 👇" }]);
  };

  const handleSaveAndNext = (tx: any) => {
    setLastSaved(tx);
    onSave(tx);
    // If multi-transaction queue has more, process next
    if (multiQueue.length > 0) {
      const next = multiQueue[0];
      const remaining = multiQueue.slice(1);
      setMultiQueue(remaining);
      setTimeout(() => {
        handleReset();
        setTimeout(() => handleSend(next), 400);
      }, 1500);
    }
  };

  const handleVoice = () => {
    if (speech.listening) { speech.stop(); return; }
    speech.start((text) => {
      setInput(text);
      setMessages(prev => [...prev, { role: 'user', content: `🎤 ${text}` }]);
      setTimeout(() => handleSend(text), 100);
    });
  };

  const handleReceiptScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    setMessages(prev => [...prev, { role: 'user', content: '📸 Uploaded receipt. Scanning with AI...' }]);
    
    try {
      const Tesseract = (await import('tesseract.js')).default;
      const { data: { text } } = await Tesseract.recognize(file, 'eng');
      const lines = text.split('\n');
      
      let foundAmount = '';
      let foundMerchant = '';
      for (const line of lines) {
        const l = line.toLowerCase();
        // Look for typical total lines
        if (l.includes('total') || l.includes('amount') || l.includes('paid')) {
           const amtMatch = l.match(/\b\d+(?:\.\d{1,2})?\b/);
           if (amtMatch && parseFloat(amtMatch[0]) > 0) foundAmount = amtMatch[0];
        }
        // Very basic merchant guess
        if (!foundMerchant && line.trim().length > 3 && !l.includes('date') && !l.includes('time')) {
           foundMerchant = line.trim();
        }
      }
      
      if (!foundAmount) {
         // Fallback: just grab the largest number on the receipt
         const allNumbers = text.match(/\b\d+(?:\.\d{1,2})?\b/g);
         if (allNumbers) {
             const sorted = allNumbers.map(n => parseFloat(n)).sort((a,b) => b-a);
             if (sorted[0] > 0) foundAmount = String(sorted[0]);
         }
      }
      
      const scanResult = `${foundAmount ? foundAmount : '0'} at ${foundMerchant || 'merchant'} today`;
      setMessages(prev => [...prev, { role: 'ai', content: `📄 OCR Extracted:\n"${scanResult}"\nParsing...` }]);
      handleSend(scanResult);
    } catch (err) {
      console.error(err);
      addAIMessage("Sorry, I couldn't read that receipt clearly. Please type the expense manually.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const repeatLastTx = (tx: any) => {
    const cloned = {
      ...pendingTx,
      amount: tx.amount, type: tx.type, selectedAccountId: tx.accountId,
      paymentMethod: tx.paymentMethod, upiApp: tx.upiApp || '',
      category: tx.category, expenseType: tx.expenseType || '', partyName: tx.partyName || '',
      note: tx.note, transactionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      _dateConfirmed: true, _isPredicted: false, _confidence: 90
    };
    setPendingTx(cloned); setStage('PREVIEW');
    setMessages(prev => [...prev, { role: 'ai', content: `♻️ Loaded: ₹${tx.amount} — ${tx.note || tx.category}\nReview and save!` }]);
  };

  const confidenceColor = pendingTx._confidence >= 80 ? 'text-brand-green' : pendingTx._confidence >= 50 ? 'text-yellow-500' : 'text-brand-red';

  return (
    <div className="flex flex-col h-full bg-[#F9FBFF] dark:bg-[#0A0A0A] relative">

      {/* Recent shortcuts — shown only in IDLE stage */}
      {stage === 'IDLE' && recentTx.length > 0 && (
        <div className="px-3 pt-3 pb-1 shrink-0">
          <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Quick Repeat
          </p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {recentTx.slice(0, 4).map((tx, i) => (
              <button
                key={i}
                onClick={() => repeatLastTx(tx)}
                className="flex-shrink-0 bg-white dark:bg-[#111111] border border-brand-blue/5 dark:border-white/5 rounded-2xl px-3 py-2 text-left hover:border-brand-green/30 active:scale-95 transition-all shadow-sm"
              >
                <div className="text-[10px] font-black text-brand-green">₹{tx.amount}</div>
                <div className="text-[8px] text-neutral-400 truncate max-w-[70px]">{tx.note || tx.category}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-64">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'ai' ? 'items-start' : 'items-end'} gap-2 animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[88%] px-4 py-3 rounded-2xl text-[12px] font-medium shadow-sm flex items-start gap-2.5 ${
              msg.role === 'ai'
                ? 'bg-white dark:bg-[#111111] text-neutral-800 dark:text-neutral-200 border border-brand-blue/5 dark:border-white/5'
                : 'bg-brand-green text-white'}`}>
              {msg.role === 'ai' && <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand-green" />}
              <span className="leading-relaxed whitespace-pre-line">{msg.content}</span>
            </div>
            {msg.options && msg.options.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 w-full max-w-[88%]">
                {msg.options.map((opt: string) => (
                  <button key={opt} onClick={() => handleSend(opt)}
                    className="px-3 py-2 bg-white dark:bg-[#111111] border border-brand-blue/5 dark:border-white/5 rounded-xl text-[10px] font-black uppercase text-brand-green hover:bg-brand-green/5 transition-all shadow-sm active:scale-95 flex items-center justify-between group">
                    <span className="truncate">{opt}</span>
                    <ChevronRight className="w-3 h-3 opacity-30 group-hover:opacity-100 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-[#111111] px-4 py-2.5 rounded-2xl flex items-center gap-1 border border-brand-blue/5 dark:border-white/5">
              <span className="w-1.5 h-1.5 bg-brand-green rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-brand-green rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 bg-brand-green rounded-full animate-bounce [animation-delay:-0.3s]" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Bottom Panel */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#F7F7F7] via-[#F7F7F7]/95 dark:from-[#0A0A0A] dark:via-[#0A0A0A]/95 space-y-2 z-10">

        {/* Preview Card */}
        {stage === 'PREVIEW' && (
          <div className="mx-0.5 p-3 bg-[#F9FBFF] dark:bg-[#111111] border border-brand-blue/5 dark:border-white/5 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-brand-green" /> Preview
                {pendingTx._confidence > 0 && (
                  <span className={`text-[8px] font-black ${confidenceColor}`}>{pendingTx._confidence}% confident</span>
                )}
              </span>
              <button onClick={handleReset} className="text-[8px] font-black text-brand-green bg-brand-green/5 px-2 py-1 rounded-lg uppercase tracking-widest flex items-center gap-1">
                <RotateCcw className="w-2.5 h-2.5" /> Reset
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-white dark:bg-white/5 p-2 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:ring-2 ring-brand-green/30 transition-all group relative" onClick={() => handleEdit('amount')}>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"><Pencil className="w-2.5 h-2.5 text-brand-green" /></div>
                <span className="text-[17px] font-black text-brand-green dark:text-white">₹{pendingTx.amount}</span>
                <span className={`text-[7px] font-black uppercase ${pendingTx.type === 'CREDIT' ? 'text-brand-green' : 'text-brand-red'}`}>
                  {pendingTx.type === 'CREDIT' ? 'Inflow' : pendingTx.type === 'TRANSFER' ? 'Transfer' : 'Outflow'}
                </span>
              </div>
              <div className="bg-white dark:bg-white/5 p-2 rounded-2xl flex items-center gap-2 cursor-pointer hover:ring-2 ring-brand-green/30 transition-all group relative" onClick={() => handleEdit('category')}>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"><Pencil className="w-2.5 h-2.5 text-brand-green" /></div>
                <div className="text-xl">{CATEGORY_ICONS[pendingTx.category] || '📦'}</div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-neutral-400 uppercase leading-none">Category</span>
                  <span className="text-[10px] font-bold text-brand-green dark:text-white truncate">{pendingTx.category || '—'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {[
                { icon: <Landmark className="w-3 h-3 text-neutral-400 shrink-0" />, label: 'Account', value: accounts.find(a => a.id === pendingTx.selectedAccountId)?.bankName || '—', field: 'bank' },
                { icon: <AppWindow className="w-3 h-3 text-neutral-400 shrink-0" />, label: 'Method', value: pendingTx.upiApp || pendingTx.paymentMethod || '—', field: null },
                { icon: <Hash className="w-3 h-3 text-neutral-400 shrink-0" />, label: 'Tag', value: `#${pendingTx.expenseType || '—'}`, field: 'tag' },
                { icon: <Lightbulb className="w-3 h-3 text-neutral-400 shrink-0" />, label: 'Note', value: pendingTx.note || '—', field: 'remark' },
              ].map(({ icon, label, value, field }) => (
                <div key={label} onClick={() => field && handleEdit(field)}
                  className={`bg-white dark:bg-white/5 p-2 rounded-xl flex items-center gap-2 border border-transparent transition-colors ${field ? 'cursor-pointer hover:border-brand-green/20 hover:bg-neutral-50 dark:hover:bg-white/5' : ''}`}>
                  {icon}
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[7px] font-black text-neutral-400 uppercase leading-none">{label}</span>
                    <span className="text-[9px] font-bold text-brand-green dark:text-white truncate">{value}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-1 mb-2">
              <button onClick={() => handleEdit('date')} className="text-[10px] text-neutral-400 flex items-center gap-1 hover:text-brand-green transition-colors">
                📅 {pendingTx.transactionDate ? format(new Date(pendingTx.transactionDate), 'dd MMM yyyy') : 'Set date'}
                <Pencil className="w-2.5 h-2.5" />
              </button>
              {pendingTx._isPredicted && (
                <span className="text-[8px] text-brand-green flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5" /> Auto-filled</span>
              )}
            </div>

            <button onClick={() => handleSaveAndNext(pendingTx)} disabled={isSaving || showSuccess}
              className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
                showSuccess ? 'bg-emerald-500 text-white' : 'bg-brand-green text-white shadow-brand-green/30'} disabled:opacity-70`}>
              {isSaving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Saving...</span></>
                : showSuccess ? <><CheckCircle2 className="w-5 h-5" /><span>Saved! {multiQueue.length > 0 ? `(${multiQueue.length} more...)` : ''}</span></>
                  : <><CheckCircle2 className="w-4 h-4" /><span>Save Entry</span></>}
            </button>
          </div>
        )}

        {/* Autocomplete suggestions */}
        {autocomplete.length > 0 && stage === 'IDLE' && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {autocomplete.map((tx, i) => (
              <button key={i} onClick={() => handleSend(`${tx.amount} ${tx.partyName || tx.note || tx.category} today`)}
                className="flex-shrink-0 bg-white dark:bg-[#111111] border border-brand-green/20 rounded-xl px-3 py-1.5 text-left active:scale-95 transition-all shadow-sm flex items-center gap-2">
                <Zap className="w-3 h-3 text-brand-green" />
                <div>
                  <div className="text-[9px] font-black text-brand-green">₹{tx.amount}</div>
                  <div className="text-[8px] text-neutral-400 truncate max-w-[80px]">{tx.note || tx.category}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-center gap-1.5 bg-[#F9FBFF] dark:bg-[#111111] p-1.5 rounded-2xl border border-brand-blue/5 dark:border-white/5 shadow-xl">
          <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleReceiptScan} className="hidden" />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-400 hover:text-brand-green disabled:opacity-50`}
            title="Scan Receipt"
          >
            {isScanning ? <div className="w-4 h-4 border-2 border-neutral-300 border-t-brand-green rounded-full animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>

          {speech.supported && (
            <button onClick={handleVoice}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                speech.listening ? 'bg-red-500 text-white animate-pulse' : 'bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-400 hover:text-brand-green'}`}>
              {speech.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={speech.listening ? "Listening..." : "Expense, question, or 'same'..."}
            className="flex-1 bg-transparent px-2 py-2 text-[12px] font-bold outline-none dark:text-white placeholder:text-neutral-400"
          />
          {input && <button onClick={() => setInput('')} className="text-neutral-300 hover:text-neutral-500"><X className="w-4 h-4" /></button>}
          <button onClick={() => handleSend()} className="w-10 h-10 bg-brand-green text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform flex-shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
