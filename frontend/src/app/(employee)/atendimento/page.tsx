import type { Metadata } from 'next';
import { Suspense } from 'react';

import { auth } from '@/lib/auth';
import { EmployeeTopbar } from '../_components/employee-topbar';
import { ChatView } from './_components/chat-view';
import { ChatSkeleton } from './_components/chat-skeleton';
import { getActiveConversation } from './_data-access/get-active-conversation';

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
