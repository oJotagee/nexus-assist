'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { z } from 'zod';
import {
  TICKET_CATEGORIES,
  TICKET_CATEGORY_LABEL,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABEL,
  type TicketDraftDto,
} from '@nexo/shared';

import { type ConversationActionResult, updateDraft } from '../_actions/draft-actions';
import { Field, FieldContent, FieldError, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const schema = z.object({
  title: z.string().trim().min(5, 'Mínimo de 5 caracteres.').max(120, 'Máximo de 120 caracteres.'),
  description: z
    .string()
    .trim()
    .min(10, 'Descreva o problema (mínimo de 10 caracteres).')
    .max(4000),
  category: z.enum(TICKET_CATEGORIES),
  priority: z.enum(TICKET_PRIORITIES),
});

type FormData = z.infer<typeof schema>;

type DraftEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  draft: TicketDraftDto;
  onSaved: (result: ConversationActionResult) => void;
};

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

export function DraftEditDialog({
  open,
  onOpenChange,
  conversationId,
  draft,
  onSaved,
}: DraftEditDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: draft.title,
      description: draft.description,
      category: draft.category,
      priority: draft.priority,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        title: draft.title,
        description: draft.description,
        category: draft.category,
        priority: draft.priority,
      });
    }
  }, [open, draft, form]);

  const save = useMutation({
    mutationFn: (values: FormData) =>
      updateDraft({ conversationId, draftId: draft.id, changes: values }),
    onSuccess: (result) => {
      onSaved(result);
      if (result.data) onOpenChange(false);
    },
  });

  const { errors } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar rascunho</DialogTitle>
          <DialogDescription>
            Ajuste o que precisar. Mudar a prioridade recalcula o prazo e fica registrado no
            chamado.
          </DialogDescription>
        </DialogHeader>

        <form
          id="draft-edit"
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => save.mutate(values))}
        >
          <Field data-invalid={!!errors.title}>
            <FieldLabel htmlFor="draft-title">Título</FieldLabel>
            <FieldContent>
              <Input id="draft-title" aria-invalid={!!errors.title} {...form.register('title')} />
              <FieldError errors={[errors.title]} />
            </FieldContent>
          </Field>

          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="draft-description">Descrição</FieldLabel>
            <FieldContent>
              <Textarea
                id="draft-description"
                rows={5}
                aria-invalid={!!errors.description}
                {...form.register('description')}
              />
              <FieldError errors={[errors.description]} />
            </FieldContent>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="draft-category">Categoria</FieldLabel>
              <select id="draft-category" className={selectClass} {...form.register('category')}>
                {TICKET_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {TICKET_CATEGORY_LABEL[category]}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="draft-priority">Prioridade</FieldLabel>
              <select id="draft-priority" className={selectClass} {...form.register('priority')}>
                {TICKET_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {TICKET_PRIORITY_LABEL[priority]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button type="submit" form="draft-edit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
