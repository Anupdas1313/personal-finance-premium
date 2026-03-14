import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListOrdered, Wallet, PieChart, MessageSquareText, Calculator, Menu, X, MoreHorizontal, Settings, Target, Plus } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const mainNavItems = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Transactions', path: '/transactions', icon: ListOrdered },
    { name: 'Accounts', path: '/accounts', icon: Wallet },
  ];

  const moreNavItems = [
    { name: 'Summary', path: '/summary', icon: PieChart },
    { name: 'Budgets', path: '/budgets', icon: Target },
    { name: 'Accounting', path: '/accounting', icon: Calculator },
    { name: 'Parse SMS', path: '/parse', icon: MessageSquareText },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const allNavItems = [...mainNavItems, ...moreNavItems];

  return (
    <div className="flex h-screen bg-[#F7F7F7] dark:bg-[#060608] flex-col md:flex-row overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-white dark:bg-[#0C0C0F] p-4 border-b border-[#EBEBEB] dark:border-[#1A1A1E] shrink-0 z-20 relative">
        <h1 className="text-xl font-bold text-[#222222] dark:text-[#F7F7F7] flex items-center gap-2">
          <Wallet className="text-[#222222] dark:text-[#F7F7F7]" />
          Anup's Personal Expenses
        </h1>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex bg-white dark:bg-[#0C0C0F] border-r border-[#EBEBEB] dark:border-[#1A1A1E] flex-col w-64 shrink-0 z-20">
        <div className="p-6 border-b border-[#EBEBEB] dark:border-[#1A1A1E]">
          <h1 className="text-xl font-bold text-[#222222] dark:text-[#F7F7F7] flex items-center gap-2">
            <Wallet className="text-[#222222] dark:text-[#F7F7F7]" />
            Anup's Personal Expenses
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-neutral-100 dark:bg-[#15151A] text-[#222222] dark:text-[#F7F7F7]'
                    : 'text-[#717171] dark:text-[#A0A0A0] hover:bg-neutral-50 dark:hover:bg-[#15151A] hover:text-[#222222] dark:hover:text-[#F7F7F7]'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive ? 'text-[#222222] dark:text-[#F7F7F7]' : 'text-[#B0B0B0] dark:text-[#55555E]')} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-[#EBEBEB] dark:border-[#1A1A1E]">
          <Link
            to="/?add=true"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#222222] dark:bg-[#F7F7F7] text-white dark:text-[#111111] rounded-xl font-bold hover:bg-black dark:hover:bg-neutral-200 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Add Transaction
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full relative z-0">
        <div className="max-w-5xl mx-auto p-4 md:p-8 pb-24 md:pb-8 min-h-full">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#0C0C0F] border-t border-[#EBEBEB] dark:border-[#1A1A1E] pb-safe z-50">
        <nav className="flex items-center justify-between px-2 h-16 relative">
          {mainNavItems.slice(0, 2).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full space-y-1',
                  isActive ? 'text-[#222222] dark:text-[#F7F7F7]' : 'text-[#717171] dark:text-[#A0A0A0] hover:text-[#222222] dark:hover:text-[#F7F7F7]'
                )}
              >
                <Icon className={cn('w-6 h-6', isActive ? 'text-[#222222] dark:text-[#F7F7F7]' : 'text-[#B0B0B0] dark:text-[#55555E]')} />
                <span className="text-[10px] font-semibold">{item.name}</span>
              </Link>
            );
          })}
          
          {/* Floating Add Button Wrapper */}
          <div className="flex-1 flex justify-center h-full items-start">
            <Link
              to="/?add=true"
              className="absolute -top-5 w-14 h-14 bg-gradient-to-tr from-[#3B3B98] to-[#6C6CF0] text-white rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-[#0C0C0F] transform hover:scale-105 active:scale-95 transition-all outline-none"
            >
              <Plus className="w-6 h-6" />
            </Link>
          </div>

          {mainNavItems.slice(2).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full space-y-1',
                  isActive ? 'text-[#222222] dark:text-[#F7F7F7]' : 'text-[#717171] dark:text-[#A0A0A0] hover:text-[#222222] dark:hover:text-[#F7F7F7]'
                )}
              >
                <Icon className={cn('w-6 h-6', isActive ? 'text-[#222222] dark:text-[#F7F7F7]' : 'text-[#B0B0B0] dark:text-[#55555E]')} />
                <span className="text-[10px] font-semibold">{item.name}</span>
              </Link>
            );
          })}
          
          {/* More Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full space-y-1',
              isMobileMenuOpen || moreNavItems.some(item => location.pathname === item.path)
                ? 'text-[#222222] dark:text-[#F7F7F7]' 
                : 'text-[#717171] dark:text-[#A0A0A0] hover:text-[#222222] dark:hover:text-[#F7F7F7]'
            )}
          >
            <MoreHorizontal className={cn('w-6 h-6', isMobileMenuOpen || moreNavItems.some(item => location.pathname === item.path) ? 'text-[#222222] dark:text-[#F7F7F7]' : 'text-[#B0B0B0] dark:text-[#55555E]')} />
            <span className="text-[10px] font-semibold">More</span>
          </button>
        </nav>
      </div>

      {/* Mobile More Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
          <div 
            className="absolute bottom-16 left-0 right-0 bg-white dark:bg-[#0C0C0F] rounded-t-[24px] p-4 shadow-xl transform transition-transform"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-[#EBEBEB] rounded-full mx-auto mb-4" />
            <h3 className="text-sm font-bold text-[#222222] dark:text-[#F7F7F7] uppercase tracking-wider mb-3 px-2">More Options</h3>
            <div className="space-y-1">
              {moreNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-neutral-100 dark:bg-[#15151A] text-[#222222] dark:text-[#F7F7F7]'
                        : 'text-[#717171] dark:text-[#A0A0A0] hover:bg-neutral-50 dark:hover:bg-[#15151A] hover:text-[#222222] dark:hover:text-[#F7F7F7]'
                    )}
                  >
                    <Icon className={cn('w-5 h-5', isActive ? 'text-[#222222] dark:text-[#F7F7F7]' : 'text-[#B0B0B0] dark:text-[#55555E]')} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
