
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, CheckCircle2, Sparkles, Calendar, User as UserIcon, Landmark, Smartphone, CreditCard, Coins, Tag, Lightbulb, MoveHorizontal, Check, Zap, ChevronRight, Hash, AppWindow, Pencil, Camera, Image, Loader2, ScanLine, Receipt, X } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';
import Tesseract from 'tesseract.js';

interface AIChatEntryProps {
  onSave: (transaction: any) => void;
  accounts: any[];
  tags: string[];
}

type ChatStage = 'IDLE' | 'ASK_AMOUNT' | 'ASK_TYPE' | 'ASK_BANK' | 'ASK_PAYMENT_METHOD' | 'ASK_UPI_APP' | 'ASK_CATEGORY' | 'ASK_TAG' | 'ASK_PAYEE' | 'ASK_NOTE' | 'ASK_DATE' | 'PREVIEW';

const COMMON_BANK_NICKNAMES: Record<string, string> = {
  'sbi': 'state bank',
  'pnb': 'punjab national',
  'hdfc': 'hdfc bank',
  'icici': 'icici bank',
  'axis': 'axis bank',
  'kotak': 'kotak mahindra',
};

const MERCHANT_KNOWLEDGE: Record<string, { category: string, tag: string }> = {
  'starbucks': { category: 'Food', tag: 'Personal' },
  'mcdonalds': { category: 'Food', tag: 'Personal' },
  'kfc': { category: 'Food', tag: 'Personal' },
  'zomato': { category: 'Food', tag: 'Personal' },
  'swiggy': { category: 'Food', tag: 'Personal' },
  'uber': { category: 'Transport', tag: 'Work' },
  'amazon': { category: 'Shopping', tag: 'Personal' },
  'netflix': { category: 'Bills', tag: 'Personal' },
  'spotify': { category: 'Entertainment', tag: 'Personal' },
};

export const AIChatEntry: React.FC<AIChatEntryProps> = ({ onSave, accounts, tags }) => {
  const [messages, setMessages] = useState<any[]>([
    { role: 'ai', content: "Hi! I've cleared the confusion. I'll now show you the **Real Account Names** exactly as you added them!" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [stage, setStage] = useState<ChatStage>('IDLE');
  
  const [pendingTx, setPendingTx] = useState<any>({
    type: '', amount: '', category: '', selectedAccountId: '', toAccountId: '',
    paymentMethod: '', upiApp: '', expenseType: '', partyName: '', note: '',
    transactionDate: new Date().toISOString().slice(0, 16), _dateConfirmed: false, _isPredicted: false
  });

  // Receipt scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addAIMessage = (content: string, options: string[] = [], extra?: { receiptImage?: string }) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', content, options, ...extra }]);
      setIsTyping(false);
    }, 400);
  };

  // ---- Receipt Scanning Logic ----
  const parseReceiptText = (ocrText: string) => {
    const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
    const fullText = ocrText.toLowerCase();
    
    // ---- ROBUST AMOUNT DETECTION (line-by-line, priority-based) ----
    let amount = '';

    // Helper: extract the first valid monetary number from a string
    const extractMoney = (str: string): string | null => {
      // Match amounts like ₹1,234.56 or Rs. 1234 or just 1234.00
      const moneyPatterns = [
        /[₹]\s*(\d[\d,]*\.?\d{0,2})/,
        /(?:rs\.?|inr\.?)\s*(\d[\d,]*\.?\d{0,2})/i,
        /(\d[\d,]*\.\d{2})\b/,      // decimal amounts like 456.00
        /\b(\d[\d,]{2,})\b/,         // comma-separated or 3+ digit numbers
      ];
      for (const p of moneyPatterns) {
        const m = str.match(p);
        if (m) {
          const val = parseFloat(m[1].replace(/,/g, ''));
          // Filter out noise: phone numbers (10 digits), GST (15 chars), dates, years
          if (val >= 1 && val < 1000000 && !/^\d{10,}$/.test(m[1].replace(/,/g, ''))) {
            return m[1].replace(/,/g, '');
          }
        }
      }
      return null;
    };

    // Priority tiers — scan every line, pick the best match
    // Tier 1 (highest): Grand Total / Net Payable / Amount Due  
    // Tier 2: Total Amount / Total Bill / Total Due  
    // Tier 3: "Total" alone  
    // Tier 4: ₹ or Rs. amounts on any line  
    // Within a tier, we prefer the LAST occurrence (final total is usually at bottom)

    let tier1Amount = '';
    let tier2Amount = '';
    let tier3Amount = '';
    const tier4Amounts: string[] = [];

    for (const line of lines) {
      const lo = line.toLowerCase();
      
      // Skip lines that look like non-amount data
      if (lo.match(/\b(gstin?|cin|fssai|pan|phone|tel|mob|invoice\s*(?:no|#|id)|order\s*(?:no|#|id)|bill\s*no|token|table|qty|hsn|sac)\b/i)) continue;

      // Tier 1: Grand Total, Net Total, Amount Due, Balance Due, Net Payable, You Pay
      if (lo.match(/\b(grand\s*total|net\s*total|net\s*payable|amount\s*(?:due|payable)|balance\s*due|you\s*pay|final\s*amount|bill\s*total|total\s*payable)\b/)) {
        const val = extractMoney(line);
        if (val) tier1Amount = val; // keep last (bottom-most)
      }
      // Tier 2: Total Amount, Total Bill, Total (with qualifier)
      else if (lo.match(/\b(total\s*(?:amount|bill|due|value|charges|price|cost|amt))\b/)) {
        const val = extractMoney(line);
        if (val) tier2Amount = val;
      }
      // Tier 3: just "total" (but NOT "sub total" or "subtotal")
      else if (lo.match(/\btotal\b/) && !lo.match(/\b(sub\s*total|subtotal|items?\s*total)\b/)) {
        const val = extractMoney(line);
        if (val) tier3Amount = val;
      }
      // Tier 4: Any line with ₹ or Rs. 
      else if (lo.match(/[₹]|rs\.?|inr/)) {
        const val = extractMoney(line);
        if (val) tier4Amounts.push(val);
      }
    }

    // Pick the highest-priority amount found
    amount = tier1Amount || tier2Amount || tier3Amount || '';

    // If no total-keyword match, use the LARGEST currency-prefixed amount (likely the total)
    if (!amount && tier4Amounts.length > 0) {
      const nums = tier4Amounts.map(n => parseFloat(n));
      amount = tier4Amounts[nums.indexOf(Math.max(...nums))];
    }

    // Ultimate fallback: largest reasonable number in the entire text
    if (!amount) {
      const allNumbers: number[] = [];
      for (const line of lines) {
        const lo = line.toLowerCase();
        // Skip identifier lines
        if (lo.match(/\b(gstin?|cin|fssai|pan|phone|tel|mob|invoice|order|bill\s*no|token|hsn|sac|date|time)\b/i)) continue;
        const matches = line.match(/\b(\d[\d,]*\.?\d{0,2})\b/g);
        if (matches) {
          for (const m of matches) {
            const val = parseFloat(m.replace(/,/g, ''));
            // Filter: not a year (2020-2030), not a phone number, reasonable range
            if (val >= 1 && val < 500000 && !/^20[1-3]\d$/.test(m) && m.replace(/,/g, '').length < 8) {
              allNumbers.push(val);
            }
          }
        }
      }
      if (allNumbers.length > 0) amount = Math.max(...allNumbers).toString();
    }

    // Extract merchant/store name — usually the first line or two
    let merchant = '';
    for (const line of lines.slice(0, 3)) {
      const cleaned = line.replace(/[^a-zA-Z\s]/g, '').trim();
      if (cleaned.length > 2 && !cleaned.match(/^(date|time|invoice|receipt|bill|tax|gst|total|qty)/i)) {
        merchant = cleaned;
        break;
      }
    }

    // Detect category from known keywords
    let category = '';
    const categoryKeywords: Record<string, string[]> = {
      'Food': ['restaurant', 'cafe', 'pizza', 'burger', 'coffee', 'tea', 'food', 'dine', 'eat', 'sweets', 'bakery', 'biryani', 'chicken', 'meal', 'lunch', 'dinner', 'breakfast', 'snack', 'juice', 'milkshake', 'ice cream', 'zomato', 'swiggy', 'dominos', 'mcdonalds', 'kfc', 'subway', 'starbucks'],
      'Transport': ['uber', 'ola', 'rapido', 'fuel', 'petrol', 'diesel', 'parking', 'toll', 'metro', 'bus', 'taxi', 'auto', 'cab'],
      'Shopping': ['mart', 'store', 'shop', 'mall', 'retail', 'fashion', 'clothing', 'electronics', 'amazon', 'flipkart', 'myntra'],
      'Bills': ['electricity', 'water', 'gas', 'internet', 'broadband', 'recharge', 'mobile', 'phone', 'bill', 'utility', 'airtel', 'jio', 'vi '],
      'Entertainment': ['movie', 'cinema', 'theatre', 'netflix', 'spotify', 'game', 'concert', 'show', 'ticket', 'pvr', 'inox'],
      'Rent': ['rent', 'lease', 'housing', 'apartment', 'flat'],
    };
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => fullText.includes(kw))) {
        category = cat;
        break;
      }
    }

    // Extract date
    let date = '';
    const datePatterns = [
      /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/,
      /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})\b/i,
    ];
    for (const dp of datePatterns) {
      const m = ocrText.match(dp);
      if (m) {
        try {
          const parsed = new Date(m[0]);
          if (!isNaN(parsed.getTime())) {
            date = format(parsed, "yyyy-MM-dd'T'HH:mm");
          }
        } catch { /* ignore */ }
        break;
      }
    }

    // Build a smart note from receipt
    let note = '';
    if (merchant) note = `Receipt from ${merchant}`;

    return { amount, merchant, category, date, note };
  };

  const handleReceiptScan = async (file: File) => {
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setReceiptPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setIsScanning(true);
    setScanProgress(0);

    // Add scanning message to chat
    setMessages(prev => [...prev, { role: 'user', content: '📸 Scanning receipt...', receiptImage: URL.createObjectURL(file) }]);

    try {
      const result = await Tesseract.recognize(file, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setScanProgress(Math.round(m.progress * 100));
          }
        },
      });

      const ocrText = result.data.text;
      console.log('[Receipt OCR] Raw text:\n', ocrText);
      const parsed = parseReceiptText(ocrText);
      console.log('[Receipt OCR] Parsed:', parsed);

      setIsScanning(false);
      setScanProgress(0);

      // Build summary message
      const findings: string[] = [];
      if (parsed.amount) findings.push(`💰 Amount: ₹${parsed.amount}`);
      if (parsed.merchant) findings.push(`🏪 Merchant: ${parsed.merchant}`);
      if (parsed.category) findings.push(`📂 Category: ${parsed.category}`);
      if (parsed.date) findings.push(`📅 Date detected`);

      if (findings.length > 0) {
        addAIMessage(
          `🧾 Receipt scanned! Here's what I found:\n${findings.join('\n')}\n\nI'll use this to fill your transaction.`,
          [],
          { receiptImage: undefined }
        );
      } else {
        addAIMessage(
          "🧾 I scanned the receipt but couldn't extract clear details. You can tell me the amount and I'll continue!"
        );
      }

      // Feed into pending transaction
      const updated = { ...pendingTx };
      if (parsed.amount) updated.amount = parsed.amount;
      updated.type = updated.type || 'DEBIT'; // Receipts are usually expenses
      if (parsed.category) updated.category = parsed.category;
      if (parsed.merchant) updated.partyName = parsed.merchant;
      if (parsed.note) updated.note = parsed.note;
      if (parsed.date) {
        updated.transactionDate = parsed.date;
        updated._dateConfirmed = true;
      }

      // Check for merchant knowledge
      for (const [merchant, data] of Object.entries(MERCHANT_KNOWLEDGE)) {
        if (parsed.merchant.toLowerCase().includes(merchant)) {
          updated.category = updated.category || data.category;
          updated.expenseType = updated.expenseType || data.tag;
          updated._isPredicted = true;
          break;
        }
      }

      setPendingTx(updated);

      // Give a small delay for the AI message to appear, then advance
      setTimeout(() => checkNextStep(updated), 800);
    } catch (error) {
      setIsScanning(false);
      setScanProgress(0);
      console.error('OCR Error:', error);
      addAIMessage("❌ Sorry, I couldn't read that receipt. Try a clearer image or type the details manually.");
    }
  };

  const resolveBank = (textSnippet: string) => {
    const t = textSnippet.toLowerCase();
    for (const acc of accounts) {
      const nameStr = acc.bankName.toLowerCase();
      if (t.includes(nameStr)) return acc;
      const words = nameStr.split(/[\s-]+/);
      const acronym = words.filter(w => w.length > 1).map(w => w[0]).join('');
      if (acronym.length > 1 && t.match(new RegExp(`\\b${acronym}\\b`, 'i'))) return acc;
      for (const [nick, main] of Object.entries(COMMON_BANK_NICKNAMES)) {
          if (t.includes(nick) && nameStr.includes(main)) return acc;
      }
    }
    return null;
  };

  const parseUniversal = (text: string) => {
    const t = text.toLowerCase();
    const kMatch = t.match(/(\d+(?:\.\d+)?)\s*k/i);
    let amount = kMatch ? (parseFloat(kMatch[1]) * 1000).toString() : (t.match(/\b\d+(?:\.\d+)?\b/)?.[0] || '');
    
    let type = '';
    if (t.match(/\b(received|got|salary|income|credit|add|deposit)\b/)) type = 'CREDIT';
    else if (t.match(/\b(transfer|moved|move|sent|send)\b/)) type = 'TRANSFER';
    else if (t.match(/\b(paid|spent|bought|expense|debit|gave)\b/)) type = 'DEBIT';

    let accountId = '', toAccountId = '', autoPaymentMethod = '', upiApp = '';
    const acc = resolveBank(t);
    if (acc) {
      accountId = acc.id!;
      autoPaymentMethod = acc.type === 'CREDIT_CARD' ? 'Credit Card' : acc.type === 'CASH' ? 'Cash' : 'UPI';
    }

    if (t.match(/\b(gpay|google pay)\b/)) upiApp = 'GPay';
    else if (t.match(/\b(phonepe|phone pe)\b/)) upiApp = 'PhonePe';
    else if (t.match(/\b(paytm)\b/)) upiApp = 'Paytm';

    let category = '', tag = '', isPredicted = false;
    for (const cat of CATEGORIES) { if (t.includes(cat.toLowerCase())) { category = cat; break; } }
    for (const [merchant, data] of Object.entries(MERCHANT_KNOWLEDGE)) {
      if (t.includes(merchant)) { category = category || data.category; tag = tag || data.tag; isPredicted = true; break; }
    }

    let parsedPayee = '', parsedNote = '';
    const toMatch = text.match(/\b(to|paid to|at|from|received from)\s+([A-Za-z0-9_]+)/i);
    const forMatch = text.match(/\b(for|remark|not|note)\s+(.+?)(?:\s+(?:using|at|today|yesterday|with|in|from|to)\b|$)/i);
    if (toMatch && type !== 'TRANSFER') parsedPayee = toMatch[2];
    if (forMatch) parsedNote = forMatch[2].trim();

    let date = '', dateConfirmed = false;
    if (t.includes('yesterday')) { date = format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"); dateConfirmed = true; }
    else if (t.includes('today')) { date = new Date().toISOString().slice(0, 16); dateConfirmed = true; }

    return { amount, type, accountId, toAccountId, autoPaymentMethod, upiApp, category, tag, parsedPayee, parsedNote, date, dateConfirmed, isPredicted };
  };

  const handleSend = (msgOverride?: string) => {
    const userMsg = msgOverride || input.trim();
    if (!userMsg) return;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');

    let updated = { ...pendingTx };

    if (stage === 'IDLE' || stage === 'PREVIEW') {
      const p = parseUniversal(userMsg);
      updated = {
        ...updated, amount: p.amount || updated.amount, type: p.type || updated.type,
        selectedAccountId: p.accountId || updated.selectedAccountId, toAccountId: p.toAccountId || updated.toAccountId,
        paymentMethod: p.autoPaymentMethod || updated.paymentMethod, upiApp: p.upiApp || updated.upiApp,
        category: p.category || updated.category, expenseType: p.tag || updated.expenseType, 
        partyName: p.parsedPayee || updated.partyName, note: p.parsedNote || updated.note,
        transactionDate: p.date || updated.transactionDate, _dateConfirmed: p.dateConfirmed || updated._dateConfirmed, _isPredicted: p.isPredicted
      };
      updated.amount = p.amount || updated.amount;
      updated.type = p.type || updated.type;
      updated.selectedAccountId = p.accountId || updated.selectedAccountId;
      updated.toAccountId = p.toAccountId || updated.toAccountId;
      updated.paymentMethod = p.autoPaymentMethod || updated.paymentMethod;
      updated.upiApp = p.upiApp || updated.upiApp;
      updated.category = p.category || updated.category;
      updated.expenseType = p.tag || updated.expenseType; 
      updated.partyName = p.parsedPayee || updated.partyName;
      updated.note = p.parsedNote || updated.note;
      updated.transactionDate = p.date || updated.transactionDate;
      updated._dateConfirmed = p.dateConfirmed || updated._dateConfirmed;
      updated._isPredicted = p.isPredicted;
      setPendingTx(updated);
      checkNextStep(updated);
    } 
    else if (stage === 'ASK_AMOUNT') {
      const amt = parseFloat(userMsg.replace(/[^0-9.]/g, ''));
      if (!isNaN(amt)) {
        updated.amount = amt;
        setPendingTx(updated);
        checkNextStep(updated);
      } else addAIMessage("Please provide a valid amount (e.g., 500).");
    }
    else if (stage === 'ASK_TYPE') {
      const t = userMsg.toLowerCase();
      if (t.match(/\b(transfer|send|move)\b/)) updated.type = 'TRANSFER';
      else if (t.match(/\b(received|inflow|income|credit|got|in)\b/)) updated.type = 'CREDIT';
      else updated.type = 'DEBIT';
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_BANK') {
      // Find account by full bank name OR the formatted display name "🏦 BankName"
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
        const prompt = updated.type === 'CREDIT' ? "Which account received this?" : "Which account did you pay from?";
        addAIMessage(prompt, getGroupedAccountOptions(updated));
      }
    }
    else if (stage === 'ASK_PAYMENT_METHOD') {
      updated.paymentMethod = userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_UPI_APP') {
      updated.upiApp = userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_CATEGORY') {
      updated.category = userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_TAG') {
      updated.expenseType = userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_PAYEE') {
      updated.partyName = userMsg.match(/(skip|none)/i) ? '' : userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_NOTE') {
      if (!userMsg.trim() || userMsg.match(/(skip|no)/i)) addAIMessage("A remark is required. Describe this entry!");
      else { updated.note = userMsg; setPendingTx(updated); checkNextStep(updated); }
    }
    else if (stage === 'ASK_DATE') {
      updated.transactionDate = userMsg.toLowerCase() === 'yesterday' ? format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm") : new Date().toISOString().slice(0, 16);
      updated._dateConfirmed = true;
      setPendingTx(updated);
      checkNextStep(updated);
    }
  };

  const getGroupedAccountOptions = (tx: any) => {
    // If TRANSFER and we have source, filter it out
    const available = tx.type === 'TRANSFER' && tx.selectedAccountId 
      ? accounts.filter(a => a.id !== tx.selectedAccountId) 
      : accounts;

    return available.map(a => {
      const emoji = a.type === 'BANK' ? '🏦' : a.type === 'CASH' ? '💵' : '💳';
      return `${emoji} ${a.bankName}`;
    });
  };

  const handleEdit = (field: string) => {
    const updated = { ...pendingTx };
    if (field === 'amount') { updated.amount = ''; setStage('ASK_AMOUNT'); addAIMessage("Correcting Amount: How much was it?"); }
    if (field === 'bank') { updated.selectedAccountId = ''; setStage('ASK_BANK'); addAIMessage("Correcting Account: Which one did you use?", getGroupedAccountOptions(updated)); }
    if (field === 'category') { updated.category = ''; setStage('ASK_CATEGORY'); addAIMessage("Correcting Category: Choose from below:", CATEGORIES); }
    if (field === 'tag') { updated.expenseType = ''; setStage('ASK_TAG'); addAIMessage("Correcting Classification: Please select the correct tag:", tags); }
    if (field === 'remark') { updated.note = ''; setStage('ASK_NOTE'); addAIMessage("Correcting Remark: Describe this entry."); }
    setPendingTx(updated);
  };

  const checkNextStep = (tx: any) => {
    if (!tx.amount) { setStage('ASK_AMOUNT'); addAIMessage("What's the transaction amount?"); }
    else if (!tx.type) { setStage('ASK_TYPE'); addAIMessage("Is this an Outflow (Expense), Inflow (Income), or a Transfer?", ['Outflow/Expense', 'Inflow/Income', 'Transfer']); }
    else if (!tx.selectedAccountId) { 
        setStage('ASK_BANK'); 
        const prompt = tx.type === 'CREDIT' ? "Which account received this?" : "Which account did you use for payment?";
        addAIMessage(prompt, getGroupedAccountOptions(tx)); 
    }
    else if (tx.type === 'TRANSFER' && !tx.toAccountId) { 
        setStage('ASK_BANK'); 
        addAIMessage("Destination Account (To):", getGroupedAccountOptions(tx)); 
    }
    else if (!tx.paymentMethod) { 
        setStage('ASK_PAYMENT_METHOD'); 
        addAIMessage("Payment Method used:", ['UPI', 'Credit Card', 'Cash', 'Bank Transfer']); 
    }
    else if (tx.paymentMethod === 'UPI' && !tx.upiApp) { 
        setStage('ASK_UPI_APP'); 
        addAIMessage("Which UPI App?", ['GPay', 'PhonePe', 'Paytm']); 
    }
    else if (!tx.category && tx.type !== 'TRANSFER') { 
        setStage('ASK_CATEGORY'); 
        addAIMessage("Select Category:", CATEGORIES); 
    }
    else if (!tx.expenseType && tx.type !== 'TRANSFER') { 
        setStage('ASK_TAG'); 
        addAIMessage("Classification is very important. Please select a tag:", tags); 
    }
    else if (!tx.partyName && tx.type !== 'TRANSFER') { 
        setStage('ASK_PAYEE'); 
        addAIMessage(tx.type === 'CREDIT' ? "Who sent this money? (or type Skip)" : "Paid to whom? (or type Skip)"); 
    }
    else if (!tx.note) { 
        setStage('ASK_NOTE'); 
        addAIMessage("Describe the entry (Remark is mandatory):"); 
    }
    else if (!tx._dateConfirmed) { 
        setStage('ASK_DATE'); 
        addAIMessage("When did this happen?", ['Today', 'Yesterday']); 
    }
    else { 
        setStage('PREVIEW'); 
        addAIMessage("Perfect! Your entry is ready. Tap Edit below if something is wrong."); 
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FBFF] dark:bg-[#0A0A0A] relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-64">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'ai' ? 'items-start' : 'items-end'} gap-2 animate-in slide-in-from-bottom-2 duration-300`}>
            {/* Receipt image preview in user message */}
            {msg.receiptImage && (
              <div className="max-w-[85%] rounded-2xl overflow-hidden shadow-lg border-2 border-brand-green/20 dark:border-brand-green/30 relative group">
                <img src={msg.receiptImage} alt="Receipt" className="w-full max-h-48 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end p-3">
                  <div className="flex items-center gap-1.5">
                    <Receipt className="w-3 h-3 text-white" />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">Receipt Image</span>
                  </div>
                </div>
                {isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                    <div className="w-full h-0.5 bg-brand-green/50 absolute animate-scan-line" />
                  </div>
                )}
              </div>
            )}
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[12px] font-medium shadow-sm flex items-start gap-2.5 ${msg.role === 'ai' ? 'bg-white dark:bg-[#111111] text-neutral-800 dark:text-neutral-200 border border-brand-blue/5 dark:border-white/5' : 'bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue'}`}>
              {msg.role === 'ai' && <Bot className="w-3.5 h-3.5 mt-0.5" />}
              <span className="leading-relaxed whitespace-pre-line">{msg.content}</span>
            </div>
            {msg.options && (
              <div className="grid grid-cols-2 gap-2 w-full max-w-[85%]">
                {msg.options.map((opt: string) => (
                  <button key={opt} onClick={() => handleSend(opt)} className="px-3 py-2 bg-white dark:bg-[#111111] border border-brand-blue/5 dark:border-white/5 rounded-xl text-[10px] font-black uppercase text-brand-green dark:text-brand-green hover:bg-brand-green/5 transition-all shadow-sm active:scale-95 flex items-center justify-between group">
                    <span className="truncate">{opt}</span>
                    <ChevronRight className="w-3 h-3 opacity-30 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start"><div className="bg-white dark:bg-[#111111] px-4 py-2.5 rounded-2xl flex items-center gap-1"><span className="w-1 h-1 bg-brand-green dark:bg-brand-green rounded-full animate-bounce"></span><span className="w-1 h-1 bg-brand-green dark:bg-brand-green rounded-full animate-bounce [animation-delay:-0.15s]"></span><span className="w-1 h-1 bg-brand-green dark:bg-brand-green rounded-full animate-bounce [animation-delay:-0.3s]"></span></div></div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#F7F7F7] via-[#F7F7F7]/95 dark:from-[#0A0A0A] dark:via-[#0A0A0A]/95 space-y-3 z-10">
        {stage === 'PREVIEW' && (
          <div className="mx-0.5 p-3 bg-[#F9FBFF] dark:bg-[#111111] border border-brand-blue/5 dark:border-white/5 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-brand-green" /> Smart Preview</span>
              <button 
                onClick={() => { setStage('IDLE'); setPendingTx({...pendingTx, _dateConfirmed: false, type: ''}); setMessages([{role: 'ai', content: "Resetting... How much was the amount?"}]); setStage('ASK_AMOUNT'); }} 
                className="text-[8px] font-black text-brand-green dark:text-brand-green bg-brand-green/5 px-2 py-1 rounded-lg uppercase tracking-widest"
              >
                Reset
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div 
                className="bg-white dark:bg-white/5 p-2 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:ring-2 ring-brand-green/30 transition-all group relative"
                onClick={() => handleEdit('amount')}
              >
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"><Pencil className="w-2.5 h-2.5 text-brand-green" /></div>
                <span className="text-[17px] font-black text-brand-green dark:text-white">₹{pendingTx.amount}</span>
                <span className={`text-[7px] font-black uppercase ${pendingTx.type === 'CREDIT' ? 'text-brand-green' : 'text-brand-red'}`}>{pendingTx.type === 'CREDIT' ? 'Inflow' : 'Outflow'}</span>
              </div>
              <div 
                className="bg-white dark:bg-white/5 p-2 rounded-2xl flex items-center gap-2 cursor-pointer hover:ring-2 ring-brand-green/30 transition-all group relative"
                onClick={() => handleEdit('category')}
              >
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100"><Pencil className="w-2.5 h-2.5 text-brand-green" /></div>
                <div className="text-xl">{CATEGORY_ICONS[pendingTx.category] || '📦'}</div>
                <div className="flex flex-col"><span className="text-[8px] font-black text-neutral-400 uppercase leading-none">Category</span><span className="text-[10px] font-bold text-brand-green dark:text-white truncate">{pendingTx.category}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3 px-0.5">
               <div 
                 className="bg-white dark:bg-white/2 p-2 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors group relative border border-transparent hover:border-brand-green/20"
                 onClick={() => handleEdit('bank')}
               >
                 <Landmark className="w-3 h-3 text-neutral-400" />
                 <div className="flex flex-col overflow-hidden"><span className="text-[7px] font-black text-neutral-400 uppercase leading-none">{pendingTx.type === 'CREDIT' ? 'Recipient' : 'Source'}</span><span className="text-[9px] font-bold text-brand-green dark:text-white truncate">{accounts.find(a=>a.id === pendingTx.selectedAccountId)?.bankName || '-'}</span></div>
               </div>
               <div className="bg-white dark:bg-white/2 p-2 rounded-xl flex items-center gap-2">
                 <AppWindow className="w-3 h-3 text-neutral-400" />
                 <div className="flex flex-col overflow-hidden"><span className="text-[7px] font-black text-neutral-400 uppercase leading-none">Method</span><span className="text-[9px] font-bold text-brand-green dark:text-white truncate">{pendingTx.upiApp || pendingTx.paymentMethod || '-'}</span></div>
               </div>
               <div 
                 className="bg-white dark:bg-white/2 p-2 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors group relative border border-transparent hover:border-brand-green/20"
                 onClick={() => handleEdit('tag')}
               >
                 <Hash className="w-3 h-3 text-neutral-400" />
                 <div className="flex flex-col overflow-hidden"><span className="text-[7px] font-black text-neutral-400 uppercase leading-none">Class</span><span className="text-[9px] font-bold text-brand-green dark:text-white truncate">#{pendingTx.expenseType}</span></div>
               </div>
               <div 
                 className="bg-white dark:bg-white/2 p-2 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors group relative border border-transparent hover:border-brand-green/20"
                 onClick={() => handleEdit('remark')}
               >
                 <Lightbulb className="w-3 h-3 text-neutral-400" />
                 <div className="flex flex-col overflow-hidden"><span className="text-[7px] font-black text-neutral-400 uppercase leading-none">Remark</span><span className="text-[9px] font-bold text-brand-green dark:text-white truncate">{pendingTx.note}</span></div>
               </div>
            </div>

            <button onClick={() => onSave(pendingTx)} className="w-full py-3.5 bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"><CheckCircle2 className="w-4 h-4" /> Save Entry</button>
          </div>
        )}
        {/* Scanning Progress Overlay */}
        {isScanning && (
          <div className="mx-1 mb-2 p-3 bg-gradient-to-r from-brand-green/5 via-brand-cyan/5 to-brand-green/5 dark:from-brand-green/10 dark:via-brand-cyan/10 dark:to-brand-green/10 rounded-2xl border border-brand-green/10 dark:border-brand-green/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <ScanLine className="w-5 h-5 text-brand-green animate-pulse" />
                <div className="absolute inset-0 bg-brand-green/20 rounded-full animate-ping" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-brand-green uppercase tracking-widest">Scanning Receipt</p>
                <p className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500">Extracting text with AI OCR...</p>
              </div>
              <span className="text-[11px] font-black text-brand-green tabular-nums">{scanProgress}%</span>
            </div>
            <div className="h-1 bg-neutral-200 dark:bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-brand-green to-brand-cyan rounded-full transition-all duration-300 ease-out"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 bg-[#F9FBFF] dark:bg-[#111111] p-1.5 rounded-2xl border border-brand-blue/5 dark:border-white/5 shadow-xl">
          {/* Receipt Scan Button */}
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
              isScanning 
                ? 'bg-brand-green/10 text-brand-green animate-pulse cursor-wait' 
                : 'bg-gradient-to-br from-brand-green/10 to-brand-cyan/10 dark:from-brand-green/10 dark:to-brand-cyan/10 text-brand-green dark:text-brand-green hover:from-brand-green/20 hover:to-brand-cyan/20 border border-brand-green/10 dark:border-brand-green/20'
            }`}
            title="Scan Receipt"
          >
            {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          </button>
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*" 
            capture="environment"
            className="hidden" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleReceiptScan(file);
              e.target.value = ''; // Reset for re-upload
            }}
          />
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Type or scan a receipt..." className="flex-1 bg-transparent px-3 py-2 text-[12px] font-bold outline-none dark:text-white" />
          <button onClick={() => handleSend()} className="w-10 h-10 bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
};
