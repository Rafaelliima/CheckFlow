import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Header({ title, children }: { title: string, children?: React.ReactNode }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link to="/dashboard" className="mr-4 flex items-center gap-2 text-blue-400 transition hover:text-cyan-300">
              <Home className="h-5 w-5" />
              <span className="hidden font-medium sm:inline">Início</span>
            </Link>
            <h1 className="max-w-[200px] truncate text-lg font-bold text-slate-100 sm:max-w-md sm:text-xl">{title}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {children}
            <button
              onClick={handleLogout}
              className="hidden items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700 sm:flex"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-md p-2 text-slate-300 transition hover:bg-slate-800 hover:text-cyan-300 sm:hidden"
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-800 bg-slate-950 sm:hidden">
          <div className="space-y-1 px-2 pb-3 pt-2">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-base font-medium text-slate-100 transition hover:bg-slate-800 hover:text-cyan-300"
            >
              <LogOut className="h-5 w-5" />
              Sair
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
