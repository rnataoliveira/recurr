import type { SQLiteDatabase } from 'expo-sqlite';

import { addMonths, currentMonthKey, isPausedIn, type MonthKey } from '@/lib/months';
import type { Cycle, Pause, Plan, Service, Subscription } from '@/lib/types';

type SubscriptionRow = {
  id: number;
  service_id: number | null;
  name: string;
  category: string;
  domain: string | null;
  price_cents: number;
  currency: string;
  cycle: Cycle;
  next_renewal: string | null;
  created_at: string;
};

export function listServices(db: SQLiteDatabase) {
  return db.getAllAsync<Service>(
    `SELECT s.id, s.name, s.category, s.domain,
            MIN(p.price_cents) AS fromCents, p.currency AS fromCurrency
       FROM service s
       LEFT JOIN plan p ON p.service_id = s.id AND p.cycle = 'monthly'
      GROUP BY s.id
      ORDER BY s.name COLLATE NOCASE`,
  );
}

export function listPlans(db: SQLiteDatabase, serviceName: string) {
  return db.getAllAsync<Plan>(
    `SELECT p.id, p.name, p.price_cents AS priceCents, p.currency, p.cycle
       FROM plan p
       JOIN service s ON s.id = p.service_id
      WHERE s.name = ? COLLATE NOCASE
      ORDER BY p.cycle = 'yearly', p.price_cents`,
    serviceName,
  );
}

export async function listSubscriptions(db: SQLiteDatabase): Promise<Subscription[]> {
  const rows = await db.getAllAsync<SubscriptionRow>(
    `SELECT s.id, s.service_id,
            COALESCE(sv.name, s.custom_name) AS name,
            COALESCE(sv.category, 'Other')   AS category,
            sv.domain,
            s.price_cents, s.currency, s.cycle, s.next_renewal, s.created_at
       FROM subscription s
       LEFT JOIN service sv ON sv.id = s.service_id
      ORDER BY name COLLATE NOCASE`,
  );
  const pauseRows = await db.getAllAsync<Pause & { subscriptionId: number }>(
    `SELECT id, subscription_id AS subscriptionId, from_month AS "from", to_month AS "to"
       FROM subscription_pause ORDER BY from_month`,
  );

  const thisMonth = currentMonthKey();
  const subs = rows.map((r) => {
    const pauses = pauseRows
      .filter((p) => p.subscriptionId === r.id)
      .map(({ id, from, to }) => ({ id, from, to }));
    return {
      id: r.id,
      serviceId: r.service_id,
      name: r.name,
      category: r.category,
      domain: r.domain,
      priceCents: r.price_cents,
      currency: r.currency,
      cycle: r.cycle,
      nextRenewal: r.next_renewal,
      active: !isPausedIn(pauses, thisMonth),
      pauses,
      createdAt: r.created_at,
    };
  });
  // Active ones first, keeping alphabetical order inside each group
  return subs.sort((a, b) => Number(b.active) - Number(a.active));
}

/** Pause a single month (`until` = same month) or from `from` onward (`until` = null). */
export async function pauseSubscription(
  db: SQLiteDatabase,
  id: number,
  from: MonthKey,
  until: MonthKey | null,
) {
  await db.runAsync(
    'INSERT INTO subscription_pause (subscription_id, from_month, to_month) VALUES (?, ?, ?)',
    id,
    from,
    until,
  );
}

/**
 * Charge again from `month` onward. Pauses covering `month` are cut so they end the month
 * before; earlier months keep their history untouched.
 */
export async function resumeSubscription(db: SQLiteDatabase, id: number, month: MonthKey) {
  const pauses = await db.getAllAsync<Pause>(
    `SELECT id, from_month AS "from", to_month AS "to" FROM subscription_pause
      WHERE subscription_id = ? AND from_month <= ? AND (to_month IS NULL OR to_month >= ?)`,
    id,
    month,
    month,
  );
  await db.withTransactionAsync(async () => {
    for (const p of pauses) {
      if (p.from < month) {
        await db.runAsync(
          'UPDATE subscription_pause SET to_month = ? WHERE id = ?',
          addMonths(month, -1),
          p.id,
        );
      } else {
        await db.runAsync('DELETE FROM subscription_pause WHERE id = ?', p.id);
      }
    }
  });
}

export async function createSubscription(
  db: SQLiteDatabase,
  input: {
    name: string;
    priceCents: number;
    currency: string;
    cycle: Cycle;
    nextRenewal: string | null;
  },
) {
  // Link to the catalog when the name matches a known service, otherwise keep it custom
  const service = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM service WHERE name = ? COLLATE NOCASE',
    input.name,
  );

  await db.runAsync(
    `INSERT INTO subscription (service_id, custom_name, price_cents, currency, cycle, next_renewal)
     VALUES (?, ?, ?, ?, ?, ?)`,
    service?.id ?? null,
    service ? null : input.name,
    input.priceCents,
    input.currency,
    input.cycle,
    input.nextRenewal,
  );
}

export async function deleteSubscription(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM subscription WHERE id = ?', id);
}
