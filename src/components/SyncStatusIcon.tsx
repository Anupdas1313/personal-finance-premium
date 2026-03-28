import React from 'react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';

interface SyncStatusIconProps {
  status?: 'synced' | 'pending' | 'error';
  className?: string;
}

export const SyncStatusIcon: React.FC<SyncStatusIconProps> = ({ status, className = "" }) => {
  switch (status) {
    case 'pending':
      return (
        <div className={`flex items-center gap-1 text-neutral-400 ${className}`} title="Saved to device (Pending Sync)">
          <Cloud className="w-3.5 h-3.5" />
        </div>
      );
    case 'error':
      return (
        <div className={`flex items-center gap-1 text-rose-500 ${className}`} title="Sync Error">
          <CloudOff className="w-3.5 h-3.5" />
        </div>
      );
    case 'synced':
      return (
        <div className={`flex items-center gap-1 text-emerald-500 dark:text-brand-cyan ${className}`} title="Synced to Cloud">
          <CheckCircle2 className="w-3.5 h-3.5 opacity-60" />
        </div>
      );
    default:
      return null;
  }
};
