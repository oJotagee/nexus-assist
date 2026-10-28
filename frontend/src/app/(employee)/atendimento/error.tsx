'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

export default function AtendimentoError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid flex-1 place-items-center px-6">
      <div role="alert" className="max-w-sm text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-danger-soft text-danger">
          <AlertCircle className="size-5" />
        </span>
        <h1 className="mt-4 font-serif text-2xl">Não foi possível abrir o atendimento</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button className="mt-5" onClick={reset}>
          <RefreshCw /> Tentar novamente
        </Button>
      </div>
    </div>
  );
}
