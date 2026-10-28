import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { ConsoleShell } from './_components/console-shell';

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
