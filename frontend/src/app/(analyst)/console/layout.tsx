import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

import { ConsoleShell } from './_components/console-shell';
import { SIDEBAR_COOKIE } from '@/lib/sidebar-cookie';
import { auth } from '@/lib/auth';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  if (!session?.user || session.user.role !== 'ANALYST') redirect('/login');

  return (
    <ConsoleShell
      analyst={{
        id: session.user.id,
        name: session.user.name ?? '',
        supportLevel: session.user.supportLevel,
      }}
      initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value !== 'expanded'}
    >
      {children}
    </ConsoleShell>
  );
}
