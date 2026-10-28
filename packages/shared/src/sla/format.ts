const TIME_ZONE = 'America/Sao_Paulo';

const dayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
});

function hourLabel(date: Date): string {
  return timeFormat.format(date).replace(':', 'h');
}

/** "hoje às 13h45", "amanhã às 09h00" ou "30/10 às 10h00". */
export function formatDueAt(dueAt: Date, now: Date): string {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (dayKey.format(dueAt) === dayKey.format(now)) return `hoje às ${hourLabel(dueAt)}`;
  if (dayKey.format(dueAt) === dayKey.format(tomorrow)) return `amanhã às ${hourLabel(dueAt)}`;

  return `${dateFormat.format(dueAt)} às ${hourLabel(dueAt)}`;
}
