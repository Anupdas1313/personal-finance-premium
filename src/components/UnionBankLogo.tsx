import React from 'react';

export const UnionBankLogo = ({ className = "w-full h-full object-contain" }: { className?: string }) => (
  <img 
    src="https://upload.wikimedia.org/wikipedia/en/thumb/7/7b/Union_Bank_of_India_Logo.svg/512px-Union_Bank_of_India_Logo.svg.png" 
    alt="Union Bank" 
    className={className} 
    referrerPolicy="no-referrer" 
  />
);
