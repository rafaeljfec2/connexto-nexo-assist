'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { MessageIcon } from '@/components/icons';
import { api, type User } from '@/lib/api';
import { initials } from '@/lib/ui';

type AnalystShellProps = {
  user: User;
  badgeCount?: number;
  children: ReactNode;
};

export function AnalystShell({ user, badgeCount = 0, children }: AnalystShellProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-16 shrink-0 flex-col items-center gap-1.5 bg-desk py-4">
        <div className="mb-2 flex h-10 w-10 items-center justify-center">
          <Logo size={22} showWordmark={false} />
        </div>
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-paper shadow-sm">
          <MessageIcon width={19} height={19} className="text-ink" />
          {badgeCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cta px-1 text-[10px] font-bold text-white">
              {badgeCount > 9 ? '9+' : badgeCount}
            </span>
          ) : null}
        </div>
        <div className="mt-auto">
          <button
            type="button"
            aria-label={`Sair (${user.name})`}
            title={`Sair (${user.name})`}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-text"
            onClick={async () => {
              await api.logout();
              router.replace('/login');
            }}
          >
            <span aria-hidden>{initials(user.name)}</span>
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-desk bg-success" />
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1">{children}</div>
    </div>
  );
}
