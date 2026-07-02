import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Bot, LineChart, X } from 'lucide-react';

interface TutorialOverlayProps {
  onComplete: () => void;
}

const TUTORIAL_STEPS = [
  {
    icon: <Plus className="w-12 h-12 text-white" />,
    title: 'Add Transactions',
    description: 'Tap the big plus button at the bottom of the screen anytime to manually log your income or expenses.',
    color: 'bg-brand-blue'
  },
  {
    icon: <Bot className="w-12 h-12 text-white" />,
    title: 'Meet Your AI Assistant',
    description: 'Don\'t want to type? Tap the chatbot icon to log expenses using your voice or natural language.',
    color: 'bg-brand-green'
  },
  {
    icon: <LineChart className="w-12 h-12 text-white" />,
    title: 'Track Everything',
    description: 'Your dashboard automatically categorizes your spending. Tap on any chart to see detailed insights.',
    color: 'bg-indigo-500'
  }
];

export default function TutorialOverlay({ onComplete }: TutorialOverlayProps) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < TUTORIAL_STEPS.length - 1) {
      setStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        <motion.div 
          key={step}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white dark:bg-[#111111] w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl relative"
        >
          <button 
            onClick={onComplete}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          <div className={`h-40 ${TUTORIAL_STEPS[step].color} flex items-center justify-center`}>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md"
            >
              {TUTORIAL_STEPS[step].icon}
            </motion.div>
          </div>

          <div className="p-8 text-center">
            <h2 className="text-xl font-black text-brand-blue dark:text-white mb-3 tracking-tight">
              {TUTORIAL_STEPS[step].title}
            </h2>
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 leading-relaxed mb-8">
              {TUTORIAL_STEPS[step].description}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {TUTORIAL_STEPS.map((_, idx) => (
                  <div 
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      step === idx ? 'w-6 bg-brand-blue dark:bg-white' : 'w-1.5 bg-neutral-200 dark:bg-[#222222]'
                    }`}
                  />
                ))}
              </div>

              <button 
                onClick={handleNext}
                className="bg-brand-blue dark:bg-white text-white dark:text-brand-blue px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-brand-blue/20 dark:shadow-white/10"
              >
                {step === TUTORIAL_STEPS.length - 1 ? 'Got it!' : 'Next'}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
