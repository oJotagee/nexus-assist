'use client';

import { KeyRound, Loader2, Mail, RotateCcw } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { requestPasswordReset } from '../_actions/request-password-reset';
import { Button } from '@/components/ui/button';

export function PasswordCard({ email, changedDaysAgo }: { email: string; changedDaysAgo: number }) {
  const reset = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: (result) => {
      if (result.error) toast.error(result.error);
      else toast.success('Link de redefinição enviado.');
    },
  });

  const sentTo = reset.data?.data?.sentTo;

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
          <KeyRound className="size-4" />
        </span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Senha</h2>
          <p className="text-xs text-muted-foreground">
            Alterada há {changedDaysAgo} {changedDaysAgo === 1 ? 'dia' : 'dias'}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => reset.mutate()}
          disabled={reset.isPending}
        >
          {reset.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          Redefinir senha
        </Button>
      </div>
      <p
        className="flex items-center gap-2 border-t bg-muted/50 px-5 py-2.5 text-xs text-muted-foreground"
        aria-live="polite"
      >
        <Mail className="size-3.5" />
        {sentTo
          ? `Enviamos um link de redefinição para ${sentTo}.`
          : `O link de redefinição vai para ${email}.`}
      </p>
    </section>
  );
}
