import { Headset } from 'lucide-react';
import type { Metadata } from 'next';

import { NexoLogo } from '@/components/nexo-logo';
import { signOutAction } from '../../(employee)/_actions/sign-out';

export const metadata: Metadata = { title: 'Console do analista' };

/** Placeholder até o M5 (console do analista). A API do console já está pronta no assist. */
export default function ConsolePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6">
      <div className="max-w-sm text-center">
        <NexoLogo className="justify-center" />
        <span className="mx-auto mt-8 grid size-12 place-items-center rounded-full bg-accent text-primary">
          <Headset className="size-5" />
        </span>
        <h1 className="mt-4 font-serif text-2xl">Console do analista</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A lista de conversas e o atendimento assumido chegam no próximo marco.
        </p>
        <form action={signOutAction} className="mt-6">
          <button type="submit" className="text-sm font-medium text-primary hover:underline">
            Sair
          </button>
        </form>
      </div>
    </main>
  );
}
