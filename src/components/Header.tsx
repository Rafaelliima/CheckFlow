import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Home, Moon, Sun } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from './ThemeProvider';

export function Header({ title, children }: { title: string, children?: React.ReactNode }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link to="/dashboard" className="mr-4 flex items-center gap-2 text-blue-500 hover:text-cyan-500 dark:text-blue-400 dark:hover:text-cyan-300">
              <Home className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">Início</span>
            </Link>
            <h1 className="max-w-[200px] truncate text-lg font-bold text-slate-900 sm:max-w-md sm:text-xl dark:text-slate-100">{title}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {children}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-cyan-300"
              aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <button
              onClick={handleLogout}
              className="hidden items-center gap-2 rounded-md border border-transparent bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:flex"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-md p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-cyan-300 sm:hidden"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-base font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-cyan-300"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
