import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Bot, CheckCircle2, Sparkles, Landmark, Lightbulb,
  ChevronRight, Hash, AppWindow, Pencil, Mic, MicOff, X
} from 'lucide-react';
import { format, subDays, subWeeks, startOfWeek, parseISO } from 'date-fns';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';

interface AIChatEntryProps {
  onSave: (transaction: any) => void;
  accounts: any[];
  tags: string[];
  isSaving?: boolean;
  showSuccess?: boolean;
}

type ChatStage = 'IDLE' | 'ASK_AMOUNT' | 'ASK_TYPE' | 'ASK_BANK' | 'ASK_PAYMENT_METHOD' | 'ASK_UPI_APP' | 'ASK_CATEGORY' | 'ASK_TAG' | 'ASK_PAYEE' | 'ASK_NOTE' | 'ASK_DATE' | 'PREVIEW';

// ─── Expanded Indian Merchant Knowledge Base ──────────────────────────────
const MERCHANT_KNOWLEDGE: Record<string, { category: string; tag: string }> = {
  // Food & Delivery
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
  // Transport
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
  // Shopping
  amazon: { category: 'Shopping', tag: 'Personal' },
  flipkart: { category: 'Shopping', tag: 'Personal' },
  myntra: { category: 'Shopping', tag: 'Personal' },
  meesho: { category: 'Shopping', tag: 'Personal' },
  ajio: { category: 'Shopping', tag: 'Personal' },
  nykaa: { category: 'Shopping', tag: 'Personal' },
  snapdeal: { category: 'Shopping', tag: 'Personal' },
  // Utilities & Bills
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
  // Health
  pharmeasy: { category: 'Health', tag: 'Personal' },
  netmeds: { category: 'Health', tag: 'Personal' },
  apollo: { category: 'Health', tag: 'Personal' },
  medplus: { category: 'Health', tag: 'Personal' },
  medicine: { category: 'Health', tag: 'Personal' },
  pharmacy: { category: 'Health', tag: 'Personal' },
  hospital: { category: 'Health', tag: 'Personal' },
  doctor: { category: 'Health', tag: 'Personal' },
  gym: { category: 'Health', tag: 'Personal' },
  // Finance
  lenskart: { category: 'Shopping', tag: 'Personal' },
  insurance: { category: 'Bills', tag: 'Personal' },
  lic: { category: 'Bills', tag: 'Personal' },
  mutual: { category: 'Investment', tag: 'Personal' },
  zerodha: { category: 'Investment', tag: 'Personal' },
  groww: { category: 'Investment', tag: 'Personal' },
  loan: { category: 'Loan', tag: 'Personal' },
  emi: { category: 'Loan', tag: 'Personal' },
  rent: { category: 'Housing', tag: 'Household' },
};

// ─── UPI App Detection ────────────────────────────────────────────────────
const UPI_APPS: Record<string, string> = {
  gpay: 'GPay', 'google pay': 'GPay', googlepay: 'GPay',
  phonepe: 'PhonePe', 'phone pe': 'PhonePe',
  paytm: 'Paytm',
  bhim: 'BHIM',
  cred: 'CRED',
  slice: 'Slice',
  amazonpay: 'Amazon Pay', 'amazon pay': 'Amazon Pay',
  airtel: 'Airtel Pay',
  mobikwik: 'MobiKwik',
};

// ─── Bank Nicknames ───────────────────────────────────────────────────────
const BANK_NICKNAMES: Record<string, string> = {
  sbi: 'state bank', pnb: 'punjab national', hdfc: 'hdfc bank',
  icici: 'icici bank', axis: 'axis bank', kotak: 'kotak mahindra',
  bob: 'bank of baroda', canara: 'canara bank', yes: 'yes bank',
  indusind: 'indusind bank', idfc: 'idfc', rbl: 'rbl bank',
};

// ─── Date Parser ──────────────────────────────────────────────────────────
const parseDate = (text: string): { date: string; confirmed: boolean } => {
  const t = text.toLowerCase();
  const now = new Date();

  // "today"
  if (t.includes('today') || t.includes('abhi') || t.includes('aaj'))
    return { date: format(now, "yyyy-MM-dd'T'HH:mm"), confirmed: true };

  // "yesterday"
  if (t.includes('yesterday') || t.includes('kal'))
    return { date: format(subDays(now, 1), "yyyy-MM-dd'T'HH:mm"), confirmed: true };

  // "X days ago"
  const daysAgo = t.match(/(\d+)\s+days?\s+ago/);
  if (daysAgo)
    return { date: format(subDays(now, parseInt(daysAgo[1])), "yyyy-MM-dd'T'HH:mm"), confirmed: true };

  // "last week"
  if (t.includes('last week'))
    return { date: format(subWeeks(now, 1), "yyyy-MM-dd'T'HH:mm"), confirmed: true };

  // "last monday/tuesday..." etc
  const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  for (let i = 0; i < weekdays.length; i++) {
    if (t.includes(`last ${weekdays[i]}`)) {
      const current = now.getDay();
      const diff = (current - i + 7) % 7 || 7;
      return { date: format(subDays(now, diff), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
    }
  }

  // "on 5th", "on 5 june", "5/6", "5-6"
  const onDateMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)?\b/i);
  if (onDateMatch) {
    const day = parseInt(onDateMatch[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      if (d <= now)
        return { date: format(d, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
    }
  }

  // Slash/dash date: "5/6" or "5-6"
  const slashDate = text.match(/\b(\d{1,2})[\/\-](\d{1,2})\b/);
  if (slashDate) {
    const d = new Date(now.getFullYear(), parseInt(slashDate[2]) - 1, parseInt(slashDate[1]));
    if (d <= now)
      return { date: format(d, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  }

  return { date: format(now, "yyyy-MM-dd'T'HH:mm"), confirmed: false };
};

// ─── Amount Parser ────────────────────────────────────────────────────────
const parseAmount = (text: string): string => {
  const t = text.toLowerCase().replace(/,/g, '');
  // "2.5k" or "2k" or "2.5 k"
  const kMatch = t.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return String(parseFloat(kMatch[1]) * 1000);
  // "2 lakh" or "2L"
  const lakhMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:l(?:akh)?)\b/i);
  if (lakhMatch) return String(parseFloat(lakhMatch[1]) * 100000);
  // "two hundred" etc — simple word-to-number
  const hundreds: Record<string,number> = { hundred: 100, thousand: 1000, lakh: 100000 };
  for (const [word, val] of Object.entries(hundreds)) {
    const m = t.match(/(\d+)\s*(?:×\s*)?\s*${word}/);
    if (m) return String(parseInt(m[1]) * val);
  }
  // ₹200 or Rs 200
  const rsMatch = t.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
  if (rsMatch) return rsMatch[1];
  // plain number
  const numMatch = t.match(/\b(\d+(?:\.\d+)?)\b/);
  return numMatch ? numMatch[1] : '';
};

// ─── Universal One-shot Parser ────────────────────────────────────────────
const parseUniversal = (text: string, accounts: any[]) => {
  const t = text.toLowerCase();

  const amount = parseAmount(text);

  let type = '';
  if (t.match(/\b(received|got|salary|income|credit|added|deposit|inflow|credited)\b/)) type = 'CREDIT';
  else if (t.match(/\b(transfer(?:red)?|moved?|sent|send|shifted)\b/)) type = 'TRANSFER';
  else if (t.match(/\b(paid|spent|bought|expense|debit|gave|withdrawn?|purchased?)\b/)) type = 'DEBIT';

  // Bank resolution
  let accountId = '', autoPaymentMethod = '';
  const resolveBank = (snippet: string) => {
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
    return null;
  };
  const acc = resolveBank(t);
  if (acc) {
    accountId = acc.id!;
    autoPaymentMethod = acc.type === 'CREDIT_CARD' ? 'Credit Card' : acc.type === 'CASH' ? 'Cash' : 'UPI';
  }

  // UPI App detection
  let upiApp = '';
  for (const [key, val] of Object.entries(UPI_APPS)) {
    if (t.includes(key)) { upiApp = val; break; }
  }
  if (upiApp && !autoPaymentMethod) autoPaymentMethod = 'UPI';

  // Payment method (non-UPI)
  let paymentMethod = autoPaymentMethod;
  if (!paymentMethod) {
    if (t.match(/\b(cash|nakit)\b/)) paymentMethod = 'Cash';
    else if (t.match(/\b(credit\s+card|cc)\b/)) paymentMethod = 'Credit Card';
    else if (t.match(/\b(debit\s+card|dc)\b/)) paymentMethod = 'UPI';
    else if (t.match(/\b(neft|rtgs|imps|bank\s+transfer)\b/)) paymentMethod = 'Bank Transfer';
    else if (upiApp) paymentMethod = 'UPI';
  }

  // Category & tag from merchants
  let category = '', tag = '', isPredicted = false;
  for (const cat of CATEGORIES) {
    if (t.includes(cat.toLowerCase())) { category = cat; break; }
  }
  for (const [merchant, data] of Object.entries(MERCHANT_KNOWLEDGE)) {
    if (t.includes(merchant)) {
      category = category || data.category;
      tag = tag || data.tag;
      isPredicted = true;
      break;
    }
  }

  // Payee extraction: "to Rahul", "paid at Swiggy", "from Dad"
  let parsedPayee = '';
  const payeeMatch = text.match(/\b(?:to|paid\s+to|at|@|from|received\s+from)\s+([A-Za-z][A-Za-z0-9\s]{0,20}?)(?:\s+(?:via|using|on|for|from|today|yesterday|\d)|$)/i);
  if (payeeMatch && type !== 'TRANSFER') parsedPayee = payeeMatch[1].trim();

  // Note / remark: "for lunch", "for dinner", "remark: xyz"
  let parsedNote = '';
  const forMatch = text.match(/\b(?:for|remark[:\s]+|note[:\s]+)(.+?)(?:\s+(?:via|using|from|to|today|yesterday|on \d|\d+\s*(?:days|week))\b|$)/i);
  if (forMatch) parsedNote = forMatch[1].trim();

  // Date
  const { date, confirmed: dateConfirmed } = parseDate(text);

  return { amount, type, accountId, autoPaymentMethod, upiApp, paymentMethod, category, tag, parsedPayee, parsedNote, date, dateConfirmed, isPredicted };
};

// ─── Voice Recognition Hook ───────────────────────────────────────────────
const useSpeechRecognition = () => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const supported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = (onResult: (text: string) => void) => {
    if (!supported) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  return { start, stop, listening, supported };
};


// ─── Component ────────────────────────────────────────────────────────────
export const AIChatEntry: React.FC<AIChatEntryProps> = ({ onSave, accounts, tags, isSaving, showSuccess }) => {
  const [messages, setMessages] = useState<any[]>([
    {
      role: 'ai',
      content: "Hi! 👋 Describe your expense naturally and I'll fill everything in.\n\nTry: *\"paid 500 to Zomato via GPay from HDFC yesterday for dinner\"*"
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [stage, setStage] = useState<ChatStage>('IDLE');
  const [pendingTx, setPendingTx] = useState<any>({
    type: '', amount: '', category: '', selectedAccountId: '', toAccountId: '',
    paymentMethod: '', upiApp: '', expenseType: '', partyName: '', note: '',
    transactionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), _dateConfirmed: false, _isPredicted: false
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechRecognition();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addAIMessage = (content: string, options: string[] = []) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', content, options }]);
      setIsTyping(false);
    }, 350);
  };

  const getGroupedAccountOptions = (tx: any) => {
    const available = tx.type === 'TRANSFER' && tx.selectedAccountId
      ? accounts.filter(a => a.id !== tx.selectedAccountId)
      : accounts;
    return available.map(a => {
      const emoji = a.type === 'BANK' ? '🏦' : a.type === 'CASH' ? '💵' : '💳';
      return `${emoji} ${a.bankName}`;
    });
  };

  const resolveBank = (snippet: string) => {
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
    return null;
  };

  const checkNextStep = (tx: any) => {
    if (!tx.amount) {
      setStage('ASK_AMOUNT');
      addAIMessage("How much was it? (e.g. 250 or 2.5k)");
    } else if (!tx.type) {
      setStage('ASK_TYPE');
      addAIMessage("Was this an Expense, Income, or Transfer?", ['💸 Expense', '💰 Income', '🔄 Transfer']);
    } else if (!tx.selectedAccountId) {
      setStage('ASK_BANK');
      const prompt = tx.type === 'CREDIT' ? "Which account received this?" : "Which account did you pay from?";
      addAIMessage(prompt, getGroupedAccountOptions(tx));
    } else if (tx.type === 'TRANSFER' && !tx.toAccountId) {
      setStage('ASK_BANK');
      addAIMessage("Transfer to which account?", getGroupedAccountOptions(tx));
    } else if (!tx.paymentMethod) {
      setStage('ASK_PAYMENT_METHOD');
      addAIMessage("How did you pay?", ['📱 UPI', '💳 Credit Card', '💵 Cash', '🏦 Bank Transfer']);
    } else if (tx.paymentMethod === 'UPI' && !tx.upiApp) {
      setStage('ASK_UPI_APP');
      addAIMessage("Which UPI app?", ['GPay', 'PhonePe', 'Paytm', 'BHIM', 'CRED']);
    } else if (!tx.category && tx.type !== 'TRANSFER') {
      setStage('ASK_CATEGORY');
      addAIMessage("Pick a category:", CATEGORIES);
    } else if (!tx.expenseType && tx.type !== 'TRANSFER') {
      setStage('ASK_TAG');
      addAIMessage("Tag it:", tags);
    } else if (!tx.note) {
      setStage('ASK_NOTE');
      addAIMessage("Add a short remark (what was this for?):");
    } else if (!tx._dateConfirmed) {
      setStage('ASK_DATE');
      addAIMessage("When did this happen?", ['Today', 'Yesterday', '2 days ago', '3 days ago']);
    } else {
      setStage('PREVIEW');
      const emoji = tx._isPredicted ? '🤖 Smart-filled' : '✅';
      addAIMessage(`${emoji} Entry ready! Review below and tap Save.`);
    }
  };

  const handleSend = (msgOverride?: string) => {
    const userMsg = (msgOverride || input).trim();
    if (!userMsg) return;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');

    let updated = { ...pendingTx };

    if (stage === 'IDLE' || stage === 'PREVIEW') {
      const p = parseUniversal(userMsg, accounts);
      updated = {
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
      };
      setPendingTx(updated);
      checkNextStep(updated);
    } else if (stage === 'ASK_AMOUNT') {
      const amt = parseAmount(userMsg);
      if (amt && !isNaN(parseFloat(amt))) {
        updated.amount = parseFloat(amt);
        setPendingTx(updated);
        checkNextStep(updated);
      } else {
        addAIMessage("Hmm, I couldn't read that. Try: 500, 2k, ₹250");
      }
    } else if (stage === 'ASK_TYPE') {
      const t = userMsg.toLowerCase();
      if (t.match(/\b(transfer|move|send|🔄)\b/)) updated.type = 'TRANSFER';
      else if (t.match(/\b(income|inflow|received|credit|salary|💰)\b/)) updated.type = 'CREDIT';
      else updated.type = 'DEBIT';
      setPendingTx(updated);
      checkNextStep(updated);
    } else if (stage === 'ASK_BANK') {
      const cleanName = userMsg.replace(/^(🏦|💵|💳)\s*/, '').trim();
      const acc = accounts.find(a => a.bankName === cleanName) || resolveBank(cleanName);
      if (acc) {
        if (updated.type === 'TRANSFER' && updated.selectedAccountId && !updated.toAccountId) {
          updated.toAccountId = acc.id;
        } else {
          updated.selectedAccountId = acc.id;
          updated.paymentMethod = acc.type === 'CREDIT_CARD' ? 'Credit Card' : acc.type === 'CASH' ? 'Cash' : 'UPI';
        }
        setPendingTx(updated);
        checkNextStep(updated);
      } else {
        addAIMessage("I couldn't find that account. Please select one:", getGroupedAccountOptions(updated));
      }
    } else if (stage === 'ASK_PAYMENT_METHOD') {
      const t = userMsg.toLowerCase();
      if (t.includes('upi') || t.includes('📱')) updated.paymentMethod = 'UPI';
      else if (t.includes('credit') || t.includes('💳')) updated.paymentMethod = 'Credit Card';
      else if (t.includes('cash') || t.includes('💵')) updated.paymentMethod = 'Cash';
      else if (t.includes('bank') || t.includes('🏦')) updated.paymentMethod = 'Bank Transfer';
      else updated.paymentMethod = userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    } else if (stage === 'ASK_UPI_APP') {
      updated.upiApp = userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    } else if (stage === 'ASK_CATEGORY') {
      updated.category = userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    } else if (stage === 'ASK_TAG') {
      updated.expenseType = userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    } else if (stage === 'ASK_PAYEE') {
      updated.partyName = userMsg.match(/(skip|none|no)/i) ? '' : userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    } else if (stage === 'ASK_NOTE') {
      if (!userMsg.trim() || userMsg.match(/^(skip|no|na|-)$/i)) {
        addAIMessage("Please add a short remark so you can remember this later!");
      } else {
        updated.note = userMsg;
        setPendingTx(updated);
        checkNextStep(updated);
      }
    } else if (stage === 'ASK_DATE') {
      const { date, confirmed } = parseDate(userMsg);
      updated.transactionDate = date;
      updated._dateConfirmed = true;
      setPendingTx(updated);
      checkNextStep(updated);
    }
  };

  const handleEdit = (field: string) => {
    const updated = { ...pendingTx };
    if (field === 'amount') { updated.amount = ''; setStage('ASK_AMOUNT'); addAIMessage("Correct Amount: How much was it?"); }
    if (field === 'bank') { updated.selectedAccountId = ''; setStage('ASK_BANK'); addAIMessage("Correct Account:", getGroupedAccountOptions(updated)); }
    if (field === 'category') { updated.category = ''; setStage('ASK_CATEGORY'); addAIMessage("Correct Category:", CATEGORIES); }
    if (field === 'tag') { updated.expenseType = ''; setStage('ASK_TAG'); addAIMessage("Correct Tag:", tags); }
    if (field === 'remark') { updated.note = ''; setStage('ASK_NOTE'); addAIMessage("Correct Remark:"); }
    if (field === 'date') { updated._dateConfirmed = false; setStage('ASK_DATE'); addAIMessage("When did this happen?", ['Today', 'Yesterday', '2 days ago', '3 days ago']); }
    setPendingTx(updated);
  };

  const handleReset = () => {
    setStage('IDLE');
    setPendingTx({
      type: '', amount: '', category: '', selectedAccountId: '', toAccountId: '',
      paymentMethod: '', upiApp: '', expenseType: '', partyName: '', note: '',
      transactionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), _dateConfirmed: false, _isPredicted: false
    });
    setMessages([{ role: 'ai', content: "Reset! Describe your next expense 👇" }]);
  };

  const handleVoice = () => {
    if (speech.listening) { speech.stop(); return; }
    speech.start((text) => {
      setInput(text);
      setMessages(prev => [...prev, { role: 'user', content: `🎤 ${text}` }]);
      setTimeout(() => handleSend(text), 100);
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FBFF] dark:bg-[#0A0A0A] relative">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-64">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'ai' ? 'items-start' : 'items-end'} gap-2 animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[88%] px-4 py-3 rounded-2xl text-[12px] font-medium shadow-sm flex items-start gap-2.5
              ${msg.role === 'ai'
                ? 'bg-white dark:bg-[#111111] text-neutral-800 dark:text-neutral-200 border border-brand-blue/5 dark:border-white/5'
                : 'bg-brand-green text-white'}`}>
              {msg.role === 'ai' && <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0 text-brand-green" />}
              <span className="leading-relaxed whitespace-pre-line">{msg.content}</span>
            </div>
            {msg.options && msg.options.length > 0 && (
              <div className="grid grid-cols-2 gap-1.5 w-full max-w-[88%]">
                {msg.options.map((opt: string) => (
                  <button
                    key={opt}
                    onClick={() => handleSend(opt)}
                    className="px-3 py-2 bg-white dark:bg-[#111111] border border-brand-blue/5 dark:border-white/5 rounded-xl text-[10px] font-black uppercase text-brand-green hover:bg-brand-green/5 transition-all shadow-sm active:scale-95 flex items-center justify-between group"
                  >
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
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#F7F7F7] via-[#F7F7F7]/95 dark:from-[#0A0A0A] dark:via-[#0A0A0A]/95 space-y-2.5 z-10">

        {/* Preview Card */}
        {stage === 'PREVIEW' && (
          <div className="mx-0.5 p-3 bg-[#F9FBFF] dark:bg-[#111111] border border-brand-blue/5 dark:border-white/5 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-brand-green" /> Preview
                {pendingTx._isPredicted && <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-brand-green/10 text-brand-green">AI Auto-filled</span>}
              </span>
              <button onClick={handleReset} className="text-[8px] font-black text-brand-green bg-brand-green/5 px-2 py-1 rounded-lg uppercase tracking-widest">
                Reset
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
              <div className="bg-white dark:bg-white/5 p-2 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-brand-green/20" onClick={() => handleEdit('bank')}>
                <Landmark className="w-3 h-3 text-neutral-400 shrink-0" />
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[7px] font-black text-neutral-400 uppercase leading-none">Account</span>
                  <span className="text-[9px] font-bold text-brand-green dark:text-white truncate">{accounts.find(a => a.id === pendingTx.selectedAccountId)?.bankName || '—'}</span>
                </div>
              </div>
              <div className="bg-white dark:bg-white/5 p-2 rounded-xl flex items-center gap-2 border border-transparent">
                <AppWindow className="w-3 h-3 text-neutral-400 shrink-0" />
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[7px] font-black text-neutral-400 uppercase leading-none">Method</span>
                  <span className="text-[9px] font-bold text-brand-green dark:text-white truncate">{pendingTx.upiApp || pendingTx.paymentMethod || '—'}</span>
                </div>
              </div>
              <div className="bg-white dark:bg-white/5 p-2 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-brand-green/20" onClick={() => handleEdit('tag')}>
                <Hash className="w-3 h-3 text-neutral-400 shrink-0" />
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[7px] font-black text-neutral-400 uppercase leading-none">Tag</span>
                  <span className="text-[9px] font-bold text-brand-green dark:text-white truncate">#{pendingTx.expenseType || '—'}</span>
                </div>
              </div>
              <div className="bg-white dark:bg-white/5 p-2 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors border border-transparent hover:border-brand-green/20" onClick={() => handleEdit('remark')}>
                <Lightbulb className="w-3 h-3 text-neutral-400 shrink-0" />
                <div className="flex flex-col overflow-hidden">
                  <span className="text-[7px] font-black text-neutral-400 uppercase leading-none">Note</span>
                  <span className="text-[9px] font-bold text-brand-green dark:text-white truncate">{pendingTx.note || '—'}</span>
                </div>
              </div>
            </div>

            {/* Date chip */}
            <div className="flex items-center justify-between px-1 mb-2">
              <button onClick={() => handleEdit('date')} className="text-[10px] text-neutral-400 flex items-center gap-1 hover:text-brand-green transition-colors">
                📅 {pendingTx.transactionDate ? format(new Date(pendingTx.transactionDate), 'dd MMM yyyy, h:mm a') : 'Set date'}
                <Pencil className="w-2.5 h-2.5" />
              </button>
            </div>

            <button
              onClick={() => onSave(pendingTx)}
              disabled={isSaving || showSuccess}
              className={`w-full py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${
                showSuccess
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-green text-white shadow-brand-green/30'
              } disabled:opacity-70`}
            >
              {isSaving ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Saving...</span></>
              ) : showSuccess ? (
                <><CheckCircle2 className="w-5 h-5" /><span>Saved!</span></>
              ) : (
                <><CheckCircle2 className="w-4 h-4" /><span>Save Entry</span></>
              )}
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="flex items-center gap-2 bg-[#F9FBFF] dark:bg-[#111111] p-1.5 rounded-2xl border border-brand-blue/5 dark:border-white/5 shadow-xl">
          {/* Voice button */}
          {speech.supported && (
            <button
              onClick={handleVoice}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${
                speech.listening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-400 hover:text-brand-green'
              }`}
            >
              {speech.listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={speech.listening ? "Listening..." : "Describe your expense..."}
            className="flex-1 bg-transparent px-2 py-2 text-[12px] font-bold outline-none dark:text-white placeholder:text-neutral-400"
          />
          {input && (
            <button onClick={() => setInput('')} className="text-neutral-300 hover:text-neutral-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleSend()}
            className="w-10 h-10 bg-brand-green text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
