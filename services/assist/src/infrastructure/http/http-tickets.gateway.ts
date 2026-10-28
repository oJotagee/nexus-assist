import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import axios, { type AxiosInstance, type AxiosRequestConfig, isAxiosError } from 'axios';

import type {
  CreateTicketCommand,
  GatewayResult,
  Ticket,
  TicketDetail,
  TicketScope,
  TicketsGateway,
} from '@/application/ports/tickets-gateway.port';
import {
  TicketConflictError,
  TicketNotFoundError,
  TicketsUnavailableError,
} from '@/domain/errors/domain.error';
import ticketsApiConfig from '../config/tickets-api.config';

type RawTicket = Omit<Ticket, 'createdAt' | 'lastUpdateAt' | 'resolvedAt' | 'deadline'> & {
  createdAt: string;
  lastUpdateAt: string;
  resolvedAt: string | null;
  deadline: { dueAt: string | null; overdue: boolean; slaLabel: string };
};

type RawTicketDetail = RawTicket & {
  updates: {
    kind: string;
    author: string;
    authorName: string | null;
    body: string;
    createdAt: string;
  }[];
};

function parseTicket(raw: RawTicket): Ticket {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    lastUpdateAt: new Date(raw.lastUpdateAt),
    resolvedAt: raw.resolvedAt ? new Date(raw.resolvedAt) : null,
    deadline: { ...raw.deadline, dueAt: raw.deadline.dueAt ? new Date(raw.deadline.dueAt) : null },
  };
}

export const RETRY_DELAYS_MS = [300, 600, 1200];

/**
 * O sistema de chamados é legado e fica indisponível por alguns segundos de vez em quando.
 * Repete com backoff exponencial em 503, timeout e erro de rede, inclusive em escritas,
 * que são seguras porque sempre levam Idempotency-Key.
 */
@Injectable()
export class HttpTicketsGateway implements TicketsGateway {
  private readonly logger = new Logger(HttpTicketsGateway.name);
  private readonly http: AxiosInstance;
  private readonly delays: number[];

  constructor(@Inject(ticketsApiConfig.KEY) config: ConfigType<typeof ticketsApiConfig>) {
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: 5_000,
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': config.secret ?? '' },
    });
    this.delays = config.retryDelaysMs ?? RETRY_DELAYS_MS;
  }

  async list(employeeId: string, scope: TicketScope): Promise<GatewayResult<Ticket[]>> {
    const { data, attempts } = await this.request<RawTicket[]>({
      method: 'GET',
      url: this.base(employeeId),
      params: { scope },
    });
    return { data: data.map(parseTicket), attempts };
  }

  async get(employeeId: string, ticketId: string): Promise<GatewayResult<TicketDetail>> {
    const { data, attempts } = await this.request<RawTicketDetail>(
      { method: 'GET', url: `${this.base(employeeId)}/${encodeURIComponent(ticketId)}` },
      ticketId,
    );

    return {
      attempts,
      data: {
        ...parseTicket(data),
        updates: data.updates.map((update) => ({
          ...update,
          createdAt: new Date(update.createdAt),
        })),
      },
    };
  }

  create(employeeId: string, command: CreateTicketCommand, key: string) {
    return this.write(this.base(employeeId), { ...command, author: 'AGENT' }, key);
  }

  addUpdate(
    employeeId: string,
    ticketId: string,
    update: { body: string; author: 'AGENT' | 'ANALYST' | 'REQUESTER'; authorName?: string },
    key: string,
  ) {
    return this.write(`${this.ticketUrl(employeeId, ticketId)}/updates`, update, key, ticketId);
  }

  reopen(employeeId: string, ticketId: string, reason: string, key: string) {
    return this.write(
      `${this.ticketUrl(employeeId, ticketId)}/reopen`,
      { reason, author: 'AGENT' },
      key,
      ticketId,
    );
  }

  transfer(
    employeeId: string,
    ticketId: string,
    transfer: { group: 'N1' | 'N2'; summary: string },
    key: string,
  ) {
    return this.write(`${this.ticketUrl(employeeId, ticketId)}/transfer`, transfer, key, ticketId);
  }

  private async write(
    url: string,
    body: object,
    idempotencyKey: string,
    ticketId?: string,
  ): Promise<GatewayResult<Ticket>> {
    const { data, attempts } = await this.request<RawTicket>(
      { method: 'POST', url, data: body, headers: { 'Idempotency-Key': idempotencyKey } },
      ticketId,
    );
    return { data: parseTicket(data), attempts };
  }

  private async request<T>(
    config: AxiosRequestConfig,
    ticketId?: string,
  ): Promise<GatewayResult<T>> {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await this.http.request<T>(config);
        return { data: response.data, attempts: attempt };
      } catch (error) {
        const status = isAxiosError(error) ? error.response?.status : undefined;
        const retryable = !status || status === 503 || status === 502 || status === 504;

        if (status === 404) throw new TicketNotFoundError(ticketId ?? '');
        if (status === 409) throw new TicketConflictError(this.messageOf(error));

        const delay = this.delays[attempt - 1];
        if (!retryable || delay === undefined) {
          this.logger.warn(
            `Sistema de chamados falhou após ${attempt} tentativa(s): ${status ?? 'rede'}`,
          );
          throw new TicketsUnavailableError();
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private messageOf(error: unknown): string {
    const message = isAxiosError(error)
      ? (error.response?.data as { message?: unknown } | undefined)?.message
      : undefined;
    return typeof message === 'string' ? message : 'O chamado não aceita essa operação.';
  }

  private base(employeeId: string): string {
    return `/internal/employees/${encodeURIComponent(employeeId)}/tickets`;
  }

  private ticketUrl(employeeId: string, ticketId: string): string {
    return `${this.base(employeeId)}/${encodeURIComponent(ticketId)}`;
  }
}
