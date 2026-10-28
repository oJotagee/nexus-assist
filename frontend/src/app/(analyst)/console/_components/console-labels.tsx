import { type ConsoleConversationItemDto, HANDOFF_REASON_LABEL } from '@nexo/shared';

import { StatusDot } from '@/components/conversation/status';
import { formatRelative } from '@/lib/utils';

type Item = Pick<
  ConsoleConversationItemDto,
  'state' | 'handoffReason' | 'handoffAt' | 'assignedAnalyst' | 'resolvedByAgent'
>;

/** Linha de status da conversa no console (texto + cor, nunca só cor). */
export function ConversationStatus({ item }: { item: Item }) {
  switch (item.state) {
    case 'WAITING_ANALYST':
      return (
        <StatusDot tone="danger">
          Transferida · aguardando{' '}
          {item.handoffAt ? formatRelative(item.handoffAt).replace('há ', '') : ''}
          {item.handoffReason && (
            <span className="font-normal text-muted-foreground">
              {' '}
              · {HANDOFF_REASON_LABEL[item.handoffReason]}
            </span>
          )}
        </StatusDot>
      );
    case 'WITH_ANALYST':
      return (
        <StatusDot tone="info">
          Em atendimento · {item.assignedAnalyst?.name ?? 'analista'}
        </StatusDot>
      );
    case 'CLOSED':
      return <StatusDot tone="neutral">Encerrada</StatusDot>;
    case 'AGENT':
      return item.resolvedByAgent ? (
        <StatusDot tone="success">Resolvido pelo agent</StatusDot>
      ) : (
        <StatusDot tone="warning">Agent atendendo</StatusDot>
      );
  }
}
