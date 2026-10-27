'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Checkbox } from '@/components/Checkbox';
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon } from '@/components/icons';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('ana.souza@nexo.com.br');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="min-h-screen lg:grid lg:grid-cols-[800px_minmax(0,1fr)]">
      <section className="relative flex min-h-[420px] flex-col justify-between overflow-hidden bg-ink px-10 py-10 text-white lg:min-h-screen lg:px-16 lg:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(2,133,247,0.28),transparent_42%),radial-gradient(circle_at_85%_80%,rgba(255,255,255,0.06),transparent_40%)]" />
        <div className="relative animate-rise">
          <Logo variant="light" size={24} />
        </div>

        <div className="relative mt-10 max-w-xl animate-rise lg:mt-0">
          <p className="text-[13.5px] font-medium text-white/55">Service desk de TI da Nexo</p>
          <h1 className="mt-4 font-display text-[42px] leading-[1.08] tracking-[-0.02em] md:text-[54px]">
            Seu problema de TI, resolvido em uma conversa.
          </h1>
          <p className="mt-5 max-w-[520px] text-base leading-relaxed text-white/65">
            Descreva o que está acontecendo. O assistente consulta seus chamados, busca na central de
            ajuda e chama um analista quando precisa.
          </p>

          <div className="mt-9 max-w-[500px] space-y-2.5 rounded-2xl border border-white/10 bg-white/5 p-[18px]">
            <div className="ml-auto max-w-[85%] rounded-[12px_4px_12px_12px] bg-paper px-3 py-2 text-[13.5px] text-ink">
              Meu notebook não conecta na VPN. Erro 809.
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-white/80">
                Nexo Assist{' '}
                <span className="font-normal text-white/45">
                  · consultou seus chamados · criou um chamado
                </span>
              </p>
              <div className="rounded-[4px_12px_12px_12px] bg-white/10 px-3 py-2 text-[13.5px] text-white">
                Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h
                úteis.
              </div>
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-paper px-2.5 py-1.5 text-xs text-ink">
                <span className="font-semibold">INC-20517</span>
                <span className="text-ink-3">Rede e VPN · Alta · em até 4 h</span>
              </div>
            </div>
          </div>
        </div>

        <dl className="relative mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-6 lg:mt-0">
          <div>
            <dt className="font-display text-[34px] leading-none text-white">8 s</dt>
            <dd className="mt-1.5 text-[13.5px] text-white/55">primeira resposta, em média</dd>
          </div>
          <div>
            <dt className="font-display text-[34px] leading-none text-white">72%</dt>
            <dd className="mt-1.5 text-[13.5px] text-white/55">resolvidos sem fila</dd>
          </div>
          <div>
            <dt className="font-display text-[34px] leading-none text-white">6</dt>
            <dd className="mt-1.5 text-[13.5px] text-white/55">analistas online agora</dd>
          </div>
        </dl>
      </section>

      <section className="flex min-h-screen flex-col px-6 py-10 sm:px-10 lg:px-14">
        <div className="flex items-center gap-1.5 text-[13.5px]">
          <span className="text-ink-3">Problema para entrar?</span>
          <a href="tel:4000" className="font-semibold text-primary-text">
            Ligue no ramal 4000
          </a>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <form onSubmit={onSubmit} className="w-full max-w-[380px] animate-rise space-y-7">
            <div>
              <h2 className="font-display text-[40px] leading-none tracking-[-0.02em] text-ink">
                Entrar
              </h2>
              <p className="mt-2 text-[15.5px] leading-relaxed text-ink-3">
                Use seu e-mail corporativo e a senha da rede Nexo.
              </p>
            </div>

            <div className="space-y-[18px]">
              <TextField
                label="E-mail corporativo"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                prefixIcon={<MailIcon />}
              />

              <TextField
                label="Senha"
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                prefixIcon={<LockIcon className="text-primary-text" />}
                labelAction={
                  <button
                    type="button"
                    className="text-[13.5px] font-medium text-primary-text"
                    onClick={() => setForgotHint(true)}
                  >
                    Esqueci minha senha
                  </button>
                }
                suffix={
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-ink-3 hover:bg-desk"
                    aria-label={showPassword ? 'Ocultar caracteres' : 'Mostrar caracteres'}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                }
              />

              <Checkbox
                label="Manter conectado neste computador"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
            </div>

            {forgotHint ? (
              <p className="rounded-lg bg-desk px-3 py-2 text-sm text-ink-2">
                Em demonstração, qualquer senha não vazia funciona para os e-mails semeados. Não há
                fluxo real de recuperação.
              </p>
            ) : null}

            {error ? (
              <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">{error}</p>
            ) : null}

            <Button type="submit" disabled={loading} className="h-11 w-full">
              {loading ? 'Entrando…' : 'Entrar →'}
            </Button>

            <p className="text-xs text-ink-3">
              Exemplos: <code>ana.souza@nexo.com.br</code> (funcionário) ·{' '}
              <code>rafael.lima@nexo.com.br</code> (analista)
            </p>
            <Link href="/chat" className="sr-only">
              Chat
            </Link>
          </form>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-3">
          <span>© 2026 Nexo · Service desk de TI</span>
          <span>Privacidade e uso de dados</span>
        </footer>
      </section>
    </main>
  );
}
