import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-950/50">
            <CheckCircle2 className="h-6 w-6" />
          </span>
          <p className="text-sm font-medium uppercase tracking-[0.25em] text-indigo-300">CheckFlow</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-50">Criar conta</h1>
          <p className="mt-1 text-sm text-slate-400">Comece a organizar suas rondas</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          {error && <div className="rounded-xl border border-red-900/50 bg-red-950/40 p-3 text-center text-sm text-red-300">{error}</div>}
          {success && <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-3 text-center text-sm text-emerald-300">Conta criada com sucesso! Verifique seu email para confirmar o cadastro ou faça login.</div>}

          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="mb-2 block text-sm font-medium text-slate-200">Email</label>
              <input id="email-address" name="email" type="email" autoComplete="email" required className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" placeholder="voce@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">Senha</label>
              <input id="password" name="password" type="password" autoComplete="new-password" required className="block w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20" placeholder="Crie uma senha segura" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-transparent bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:from-indigo-400 hover:to-violet-500 disabled:opacity-50">
            {loading ? 'Criando conta...' : 'Cadastrar'}
          </button>

          <div className="text-center text-sm text-slate-400">
            Já tem uma conta?{' '}
            <Link to="/" className="font-semibold text-indigo-300 transition hover:text-indigo-200">
              Faça login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
