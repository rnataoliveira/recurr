import { locale } from '@/i18n';
import type { Cycle, Subscription } from '@/lib/types';

const MONTHLY_FACTOR: Record<Cycle, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

export function monthlyCents(sub: Pick<Subscription, 'priceCents' | 'cycle'>) {
  return Math.round(sub.priceCents * MONTHLY_FACTOR[sub.cycle]);
}

/** Monthly totals of active subscriptions, grouped by currency (no FX conversion yet). */
export function monthlyTotals(subs: Subscription[]) {
  const totals = new Map<string, number>();
  for (const s of subs) {
    if (!s.active) continue;
    totals.set(s.currency, (totals.get(s.currency) ?? 0) + monthlyCents(s));
  }
  return [...totals].map(([currency, cents]) => ({ currency, cents }));
}

export function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}
