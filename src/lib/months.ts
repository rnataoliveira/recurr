import { locale } from '@/i18n';
import type { Pause } from '@/lib/types';

/** Months are handled as 'YYYY-MM' keys, which sort and compare as plain strings. */
export type MonthKey = string;

export function monthKey(date: Date): MonthKey {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonthKey() {
  return monthKey(new Date());
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}

export function monthName(key: MonthKey, opts: Intl.DateTimeFormatOptions = { month: 'long' }) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale, opts);
}

/** Month name for titles: capitalized, since pt/es/fr month names are lowercase. */
export function monthTitle(key: MonthKey, opts: Intl.DateTimeFormatOptions = { month: 'long' }) {
  const label = monthName(key, opts);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function isPausedIn(pauses: Pause[], month: MonthKey) {
  return pauses.some((p) => p.from <= month && (p.to === null || month <= p.to));
}
