import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

type OutgoingResponse = {
  status(code: number): { json(body: unknown): void };
};

export const INTERNAL_ERROR_MESSAGE = 'Ocorreu um erro inesperado. Tente novamente em instantes.';

@Catch()
export class UnhandledExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(UnhandledExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<OutgoingResponse>();

    if (exception instanceof HttpException && exception.getStatus() < 500) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      response
        .status(status)
        .json(typeof body === 'object' ? body : { statusCode: status, message: body });
      return;
    }

    // 503 é esperado (sistema legado instável): devolve o corpo como veio, sem logar stack.
    if (exception instanceof HttpException && exception.getStatus() === 503) {
      response.status(503).json(exception.getResponse());
      return;
    }

    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : exception,
    );

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      error: 'InternalServerError',
      message: INTERNAL_ERROR_MESSAGE,
    });
  }
}
