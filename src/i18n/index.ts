import { getLocales } from 'expo-localization';

import { en, type Messages } from '@/i18n/en';
import { es } from '@/i18n/es';
import { fr } from '@/i18n/fr';
import { pt } from '@/i18n/pt';
import type { Cycle } from '@/lib/types';

const MESSAGES: Record<string, Messages> = { en, pt, es, fr };

const device = getLocales()[0];

/** Full device tag (e.g. 'pt-BR'), used for number and date formatting. */
export const locale = device?.languageTag ?? 'en-US';

const messages = MESSAGES[device?.languageCode ?? 'en'] ?? en;

export type MessageKey = Exclude<keyof Messages, 'categories'>;

/** Translate a key, filling `{name}` placeholders from `params`. */
export function t(key: MessageKey, params: Record<string, string | number> = {}) {
  const template = messages[key] ?? en[key];
  return template.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

/** Catalog categories are stored in English; translate when there is an entry for them. */
export function categoryName(category: string) {
  return messages.categories[category] ?? category;
}

export function formatDate(date: Date, opts?: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString(locale, opts);
}

const CYCLE_SHORT = {
  weekly: 'perWeekShort',
  monthly: 'perMonthShort',
  quarterly: 'perQuarterShort',
  yearly: 'perYearShort',
} as const satisfies Record<Cycle, MessageKey>;

/** '/mo', '/mês', '/mes'... */
export function cycleShort(cycle: Cycle) {
  return t(CYCLE_SHORT[cycle]);
}

/** 'monthly', 'mensal'... */
export function cycleName(cycle: Cycle) {
  return t(cycle);
}

const decimalSeparator = (1.5).toLocaleString(locale).charAt(1);

/** Price as typed in an input, using the device's decimal separator ('20,90' or '20.90'). */
export function formatPriceInput(cents: number) {
  return (cents / 100).toFixed(2).replace('.', decimalSeparator);
}

export const pricePlaceholder = formatPriceInput(0);
