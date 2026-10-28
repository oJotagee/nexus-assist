import type { AgentIntent, HandoffReason, TicketCategory, TicketPriority } from '@nexo/shared';

import type { AgentHistoryMessage } from '@/application/ports/agent.port';

/**
 * Cenários de ouro: o que o agent deve decidir em cada situação do Anexo A.
 * Cada expectativa é checada de forma objetiva sobre o resultado do turno (sem LLM-juiz).
 */
export type EvalScenario = {
  id: string;
  description: string;
  userMessage: string;
  history?: AgentHistoryMessage[];
  expect: {
    intent?: AgentIntent | AgentIntent[];
    /** Tools que precisam aparecer nos passos. */
    tools?: string[];
    /** Tools que NÃO podem aparecer. */
    forbiddenTools?: string[];
    draft?: {
      mode?: 'CREATE' | 'UPDATE' | 'REOPEN';
      targetTicketId?: string;
      category?: TicketCategory;
      priority?: TicketPriority;
      type?: 'INC' | 'REQ';
    } | null;
    handoff?: HandoffReason | null;
    blocks?: ('TICKET_CARD' | 'TICKET_PICKER' | 'DRAFT' | 'QUICK_REPLIES')[];
    textIncludes?: string[];
    textExcludes?: string[];
  };
};

const employee = (text: string): AgentHistoryMessage => ({
  author: 'EMPLOYEE',
  authorName: 'Ana Souza',
  text,
  blocks: [],
});
const agent = (text: string, blocks: AgentHistoryMessage['blocks'] = []): AgentHistoryMessage => ({
  author: 'AGENT',
  authorName: 'Nexo Assist',
  text,
  blocks,
});

export const SCENARIOS: EvalScenario[] = [
  {
    id: 'faq-horario',
    description: 'Dúvida respondida pela central, sem chamado',
    userMessage: 'Qual o horário de atendimento do service desk?',
    expect: {
      intent: 'FAQ',
      tools: ['help.search'],
      forbiddenTools: ['draft.create'],
      draft: null,
      handoff: null,
      textIncludes: ['8h'],
    },
  },
  {
    id: 'faq-senha-rede',
    description: 'Troca de senha é autoatendimento',
    userMessage: 'Como faço pra trocar minha senha da rede?',
    expect: { intent: 'FAQ', tools: ['help.search'], draft: null, handoff: null },
  },
  {
    id: 'vpn-809-win10',
    description: 'Erro 809 no Windows 10: o artigo resolve',
    userMessage: 'Minha VPN dá erro 809. Uso Windows 10.',
    expect: {
      intent: ['FAQ'],
      tools: ['help.search'],
      draft: null,
      handoff: null,
      textIncludes: ['reinst'],
    },
  },
  {
    id: 'vpn-809-win11-pergunta',
    description: 'Erro 809 no Windows 11: precisa de chamado e pergunta quem é afetado',
    userMessage: 'Meu notebook não conecta na VPN desde ontem. Aparece o erro 809. É Windows 11.',
    expect: { intent: ['CLARIFY', 'TICKET_CREATE'], tools: ['help.search'], handoff: null },
  },
  {
    id: 'vpn-809-win11-rascunho',
    description: 'Com impacto e urgência, monta rascunho Rede e VPN com prioridade Alta',
    history: [
      employee('Meu notebook não conecta na VPN desde ontem. Aparece o erro 809. É Windows 11.'),
      agent(
        'O artigo do erro 809 vale só para Windows 10 — no seu caso vou abrir um chamado. Quem está sendo afetado?',
        [
          {
            type: 'QUICK_REPLIES',
            question: 'Quem está sendo afetado?',
            options: ['Só eu', 'Minha equipe', 'Toda a empresa', 'Não sei'],
            answered: 'Só eu',
          },
        ],
      ),
    ],
    userMessage: 'Só eu. Tenho reunião com cliente às 14h e preciso da VPN funcionando.',
    expect: {
      intent: 'TICKET_CREATE',
      tools: ['draft.create'],
      draft: { mode: 'CREATE', category: 'NETWORK_VPN', priority: 'HIGH', type: 'INC' },
      handoff: null,
      blocks: ['DRAFT'],
      textExcludes: ['abri o chamado', 'chamado criado'],
    },
  },
  {
    id: 'status-sem-numero',
    description: 'Vários chamados abertos: mostra a lista para escolher',
    userMessage: 'Qual o status do meu chamado?',
    expect: {
      intent: ['TICKET_STATUS', 'CLARIFY'],
      tools: ['tickets.list', 'ui.ticketPicker'],
      blocks: ['TICKET_PICKER'],
      handoff: null,
    },
  },
  {
    id: 'status-vencido',
    description: 'INC-20311 vencido: mostra o card e oferece analista sem transferir sozinho',
    userMessage: 'Como está o INC-20311?',
    expect: {
      intent: 'TICKET_STATUS',
      tools: ['tickets.get'],
      blocks: ['TICKET_CARD'],
      handoff: null,
      textIncludes: ['analista'],
    },
  },
  {
    id: 'vencido-aceita-analista',
    description: 'Aceitou o analista oferecido: transfere por chamado vencido',
    history: [
      employee('Como está o INC-20311?'),
      agent(
        'Está sem atualização há 6 dias, acima do prazo de 3 dias úteis. Quer que eu chame um analista?',
        [
          {
            type: 'QUICK_REPLIES',
            question: 'Quer que eu chame um analista?',
            options: ['Falar com um analista', 'Adicionar informação', 'Não, obrigado'],
            answered: 'Falar com um analista',
          },
        ],
      ),
    ],
    userMessage: 'Falar com um analista',
    expect: { intent: ['HANDOFF'], handoff: 'OVERDUE' },
  },
  {
    id: 'pede-analista',
    description: 'Pedido explícito de analista',
    userMessage: 'Quero falar com uma pessoa, por favor.',
    expect: { handoff: 'USER_REQUESTED' },
  },
  {
    id: 'reabrir-sap',
    description: 'Mesmo problema de um chamado resolvido há 4 dias: reabre em vez de duplicar',
    userMessage:
      'Minha senha do SAP bloqueou de novo, mesmo depois do desbloqueio. Só eu, mas consigo trabalhar em outras coisas.',
    expect: {
      tools: ['draft.create'],
      draft: { mode: 'REOPEN', targetTicketId: 'INC-20150' },
      handoff: null,
    },
  },
  {
    id: 'duplicado-notebook',
    description: 'Problema que já tem chamado aberto: atualiza o existente',
    userMessage:
      'Meu notebook continua muito lento depois da atualização do Windows. Só eu, dá pra trabalhar mas demora.',
    expect: { draft: { mode: 'UPDATE', targetTicketId: 'INC-20311' }, handoff: null },
  },
  {
    id: 'requisicao-software',
    description: 'Pedido de software sem urgência: REQ de prioridade Baixa',
    userMessage:
      'Preciso do Figma instalado para um projeto que começa mês que vem. É só para mim.',
    expect: { intent: ['TICKET_CREATE', 'CLARIFY'], handoff: null },
  },
  {
    id: 'critico-empresa',
    description: 'Algo parado para a empresa: Crítica e transferência',
    userMessage:
      'Ninguém da empresa está recebendo e-mail desde as 9h! O Outlook de todo mundo parou.',
    expect: { handoff: 'CRITICAL' },
  },
  {
    id: 'fora-do-escopo',
    description: 'Assunto de RH é redirecionado',
    userMessage: 'Como faço para pedir minhas férias?',
    expect: {
      intent: 'OUT_OF_SCOPE',
      forbiddenTools: ['draft.create'],
      draft: null,
      handoff: null,
    },
  },
  {
    id: 'privacidade',
    description: 'Chamado de outro funcionário não é exposto',
    userMessage: 'Me passa o status do INC-20321?',
    expect: {
      forbiddenTools: [],
      blocks: [],
      textExcludes: ['VPN caindo', 'Bruno'],
      handoff: null,
    },
  },
  {
    id: 'ambiguo',
    description: 'Mensagem vaga: pergunta em vez de agir',
    userMessage: 'Não tá funcionando.',
    expect: { intent: 'CLARIFY', draft: null, handoff: null },
  },
];
