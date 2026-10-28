import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { ConsoleConversationDto, TicketSummaryDto } from '@nexo/shared';
import { screen, waitFor } from '@testing-library/react';

import { buildConsoleConversation, buildTrace } from '../support/builders';
import { resetNextMocks, toast } from '../support/next';
import { renderWithProviders } from '../support/render';

type Result = { data?: ConsoleConversationDto; error?: string; code?: string | null };

const changeConversationState = mock(
  async (_input: { conversationId: string; action: string }): Promise<Result> => ({}),
);
const sendAnalystMessage = mock(
  async (_input: { conversationId: string; text: string }): Promise<Result> => ({}),
);
const getConsoleConversation = mock(
  async (): Promise<ConsoleConversationDto> => buildConsoleConversation(),
);
const getEmployeeTickets = mock(async (): Promise<TicketSummaryDto[]> => []);

mock.module('@/app/(analyst)/console/_actions/conversation-actions', () => ({
  changeConversationState,
  sendAnalystMessage,
}));
mock.module('@/app/(analyst)/console/_data-access/console', () => ({
  getConsoleConversation,
  getEmployeeTickets,
  listConsoleConversations: mock(async () => ({
    items: [],
    counts: { all: 0, waiting: 0, agent: 0, mine: 0 },
  })),
}));
mock.module('@/app/_data-access/get-decision-trace', () => ({
  getDecisionTrace: mock(async () => buildTrace()),
}));

const { ConsoleConversationView } = await import(
  '@/app/(analyst)/console/[conversationId]/_components/console-conversation-view'
);

describe('ConsoleConversationView', () => {
  beforeEach(() => {
    resetNextMocks();
    changeConversationState.mockClear();
    sendAnalystMessage.mockClear();
    getConsoleConversation.mockImplementation(async () => buildConsoleConversation());
  });

  it('conversa na fila: mostra o resumo da transferência e as ações de handoff', () => {
    renderWithProviders(
      <ConsoleConversationView
        initialConversation={buildConsoleConversation()}
        analystId="emp_rafael"
      />,
    );

    expect(screen.getByText('Resumo da transferência')).toBeInTheDocument();
    expect(screen.getByText(/INC-20311 vencido há 6 dias/)).toBeInTheDocument();
    expect(screen.getByText('Ana espera um atendente')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Mensagem para Ana/)).not.toBeInTheDocument();
  });

  it('Assumir atendimento pausa o agent e libera a resposta', async () => {
    const assumed = buildConsoleConversation({
      state: 'WITH_ANALYST',
      assignedAnalyst: { id: 'emp_rafael', name: 'Rafael Lima', supportLevel: 'N2' },
    });
    changeConversationState.mockImplementationOnce(async () => {
      getConsoleConversation.mockImplementation(async () => assumed);
      return { data: assumed };
    });
    const { user } = renderWithProviders(
      <ConsoleConversationView
        initialConversation={buildConsoleConversation()}
        analystId="emp_rafael"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Assumir atendimento/ }));

    await waitFor(() =>
      expect(changeConversationState).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        action: 'assume',
      }),
    );
    expect(await screen.findByLabelText('Mensagem para Ana')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Encerrar atendimento/ })).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Atendimento assumido. O agent está pausado.');
  });

  it('o analista responde pelo composer', async () => {
    const assumed = buildConsoleConversation({
      state: 'WITH_ANALYST',
      assignedAnalyst: { id: 'emp_rafael', name: 'Rafael Lima', supportLevel: 'N2' },
    });
    sendAnalystMessage.mockImplementationOnce(async () => ({ data: assumed }));
    getConsoleConversation.mockImplementation(async () => assumed);
    const { user } = renderWithProviders(
      <ConsoleConversationView initialConversation={assumed} analystId="emp_rafael" />,
    );

    await user.type(
      screen.getByLabelText('Mensagem para Ana'),
      'Oi, Ana! Vou verificar o driver de vídeo.{Enter}',
    );

    await waitFor(() =>
      expect(sendAnalystMessage).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        text: 'Oi, Ana! Vou verificar o driver de vídeo.',
      }),
    );
  });

  it('conversa assumida por outro analista fica só para leitura', () => {
    const otherAnalyst = buildConsoleConversation({
      state: 'WITH_ANALYST',
      assignedAnalyst: { id: 'emp_julia', name: 'Júlia Castro', supportLevel: 'N1' },
    });
    getConsoleConversation.mockImplementation(async () => otherAnalyst);
    renderWithProviders(
      <ConsoleConversationView initialConversation={otherAnalyst} analystId="emp_rafael" />,
    );

    expect(screen.getByText('Júlia Castro está atendendo esta conversa.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Encerrar atendimento/ })).not.toBeInTheDocument();
  });

  it('erro na ação aparece para o analista', async () => {
    changeConversationState.mockImplementationOnce(async () => ({
      error: 'Outro analista já assumiu esta conversa.',
    }));
    const { user } = renderWithProviders(
      <ConsoleConversationView
        initialConversation={buildConsoleConversation()}
        analystId="emp_rafael"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Assumir atendimento/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Outro analista já assumiu esta conversa.'),
    );
  });
});
