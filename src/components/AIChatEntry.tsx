
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, CheckCircle2, Sparkles, Calendar, User as UserIcon, Landmark, Smartphone, CreditCard, Coins, Tag, Lightbulb, MoveHorizontal, Check, Zap, ChevronRight, Hash } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';

interface AIChatEntryProps {
  onSave: (transaction: any) => void;
  accounts: any[];
  tags: string[];
}

type ChatStage = 'IDLE' | 'ASK_AMOUNT' | 'ASK_TYPE' | 'ASK_BANK' | 'ASK_PAYMENT_METHOD' | 'ASK_CATEGORY' | 'ASK_TAG' | 'ASK_PAYEE' | 'ASK_NOTE' | 'ASK_DATE' | 'PREVIEW';

const MERCHANT_KNOWLEDGE: Record<string, { category: string, tag: string }> = {
  'starbucks': { category: 'Food', tag: 'Personal' },
  'mcdonalds': { category: 'Food', tag: 'Personal' },
  'kfc': { category: 'Food', tag: 'Personal' },
  'zomato': { category: 'Food', tag: 'Personal' },
  'swiggy': { category: 'Food', tag: 'Personal' },
  'uber': { category: 'Transport', tag: 'Work' },
  'ola': { category: 'Transport', tag: 'Personal' },
  'amazon': { category: 'Shopping', tag: 'Personal' },
  'netflix': { category: 'Bills', tag: 'Personal' },
  'spotify': { category: 'Entertainment', tag: 'Personal' },
  'jio': { category: 'Bills', tag: 'Personal' },
  'airtel': { category: 'Bills', tag: 'Personal' },
};

export const AIChatEntry: React.FC<AIChatEntryProps> = ({ onSave, accounts, tags }) => {
  const [messages, setMessages] = useState<any[]>([
    { role: 'ai', content: "Welcome! I'm your high-precision AI. Tell me about a transaction (e.g. 'Paid 500 for lunch'), and I'll guide you through the mandatory details!" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [stage, setStage] = useState<ChatStage>('IDLE');
  
  const [pendingTx, setPendingTx] = useState<any>({
    type: '',
    amount: '',
    category: '',
    selectedAccountId: '',
    toAccountId: '',
    paymentMethod: '',
    upiApp: 'GPay',
    expenseType: '',
    partyName: '',
    note: '',
    transactionDate: new Date().toISOString().slice(0, 16),
    _dateConfirmed: false,
    _isPredicted: false
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
      const initials = nameStr.split(/[\s-]+/).filter(w => w.length > 1).map(w => w[0]).join('');
      if (t.includes(nameStr) || (initials.length > 1 && t.match(new RegExp(`\\b${initials}\\b`, 'i')))) return acc;
    }
    return null;
  };

  const parseUniversal = (text: string) => {
    const t = text.toLowerCase();
    const kMatch = t.match(/(\d+(?:\.\d+)?)\s*k/i);
    let amount = kMatch ? (parseFloat(kMatch[1]) * 1000).toString() : (t.match(/\b\d+(?:\.\d+)?\b/)?.[0] || '');
    
    let type = '';
    if (t.match(/\b(received|got|salary|income|credit)\b/)) type = 'CREDIT';
    else if (t.match(/\b(transfer|moved|move|sent)\b/)) type = 'TRANSFER';
    else if (t.match(/\b(paid|spent|bought|expense|debit)\b/)) type = 'DEBIT';

    let accountId = '', toAccountId = '', autoPaymentMethod = '';
    const acc = resolveBank(t);
    if (acc) {
      accountId = acc.id!;
      autoPaymentMethod = acc.type === 'CREDIT_CARD' ? 'Credit Card' : acc.type === 'CASH' ? 'Cash' : 'UPI';
    }

    let category = '', tag = '', isPredicted = false;
    for (const cat of CATEGORIES) { if (t.includes(cat.toLowerCase())) { category = cat; break; } }
    for (const [merchant, data] of Object.entries(MERCHANT_KNOWLEDGE)) {
      if (t.includes(merchant)) { category = category || data.category; tag = tag || data.tag; isPredicted = true; break; }
    }

    let parsedPayee = '', parsedNote = '';
    const toMatch = text.match(/\bto\s+([A-Za-z0-9_]+)/i);
    const forMatch = text.match(/\bfor\s+(.+?)(?:\s+(?:using|at|today|yesterday|with|in)\b|$)/i);
    if (toMatch && type !== 'TRANSFER') parsedPayee = toMatch[1];
    if (forMatch) parsedNote = forMatch[1].trim();

    let date = '', dateConfirmed = false;
    if (t.includes('yesterday')) { date = format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"); dateConfirmed = true; }
    else if (t.includes('today')) { date = new Date().toISOString().slice(0, 16); dateConfirmed = true; }

    return { amount, type, accountId, toAccountId, autoPaymentMethod, category, tag, parsedPayee, parsedNote, date, dateConfirmed, isPredicted };
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
        ...updated, amount: p.amount || updated.amount, type: p.type || (p.amount ? 'DEBIT' : updated.type),
        selectedAccountId: p.accountId || updated.selectedAccountId, toAccountId: p.toAccountId || updated.toAccountId,
        paymentMethod: p.autoPaymentMethod || updated.paymentMethod, category: p.category || updated.category,
        expenseType: p.tag || updated.expenseType, partyName: p.parsedPayee || updated.partyName, note: p.parsedNote || updated.note,
        transactionDate: p.date || updated.transactionDate, _dateConfirmed: p.dateConfirmed || updated._dateConfirmed, _isPredicted: p.isPredicted
      };
      setPendingTx(updated);
      checkNextStep(updated);
    } 
    else if (stage === 'ASK_AMOUNT') {
      const amtMatch = userMsg.match(/(\d+(?:\.\d+)?)\s*(k?)/i);
      if (amtMatch) {
         const val = parseFloat(amtMatch[1]);
         updated.amount = (amtMatch[2].toLowerCase() === 'k' ? val * 1000 : val).toString();
         setPendingTx(updated);
         checkNextStep(updated);
      } else addAIMessage("I couldn't identify the amount. Re-type it, please!");
    } 
    else if (stage === 'ASK_TYPE') {
      const t = userMsg.toLowerCase();
      updated.type = t.includes('transfer') ? 'TRANSFER' : (t.includes('in') || t.includes('received') ? 'CREDIT' : 'DEBIT');
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_BANK') {
      const acc = resolveBank(userMsg);
      if (acc) {
        if (updated.type === 'TRANSFER' && updated.selectedAccountId) updated.toAccountId = acc.id;
        else {
           updated.selectedAccountId = acc.id;
           updated.paymentMethod = acc.type === 'CREDIT_CARD' ? 'Credit Card' : acc.type === 'CASH' ? 'Cash' : 'UPI';
        }
        setPendingTx(updated);
        checkNextStep(updated);
      } else addAIMessage("Which account was used?");
    }
    else if (stage === 'ASK_PAYMENT_METHOD') {
      updated.paymentMethod = userMsg;
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
      updated.partyName = (userMsg.toLowerCase() === 'none' || userMsg.toLowerCase() === 'skip') ? '' : userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_NOTE') {
      if (!userMsg.trim() || userMsg.toLowerCase() === 'skip') addAIMessage("Remark is mandatory: What was the purpose?");
      else { updated.note = userMsg; setPendingTx(updated); checkNextStep(updated); }
    }
    else if (stage === 'ASK_DATE') {
      updated.transactionDate = userMsg.toLowerCase() === 'yesterday' ? format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm") : new Date().toISOString().slice(0, 16);
      updated._dateConfirmed = true;
      setPendingTx(updated);
      checkNextStep(updated);
    }
  };

  const checkNextStep = (tx: any) => {
    if (!tx.amount) { setStage('ASK_AMOUNT'); addAIMessage("Amount? (e.g. 500, 2k)"); }
    else if (!tx.type) { setStage('ASK_TYPE'); addAIMessage("Transaction Type:", ['Debit', 'Credit', 'Transfer']); }
    else if (!tx.selectedAccountId) { setStage('ASK_BANK'); addAIMessage("Which account?", accounts.map(a => a.bankName.split(' ')[0])); }
    else if (tx.type === 'TRANSFER' && !tx.toAccountId) { setStage('ASK_BANK'); addAIMessage("Destination Account?", accounts.filter(a => a.id !== tx.selectedAccountId).map(a => a.bankName.split(' ')[0])); }
    else if (!tx.paymentMethod) { setStage('ASK_PAYMENT_METHOD'); addAIMessage("Payment Method:", ['UPI', 'Credit Card', 'Cash', 'Bank Transfer']); }
    else if (!tx.category && tx.type !== 'TRANSFER') { setStage('ASK_CATEGORY'); addAIMessage("Select Category:", CATEGORIES); }
    else if (!tx.expenseType && tx.type !== 'TRANSFER') { setStage('ASK_TAG'); addAIMessage("Add Classification Tag:", [...tags, 'skip']); }
    else if (!tx.partyName && tx.type !== 'TRANSFER') { setStage('ASK_PAYEE'); addAIMessage("Payee Name? (e.g. Starbucks, Hrisav) Or type 'skip'."); }
    else if (!tx.note) { setStage('ASK_NOTE'); addAIMessage("Remark is mandatory: Describe this entry."); }
    else if (!tx._dateConfirmed) { setStage('ASK_DATE'); addAIMessage("Date of transaction:", ['Today', 'Yesterday']); }
    else { setStage('PREVIEW'); addAIMessage("Smart Preview generated! Ready to finalize."); }
  };

  return (
    <div className="flex flex-col h-full bg-[#F7F7F7] dark:bg-[#0A0A0A] relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-60">
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'ai' ? 'items-start' : 'items-end'} gap-2 animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[12px] font-medium shadow-sm flex items-start gap-2.5 ${msg.role === 'ai' ? 'bg-white dark:bg-[#111111] text-neutral-800 dark:text-neutral-200 border border-[#EBEBEB] dark:border-white/5' : 'bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue'}`}>
              {msg.role === 'ai' && <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" />}
              <span className="leading-relaxed">{msg.content}</span>
            </div>
            
            {msg.options && (
              <div className="grid grid-cols-2 gap-2 w-full max-w-[85%] animate-in fade-in slide-in-from-top-2 duration-400">
                {msg.options.map((opt: string) => (
                  <button key={opt} onClick={() => handleSend(opt)} className="px-3 py-2 bg-white dark:bg-[#111111] border border-[#EBEBEB] dark:border-white/5 rounded-xl text-[10px] font-black uppercase text-brand-blue dark:text-brand-cyan hover:bg-brand-blue/5 transition-all shadow-sm active:scale-95 flex items-center justify-between group">
                    <span className="truncate">{opt}</span>
                    <ChevronRight className="w-3 h-3 opacity-30 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start"><div className="bg-white dark:bg-[#111111] px-4 py-2.5 rounded-2xl flex items-center gap-1 border border-[#EBEBEB] dark:border-white/5 shadow-sm"><span className="w-1 h-1 bg-brand-blue dark:bg-brand-cyan rounded-full animate-bounce"></span><span className="w-1 h-1 bg-brand-blue dark:bg-brand-cyan rounded-full animate-bounce [animation-delay:-0.15s]"></span><span className="w-1 h-1 bg-brand-blue dark:bg-brand-cyan rounded-full animate-bounce [animation-delay:-0.3s]"></span></div></div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#F7F7F7] via-[#F7F7F7]/95 dark:from-[#0A0A0A] dark:via-[#0A0A0A]/95 space-y-3 z-10">
        {stage === 'PREVIEW' && (
          <div className="mx-1 p-3 bg-white dark:bg-[#111111] border border-[#EBEBEB] dark:border-white/5 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-brand-blue" /> Smart Preview</span>
              <button onClick={() => { setStage('IDLE'); setPendingTx({...pendingTx, _dateConfirmed: false}); }} className="text-[8px] font-bold text-brand-blue dark:text-brand-cyan bg-brand-blue/5 px-2 py-1 rounded-lg">Edit</button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-[#F7F7F7] dark:bg-white/5 p-2 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-[16px] font-black text-brand-blue dark:text-white">₹{pendingTx.amount}</span>
                <span className={`text-[7px] font-bold uppercase ${pendingTx.type === 'CREDIT' ? 'text-brand-green' : 'text-brand-red'}`}>{pendingTx.type}</span>
              </div>
              <div className="bg-[#F7F7F7] dark:bg-white/5 p-2 rounded-2xl flex items-center gap-2">
                <div className="text-lg">{CATEGORY_ICONS[pendingTx.category] || '📦'}</div>
                <div className="flex flex-col"><span className="text-[8px] font-black text-neutral-400 uppercase leading-none">Category</span><span className="text-[10px] font-bold text-brand-blue dark:text-white truncate">{pendingTx.category}</span></div>
              </div>
            </div>

            <div className="space-y-1.5 mb-3 px-1 bg-[#F7F7F7] dark:bg-white/2 p-2 rounded-2xl">
              <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><Landmark className="w-2.5 h-2.5" /> Source</span><span className="text-brand-blue dark:text-white font-bold">{accounts.find(a=>a.id === pendingTx.selectedAccountId)?.bankName || '-'} • {pendingTx.paymentMethod}</span></div>
              <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><Hash className="w-2.5 h-2.5" /> Tag</span><span className="text-brand-blue dark:text-white font-bold">#{pendingTx.expenseType}</span></div>
              <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><Lightbulb className="w-2.5 h-2.5" /> Detail</span><span className="text-brand-blue dark:text-white font-bold truncate max-w-[150px] text-right italic">{pendingTx.note}</span></div>
            </div>

            <button onClick={() => onSave(pendingTx)} className="w-full py-3 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"><CheckCircle2 className="w-4 h-4" /> Save Entry</button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-white dark:bg-[#111111] p-1.5 rounded-2xl border border-[#EBEBEB] dark:border-white/5 shadow-xl">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Type something..." className="flex-1 bg-transparent px-3 py-2 text-[12px] font-bold outline-none dark:text-white" />
          <button onClick={() => handleSend()} className="w-10 h-10 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-xl flex items-center justify-center shadow-lg active:scale-90 transition-transform"><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
};
