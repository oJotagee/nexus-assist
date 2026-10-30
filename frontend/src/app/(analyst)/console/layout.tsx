import { redirect } from 'next/navigation';

import { ConsoleShell } from './_components/console-shell';
import { auth } from '@/lib/auth';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ANALYST') redirect('/login');

  return (
    <ConsoleShell
      analyst={{
        id: session.user.id,
        name: session.user.name ?? '',
        supportLevel: session.user.supportLevel,
      }}
    >
      {children}
    </ConsoleShell>
  );
}
