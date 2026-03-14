import React from 'react';

export const SbiLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="50" cy="50" r="45" fill="#0060A9"/>
    <circle cx="50" cy="50" r="15" fill="white"/>
    <rect x="43" y="50" width="14" height="25" fill="white"/>
  </svg>
);

export const HdfcLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="100" height="100" fill="#003366"/>
    <rect x="15" y="15" width="28" height="28" fill="#ED232A"/>
    <rect x="57" y="15" width="28" height="28" fill="#003366" stroke="white" strokeWidth="6"/>
    <rect x="15" y="57" width="28" height="28" fill="#003366" stroke="white" strokeWidth="6"/>
    <rect x="57" y="57" width="28" height="28" fill="#ED232A"/>
    <path d="M 43 15 L 57 15 L 57 85 L 43 85 Z" fill="white" />
    <path d="M 15 43 L 85 43 L 85 57 L 15 57 Z" fill="white" />
  </svg>
);

export const AxisLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
    <polygon points="20,80 50,20 80,80" fill="none" stroke="#97144D" strokeWidth="12" strokeLinejoin="round"/>
    <polygon points="50,45 75,90 25,90" fill="#97144D" stroke="#97144D" strokeWidth="4" strokeLinejoin="round"/>
  </svg>
);

export const KotakLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect width="100" height="100" fill="#ED1C24" rx="20"/>
    <path d="M 30 50 C 30 30, 50 30, 50 50 C 50 70, 70 70, 70 50 C 70 30, 50 30, 50 50 C 50 70, 30 70, 30 50" fill="none" stroke="white" strokeWidth="8"/>
  </svg>
);

export const IciciLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="50" cy="30" r="12" fill="#F26522"/>
    <rect x="40" y="47" width="20" height="35" fill="#F26522" rx="2"/>
    <path d="M 20 85 Q 50 95 80 85" fill="none" stroke="#003366" strokeWidth="6" strokeLinecap="round"/>
  </svg>
);

export const PnbLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
    <circle cx="50" cy="50" r="45" fill="none" stroke="#F15A22" strokeWidth="8"/>
    <text x="50" y="66" fontFamily="Arial" fontSize="42" fontWeight="bold" fill="#F15A22" textAnchor="middle">pnb</text>
  </svg>
);

export const BobLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
    <rect x="15" y="15" width="35" height="35" fill="#F26522"/>
    <rect x="50" y="50" width="35" height="35" fill="#F26522"/>
    <circle cx="50" cy="50" r="22" fill="white"/>
    <circle cx="50" cy="50" r="10" fill="#F26522"/>
  </svg>
);

export const CanaraLogo = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" {...props}>
    <g transform="translate(10, 10) scale(0.8)">
      <polygon points="50,0 100,25 100,75 50,100 0,75 0,25" fill="#0055A5"/>
      <polygon points="50,15 85,32 85,68 50,85 15,68 15,32" fill="#F2A900"/>
    </g>
  </svg>
);

import { IndusIndLogo } from './IndusIndLogo';
import { UnionBankLogo } from './UnionBankLogo';

export const INDIAN_BANKS = [
  { id: 'SBI', name: 'State Bank of India', aliases: ['sbi', 'state bank of india', 's.b.i'], logo: SbiLogo },
  { id: 'HDFC', name: 'HDFC Bank', aliases: ['hdfc', 'hdfc bank'], logo: HdfcLogo },
  { id: 'ICICI', name: 'ICICI Bank', aliases: ['icici', 'icici bank'], logo: IciciLogo },
  { id: 'Axis', name: 'Axis Bank', aliases: ['axis', 'axis bank'], logo: AxisLogo },
  { id: 'Kotak', name: 'Kotak Mahindra', aliases: ['kotak', 'kotak mahindra'], logo: KotakLogo },
  { id: 'PNB', name: 'Punjab National Bank', aliases: ['pnb', 'punjab national'], logo: PnbLogo },
  { id: 'BOB', name: 'Bank of Baroda', aliases: ['bob', 'bank of baroda'], logo: BobLogo },
  { id: 'Canara', name: 'Canara Bank', aliases: ['canara', 'canara bank'], logo: CanaraLogo },
  { id: 'Union', name: 'Union Bank of India', aliases: ['union', 'union bank', 'ubi'], logo: UnionBankLogo },
  { id: 'IndusInd', name: 'IndusInd Bank', aliases: ['indusind', 'indus'], logo: IndusIndLogo },
];

export function getBankByPattern(input: string) {
  const normalized = input.toLowerCase().trim();
  return INDIAN_BANKS.find(bank => 
    bank.aliases.some(alias => normalized.includes(alias)) || 
    normalized.includes(bank.id.toLowerCase())
  );
}
