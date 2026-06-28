import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Bot, CheckCircle2, Sparkles, Landmark, Lightbulb,
  ChevronRight, Hash, AppWindow, Pencil, Mic, MicOff, X,
  RotateCcw, Clock, Zap, TrendingUp, Camera, Image as ImageIcon, User
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
  '🍱': 'Food', '🍛': 'Food', '🥗': 'Food', '🍺': 'Food', '🧁': 'Food',
  '🚗': 'Transport', '🛵': 'Transport', '🚌': 'Transport', '🚕': 'Transport', '🛺': 'Transport',
  '✈️': 'Travel', '🚂': 'Travel', '🏨': 'Travel', '🗺️': 'Travel',
  '🛒': 'Groceries', '🥦': 'Groceries', '🥛': 'Groceries',
  '🛍️': 'Shopping', '👗': 'Shopping', '👟': 'Shopping', '💄': 'Shopping',
  '💊': 'Health', '🏥': 'Health', '🏋️': 'Health', '🩺': 'Health',
  '📺': 'Bills', '📱': 'Bills', '💡': 'Bills', '🔌': 'Bills',
  '📚': 'Education', '🎓': 'Education', '📖': 'Education',
  '🎬': 'Entertainment', '🎮': 'Entertainment', '🎵': 'Entertainment', '🎭': 'Entertainment',
  '🏠': 'Housing', '🏡': 'Housing',
  '💰': 'Investment', '📈': 'Investment', '💹': 'Investment',
  '🙏': 'Donations', '⛪': 'Donations', '🕌': 'Donations', '🛕': 'Donations',
};

const EMOJI_TAG: Record<string, string> = {
  '💼': 'Work', '🏢': 'Work', '🏠': 'Household', '👤': 'Personal',
};

// ─── Merchant Knowledge Base ──────────────────────────────────────────────
const MERCHANT_KNOWLEDGE: Record<string, { category: string; tag: string }> = {
  // ── Food & Dining ───────────────────────────────
  zomato: { category: 'Food', tag: 'Personal' },
  swiggy: { category: 'Food', tag: 'Personal' },
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
  haldirams: { category: 'Food', tag: 'Personal' },
  "haldiram's": { category: 'Food', tag: 'Personal' },
  'barbeque nation': { category: 'Food', tag: 'Personal' },
  bbq: { category: 'Food', tag: 'Personal' },
  saravana: { category: 'Food', tag: 'Personal' },
  'biryani by kilo': { category: 'Food', tag: 'Personal' },
  eatfit: { category: 'Food', tag: 'Personal' },
  faasos: { category: 'Food', tag: 'Personal' },
  box8: { category: 'Food', tag: 'Personal' },
  behrouz: { category: 'Food', tag: 'Personal' },
  magicpin: { category: 'Food', tag: 'Personal' },
  dineout: { category: 'Food', tag: 'Personal' },
  eatsure: { category: 'Food', tag: 'Personal' },
  restaurant: { category: 'Food', tag: 'Personal' },
  lunch: { category: 'Food', tag: 'Personal' },
  dinner: { category: 'Food', tag: 'Personal' },
  breakfast: { category: 'Food', tag: 'Personal' },
  snacks: { category: 'Food', tag: 'Personal' },
  bakery: { category: 'Food', tag: 'Personal' },
  // ── Groceries ──────────────────────────────────
  blinkit: { category: 'Groceries', tag: 'Household' },
  zepto: { category: 'Groceries', tag: 'Household' },
  dunzo: { category: 'Groceries', tag: 'Household' },
  bigbasket: { category: 'Groceries', tag: 'Household' },
  grofers: { category: 'Groceries', tag: 'Household' },
  jiomart: { category: 'Groceries', tag: 'Household' },
  instamart: { category: 'Groceries', tag: 'Household' },
  dmart: { category: 'Groceries', tag: 'Household' },
  'd-mart': { category: 'Groceries', tag: 'Household' },
  reliance: { category: 'Groceries', tag: 'Household' },
  'reliance smart': { category: 'Groceries', tag: 'Household' },
  more: { category: 'Groceries', tag: 'Household' },
  spencers: { category: 'Groceries', tag: 'Household' },
  'natures basket': { category: 'Groceries', tag: 'Household' },
  'country delight': { category: 'Groceries', tag: 'Household' },
  licious: { category: 'Groceries', tag: 'Household' },
  freshtohome: { category: 'Groceries', tag: 'Household' },
  milkbasket: { category: 'Groceries', tag: 'Household' },
  vegetables: { category: 'Groceries', tag: 'Household' },
  grocery: { category: 'Groceries', tag: 'Household' },
  supermarket: { category: 'Groceries', tag: 'Household' },
  kirana: { category: 'Groceries', tag: 'Household' },
  // ── Transport ──────────────────────────────────
  uber: { category: 'Transport', tag: 'Personal' },
  ola: { category: 'Transport', tag: 'Personal' },
  rapido: { category: 'Transport', tag: 'Personal' },
  irctc: { category: 'Transport', tag: 'Personal' },
  blusmart: { category: 'Transport', tag: 'Personal' },
  meru: { category: 'Transport', tag: 'Personal' },
  nammayatri: { category: 'Transport', tag: 'Personal' },
  'namma yatri': { category: 'Transport', tag: 'Personal' },
  shuttle: { category: 'Transport', tag: 'Personal' },
  petrol: { category: 'Transport', tag: 'Personal' },
  fuel: { category: 'Transport', tag: 'Personal' },
  diesel: { category: 'Transport', tag: 'Personal' },
  metro: { category: 'Transport', tag: 'Personal' },
  auto: { category: 'Transport', tag: 'Personal' },
  taxi: { category: 'Transport', tag: 'Personal' },
  cab: { category: 'Transport', tag: 'Personal' },
  parking: { category: 'Transport', tag: 'Personal' },
  toll: { category: 'Transport', tag: 'Personal' },
  fastag: { category: 'Transport', tag: 'Personal' },
  rickshaw: { category: 'Transport', tag: 'Personal' },
  // ── Travel ─────────────────────────────────────
  makemytrip: { category: 'Travel', tag: 'Personal' },
  goibibo: { category: 'Travel', tag: 'Personal' },
  redbus: { category: 'Travel', tag: 'Personal' },
  cleartrip: { category: 'Travel', tag: 'Personal' },
  ixigo: { category: 'Travel', tag: 'Personal' },
  airbnb: { category: 'Travel', tag: 'Personal' },
  oyo: { category: 'Travel', tag: 'Personal' },
  yatra: { category: 'Travel', tag: 'Personal' },
  easemytrip: { category: 'Travel', tag: 'Personal' },
  'booking.com': { category: 'Travel', tag: 'Personal' },
  treebo: { category: 'Travel', tag: 'Personal' },
  fabhotels: { category: 'Travel', tag: 'Personal' },
  flight: { category: 'Travel', tag: 'Personal' },
  hotel: { category: 'Travel', tag: 'Personal' },
  train: { category: 'Travel', tag: 'Personal' },
  // ── Shopping ────────────────────────────────────
  amazon: { category: 'Shopping', tag: 'Personal' },
  flipkart: { category: 'Shopping', tag: 'Personal' },
  myntra: { category: 'Shopping', tag: 'Personal' },
  meesho: { category: 'Shopping', tag: 'Personal' },
  ajio: { category: 'Shopping', tag: 'Personal' },
  nykaa: { category: 'Shopping', tag: 'Personal' },
  snapdeal: { category: 'Shopping', tag: 'Personal' },
  lenskart: { category: 'Shopping', tag: 'Personal' },
  croma: { category: 'Shopping', tag: 'Personal' },
  'reliance digital': { category: 'Shopping', tag: 'Personal' },
  decathlon: { category: 'Shopping', tag: 'Personal' },
  ikea: { category: 'Shopping', tag: 'Personal' },
  'h&m': { category: 'Shopping', tag: 'Personal' },
  zara: { category: 'Shopping', tag: 'Personal' },
  'tata cliq': { category: 'Shopping', tag: 'Personal' },
  firstcry: { category: 'Shopping', tag: 'Personal' },
  // ── Bills & Utilities ──────────────────────────
  netflix: { category: 'Bills', tag: 'Personal' },
  hotstar: { category: 'Bills', tag: 'Personal' },
  disney: { category: 'Bills', tag: 'Personal' },
  primevideo: { category: 'Bills', tag: 'Personal' },
  jio: { category: 'Bills', tag: 'Personal' },
  airtel: { category: 'Bills', tag: 'Personal' },
  vi: { category: 'Bills', tag: 'Personal' },
  bsnl: { category: 'Bills', tag: 'Personal' },
  electricity: { category: 'Bills', tag: 'Household' },
  water: { category: 'Bills', tag: 'Household' },
  gas: { category: 'Bills', tag: 'Household' },
  insurance: { category: 'Bills', tag: 'Personal' },
  lic: { category: 'Bills', tag: 'Personal' },
  'tata play': { category: 'Bills', tag: 'Household' },
  hathway: { category: 'Bills', tag: 'Household' },
  'act fibernet': { category: 'Bills', tag: 'Household' },
  broadband: { category: 'Bills', tag: 'Household' },
  wifi: { category: 'Bills', tag: 'Household' },
  dth: { category: 'Bills', tag: 'Household' },
  recharge: { category: 'Bills', tag: 'Personal' },
  postpaid: { category: 'Bills', tag: 'Personal' },
  prepaid: { category: 'Bills', tag: 'Personal' },
  // ── Entertainment ──────────────────────────────
  spotify: { category: 'Entertainment', tag: 'Personal' },
  bookmyshow: { category: 'Entertainment', tag: 'Personal' },
  'book my show': { category: 'Entertainment', tag: 'Personal' },
  pvr: { category: 'Entertainment', tag: 'Personal' },
  inox: { category: 'Entertainment', tag: 'Personal' },
  movie: { category: 'Entertainment', tag: 'Personal' },
  cinema: { category: 'Entertainment', tag: 'Personal' },
  concert: { category: 'Entertainment', tag: 'Personal' },
  gaming: { category: 'Entertainment', tag: 'Personal' },
  // ── Health ──────────────────────────────────────
  pharmeasy: { category: 'Health', tag: 'Personal' },
  netmeds: { category: 'Health', tag: 'Personal' },
  apollo: { category: 'Health', tag: 'Personal' },
  medplus: { category: 'Health', tag: 'Personal' },
  '1mg': { category: 'Health', tag: 'Personal' },
  'tata 1mg': { category: 'Health', tag: 'Personal' },
  practo: { category: 'Health', tag: 'Personal' },
  lybrate: { category: 'Health', tag: 'Personal' },
  'cult.fit': { category: 'Health', tag: 'Personal' },
  cultfit: { category: 'Health', tag: 'Personal' },
  medicine: { category: 'Health', tag: 'Personal' },
  pharmacy: { category: 'Health', tag: 'Personal' },
  hospital: { category: 'Health', tag: 'Personal' },
  doctor: { category: 'Health', tag: 'Personal' },
  gym: { category: 'Health', tag: 'Personal' },
  clinic: { category: 'Health', tag: 'Personal' },
  dentist: { category: 'Health', tag: 'Personal' },
  // ── Education ──────────────────────────────────
  unacademy: { category: 'Education', tag: 'Personal' },
  byjus: { category: 'Education', tag: 'Personal' },
  "byju's": { category: 'Education', tag: 'Personal' },
  coursera: { category: 'Education', tag: 'Personal' },
  udemy: { category: 'Education', tag: 'Personal' },
  skillshare: { category: 'Education', tag: 'Personal' },
  school: { category: 'Education', tag: 'Personal' },
  tuition: { category: 'Education', tag: 'Personal' },
  coaching: { category: 'Education', tag: 'Personal' },
  books: { category: 'Education', tag: 'Personal' },
  stationery: { category: 'Education', tag: 'Personal' },
  // ── Investment ──────────────────────────────────
  mutual: { category: 'Investment', tag: 'Personal' },
  zerodha: { category: 'Investment', tag: 'Personal' },
  groww: { category: 'Investment', tag: 'Personal' },
  upstox: { category: 'Investment', tag: 'Personal' },
  'angel one': { category: 'Investment', tag: 'Personal' },
  angelone: { category: 'Investment', tag: 'Personal' },
  kuvera: { category: 'Investment', tag: 'Personal' },
  sip: { category: 'Investment', tag: 'Personal' },
  stocks: { category: 'Investment', tag: 'Personal' },
  crypto: { category: 'Investment', tag: 'Personal' },
  // ── Loan ────────────────────────────────────────
  loan: { category: 'Loan', tag: 'Personal' },
  emi: { category: 'Loan', tag: 'Personal' },
  // ── Housing ─────────────────────────────────────
  rent: { category: 'Housing', tag: 'Household' },
  maintenance: { category: 'Housing', tag: 'Household' },
  'society maintenance': { category: 'Housing', tag: 'Household' },
  plumber: { category: 'Housing', tag: 'Household' },
  electrician: { category: 'Housing', tag: 'Household' },
  carpenter: { category: 'Housing', tag: 'Household' },
  maid: { category: 'Housing', tag: 'Household' },
  // ── Donations ───────────────────────────────────
  temple: { category: 'Donations', tag: 'Personal' },
  church: { category: 'Donations', tag: 'Personal' },
  mosque: { category: 'Donations', tag: 'Personal' },
  gurudwara: { category: 'Donations', tag: 'Personal' },
  charity: { category: 'Donations', tag: 'Personal' },
  donation: { category: 'Donations', tag: 'Personal' },
  ngo: { category: 'Donations', tag: 'Personal' },
};

// ─── UPI Apps ─────────────────────────────────────────────────────────────
const UPI_APPS: Record<string, string> = {
  gpay: 'GPay', 'google pay': 'GPay', googlepay: 'GPay', 'g pay': 'GPay',
  phonepe: 'PhonePe', 'phone pe': 'PhonePe',
  paytm: 'Paytm', bhim: 'BHIM', cred: 'CRED',
  slice: 'Slice', amazonpay: 'Amazon Pay', 'amazon pay': 'Amazon Pay',
  mobikwik: 'MobiKwik', whatsapp: 'WhatsApp Pay', 'whatsapp pay': 'WhatsApp Pay',
  jupiter: 'Jupiter', fi: 'Fi Money', freecharge: 'Freecharge',
  navi: 'Navi', 'samsung pay': 'Samsung Pay', imobile: 'iMobile Pay',
  payzapp: 'PayZapp', supermoney: 'SuperMoney',
};

// ─── Bank Nicknames ───────────────────────────────────────────────────────
const BANK_NICKNAMES: Record<string, string> = {
  sbi: 'state bank', pnb: 'punjab national', hdfc: 'hdfc',
  icici: 'icici', axis: 'axis', kotak: 'kotak',
  bob: 'bank of baroda', canara: 'canara', 'yes bank': 'yes bank',
  indusind: 'indusind', idfc: 'idfc', rbl: 'rbl',
  federal: 'federal', ubi: 'union bank', 'union bank': 'union bank',
  'indian bank': 'indian bank', iob: 'indian overseas',
  uco: 'uco bank', bandhan: 'bandhan', au: 'au small',
  'paytm bank': 'paytm payments', 'airtel bank': 'airtel payments',
  dbs: 'dbs', citi: 'citi', hsbc: 'hsbc',
  'standard chartered': 'standard chartered', sc: 'standard chartered',
  'post office': 'post office', fino: 'fino',
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
  if (!t || t.length < 4) return null; // Require at least 4 chars to avoid false positives
  let best = { word: '', dist: Infinity };
  for (const c of candidates) {
    if (c.length < 4) continue; // Skip short candidates
    const dist = levenshtein(t, c);
    // Require at least 60% character overlap (stricter than before)
    const maxDist = Math.max(1, Math.floor(Math.min(t.length, c.length) * 0.35));
    if (dist < best.dist && dist <= maxDist) best = { word: c, dist };
  }
  return best.word || null;
};

// ─── Date Parser ──────────────────────────────────────────────────────────
const parseDate = (text: string): { date: string; confirmed: boolean } => {
  const t = text.toLowerCase();
  const now = new Date();
  if (t.match(/\b(today|aaj|abhi)\b/)) return { date: format(now, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  if (t.match(/\b(yesterday|kal|kal ka)\b/)) return { date: format(subDays(now, 1), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  if (t.match(/\b(parso|day before yesterday)\b/)) return { date: format(subDays(now, 2), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  if (t.match(/\b(tarso|narso)\b/)) return { date: format(subDays(now, 3), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  // N days/weeks/months ago
  const daysAgo = t.match(/(\d+)\s+days?\s+ago/);
  if (daysAgo) return { date: format(subDays(now, parseInt(daysAgo[1])), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  const weeksAgo = t.match(/(\d+)\s+weeks?\s+ago/);
  if (weeksAgo) return { date: format(subWeeks(now, parseInt(weeksAgo[1])), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  // Hindi relative dates
  if (t.match(/\b(pichle hafte|pichle week|last week)\b/)) return { date: format(subWeeks(now, 1), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  if (t.match(/\b(pichle mahine|pichle month|last month)\b/)) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    return { date: format(d, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  }
  if (t.match(/\b(is hafte|is week|this week)\b/)) {
    const day = now.getDay();
    const monday = new Date(now); monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    return { date: format(monday, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  }
  // Last weekday
  const weekdays = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  for (let i = 0; i < weekdays.length; i++) {
    if (t.includes(`last ${weekdays[i]}`)) {
      const diff = (now.getDay() - i + 7) % 7 || 7;
      return { date: format(subDays(now, diff), "yyyy-MM-dd'T'HH:mm"), confirmed: true };
    }
  }
  // Month names: "15 march", "march 15", "15th march", "in january"
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const monthShort = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  for (let mi = 0; mi < months.length; mi++) {
    const mName = months[mi]; const mShort = monthShort[mi];
    const monthDayMatch = t.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${mName}|${mShort})`, 'i'));
    if (monthDayMatch) {
      const day = parseInt(monthDayMatch[1]);
      const d = new Date(now.getFullYear(), mi, day);
      if (d > now) d.setFullYear(d.getFullYear() - 1);
      return { date: format(d, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
    }
    const dayMonthMatch = t.match(new RegExp(`(?:${mName}|${mShort})\\s+(\\d{1,2})(?:st|nd|rd|th)?`, 'i'));
    if (dayMonthMatch) {
      const day = parseInt(dayMonthMatch[1]);
      const d = new Date(now.getFullYear(), mi, day);
      if (d > now) d.setFullYear(d.getFullYear() - 1);
      return { date: format(d, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
    }
    if (t.match(new RegExp(`\\bin\\s+(?:${mName}|${mShort})\\b`, 'i'))) {
      const d = new Date(now.getFullYear(), mi, 1);
      if (d > now) d.setFullYear(d.getFullYear() - 1);
      return { date: format(d, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
    }
  }
  // Full date: DD/MM/YYYY or DD-MM-YYYY
  const fullDate = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (fullDate) {
    let year = parseInt(fullDate[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, parseInt(fullDate[2]) - 1, parseInt(fullDate[1]));
    if (d <= now) return { date: format(d, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
  }
  // Day of current month
  const dayNum = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (dayNum) {
    const day = parseInt(dayNum[1]);
    if (day >= 1 && day <= 31) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      if (d <= now) return { date: format(d, "yyyy-MM-dd'T'HH:mm"), confirmed: true };
    }
  }
  // Simple DD/MM
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
    return String(Math.round(res * 100) / 100);
  }

  // Split: "split 1200 3 ways" or "split 1200 with rahul" (assumes / 2)
  const splitWaysMatch = t.match(/split\s+(\d+(?:\.\d+)?)\s+(\d+)\s+ways?/i);
  if (splitWaysMatch) {
    return String(Math.round(parseFloat(splitWaysMatch[1]) / parseFloat(splitWaysMatch[2]) * 100) / 100);
  }
  const splitWithMatch = t.match(/split\s+(\d+(?:\.\d+)?)\s+with\s+/i);
  if (splitWithMatch) {
    return String(Math.round(parseFloat(splitWithMatch[1]) / 2 * 100) / 100);
  }

  // Per person: "250 per person 4 people" or "250 x 4"
  const perPersonMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:per\s*person|each|per\s*head)\s*(?:for\s*)?(\d+)\s*(?:people|persons?|ppl)?/i);
  if (perPersonMatch) return String(Math.round(parseFloat(perPersonMatch[1]) * parseFloat(perPersonMatch[2]) * 100) / 100);

  // Percentage tip: "10% tip on 500" or "tip 10% of 500"
  const tipMatch = t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:tip|of)\s*(?:on\s*)?(\d+(?:\.\d+)?)/i);
  if (tipMatch) return String(Math.round(parseFloat(tipMatch[2]) * parseFloat(tipMatch[1]) / 100 * 100) / 100);
  const tipMatch2 = t.match(/(?:tip|percent)\s*(\d+(?:\.\d+)?)\s*%?\s*(?:on|of)\s*(\d+(?:\.\d+)?)/i);
  if (tipMatch2) return String(Math.round(parseFloat(tipMatch2[2]) * parseFloat(tipMatch2[1]) / 100 * 100) / 100);

  // Crore: "1.5cr" or "2 crore"
  const crMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?s?)\b/i);
  if (crMatch) return String(parseFloat(crMatch[1]) * 10000000);

  // Lakh: "1.5l" or "2 lakh"
  const lakhMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:l(?:akh|acs?)?)\b/i);
  if (lakhMatch) return String(parseFloat(lakhMatch[1]) * 100000);

  // K/Thousand: "2k" or "2.5k"
  const kMatch = t.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) return String(parseFloat(kMatch[1]) * 1000);

  // Hazar (Hindi thousand): "2 hazar" or "dhai hazar" (2500)
  const hazarMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:hazar|hazaar|hajar)\b/i);
  if (hazarMatch) return String(parseFloat(hazarMatch[1]) * 1000);
  if (t.match(/\b(dhai|dhaai)\s*(?:hazar|hazaar|hajar|sau)\b/)) {
    if (t.includes('hazar') || t.includes('hazaar') || t.includes('hajar')) return '2500';
    if (t.includes('sau')) return '250';
  }
  if (t.match(/\bsaadhe?\s*(\d+)\s*(?:hazar|hazaar|sau)\b/)) {
    const saadheMatch = t.match(/\bsaadhe?\s*(\d+)\s*(hazar|hazaar|sau)\b/);
    if (saadheMatch) {
      const num = parseFloat(saadheMatch[1]);
      const unit = saadheMatch[2];
      if (unit.startsWith('h')) return String((num + 0.5) * 1000);
      return String((num + 0.5) * 100);
    }
  }

  // Currency prefix: ₹500, Rs. 250, INR 1000
  const rsMatch = t.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
  if (rsMatch) return rsMatch[1];
  // Bare number fallback
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
  // Hinglish-aware type detection
  if (t.match(/\b(received|got|salary|income|credit|added|deposit|inflow|credited|mila|aaya|jama|milgaya|mil gaya)\b/)) type = 'CREDIT';
  else if (t.match(/\b(transfer(?:red)?\s+(?:to|from|\d)|moved?\s+(?:to|from|\d)|shifted\s+(?:to|from|\d)|bheja)\b/)) type = 'TRANSFER';
  else if (t.match(/\b(paid|spent|bought|expense|debit|gave|withdrawn?|purchased?|kharcha|diya|de diya|kharch|nikala|nikaal|udhar\s+diya|liya|mangaya|order)\b/)) type = 'DEBIT';
  else if (t.match(/\bsent?\s+(?:₹|rs|\d|money|amount|paisa|paise|rupaiye)/)) type = 'TRANSFER';
  // Hinglish refund/return
  else if (t.match(/\b(refund|wapas\s+(?:mila|aaya)|return|cashback)\b/)) type = 'CREDIT';

  const acc = resolveBank(t, accounts);
  let accountId = acc?.id || '';
  let autoPaymentMethod = acc ? (acc.type === 'CREDIT_CARD' ? 'Credit Card' : acc.type === 'CASH' ? 'Cash' : 'UPI') : '';

  let upiApp = '';
  for (const [key, val] of Object.entries(UPI_APPS)) { if (t.includes(key)) { upiApp = val; break; } }

  let paymentMethod = autoPaymentMethod;
  if (!paymentMethod) {
    if (t.match(/\b(cash|nakit|naqad|nagad)\b/)) paymentMethod = 'Cash';
    else if (t.match(/\b(credit\s+card|cc|credit\s*card)\b/)) paymentMethod = 'Credit Card';
    else if (t.match(/\b(debit\s+card|dc|debit\s*card)\b/)) paymentMethod = 'Debit Card';
    else if (t.match(/\b(net\s*banking|internet\s*banking|online\s*banking)\b/)) paymentMethod = 'Net Banking';
    else if (t.match(/\b(wallet|paytm\s+wallet|mobikwik\s+wallet)\b/)) paymentMethod = 'Wallet';
    else if (t.match(/\b(cheque|check|cheq)\b/)) paymentMethod = 'Cheque';
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

  // Hinglish category keywords
  if (!category) {
    const hindiCategories: Record<string, string> = {
      khana: 'Food', nashta: 'Food', 'chai pani': 'Food', 'chai-pani': 'Food',
      doodh: 'Groceries', sabzi: 'Groceries', sabji: 'Groceries', atta: 'Groceries', chawal: 'Groceries', dal: 'Groceries', ration: 'Groceries',
      bijli: 'Bills', 'bijli ka bill': 'Bills', 'paani ka bill': 'Bills', 'gas ka bill': 'Bills', bharti: 'Bills',
      dawai: 'Health', dawa: 'Health', ilaaj: 'Health', 'doctor ki fees': 'Health',
      kiraya: 'Transport', 'auto ka kiraya': 'Transport', gaadi: 'Transport', rick: 'Transport',
      padhai: 'Education', 'school ki fees': 'Education', kitaab: 'Education', 'coaching fees': 'Education',
      chanda: 'Donations', daan: 'Donations', mandir: 'Donations',
    };
    for (const [hindi, cat] of Object.entries(hindiCategories)) {
      if (t.includes(hindi)) { category = cat; tag = tag || 'Personal'; break; }
    }
  }

  // Time-of-day category suggestion (only if still no category)
  if (!category && amount) {
    const hour = new Date().getHours();
    if (hour >= 6 && hour <= 10) category = 'Food'; // Morning = breakfast/coffee
    else if (hour >= 11 && hour <= 14) category = 'Food'; // Lunch time
    else if (hour >= 19 && hour <= 22) category = 'Food'; // Dinner time
  }

  let parsedPayee = '';
  const payeeMatch = text.match(/\b(?:to|paid\s+to|at|@|from|received\s+from|on)\s+([A-Za-z][A-Za-z0-9\s]{0,20}?)(?:\s+(?:via|using|on|for|from|today|yesterday|\d)|$)/i);
  if (payeeMatch && type !== 'TRANSFER') parsedPayee = payeeMatch[1].trim();

  // Aggressive payee fallback
  if (!parsedPayee && type !== 'TRANSFER') {
     const simpleMatch = text.match(/(?:₹|rs)?\s*\d+(?:\.\d+)?(?:k)?\s+([A-Za-z]+)/i);
     if (simpleMatch) {
       const candidate = simpleMatch[1].trim().toLowerCase();
       const skipWords = ['and', 'for', 'to', 'from', 'via', 'using', 'in', 'on', 'spent', 'paid', 'credit', 'debit', 'cash', 'upi', 'gpay', 'today', 'yesterday'];
       if (!skipWords.includes(candidate) && !appCategories.map(c => c.toLowerCase()).includes(candidate)) {
         parsedPayee = simpleMatch[1].trim();
       }
     }
  }

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
        if (tx.party) {
          const key = tx.party.toLowerCase().trim();
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
export const AIChatEntry: React.FC<AIChatEntryProps> = ({ onSave, accounts, tags, isSaving, showSuccess }) => {
  const { categories: appCategories } = useCategories();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'ai', content: "Hi! 👋 Describe your expense naturally — I'll fill everything in.\n\nTry: *\"paid 500 to Zomato via GPay from HDFC yesterday for dinner\"*\nOr say *\"same\"* to repeat your last entry." }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [stage, setStage] = useState<ChatStage>('IDLE');
  const [pendingTx, setPendingTx] = useState<any>({
    type: '', amount: '', category: '', selectedAccountId: '', toAccountId: '',
    paymentMethod: '', upiApp: '', expenseType: '', party: '', note: '',
    transactionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), _dateConfirmed: false, _isPredicted: false, _confidence: 0
  });
  const [multiQueue, setMultiQueue] = useState<string[]>([]);
  const [autocomplete, setAutocomplete] = useState<any[]>([]);
  const [lastSaved, setLastSaved] = useState<any>(null);
  const [isAutoFillEnabled, setIsAutoFillEnabled] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const { recentTx, smartDefaults, payeeMemory } = usePersonalLearning();

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  // Load autocomplete suggestions from past transactions
  useEffect(() => {
    if (input.trim().length < 2) { setAutocomplete([]); return; }
    const q = input.toLowerCase();
    db.transactions.filter(tx =>
      (tx.note && tx.note.toLowerCase().includes(q)) ||
      (tx.party && tx.party.toLowerCase().includes(q))
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
    if (tx.party && tx.party !== '-' && !tx.expenseType && tx.type === 'DEBIT') {
       const SUBSCRIPTION_KEYWORDS = ['netflix', 'spotify', 'prime', 'hotstar', 'youtube', 'apple', 'chatgpt', 'openai', 'github', 'hostinger', 'vercel'];
       if (SUBSCRIPTION_KEYWORDS.some(k => tx.party.toLowerCase().includes(k))) {
          tx.expenseType = 'Subscription';
       }
    }
    if (!tx.amount) { setStage('ASK_AMOUNT'); addAIMessage("How much was it? (e.g. 250, 2k, ₹500)"); }
    else if (!tx.type) { setStage('ASK_TYPE'); addAIMessage("Was this an Expense, Income, or Transfer?", ['💸 Expense', '💰 Income', '🔄 Transfer']); }
    else if (!tx.party && tx.party !== '-') {
      setStage('ASK_PAYEE');
      const prompt = tx.type === 'CREDIT' ? "Who paid you? (or source of income)" : tx.type === 'TRANSFER' ? "Who did you send this to?" : "Who did you pay? (or where did you spend?)";
      addAIMessage(prompt, ['Skip']);
    }
    else if (!tx.category && tx.type !== 'TRANSFER') {
      setStage('ASK_CATEGORY'); addAIMessage("Pick a category:", appCategories);
      setAutocomplete(appCategories);
    } else if (!tx.selectedAccountId) {
      setStage('ASK_BANK');
      const prompt = tx.type === 'CREDIT' ? "Which account received this?" : "Which account did you pay from?";
      // Show smart default as first option if available
      const options = getGroupedAccountOptions(tx);
      if (smartDefaults.accountId) {
        const defaultAcc = accounts.find(a => a.id === Number(smartDefaults.accountId));
        if (defaultAcc) {
          const emoji = defaultAcc.type === 'BANK' ? '🏦' : defaultAcc.type === 'CASH' ? '💵' : '💳';
          const defLabel = `${emoji} ${defaultAcc.bankName}`;
          // Move default to front
          const filtered = options.filter(o => o !== defLabel);
          addAIMessage(prompt, [defLabel, ...filtered]);
        } else addAIMessage(prompt, options);
      } else addAIMessage(prompt, options);
    } else if (tx.type === 'TRANSFER' && !tx.toAccountId) {
      setStage('ASK_BANK'); addAIMessage("Transfer to which account?", getGroupedAccountOptions(tx));
    } else if (!tx.paymentMethod) {
      // Show smart default method as first option
      const methods = ['📱 UPI', '💳 Credit Card', '💵 Cash', '🏦 Bank Transfer'];
      if (smartDefaults.paymentMethod) {
        const defMethod = methods.find(m => m.toLowerCase().includes(smartDefaults.paymentMethod.toLowerCase()));
        if (defMethod) {
          const filtered = methods.filter(m => m !== defMethod);
          setStage('ASK_PAYMENT_METHOD'); addAIMessage("How did you pay?", [defMethod, ...filtered]);
        } else { setStage('ASK_PAYMENT_METHOD'); addAIMessage("How did you pay?", methods); }
      } else { setStage('ASK_PAYMENT_METHOD'); addAIMessage("How did you pay?", methods); }
    } else if (tx.paymentMethod === 'UPI' && !tx.upiApp) {
      const upiApps = ['GPay', 'PhonePe', 'Paytm', 'BHIM', 'CRED'];
      if (smartDefaults.upiApp) {
        const filtered = upiApps.filter(a => a !== smartDefaults.upiApp);
        setStage('ASK_UPI_APP'); addAIMessage("Which UPI app?", [smartDefaults.upiApp, ...filtered]);
      } else { setStage('ASK_UPI_APP'); addAIMessage("Which UPI app?", upiApps); }
    } else if (!tx.expenseType && tx.type !== 'TRANSFER') {
      setStage('ASK_TAG'); addAIMessage("Tag this as:", tags);
    } else if (!tx.note && tx.note !== '-') {
      setStage('ASK_NOTE'); addAIMessage("Add a short remark (Optional):", ['Skip']);
    } else if (!tx._dateConfirmed) {
      setStage('ASK_DATE'); addAIMessage("When did this happen?", ['Today', 'Yesterday', '2 days ago', '3 days ago']);
    } else {
      setStage('PREVIEW');
      const conf = tx._confidence;
      const confLabel = conf >= 80 ? '🟢 High' : conf >= 50 ? '🟡 Medium' : '🔴 Low';
      const warningNote = conf < 50 ? '\n⚠️ Low confidence — please double-check all fields before saving!' : '';
      addAIMessage(`✅ Entry ready! Confidence: ${confLabel} (${conf}%)\n${tx._isPredicted ? '🤖 Smart-filled from your history' : ''}${warningNote}\nReview below and tap Save.`);
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



  const handleSend = useCallback((msgOverride?: string) => {
    const userMsg = (msgOverride || input).trim();
    if (!userMsg) return;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setAutocomplete([]);

    let updated = { ...pendingTx };

    // ── Special commands ──────────────────────────────────────────────────
    const t = userMsg.toLowerCase();
    
    // Chat-based Undo / Delete
    if (stage === 'IDLE' || stage === 'PREVIEW') {
      const deleteMatch = t.match(/^(?:undo|delete|remove)\s*(.*)$/i);
      if (deleteMatch) {
        const target = deleteMatch[1].trim();
        setIsTyping(true);
        setTimeout(async () => {
          if (!target || target === 'last' || target === 'that' || target === 'it' || target === 'transaction') {
            const last = await db.transactions.orderBy('dateTime').reverse().first();
            if (last && last.id) {
              if (last.linkedTransactionId) {
                await db.transactions.delete(last.linkedTransactionId);
              }
              await db.transactions.delete(last.id);
              setMessages(prev => [...prev, { role: 'ai', content: `🗑️ Deleted your last transaction (₹${last.amount} for ${last.party || last.category || 'unknown'}).` }]);
              handleReset();
            } else {
              setMessages(prev => [...prev, { role: 'ai', content: `Hmm, I couldn't find any recent transaction to delete.` }]);
            }
          } else {
            const recentMatches = await db.transactions
              .filter(tx => 
                (tx.party?.toLowerCase().includes(target) || false) || 
                (tx.category?.toLowerCase().includes(target) || false) ||
                (tx.note?.toLowerCase().includes(target) || false)
              )
              .toArray();
            
            if (recentMatches.length > 0) {
              recentMatches.sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
              const match = recentMatches[0];
              if (match.id) {
                if (match.linkedTransactionId) {
                  await db.transactions.delete(match.linkedTransactionId);
                }
                await db.transactions.delete(match.id);
                setMessages(prev => [...prev, { role: 'ai', content: `🗑️ Deleted recent transaction matching "${target}" (₹${match.amount} for ${match.party || match.category}).` }]);
                handleReset();
              }
            } else {
              setMessages(prev => [...prev, { role: 'ai', content: `I couldn't find any recent transactions matching "${target}" to delete.` }]);
            }
          }
          setIsTyping(false);
        }, 600);
        return;
      }
    }

    // Chat-based Undo / Delete
    if (stage === 'IDLE' || stage === 'PREVIEW') {
      const deleteMatch = t.match(/^(?:undo|delete|remove)\s*(.*)$/i);
      if (deleteMatch) {
        const target = deleteMatch[1].trim();
        setIsTyping(true);
        setTimeout(async () => {
          if (!target || target === 'last' || target === 'that' || target === 'it' || target === 'transaction') {
            const last = await db.transactions.orderBy('dateTime').reverse().first();
            if (last && last.id) {
              if (last.linkedTransactionId) {
                await db.transactions.delete(last.linkedTransactionId);
              }
              await db.transactions.delete(last.id);
              setMessages(prev => [...prev, { role: 'ai', content: `🗑️ Deleted your last transaction (₹${last.amount} for ${last.party || last.category || 'unknown'}).` }]);
              handleReset();
            } else {
              setMessages(prev => [...prev, { role: 'ai', content: `Hmm, I couldn't find any recent transaction to delete.` }]);
            }
          } else {
            const recentMatches = await db.transactions
              .filter(tx => 
                (tx.party?.toLowerCase().includes(target) || false) || 
                (tx.category?.toLowerCase().includes(target) || false) ||
                (tx.note?.toLowerCase().includes(target) || false)
              )
              .toArray();
            
            if (recentMatches.length > 0) {
              recentMatches.sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
              const match = recentMatches[0];
              if (match.id) {
                if (match.linkedTransactionId) {
                  await db.transactions.delete(match.linkedTransactionId);
                }
                await db.transactions.delete(match.id);
                setMessages(prev => [...prev, { role: 'ai', content: `🗑️ Deleted recent transaction matching "${target}" (₹${match.amount} for ${match.party || match.category}).` }]);
                handleReset();
              }
            } else {
              setMessages(prev => [...prev, { role: 'ai', content: `I couldn't find any recent transactions matching "${target}" to delete.` }]);
            }
          }
          setIsTyping(false);
        }, 600);
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
          category: last.category, expenseType: last.expenseType || '', party: last.party || '',
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

      // DO NOT auto-fill accountId/paymentMethod/upiApp from smart defaults.
      // Instead, let checkNextStep ASK the user (with smart defaults shown as first option).
      // Only apply payee memory for CATEGORY (not bank/method) — since category is safe to predict.
      if (isAutoFillEnabled && p.parsedPayee) {
        const mem = payeeMemory[p.parsedPayee.toLowerCase()];
        if (mem) {
          if (!p.category) { p.category = mem.category; p.isPredicted = true; }
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
    } else if (stage === 'ASK_PAYEE') {
      if (t.match(/^(skip|no|na|-)$/i)) {
        updated.party = '-';
      } else {
        updated.party = userMsg;
        // SMART AUTO-FILL: Check payee memory immediately
        if (isAutoFillEnabled) {
          const mem = payeeMemory[updated.party.toLowerCase()];
          if (mem) {
            if (!updated.category) { updated.category = mem.category; updated._isPredicted = true; }
          } else {
             // Also try merchant KB
             const merchantKeys = Object.keys(MERCHANT_KNOWLEDGE);
             const fuzzyMerchant = fuzzyMatch(updated.party, merchantKeys);
             if (fuzzyMerchant) {
               updated.category = MERCHANT_KNOWLEDGE[fuzzyMerchant].category;
               updated.expenseType = updated.expenseType || MERCHANT_KNOWLEDGE[fuzzyMerchant].tag;
               updated._isPredicted = true;
             }
          }
        }
      }
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
      if (!userMsg.trim() || userMsg.match(/^(skip|no|na|-)$/i)) updated.note = '-';
      else updated.note = userMsg; 
      setPendingTx(updated); checkNextStep(updated);
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
      ...(p.parsedPayee && { party: p.parsedPayee }),
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
    if (field === 'payee') { updated.party = ''; setStage('ASK_PAYEE'); addAIMessage(updated.type === 'CREDIT' ? "Who paid you? (or source of income)" : updated.type === 'TRANSFER' ? "Who did you send this to?" : "Who did you pay? (or where did you spend?)", ['Skip']); }
    if (field === 'remark') { updated.note = ''; setStage('ASK_NOTE'); addAIMessage("Correct Remark:"); }
    if (field === 'date') { updated._dateConfirmed = false; setStage('ASK_DATE'); addAIMessage("When did this happen?", ['Today', 'Yesterday', '2 days ago', '3 days ago']); }
    setPendingTx(updated);
  };

  const handleReset = () => {
    setStage('IDLE');
    setPendingTx({ type: '', amount: '', category: '', selectedAccountId: '', toAccountId: '', paymentMethod: '', upiApp: '', expenseType: '', party: '', note: '', transactionDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), _dateConfirmed: false, _isPredicted: false, _confidence: 0 });
    setMultiQueue([]);
    setMessages([{ role: 'ai', content: "Reset! Tell me about your next expense 👇" }]);
  };

  const handleSaveAndNext = (tx: any) => {
    const finalTx = { ...tx };
    if (finalTx.party === '-') finalTx.party = '';
    if (finalTx.note === '-') finalTx.note = '';
    
    setLastSaved(finalTx);
    onSave(finalTx);
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
  const repeatLastTx = (tx: any) => {
    const cloned = {
      ...pendingTx,
      amount: tx.amount, type: tx.type, selectedAccountId: tx.accountId,
      paymentMethod: tx.paymentMethod, upiApp: tx.upiApp || '',
      category: tx.category, expenseType: tx.expenseType || '', party: tx.party || '',
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
                <div className="absolute top-1 right-1 opacity-100"><Pencil className="w-2.5 h-2.5 text-brand-green/40 group-hover:text-brand-green transition-colors" /></div>
                <span className="text-[17px] font-black text-brand-green dark:text-white">₹{pendingTx.amount}</span>
                <span className={`text-[7px] font-black uppercase ${pendingTx.type === 'CREDIT' ? 'text-brand-green' : 'text-brand-red'}`}>
                  {pendingTx.type === 'CREDIT' ? 'Inflow' : pendingTx.type === 'TRANSFER' ? 'Transfer' : 'Outflow'}
                </span>
              </div>
              <div className="bg-white dark:bg-white/5 p-2 rounded-2xl flex items-center gap-2 cursor-pointer hover:ring-2 ring-brand-green/30 transition-all group relative" onClick={() => handleEdit('category')}>
                <div className="absolute top-1 right-1 opacity-100"><Pencil className="w-2.5 h-2.5 text-brand-green/40 group-hover:text-brand-green transition-colors" /></div>
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
                { icon: <User className="w-3 h-3 text-neutral-400 shrink-0" />, label: 'Payee', value: pendingTx.party || '—', field: 'payee' },
                { icon: <Hash className="w-3 h-3 text-neutral-400 shrink-0" />, label: 'Tag', value: `#${pendingTx.expenseType || '—'}`, field: 'tag' },
                { icon: <Lightbulb className="w-3 h-3 text-neutral-400 shrink-0" />, label: 'Note', value: pendingTx.note || '—', field: 'remark' },
              ].map(({ icon, label, value, field }) => (
                <div key={label} onClick={() => field && handleEdit(field)}
                  className={`bg-white dark:bg-white/5 p-2 rounded-xl flex items-center gap-2 border border-transparent transition-colors relative group ${field ? 'cursor-pointer hover:border-brand-green/20 hover:bg-neutral-50 dark:hover:bg-white/5' : ''}`}>
                  {field && <div className="absolute top-1.5 right-1.5 opacity-100"><Pencil className="w-2.5 h-2.5 text-brand-green/40 group-hover:text-brand-green transition-colors" /></div>}
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
              <button key={i} onClick={() => handleSend(`${tx.amount} ${tx.party || tx.note || tx.category} today`)}
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
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Expense, question, or 'same'..."
            className="flex-1 bg-transparent px-3 py-2 text-[12px] font-bold outline-none dark:text-white placeholder:text-neutral-400"
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
