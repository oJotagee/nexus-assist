import { redirect } from 'next/navigation';

import { EmployeeSidebar } from './_components/employee-sidebar';
import { auth } from '@/lib/auth';

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <EmployeeSidebar user={{ name: session.user.name ?? '', email: session.user.email ?? '' }} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
