import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Module } from '@nestjs/common';

import { ConversationViewBuilder } from './application/conversation-view.builder';
import { AGENT_RUNNER } from './application/ports/agent.port';
import {
  CONVERSATION_REPOSITORY,
  DRAFT_REPOSITORY,
  EMPLOYEE_REPOSITORY,
  HELP_ARTICLE_REPOSITORY,
  MESSAGE_REPOSITORY,
} from './application/ports/repositories.port';
import { CLOCK, ID_GENERATOR, TOKEN_ISSUER } from './application/ports/services.port';
import { TICKETS_GATEWAY } from './application/ports/tickets-gateway.port';
import { GetProfileUseCase } from './application/use-cases/auth/get-profile.use-case';
import { LoginUseCase } from './application/use-cases/auth/login.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/auth/request-password-reset.use-case';
import { ChangeConversationStateUseCase } from './application/use-cases/console/change-conversation-state.use-case';
import { GetConsoleConversationUseCase } from './application/use-cases/console/get-console-conversation.use-case';
import { GetEmployeeTicketsUseCase } from './application/use-cases/console/get-employee-tickets.use-case';
import { ListConsoleConversationsUseCase } from './application/use-cases/console/list-console-conversations.use-case';
import { SendAnalystMessageUseCase } from './application/use-cases/console/send-analyst-message.use-case';
import { GetActiveConversationUseCase } from './application/use-cases/conversation/get-active-conversation.use-case';
import { GetTraceUseCase } from './application/use-cases/conversation/get-trace.use-case';
import {
  DAILY_TOKEN_BUDGET,
  SendMessageUseCase,
} from './application/use-cases/conversation/send-message.use-case';
import {
  SESSION_SUMMARIZER,
  StartNewSessionUseCase,
} from './application/use-cases/conversation/start-new-session.use-case';
import { CancelDraftUseCase } from './application/use-cases/draft/cancel-draft.use-case';
import { ConfirmDraftUseCase } from './application/use-cases/draft/confirm-draft.use-case';
import { UpdateDraftUseCase } from './application/use-cases/draft/update-draft.use-case';
import { AGENT_MODEL, agentModelEnv, createAgentModel } from './infrastructure/agent/model';
import { NexoAgentRunner } from './infrastructure/agent/nexo-agent.runner';
import { LlmSessionSummarizer } from './infrastructure/agent/session-summarizer';
import { SystemClock, UuidGenerator } from './infrastructure/clock/system';
import jwtConfig from './infrastructure/config/jwt.config';
import { throttlerOptions } from './infrastructure/config/rate-limit';
import ticketsApiConfig from './infrastructure/config/tickets-api.config';
import { HttpTicketsGateway } from './infrastructure/http/http-tickets.gateway';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { PrismaConversationRepository } from './infrastructure/repository/prisma-conversation.repository';
import { PrismaDraftRepository } from './infrastructure/repository/prisma-draft.repository';
import { PrismaEmployeeRepository } from './infrastructure/repository/prisma-employee.repository';
import { PrismaHelpArticleRepository } from './infrastructure/repository/prisma-help-article.repository';
import { PrismaMessageRepository } from './infrastructure/repository/prisma-message.repository';
import { JwtTokenIssuer } from './infrastructure/security/jwt-token.issuer';
import { AuthController } from './presentation/controllers/auth.controller';
import { ConsoleController } from './presentation/controllers/console.controller';
import { ConversationController } from './presentation/controllers/conversation.controller';
import { HealthController } from './presentation/controllers/health.controller';
import { MessageStreamController } from './presentation/controllers/message-stream.controller';
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig, ticketsApiConfig] }),
    JwtModule.register({}),
    ThrottlerModule.forRoot(throttlerOptions),
  ],
  controllers: [
    AuthController,
    ConversationController,
    MessageStreamController,
    ConsoleController,
    HealthController,
  ],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    JwtAuthGuard,
    ConversationViewBuilder,
    LoginUseCase,
    GetProfileUseCase,
    RequestPasswordResetUseCase,
    GetActiveConversationUseCase,
    StartNewSessionUseCase,
    SendMessageUseCase,
    GetTraceUseCase,
    ConfirmDraftUseCase,
    UpdateDraftUseCase,
    CancelDraftUseCase,
    ListConsoleConversationsUseCase,
    GetConsoleConversationUseCase,
    GetEmployeeTicketsUseCase,
    ChangeConversationStateUseCase,
    SendAnalystMessageUseCase,
    { provide: EMPLOYEE_REPOSITORY, useClass: PrismaEmployeeRepository },
    { provide: CONVERSATION_REPOSITORY, useClass: PrismaConversationRepository },
    { provide: MESSAGE_REPOSITORY, useClass: PrismaMessageRepository },
    { provide: DRAFT_REPOSITORY, useClass: PrismaDraftRepository },
    { provide: HELP_ARTICLE_REPOSITORY, useClass: PrismaHelpArticleRepository },
    { provide: TICKETS_GATEWAY, useClass: HttpTicketsGateway },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    { provide: CLOCK, useClass: SystemClock },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
    {
      provide: AGENT_MODEL,
      useFactory: () => createAgentModel(agentModelEnv()),
    },
    { provide: AGENT_RUNNER, useClass: NexoAgentRunner },
    { provide: SESSION_SUMMARIZER, useClass: LlmSessionSummarizer },
    {
      provide: DAILY_TOKEN_BUDGET,
      useFactory: () => Number(process.env.DAILY_TOKEN_BUDGET ?? 200_000) || 0,
    },
  ],
})
export class AppModule {}
