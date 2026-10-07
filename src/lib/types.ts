export const CYCLES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
export type Cycle = (typeof CYCLES)[number];

export const CURRENCIES = ['BRL', 'USD', 'EUR'] as const;

export type Service = {
  id: number;
  name: string;
  category: string;
  domain: string | null;
  /** Cheapest monthly reference plan, when the catalog has prices for this service */
  fromCents: number | null;
  fromCurrency: string | null;
};

export type Subscription = {
  id: number;
  serviceId: number | null;
  name: string;
  category: string;
  domain: string | null;
  priceCents: number;
  currency: string;
  cycle: Cycle;
  nextRenewal: string | null;
  /** Active in the current month (not paused) */
  active: boolean;
  pauses: Pause[];
  createdAt: string;
};

/** Inclusive month range ('YYYY-MM'); `to` null means paused until resumed. */
export type Pause = { id: number; from: string; to: string | null };

export type Plan = {
  id: number;
  name: string;
  priceCents: number;
  currency: string;
  cycle: Cycle;
};
