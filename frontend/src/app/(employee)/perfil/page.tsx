import type { Metadata } from 'next';
import { Suspense } from 'react';

import { EmployeeTopbar } from '../_components/employee-topbar';
import { PasswordCard } from './_components/password-card';
import { getProfile } from './_data-access/get-profile';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Meu perfil' };

export default function ProfilePage() {
  return (
    <>
      <EmployeeTopbar title="Meu perfil" />
      <main className="flex-1 overflow-y-auto px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-xl">
          <h1 className="font-serif text-3xl">Meu perfil</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seus dados de acesso ao service desk de TI.
          </p>
          <Suspense fallback={<ProfileSkeleton />}>
            <ProfileContent />
          </Suspense>
        </div>
      </main>
    </>
  );
}

async function ProfileContent() {
  const profile = await getProfile();
  const changedDaysAgo = Math.max(
    Math.floor((Date.now() - new Date(profile.passwordChangedAt).getTime()) / 86_400_000),
    0,
  );

  return (
    <div className="mt-6 space-y-4">
      <dl className="divide-y overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-[140px_1fr] items-center gap-4 px-5 py-4 text-sm">
          <dt className="text-muted-foreground">Nome</dt>
          <dd className="font-medium">{profile.name}</dd>
        </div>
        <div className="grid grid-cols-[140px_1fr] items-center gap-4 px-5 py-4 text-sm">
          <dt className="text-muted-foreground">E-mail corporativo</dt>
          <dd className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{profile.email}</span>
            <span className="text-xs text-muted-foreground">Gerenciado pela TI</span>
          </dd>
        </div>
        <div className="grid grid-cols-[140px_1fr] items-center gap-4 px-5 py-4 text-sm">
          <dt className="text-muted-foreground">Área</dt>
          <dd className="font-medium">{profile.department}</dd>
        </div>
      </dl>

      <PasswordCard email={profile.email} changedDaysAgo={changedDaysAgo} />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mt-6 space-y-4" aria-busy="true">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}
