
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, CheckCircle2, Sparkles, Calendar, Wallet, Tag, User as UserIcon, MessageSquare, Landmark, Smartphone, CreditCard, Coins } from 'lucide-react';
import { format, parse, isWithinInterval, subDays } from 'date-fns';
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
    expenseType: tags[0] || '',
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
    const kMatch = t.match(/(\d+(?:\.\d+)?)\s*k/);
    let amount = '';
    if (kMatch) {
      amount = (parseFloat(kMatch[1]) * 1000).toString();
    } else {
      const basicMatch = t.match(/\d+(?:\.\d+)?/);
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

    // Bank Fuzzy
    let accountId = '';
    for (const acc of accounts) {
      if (t.includes(acc.bankName.toLowerCase())) {
        accountId = acc.id!;
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

    return { amount, category, accountId, type, date };
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');

    let updated = { ...pendingTx };

    // --- LOGIC FLOW ---
    if (stage === 'IDLE' || stage === 'PREVIEW') {
      const parsed = parseUniversal(userMsg);
      updated = {
        ...updated,
        amount: parsed.amount || updated.amount,
        category: parsed.category || updated.category,
        selectedAccountId: parsed.accountId || updated.selectedAccountId,
        type: parsed.type,
        transactionDate: parsed.date
      };
      
      // Extraction for Payee ("at", "to")
      const atIdx = userMsg.toLowerCase().indexOf(' at ');
      const toIdx = userMsg.toLowerCase().indexOf(' to ');
      if (atIdx !== -1) updated.partyName = userMsg.slice(atIdx + 4).split(' ')[0];
      else if (toIdx !== -1) updated.partyName = userMsg.slice(toIdx + 4).split(' ')[0];

      setPendingTx(updated);
      checkNextStep(updated);
    } 
    else if (stage === 'ASK_AMOUNT') {
      const amtMatch = userMsg.match(/\d+(?:\.\d+)?/);
      if (amtMatch) {
         updated.amount = amtMatch[0];
         setPendingTx(updated);
         checkNextStep(updated);
      } else {
         addAIMessage("Sorry, I didn't see a number there. How much was it?");
      }
    } 
    else if (stage === 'ASK_BANK') {
      let found = '';
      for (const acc of accounts) {
        if (userMsg.toLowerCase().includes(acc.bankName.toLowerCase())) {
          found = acc.id;
          break;
        }
      }
      if (found) {
        updated.selectedAccountId = found;
        setPendingTx(updated);
        checkNextStep(updated);
      } else {
        addAIMessage("I couldn't find that bank in your list. Try saying the name as it appears in your accounts.");
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
      updated.partyName = userMsg;
      setPendingTx(updated);
      checkNextStep(updated);
    }
    else if (stage === 'ASK_NOTE') {
      updated.note = userMsg;
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
      const suggestion = tx.partyName ? `What category is ${tx.partyName}?` : "What category should I put this in?";
      addAIMessage(suggestion);
    } else if (!tx.partyName && tx.type !== 'TRANSFER') {
      setStage('ASK_PAYEE');
      addAIMessage("Who was this paid to (Payee)? You can say 'None' skip.");
    } else if (!tx.note) {
      setStage('ASK_NOTE');
      addAIMessage("Any specific remark or note for this entry? (Type 'No' to skip)");
    } else {
      setStage('PREVIEW');
      addAIMessage("Perfect! I've gathered all the details. Check the smart preview below to finalize.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F7F7F7] dark:bg-[#0A0A0A]">
      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-32">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[12px] font-medium shadow-sm flex items-start gap-2.5 ${msg.role === 'ai' ? 'bg-white dark:bg-[#111111] text-neutral-800 dark:text-neutral-200 border border-[#EBEBEB] dark:border-white/5' : 'bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue'}`}>
              {msg.role === 'ai' && <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" />}
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

      {/* Floating Preview & Input Section */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-[#F7F7F7] via-[#F7F7F7]/95 to-transparent dark:from-[#0A0A0A] dark:via-[#0A0A0A]/95 space-y-3">
        
        {stage === 'PREVIEW' && (
          <div className="mx-1 p-3 bg-white dark:bg-[#111111] border border-[#EBEBEB] dark:border-white/5 rounded-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand-blue/10 flex items-center justify-center">
                  <Sparkles className="w-3 h-3 text-brand-blue" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Smart Preview</span>
              </div>
              <button onClick={() => setStage('IDLE')} className="text-[8px] font-bold text-brand-blue dark:text-brand-cyan uppercase bg-brand-blue/5 px-2 py-1 rounded-lg">Edit All</button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-[#F7F7F7] dark:bg-white/5 p-2 rounded-2xl flex flex-col items-center justify-center border border-transparent">
                <span className="text-[16px] font-heading font-black text-brand-blue dark:text-white">₹{pendingTx.amount}</span>
                <span className={`text-[7px] font-bold uppercase tracking-tighter ${pendingTx.type === 'CREDIT' ? 'text-brand-green' : 'text-brand-red'}`}>{pendingTx.type}</span>
              </div>
              <div className="bg-[#F7F7F7] dark:bg-white/5 p-2 rounded-2xl flex items-center gap-2 border border-transparent">
                <div className="text-lg">{CATEGORY_ICONS[pendingTx.category] || '📦'}</div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-neutral-500 uppercase leading-none">Category</span>
                  <span className="text-[10px] font-bold text-brand-blue dark:text-white truncate">{pendingTx.category}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 mb-3 px-1">
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-neutral-400 font-bold flex items-center gap-1.5"><Landmark className="w-2.5 h-2.5" /> Account</span>
                <span className="text-brand-blue dark:text-white font-bold">{accounts.find(a => a.id === pendingTx.selectedAccountId)?.bankName || 'Unknown'}</span>
              </div>
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-neutral-400 font-bold flex items-center gap-1.5"><UserIcon className="w-2.5 h-2.5" /> Payee</span>
                <span className="text-brand-blue dark:text-white font-bold">{pendingTx.partyName || 'Self/Skip'}</span>
              </div>
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-neutral-400 font-bold flex items-center gap-1.5"><Calendar className="w-2.5 h-2.5" /> Date</span>
                <span className="text-brand-blue dark:text-white font-bold">{format(new Date(pendingTx.transactionDate), 'dd MMM, hh:mm a')}</span>
              </div>
            </div>

            <button 
              onClick={() => onSave(pendingTx)}
              className="w-full py-3 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-brand-blue/20 dark:shadow-brand-cyan/20 flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" /> Confirm & Save Entry
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 bg-white dark:bg-[#111111] p-1.5 rounded-2xl border border-[#EBEBEB] dark:border-white/5 shadow-xl">
          <input 
            type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={stage === 'IDLE' ? "Say: 'Spent 500 on coffee'..." : "Type your answer..."}
            className="flex-1 bg-transparent px-3 py-2 text-[12px] font-bold outline-none placeholder:text-neutral-400 dark:placeholder:text-[#333333]"
          />
          <button 
            onClick={handleSend}
            className="w-10 h-10 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-xl flex items-center justify-center transition-transform active:scale-90 shadow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-[7px] text-neutral-400 font-black uppercase tracking-[0.2em] opacity-60">Zero-Cost Local AI Assistant</p>
      </div>
    </div>
  );
};
