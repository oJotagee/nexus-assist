import type { ConversationDto } from '@nexo/shared';
import { Inject, Injectable } from '@nestjs/common';

import { CLOCK, type Clock, ID_GENERATOR, type IdGenerator } from '../../ports/services.port';
import { ConversationEntity } from '@/domain/entities/conversation.entity';
import { ConversationViewBuilder } from '../../conversation-view.builder';
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from '../../ports/repositories.port';

/**
 * "Voltar outro dia e continuar de onde parei": devolve a última conversa do funcionário,
 * com todo o histórico e o estado (agent ou analista). Cria a primeira se não houver.
 */
@Injectable()
export class GetActiveConversationUseCase {
  constructor(
    @Inject(CONVERSATION_REPOSITORY) private readonly conversations: ConversationRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ID_GENERATOR) private readonly ids: IdGenerator,
    private readonly view: ConversationViewBuilder,
  ) {}

  async execute(employeeId: string): Promise<ConversationDto> {
    let conversation = await this.conversations.findLatestByEmployee(employeeId);

    if (!conversation) {
      conversation = ConversationEntity.start(
        { id: this.ids.next(), employeeId },
        this.clock.now(),
      );
      await this.conversations.create(conversation);
    }

    return this.view.build(conversation);
  }
}
