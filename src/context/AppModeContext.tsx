import React, { createContext, useContext, useState, useEffect } from 'react';

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
    // Reloading to ensure the database correctly reinitializes for the new mode and all state clears
    window.location.reload();
  };

  const toggleAppMode = () => {
    setAppMode(appMode === 'PERSONAL' ? 'BUSINESS' : 'PERSONAL');
  };

  return (
    <AppModeContext.Provider value={{ appMode, setAppMode, toggleAppMode }}>
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
