'use client';

import { Loader2, SendHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MESSAGE_MAX_LENGTH } from '@nexo/shared';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ComposerProps = {
  disabled: boolean;
  busy: boolean;
  placeholder: string;
  messageCount: number;
  limit: number;
  /** Texto devolvido quando o envio falhou antes de chegar ao servidor. */
  restoreText: string | null;
  onSend: (text: string) => Promise<boolean>;
};

export function Composer({
  disabled,
  busy,
  placeholder,
  messageCount,
  limit,
  restoreText,
  onSend,
}: ComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (restoreText) setText(restoreText);
  }, [restoreText]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: recalcula a altura sempre que o texto muda.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [text]);

  async function submit() {
    const value = text.trim();
    if (!value || disabled || busy) return;
    setText('');
    const ok = await onSend(value);
    if (ok) textareaRef.current?.focus();
  }

  const nearLimit = messageCount >= limit - 5;

  return (
    <div className="sticky bottom-0 z-20 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6">
      <form
        className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border bg-white p-2 shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label htmlFor="composer" className="sr-only">
          Mensagem para o Nexo Assist
        </label>
        <textarea
          id="composer"
          ref={textareaRef}
          rows={1}
          value={text}
          maxLength={MESSAGE_MAX_LENGTH}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
          className="max-h-40 min-h-9 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-base sm:text-[15px] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <Button type="submit" disabled={disabled || busy || !text.trim()} className="h-9">
          {busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
          <span className="sr-only sm:not-sr-only">Enviar</span>
        </Button>
      </form>
      <p
        className={cn(
          'mx-auto mt-1.5 max-w-3xl text-right text-[11px] tabular-nums',
          nearLimit ? 'font-medium text-warning' : 'text-muted-foreground',
        )}
      >
        {messageCount}/{limit} mensagens nesta sessão
      </p>
    </div>
  );
}
