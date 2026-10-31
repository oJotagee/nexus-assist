'use client';

import { MessageSquare, UserRound } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';

const NAV = [
  { href: '/atendimento', label: 'Atendimento', icon: MessageSquare },
  { href: '/perfil', label: 'Meu perfil', icon: UserRound },
];

export function EmployeeSidebar({
  user,
  initialCollapsed,
}: {
  user: { name: string; email: string };
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();

  return (
    <AppSidebar
      items={NAV.map((item) => ({ ...item, active: pathname.startsWith(item.href) }))}
      user={{ name: user.name, detail: user.email }}
      initialCollapsed={initialCollapsed}
    />
  );
}
