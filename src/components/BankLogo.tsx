import React from 'react';
import { getBankByPattern } from './BankLogosData';

interface BankLogoProps {
  bankName: string;
  className?: string;
}

export const BankLogo: React.FC<BankLogoProps> = ({ bankName, className = "w-5 h-5" }) => {
  const detectedBank = getBankByPattern(bankName);
  
  if (detectedBank) {
    const LogoComponent = detectedBank.logo;
    return <LogoComponent className={`${className} object-contain`} />;
  }

  return (
    <div className={`${className} bg-black/20 dark:bg-white/10 rounded-lg flex items-center justify-center text-[11px] font-bold text-[#717171] dark:text-[#A0A0A5] uppercase tracking-wider`}>
      {bankName.substring(0, 2)}
    </div>
  );
};
