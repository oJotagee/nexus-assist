import { describe, expect, it } from 'bun:test';

import { type DuplicateCandidate, findDuplicate } from '@/domain/policies/duplicate-detector';
import { evaluateHandoff } from '@/domain/policies/handoff-policy';
import { searchHelpArticles } from '@/domain/policies/help-search';

const ARTICLES = [
  {
    id: 'kb-vpn-809',
    title: 'VPN com erro 809',
    body: 'Reinstale o cliente de VPN pelo portal de softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado.',
    category: 'NETWORK_VPN',
    tags: ['vpn', 'erro 809', 'windows 10', 'conexão remota'],
  },
  {
    id: 'kb-horario',
    title: 'Horário do service desk',
    body: 'De segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.',
    category: 'OTHER',
    tags: ['horário', 'atendimento', 'plantão'],
  },
  {
    id: 'kb-notebook-lento',
    title: 'Notebook lento depois de atualização',
    body: 'Reinicie, rode o Windows Update até o fim e libere espaço em disco. Se continuar lento, abra um chamado de Hardware.',
    category: 'HARDWARE',
    tags: ['lento', 'lentidão', 'atualização', 'windows update', 'notebook'],
  },
];

describe('searchHelpArticles', () => {
  it.each([
    ['Meu notebook não conecta na VPN desde ontem. Aparece o erro 809.', 'kb-vpn-809'],
    ['Qual o horário de atendimento do service desk?', 'kb-horario'],
    ['O notebook ficou lento depois da atualização do Windows', 'kb-notebook-lento'],
  ])('"%s" → %s', (query, expected) => {
    expect(searchHelpArticles(ARTICLES, query)[0]?.article.id).toBe(expected);
  });

  it('não devolve nada para assunto que a central não cobre', () => {
    expect(searchHelpArticles(ARTICLES, 'Como peço reembolso de viagem?')).toEqual([]);
  });
});

describe('findDuplicate', () => {
  const tickets: DuplicateCandidate[] = [
    {
      id: 'INC-20311',
      title: 'Notebook lento após atualização do Windows',
      description: 'Lentidão geral desde a atualização do Windows.',
      category: 'HARDWARE',
      status: 'WAITING_ANALYST',
      canReopen: false,
    },
    {
      id: 'INC-20150',
      title: 'Senha do SAP bloqueada',
      description: 'Senha do SAP bloqueada após tentativas erradas.',
      category: 'ACCESS',
      status: 'RESOLVED',
      canReopen: true,
    },
    {
      id: 'INC-19870',
      title: 'Outlook não sincroniza no celular',
      description: 'E-mails não chegam no app.',
      category: 'EMAIL',
      status: 'RESOLVED',
      canReopen: false,
    },
  ];

  it('mesmo problema aberto → atualiza o chamado existente', () => {
    const match = findDuplicate(
      {
        title: 'Notebook muito lento',
        description: 'Depois da atualização do Windows o notebook ficou lento.',
        category: 'HARDWARE',
      },
      tickets,
    );

    expect(match).toMatchObject({ ticketId: 'INC-20311', mode: 'UPDATE' });
  });

  it('resolvido há até 7 dias → reabre', () => {
    const match = findDuplicate(
      {
        title: 'SAP bloqueado de novo',
        description: 'Minha senha do SAP bloqueou outra vez.',
        category: 'ACCESS',
      },
      tickets,
    );

    expect(match).toMatchObject({ ticketId: 'INC-20150', mode: 'REOPEN' });
  });

  it('resolvido há mais tempo não conta: abre um novo', () => {
    expect(
      findDuplicate(
        {
          title: 'Outlook não sincroniza no celular',
          description: 'De novo sem e-mails.',
          category: 'EMAIL',
        },
        tickets,
      ),
    ).toBeNull();
  });

  it('problema diferente na mesma categoria não é duplicado', () => {
    expect(
      findDuplicate(
        {
          title: 'Segundo monitor sem imagem',
          description: 'O monitor externo não liga.',
          category: 'HARDWARE',
        },
        tickets,
      ),
    ).toBeNull();
  });

  it('categoria diferente nunca é duplicado', () => {
    expect(
      findDuplicate(
        { title: 'Notebook lento na VPN', description: 'VPN lenta.', category: 'NETWORK_VPN' },
        tickets,
      ),
    ).toBeNull();
  });
});

describe('evaluateHandoff', () => {
  const base = {
    intent: 'TICKET_STATUS' as const,
    confidenceBand: 'HIGH' as const,
    requested: null,
    draftPriority: null,
    previousWasLowConfidenceClarify: false,
  };

  it('respeita o pedido do agent', () => {
    expect(
      evaluateHandoff({ ...base, requested: { reason: 'USER_REQUESTED', summary: 'pediu' } }),
    ).toMatchObject({ reason: 'USER_REQUESTED', group: 'N1', forcedByPolicy: false });
  });

  it('chamado vencido vai para o N2', () => {
    expect(
      evaluateHandoff({ ...base, requested: { reason: 'OVERDUE', summary: 'vencido' } })?.group,
    ).toBe('N2');
  });

  it('rascunho crítico força a transferência', () => {
    expect(evaluateHandoff({ ...base, draftPriority: 'CRITICAL' })).toMatchObject({
      reason: 'CRITICAL',
      group: 'N2',
      forcedByPolicy: true,
    });
  });

  it('baixa segurança numa ação força a transferência', () => {
    expect(evaluateHandoff({ ...base, confidenceBand: 'LOW' })?.reason).toBe('LOW_CONFIDENCE');
  });

  it('baixa segurança numa pergunta só transfere na segunda vez seguida', () => {
    const clarify = { ...base, intent: 'CLARIFY' as const, confidenceBand: 'LOW' as const };

    expect(evaluateHandoff(clarify)).toBeNull();
    expect(evaluateHandoff({ ...clarify, previousWasLowConfidenceClarify: true })?.reason).toBe(
      'LOW_CONFIDENCE',
    );
  });

  it('conversa fiada e fora do escopo nunca transferem por baixa segurança', () => {
    expect(evaluateHandoff({ ...base, intent: 'OUT_OF_SCOPE', confidenceBand: 'LOW' })).toBeNull();
  });

  it('segurança alta sem pedido não transfere', () => {
    expect(evaluateHandoff(base)).toBeNull();
  });
});
