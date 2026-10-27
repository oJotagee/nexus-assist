import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';

import {
  IdempotencyKeyReuseError,
  MissingIdempotencyKeyError,
} from '@/domain/errors/idempotency.error';
import {
  InvalidTicketError,
  TicketCannotBeReopenedError,
  TicketClosedError,
  TicketNotFoundError,
} from '@/domain/errors/ticket.error';

type OutgoingResponse = {
  status(code: number): { json(body: unknown): void };
};

const DOMAIN_ERRORS = [
  InvalidTicketError,
  TicketNotFoundError,
  TicketClosedError,
  TicketCannotBeReopenedError,
  MissingIdempotencyKeyError,
  IdempotencyKeyReuseError,
] as const;

type ErrorClass = abstract new (...args: never[]) => Error;

const STATUS_BY_ERROR = new Map<ErrorClass, HttpStatus>([
  [InvalidTicketError, HttpStatus.BAD_REQUEST],
  [MissingIdempotencyKeyError, HttpStatus.BAD_REQUEST],
  [TicketNotFoundError, HttpStatus.NOT_FOUND],
  [TicketClosedError, HttpStatus.CONFLICT],
  [TicketCannotBeReopenedError, HttpStatus.CONFLICT],
  [IdempotencyKeyReuseError, HttpStatus.UNPROCESSABLE_ENTITY],
]);

@Catch(...DOMAIN_ERRORS)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost): void {
    const status =
      STATUS_BY_ERROR.get(exception.constructor as ErrorClass) ?? HttpStatus.BAD_REQUEST;

    const response = host.switchToHttp().getResponse<OutgoingResponse>();

    response.status(status).json({
      statusCode: status,
      error: exception.name,
      message: exception.message,
    });
  }
}
