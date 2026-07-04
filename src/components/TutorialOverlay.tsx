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
      color: 'bg-brand-blue'
    },
    {
      icon: null, // Custom render for step 2
      title: 'AI Powered Entry',
      description: 'Just type what you spent. Our AI instantly categorizes and tags it for you.',
      color: 'bg-gradient-to-br from-brand-blue to-brand-green'
    },
    {
      icon: <LineChart className="w-12 h-12 text-white" />,
      title: 'Track Everything',
      description: 'Your dashboard automatically categorizes your spending. Tap on any chart to see detailed insights.',
      color: 'bg-brand-green'
    }
  ];

  return (
    <div className="fixed inset-0 z-[300] bg-brand-blue/30 backdrop-blur-sm flex items-center justify-center p-6 antialiased">
      <AnimatePresence mode="wait">
        <motion.div 
          key={step}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative flex flex-col border border-brand-blue/5"
        >
          <button 
            onClick={onComplete}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {step !== 1 ? (
            <div className={`h-40 ${steps[step].color} flex items-center justify-center`}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md shadow-lg border border-white/20"
              >
                {steps[step].icon}
              </motion.div>
            </div>
          ) : (
            <div className={`h-64 ${steps[step].color} p-5 flex flex-col justify-end gap-3 overflow-hidden relative`}>
              <div className="absolute top-4 left-4 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-white/20 shadow-sm">
                <Bot className="w-4 h-4 text-white" />
                <span className="text-[10px] font-bold text-white tracking-widest uppercase shadow-sm">Expensify AI</span>
              </div>
              
              <AnimatePresence>
                {demoStage >= 1 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-[13px] font-medium self-end ml-auto w-fit shadow-md"
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
                    className="bg-white/20 backdrop-blur-md w-fit px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5 border border-white/20 shadow-md"
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
                    className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-xl border border-brand-blue/10 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-brand-blue text-sm truncate max-w-[160px]">Domino's Pizza</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[9px] font-black text-brand-blue/70 bg-brand-blue/5 px-2 py-0.5 rounded uppercase tracking-wider">Food</span>
                        <span className="text-[9px] font-black text-brand-green bg-brand-green/10 px-2 py-0.5 rounded uppercase tracking-wider">#WANT</span>
                      </div>
                    </div>
                    <p className="font-black text-rose-500 text-sm">-{currency}25.00</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="p-8 text-center bg-white">
            <h2 className="text-xl font-black text-brand-blue mb-3 tracking-tight">
              {steps[step].title}
            </h2>
            <p className="text-sm font-medium text-brand-blue/60 leading-relaxed mb-8">
              {steps[step].description}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {steps.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      step === idx ? 'w-6 bg-brand-blue' : 'w-1.5 bg-brand-blue/10'
                    }`}
                  />
                ))}
              </div>

              <button 
                onClick={handleNext}
                className="bg-brand-blue text-white px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-brand-blue/20 flex items-center gap-2 hover:bg-brand-blue/90"
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
