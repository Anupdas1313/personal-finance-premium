
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, CheckCircle2, ChevronRight, X, Sparkles, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import { CATEGORIES, CATEGORY_ICONS } from '../constants';

interface AIChatEntryProps {
  onSave: (transaction: any) => void;
  accounts: any[];
  tags: string[];
}

export const AIChatEntry: React.FC<AIChatEntryProps> = ({ onSave, accounts, tags }) => {
  const [messages, setMessages] = useState<any[]>([
    { role: 'ai', content: "Hi! I'm your AI finance assistant. Just tell me what you spent or received, like: 'Paid 500 for lunch at KFC using SBI'." }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [pendingTx, setPendingTx] = useState<any>({
    type: 'DEBIT',
    amount: '',
    category: 'Other',
    selectedAccountId: '',
    expenseType: tags[0] || '',
    partyName: '',
    note: '',
    transactionDate: new Date().toISOString().slice(0, 16)
  });
  
  const [stage, setStage] = useState<'INITIAL' | 'MISSING_INFO' | 'PREVIEW'>('INITIAL');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const parseInput = (text: string) => {
    const amountMatch = text.match(/\d+(?:\.\d+)?/);
    const amount = amountMatch ? amountMatch[0] : '';
    
    let category = '';
    const categories = CATEGORIES;
    for (const cat of categories) {
      if (text.toLowerCase().includes(cat.toLowerCase())) {
        category = cat;
        break;
      }
    }

    let accountId = '';
    for (const acc of accounts) {
      if (text.toLowerCase().includes(acc.bankName.toLowerCase())) {
        accountId = acc.id!;
        break;
      }
    }

    let type: 'DEBIT' | 'CREDIT' | 'TRANSFER' = 'DEBIT';
    if (text.toLowerCase().includes('received') || text.toLowerCase().includes('got') || text.toLowerCase().includes('added')) {
      type = 'CREDIT';
    } else if (text.toLowerCase().includes('transfer') || text.toLowerCase().includes('moved')) {
      type = 'TRANSFER';
    }

    return { amount, category, accountId, type };
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const parsed = parseInput(userMsg);
      const updatedTx = { ...pendingTx };
      
      if (parsed.amount) updatedTx.amount = parsed.amount;
      if (parsed.category) updatedTx.category = parsed.category;
      if (parsed.accountId) updatedTx.selectedAccountId = parsed.accountId;
      updatedTx.type = parsed.type;
      
      // Auto-extract party if "at" or "to" is used
      const atIndex = userMsg.toLowerCase().indexOf(' at ');
      const toIndex = userMsg.toLowerCase().indexOf(' to ');
      const forIndex = userMsg.toLowerCase().indexOf(' for ');
      
      if (atIndex !== -1) updatedTx.partyName = userMsg.slice(atIndex + 4).split(' ')[0];
      else if (toIndex !== -1) updatedTx.partyName = userMsg.slice(toIndex + 4).split(' ')[0];
      else if (forIndex !== -1) updatedTx.note = userMsg.slice(forIndex + 5).split(' ')[0];

      setPendingTx(updatedTx);
      setIsTyping(false);

      // Check for missing info
      if (!updatedTx.amount) {
        setMessages(prev => [...prev, { role: 'ai', content: "Got it! How much was the amount?" }]);
        setStage('MISSING_INFO');
      } else if (!updatedTx.selectedAccountId) {
        setMessages(prev => [...prev, { role: 'ai', content: "Cool! Which account did you use for this?" }]);
        setStage('MISSING_INFO');
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: "Awesome, I've identified everything! Check the preview below to save." }]);
        setStage('PREVIEW');
      }
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full bg-[#F7F7F7] dark:bg-[#0A0A0A]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth no-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[12px] font-medium shadow-sm flex items-start gap-2.5 ${msg.role === 'ai' ? 'bg-white dark:bg-[#111111] text-neutral-800 dark:text-neutral-200 border border-[#EBEBEB] dark:border-white/5' : 'bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue'}`}>
              {msg.role === 'ai' && <Bot className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" />}
              <span>{msg.content}</span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-[#111111] px-4 py-2.5 rounded-2xl flex items-center gap-1 border border-[#EBEBEB] dark:border-white/5 shadow-sm">
              <div className="w-1.5 h-1.5 bg-neutral-300 dark:bg-neutral-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-neutral-300 dark:bg-neutral-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-neutral-300 dark:bg-neutral-600 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl border-t border-[#EBEBEB] dark:border-white/5 p-3 space-y-3 pb-safe-bottom">
        
        {stage === 'PREVIEW' && (
          <div className="p-3 bg-brand-blue/[0.03] dark:bg-brand-cyan/[0.03] border border-brand-blue/20 dark:border-brand-cyan/20 rounded-2xl animate-in zoom-in-95 duration-300 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-brand-blue dark:text-brand-cyan tracking-widest flex items-center gap-1.5">
                 <Sparkles className="w-3 h-3" /> Smart Preview
              </span>
              <button onClick={() => setStage('INITIAL')} className="p-1 px-2 text-[8px] font-bold bg-white dark:bg-white/5 rounded-lg border border-[#EBEBEB] dark:border-white/10 uppercase">Edit</button>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white dark:bg-[#111111] p-2 rounded-xl border border-[#EBEBEB] dark:border-white/5 flex flex-col items-center">
                <span className="text-[14px] font-heading font-black text-brand-blue dark:text-white">₹{pendingTx.amount}</span>
                <span className="text-[7px] text-neutral-400 font-bold uppercase tracking-widest">{pendingTx.type}</span>
              </div>
              <div className="bg-white dark:bg-[#111111] p-2 rounded-xl border border-[#EBEBEB] dark:border-white/5 flex flex-col items-center justify-center">
                <span className="text-[16px]">{CATEGORY_ICONS[pendingTx.category] || '📦'}</span>
                <span className="text-[7px] font-bold text-neutral-400 uppercase">{pendingTx.category}</span>
              </div>
            </div>

            <button 
              onClick={() => onSave(pendingTx)}
              className="w-full py-2.5 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-brand-blue/20 dark:shadow-brand-cyan/20 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Save Entry
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 bg-[#F7F7F7] dark:bg-white/5 p-1 rounded-2xl border border-[#EBEBEB] dark:border-white/5">
          <input 
            type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type: 'Spent 500 at Cafe'..."
            className="flex-1 bg-transparent px-3 py-2 text-[12px] font-bold outline-none placeholder:text-neutral-400 dark:placeholder:text-[#333333]"
          />
          <button 
            onClick={handleSend}
            className="p-2 bg-brand-blue dark:bg-brand-cyan text-white dark:text-brand-blue rounded-xl transition-transform active:scale-95 shadow-lg shadow-brand-blue/10"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-[8px] text-neutral-400 uppercase font-bold tracking-widest">Natural Language Entry powered by AI</p>
      </div>
    </div>
  );
};
