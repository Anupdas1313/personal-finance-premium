import React from 'react';

const BANK_LOGOS: Record<string, string> = {
  'SBI': 'https://upload.wikimedia.org/wikipedia/commons/c/cc/State_Bank_of_India_logo.svg',
  'HDFC': 'https://upload.wikimedia.org/wikipedia/commons/2/28/HDFC_Bank_Logo.svg',
  'ICICI': 'https://upload.wikimedia.org/wikipedia/commons/1/12/ICICI_Bank_Logo.svg',
  'Axis': 'https://upload.wikimedia.org/wikipedia/commons/a/ae/Axis_Bank_logo.svg',
  'Kotak': 'https://upload.wikimedia.org/wikipedia/commons/5/52/Kotak_Mahindra_Bank_logo.svg',
  'IndusInd': 'https://v.fastcdn.co/u/4f5f5f5f/52671231-0-IndusInd-Bank-Logo.png',
  'Union Bank': 'https://upload.wikimedia.org/wikipedia/commons/6/62/Union_Bank_of_India_Logo.svg',
  'IDFC First': 'https://upload.wikimedia.org/wikipedia/commons/3/36/IDFC_First_Bank_logo.svg',
  'PNB': 'https://upload.wikimedia.org/wikipedia/commons/2/2a/Punjab_National_Bank_logo.svg',
  'Bank of Baroda': 'https://upload.wikimedia.org/wikipedia/commons/5/5b/Bank_of_Baroda_Logo.svg',
};

interface BankLogoProps {
  bankName: string;
  className?: string;
}

export const BankLogo: React.FC<BankLogoProps> = ({ bankName, className = "w-5 h-5" }) => {
  const normalizedName = Object.keys(BANK_LOGOS).find(key => 
    bankName.toLowerCase().includes(key.toLowerCase())
  );
  
  const logoUrl = normalizedName ? BANK_LOGOS[normalizedName] : null;

  if (logoUrl) {
    return <img src={logoUrl} alt={bankName} className={`${className} object-contain`} />;
  }

  return (
    <div className={`${className} bg-white/10 rounded-lg flex items-center justify-center text-[10px] font-bold text-[#A0A0A5]`}>
      {bankName.substring(0, 2).toUpperCase()}
    </div>
  );
};
