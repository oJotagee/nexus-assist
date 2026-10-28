'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function ConsoleConversationError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="grid h-full flex-1 place-items-center px-6">
      <div role="alert" className="max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-danger-soft text-danger">
          <AlertCircle className="size-5" />
        </span>
        <h2 className="mt-4 font-serif text-2xl">Não foi possível abrir a conversa</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="outline" render={<Link href="/console" />}>
            Voltar
          </Button>
          <Button onClick={reset}>
            <RefreshCw /> Tentar novamente
          </Button>
        </div>
      </div>
    </div>
  );
}
