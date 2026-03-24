import { useState } from 'react';
import { useLocation, Link, Outlet } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Landmark, PieChart, Target, Calculator, MessageSquareText, Settings, Plus, MoreHorizontal, BookOpen, FileText } from 'lucide-react';

import { cn } from '../lib/utils';


export default function Layout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const mainNavItems = [
    { name: 'Home', path: '/', icon: LayoutDashboard },
    { name: 'Transactions', path: '/transactions', icon: BarChart3 },
    { name: 'Accounts', path: '/accounts', icon: Landmark },
  ];

  const moreNavItems = [
    { name: 'Summary', path: '/summary', icon: PieChart },
    { name: 'Budgets', path: '/budgets', icon: Target },
    { name: 'Accounting', path: '/accounting', icon: Calculator },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Ledger', path: '/ledger', icon: BookOpen },
    { name: 'Parse SMS', path: '/parse', icon: MessageSquareText },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];
e repository

  const allNavItems = [...mainNavItems, ...moreNavItems];

  return (
    <div className="flex h-screen bg-white dark:bg-[#060608] flex-col md:flex-row overflow-hidden">

      {/* Mobile Header Removed as per user request */}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex bg-white dark:bg-[#0C0C0F] border-r border-[#EBEBEB] dark:border-[#1A1A1E] flex-col w-64 shrink-0 z-20">
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {allNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-blue/5 dark:bg-brand-blue/20 text-brand-blue dark:text-[#F7F7F7]'
                    : 'text-brand-blue/60 dark:text-[#A0A0A0] hover:bg-brand-blue/5 dark:hover:bg-[#15151A] hover:text-brand-blue dark:hover:text-[#F7F7F7]'

                )}
              >
                <Icon className={cn('w-5 h-5', isActive ? 'text-brand-blue dark:text-[#F7F7F7]' : 'text-brand-blue/40 dark:text-[#55555E]')} />


                {item.name}
              </Link>
            );
          })}

          <Link
            to="/?add=true"
            className="mt-6 flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium bg-brand-green text-white shadow-lg shadow-brand-green/20 hover:bg-brand-green/90 hover:ring-2 hover:ring-brand-cyan transition-all transform active:scale-95"

          >
            <Plus className="w-5 h-5" />
            Add Transaction
          </Link>

        </nav>
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
                  isActive ? 'text-brand-blue dark:text-[#F7F7F7]' : 'text-brand-blue/50 dark:text-[#A0A0A0] hover:text-brand-blue dark:hover:text-[#F7F7F7]'
                )}

              >
                <Icon className={cn('w-6 h-6', isActive ? 'text-brand-blue dark:text-[#F7F7F7]' : 'text-brand-blue/30 dark:text-[#55555E]')} />

                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}

          {/* Central Add Button */}
          <div className="flex-1 flex justify-center -translate-y-4">
            <Link
              to="/?add=true"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-14 h-14 bg-brand-green rounded-full flex items-center justify-center text-white shadow-[0_4px_20px_rgba(0,168,107,0.4)] border-4 border-white dark:border-[#0C0C0F] transition-transform active:scale-90 hover:ring-2 hover:ring-brand-cyan"

              aria-label="Add Transaction"
            >
              <Plus className="w-7 h-7" />
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
                  isActive ? 'text-brand-blue dark:text-[#F7F7F7]' : 'text-brand-blue/50 dark:text-[#A0A0A0] hover:text-brand-blue dark:hover:text-[#F7F7F7]'
                )}

              >
                <Icon className={cn('w-6 h-6', isActive ? 'text-brand-blue dark:text-[#F7F7F7]' : 'text-brand-blue/30 dark:text-[#55555E]')} />

                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}

          {/* More Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full space-y-1',
              isMobileMenuOpen || moreNavItems.some(item => location.pathname === item.path)
                ? 'text-brand-blue dark:text-[#F7F7F7]'
                : 'text-brand-blue/50 dark:text-[#A0A0A0]'
            )}
          >
            <MoreHorizontal className={cn('w-6 h-6', isMobileMenuOpen || moreNavItems.some(item => location.pathname === item.path) ? 'text-brand-blue dark:text-[#F7F7F7]' : 'text-brand-blue/30 dark:text-[#55555E]')} />
            <span className="text-[10px] font-medium">More</span>
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
            <div className="w-12 h-1.5 bg-neutral-200 dark:bg-white/10 rounded-full mx-auto mb-4" />
            <h3 className="text-xs font-heading font-semibold text-brand-blue/60 dark:text-[#A0A0A0] uppercase tracking-[0.2em] mb-4 px-2">Options</h3>

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
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-blue/5 dark:bg-brand-blue/20 text-brand-blue dark:text-[#F7F7F7]'
                        : 'text-brand-blue/60 dark:text-[#A0A0A0] hover:bg-neutral-50 dark:hover:bg-[#15151A] hover:text-brand-blue dark:hover:text-[#F7F7F7]'
                    )}

                  >
                    <Icon className={cn('w-5 h-5', isActive ? 'text-brand-blue dark:text-[#F7F7F7]' : 'text-brand-blue/30 dark:text-[#55555E]')} />

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
