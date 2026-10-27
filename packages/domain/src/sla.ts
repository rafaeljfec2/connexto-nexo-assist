import type { TicketPriority } from '@nexo-assist/contracts';

export const TIME_ZONE = 'America/Sao_Paulo';
export const BUSINESS_DAY_START_HOUR = 8;
export const BUSINESS_DAY_END_HOUR = 18;
export const BUSINESS_HOURS_PER_DAY = 10;

const SLA_BUSINESS_HOURS: Readonly<Record<Exclude<TicketPriority, 'critical'>, number>> = {
  high: 4,
  medium: 30,
  low: 50,
};

const CRITICAL_CALENDAR_MS = 60 * 60 * 1000;

export type Clock = () => Date;

/**
 * Computes due date from `from` for the given priority.
 * Critical uses 1 calendar hour (24h on-call).
 * Other priorities use business hours Mon–Fri 08:00–18:00 America/Sao_Paulo.
 */
export function computeDueAt(
  priority: TicketPriority,
  from: Date,
  clock: Clock = () => new Date(),
): Date {
  void clock;
  if (priority === 'critical') {
    return new Date(from.getTime() + CRITICAL_CALENDAR_MS);
  }
  return addBusinessHours(from, SLA_BUSINESS_HOURS[priority]);
}

export function addBusinessHours(from: Date, hours: number): Date {
  let remainingMinutes = Math.round(hours * 60);
  let cursor = toZonedParts(from);

  // Move into the next open business window if outside hours.
  cursor = snapToBusinessStart(cursor);

  while (remainingMinutes > 0) {
    if (!isBusinessDay(cursor.weekday)) {
      cursor = nextBusinessMorning(cursor);
      continue;
    }

    const minutesUntilClose =
      (BUSINESS_DAY_END_HOUR - cursor.hour) * 60 - cursor.minute;
    if (minutesUntilClose <= 0) {
      cursor = nextBusinessMorning(cursor);
      continue;
    }

    if (cursor.hour < BUSINESS_DAY_START_HOUR) {
      cursor = {
        ...cursor,
        hour: BUSINESS_DAY_START_HOUR,
        minute: 0,
        second: 0,
        ms: 0,
      };
      continue;
    }

    const consume = Math.min(remainingMinutes, minutesUntilClose);
    cursor = addMinutesToParts(cursor, consume);
    remainingMinutes -= consume;

    if (remainingMinutes > 0) {
      cursor = nextBusinessMorning(cursor);
    }
  }

  return fromZonedParts(cursor);
}

export function isWithinReopenWindow(
  resolvedAt: Date,
  now: Date,
  windowHours = 168,
): boolean {
  return now.getTime() <= resolvedAt.getTime() + windowHours * 60 * 60 * 1000;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
  weekday: number; // 0=Sun … 6=Sat (JS convention via formatter)
}

function toZonedParts(date: Date): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    year: Number(parts['year']),
    month: Number(parts['month']),
    day: Number(parts['day']),
    hour: Number(parts['hour']),
    minute: Number(parts['minute']),
    second: Number(parts['second']),
    ms: 0,
    weekday: weekdayMap[parts['weekday'] ?? 'Mon'] ?? 1,
  };
}

function fromZonedParts(parts: ZonedParts): Date {
  // Construct an ISO-like local wall time then interpret as Sao Paulo via offset probe.
  const wall = `${pad(parts.year)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
  // Binary-search UTC that formats to this wall time in America/Sao_Paulo.
  let lo = Date.parse(`${wall}.000Z`) - 12 * 60 * 60 * 1000;
  let hi = Date.parse(`${wall}.000Z`) + 12 * 60 * 60 * 1000;
  for (let i = 0; i < 40; i += 1) {
    const mid = Math.floor((lo + hi) / 2);
    const midParts = toZonedParts(new Date(mid));
    const cmp = compareParts(midParts, parts);
    if (cmp === 0) {
      return new Date(mid);
    }
    if (cmp < 0) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return new Date(lo);
}

function compareParts(a: ZonedParts, b: ZonedParts): number {
  const keys: (keyof ZonedParts)[] = [
    'year',
    'month',
    'day',
    'hour',
    'minute',
    'second',
  ];
  for (const key of keys) {
    const diff = (a[key] as number) - (b[key] as number);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

function isBusinessDay(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5;
}

function snapToBusinessStart(parts: ZonedParts): ZonedParts {
  let cursor = { ...parts };
  if (!isBusinessDay(cursor.weekday)) {
    return nextBusinessMorning(cursor);
  }
  if (
    cursor.hour > BUSINESS_DAY_END_HOUR ||
    (cursor.hour === BUSINESS_DAY_END_HOUR && cursor.minute > 0)
  ) {
    return nextBusinessMorning(cursor);
  }
  if (cursor.hour < BUSINESS_DAY_START_HOUR) {
    cursor = {
      ...cursor,
      hour: BUSINESS_DAY_START_HOUR,
      minute: 0,
      second: 0,
      ms: 0,
    };
  }
  return cursor;
}

function nextBusinessMorning(parts: ZonedParts): ZonedParts {
  let cursor = addCalendarDays(parts, 1);
  cursor = {
    ...cursor,
    hour: BUSINESS_DAY_START_HOUR,
    minute: 0,
    second: 0,
    ms: 0,
  };
  while (!isBusinessDay(cursor.weekday)) {
    cursor = addCalendarDays(cursor, 1);
  }
  return cursor;
}

function addCalendarDays(parts: ZonedParts, days: number): ZonedParts {
  const utcApprox = Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0);
  const next = toZonedParts(new Date(utcApprox));
  return {
    ...next,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
    ms: parts.ms,
  };
}

function addMinutesToParts(parts: ZonedParts, minutes: number): ZonedParts {
  const total = parts.hour * 60 + parts.minute + minutes;
  return {
    ...parts,
    hour: Math.floor(total / 60),
    minute: total % 60,
    second: 0,
    ms: 0,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
