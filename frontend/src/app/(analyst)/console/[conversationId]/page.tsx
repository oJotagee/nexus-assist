import type { Metadata } from 'next';
import { Suspense } from 'react';

import { ConsoleConversationView } from './_components/console-conversation-view';
import { getConsoleConversation } from '../_data-access/console';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Conversa' };

type PageProps = { params: Promise<{ conversationId: string }> };

export default function ConsoleConversationPage({ params }: PageProps) {
  return (
    <Suspense fallback={<ConversationSkeleton />}>
      <ConversationContent params={params} />
    </Suspense>
  );
}

async function ConversationContent({ params }: PageProps) {
  const { conversationId } = await params;
  const [session, conversation] = await Promise.all([
    auth(),
    getConsoleConversation(conversationId),
  ]);

  return (
    <ConsoleConversationView
      key={conversation.id}
      initialConversation={conversation}
      analystId={session?.user?.id ?? ''}
    />
  );
}

function ConversationSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Carregando a conversa"
      className="flex h-full flex-1 flex-col"
    >
      <div className="flex h-14 items-center gap-3 border-b bg-white px-4">
        <Skeleton className="size-9 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-10 w-1/2 rounded-xl" />
        <Skeleton className="ml-auto h-16 w-2/3 rounded-xl" />
      </div>
    </section>
  );
}
