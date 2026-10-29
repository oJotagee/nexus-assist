import type { AgentStreamEvent } from '@nexo/shared';
import { Body, Controller, Logger, Param, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { AgentUnavailableError } from '@/application/ports/agent.port';
import { SendMessageUseCase } from '@/application/use-cases/conversation/send-message.use-case';
import { INTERNAL_ERROR_MESSAGE } from '@nexo/shared/http';
import { RATE_LIMITS } from '@/infrastructure/config/rate-limit';
import { CurrentUser } from '../decorators/current-user.decorator';
import { SendMessageRequestDto } from '../dtos/requests.dto';
import { DOMAIN_ERRORS } from '../filters/domain-exception.filter';
import { type AuthUser, JwtAuthGuard, Roles } from '../guards/jwt-auth.guard';

/**
 * POST /conversations/:id/messages responde em Server-Sent Events: a mensagem do funcionário
 * gravada, cada passo do agent ao vivo, o texto token a token, os blocos (cards) e, no fim,
 * a conversa atualizada. Erros viram um evento `error`, porque o status HTTP já foi enviado.
 */
@ApiTags('conversations')
@ApiBearerAuth()
@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class MessageStreamController {
  private readonly logger = new Logger(MessageStreamController.name);

  constructor(private readonly sendMessage: SendMessageUseCase) {}

  @Post(':id/messages')
  @Roles('EMPLOYEE')
  @Throttle({ default: RATE_LIMITS.agentMessages })
  async stream(
    @CurrentUser() user: AuthUser,
    @Param('id') conversationId: string,
    @Body() body: SendMessageRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (event: AgentStreamEvent) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const result = await this.sendMessage.execute(
        { conversationId, employeeId: user.id, text: body.text, reply: body.reply },
        {
          message: (message, agentWillReply) => send({ type: 'message', message, agentWillReply }),
          step: (step) => send({ type: 'step', step }),
          textDelta: (delta) => send({ type: 'text-delta', delta }),
          block: (block) => send({ type: 'block', block }),
        },
      );
      send({ type: 'done', message: result.message, conversation: result.conversation });
    } catch (error) {
      const known =
        error instanceof AgentUnavailableError ||
        DOMAIN_ERRORS.some((ErrorClass) => error instanceof ErrorClass);

      if (!known) this.logger.error(error instanceof Error ? error.stack : error);

      send({
        type: 'error',
        error: known && error instanceof Error ? error.name : 'InternalServerError',
        message: known && error instanceof Error ? error.message : INTERNAL_ERROR_MESSAGE,
      });
    } finally {
      res.end();
    }
  }
}
