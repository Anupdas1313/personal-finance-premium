import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AppDatePicker = ({ value, onChange, label, isOpen, onToggle }: { value: string, onChange: (val: string) => void, label: string, isOpen: boolean, onToggle: () => void }) => {
  const [currentMonth, setCurrentMonth] = useState(value ? parseISO(value) : new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  return (
    <div className="flex-1 flex flex-col relative w-full">
      <div 
        onClick={onToggle}
        className={`bg-neutral-50 dark:bg-white/5 border p-2 rounded-xl transition-all cursor-pointer ${isOpen ? 'border-brand-blue dark:border-brand-cyan shadow-sm' : 'border-neutral-200/80 dark:border-white/10'}`}
      >
        <span className="text-[8px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest block mb-1">{label}</span>
        <div className="text-[11px] font-semibold text-neutral-800 dark:text-white flex justify-between items-center">
          {value ? format(parseISO(value), 'dd MMM yyyy') : 'Select Date'}
          <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-2 p-3 bg-neutral-50 dark:bg-white/5 border border-neutral-200/80 dark:border-white/10 rounded-2xl w-full">
              <div className="flex items-center justify-between mb-3">
                <button onClick={(e) => { e.stopPropagation(); setCurrentMonth(subMonths(currentMonth, 1)); }} className="p-1 hover:bg-white dark:hover:bg-white/10 rounded-lg shadow-sm border border-transparent hover:border-neutral-200 dark:hover:border-white/10 transition-all">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-black text-brand-blue dark:text-white uppercase tracking-widest">{format(currentMonth, 'MMM yyyy')}</span>
                <button onClick={(e) => { e.stopPropagation(); setCurrentMonth(addMonths(currentMonth, 1)); }} className="p-1 hover:bg-white dark:hover:bg-white/10 rounded-lg shadow-sm border border-transparent hover:border-neutral-200 dark:hover:border-white/10 transition-all">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d} className="text-[8px] font-bold text-neutral-400 uppercase">{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isSelected = value === dateStr;
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={(e) => { e.stopPropagation(); onChange(dateStr); onToggle(); }}
                      className={`aspect-square flex items-center justify-center text-[10px] font-bold rounded-xl transition-all
                        ${isSelected ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/30 scale-105' : 
                          isCurrentMonth ? 'text-neutral-700 dark:text-neutral-300 hover:bg-white dark:hover:bg-white/10 border border-transparent hover:border-neutral-200 dark:hover:border-white/10' : 
                          'text-neutral-300 dark:text-neutral-700 opacity-50'
                        }
                        ${isToday(day) && !isSelected ? 'text-brand-blue border-brand-blue/30 bg-brand-blue/5' : ''}
                      `}
                    >
                      {format(day, 'd')}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
