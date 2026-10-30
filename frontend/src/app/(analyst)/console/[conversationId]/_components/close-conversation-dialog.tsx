'use client';

import { CheckCircle2, Loader2, LogOut } from 'lucide-react';
import { useState } from 'react';

import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type CloseConversationChoice = { resolveTicket: boolean; resolution?: string };

type CloseConversationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string | null;
  employeeFirstName: string;
  pending: boolean;
  onConfirm: (choice: CloseConversationChoice) => void;
};

const optionClass =
  'relative flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring';

/**
 * Encerrar o atendimento: com chamado em foco, o analista diz se o problema foi resolvido. Se
 * sim, o chamado é resolvido junto, com a solução no histórico, e o funcionário é avisado no chat.
 */
export function CloseConversationDialog({
  open,
  onOpenChange,
  ticketId,
  employeeFirstName,
  pending,
  onConfirm,
}: CloseConversationDialogProps) {
  const [resolveTicket, setResolveTicket] = useState(true);
  const [resolution, setResolution] = useState('');

  const resolving = ticketId !== null && resolveTicket;

  function confirm() {
    onConfirm(
      resolving
        ? { resolveTicket: true, resolution: resolution.trim() || undefined }
        : { resolveTicket: false },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Encerrar atendimento</DialogTitle>
          <DialogDescription>
            {ticketId
              ? `O problema do ${ticketId} foi resolvido?`
              : `A conversa será encerrada. Se ${employeeFirstName} escrever de novo, o agent volta a atender.`}
          </DialogDescription>
        </DialogHeader>

        {ticketId && (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="sr-only">Situação do chamado</legend>
              <label
                className={cn(
                  optionClass,
                  resolveTicket ? 'border-primary bg-accent/60' : 'hover:bg-muted/60',
                )}
              >
                <input
                  type="radio"
                  name="close-ticket"
                  className="sr-only"
                  checked={resolveTicket}
                  onChange={() => setResolveTicket(true)}
                />
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <span>
                  <span className="block font-medium">Sim, resolver o {ticketId}</span>
                  <span className="text-muted-foreground">
                    {employeeFirstName} é avisado no chat e pode reabrir em até 7 dias.
                  </span>
                </span>
              </label>
              <label
                className={cn(
                  optionClass,
                  !resolveTicket ? 'border-primary bg-accent/60' : 'hover:bg-muted/60',
                )}
              >
                <input
                  type="radio"
                  name="close-ticket"
                  className="sr-only"
                  checked={!resolveTicket}
                  onChange={() => setResolveTicket(false)}
                />
                <LogOut className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="block font-medium">Não, só encerrar a conversa</span>
                  <span className="text-muted-foreground">O chamado continua aberto.</span>
                </span>
              </label>
            </fieldset>

            {resolveTicket && (
              <Field>
                <FieldLabel htmlFor="close-resolution">Solução aplicada (opcional)</FieldLabel>
                <FieldContent>
                  <Textarea
                    id="close-resolution"
                    rows={3}
                    maxLength={2000}
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    placeholder="Ex.: perfil da VPN reinstalado; conexão testada com a funcionária."
                  />
                  <FieldDescription>Vai para o histórico do chamado.</FieldDescription>
                </FieldContent>
              </Field>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Voltar
          </Button>
          <Button
            onClick={confirm}
            disabled={pending}
            className={cn(!resolving && 'bg-danger text-white hover:bg-danger/90')}
          >
            {pending && <Loader2 className="animate-spin" />}
            {resolving ? 'Resolver e encerrar' : 'Encerrar atendimento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
