import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';

const SLIDES = [
  {
    id: 1,
    title: 'Welcome to Expensify',
    description: 'The most elegant way to track your personal finances, completely re-imagined for modern life.',
    icon: <Wallet className="w-16 h-16 text-brand-blue" />
  },
  {
    id: 2,
    title: 'Your Data, Secured',
    description: 'We use military-grade local encryption and lightning-fast cloud sync to ensure your data is always safe and private.',
    icon: <ShieldCheck className="w-16 h-16 text-brand-green" />
  },
  {
    id: 3,
    title: 'AI Powered Insights',
    description: 'Just chat or speak with our integrated AI to log expenses or analyze your spending habits effortlessly.',
    icon: <Sparkles className="w-16 h-16 text-brand-blue" />
  }
];

export default function Welcome() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      navigate('/setup-account');
    }
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-6 z-[200] antialiased">
      <div className="flex-1 w-full max-w-sm flex flex-col items-center justify-center relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center text-center w-full"
          >
            <div className="w-32 h-32 mb-8 bg-neutral-50 rounded-[40px] flex items-center justify-center shadow-xl border border-neutral-100">
              {SLIDES[currentSlide].icon}
            </div>
            
            <h1 className="text-3xl font-black text-brand-blue mb-4 tracking-tight">
              {SLIDES[currentSlide].title}
            </h1>
            
            <p className="text-sm font-medium text-brand-blue/60 leading-relaxed px-4">
              {SLIDES[currentSlide].description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="w-full max-w-sm pb-12 pt-6">
        <div className="flex items-center justify-center gap-2 mb-10">
          {SLIDES.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1.5 rounded-full transition-all duration-300 ${
                currentSlide === idx 
                  ? 'w-8 bg-brand-blue' 
                  : 'w-2 bg-brand-blue/10'
              }`} 
            />
          ))}
        </div>

        <button 
          onClick={handleNext}
          className="w-full bg-brand-blue hover:bg-brand-blue/90 text-white h-14 rounded-2xl font-black text-[13px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl shadow-brand-blue/20"
        >
          {currentSlide === SLIDES.length - 1 ? 'Get Started' : 'Next'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
