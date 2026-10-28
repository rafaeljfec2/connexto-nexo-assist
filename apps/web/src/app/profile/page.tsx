'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type User } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { KeyRoundIcon, LockIcon, MailIcon, RotateCcwIcon } from '@/components/icons';

/** Demo copy from Pencil frame "Cliente — Meu perfil". */
const PASSWORD_CHANGED_META = 'Alterada há 42 dias';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const me = await api.me();
        if (me.user.role === 'analyst') {
          router.replace('/console');
          return;
        }
        setUser(me.user);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Falha ao carregar perfil');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-2">
        <p className="animate-pulse-soft">Carregando perfil…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-danger-text">
          {error ?? 'Não foi possível carregar o perfil.'}
        </p>
      </div>
    );
  }

  return (
    <AppShell user={user} breadcrumb="Meu perfil">
      <div className="flex h-full min-h-0 flex-1 justify-center overflow-y-auto px-10 py-12">
        <div className="w-full max-w-[600px] space-y-8 animate-rise">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-[-0.4px] text-ink">Meu perfil</h1>
            <p className="text-[14.5px] text-ink-3">
              Seus dados de acesso ao service desk de TI.
            </p>
          </div>

          <section className="overflow-hidden rounded-2xl border border-[rgba(27,36,49,0.09)] bg-paper shadow-panel">
            <div className="flex items-center gap-4 border-b border-rule px-6 py-5">
              <p className="w-40 shrink-0 text-[13.5px] text-ink-3">Nome</p>
              <p className="text-[14.5px] font-medium text-ink">{user.name}</p>
            </div>
            <div className="flex items-center gap-4 px-6 py-5">
              <p className="w-40 shrink-0 text-[13.5px] text-ink-3">E-mail corporativo</p>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-medium text-ink">{user.email}</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-ink-3">
                <LockIcon width={13} height={13} />
                Gerenciado pela TI
              </span>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[rgba(27,36,49,0.09)] bg-paper shadow-panel">
            <div className="flex items-center gap-4 p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-desk">
                <KeyRoundIcon width={18} height={18} className="text-ink-2" />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-[14.5px] font-semibold text-ink">Senha</p>
                <p className="text-[13.5px] text-ink-3">{PASSWORD_CHANGED_META}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled
                leadingIcon={<RotateCcwIcon width={15} height={15} />}
                className="h-9 shrink-0 gap-[7px] border border-[rgba(27,36,49,0.12)] bg-paper px-3.5 text-[13.5px] font-medium text-ink-2 shadow-sm"
              >
                Redefinir senha
              </Button>
            </div>
            <div className="flex items-center gap-2 border-t border-rule bg-desk px-6 py-3">
              <MailIcon width={14} height={14} className="shrink-0 text-ink-3" />
              <p className="text-[13px] text-ink-3">
                Enviaremos um link de redefinição para {user.email}.
              </p>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
