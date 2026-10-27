'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Checkbox } from '@/components/Checkbox';
import {
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
} from '@/components/icons';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('ana.souza@nexo.com.br');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
    <main className="min-h-screen lg:grid lg:grid-cols-[minmax(0,800px)_minmax(0,1fr)]">
      <section className="flex min-h-[420px] flex-col justify-between overflow-hidden bg-ink px-10 pb-12 pt-10 text-white lg:min-h-screen lg:px-16 lg:pb-12 lg:pt-10">
        <div className="animate-rise">
          <Logo variant="light" size={24} />
        </div>

        <div className="mt-10 flex flex-col gap-9 animate-rise lg:mt-0">
          <div className="flex max-w-xl flex-col gap-[18px]">
            <p className="text-[13.5px] font-medium text-white/55">
              Service desk de TI da Nexo
            </p>
            <h1 className="font-display text-[42px] leading-[56px] tracking-[-1.2px] md:text-[54px] md:leading-[56px]">
              Seu problema de TI, resolvido em uma conversa.
            </h1>
            <p className="max-w-[520px] text-base leading-[25px] text-white/65">
              Descreva o que está acontecendo. O assistente consulta seus chamados, busca na
              central de ajuda e chama um analista quando precisa.
            </p>
          </div>

          <div className="w-full lg:pl-24">
            <div className="flex max-w-[500px] flex-col gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-[18px]">
              <div className="flex justify-end">
                <div className="rounded-[12px_12px_4px_12px] bg-paper px-3.5 py-2 text-[13.5px] text-ink">
                  Meu notebook não conecta na VPN. Erro 809.
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                  <span className="font-semibold text-white/80">Nexo Assist</span>
                  <span className="font-normal text-white/45">
                    consultou seus chamados · criou um chamado
                  </span>
                </div>
                <div className="max-w-[380px] rounded-[4px_12px_12px_12px] bg-white/[0.08] px-3.5 py-2.5 text-[13.5px] leading-5 text-white">
                  Pronto: abri o chamado com prioridade alta. Um analista fala com você em até 4 h
                  úteis.
                </div>
                <div className="inline-flex w-fit items-center gap-2 rounded-xl bg-paper px-3 py-1.5">
                  <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-warning" aria-hidden />
                  <span className="text-[12.5px] font-semibold text-ink">INC-20517</span>
                  <span className="text-[12.5px] text-ink-3">Rede e VPN · Alta · em até 4 h</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <dl className="mt-10 grid grid-cols-3 border-t border-white/10 pt-6 lg:mt-0">
          <div className="pr-6">
            <dt className="font-display text-[34px] leading-none tracking-[-0.6px] text-white">
              8 s
            </dt>
            <dd className="mt-1.5 text-[13.5px] text-white/55">primeira resposta, em média</dd>
          </div>
          <div className="border-l border-white/10 px-6">
            <dt className="font-display text-[34px] leading-none tracking-[-0.6px] text-white">
              72%
            </dt>
            <dd className="mt-1.5 text-[13.5px] text-white/55">resolvidos sem fila</dd>
          </div>
          <div className="border-l border-white/10 pl-6">
            <dt className="flex items-center gap-2 font-display text-[34px] leading-none tracking-[-0.6px] text-white">
              6
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-success"
                aria-hidden
                title="Online"
              />
            </dt>
            <dd className="mt-1.5 text-[13.5px] text-white/55">analistas online agora</dd>
          </div>
        </dl>
      </section>

      <section className="flex min-h-screen flex-col px-6 py-10 sm:px-10 lg:px-14">
        <div className="flex items-center justify-end gap-1.5 text-[13.5px]">
          <span className="text-ink-3">Problema para entrar?</span>
          <a href="tel:4000" className="font-semibold text-primary-text">
            Ligue no ramal 4000
          </a>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <form onSubmit={onSubmit} className="w-full max-w-[380px] animate-rise space-y-7">
            <div className="space-y-2">
              <h2 className="font-display text-[40px] leading-[44px] tracking-[-0.8px] text-ink">
                Entrar
              </h2>
              <p className="text-[15.5px] leading-[23px] text-ink-3">
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
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-md text-ink-3 hover:bg-desk"
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

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full shadow-cta text-[15.5px]"
              trailingIcon={loading ? null : <ArrowRightIcon />}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>

            <Link href="/chat" className="sr-only">
              Chat
            </Link>
          </form>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-ink-3">
          <span>© 2026 Nexo · Service desk de TI</span>
          <span>Privacidade e uso de dados</span>
        </footer>
      </section>
    </main>
  );
}
