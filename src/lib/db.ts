import type { SQLiteDatabase } from 'expo-sqlite';

import services from '@/data/services.json';

/** Date the reference prices in services.json were checked. */
export const PRICES_AS_OF = '2026-10-07';

type Migration = (db: SQLiteDatabase) => Promise<void>;

// Append-only: each entry upgrades user_version by one
const MIGRATIONS: Migration[] = [
  async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS service (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        name     TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        domain   TEXT
      );

      CREATE TABLE IF NOT EXISTS subscription (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id   INTEGER REFERENCES service(id),
        custom_name  TEXT,
        price_cents  INTEGER NOT NULL,
        currency     TEXT NOT NULL DEFAULT 'BRL',
        cycle        TEXT NOT NULL CHECK (cycle IN ('weekly', 'monthly', 'quarterly', 'yearly')),
        next_renewal TEXT,
        active       INTEGER NOT NULL DEFAULT 1,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    for (const s of services) {
      await db.runAsync(
        'INSERT OR IGNORE INTO service (name, category, domain) VALUES (?, ?, ?)',
        s.name,
        s.category,
        s.domain,
      );
    }
  },
  async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS plan (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        service_id  INTEGER NOT NULL REFERENCES service(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        price_cents INTEGER NOT NULL,
        currency    TEXT NOT NULL,
        cycle       TEXT NOT NULL,
        UNIQUE (service_id, name)
      );
    `);
    for (const s of services) {
      for (const p of s.plans ?? []) {
        await db.runAsync(
          `INSERT OR IGNORE INTO plan (service_id, name, price_cents, currency, cycle)
           SELECT id, ?, ?, ?, ? FROM service WHERE name = ?`,
          p.name,
          p.priceCents,
          p.currency,
          p.cycle,
          s.name,
        );
      }
    }
  },
  async (db) => {
    // Month-scoped pauses replace the global active flag. to_month NULL = until resumed.
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS subscription_pause (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        subscription_id INTEGER NOT NULL REFERENCES subscription(id) ON DELETE CASCADE,
        from_month      TEXT NOT NULL,
        to_month        TEXT
      );
      INSERT INTO subscription_pause (subscription_id, from_month, to_month)
        SELECT id, strftime('%Y-%m', 'now', 'localtime'), NULL FROM subscription WHERE active = 0;
    `);
  },
];

/** Runs on app start (SQLiteProvider onInit): applies pending migrations. */
export async function migrate(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.withTransactionAsync(() => MIGRATIONS[v](db));
    await db.execAsync(`PRAGMA user_version = ${v + 1}`);
  }
}
