
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, CheckCircle2, Sparkles, Calendar, User as UserIcon, Landmark, Smartphone, CreditCard, Coins, Tag, Lightbulb, MoveHorizontal, Check, Zap, ChevronRight, Hash, AppWindow } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';

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

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addAIMessage = (content: string, options: string[] = []) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', content, options }]);
      setIsTyping(false);
    }, 400);
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
      setPendingTx(updated);
      checkNextStep(updated);
    } 
    else if (stage === 'ASK_AMOUNT') {
      const val = userMsg.match(/(\d+(?:\.\d+)?)\s*(k?)/i);
      if (val) {
         updated.amount = (val[2].toLowerCase() === 'k' ? parseFloat(val[1]) * 1000 : parseFloat(val[1])).toString();
         setPendingTx(updated);
         checkNextStep(updated);
      } else addAIMessage("Amount, please?");
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
      // Find account by full bank name in msgOverride
      const acc = accounts.find(a => a.bankName === userMsg) || resolveBank(userMsg);
      if (acc) {
        if (updated.type === 'TRANSFER' && updated.selectedAccountId) updated.toAccountId = acc.id;
        else {
           updated.selectedAccountId = acc.id;
           updated.paymentMethod = acc.type === 'CREDIT_CARD' ? 'Credit Card' : acc.type === 'CASH' ? 'Cash' : 'UPI';
        }
        setPendingTx(updated);
        checkNextStep(updated);
      } else addAIMessage(updated.type === 'CREDIT' ? "Which account received this?" : "Which account did you pay from?");
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
      updated.expenseType = userMsg === 'skip' ? (tags[0] || 'Personal') : userMsg;
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

  const getBankDisplay = (acc: any) => acc.bankName; // STRICTLY RETURN REAL NAME

  const checkNextStep = (tx: any) => {
    if (!tx.amount) { setStage('ASK_AMOUNT'); addAIMessage("How much was the amount?"); }
    else if (!tx.type) { setStage('ASK_TYPE'); addAIMessage("Transaction Type?", ['Outflow/Expense', 'Inflow/Income', 'Transfer']); }
    else if (!tx.selectedAccountId) { setStage('ASK_BANK'); addAIMessage(tx.type === 'CREDIT' ? "Received in which account?" : "Account used for payment:", accounts.map(a => a.bankName)); }
    else if (tx.type === 'TRANSFER' && !tx.toAccountId) { setStage('ASK_BANK'); addAIMessage("Destination Account:", accounts.filter(a => a.id !== tx.selectedAccountId).map(a => a.bankName)); }
    else if (!tx.paymentMethod) { setStage('ASK_PAYMENT_METHOD'); addAIMessage("Payment Method:", ['UPI', 'Credit Card', 'Cash', 'Bank Transfer']); }
    else if (tx.paymentMethod === 'UPI' && !tx.upiApp) { setStage('ASK_UPI_APP'); addAIMessage("Which UPI App?", ['GPay', 'PhonePe', 'Paytm']); }
    else if (!tx.category && tx.type !== 'TRANSFER') { setStage('ASK_CATEGORY'); addAIMessage("Category:", CATEGORIES); }
    else if (!tx.expenseType && tx.type !== 'TRANSFER') { setStage('ASK_TAG'); addAIMessage("Classification Tag:", [...tags, 'skip']); }
    else if (!tx.partyName && tx.type !== 'TRANSFER') { setStage('ASK_PAYEE'); addAIMessage(tx.type === 'CREDIT' ? "Who sent this money?" : "Paid to whom?"); }
    else if (!tx.note) { setStage('ASK_NOTE'); addAIMessage("Remark mandatory: Describe this entry."); }
    else if (!tx._dateConfirmed) { setStage('ASK_DATE'); addAIMessage("When was this done?", ['Today', 'Yesterday']); }
    else { setStage('PREVIEW'); addAIMessage("All clear! Check and Save."); }
  };

  return (
    <div className="flex flex-col h-full bg-[#F9FBFF] dark:bg-[#0A0A0A] relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-64">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'ai' ? 'items-start' : 'items-end'} gap-2 animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[12px] font-medium shadow-sm flex items-start gap-2.5 ${msg.role === 'ai' ? 'bg-white dark:bg-[#111111] text-neutral-800 dark:text-neutral-200 border border-[#EBEBEB] dark:border-white/5' : 'bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue'}`}>
              {msg.role === 'ai' && <Bot className="w-3.5 h-3.5 mt-0.5" />}
              <span className="leading-relaxed">{msg.content}</span>
            </div>
            {msg.options && (
              <div className="grid grid-cols-2 gap-2 w-full max-w-[85%]">
                {msg.options.map((opt: string) => (
                  <button key={opt} onClick={() => handleSend(opt)} className="px-3 py-2 bg-white dark:bg-[#111111] border border-[#EBEBEB] dark:border-white/5 rounded-xl text-[10px] font-black uppercase text-brand-green dark:text-brand-green hover:bg-brand-green/5 transition-all shadow-sm active:scale-95 flex items-center justify-between group">
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
              <button onClick={() => { setStage('IDLE'); setPendingTx({...pendingTx, _dateConfirmed: false, type: ''}); }} className="text-[8px] font-bold text-brand-green dark:text-brand-green bg-brand-green/5 px-2 py-1 rounded-lg">Reset</button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-[#F7F7F7] dark:bg-white/5 p-2 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-[17px] font-black text-brand-green dark:text-white">₹{pendingTx.amount}</span>
                <span className={`text-[7px] font-black uppercase ${pendingTx.type === 'CREDIT' ? 'text-brand-green' : 'text-brand-red'}`}>{pendingTx.type === 'CREDIT' ? 'Inflow' : 'Outflow'}</span>
              </div>
              <div className="bg-[#F7F7F7] dark:bg-white/5 p-2 rounded-2xl flex items-center gap-2">
                <div className="text-xl">{CATEGORY_ICONS[pendingTx.category] || '📦'}</div>
                <div className="flex flex-col"><span className="text-[8px] font-black text-neutral-400 uppercase leading-none">Category</span><span className="text-[10px] font-bold text-brand-green dark:text-white truncate">{pendingTx.category}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3 px-0.5">
               <div className="bg-[#F7F7F7] dark:bg-white/2 p-2 rounded-xl flex items-center gap-2">
                 <Landmark className="w-3 h-3 text-neutral-400" />
                 <div className="flex flex-col overflow-hidden"><span className="text-[7px] font-black text-neutral-400 uppercase leading-none">{pendingTx.type === 'CREDIT' ? 'Recipient' : 'Source'}</span><span className="text-[9px] font-bold text-brand-green dark:text-white truncate">{accounts.find(a=>a.id === pendingTx.selectedAccountId)?.bankName || '-'}</span></div>
               </div>
               <div className="bg-[#F7F7F7] dark:bg-white/2 p-2 rounded-xl flex items-center gap-2">
                 <AppWindow className="w-3 h-3 text-neutral-400" />
                 <div className="flex flex-col overflow-hidden"><span className="text-[7px] font-black text-neutral-400 uppercase leading-none">Method</span><span className="text-[9px] font-bold text-brand-green dark:text-white truncate">{pendingTx.upiApp || pendingTx.paymentMethod || '-'}</span></div>
               </div>
               <div className="bg-[#F7F7F7] dark:bg-white/2 p-2 rounded-xl flex items-center gap-2">
                 <Hash className="w-3 h-3 text-neutral-400" />
                 <div className="flex flex-col overflow-hidden"><span className="text-[7px] font-black text-neutral-400 uppercase leading-none">Class</span><span className="text-[9px] font-bold text-brand-green dark:text-white truncate">#{pendingTx.expenseType}</span></div>
               </div>
               <div className="bg-[#F7F7F7] dark:bg-white/2 p-2 rounded-xl flex items-center gap-2">
                 <Lightbulb className="w-3 h-3 text-neutral-400" />
                 <div className="flex flex-col overflow-hidden"><span className="text-[7px] font-black text-neutral-400 uppercase leading-none">Remark</span><span className="text-[9px] font-bold text-brand-green dark:text-white truncate">{pendingTx.note}</span></div>
               </div>
            </div>

            <button onClick={() => onSave(pendingTx)} className="w-full py-3.5 bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"><CheckCircle2 className="w-4 h-4" /> Save Entry</button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-[#F9FBFF] dark:bg-[#111111] p-1.5 rounded-2xl border border-brand-blue/5 dark:border-white/5 shadow-xl">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Ask AI..." className="flex-1 bg-transparent px-3 py-2 text-[12px] font-bold outline-none dark:text-white" />
          <button onClick={() => handleSend()} className="w-10 h-10 bg-brand-green dark:bg-brand-green text-white dark:text-brand-blue rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
};
