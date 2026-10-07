import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatDate, t } from '@/i18n';
import { formatMoney } from '@/lib/money';
import { upcomingMonths } from '@/lib/schedule';
import type { Subscription } from '@/lib/types';

const CHANNEL_ID = 'renewals';
const REMINDER_HOUR = 9;
// iOS keeps at most 64 pending notifications per app; leave some headroom
const MAX_SCHEDULED = 60;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Asks for permission if not decided yet. Returns whether reminders can be shown. */
export async function ensureReminderPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Replaces all scheduled reminders with one per upcoming charge (day before, 9:00).
 * Only subscriptions with a real renewal date get reminders; estimated dates are skipped.
 * Runs whenever the list changes or the app opens, so the window keeps rolling forward.
 */
export async function syncReminders(subs: Subscription[]) {
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return 0;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: t('reminderChannel'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();
  const reminders = upcomingMonths(subs.filter((s) => s.nextRenewal))
    .flatMap((m) => m.charges)
    .filter((c) => !c.paused)
    .map((c) => {
      const at = new Date(c.date);
      at.setDate(at.getDate() - 1);
      at.setHours(REMINDER_HOUR, 0, 0, 0);
      return { charge: c, at };
    })
    .filter((r) => r.at > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);

  for (const { charge, at } of reminders) {
    const { sub, date } = charge;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('reminderTitle', { name: sub.name }),
        body: t('reminderBody', {
          amount: formatMoney(sub.priceCents, sub.currency),
          date: formatDate(date),
        }),
        data: { subscriptionId: sub.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: CHANNEL_ID,
      },
    });
  }

  return reminders.length;
}
