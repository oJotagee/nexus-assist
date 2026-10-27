// Vocabulário do service desk (Anexo A). Os valores batem com os enums do Prisma
// nos dois serviços, então o mesmo tipo atravessa banco, API e frontend.

export const TICKET_TYPES = ['INC', 'REQ'] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  INC: 'Incidente',
  REQ: 'Requisição',
};

export const TICKET_CATEGORIES = [
  'ACCESS',
  'NETWORK_VPN',
  'HARDWARE',
  'SOFTWARE',
  'EMAIL',
  'OTHER',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  ACCESS: 'Acesso',
  NETWORK_VPN: 'Rede e VPN',
  HARDWARE: 'Hardware',
  SOFTWARE: 'Software',
  EMAIL: 'E-mail',
  OTHER: 'Outros',
};

export const TICKET_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Média',
  LOW: 'Baixa',
};

export const TICKET_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_ANALYST',
  'WAITING_REQUESTER',
  'APPROVED',
  'RESOLVED',
  'CLOSED',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em atendimento',
  WAITING_ANALYST: 'Aguardando analista',
  WAITING_REQUESTER: 'Aguardando você',
  APPROVED: 'Aprovado',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
};

/** Status em que o chamado já saiu da fila; o prazo não corre mais. */
export const TERMINAL_STATUSES: readonly TicketStatus[] = ['RESOLVED', 'CLOSED'];

/** Aguardando o próprio funcionário: o relógio do SLA fica pausado. */
export const PAUSED_STATUSES: readonly TicketStatus[] = ['WAITING_REQUESTER'];

export function isTicketOpen(status: TicketStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

export const TICKET_IMPACTS = ['SELF', 'TEAM', 'COMPANY'] as const;
export type TicketImpact = (typeof TICKET_IMPACTS)[number];

export const TICKET_IMPACT_LABEL: Record<TicketImpact, string> = {
  SELF: 'Somente você',
  TEAM: 'Sua equipe',
  COMPANY: 'Toda a empresa',
};
