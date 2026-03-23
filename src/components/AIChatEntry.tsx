
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, CheckCircle2, Sparkles, Calendar, User as UserIcon, Landmark, Smartphone, CreditCard, Coins } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';

interface AIChatEntryProps {
  onSave: (transaction: any) => void;
  accounts: any[];
  tags: string[];
}

type ChatStage = 'IDLE' | 'ASK_AMOUNT' | 'ASK_BANK' | 'ASK_CATEGORY' | 'ASK_PAYEE' | 'ASK_NOTE' | 'ASK_DATE' | 'PREVIEW';

export const AIChatEntry: React.FC<AIChatEntryProps> = ({ onSave, accounts, tags }) => {
  const [messages, setMessages] = useState<any[]>([
    { role: 'ai', content: "Hi! I'm your advanced AI assistant. Tell me about a transaction (e.g., 'Spent 500 at Starbucks' or 'Got 2k salary'), and I'll help you fill in the rest!" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [stage, setStage] = useState<ChatStage>('IDLE');
  
  const [pendingTx, setPendingTx] = useState<any>({
    type: 'DEBIT',
    amount: '',
    category: '',
    selectedAccountId: '',
    paymentMethod: 'UPI',
    upiApp: 'GPay',
    expenseType: tags[0] || 'Personal',
    partyName: '',
    note: '',
    transactionDate: new Date().toISOString().slice(0, 16)
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addAIMessage = (content: string) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', content }]);
      setIsTyping(false);
    }, 800);
  };

  const parseUniversal = (text: string) => {
    const t = text.toLowerCase();
    
    // Amount Detection (handle 1k, 1.5k, etc)
    const kMatch = t.match(/(\d+(?:\.\d+)?)\s*k/i);
    let amount = '';
    if (kMatch) {
      amount = (parseFloat(kMatch[1]) * 1000).toString();
    } else {
      const basicMatch = t.match(/\b\d+(?:\.\d+)?\b/);
      if (basicMatch) amount = basicMatch[0];
    }

    // Type detection
    let type: 'DEBIT' | 'CREDIT' | 'TRANSFER' = 'DEBIT';
    if (t.includes('received') || t.includes('got') || t.includes('salary') || t.includes('added') || t.includes('income')) {
      type = 'CREDIT';
    } else if (t.includes('transfer') || t.includes('moved')) {
      type = 'TRANSFER';
    }

    // Category Fuzzy
    let category = '';
    for (const cat of CATEGORIES) {
      if (t.includes(cat.toLowerCase())) {
        category = cat;
        break;
      }
    }

    // Bank Fuzzy (More aggressive)
    let accountId = '';
    let autoPaymentMethod = '';
    for (const acc of accounts) {
      const name = acc.bankName.toLowerCase();
      if (t.includes(name)) {
        accountId = acc.id!;
        if (acc.type === 'CREDIT_CARD') autoPaymentMethod = 'Credit Card';
        else if (acc.type === 'CASH') autoPaymentMethod = 'Cash';
        else autoPaymentMethod = 'UPI';
        break;
      }
    }

    // Date Detection
    let date = pendingTx.transactionDate;
    if (t.includes('yesterday')) {
      date = format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm");
    } else if (t.includes('today')) {
      date = new Date().toISOString().slice(0, 16);
    }

    return { amount, category, accountId, type, date, autoPaymentMethod };
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');

    let updated = { ...pendingTx };

    if (stage === 'IDLE' || stage === 'PREVIEW') {
      const parsed = parseUniversal(userMsg);
      updated = {
        ...updated,
        amount: parsed.amount || updated.amount,
        category: parsed.category || updated.category,
        selectedAccountId: parsed.accountId || updated.selectedAccountId,
        paymentMethod: parsed.autoPaymentMethod || updated.paymentMethod,
        type: parsed.type,
        transactionDate: parsed.date
      };
      
      const lowerMsg = userMsg.toLowerCase();
      if (lowerMsg.includes(' at ')) updated.partyName = userMsg.split(/ at /i)[1].split(' ')[0];
      else if (lowerMsg.includes(' to ')) updated.partyName = userMsg.split(/ to /i)[1].split(' ')[0];
      else if (lowerMsg.includes(' from ')) updated.partyName = userMsg.split(/ from /i)[1].split(' ')[0];

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
      } else {
         addAIMessage("I missed the number. How much was it?");
      }
    } 
    else if (stage === 'ASK_BANK') {
      let foundAcc: any = null;
      for (const acc of accounts) {
        if (userMsg.toLowerCase().includes(acc.bankName.toLowerCase())) {
          foundAcc = acc;
          break;
        }
      }
      if (foundAcc) {
        updated.selectedAccountId = foundAcc.id;
        if (foundAcc.type === 'CREDIT_CARD') updated.paymentMethod = 'Credit Card';
        else if (foundAcc.type === 'CASH') updated.paymentMethod = 'Cash';
        else updated.paymentMethod = 'UPI';
        setPendingTx(updated);
        checkNextStep(updated);
      } else {
        addAIMessage("I couldn't find that account. Which bank or wallet did you use?");
      }
    }
    else if (stage === 'ASK_CATEGORY') {
      let foundCat = '';
      for (const cat of CATEGORIES) {
        if (userMsg.toLowerCase().includes(cat.toLowerCase())) {
          foundCat = cat;
          break;
        }
      }
      if (foundCat) {
        updated.category = foundCat;
        setPendingTx(updated);
        checkNextStep(updated);
      } else {
        addAIMessage(`Which category fits best? (${CATEGORIES.slice(0,3).join(', ')}...?)`);
      }
    }
    else if (stage === 'ASK_PAYEE') {
      updated.partyName = userMsg.toLowerCase() === 'none' || userMsg.toLowerCase() === 'skip' ? '' : userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_NOTE') {
      updated.note = userMsg.toLowerCase() === 'no' || userMsg.toLowerCase() === 'skip' ? '' : userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    }
  };

  const checkNextStep = (tx: any) => {
    if (!tx.amount) {
      setStage('ASK_AMOUNT');
      addAIMessage("Got it. How much was the transaction amount?");
    } else if (!tx.selectedAccountId) {
      setStage('ASK_BANK');
      addAIMessage("Which account was this paid from/to?");
    } else if (!tx.category) {
      setStage('ASK_CATEGORY');
      addAIMessage(tx.partyName ? `What category is ${tx.partyName}?` : "What category should I put this in?");
    } else if (!tx.partyName && tx.type !== 'TRANSFER') {
      setStage('ASK_PAYEE');
      addAIMessage("Who was this paid to (Payee)? Type 'None' to skip.");
    } else if (!tx.note) {
      setStage('ASK_NOTE');
      addAIMessage("Any remark or note for this? Type 'No' to skip.");
    } else {
      setStage('PREVIEW');
      addAIMessage("Perfect! Check the smart preview below to finalize.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F7F7F7] dark:bg-[#0A0A0A] relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-40">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[12px] font-medium shadow-sm flex items-start gap-2.5 ${msg.role === 'ai' ? 'bg-white dark:bg-[#111111] text-neutral-800 dark:text-neutral-200 border border-[#EBEBEB] dark:border-white/5' : 'bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue'}`}>
              <span className="leading-relaxed">{msg.content}</span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-[#111111] px-4 py-2.5 rounded-2xl flex items-center gap-1 border border-[#EBEBEB] dark:border-white/5 shadow-sm">
              <span className="w-1.5 h-1.5 bg-neutral-300 dark:bg-neutral-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-1.5 h-1.5 bg-neutral-300 dark:bg-neutral-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1.5 h-1.5 bg-neutral-300 dark:bg-neutral-600 rounded-full animate-bounce"></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#F7F7F7] via-[#F7F7F7]/95 dark:from-[#0A0A0A] dark:via-[#0A0A0A]/95 space-y-3">
        {stage === 'PREVIEW' && (
          <div className="mx-1 p-3 bg-white dark:bg-[#111111] border border-[#EBEBEB] dark:border-white/5 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-brand-blue" /> Smart Preview</span>
              <button onClick={() => setStage('IDLE')} className="text-[8px] font-bold text-brand-blue dark:text-brand-cyan uppercase bg-brand-blue/5 px-2 py-1 rounded-lg">Edit All</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-[#F7F7F7] dark:bg-white/5 p-2 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-[16px] font-heading font-black text-brand-blue dark:text-white">₹{pendingTx.amount}</span>
                <span className={`text-[7px] font-bold uppercase ${pendingTx.type === 'CREDIT' ? 'text-brand-green' : 'text-brand-red'}`}>{pendingTx.type}</span>
              </div>
              <div className="bg-[#F7F7F7] dark:bg-white/5 p-2 rounded-2xl flex items-center gap-2">
                <div className="text-lg">{CATEGORY_ICONS[pendingTx.category] || '📦'}</div>
                <div className="flex flex-col"><span className="text-[8px] font-black text-neutral-400 uppercase leading-none">Category</span><span className="text-[10px] font-bold text-brand-blue dark:text-white truncate">{pendingTx.category}</span></div>
              </div>
            </div>
            <div className="space-y-1.5 mb-3 px-1">
              <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><Landmark className="w-2.5 h-2.5" /> Account</span><span className="text-brand-blue dark:text-white font-bold">{accounts.find(a => a.id === pendingTx.selectedAccountId)?.bankName || 'Unknown'}</span></div>
              <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><Smartphone className="w-2.5 h-2.5" /> Method</span><span className="text-brand-blue dark:text-white font-bold">{pendingTx.paymentMethod}</span></div>
            </div>
            <button onClick={() => onSave(pendingTx)} className="w-full py-3 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Save Entry</button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-white dark:bg-[#111111] p-1.5 rounded-2xl border border-[#EBEBEB] dark:border-white/5 shadow-xl">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder={stage === 'IDLE' ? "Say: 'Spent 500 on coffee'..." : "Type your answer..."} className="flex-1 bg-transparent px-3 py-2 text-[12px] font-bold outline-none dark:text-white placeholder:text-neutral-400" />
          <button onClick={handleSend} className="w-10 h-10 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-xl flex items-center justify-center shadow-lg"><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
};
