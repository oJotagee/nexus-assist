export { cn } from 'cn';

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

const TIME_ZONE = 'America/Sao_Paulo';

const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
});

const shortDate = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: 'short',
});

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** "16 out, 14:20" */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${shortDate.format(date).replace('.', '')}, ${timeFormat.format(date)}`;
}

export function formatShortDate(iso: string): string {
  return shortDate.format(new Date(iso)).replace('.', '');
}

/** "há 6 dias", "há 3 h", "há 5 min", "agora" */
export function formatRelative(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}
