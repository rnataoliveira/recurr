import { isPausedIn, monthKey } from '@/lib/months';
import type { Subscription } from '@/lib/types';

export type Charge = {
  sub: Subscription;
  date: Date;
  /** True when there is no renewal date and the add date was used as the anchor */
  estimated: boolean;
  /** Paused for this month: listed, but not charged */
  paused: boolean;
};

export type MonthSummary = {
  key: string; // 'YYYY-MM'
  year: number;
  month: number; // 0-11
  /** Includes paused charges; only unpaused ones count toward totals */
  charges: Charge[];
  totals: { currency: string; cents: number }[];
};

const STEP_MONTHS = { monthly: 1, quarterly: 3, yearly: 12 } as const;

function parseDate(iso: string) {
  // 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM:SS' -> local midnight of that day
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Same day-of-month as the anchor, clamped to the month length (31 Jan -> 28 Feb). */
function monthlyOccurrence(anchor: Date, monthsAhead: number) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth() + monthsAhead;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(anchor.getDate(), lastDay));
}

/** All charge dates of a subscription inside [from, to). */
function chargeDates(sub: Subscription, anchor: Date, from: Date, to: Date): Date[] {
  const dates: Date[] = [];

  if (sub.cycle === 'weekly') {
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    // Jump to the first occurrence on or after `from` (never before the anchor)
    const skip = Math.max(0, Math.ceil((from.getTime() - anchor.getTime()) / weekMs));
    for (let t = anchor.getTime() + skip * weekMs; t < to.getTime(); t += weekMs) {
      dates.push(new Date(t));
    }
    return dates;
  }

  const step = STEP_MONTHS[sub.cycle];
  const monthsBetween =
    (from.getFullYear() - anchor.getFullYear()) * 12 + (from.getMonth() - anchor.getMonth());
  let i = Math.max(0, Math.floor(monthsBetween / step));
  for (;;) {
    const d = monthlyOccurrence(anchor, i * step);
    if (d >= to) break;
    if (d >= from) dates.push(d);
    i++;
  }
  return dates;
}

/** Charges of all subscriptions for `count` months starting at the month of `start`. */
export function upcomingMonths(
  subs: Subscription[],
  start = new Date(),
  count = 12,
): MonthSummary[] {
  const first = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(first.getFullYear(), first.getMonth() + count, 1);

  const months: MonthSummary[] = Array.from({ length: count }, (_, i) => {
    const d = new Date(first.getFullYear(), first.getMonth() + i, 1);
    return {
      key: monthKey(d),
      year: d.getFullYear(),
      month: d.getMonth(),
      charges: [],
      totals: [],
    };
  });

  for (const sub of subs) {
    const anchor = parseDate(sub.nextRenewal ?? sub.createdAt);
    for (const date of chargeDates(sub, anchor, first, last)) {
      const index =
        (date.getFullYear() - first.getFullYear()) * 12 + (date.getMonth() - first.getMonth());
      months[index].charges.push({
        sub,
        date,
        estimated: !sub.nextRenewal,
        paused: isPausedIn(sub.pauses, monthKey(date)),
      });
    }
  }

  for (const m of months) {
    m.charges.sort((a, b) => a.date.getTime() - b.date.getTime());
    const totals = new Map<string, number>();
    for (const c of m.charges) {
      if (c.paused) continue;
      totals.set(c.sub.currency, (totals.get(c.sub.currency) ?? 0) + c.sub.priceCents);
    }
    m.totals = [...totals].map(([currency, cents]) => ({ currency, cents }));
  }

  return months;
}
