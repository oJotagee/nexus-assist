import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { ConversationDto } from '@nexo/shared';
import { screen, waitFor } from '@testing-library/react';

import { buildConversation, buildDraft } from '../support/builders';
import { resetNextMocks } from '../support/next';
import { renderWithProviders } from '../support/render';

type Result = { data?: ConversationDto; error?: string; code?: string | null };

const confirmDraft = mock(
  async (_ref: { conversationId: string; draftId: string }): Promise<Result> => ({}),
);
const cancelDraft = mock(
  async (_ref: { conversationId: string; draftId: string }): Promise<Result> => ({}),
);
const updateDraft = mock(async (): Promise<Result> => ({}));

mock.module('@/app/(employee)/atendimento/_actions/draft-actions', () => ({
  confirmDraft,
  cancelDraft,
  updateDraft,
}));

const { TicketDraftCard } = await import(
  '@/app/(employee)/atendimento/_components/ticket-draft-card'
);

describe('TicketDraftCard', () => {
  beforeEach(() => {
    resetNextMocks();
    confirmDraft.mockClear();
    cancelDraft.mockClear();
  });

  it('mostra o rascunho com prioridade, regra aplicada e quem é afetado', () => {
    renderWithProviders(
      <TicketDraftCard conversationId="conv-1" draft={buildDraft()} disabled={false} />,
    );

    expect(screen.getByRole('article', { name: 'Novo chamado, rascunho' })).toBeInTheDocument();
    expect(screen.getByText('Aguardando confirmação')).toBeInTheDocument();
    expect(screen.getByText('Alta: há um compromisso no mesmo dia')).toBeInTheDocument();
    expect(screen.getByText('Somente você')).toBeInTheDocument();
  });

  it('só chama a confirmação quando o funcionário clica em Confirmar', async () => {
    confirmDraft.mockImplementationOnce(async () => ({
      data: buildConversation({
        drafts: [buildDraft({ status: 'CONFIRMED', resultTicketId: 'INC-20341' })],
      }),
    }));
    const { user } = renderWithProviders(
      <TicketDraftCard conversationId="conv-1" draft={buildDraft()} disabled={false} />,
    );

    expect(confirmDraft).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    await waitFor(() =>
      expect(confirmDraft).toHaveBeenCalledWith({ conversationId: 'conv-1', draftId: 'draft-1' }),
    );
  });

  it('com o sistema de chamados instável, mantém o rascunho e oferece tentar de novo', async () => {
    confirmDraft.mockImplementationOnce(async () => ({
      error: 'O sistema de chamados está instável agora.',
      code: 'TicketsUnavailableError',
    }));
    const { user } = renderWithProviders(
      <TicketDraftCard conversationId="conv-1" draft={buildDraft()} disabled={false} />,
    );

    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('O rascunho foi mantido');
    expect(screen.getByRole('button', { name: /Tentar de novo/ })).toBeInTheDocument();
  });

  it('rascunho de atualização mostra o chamado de destino', () => {
    renderWithProviders(
      <TicketDraftCard
        conversationId="conv-1"
        draft={buildDraft({ mode: 'UPDATE', targetTicketId: 'INC-20311' })}
        disabled={false}
      />,
    );

    expect(screen.getByRole('article', { name: 'Atualizar chamado, rascunho' })).toHaveTextContent(
      'INC-20311',
    );
  });

  it('rascunho já confirmado ou descartado não tem mais ações', () => {
    renderWithProviders(
      <TicketDraftCard
        conversationId="conv-1"
        draft={buildDraft({ status: 'CONFIRMED', resultTicketId: 'INC-20341' })}
        disabled={false}
      />,
    );

    expect(screen.getByText('Confirmado')).toBeInTheDocument();
    expect(screen.getByText('INC-20341')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument();
  });

  it('Cancelar descarta o rascunho', async () => {
    cancelDraft.mockImplementationOnce(async () => ({ data: buildConversation() }));
    const { user } = renderWithProviders(
      <TicketDraftCard conversationId="conv-1" draft={buildDraft()} disabled={false} />,
    );

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(cancelDraft).toHaveBeenCalledTimes(1));
    expect(confirmDraft).not.toHaveBeenCalled();
  });
});
