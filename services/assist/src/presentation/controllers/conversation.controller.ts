import type { ConversationDto, DecisionTraceDto } from '@nexo/shared';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { GetActiveConversationUseCase } from '@/application/use-cases/conversation/get-active-conversation.use-case';
import { GetTraceUseCase } from '@/application/use-cases/conversation/get-trace.use-case';
import { StartNewSessionUseCase } from '@/application/use-cases/conversation/start-new-session.use-case';
import { CancelDraftUseCase } from '@/application/use-cases/draft/cancel-draft.use-case';
import { ConfirmDraftUseCase } from '@/application/use-cases/draft/confirm-draft.use-case';
import { UpdateDraftUseCase } from '@/application/use-cases/draft/update-draft.use-case';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UpdateDraftRequestDto } from '../dtos/requests.dto';
import { type AuthUser, JwtAuthGuard, Roles } from '../guards/jwt-auth.guard';

@ApiTags('conversations')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class ConversationController {
  constructor(
    private readonly getActive: GetActiveConversationUseCase,
    private readonly startSession: StartNewSessionUseCase,
    private readonly confirmDraft: ConfirmDraftUseCase,
    private readonly updateDraft: UpdateDraftUseCase,
    private readonly cancelDraft: CancelDraftUseCase,
    private readonly getTrace: GetTraceUseCase,
  ) {}

  @Get('conversations/active')
  @Roles('EMPLOYEE')
  active(@CurrentUser() user: AuthUser): Promise<ConversationDto> {
    return this.getActive.execute(user.id);
  }

  @Post('conversations/:id/sessions')
  @Roles('EMPLOYEE')
  newSession(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ConversationDto> {
    return this.startSession.execute({ conversationId: id, employeeId: user.id });
  }

  @Patch('conversations/:id/drafts/:draftId')
  @Roles('EMPLOYEE')
  editDraft(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
    @Param('draftId') draftId: string,
    @Body() changes: UpdateDraftRequestDto,
  ): Promise<ConversationDto> {
    return this.updateDraft.execute({ conversationId, draftId, employeeId: user.id, changes });
  }

  @Post('conversations/:id/drafts/:draftId/confirm')
  @HttpCode(200)
  @Roles('EMPLOYEE')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
    @Param('draftId') draftId: string,
  ): Promise<ConversationDto> {
    return this.confirmDraft.execute({ conversationId, draftId, employeeId: user.id });
  }

  @Post('conversations/:id/drafts/:draftId/cancel')
  @HttpCode(200)
  @Roles('EMPLOYEE')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
    @Param('draftId') draftId: string,
  ): Promise<ConversationDto> {
    return this.cancelDraft.execute({ conversationId, draftId, employeeId: user.id });
  }

  @Get('traces/:messageId')
  trace(
    @CurrentUser() user: AuthUser,
    @Param('messageId') messageId: string,
  ): Promise<DecisionTraceDto> {
    return this.getTrace.execute({ messageId, requester: user });
  }
}
