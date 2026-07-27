import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

export type AppMode = 'PERSONAL' | 'BUSINESS';

interface AppModeContextType {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  toggleAppMode: () => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: React.ReactNode }) {
  const [appMode, setAppModeState] = useState<AppMode>(() => {
    const savedMode = localStorage.getItem('appMode');
    return (savedMode === 'BUSINESS') ? 'BUSINESS' : 'PERSONAL';
  });

  const setAppMode = (mode: AppMode) => {
    setAppModeState(mode);
    localStorage.setItem('appMode', mode);
  };

  const toggleAppMode = () => {
    setAppMode(appMode === 'PERSONAL' ? 'BUSINESS' : 'PERSONAL');
  };

  const contextValue = useMemo(() => ({
    appMode, setAppMode, toggleAppMode
  }), [appMode]);

  return (
    <AppModeContext.Provider value={contextValue}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (context === undefined) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
}
