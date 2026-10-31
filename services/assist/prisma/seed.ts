import { config } from 'dotenv';

config({
  path: process.cwd().replaceAll('\\', '/').endsWith('/services/assist')
    ? '.env'
    : 'services/assist/.env',
});

import { SEED_EMPLOYEES } from '@nexo/shared/seed';
import { PrismaPg } from '@prisma/adapter-pg';

import { type MessageAuthor, type Prisma, PrismaClient } from '../generated/prisma/client';

const now = Date.now();
const ago = ({ days = 0, hours = 0, minutes = 0 }) =>
  new Date(now - ((days * 24 + hours) * 60 + minutes) * 60 * 1000);

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
    id: 'kb-senha-rede',
    title: 'Troca de senha da rede',
    body: 'A senha da rede expira a cada 90 dias. Troque pelo portal de autoatendimento (autoatendimento.nexo.com.br) com o código enviado ao celular cadastrado.',
    category: 'ACCESS',
    tags: ['senha', 'rede', 'expirada', 'autoatendimento'],
  },
  {
    id: 'kb-sap-desbloqueio',
    title: 'Desbloqueio de senha do SAP',
    body: 'Use o autoatendimento do SAP com o código do celular. Se o desbloqueio falhar 3 vezes, abra um chamado de Acesso.',
    category: 'ACCESS',
    tags: ['sap', 'senha bloqueada', 'desbloqueio'],
  },
  {
    id: 'kb-wifi',
    title: 'Wi-Fi corporativo Nexo-Corp',
    body: 'Conecte na rede Nexo-Corp com usuário e senha da rede. Se pedir certificado, aceite o "Nexo Root CA". Para reconectar, esqueça a rede e conecte de novo.',
    category: 'NETWORK_VPN',
    tags: ['wi-fi', 'wifi', 'rede sem fio', 'certificado'],
  },
  {
    id: 'kb-outlook-celular',
    title: 'Outlook não sincroniza no celular',
    body: 'Remova a conta do app Outlook e adicione de novo com o e-mail corporativo. Confirme a autenticação no Authenticator.',
    category: 'EMAIL',
    tags: ['outlook', 'celular', 'e-mail', 'sincronizar'],
  },
  {
    id: 'kb-pedido-software',
    title: 'Como pedir um software',
    body: 'Abra uma requisição com o nome do software e a justificativa. Softwares pagos precisam da aprovação do gestor.',
    category: 'SOFTWARE',
    tags: ['software', 'licença', 'instalação', 'pedido'],
  },
  {
    id: 'kb-notebook-lento',
    title: 'Notebook lento depois de atualização',
    body: 'Reinicie, rode o Windows Update até o fim e libere espaço em disco (mínimo 15 GB livres). Se continuar lento, abra um chamado de Hardware.',
    category: 'HARDWARE',
    tags: ['lento', 'lentidão', 'atualização', 'windows update', 'notebook'],
  },
];

type SeedMessage = {
  author: MessageAuthor;
  text: string;
  at: Date;
  authorId?: string;
  authorName?: string;
  blocks?: unknown[];
  trace?: {
    intent: string;
    summary: string;
    action: string;
    steps: string[];
    confidence: number;
    rationale: string;
    rules?: string[];
  };
};

type SeedConversation = {
  employeeId: string;
  state: 'AGENT' | 'WAITING_ANALYST' | 'WITH_ANALYST' | 'CLOSED';
  handoff?: {
    reason: 'USER_REQUESTED' | 'CRITICAL' | 'OVERDUE' | 'LOW_CONFIDENCE';
    summary: string;
    group: 'N1' | 'N2';
    at: Date;
  };
  focusTicketId?: string;
  resolvedByAgent?: boolean;
  messages: SeedMessage[];
};

const agent = (
  text: string,
  at: Date,
  trace: SeedMessage['trace'],
  blocks?: unknown[],
): SeedMessage => ({
  author: 'AGENT',
  authorName: 'Nexo Assist',
  text,
  at,
  trace,
  blocks,
});
const employee = (text: string, at: Date): SeedMessage => ({ author: 'EMPLOYEE', text, at });

const CONVERSATIONS: SeedConversation[] = [
  {
    employeeId: 'emp_ana',
    state: 'WAITING_ANALYST',
    focusTicketId: 'INC-20311',
    handoff: {
      reason: 'OVERDUE',
      group: 'N2',
      at: ago({ minutes: 6 }),
      summary:
        'Ana Souza (Financeiro) — INC-20311, notebook lento após atualização do Windows há 10 dias. Já reiniciou, rodou o Windows Update e o diagnóstico de disco (sem erro). Sem atualização da equipe há 6 dias: prazo de 3 dias úteis vencido. Pediu para falar com um analista.',
    },
    messages: [
      employee('Qual o status do meu chamado?', ago({ minutes: 12 })),
      agent('Você tem 3 chamados abertos. Sobre qual deles quer saber?', ago({ minutes: 12 }), {
        intent: 'TICKET_STATUS',
        summary: 'Quer saber o status de um chamado, sem informar qual.',
        action: 'Mostrou a lista para escolher',
        steps: ['consultou seus chamados'],
        confidence: 0.93,
        rationale:
          'Há mais de um chamado aberto e a mensagem não identifica qual; perguntar evita responder sobre o chamado errado.',
      }),
      employee('INC-20311 - Notebook lento após atualização', ago({ minutes: 11 })),
      agent(
        'Está sem atualização há 6 dias, acima do prazo de 3 dias úteis para prioridade média. Quer que eu chame um analista?',
        ago({ minutes: 11 }),
        {
          intent: 'TICKET_STATUS',
          summary: 'Escolheu o INC-20311.',
          action: 'Mostrou o status e ofereceu um analista',
          steps: ['consultou o INC-20311', 'calculou o prazo'],
          confidence: 0.95,
          rationale:
            'O chamado está vencido; pela regra, chamados vencidos podem ser transferidos, então ofereci um analista.',
          rules: ['Anexo A · Transferência: chamados vencidos'],
        },
      ),
      employee('Está parado há 6 dias.', ago({ minutes: 7 })),
      employee('Quero falar com um analista.', ago({ minutes: 7 })),
      agent(
        'Encaminhei para o Suporte N2. Um analista vai falar com você em até 1 hora útil.',
        ago({ minutes: 6 }),
        {
          intent: 'HANDOFF',
          summary: 'Pediu para falar com um analista sobre o INC-20311 vencido.',
          action: 'Transferiu para o Suporte N2',
          steps: ['transferiu para um analista'],
          confidence: 0.97,
          rationale: 'Pedido explícito do funcionário e chamado com prazo vencido.',
          rules: [
            'Anexo A · Transferência: quando o funcionário pede',
            'Anexo A · Transferência: chamados vencidos',
          ],
        },
      ),
      {
        author: 'SYSTEM',
        text: 'Transferida para Suporte N2 · agent pausado',
        at: ago({ minutes: 6 }),
      },
    ],
  },
  {
    employeeId: 'emp_carla',
    state: 'WAITING_ANALYST',
    focusTicketId: 'INC-20330',
    handoff: {
      reason: 'USER_REQUESTED',
      group: 'N2',
      at: ago({ minutes: 25 }),
      summary:
        'Carla Mendes (Comercial) — INC-20330, erro de autorização no SAP depois do desbloqueio. Precisa fechar os pedidos do trimestre até as 17h de hoje. Pediu um analista.',
    },
    messages: [
      employee(
        'Preciso de acesso ao SAP hoje, está dando erro de autorização.',
        ago({ minutes: 40 }),
      ),
      agent(
        'Abri o INC-20330 com prioridade alta por causa do fechamento de hoje. Quer que eu chame um analista agora?',
        ago({ minutes: 39 }),
        {
          intent: 'TICKET_CREATE',
          summary: 'Erro de autorização no SAP; compromisso hoje às 17h.',
          action: 'Abriu chamado com prioridade alta',
          steps: [
            'consultou seus chamados',
            'buscou na central de ajuda',
            'classificou a prioridade',
          ],
          confidence: 0.88,
          rationale:
            'Erro de autorização não é resolvido pelo autoatendimento; há compromisso no mesmo dia.',
          rules: ['Anexo A · Prioridade Alta: compromisso no mesmo dia'],
        },
      ),
      employee('Sim, por favor.', ago({ minutes: 26 })),
      {
        author: 'SYSTEM',
        text: 'Transferida para Suporte N2 · agent pausado',
        at: ago({ minutes: 25 }),
      },
    ],
  },
  {
    employeeId: 'emp_bruno',
    state: 'AGENT',
    focusTicketId: 'INC-20321',
    messages: [
      employee('A VPN continua caindo nas reuniões.', ago({ minutes: 52 })),
      agent(
        'Adicionei isso ao INC-20321, que já está com a equipe. Quer que eu chame um analista?',
        ago({ minutes: 51 }),
        {
          intent: 'TICKET_UPDATE',
          summary: 'VPN caindo em reuniões; já existe chamado aberto.',
          action: 'Complementou o chamado existente',
          steps: ['consultou seus chamados', 'verificou duplicidade'],
          confidence: 0.86,
          rationale:
            'Já existe chamado aberto sobre o mesmo problema; atualizar em vez de duplicar.',
          rules: ['Anexo A · Sem duplicidade'],
        },
      ),
    ],
  },
  {
    employeeId: 'emp_diego',
    state: 'AGENT',
    messages: [
      employee('Pedi a licença do Power BI, já foi aprovada?', ago({ hours: 1, minutes: 30 })),
      agent(
        'O REQ-10501 está aberto, aguardando aprovação do gestor. O prazo é de 5 dias úteis.',
        ago({ hours: 1, minutes: 29 }),
        {
          intent: 'TICKET_STATUS',
          summary: 'Status da licença do Power BI.',
          action: 'Informou o status',
          steps: ['consultou seus chamados', 'calculou o prazo'],
          confidence: 0.94,
          rationale: 'Um único chamado corresponde ao pedido.',
        },
      ),
    ],
  },
  ...(['emp_elisa', 'emp_fabio', 'emp_gabriela'] as const).map(
    (employeeId, index): SeedConversation => ({
      employeeId,
      state: 'AGENT',
      resolvedByAgent: true,
      messages: [
        employee(
          [
            'Qual o horário do service desk?',
            'Como troco minha senha da rede?',
            'O Wi-Fi da sala 3 voltou?',
          ][index] ?? '',
          ago({ hours: 2 + index }),
        ),
        agent(
          [
            'De segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas.',
            'Pelo portal de autoatendimento, com o código enviado ao seu celular. A senha expira a cada 90 dias.',
            'Sim, o INC-20325 foi resolvido ontem: o access point da sala 3 foi trocado.',
          ][index] ?? '',
          ago({ hours: 2 + index }),
          {
            intent: index === 2 ? 'TICKET_STATUS' : 'FAQ',
            summary: 'Dúvida respondida sem chamado.',
            action: index === 2 ? 'Informou o status' : 'Respondeu com a central de ajuda',
            steps: [index === 2 ? 'consultou seus chamados' : 'buscou na central de ajuda'],
            confidence: 0.96,
            rationale:
              'A resposta está na central de ajuda ou no chamado do funcionário; não é preciso abrir chamado.',
          },
        ),
        employee('Obrigado!', ago({ hours: 2 + index, minutes: -1 })),
      ],
    }),
  ),
];

function traceData(
  trace: NonNullable<SeedMessage['trace']>,
): Prisma.DecisionTraceCreateWithoutMessageInput {
  return {
    intent: trace.intent,
    understood: { summary: trace.summary, entities: {} },
    action: { type: trace.intent, label: trace.action },
    confidenceScore: trace.confidence,
    confidenceBand: trace.confidence >= 0.8 ? 'HIGH' : trace.confidence >= 0.6 ? 'MEDIUM' : 'LOW',
    rationale: trace.rationale,
    rulesApplied: trace.rules ?? [],
    steps: trace.steps.map((label, index) => ({
      id: `seed-${index}`,
      tool: 'seed',
      label,
      status: 'OK',
      attempts: 1,
      durationMs: 120 + index * 40,
    })),
    model: 'dados de exemplo',
    inputTokens: 0,
    outputTokens: 0,
    latencyMs: 900,
  };
}

/** Banco remoto (Railway) responde em dezenas de ms por comando; o padrão de 5 s do Prisma não basta. */
const SEED_TRANSACTION = { maxWait: 20_000, timeout: 120_000 };

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    if (process.env.SEED_IF_EMPTY === 'true' && (await prisma.employee.count()) > 0) {
      console.log('Banco já populado; seed ignorado.');
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.conversation.deleteMany();
      await tx.helpArticle.deleteMany();
      await tx.employee.deleteMany();

      await tx.employee.createMany({
        data: SEED_EMPLOYEES.map((person) => ({
          ...person,
          passwordChangedAt: ago({ days: 42 }),
        })),
      });
      await tx.helpArticle.createMany({ data: ARTICLES });

      for (const conversation of CONVERSATIONS) {
        const lastMessageAt = conversation.messages.at(-1)?.at ?? new Date();
        const countable = conversation.messages.filter(
          (message) => message.author === 'EMPLOYEE' || message.author === 'AGENT',
        ).length;

        const created = await tx.conversation.create({
          data: {
            employeeId: conversation.employeeId,
            state: conversation.state,
            focusTicketId: conversation.focusTicketId ?? null,
            resolvedByAgent: conversation.resolvedByAgent ?? false,
            handoffReason: conversation.handoff?.reason ?? null,
            handoffSummary: conversation.handoff?.summary ?? null,
            handoffGroup: conversation.handoff?.group ?? null,
            handoffAt: conversation.handoff?.at ?? null,
            lastMessageAt,
            createdAt: conversation.messages[0]?.at ?? new Date(),
            sessions: { create: { index: 0, messageCount: countable } },
          },
          include: { sessions: true },
        });

        const sessionId = created.sessions[0]?.id ?? '';

        for (const [position, message] of conversation.messages.entries()) {
          await tx.message.create({
            data: {
              conversationId: created.id,
              sessionId,
              author: message.author,
              authorId: message.authorId ?? null,
              authorName: message.authorName ?? null,
              text: message.text,
              blocks: (message.blocks ?? []) as Prisma.InputJsonValue,
              createdAt: new Date(message.at.getTime() + position),
              ...(message.trace ? { trace: { create: traceData(message.trace) } } : {}),
            },
          });
        }
      }
    }, SEED_TRANSACTION);

    console.log(
      `Seed concluído: ${SEED_EMPLOYEES.length} funcionários, ${ARTICLES.length} artigos, ${CONVERSATIONS.length} conversas.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
