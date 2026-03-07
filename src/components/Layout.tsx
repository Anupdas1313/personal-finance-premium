import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListOrdered, Wallet, PieChart, MessageSquareText, Calculator, Menu, X } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Transactions', path: '/transactions', icon: ListOrdered },
    { name: 'Accounts', path: '/accounts', icon: Wallet },
    { name: 'Accounting', path: '/accounting', icon: Calculator },
    { name: 'Summary', path: '/summary', icon: PieChart },
    { name: 'Parse SMS', path: '/parse', icon: MessageSquareText },
  ];

  return (
    <div className="flex h-screen bg-gray-50 flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-white p-4 border-b border-gray-200 shrink-0">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="text-indigo-600" />
          SMS Tracker
        </h1>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "bg-white border-r border-gray-200 flex flex-col fixed md:relative z-40 h-full w-64 transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 border-b border-gray-200 hidden md:block">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="text-indigo-600" />
            SMS Tracker
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive ? 'text-indigo-700' : 'text-gray-400')} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full">
        <div className="max-w-5xl mx-auto pb-20 md:pb-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
