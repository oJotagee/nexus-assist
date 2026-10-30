import type { Metadata } from 'next';
import { Suspense } from 'react';

import { getActiveConversation } from './_data-access/get-active-conversation';
import { EmployeeTopbar } from '../_components/employee-topbar';
import { ChatSkeleton } from './_components/chat-skeleton';
import { ChatView } from './_components/chat-view';
import { auth } from '@/lib/auth';

export const metadata: Metadata = { title: 'Atendimento' };

export default function AtendimentoPage() {
  return (
    <Suspense
      fallback={
        <>
          <EmployeeTopbar title="Atendimento" />
          <ChatSkeleton />
        </>
      }
    >
      <AtendimentoContent />
    </Suspense>
  );
}

async function AtendimentoContent() {
  const [session, conversation] = await Promise.all([auth(), getActiveConversation()]);
  const firstName = session?.user?.name?.split(' ')[0] ?? '';

  return <ChatView initialConversation={conversation} firstName={firstName} />;
}
