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
    <nav className="bg-white shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-900 mr-4 flex items-center gap-2">
              <Home className="w-5 h-5" />
              <span className="hidden sm:inline font-medium">Início</span>
            </Link>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate max-w-[200px] sm:max-w-md">{title}</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {children}
            <button
              onClick={handleLogout}
              className="hidden sm:flex px-4 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-gray-200 bg-white">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 flex items-center gap-2"
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
