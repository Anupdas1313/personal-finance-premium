import React from 'react';

export const IndusIndLogo = ({ className = "w-full h-full" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="50" cy="50" r="50" fill="#A42A29" />
    <g fill="#FFFFFF" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontStyle="italic">
      <text x="16" y="48" fontSize="18" letterSpacing="-0.5">IndusInd</text>
      <text x="48" y="68" fontSize="18" letterSpacing="-0.5">Bank</text>
    </g>
  </svg>
);
