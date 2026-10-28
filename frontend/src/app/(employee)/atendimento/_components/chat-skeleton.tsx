import { Skeleton } from '@/components/ui/skeleton';

export function ChatSkeleton() {
  return (
    <section className="flex-1 overflow-hidden" aria-busy="true" aria-label="Carregando a conversa">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <Skeleton className="ml-auto h-11 w-2/3 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-20 w-4/5 rounded-xl" />
        </div>
        <Skeleton className="ml-auto h-11 w-1/2 rounded-xl" />
        <Skeleton className="h-44 w-4/5 rounded-xl" />
      </div>
    </section>
  );
}
