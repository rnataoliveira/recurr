import { useSQLiteContext } from 'expo-sqlite';
import { Alert } from 'react-native';

import { t } from '@/i18n';
import { monthName, type MonthKey } from '@/lib/months';
import { pauseSubscription, resumeSubscription } from '@/lib/subscriptions';
import type { Subscription } from '@/lib/types';

/** Turning a subscription off asks whether to skip one month or stop from that month on. */
export function usePauseActions(onChange: () => void) {
  const db = useSQLiteContext();

  function setActive(sub: Subscription, month: MonthKey, active: boolean) {
    if (active) {
      resumeSubscription(db, sub.id, month).then(onChange);
      return;
    }

    const name = monthName(month);
    Alert.alert(t('pauseTitle', { name: sub.name }), t('pauseMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('pauseOnly', { month: name }),
        onPress: () => pauseSubscription(db, sub.id, month, month).then(onChange),
      },
      {
        text: t('pauseFrom', { month: name }),
        style: 'destructive',
        onPress: () => pauseSubscription(db, sub.id, month, null).then(onChange),
      },
    ]);
  }

  return { setActive };
}
