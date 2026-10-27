'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type User } from '@/lib/api';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { LockIcon } from '@/components/icons';

const roleLabel: Record<User['role'], string> = {
  employee: 'Funcionário',
  analyst: 'Analista',
};

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
      <div className="h-full min-h-0 flex-1 overflow-y-auto px-10 py-12">
        <div className="max-w-[600px] space-y-8 animate-rise">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Meu perfil</h1>
            <p className="mt-1.5 text-[14.5px] text-ink-3">
              Seus dados de acesso ao service desk de TI.
            </p>
          </div>

          <section className="overflow-hidden rounded-2xl border border-[rgba(27,36,49,0.09)] bg-paper shadow-panel">
            <div className="flex items-center gap-4 border-b border-rule px-6 py-5">
              <p className="w-40 shrink-0 text-[13.5px] text-ink-3">Nome</p>
              <p className="text-[14.5px] font-medium text-ink">{user.name}</p>
            </div>
            <div className="flex items-center gap-4 border-b border-rule px-6 py-5">
              <p className="w-40 shrink-0 text-[13.5px] text-ink-3">E-mail corporativo</p>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-medium text-ink">{user.email}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
                <LockIcon width={13} height={13} />
                Gerenciado pela TI
              </span>
            </div>
            <div className="flex items-center gap-4 border-b border-rule px-6 py-5">
              <p className="w-40 shrink-0 text-[13.5px] text-ink-3">Área</p>
              <p className="text-[14.5px] font-medium text-ink">{user.area}</p>
            </div>
            <div className="flex items-center gap-4 px-6 py-5">
              <p className="w-40 shrink-0 text-[13.5px] text-ink-3">Papel</p>
              <p className="text-[14.5px] font-medium text-ink">{roleLabel[user.role]}</p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[rgba(27,36,49,0.09)] bg-paper shadow-panel">
            <div className="flex items-center gap-4 px-6 py-5">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">Senha</p>
                <p className="mt-1 text-[13.5px] text-ink-3">
                  A edição de perfil e redefinição de senha ficam fora do escopo desta
                  demonstração.
                </p>
              </div>
              <Button type="button" variant="secondary" disabled className="h-9 shrink-0">
                Redefinir senha
              </Button>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
