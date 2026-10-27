import type { INestApplication } from '@nestjs/common';
import { UnhandledExceptionFilter } from '@nexo/shared/http';
import { ValidationPipe } from '@nestjs/common';

import { DomainExceptionFilter } from './presentation/filters/domain-exception.filter';

/** Pipes e filtros globais; usado pelo main.ts e pelos testes de integração. */
export function configureApp(app: INestApplication): INestApplication {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new UnhandledExceptionFilter(), new DomainExceptionFilter());

  return app;
}
