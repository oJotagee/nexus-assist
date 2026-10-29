'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { type SortingState, useTable } from '@tanstack/react-table';
import type { TicketSummaryDto } from '@nexo/shared';
import { useState } from 'react';

import { ticketColumns, ticketTableFeatures } from './tickets-columns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const PAGE_SIZE = 6;

type AllTicketsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  tickets: TicketSummaryDto[];
};

/** "Ver todos os chamados da Ana": tabela ordenável e paginada (TanStack Table). */
export function AllTicketsDialog({
  open,
  onOpenChange,
  employeeName,
  tickets,
}: AllTicketsDialogProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'lastUpdateAt', desc: true }]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PAGE_SIZE });

  const table = useTable({
    features: ticketTableFeatures,
    columns: ticketColumns,
    data: tickets,
    getRowId: (row) => row.id,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  });

  const total = tickets.length;
  const first = total === 0 ? 0 : pagination.pageIndex * PAGE_SIZE + 1;
  const last = Math.min((pagination.pageIndex + 1) * PAGE_SIZE, total);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Chamados de {employeeName}</DialogTitle>
          <DialogDescription>
            Todos os chamados do funcionário, incluindo resolvidos e fechados.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((group) => (
                <TableRow key={group.id} className="hover:bg-transparent">
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    const Icon =
                      sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
                    return (
                      <TableHead
                        key={header.id}
                        aria-sort={
                          sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
                        }
                        className="h-10 text-xs font-medium text-muted-foreground"
                      >
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          >
                            <table.FlexRender header={header} />
                            <Icon className="size-3" aria-hidden="true" />
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2.5 text-sm">
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={ticketColumns.length}
                    className="h-20 text-center text-muted-foreground"
                  >
                    Nenhum chamado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-end gap-3 text-sm">
            <span className="text-muted-foreground tabular-nums">
              {first}–{last} de {total}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Página anterior"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Próxima página"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
