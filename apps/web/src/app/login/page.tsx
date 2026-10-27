'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('ana.souza@nexo.com.br');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotHint, setForgotHint] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { user } = await api.login(email, password, rememberMe);
      router.replace(user.role === 'analyst' ? '/console' : '/chat');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative overflow-hidden bg-navy-900 text-white px-10 py-14 lg:px-16 lg:py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(47,111,237,0.35),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.08),transparent_40%)]" />
        <div className="relative max-w-xl animate-rise">
          <p className="text-sm uppercase tracking-[0.22em] text-white/70">Nexo Assist</p>
          <h1 className="mt-8 font-display text-4xl leading-tight md:text-5xl">
            Seu problema de TI, resolvido em uma conversa.
          </h1>
          <p className="mt-6 text-lg text-white/75">
            Service desk conversacional com regras determinísticas de prioridade, prazo e
            confirmação antes de qualquer escrita em chamado.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-3xl bg-white p-8 shadow-panel animate-rise"
        >
          <h2 className="font-display text-3xl text-navy-900">Entrar</h2>
          <p className="mt-2 text-sm text-navy-700/70">Use um e-mail de demonstração semeado.</p>

          <label className="mt-8 block text-sm font-medium text-navy-800">
            E-mail
            <input
              className="mt-2 w-full rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 outline-none focus:border-accent"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-navy-800">
            Senha
            <input
              className="mt-2 w-full rounded-xl border border-mist-200 bg-mist-50 px-4 py-3 outline-none focus:border-accent"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          <label className="mt-4 flex items-center gap-2 text-sm text-navy-700">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Manter conectado
          </label>

          {error ? (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <button
            type="button"
            className="mt-4 text-sm text-accent underline"
            onClick={() => setForgotHint(true)}
          >
            Esqueci minha senha
          </button>

          {forgotHint ? (
            <p className="mt-3 text-sm text-navy-700/80">
              Em demonstração, qualquer senha não vazia funciona para os e-mails semeados. Não há
              fluxo real de recuperação.
            </p>
          ) : null}

          <p className="mt-8 text-xs text-navy-700/60">
            Exemplos: <code>ana.souza@nexo.com.br</code> (funcionário) ·{' '}
            <code>rafael.lima@nexo.com.br</code> (analista)
          </p>
          <Link href="/chat" className="sr-only">
            Chat
          </Link>
        </form>
      </section>
    </main>
  );
}
