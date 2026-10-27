'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { LogOutIcon, MessageIcon, UserIcon } from '@/components/icons';
import { api, type User } from '@/lib/api';
import { cx, initials } from '@/lib/ui';

type AppShellProps = {
  user: User;
  breadcrumb: string;
  status?: ReactNode;
  children: ReactNode;
};

const nav = [
  { href: '/chat', label: 'Atendimento', icon: MessageIcon },
  { href: '/profile', label: 'Meu perfil', icon: UserIcon },
] as const;

export function AppShell({ user, breadcrumb, status, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <aside className="flex h-full w-[232px] shrink-0 flex-col border-r border-rule px-3.5 py-5">
        <div className="px-2">
          <Logo size={20} />
        </div>

        <nav className="mt-8 flex flex-col gap-0.5">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition',
                  active
                    ? 'bg-primary-soft font-semibold text-primary-text'
                    : 'font-medium text-ink-2 hover:bg-desk',
                )}
              >
                <Icon className={active ? 'text-primary-text' : 'text-ink-3'} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="flex items-center gap-2.5 px-2 py-3.5">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-text">
              {initials(user.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-ink">{user.name}</p>
              <p className="truncate text-[11.5px] text-ink-3">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            className="flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-desk"
            onClick={async () => {
              await api.logout();
              router.replace('/login');
            }}
          >
            <LogOutIcon className="text-ink-3" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-rule px-8">
          <div className="flex items-center gap-2 text-[13.5px]">
            <span className="text-ink-3">Service desk de TI</span>
            <span className="text-ink-3" aria-hidden>
              ›
            </span>
            <span className="font-semibold text-ink">{breadcrumb}</span>
          </div>
          {status}
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
