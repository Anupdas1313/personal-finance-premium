import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Bot, LineChart, X, ArrowRight } from 'lucide-react';
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
      icon: <Plus className="w-12 h-12 text-brand-green" />,
      title: 'Add Transactions',
      description: 'Tap the big plus button at the bottom of the screen anytime to manually log your income or expenses.',
      color: 'bg-brand-green/10 border-brand-green/20'
    },
    {
      icon: null, // Custom render for step 2
      title: 'AI Powered Entry',
      description: 'Just type what you spent. Our AI instantly categorizes and tags it for you.',
      color: 'bg-brand-green/10 border-brand-green/20'
    },
    {
      icon: <LineChart className="w-12 h-12 text-brand-green" />,
      title: 'Track Everything',
      description: 'Your dashboard automatically categorizes your spending. Tap on any chart to see detailed insights.',
      color: 'bg-brand-green/10 border-brand-green/20'
    }
  ];

  return (
    <div className="fixed inset-0 z-[300] bg-brand-green/20 backdrop-blur-md flex items-center justify-center p-6 antialiased">
      <AnimatePresence mode="wait">
        <motion.div 
          key={step}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative flex flex-col border border-neutral-100"
        >
          <button 
            onClick={onComplete}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 transition-all z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {step !== 1 ? (
            <div className={`h-40 ${steps[step].color} border-b flex items-center justify-center relative overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-b from-brand-green/5 to-transparent" />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring' }}
                className="w-24 h-24 rounded-[2rem] bg-white flex items-center justify-center shadow-lg border border-brand-green/10 relative z-10"
              >
                {steps[step].icon}
              </motion.div>
            </div>
          ) : (
            <div className={`h-64 ${steps[step].color} border-b p-5 flex flex-col justify-end gap-3 overflow-hidden relative`}>
              <div className="absolute inset-0 bg-gradient-to-b from-brand-green/5 to-transparent" />
              <div className="absolute top-4 left-4 bg-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-brand-green/10 shadow-sm z-10">
                <Bot className="w-4 h-4 text-brand-green" />
                <span className="text-[13px] font-semibold text-brand-green">Expensify AI</span>
              </div>
              
              <AnimatePresence>
                {demoStage >= 1 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="bg-brand-green text-white rounded-2xl rounded-tr-sm px-4 py-3 text-[14px] font-medium self-end ml-auto w-fit shadow-md relative z-10"
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
                    className="bg-white w-fit px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5 border border-brand-green/10 shadow-sm relative z-10"
                  >
                    <span className="w-1.5 h-1.5 bg-brand-green rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-brand-green rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-brand-green rounded-full animate-bounce [animation-delay:-0.3s]" />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {demoStage >= 3 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="bg-white rounded-2xl rounded-tl-sm p-4 shadow-lg border border-brand-green/10 flex items-center justify-between relative z-10"
                  >
                    <div>
                      <p className="font-semibold text-neutral-900 text-[15px] truncate max-w-[160px]">Domino's Pizza</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="font-medium bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-600 text-[12px]">Food</span>
                        <span className="font-medium bg-brand-green/10 text-brand-green px-1.5 py-0.5 rounded text-[12px]">#WANT</span>
                      </div>
                    </div>
                    <p className="font-semibold text-rose-500 text-[15px]">-{currency}25.00</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="p-6 pt-8 text-center bg-white relative z-10">
            <h2 className="text-[22px] font-extrabold text-neutral-900 mb-2 tracking-tight">
              {steps[step].title}
            </h2>
            <p className="text-[15px] text-neutral-500 leading-relaxed mb-8">
              {steps[step].description}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {steps.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      step === idx ? 'w-6 bg-brand-green' : 'w-1.5 bg-neutral-200'
                    }`}
                  />
                ))}
              </div>

              <button 
                onClick={handleNext}
                className="bg-brand-green text-white px-6 py-3 rounded-xl font-semibold text-[15px] active:scale-95 transition-all shadow-md flex items-center gap-2 hover:bg-brand-green/90"
              >
                {step === steps.length - 1 ? 'Get Started' : 'Next'}
                {step !== steps.length - 1 && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
