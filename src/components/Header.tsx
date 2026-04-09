import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Home, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useDivergentItems } from '../hooks/useDivergentItems';

interface HeaderProps {
  title: string;
  children?: React.ReactNode;
  mobileMenuChildren?: React.ReactNode;
  userEmail?: string;
  mobileStatusIndicator?: React.ReactNode;
}

function getUserInitials(email?: string) {
  if (!email) return '??';

  const localPart = email.split('@')[0] || '';
  const chunks = localPart.split(/[._-]+/).filter(Boolean);

  if (chunks.length >= 2) {
    return `${chunks[0][0] || ''}${chunks[1][0] || ''}`.toUpperCase();
  }

  return localPart.slice(0, 2).toUpperCase() || '??';
}

export function Header({ title, children, mobileMenuChildren, userEmail, mobileStatusIndicator }: HeaderProps) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const userInitials = getUserInitials(userEmail);
  const divergentItemsCount = useDivergentItems().length;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between sm:h-16">
          <div className="flex min-w-0 flex-1 items-center">
            <Link to="/dashboard" className="mr-2 flex shrink-0 items-center gap-2 text-blue-400 transition hover:text-cyan-300 sm:mr-4">
              <Home className="h-5 w-5" />
              <span className="hidden font-medium sm:inline">Início</span>
            </Link>
            <div className="min-w-0 flex-1 truncate text-sm font-bold leading-none sm:max-w-md sm:text-xl">
              <span className="font-semibold text-slate-100">CheckFlow</span>
              <span className="px-2 text-slate-600">/</span>
              <span className="inline-block max-w-[55vw] truncate align-bottom font-medium text-slate-400 sm:max-w-none">{title}</span>
            </div>
          </div>

          <div className="ml-2 flex shrink-0 items-center gap-2 sm:gap-4">
            <Link
              to="/divergentes"
              className="hidden items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800 sm:inline-flex"
            >
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span>Divergentes</span>
              {divergentItemsCount > 0 && (
                <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-950/60 px-1.5 py-0.5 text-xs font-semibold text-red-300">
                  {divergentItemsCount}
                </span>
              )}
            </Link>
            {children}
            <div
              className="hidden h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-cyan-300 sm:inline-flex"
              title={userEmail || 'Usuário'}
              aria-label={`Avatar de ${userEmail || 'usuário'}`}
            >
              {userInitials}
            </div>
            <button
              onClick={handleLogout}
              className="hidden items-center gap-2 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700 sm:flex"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
            <div className="sm:hidden">
              {mobileStatusIndicator}
            </div>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-md p-2 text-slate-300 transition hover:bg-slate-800 hover:text-cyan-300 sm:hidden"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-slate-800 bg-slate-950 sm:hidden">
          <div className="space-y-1 px-2 pb-3 pt-2">
            <Link
              to="/divergentes"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-base font-medium text-slate-100 transition hover:bg-slate-800 hover:text-cyan-300"
            >
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                Divergentes
              </span>
              {divergentItemsCount > 0 && (
                <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-950/60 px-1.5 py-0.5 text-xs font-semibold text-red-300">
                  {divergentItemsCount}
                </span>
              )}
            </Link>
            {mobileMenuChildren}
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
