import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';

import { ListEmployeeTicketsUseCase } from '@/application/use-cases/list-employee-tickets.use-case';
import { GetEmployeeTicketUseCase } from '@/application/use-cases/get-employee-ticket.use-case';
import { LegacyInstabilityInterceptor } from '../interceptors/legacy-instability.interceptor';
import { AddTicketUpdateUseCase } from '@/application/use-cases/add-ticket-update.use-case';
import { TransferTicketUseCase } from '@/application/use-cases/transfer-ticket.use-case';
import { CreateTicketUseCase } from '@/application/use-cases/create-ticket.use-case';
import { ReopenTicketUseCase } from '@/application/use-cases/reopen-ticket.use-case';
import { CloseTicketUseCase } from '@/application/use-cases/close-ticket.use-case';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';
import type { TicketDetailView, TicketView } from '@/application/ticket-view';
import { InternalApiSecretGuard } from '../guards/internal-api-secret.guard';
import {
  AddTicketUpdateRequestDto,
  CloseTicketRequestDto,
  CreateTicketRequestDto,
  ListTicketsQueryDto,
  ReopenTicketRequestDto,
  TransferTicketRequestDto,
} from '../dtos/ticket.request.dto';

@ApiTags('internal')
@ApiHeader({ name: 'X-Internal-Secret', required: true })
@Controller('internal/employees/:employeeId/tickets')
@UseGuards(InternalApiSecretGuard)
@UseInterceptors(LegacyInstabilityInterceptor, IdempotencyInterceptor)
export class InternalTicketController {
  constructor(
    private readonly listTickets: ListEmployeeTicketsUseCase,
    private readonly getTicket: GetEmployeeTicketUseCase,
    private readonly createTicket: CreateTicketUseCase,
    private readonly addUpdate: AddTicketUpdateUseCase,
    private readonly reopenTicket: ReopenTicketUseCase,
    private readonly transferTicket: TransferTicketUseCase,
    private readonly closeTicket: CloseTicketUseCase,
  ) {}

  @Get()
  list(
    @Param('employeeId') employeeId: string,
    @Query() query: ListTicketsQueryDto,
  ): Promise<TicketView[]> {
    return this.listTickets.execute({ employeeId, scope: query.scope });
  }

  @Get(':ticketId')
  get(
    @Param('employeeId') employeeId: string,
    @Param('ticketId') ticketId: string,
  ): Promise<TicketDetailView> {
    return this.getTicket.execute({ employeeId, ticketId });
  }

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  create(
    @Param('employeeId') employeeId: string,
    @Body() body: CreateTicketRequestDto,
  ): Promise<TicketView> {
    return this.createTicket.execute({ employeeId, ...body });
  }

  @Post(':ticketId/updates')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  update(
    @Param('employeeId') employeeId: string,
    @Param('ticketId') ticketId: string,
    @Body() body: AddTicketUpdateRequestDto,
  ): Promise<TicketView> {
    return this.addUpdate.execute({ employeeId, ticketId, ...body });
  }

  @Post(':ticketId/reopen')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  reopen(
    @Param('employeeId') employeeId: string,
    @Param('ticketId') ticketId: string,
    @Body() body: ReopenTicketRequestDto,
  ): Promise<TicketView> {
    return this.reopenTicket.execute({ employeeId, ticketId, ...body });
  }

  @Post(':ticketId/transfer')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  transfer(
    @Param('employeeId') employeeId: string,
    @Param('ticketId') ticketId: string,
    @Body() body: TransferTicketRequestDto,
  ): Promise<TicketView> {
    return this.transferTicket.execute({ employeeId, ticketId, ...body });
  }

  @Post(':ticketId/close')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  close(
    @Param('employeeId') employeeId: string,
    @Param('ticketId') ticketId: string,
    @Body() body: CloseTicketRequestDto,
  ): Promise<TicketView> {
    return this.closeTicket.execute({ employeeId, ticketId, ...body });
  }
}
