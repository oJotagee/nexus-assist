import { config } from 'dotenv';

config({
  path: process.cwd().replaceAll('\\', '/').endsWith('/services/tickets')
    ? '.env'
    : 'services/tickets/.env',
});

import { PrismaPg } from '@prisma/adapter-pg';

import {
  PrismaClient,
  type TicketCategory,
  type TicketImpact,
  type TicketPriority,
  type TicketStatus,
  type TicketType,
  type TicketUpdateAuthor,
  type TicketUpdateKind,
} from '../generated/prisma/client';

const now = Date.now();
const ago = ({ days = 0, hours = 0, minutes = 0 }) =>
  new Date(now - ((days * 24 + hours) * 60 + minutes) * 60 * 1000);

type SeedUpdate = {
  kind: TicketUpdateKind;
  author: TicketUpdateAuthor;
  authorName?: string;
  body: string;
  at: Date;
};

type SeedTicket = {
  id: string;
  type: TicketType;
  requesterId: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  impact: TicketImpact;
  status: TicketStatus;
  assignedGroup: string | null;
  assigneeName?: string;
  createdAt: Date;
  resolvedAt?: Date;
  updates: SeedUpdate[];
};

const created = (at: Date): SeedUpdate => ({
  kind: 'CREATED',
  author: 'REQUESTER',
  body: 'Chamado aberto.',
  at,
});

const TICKETS: SeedTicket[] = [
  {
    id: 'INC-20311',
    type: 'INC',
    requesterId: 'emp_ana',
    title: 'Notebook lento após atualização do Windows',
    description:
      'Lentidão geral desde a atualização do Windows. Reiniciar e rodar o Windows Update até o fim não resolveu. Consegue trabalhar, mas programas demoram vários minutos para abrir.',
    category: 'HARDWARE',
    priority: 'MEDIUM',
    impact: 'SELF',
    status: 'WAITING_ANALYST',
    assignedGroup: 'Suporte N1',
    createdAt: ago({ days: 10, hours: 2 }),
    updates: [
      created(ago({ days: 10, hours: 2 })),
      {
        kind: 'COMMENT',
        author: 'ANALYST',
        authorName: 'Marcos Vieira',
        body: 'Pedi para rodar o diagnóstico de disco pelo portal. Aguardando retorno.',
        at: ago({ days: 8 }),
      },
      {
        kind: 'COMMENT',
        author: 'REQUESTER',
        body: 'Rodei o diagnóstico, não apontou erro. Continua lento.',
        at: ago({ days: 6 }),
      },
    ],
  },
  {
    id: 'INC-20299',
    type: 'INC',
    requesterId: 'emp_ana',
    title: 'Acesso à pasta Financeiro no SharePoint',
    description:
      'Sem permissão para abrir a pasta Financeiro/Fechamento no SharePoint depois da mudança de equipe.',
    category: 'ACCESS',
    priority: 'MEDIUM',
    impact: 'SELF',
    status: 'IN_PROGRESS',
    assignedGroup: 'Suporte N1',
    assigneeName: 'Júlia Castro',
    createdAt: ago({ days: 3 }),
    updates: [
      created(ago({ days: 3 })),
      {
        kind: 'COMMENT',
        author: 'ANALYST',
        authorName: 'Júlia Castro',
        body: 'Solicitei a aprovação do dono da pasta.',
        at: ago({ days: 1 }),
      },
    ],
  },
  {
    id: 'REQ-10442',
    type: 'REQ',
    requesterId: 'emp_ana',
    title: 'Segundo monitor para home office',
    description: 'Pedido de um segundo monitor de 24" para o home office.',
    category: 'HARDWARE',
    priority: 'LOW',
    impact: 'SELF',
    status: 'APPROVED',
    assignedGroup: 'Suporte N1',
    createdAt: ago({ days: 12 }),
    updates: [
      created(ago({ days: 12 })),
      {
        kind: 'STATUS_CHANGED',
        author: 'ANALYST',
        authorName: 'Júlia Castro',
        body: 'Aprovado pelo gestor. Entrega agendada com a logística.',
        at: ago({ days: 5 }),
      },
    ],
  },
  {
    id: 'INC-20150',
    type: 'INC',
    requesterId: 'emp_ana',
    title: 'Senha do SAP bloqueada',
    description: 'Senha do SAP bloqueada após tentativas erradas; autoatendimento não liberou.',
    category: 'ACCESS',
    priority: 'MEDIUM',
    impact: 'SELF',
    status: 'RESOLVED',
    assignedGroup: 'Suporte N1',
    assigneeName: 'Marcos Vieira',
    createdAt: ago({ days: 6 }),
    resolvedAt: ago({ days: 4 }),
    updates: [
      created(ago({ days: 6 })),
      {
        kind: 'STATUS_CHANGED',
        author: 'ANALYST',
        authorName: 'Marcos Vieira',
        body: 'Senha desbloqueada e nova senha temporária enviada por SMS.',
        at: ago({ days: 4 }),
      },
    ],
  },
  {
    id: 'INC-19870',
    type: 'INC',
    requesterId: 'emp_ana',
    title: 'Outlook não sincroniza no celular',
    description: 'E-mails não chegam no app Outlook do celular.',
    category: 'EMAIL',
    priority: 'LOW',
    impact: 'SELF',
    status: 'RESOLVED',
    assignedGroup: 'Suporte N1',
    createdAt: ago({ days: 22 }),
    resolvedAt: ago({ days: 20 }),
    updates: [
      created(ago({ days: 22 })),
      {
        kind: 'STATUS_CHANGED',
        author: 'ANALYST',
        authorName: 'Júlia Castro',
        body: 'Conta removida e adicionada novamente no app. Sincronizando.',
        at: ago({ days: 20 }),
      },
    ],
  },
  {
    id: 'INC-19802',
    type: 'INC',
    requesterId: 'emp_ana',
    title: 'Troca de senha da rede',
    description: 'Senha da rede expirou fora do expediente.',
    category: 'ACCESS',
    priority: 'LOW',
    impact: 'SELF',
    status: 'CLOSED',
    assignedGroup: 'Suporte N1',
    createdAt: ago({ days: 42 }),
    resolvedAt: ago({ days: 41 }),
    updates: [
      created(ago({ days: 42 })),
      {
        kind: 'STATUS_CHANGED',
        author: 'SYSTEM',
        body: 'Fechado automaticamente após a resolução.',
        at: ago({ days: 41 }),
      },
    ],
  },

  {
    id: 'INC-20330',
    type: 'INC',
    requesterId: 'emp_carla',
    title: 'Sem acesso ao SAP — fechamento de pedidos hoje',
    description:
      'Erro de autorização ao entrar no SAP. Precisa fechar os pedidos do trimestre até as 17h.',
    category: 'ACCESS',
    priority: 'HIGH',
    impact: 'SELF',
    status: 'WAITING_ANALYST',
    assignedGroup: 'Suporte N2',
    createdAt: ago({ minutes: 40 }),
    updates: [
      created(ago({ minutes: 40 })),
      {
        kind: 'TRANSFERRED',
        author: 'AGENT',
        body: 'Transferido para Suporte N2. Compromisso hoje às 17h; erro de autorização persiste após desbloqueio.',
        at: ago({ minutes: 25 }),
      },
    ],
  },
  {
    id: 'INC-20321',
    type: 'INC',
    requesterId: 'emp_bruno',
    title: 'VPN caindo durante reuniões',
    description: 'A VPN desconecta a cada 20 minutos, principalmente em chamadas de vídeo.',
    category: 'NETWORK_VPN',
    priority: 'HIGH',
    impact: 'SELF',
    status: 'OPEN',
    assignedGroup: 'Suporte N1',
    createdAt: ago({ hours: 2 }),
    updates: [created(ago({ hours: 2 }))],
  },
  {
    id: 'REQ-10501',
    type: 'REQ',
    requesterId: 'emp_diego',
    title: 'Licença do Power BI Pro',
    description: 'Licença do Power BI Pro para publicar os painéis de operação.',
    category: 'SOFTWARE',
    priority: 'LOW',
    impact: 'SELF',
    status: 'OPEN',
    assignedGroup: 'Suporte N1',
    createdAt: ago({ days: 2 }),
    updates: [created(ago({ days: 2 }))],
  },
  {
    id: 'INC-20318',
    type: 'INC',
    requesterId: 'emp_elisa',
    title: 'Impressora do RH sem conexão',
    description: 'A impressora do 3º andar não aparece para ninguém do RH.',
    category: 'HARDWARE',
    priority: 'HIGH',
    impact: 'TEAM',
    status: 'IN_PROGRESS',
    assignedGroup: 'Suporte N1',
    assigneeName: 'Marcos Vieira',
    createdAt: ago({ hours: 5 }),
    updates: [created(ago({ hours: 5 }))],
  },
  {
    id: 'INC-20325',
    type: 'INC',
    requesterId: 'emp_gabriela',
    title: 'Wi-Fi instável na sala de reunião 3',
    description: 'Conexão cai na sala 3; outras salas normais.',
    category: 'NETWORK_VPN',
    priority: 'MEDIUM',
    impact: 'TEAM',
    status: 'RESOLVED',
    assignedGroup: 'Suporte N1',
    createdAt: ago({ days: 1, hours: 4 }),
    resolvedAt: ago({ hours: 20 }),
    updates: [
      created(ago({ days: 1, hours: 4 })),
      {
        kind: 'STATUS_CHANGED',
        author: 'ANALYST',
        authorName: 'Júlia Castro',
        body: 'Access point da sala 3 substituído.',
        at: ago({ hours: 20 }),
      },
    ],
  },
];

const SEQUENCES: Record<TicketType, number> = { INC: 20341, REQ: 10502 };

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    if (process.env.SEED_IF_EMPTY === 'true' && (await prisma.ticketSequence.count()) > 0) {
      console.log('Banco já populado; seed ignorado.');
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.ticketUpdate.deleteMany();
      await tx.ticket.deleteMany();
      await tx.idempotencyRecord.deleteMany();
      await tx.ticketSequence.deleteMany();

      await tx.ticketSequence.createMany({
        data: Object.entries(SEQUENCES).map(([type, next]) => ({ type: type as TicketType, next })),
      });

      for (const { updates, ...ticket } of TICKETS) {
        const lastUpdateAt = updates.at(-1)?.at ?? ticket.createdAt;

        await tx.ticket.create({
          data: {
            ...ticket,
            assigneeName: ticket.assigneeName ?? null,
            resolvedAt: ticket.resolvedAt ?? null,
            lastUpdateAt,
            updates: {
              create: updates.map(({ at, ...update }) => ({ ...update, createdAt: at })),
            },
          },
        });
      }
    });

    console.log(`Seed concluído: ${TICKETS.length} chamados.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
