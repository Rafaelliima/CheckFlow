import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldPlus, Sparkles } from 'lucide-react';
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
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-12 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/60 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="order-2 p-8 sm:p-10 lg:order-1">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.25em] text-indigo-600 dark:text-cyan-300">
                CheckFlow
              </p>
              <h2 className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-slate-50">
                Criar nova conta
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Cadastre-se para iniciar inspeções, registrar itens e acompanhar o progresso em um único fluxo.
              </p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleRegister}>
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                  Conta criada com sucesso! Verifique seu email para confirmar o cadastro ou faça login.
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label htmlFor="email-address" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Email
                  </label>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Senha
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    placeholder="Crie uma senha segura"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl border border-transparent bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus:ring-offset-slate-900"
                >
                  {loading ? 'Criando conta...' : 'Cadastrar'}
                </button>
              </div>

              <div className="text-center text-sm text-slate-600 dark:text-slate-400">
                Já tem uma conta?{' '}
                <Link to="/" className="font-semibold text-indigo-600 transition hover:text-indigo-500 dark:text-cyan-300 dark:hover:text-cyan-200">
                  Faça login
                </Link>
              </div>
            </form>
          </div>

          <div className="order-1 flex flex-col justify-between bg-gradient-to-br from-slate-900 via-indigo-950 to-blue-950 p-10 text-white lg:order-2">
            <div>
              <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur">
                <ShieldPlus className="h-4 w-4" />
                Plataforma CheckFlow
              </div>
              <h1 className="max-w-md text-4xl font-bold leading-tight">
                Comece com um fluxo preparado para inspeções recorrentes e colaboração.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-200/90">
                Registre evidências, padronize checklists e mantenha as equipes alinhadas com dados sincronizados e fáceis de consultar.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <div className="flex items-center gap-3 text-sm font-medium">
                <Sparkles className="h-4 w-4" />
                Fluxo simples para criação e acompanhamento
              </div>
              <ul className="space-y-2 text-sm text-slate-200/85">
                <li>• Cadastro rápido para iniciar novas análises.</li>
                <li>• Operação consistente em telas claras e escuras.</li>
                <li>• Estrutura pronta para uso no campo e no escritório.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
