import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type {
  ConsoleConversationDto,
  ConsoleConversationListDto,
  TicketSummaryDto,
} from '@nexo/shared';

import { ListConsoleConversationsUseCase } from '@/application/use-cases/console/list-console-conversations.use-case';
import { ChangeConversationStateUseCase } from '@/application/use-cases/console/change-conversation-state.use-case';
import { GetConsoleConversationUseCase } from '@/application/use-cases/console/get-console-conversation.use-case';
import { GetEmployeeTicketsUseCase } from '@/application/use-cases/console/get-employee-tickets.use-case';
import { SendAnalystMessageUseCase } from '@/application/use-cases/console/send-analyst-message.use-case';
import {
  AnalystMessageRequestDto,
  CloseConversationRequestDto,
  ConsoleListQueryDto,
} from '../dtos/requests.dto';
import { type AuthUser, JwtAuthGuard, Roles } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';

@ApiTags('console')
@ApiBearerAuth()
@Controller('console/conversations')
@UseGuards(JwtAuthGuard)
@Roles('ANALYST')
export class ConsoleController {
  constructor(
    private readonly listConversations: ListConsoleConversationsUseCase,
    private readonly getConversation: GetConsoleConversationUseCase,
    private readonly getEmployeeTickets: GetEmployeeTicketsUseCase,
    private readonly changeState: ChangeConversationStateUseCase,
    private readonly sendMessage: SendAnalystMessageUseCase,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ConsoleListQueryDto,
  ): Promise<ConsoleConversationListDto> {
    return this.listConversations.execute({
      analystId: user.id,
      filter: query.filter,
      query: query.q,
    });
  }

  @Get(':id')
  get(@Param('id') id: string): Promise<ConsoleConversationDto> {
    return this.getConversation.execute(id);
  }

  @Get(':id/tickets')
  tickets(@Param('id') id: string): Promise<TicketSummaryDto[]> {
    return this.getEmployeeTickets.execute(id);
  }

  @Post(':id/assume')
  @HttpCode(200)
  assume(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ConsoleConversationDto> {
    return this.changeState.execute({ conversationId: id, analystId: user.id, action: 'assume' });
  }

  @Post(':id/release')
  @HttpCode(200)
  release(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ConsoleConversationDto> {
    return this.changeState.execute({ conversationId: id, analystId: user.id, action: 'release' });
  }

  @Post(':id/close')
  @HttpCode(200)
  close(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: CloseConversationRequestDto,
  ): Promise<ConsoleConversationDto> {
    return this.changeState.execute({
      conversationId: id,
      analystId: user.id,
      action: 'close',
      resolveTicket: body.resolveTicket ?? false,
      resolution: body.resolution,
    });
  }

  @Post(':id/messages')
  @HttpCode(200)
  message(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: AnalystMessageRequestDto,
  ): Promise<ConsoleConversationDto> {
    return this.sendMessage.execute({ conversationId: id, analystId: user.id, text: body.text });
  }
}
