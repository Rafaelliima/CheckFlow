import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, CheckCircle2, AlertTriangle } from 'lucide-react';
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
    <nav className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 shadow-lg shadow-black/20 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between sm:h-16">
          <div className="flex min-w-0 flex-1 items-center">
            <Link to="/dashboard" className="group mr-3 flex shrink-0 items-center gap-2.5 sm:mr-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-950/40 transition group-hover:shadow-indigo-500/30">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </span>
              <span className="hidden font-bold tracking-tight text-slate-50 sm:inline">CheckFlow</span>
            </Link>
            <div className="min-w-0 flex-1 truncate border-l border-white/10 pl-3 text-sm leading-none sm:max-w-md sm:pl-4 sm:text-base">
              <span className="inline-block max-w-[60vw] truncate align-bottom font-medium text-slate-300 sm:max-w-none">{title}</span>
            </div>
          </div>

          <div className="ml-2 flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              to="/divergentes"
              className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition sm:inline-flex ${
                divergentItemsCount > 0
                  ? 'border-red-900/50 bg-red-950/30 text-red-200 hover:bg-red-950/50'
                  : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'
              }`}
            >
              <AlertTriangle className={`h-4 w-4 ${divergentItemsCount > 0 ? 'text-red-400' : 'text-slate-500'}`} />
              <span>Divergentes</span>
              {divergentItemsCount > 0 && (
                <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-500/20 px-1.5 py-0.5 text-xs font-semibold text-red-200">
                  {divergentItemsCount}
                </span>
              )}
            </Link>
            {children}
            <div
              className="hidden h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 text-xs font-semibold text-indigo-200 ring-1 ring-white/10 sm:inline-flex"
              title={userEmail || 'Usuário'}
              aria-label={`Avatar de ${userEmail || 'usuário'}`}
            >
              {userInitials}
            </div>
            <button
              onClick={handleLogout}
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] sm:flex"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
            <div className="sm:hidden">
              {mobileStatusIndicator}
            </div>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-full p-2 text-slate-300 transition hover:bg-white/[0.06] hover:text-indigo-300 sm:hidden"
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            >
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-white/5 bg-slate-950/95 backdrop-blur-md sm:hidden">
          <div className="space-y-1 px-2 pb-3 pt-2">
            <Link
              to="/divergentes"
              onClick={() => setMenuOpen(false)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-base font-medium text-slate-100 transition hover:bg-white/[0.06] hover:text-indigo-300"
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
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-base font-medium text-slate-100 transition hover:bg-white/[0.06] hover:text-indigo-300"
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
