
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, CheckCircle2, Sparkles, Calendar, User as UserIcon, Landmark, Smartphone, CreditCard, Coins, Tag, Lightbulb, MoveHorizontal, Check, Zap } from 'lucide-react';
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
  'rapido': { category: 'Transport', tag: 'Personal' },
  'amazon': { category: 'Shopping', tag: 'Personal' },
  'flipkart': { category: 'Shopping', tag: 'Personal' },
  'blinkit': { category: 'Shopping', tag: 'Personal' },
  'zepto': { category: 'Shopping', tag: 'Personal' },
  'netflix': { category: 'Bills', tag: 'Personal' },
  'premium': { category: 'Bills', tag: 'Personal' },
  'spotify': { category: 'Entertainment', tag: 'Personal' },
  'jio': { category: 'Bills', tag: 'Personal' },
  'airtel': { category: 'Bills', tag: 'Personal' },
  'shell': { category: 'Transport', tag: 'Personal' },
  'hp': { category: 'Transport', tag: 'Personal' },
  'bpcl': { category: 'Transport', tag: 'Personal' },
  'pvr': { category: 'Entertainment', tag: 'Personal' },
};

export const AIChatEntry: React.FC<AIChatEntryProps> = ({ onSave, accounts, tags }) => {
  const [messages, setMessages] = useState<any[]>([
    { role: 'ai', content: "Hi! I'm your advanced AI assistant. You can say 'Move 5k from SBI to HDFC' or 'Spent 500 at Swiggy'. I'm ready for anything!" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [stage, setStage] = useState<ChatStage>('IDLE');
  const [suggestions, setSuggestions] = useState<string[]>(['500', '1000', 'Starbucks', 'Salary', 'HDFC to SBI']);
  
  const [pendingTx, setPendingTx] = useState<any>({
    type: '',
    amount: '',
    category: '',
    selectedAccountId: '',
    toAccountId: '', // For Transfers
    paymentMethod: 'UPI',
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

  const addAIMessage = (content: string) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', content }]);
      setIsTyping(false);
    }, 500);
  };

  const resolveBank = (textSnippet: string) => {
    const t = textSnippet.toLowerCase();
    for (const acc of accounts) {
      const nameStr = acc.bankName.toLowerCase();
      const words = nameStr.split(/[\s-]+/);
      const initials = words.filter(w => w.length > 1).map(w => w[0]).join('');
      if (t.includes(nameStr) || (initials.length > 1 && t.match(new RegExp(`\\b${initials}\\b`, 'i')))) {
        return acc;
      }
    }
    return null;
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
    if (t.match(/\b(received|got|salary|added|income|refund|deposit|credit)\b/)) type = 'CREDIT';
    else if (t.match(/\b(transfer|moved|send|move|sent)\b/)) type = 'TRANSFER';
    else if (t.match(/\b(paid|spent|bought|gave|purchased|spent|expense)\b/)) type = 'DEBIT';

    // Bank & Transfer Handling
    let accountId = '';
    let toAccountId = '';
    let autoPaymentMethod = '';

    if (type === 'TRANSFER') {
      const fromMatch = t.match(/from\s+([a-z\s]+?)\s+to\s+([a-z\s]+)/i);
      if (fromMatch) {
        const fromAcc = resolveBank(fromMatch[1]);
        const toAcc = resolveBank(fromMatch[2]);
        if (fromAcc) accountId = fromAcc.id!;
        if (toAcc) toAccountId = toAcc.id!;
      } else {
        // Fallback: search for any two bank mentions
        const mentions: string[] = [];
        for (const acc of accounts) { if (t.includes(acc.bankName.toLowerCase())) mentions.push(acc.id!); }
        if (mentions.length >= 2) {
          accountId = mentions[0];
          toAccountId = mentions[1];
        } else if (mentions.length === 1) {
          accountId = mentions[0];
        }
      }
      autoPaymentMethod = 'Bank Transfer';
    } else {
      const acc = resolveBank(t);
      if (acc) {
        accountId = acc.id!;
        if (acc.type === 'CREDIT_CARD') autoPaymentMethod = 'Credit Card';
        else if (acc.type === 'CASH') autoPaymentMethod = 'Cash';
        else autoPaymentMethod = 'UPI';
      }
    }

    // Category & Tag Prediction
    let category = '';
    let tag = '';
    let isPredicted = false;

    for (const cat of CATEGORIES) { if (t.includes(cat.toLowerCase())) { category = cat; break; } }
    
    for (const [merchant, data] of Object.entries(MERCHANT_KNOWLEDGE)) {
      if (t.includes(merchant)) {
        category = category || data.category;
        tag = tag || data.tag;
        isPredicted = true;
        break;
      }
    }

    // Entity Extract
    let parsedPayee = '';
    let parsedNote = '';
    
    const toMatch = text.match(/\bto\s+([A-Za-z0-9_]+)/i);
    const fromMatch = text.match(/\bfrom\s+([A-Za-z0-9_]+)/i);
    const forMatch = text.match(/\bfor\s+(.+?)(?:\s+(?:using|at|today|yesterday|with|in)\b|$)/i);
    const atMatch = text.match(/\bat\s+([A-Za-z0-9_ ]+)/i);

    if (toMatch && type !== 'TRANSFER') parsedPayee = toMatch[1];
    else if (fromMatch && type !== 'TRANSFER') parsedPayee = fromMatch[1];
    else if (atMatch) parsedPayee = atMatch[1].split(' ')[0];

    if (forMatch) parsedNote = forMatch[1].trim();

    // Date
    let date = '';
    let dateConfirmed = false;
    if (t.includes('yesterday')) { date = format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"); dateConfirmed = true; }
    else if (t.includes('today')) { date = new Date().toISOString().slice(0, 16); dateConfirmed = true; }

    return { amount, type, accountId, toAccountId, autoPaymentMethod, category, tag, parsedPayee, parsedNote, date, dateConfirmed, isPredicted };
  };

  const handleSend = (overrideMsg?: string) => {
    const userMsg = overrideMsg || input.trim();
    if (!userMsg) return;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setSuggestions([]);

    let updated = { ...pendingTx };

    if (stage === 'IDLE' || stage === 'PREVIEW') {
      const parsed = parseUniversal(userMsg);
      updated = {
        ...updated,
        amount: parsed.amount || updated.amount,
        type: parsed.type || (updated.amount ? 'DEBIT' : updated.type),
        selectedAccountId: parsed.accountId || updated.selectedAccountId,
        toAccountId: parsed.toAccountId || updated.toAccountId,
        paymentMethod: parsed.autoPaymentMethod || updated.paymentMethod,
        category: parsed.category || updated.category,
        expenseType: parsed.tag || updated.expenseType,
        partyName: parsed.parsedPayee || updated.partyName,
        note: parsed.parsedNote || updated.note,
        transactionDate: parsed.date || updated.transactionDate,
        _dateConfirmed: parsed.dateConfirmed || updated._dateConfirmed,
        _isPredicted: parsed.isPredicted
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
      } else {
         addAIMessage("I couldn't catch the amount. Try something like '500' or '1,200'.");
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
      const acc = resolveBank(userMsg);
      if (acc) {
        if (updated.type === 'TRANSFER' && updated.selectedAccountId) updated.toAccountId = acc.id;
        else updated.selectedAccountId = acc.id;
        
        if (acc.type === 'CREDIT_CARD') updated.paymentMethod = 'Credit Card';
        else if (acc.type === 'CASH') updated.paymentMethod = 'Cash';
        setPendingTx(updated);
        checkNextStep(updated);
      } else {
        addAIMessage(`I couldn't find that account. Which bank should I use? (${accounts.map(a=>a.bankName).join(', ')})`);
      }
    }
    else if (stage === 'ASK_PAYMENT_METHOD') {
      const t = userMsg.toLowerCase();
      if (t.includes('card')) updated.paymentMethod = 'Credit Card';
      else if (t.includes('cash')) updated.paymentMethod = 'Cash';
      else if (t.includes('bank') || t.includes('transfer')) updated.paymentMethod = 'Bank Transfer';
      else updated.paymentMethod = 'UPI';
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_CATEGORY') {
      let foundCat = '';
      for (const cat of CATEGORIES) { if (userMsg.toLowerCase().includes(cat.toLowerCase())) { foundCat = cat; break; } }
      if (foundCat) { updated.category = foundCat; setPendingTx(updated); checkNextStep(updated); }
      else { addAIMessage(`Pick a valid category: ${CATEGORIES.join(', ')}`); }
    }
    else if (stage === 'ASK_TAG') {
      let foundTag = '';
      for (const tg of tags) { if (userMsg.toLowerCase().includes(tg.toLowerCase())) { foundTag = tg; break; } }
      if (foundTag || userMsg.toLowerCase() === 'skip') {
        updated.expenseType = foundTag || tags[0] || 'Personal';
        setPendingTx(updated);
        checkNextStep(updated);
      } else {
        addAIMessage(`Pick a tag (${tags.join(', ')}) or type 'skip'.`);
      }
    }
    else if (stage === 'ASK_PAYEE') {
      updated.partyName = (userMsg.toLowerCase() === 'none' || userMsg.toLowerCase() === 'skip') ? '' : userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_NOTE') {
      if (userMsg.toLowerCase() === 'no' || userMsg.toLowerCase() === 'skip' || !userMsg.trim()) {
        addAIMessage("Remarks are mandatory. Tell me briefly what the transaction was for!");
      } else {
        updated.note = userMsg;
        setPendingTx(updated);
        checkNextStep(updated);
      }
    }
    else if (stage === 'ASK_DATE') {
      const t = userMsg.toLowerCase();
      if (t === 'skip' || t === 'today' || t === 'now') { updated.transactionDate = new Date().toISOString().slice(0, 16); }
      else if (t === 'yesterday') { updated.transactionDate = format(subDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"); }
      updated._dateConfirmed = true;
      setPendingTx(updated);
      checkNextStep(updated);
    }
  };

  const checkNextStep = (tx: any) => {
    if (!tx.amount) {
      setStage('ASK_AMOUNT');
      setSuggestions(['500', '1k', '2,500']);
      addAIMessage("Sure! How much was the transaction?");
    } else if (!tx.type) {
      setStage('ASK_TYPE');
      setSuggestions(['Spent', 'Received', 'Transfer']);
      addAIMessage("Understood. Was this a personal expense or an income/transfer?");
    } else if (!tx.selectedAccountId) {
      setStage('ASK_BANK');
      setSuggestions(accounts.map(a => a.bankName.split(' ')[0]));
      addAIMessage("Which account should I log this against?");
    } else if (tx.type === 'TRANSFER' && !tx.toAccountId) {
      setStage('ASK_BANK');
      setSuggestions(accounts.filter(a => a.id !== tx.selectedAccountId).map(a => a.bankName.split(' ')[0]));
      addAIMessage("Log the destination: which account did it go TO?");
    } else if (!tx.paymentMethod) {
      setStage('ASK_PAYMENT_METHOD');
      setSuggestions(['UPI', 'Card', 'Cash']);
      addAIMessage("Confirmation needed: UPI, Card, or Cash?");
    } else if (!tx.category && tx.type !== 'TRANSFER') {
      setStage('ASK_CATEGORY');
      setSuggestions(CATEGORIES.slice(0, 4));
      addAIMessage("What category is this for?");
    } else if (!tx.expenseType && tx.type !== 'TRANSFER') {
      setStage('ASK_TAG');
      setSuggestions([...tags, 'skip']);
      addAIMessage("Ensure classification: Pick a Tag or 'skip'.");
    } else if (!tx.partyName && tx.type !== 'TRANSFER') {
      setStage('ASK_PAYEE');
      addAIMessage("Any specific Payee name? Type 'skip' if none.");
    } else if (!tx.note) {
      setStage('ASK_NOTE');
      addAIMessage("Remark is mandatory: What was the specific reason for this entry?");
    } else if (!tx._dateConfirmed) {
      setStage('ASK_DATE');
      setSuggestions(['Today', 'Yesterday', 'skip']);
      addAIMessage("When did this happen?");
    } else {
      setStage('PREVIEW');
      addAIMessage("Everything looks perfect! Verify the Smart Preview below.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F7F7F7] dark:bg-[#0A0A0A] relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-52">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[12px] font-medium shadow-sm flex items-start gap-2.5 ${msg.role === 'ai' ? 'bg-white dark:bg-[#111111] text-neutral-800 dark:text-neutral-200 border border-[#EBEBEB] dark:border-white/5' : 'bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue shadow-lg shadow-brand-blue/10'}`}>
              {msg.role === 'ai' && <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" />}
              <span className="leading-relaxed">{msg.content}</span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-[#111111] px-4 py-2.5 rounded-2xl flex items-center gap-1 border border-[#EBEBEB] dark:border-white/5 shadow-sm">
              <span className="w-1 h-1 bg-brand-blue dark:bg-brand-cyan rounded-full animate-bounce"></span>
              <span className="w-1 h-1 bg-brand-blue dark:bg-brand-cyan rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-1 h-1 bg-brand-blue dark:bg-brand-cyan rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#F7F7F7] via-[#F7F7F7]/95 dark:from-[#0A0A0A] dark:via-[#0A0A0A]/95 space-y-3 z-10">
        
        {/* Quick Suggestions */}
        {suggestions.length > 0 && stage !== 'PREVIEW' && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {suggestions.map((s, idx) => (
              <button key={idx} onClick={() => handleSend(s)} className="whitespace-nowrap px-3 py-1.5 bg-white dark:bg-[#111111] border border-[#EBEBEB] dark:border-white/5 rounded-full text-[10px] font-bold text-neutral-500 hover:text-brand-blue dark:hover:text-brand-cyan transition-colors shadow-sm active:scale-95 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 opacity-40" /> {s}
              </button>
            ))}
          </div>
        )}

        {stage === 'PREVIEW' && (
          <div className="mx-1 p-3 bg-white dark:bg-[#111111] border border-[#EBEBEB] dark:border-white/5 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-brand-blue" /> Smart Preview</span>
              <div className="flex gap-2">
                 {pendingTx._isPredicted && <span className="text-[7px] font-black uppercase text-brand-blue/60 bg-brand-blue/5 px-2 py-1 rounded-lg border border-brand-blue/10">Predicted</span>}
                 <button onClick={() => { setStage('IDLE'); setPendingTx({...pendingTx, _dateConfirmed: false}); }} className="text-[8px] font-bold text-brand-blue dark:text-brand-cyan uppercase bg-brand-blue/5 px-2 py-1 rounded-lg">Edit</button>
              </div>
            </div>
            
            {pendingTx.type === 'TRANSFER' ? (
              <div className="bg-[#F7F7F7] dark:bg-white/5 p-3 rounded-2xl flex items-center justify-between mb-3">
                <div className="flex flex-col items-center flex-1">
                   <Landmark className="w-4 h-4 text-neutral-400 mb-1" />
                   <span className="text-[9px] font-bold text-neutral-500 truncate w-full text-center">{accounts.find(a=>a.id === pendingTx.selectedAccountId)?.bankName || 'From'}</span>
                </div>
                <div className="flex flex-col items-center px-4">
                   <span className="text-[14px] font-black text-brand-blue dark:text-white">₹{pendingTx.amount}</span>
                   <MoveHorizontal className="w-3 h-3 text-neutral-300" />
                </div>
                <div className="flex flex-col items-center flex-1">
                   <Landmark className="w-4 h-4 text-brand-cyan mb-1" />
                   <span className="text-[9px] font-bold text-brand-blue dark:text-brand-cyan truncate w-full text-center">{accounts.find(a=>a.id === pendingTx.toAccountId)?.bankName || 'To'}</span>
                </div>
              </div>
            ) : (
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
            )}

            <div className="space-y-1.5 mb-3 px-1 bg-[#F7F7F7] dark:bg-white/2 p-2 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><Smartphone className="w-2.5 h-2.5" /> Source / Method</span><span className="text-brand-blue dark:text-white font-bold">{pendingTx.paymentMethod || 'Manual'}</span></div>
              {pendingTx.type !== 'TRANSFER' && <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><Tag className="w-2.5 h-2.5" /> Classification</span><span className="text-brand-blue dark:text-white font-bold">#{pendingTx.expenseType}</span></div>}
              <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><UserIcon className="w-2.5 h-2.5" /> {pendingTx.type === 'TRANSFER' ? 'Purpose' : 'Entity / Reason'}</span><span className="text-brand-blue dark:text-white font-bold truncate max-w-[150px] text-right italic">{pendingTx.note || 'No Remark'}</span></div>
              <div className="flex items-center justify-between text-[9px]"><span className="text-neutral-400 font-bold flex items-center gap-1.5"><Calendar className="w-2.5 h-2.5" /> Timestamp</span><span className="text-brand-blue dark:text-white font-bold">{format(new Date(pendingTx.transactionDate), 'dd MMM, hh:mm a')}</span></div>
            </div>

            <button onClick={() => onSave(pendingTx)} className="w-full py-3 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95"><Check className="w-4 h-4" /> Save Entry</button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-white dark:bg-[#111111] p-1.5 rounded-2xl border border-[#EBEBEB] dark:border-white/5 shadow-xl">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder={stage === 'IDLE' ? "Say: 'Spent 500 at Swiggy'..." : "Type your answer..."} className="flex-1 bg-transparent px-3 py-2 text-[12px] font-bold outline-none dark:text-white placeholder:text-neutral-400" />
          <button onClick={() => handleSend()} className="w-10 h-10 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-xl flex items-center justify-center shadow-lg transition-transform active:scale-90"><Send className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
};
