
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, CheckCircle2, Sparkles, Calendar, User as UserIcon, Landmark, Smartphone, CreditCard, Coins, Tag } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';

interface AIChatEntryProps {
  onSave: (transaction: any) => void;
  accounts: any[];
  tags: string[];
}

type ChatStage = 'IDLE' | 'ASK_AMOUNT' | 'ASK_TYPE' | 'ASK_BANK' | 'ASK_PAYMENT_METHOD' | 'ASK_CATEGORY' | 'ASK_TAG' | 'ASK_PAYEE' | 'ASK_NOTE' | 'ASK_DATE' | 'PREVIEW';

export const AIChatEntry: React.FC<AIChatEntryProps> = ({ onSave, accounts, tags }) => {
  const [messages, setMessages] = useState<any[]>([
    { role: 'ai', content: "Hi! I'm your advanced AI assistant. Tell me about a transaction (e.g., 'Paid to Hrisav for food 500 using SBI' or 'Got 5k salary in HDFC'), and I'll break it down step-by-step!" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [stage, setStage] = useState<ChatStage>('IDLE');
  
  const [pendingTx, setPendingTx] = useState<any>({
    type: '',
    amount: '',
    category: '',
    selectedAccountId: '',
    paymentMethod: '',
    upiApp: 'GPay',
    expenseType: '',
    partyName: '',
    note: '',
    transactionDate: new Date().toISOString().slice(0, 16),
    _dateConfirmed: false
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
    }, 600);
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

    // Type detection based on semantics
    let type = '';
    if (t.match(/\b(received|got|salary|added|income|refund)\b/)) type = 'CREDIT';
    else if (t.match(/\b(transfer|moved|sent)\b/)) type = 'TRANSFER';
    else if (t.match(/\b(paid|spent|bought|gave)\b/)) type = 'DEBIT';

    // Bank Fuzzy + Acronym detection
    let accountId = '';
    let autoPaymentMethod = '';
    for (const acc of accounts) {
      const nameStr = acc.bankName.toLowerCase();
      const words = nameStr.split(/[\s-]+/);
      const initials = words.map(w => w[0]).join(''); // E.g., State Bank of India -> sboi
      const initialsNoOf = words.filter(w => w !== 'of').map(w => w[0]).join(''); // -> sbi
      
      if (
        t.includes(nameStr) || 
        (initials.length > 1 && t.match(new RegExp(`\\b${initials}\\b`, 'i'))) ||
        (initialsNoOf.length > 1 && t.match(new RegExp(`\\b${initialsNoOf}\\b`, 'i')))
      ) {
        accountId = acc.id!;
        if (acc.type === 'CREDIT_CARD') autoPaymentMethod = 'Credit Card';
        else if (acc.type === 'CASH') autoPaymentMethod = 'Cash';
        break;
      }
    }

    // Payment Method Explicit Mentions
    if (t.includes('upi') || t.includes('gpay') || t.includes('phonepe') || t.includes('paytm')) autoPaymentMethod = 'UPI';
    else if (t.includes('cash')) autoPaymentMethod = 'Cash';
    else if (t.includes('card')) autoPaymentMethod = 'Credit Card';
    else if (t.includes('bank transfer') || t.includes('neft')) autoPaymentMethod = 'Bank Transfer';

    // Category
    let category = '';
    for (const cat of CATEGORIES) {
      if (t.includes(cat.toLowerCase())) {
        category = cat;
        break;
      }
    }

    // Classification Tag
    let tag = '';
    for (const tg of tags) {
      if (t.includes(tg.toLowerCase())) {
        tag = tg;
        break;
      }
    }

    // Deep Parsing for Payee and Note ("paid to [payee] for [note]")
    let parsedPayee = '';
    let parsedNote = '';
    
    // Extractor Regex
    const toMatch = text.match(/\bto\s+([A-Za-z0-9_]+)/i);
    const fromMatch = text.match(/\bfrom\s+([A-Za-z0-9_]+)/i);
    const forMatch = text.match(/\bfor\s+(.+?)(?:\s+(?:using|at|today|yesterday|with|in)\b|$)/i);
    const atMatch = text.match(/\bat\s+([A-Za-z0-9_]+)/i);

    if (toMatch) parsedPayee = toMatch[1];
    else if (fromMatch) parsedPayee = fromMatch[1];
    else if (atMatch) parsedPayee = atMatch[1];

    if (forMatch) parsedNote = forMatch[1].trim();

    // Date
    let date = '';
    let dateConfirmed = false;
    if (t.includes('yesterday')) {
      date = format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm");
      dateConfirmed = true;
    } else if (t.includes('today') || t.includes('now')) {
      date = new Date().toISOString().slice(0, 16);
      dateConfirmed = true;
    }

    return { amount, type, accountId, autoPaymentMethod, category, tag, parsedPayee, parsedNote, date, dateConfirmed };
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
        type: parsed.type || updated.type,
        selectedAccountId: parsed.accountId || updated.selectedAccountId,
        paymentMethod: parsed.autoPaymentMethod || updated.paymentMethod,
        category: parsed.category || updated.category,
        expenseType: parsed.tag || updated.expenseType,
        partyName: parsed.parsedPayee || updated.partyName,
        note: parsed.parsedNote || updated.note,
        transactionDate: parsed.date || updated.transactionDate,
        _dateConfirmed: parsed.dateConfirmed || updated._dateConfirmed
      };
      
      // If amount is given but type is missing, assume DEBIT for convenience if it's the first message
      if (!updated.type && updated.amount) updated.type = 'DEBIT';

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
    else if (stage === 'ASK_TYPE') {
      const t = userMsg.toLowerCase();
      if (t.includes('in') || t.includes('received') || t.includes('credit')) updated.type = 'CREDIT';
      else if (t.includes('transfer')) updated.type = 'TRANSFER';
      else updated.type = 'DEBIT';
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_BANK') {
      let foundAcc: any = null;
      const t = userMsg.toLowerCase();
      for (const acc of accounts) {
        const nameStr = acc.bankName.toLowerCase();
        const initialsStr = nameStr.split(/[\s-]+/).map(w => w[0]).join('');
        if (t.includes(nameStr) || (initialsStr.length > 1 && t.match(new RegExp(`\\b${initialsStr}\\b`, 'i')))) {
          foundAcc = acc;
          break;
        }
      }
      if (foundAcc) {
        updated.selectedAccountId = foundAcc.id;
        if (foundAcc.type === 'CREDIT_CARD') updated.paymentMethod = 'Credit Card';
        else if (foundAcc.type === 'CASH') updated.paymentMethod = 'Cash';
        setPendingTx(updated);
        checkNextStep(updated);
      } else {
        addAIMessage(`Could not find that bank. Please use short forms or names like: ${accounts.map(a=>a.bankName).join(', ')}`);
      }
    }
    else if (stage === 'ASK_PAYMENT_METHOD') {
      const t = userMsg.toLowerCase();
      if (t.includes('card')) updated.paymentMethod = 'Credit Card';
      else if (t.includes('cash')) updated.paymentMethod = 'Cash';
      else if (t.includes('bank') || t.includes('transfer')) updated.paymentMethod = 'Bank Transfer';
      else updated.paymentMethod = 'UPI'; // default catch-all for this step
      
      setPendingTx(updated);
      checkNextStep(updated);
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
        addAIMessage(`Please pick a valid category: ${CATEGORIES.join(', ')}`);
      }
    }
    else if (stage === 'ASK_TAG') {
      let foundTag = '';
      for (const tg of tags) {
        if (userMsg.toLowerCase().includes(tg.toLowerCase())) {
          foundTag = tg;
          break;
        }
      }
      if (foundTag) {
        updated.expenseType = foundTag;
        setPendingTx(updated);
        checkNextStep(updated);
      } else {
        if (userMsg.toLowerCase() === 'skip' || userMsg.toLowerCase() === 'none') {
          updated.expenseType = tags[0] || 'Personal';
          setPendingTx(updated);
          checkNextStep(updated);
        } else {
          addAIMessage(`Please pick a tag: ${tags.join(', ')} - or type 'skip'`);
        }
      }
    }
    else if (stage === 'ASK_PAYEE') {
      updated.partyName = (userMsg.toLowerCase() === 'none' || userMsg.toLowerCase() === 'skip') ? '' : userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_NOTE') {
      updated.note = (userMsg.toLowerCase() === 'no' || userMsg.toLowerCase() === 'skip') ? '' : userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_DATE') {
      const t = userMsg.toLowerCase();
      if (t === 'skip' || t === 'today' || t === 'now') {
         updated.transactionDate = new Date().toISOString().slice(0, 16);
      } else if (t === 'yesterday') {
         updated.transactionDate = format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm");
      }
      updated._dateConfirmed = true;
      setPendingTx(updated);
      checkNextStep(updated);
    }
  };

  const checkNextStep = (tx: any) => {
    if (!tx.amount) {
      setStage('ASK_AMOUNT');
      addAIMessage("How much was the amount?");
    } else if (!tx.type) {
      setStage('ASK_TYPE');
      addAIMessage("Was this an INFLOW (received) or OUTFLOW (spent)?");
    } else if (!tx.selectedAccountId) {
      setStage('ASK_BANK');
      // Suggesting shortforms contextually
      const accShorts = accounts.map(a => a.bankName.split(' ').map(w=>w[0]).join('').toUpperCase());
      addAIMessage(`Which account? You can use short forms like ${accShorts.join(', ')} or type 'Cash'.`);
    } else if (!tx.paymentMethod) {
      setStage('ASK_PAYMENT_METHOD');
      addAIMessage("Payment Method mandatory: Was it UPI, Card, Cash, or Bank Transfer?");
    } else if (!tx.category) {
      setStage('ASK_CATEGORY');
      addAIMessage(tx.partyName ? `What category is ${tx.partyName}?` : `Pick a Category: ${CATEGORIES.slice(0,4).join(', ')}...`);
    } else if (!tx.expenseType && tx.type !== 'TRANSFER') {
      setStage('ASK_TAG');
      addAIMessage(`Ensure classification: Pick a Tag (${tags.join(', ')}) or type 'skip'`);
    } else if (!tx.partyName && tx.type !== 'TRANSFER') {
      setStage('ASK_PAYEE');
      addAIMessage(tx.type === 'DEBIT' ? "Paid to whom? (Payee) Type 'skip' if none." : "Received from whom? Type 'skip' if none.");
    } else if (!tx.note) {
      setStage('ASK_NOTE');
      addAIMessage("Any remarks or note for this? Type 'no' to skip.");
    } else if (!tx._dateConfirmed) {
      setStage('ASK_DATE');
      addAIMessage("When did this happen? (e.g. 'today' or 'yesterday') type 'skip' for now.");
    } else {
      setStage('PREVIEW');
      addAIMessage("Awesome! I've deeply analyzed that. Verify the Smart Preview!");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F7F7F7] dark:bg-[#0A0A0A] relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-40">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[12px] font-medium shadow-sm flex items-start gap-2.5 ${msg.role === 'ai' ? 'bg-white dark:bg-[#111111] text-neutral-800 dark:text-neutral-200 border border-[#EBEBEB] dark:border-white/5' : 'bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue'}`}>
              {msg.role === 'ai' && <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60 flex-none" />}
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

      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#F7F7F7] via-[#F7F7F7]/95 dark:from-[#0A0A0A] dark:via-[#0A0A0A]/95 space-y-3 z-10">
        {stage === 'PREVIEW' && (
          <div className="mx-1 p-3 bg-white dark:bg-[#111111] border border-[#EBEBEB] dark:border-white/5 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-brand-blue" /> Smart Preview</span>
              <button onClick={() => { setStage('IDLE'); setPendingTx({...pendingTx, _dateConfirmed: false}); }} className="text-[8px] font-bold text-brand-blue dark:text-brand-cyan uppercase bg-brand-blue/5 px-2 py-1 rounded-lg">Edit All</button>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-[#F7F7F7] dark:bg-white/5 p-2 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-[16px] font-heading font-black text-brand-blue dark:text-white">₹{pendingTx.amount}</span>
                <span className={`text-[7px] font-bold uppercase ${pendingTx.type === 'CREDIT' ? 'text-brand-green' : 'text-brand-red'}`}>{pendingTx.type}</span>
              </div>
              <div className="bg-[#F7F7F7] dark:bg-white/5 p-2 rounded-2xl flex items-center gap-2">
                <div className="text-lg">{CATEGORY_ICONS[pendingTx.category] || '📦'}</div>
                <div className="flex flex-col"><span className="text-[8px] font-black text-neutral-400 uppercase leading-none">Category</span><span className="text-[10px] font-bold text-brand-blue dark:text-white truncate">{pendingTx.category}</span></div>
              </div>
            </div>

            <div className="space-y-1.5 mb-3 px-1 bg-[#F7F7F7] dark:bg-white/2 p-2 rounded-2xl">
              <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><Landmark className="w-2.5 h-2.5" /> Account</span><span className="text-brand-blue dark:text-white font-bold">{accounts.find(a => a.id === pendingTx.selectedAccountId)?.bankName || 'Unknown'} - {pendingTx.paymentMethod}</span></div>
              <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><Tag className="w-2.5 h-2.5" /> Tag</span><span className="text-brand-blue dark:text-white font-bold">#{pendingTx.expenseType}</span></div>
              <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><UserIcon className="w-2.5 h-2.5" /> Party / Note</span><span className="text-brand-blue dark:text-white font-bold truncate max-w-[120px] text-right">{pendingTx.partyName || '-'} • {pendingTx.note || '-'}</span></div>
              <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><Calendar className="w-2.5 h-2.5" /> Date</span><span className="text-brand-blue dark:text-white font-bold">{format(new Date(pendingTx.transactionDate), 'dd MMM')}</span></div>
            </div>

            <button onClick={() => onSave(pendingTx)} className="w-full py-3 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95"><CheckCircle2 className="w-4 h-4" /> Save Entry</button>
          </div>
        )}
        
        <div className="flex items-center gap-2 bg-white dark:bg-[#111111] p-1.5 rounded-2xl border border-[#EBEBEB] dark:border-white/5 shadow-xl">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder={stage === 'IDLE' ? "Say: 'Spent 500 on coffee'..." : "Type your answer..."} className="flex-1 bg-transparent px-3 py-2 text-[12px] font-bold outline-none dark:text-white placeholder:text-neutral-400" />
          <button onClick={handleSend} className="w-10 h-10 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-xl flex items-center justify-center shadow-lg transition-transform active:scale-90"><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
};
