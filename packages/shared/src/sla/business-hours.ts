const SAO_PAULO_OFFSET_MS = -3 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

export const BUSINESS_DAY_START_HOUR = 8;
export const BUSINESS_DAY_END_HOUR = 18;
export const BUSINESS_MINUTES_PER_DAY = (BUSINESS_DAY_END_HOUR - BUSINESS_DAY_START_HOUR) * 60;

function toLocal(date: Date): Date {
  return new Date(date.getTime() + SAO_PAULO_OFFSET_MS);
}

function fromLocal(local: Date): Date {
  return new Date(local.getTime() - SAO_PAULO_OFFSET_MS);
}

function atHour(local: Date, hour: number): Date {
  const result = new Date(local);
  result.setUTCHours(hour, 0, 0, 0);
  return result;
}

function isWeekend(local: Date): boolean {
  const day = local.getUTCDay();
  return day === 0 || day === 6;
}

function nextDayStart(local: Date): Date {
  const result = atHour(local, BUSINESS_DAY_START_HOUR);
  result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

/** Leva o cursor para o primeiro instante de expediente igual ou posterior a ele. */
function alignToBusinessTime(local: Date): Date {
  let cursor = local;

  while (true) {
    if (isWeekend(cursor)) {
      cursor = nextDayStart(cursor);
      continue;
    }

    const start = atHour(cursor, BUSINESS_DAY_START_HOUR);
    const end = atHour(cursor, BUSINESS_DAY_END_HOUR);

    if (cursor < start) return start;
    if (cursor >= end) {
      cursor = nextDayStart(cursor);
      continue;
    }

    return cursor;
  }
}

export function isBusinessTime(date: Date): boolean {
  const local = toLocal(date);
  return alignToBusinessTime(local).getTime() === local.getTime();
}

/** Soma minutos contando só o expediente. */
export function addBusinessMinutes(start: Date, minutes: number): Date {
  if (minutes < 0) throw new RangeError('minutes deve ser positivo');

  let cursor = alignToBusinessTime(toLocal(start));
  let remaining = minutes;

  while (remaining > 0) {
    const endOfDay = atHour(cursor, BUSINESS_DAY_END_HOUR);
    const available = (endOfDay.getTime() - cursor.getTime()) / MINUTE_MS;

    if (remaining <= available) {
      cursor = new Date(cursor.getTime() + remaining * MINUTE_MS);
      remaining = 0;
    } else {
      remaining -= available;
      cursor = alignToBusinessTime(endOfDay);
    }
  }

  return fromLocal(cursor);
}
