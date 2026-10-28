import { beforeEach, describe, expect, it, mock } from 'bun:test';
import type { DecisionTraceDto } from '@nexo/shared';
import { screen } from '@testing-library/react';

import { buildTrace } from '../support/builders';
import '../support/next';
import { renderWithProviders } from '../support/render';

const getDecisionTrace = mock(
  async (_messageId: string): Promise<DecisionTraceDto> => buildTrace(),
);
mock.module('@/app/_data-access/get-decision-trace', () => ({ getDecisionTrace }));

const { AgentActionTrail } = await import('@/components/conversation/agent-action-trail');
const { DecisionPanel } = await import('@/components/conversation/decision-panel');
const { QuickReplies } = await import('@/app/(employee)/atendimento/_components/quick-replies');

describe('AgentActionTrail', () => {
  it('mostra as ações acima da resposta e abre o detalhe da decisão', async () => {
    const onOpenDetails = mock(() => undefined);
    const { user } = renderWithProviders(
      <AgentActionTrail
        steps={[
          { id: 's1', label: 'consultou seus chamados', status: 'OK', attempts: 1 },
          { id: 's2', label: 'consultou o INC-20311', status: 'RETRIED', attempts: 3 },
        ]}
        confidence={{ score: 0.92, band: 'HIGH' }}
        onOpenDetails={onOpenDetails}
      />,
    );

    expect(screen.getByRole('button', { name: /consultou seus chamados/ })).toBeInTheDocument();
    expect(screen.getByText('consultou o INC-20311 (3 tentativas)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Por quê\? 92%/ }));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it('enquanto a resposta chega, as ações não são clicáveis', () => {
    renderWithProviders(
      <AgentActionTrail
        steps={[{ id: 's1', label: 'buscou na central de ajuda', status: 'RUNNING', attempts: 0 }]}
      />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('buscou na central de ajuda')).toBeInTheDocument();
  });
});

describe('DecisionPanel', () => {
  beforeEach(() => getDecisionTrace.mockClear());

  it('mostra o que entendeu, a ação, a segurança, o porquê e os passos', async () => {
    renderWithProviders(<DecisionPanel messageId="msg-1" onOpenChange={() => undefined} />);

    expect(await screen.findByText('Quer o status do INC-20311.')).toBeInTheDocument();
    expect(getDecisionTrace).toHaveBeenCalledWith('msg-1');
    expect(screen.getByText('Consulta de chamado')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Segurança da decisão' })).toHaveAttribute(
      'aria-valuenow',
      '92',
    );
    expect(screen.getByText('Anexo A · Transferência: chamados vencidos')).toBeInTheDocument();
    expect(screen.getByText(/2 tentativas \(sistema de chamados instável\)/)).toBeInTheDocument();
    expect(screen.getByText(/2\.310 tokens de entrada/)).toBeInTheDocument();
  });

  it('avisa quando a segurança está abaixo do limite de transferência', async () => {
    getDecisionTrace.mockImplementationOnce(async () =>
      buildTrace({ confidence: { score: 0.45, band: 'LOW' } }),
    );
    renderWithProviders(<DecisionPanel messageId="msg-2" onOpenChange={() => undefined} />);

    expect(await screen.findByText(/Abaixo de 60%/)).toBeInTheDocument();
  });

  it('mostra o erro com opção de tentar de novo', async () => {
    getDecisionTrace.mockImplementationOnce(async () => {
      throw new Error('Detalhe da decisão não encontrado.');
    });
    renderWithProviders(<DecisionPanel messageId="msg-3" onOpenChange={() => undefined} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Detalhe da decisão não encontrado.',
    );
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});

describe('QuickReplies', () => {
  it('envia a opção escolhida', async () => {
    const onSelect = mock((_option: string) => undefined);
    const { user } = renderWithProviders(
      <QuickReplies
        question="Quem está sendo afetado?"
        options={['Só eu', 'Minha equipe']}
        answered={null}
        disabled={false}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Minha equipe' }));
    expect(onSelect).toHaveBeenCalledWith('Minha equipe');
  });

  it('depois de respondida, marca a escolha e trava as opções', () => {
    renderWithProviders(
      <QuickReplies
        question="Quem está sendo afetado?"
        options={['Só eu', 'Minha equipe']}
        answered="Só eu"
        disabled={false}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'Só eu' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Minha equipe' })).toBeDisabled();
  });
});
