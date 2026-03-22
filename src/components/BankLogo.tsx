import React from 'react';
import { getBankByPattern } from './BankLogosData';
import { Banknote, CreditCard, Landmark } from 'lucide-react';

interface BankLogoProps {
  bankName: string;
  className?: string;
  type?: 'BANK' | 'CASH' | 'CREDIT_CARD';
}

export const BankLogo: React.FC<BankLogoProps> = ({ bankName, className = "w-5 h-5", type }) => {
  const detectedBank = getBankByPattern(bankName);
  
  if (detectedBank) {
    const LogoComponent = detectedBank.logo;
    return <LogoComponent className={`${className} object-contain`} />;
  }

  if (type === 'CASH') {
    return <Banknote className={`${className} text-emerald-600`} />;
  }

  if (type === 'CREDIT_CARD') {
    return <CreditCard className={`${className} text-rose-600`} />;
  }

  return (
    <div className={`${className} bg-black/20 dark:bg-white/10 rounded-lg flex items-center justify-center text-[11px] font-bold text-[#717171] dark:text-[#A0A0A5] uppercase tracking-wider`}>
      {bankName ? bankName.substring(0, 2) : <Landmark className="w-2/3 h-2/3" />}
    </div>
  );
};
