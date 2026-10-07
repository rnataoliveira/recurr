<p align="center">
  <img src="assets/images/logo.svg" width="72" alt="Recurr logo" />
</p>

<h1 align="center">Recurr</h1>

<p align="center">Track every subscription you pay for, and see what each month really costs.</p>

---

Recurr is an iOS and Android app for keeping your subscriptions in one place. Add what you pay for (Netflix, Spotify, iCloud, the gym...), and Recurr shows how much you spend per month and per year, which subscriptions charge in which month, and reminds you the day before each renewal.

All data stays on the device. There is no account and no server.

## Features

- **Service catalog**: 138 services across 15 categories, with logos. Popular services include reference plans and prices for Brazil, so price, currency and billing cycle are filled in for you. Anything not in the catalog can be added as a custom subscription.
- **Month by month**: a 12-month strip shows what is actually charged each month. Annual plans appear only in their renewal month, monthly plans in every month, and dates on the 29th to 31st are adjusted for shorter months.
- **Monthly average and yearly total**: what your subscriptions cost when spread evenly across the year.
- **Pauses scoped to months**: switch a subscription off for a single month or from a given month on. Earlier months are never changed.
- **Renewal reminders**: a local notification at 9:00 the day before each charge, for subscriptions with a renewal date.
- **Follows the phone**: English, Portuguese, Spanish and French, with local date and currency formats, plus light and dark mode.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | [Expo](https://expo.dev) SDK 57, React Native 0.86, React 19 |
| Navigation | Expo Router (file-based, `src/app`) |
| Storage | `expo-sqlite` with versioned migrations |
| Notifications | `expo-notifications` (local only) |
| Localization | `expo-localization` and a small built-in translation helper |
| Language | TypeScript (strict) |

## Getting started

Requirements: Node 20+ and either the [Expo Go](https://expo.dev/go) app on your phone, the iOS Simulator (Xcode) or an Android emulator.

```bash
npm install
npx expo start
```

Then press `i` for the iOS Simulator or `a` for Android, or scan the QR code with Expo Go.

Before opening a PR:

```bash
npx tsc --noEmit
npx expo lint
```

## Project structure

```
src/
  app/                 Screens (Expo Router)
    _layout.tsx        Root stack, database provider, theme
    index.tsx          Home: totals, month strip, subscriptions for the selected month
    add.tsx            Add flow: browse/search services, then the subscription form
  components/          Brand title, month strip, service logo
  hooks/               Theme, pause/resume actions
  i18n/                Translations (en, pt, es, fr) and formatting helpers
  lib/
    db.ts              Schema and migrations
    subscriptions.ts   Queries: services, plans, subscriptions, pauses
    schedule.ts        Works out charge dates for the next 12 months
    reminders.ts       Schedules renewal notifications
    money.ts           Monthly conversion and currency formatting
    months.ts          Month keys ('YYYY-MM') and pause checks
  data/services.json   Service catalog and reference plans
assets/images/logo.svg App logo
```

## Data model

| Table | Purpose |
| --- | --- |
| `service` | Catalog entry: name, category, domain (used for the logo) |
| `plan` | Reference plan for a service: name, price, currency, cycle |
| `subscription` | What the user pays for: service or custom name, price, currency, cycle, next renewal date |
| `subscription_pause` | Months a subscription is paused: `from_month` to `to_month` (NULL means until resumed) |

Charge dates are worked out from the next renewal date and the billing cycle. Subscriptions without a renewal date use the date they were added and are shown as an estimated date. They get no reminders.

## Common changes

**Add a service or update reference prices.** Edit `src/data/services.json`. The catalog is loaded into the database by migrations, so existing installs only receive changes through a new migration: add an entry to the end of `MIGRATIONS` in `src/lib/db.ts` that inserts or updates the rows, and update `PRICES_AS_OF`.

**Change the database schema.** Add a new function to the end of `MIGRATIONS` in `src/lib/db.ts`. Never edit a migration that has already been released.

**Add a language.** Copy `src/i18n/en.ts`, translate it (the `Messages` type makes sure no key is missing), register it in `src/i18n/index.ts`, and add the locale to the `expo-localization` plugin in `app.json`.

**Rename the app.** Change `APP_NAME` in `src/constants/app.ts` and `name` in `app.json`.

## Roadmap

- Edit an existing subscription
- App icon and splash screen from the logo
- History of past months
- Automatic detection of subscriptions from bank transactions (Open Finance), since services like Netflix offer no public subscription API
