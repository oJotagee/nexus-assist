'use client';

import type { ConsoleConversationItemDto } from '@nexo/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const STORAGE_KEY = 'nexo-console-seen';
const BASE_TITLE = 'Console do analista · Nexo Assist';

type SeenMap = Record<string, string>;

function readSeen(): SeenMap | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SeenMap) : null;
  } catch {
    return null;
  }
}

function writeSeen(seen: SeenMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  } catch {}
}

/**
 * Novidades no console: conversa com mensagem nova (do funcionário ou do agent) desde a última
 * vez que o analista a viu, aviso quando uma conversa entra na fila e o número de novidades no
 * título da aba. O "visto" fica no navegador; a conversa aberta é marcada como vista.
 */
export function useConsoleActivity(
  items: ConsoleConversationItemDto[] | undefined,
  openId?: string,
) {
  const [seen, setSeen] = useState<SeenMap | null>(null);
  const waitingIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!items) return;

    setSeen((current) => {
      let next = current ?? readSeen();
      if (!next) {
        next = Object.fromEntries(
          items.flatMap((item) =>
            item.lastMessage ? [[item.id, item.lastMessage.createdAt]] : [],
          ),
        );
      }

      const open = items.find((item) => item.id === openId);
      if (open?.lastMessage && next[open.id] !== open.lastMessage.createdAt) {
        next = { ...next, [open.id]: open.lastMessage.createdAt };
      }

      if (next !== current) writeSeen(next);
      return next;
    });

    const waiting = new Set(
      items.filter((item) => item.state === 'WAITING_ANALYST').map((item) => item.id),
    );
    if (waitingIds.current) {
      for (const item of items) {
        if (waiting.has(item.id) && !waitingIds.current.has(item.id)) {
          toast.info(`${item.employee.name} está esperando um atendente`, {
            id: `waiting-${item.id}`,
          });
        }
      }
    }
    waitingIds.current = waiting;
  }, [items, openId]);

  const isUnread = useCallback(
    (item: ConsoleConversationItemDto): boolean => {
      if (!seen || !item.lastMessage || item.id === openId) return false;
      if (item.lastMessage.author === 'ANALYST') return false;
      const lastSeen = seen[item.id];
      return !lastSeen || new Date(item.lastMessage.createdAt) > new Date(lastSeen);
    },
    [seen, openId],
  );

  const unreadCount = items?.filter(isUnread).length ?? 0;

  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) ${BASE_TITLE}` : BASE_TITLE;
  }, [unreadCount]);

  return { isUnread, unreadCount };
}
