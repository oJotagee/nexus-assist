import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';

import { AddTicketUpdateUseCase } from '@/application/use-cases/add-ticket-update.use-case';
import { CreateTicketUseCase } from '@/application/use-cases/create-ticket.use-case';
import { GetEmployeeTicketUseCase } from '@/application/use-cases/get-employee-ticket.use-case';
import { ListEmployeeTicketsUseCase } from '@/application/use-cases/list-employee-tickets.use-case';
import { ReopenTicketUseCase } from '@/application/use-cases/reopen-ticket.use-case';
import { TransferTicketUseCase } from '@/application/use-cases/transfer-ticket.use-case';
import { IDEMPOTENCY_STORE } from './application/ports/idempotency-store.port';
import { TICKET_REPOSITORY } from './application/ports/ticket-repository.port';
import { CLOCK } from './application/ports/clock.port';
import { SystemClock } from './infrastructure/clock/system-clock';
import internalApiConfig from './infrastructure/config/internal-api.config';
import legacyInstabilityConfig from './infrastructure/config/legacy-instability.config';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaIdempotencyStore } from './infrastructure/repository/prisma-idempotency.store';
import { PrismaTicketRepository } from './infrastructure/repository/prisma-ticket.repository';
import { HealthController } from './presentation/controllers/health.controller';
import { InternalTicketController } from './presentation/controllers/internal-ticket.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [internalApiConfig, legacyInstabilityConfig] }),
  ],
  controllers: [InternalTicketController, HealthController],
  providers: [
    PrismaService,
    ListEmployeeTicketsUseCase,
    GetEmployeeTicketUseCase,
    CreateTicketUseCase,
    AddTicketUpdateUseCase,
    ReopenTicketUseCase,
    TransferTicketUseCase,
    { provide: TICKET_REPOSITORY, useClass: PrismaTicketRepository },
    { provide: IDEMPOTENCY_STORE, useClass: PrismaIdempotencyStore },
    { provide: CLOCK, useClass: SystemClock },
  ],
})
export class AppModule {}
