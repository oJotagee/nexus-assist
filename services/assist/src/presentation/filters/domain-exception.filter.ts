import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';

import {
  ConversationNotFoundError,
  DailyBudgetExceededError,
  DraftNotFoundError,
  DraftNotPendingError,
  EmployeeNotFoundError,
  InvalidConversationTransitionError,
  InvalidCredentialsError,
  InvalidDraftError,
  NotAssignedAnalystError,
  SessionLimitReachedError,
  TicketConflictError,
  TicketNotFoundError,
  TicketsUnavailableError,
  TraceNotFoundError,
} from '@/domain/errors/domain.error';

type OutgoingResponse = {
  headersSent?: boolean;
  status(code: number): { json(body: unknown): void };
};

type ErrorClass = abstract new (...args: never[]) => Error;

const STATUS_BY_ERROR = new Map<ErrorClass, HttpStatus>([
  [InvalidCredentialsError, HttpStatus.UNAUTHORIZED],
  [InvalidDraftError, HttpStatus.BAD_REQUEST],
  [NotAssignedAnalystError, HttpStatus.FORBIDDEN],
  [EmployeeNotFoundError, HttpStatus.NOT_FOUND],
  [ConversationNotFoundError, HttpStatus.NOT_FOUND],
  [DraftNotFoundError, HttpStatus.NOT_FOUND],
  [TraceNotFoundError, HttpStatus.NOT_FOUND],
  [TicketNotFoundError, HttpStatus.NOT_FOUND],
  [InvalidConversationTransitionError, HttpStatus.CONFLICT],
  [DraftNotPendingError, HttpStatus.CONFLICT],
  [SessionLimitReachedError, HttpStatus.CONFLICT],
  [TicketConflictError, HttpStatus.CONFLICT],
  [DailyBudgetExceededError, HttpStatus.TOO_MANY_REQUESTS],
  [TicketsUnavailableError, HttpStatus.SERVICE_UNAVAILABLE],
]);

export const DOMAIN_ERRORS = [...STATUS_BY_ERROR.keys()];

@Catch(...DOMAIN_ERRORS)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const status =
      STATUS_BY_ERROR.get(exception.constructor as ErrorClass) ?? HttpStatus.BAD_REQUEST;
    const response = host.switchToHttp().getResponse<OutgoingResponse>();

    if (response.headersSent) return;

    response
      .status(status)
      .json({ statusCode: status, error: exception.name, message: exception.message });
  }
}
