import { MessagesSquare } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Console do analista' };

export default function ConsoleHome() {
  return (
    <main className="grid h-full flex-1 place-items-center px-6">
      <div className="max-w-xs text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
          <MessagesSquare className="size-5" />
        </span>
        <h2 className="mt-4 font-serif text-2xl">Escolha uma conversa</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          As conversas transferidas aparecem primeiro, com o resumo do caso e o motivo da
          transferência.
        </p>
      </div>
    </main>
  );
}
