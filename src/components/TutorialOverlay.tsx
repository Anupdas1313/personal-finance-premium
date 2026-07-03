import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Bot, LineChart, X, ArrowRight, Sparkles } from 'lucide-react';
import { useCurrency } from '../hooks/useCurrency';

interface TutorialOverlayProps {
  onComplete: () => void;
}

export default function TutorialOverlay({ onComplete }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);
  const currency = useCurrency();
  const [demoStage, setDemoStage] = useState(0);

  useEffect(() => {
    if (step === 1) {
      setDemoStage(0);
      const timers = [
        setTimeout(() => setDemoStage(1), 800), // Show user message
        setTimeout(() => setDemoStage(2), 1600), // Show typing
        setTimeout(() => setDemoStage(3), 2800), // Show result
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [step]);

  const handleNext = () => {
    if (step < 2) {
      setStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const steps = [
    {
      icon: <Plus className="w-12 h-12 text-white" />,
      title: 'Add Transactions',
      description: 'Tap the big plus button at the bottom of the screen anytime to manually log your income or expenses.',
      color: 'bg-[#1A1A1A]'
    },
    {
      icon: null, // Custom render for step 2
      title: 'AI Powered Entry',
      description: 'Just type what you spent. Our AI instantly categorizes and tags it for you.',
      color: 'bg-gradient-to-br from-[#1A1A1A] to-[#333333]'
    },
    {
      icon: <LineChart className="w-12 h-12 text-white" />,
      title: 'Track Everything',
      description: 'Your dashboard automatically categorizes your spending. Tap on any chart to see detailed insights.',
      color: 'bg-[#1A1A1A]'
    }
  ];

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 antialiased">
      <AnimatePresence mode="wait">
        <motion.div 
          key={step}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col"
        >
          <button 
            onClick={onComplete}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-neutral-500 hover:text-black transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {step !== 1 ? (
            <div className={`h-40 ${steps[step].color} flex items-center justify-center`}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md"
              >
                {steps[step].icon}
              </motion.div>
            </div>
          ) : (
            <div className={`h-64 ${steps[step].color} p-5 flex flex-col justify-end gap-3 overflow-hidden relative`}>
              <div className="absolute top-4 left-4 bg-white/10 backdrop-blur px-3 py-1.5 rounded-full flex items-center gap-2">
                <Bot className="w-4 h-4 text-white" />
                <span className="text-[10px] font-bold text-white tracking-widest uppercase">Expensify AI</span>
              </div>
              
              <AnimatePresence>
                {demoStage >= 1 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="bg-[#333333] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-[13px] font-medium self-end ml-auto w-fit shadow-md border border-white/5"
                  >
                    Bought a large pizza for {currency}25 from Domino's using my credit card
                  </motion.div>
                )}
              </AnimatePresence>
              
              <AnimatePresence>
                {demoStage === 2 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="bg-white/10 backdrop-blur w-fit px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5 border border-white/5"
                  >
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {demoStage >= 3 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-xl border border-neutral-100 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-[#1A1A1A] text-sm truncate max-w-[160px]">Domino's Pizza</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[9px] font-black text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded uppercase tracking-wider">Food</span>
                        <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">#WANT</span>
                      </div>
                    </div>
                    <p className="font-black text-rose-500 text-sm">-{currency}25.00</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="p-8 text-center bg-white">
            <h2 className="text-xl font-black text-[#1A1A1A] mb-3 tracking-tight">
              {steps[step].title}
            </h2>
            <p className="text-sm font-medium text-[#737373] leading-relaxed mb-8">
              {steps[step].description}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {steps.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      step === idx ? 'w-6 bg-[#1A1A1A]' : 'w-1.5 bg-[#F2F2F2]'
                    }`}
                  />
                ))}
              </div>

              <button 
                onClick={handleNext}
                className="bg-[#1A1A1A] text-white px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-black/10 flex items-center gap-2"
              >
                {step === steps.length - 1 ? 'Get Started' : 'Next'}
                {step !== steps.length - 1 && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
