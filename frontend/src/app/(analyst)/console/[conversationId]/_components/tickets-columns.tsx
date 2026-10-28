import {
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketSummaryDto,
} from '@nexo/shared';
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  tableFeatures,
} from '@tanstack/react-table';

import { PriorityLabel, TicketStatusBadge } from '@/components/conversation/status';
import { cn, formatDateTime, formatRelative } from '@/lib/utils';

export const ticketTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, datetime: sortFn_datetime },
});

const helper = createColumnHelper<typeof ticketTableFeatures, TicketSummaryDto>();

const byRank =
  (order: readonly string[]) =>
  (
    a: { original: TicketSummaryDto },
    b: { original: TicketSummaryDto },
    key: 'priority' | 'status',
  ) =>
    order.indexOf(a.original[key]) - order.indexOf(b.original[key]);

const priorityRank = byRank(TICKET_PRIORITIES);
const statusRank = byRank(TICKET_STATUSES);

export const ticketColumns = helper.columns([
  helper.accessor('id', {
    header: 'Chamado',
    sortFn: 'alphanumeric',
    cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
  }),
  helper.accessor('title', {
    header: 'Título',
    sortFn: 'alphanumeric',
    cell: (info) => (
      <span className="line-clamp-2 min-w-48" title={info.getValue()}>
        {info.getValue()}
      </span>
    ),
  }),
  helper.accessor('category', {
    header: 'Categoria',
    cell: (info) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {TICKET_CATEGORY_LABEL[info.getValue()]}
      </span>
    ),
  }),
  helper.accessor('priority', {
    header: 'Prioridade',
    sortFn: (a, b) => priorityRank(a, b, 'priority'),
    cell: (info) => <PriorityLabel priority={info.getValue()} />,
  }),
  helper.accessor('status', {
    header: 'Status',
    sortFn: (a, b) => statusRank(a, b, 'status'),
    cell: (info) => <TicketStatusBadge status={info.getValue()} />,
  }),
  helper.accessor('lastUpdateAt', {
    header: 'Última atualização',
    sortFn: 'datetime',
    cell: (info) => (
      <span
        className={cn('whitespace-nowrap tabular-nums', info.row.original.overdue && 'text-danger')}
        title={formatDateTime(info.getValue())}
      >
        {formatRelative(info.getValue())}
        {info.row.original.overdue && ' · vencido'}
      </span>
    ),
  }),
]);
