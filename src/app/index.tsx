import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonthStrip } from '@/components/month-strip';
import { ServiceLogo } from '@/components/service-logo';
import { Spacing } from '@/constants/theme';
import { usePauseActions } from '@/hooks/use-pause-actions';
import { useTheme } from '@/hooks/use-theme';
import { cycleName, cycleShort, t } from '@/i18n';
import { currentMonthKey, isPausedIn, monthName, monthTitle, type MonthKey } from '@/lib/months';
import { formatMoney, monthlyTotals } from '@/lib/money';
import { syncReminders } from '@/lib/reminders';
import { upcomingMonths, type MonthSummary } from '@/lib/schedule';
import { deleteSubscription, listSubscriptions } from '@/lib/subscriptions';
import type { Subscription } from '@/lib/types';

/** One subscription as seen in the selected month. */
type Row = {
  sub: Subscription;
  status: 'charged' | 'paused' | 'none';
  /** Days of the month it is charged (several for weekly plans) */
  days: number[];
  cents: number;
  estimated: boolean;
  /** Next month with a charge, for subscriptions not charged in the selected month */
  nextMonth: MonthKey | null;
};

const STATUS_ORDER = { charged: 0, paused: 1, none: 2 } as const;

function buildRows(subs: Subscription[], months: MonthSummary[], index: number): Row[] {
  const month = months[index];
  return subs
    .map((sub): Row => {
      const charges = month.charges.filter((c) => c.sub.id === sub.id);
      const paused = isPausedIn(sub.pauses, month.key);
      const status = paused ? 'paused' : charges.length > 0 ? 'charged' : 'none';
      const next = months
        .slice(index + 1)
        .find((m) => m.charges.some((c) => c.sub.id === sub.id && !c.paused));
      return {
        sub,
        status,
        days: charges.map((c) => c.date.getDate()),
        cents: charges.length * sub.priceCents,
        estimated: charges.some((c) => c.estimated),
        nextMonth: next?.key ?? null,
      };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.days[0] ?? 0) - (b.days[0] ?? 0) ||
        a.sub.name.localeCompare(b.sub.name),
    );
}

function formatTotals(totals: MonthSummary['totals']) {
  if (totals.length === 0) return formatMoney(0, 'BRL');
  return totals.map((x) => formatMoney(x.cents, x.currency)).join(' + ');
}

export default function SubscriptionsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [subs, setSubs] = useState<Subscription[]>([]);
  // The month selected in the strip drives the list below
  const [month, setMonth] = useState<MonthKey>(currentMonthKey);

  const load = useCallback(() => {
    listSubscriptions(db).then((list) => {
      setSubs(list);
      syncReminders(list)
        .then((n) => __DEV__ && console.log(`[reminders] scheduled ${n}`))
        .catch((e) => console.warn('[reminders] sync failed', e));
    });
  }, [db]);

  // Reload whenever the screen regains focus (e.g. after closing the add sheet)
  useFocusEffect(load);

  const { setActive } = usePauseActions(load);

  function remove(sub: Subscription) {
    Alert.alert(t('deleteTitle', { name: sub.name }), undefined, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteSubscription(db, sub.id);
          load();
        },
      },
    ]);
  }

  const months = useMemo(() => upcomingMonths(subs), [subs]);
  const index = Math.max(
    0,
    months.findIndex((m) => m.key === month),
  );
  const selected = months[index];
  const rows = useMemo(() => buildRows(subs, months, index), [subs, months, index]);
  const totals = monthlyTotals(subs);
  const activeCount = rows.filter((r) => r.status !== 'paused').length;

  return (
    <>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}
        data={rows}
        keyExtractor={(r) => String(r.sub.id)}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.summary}>
              <SummaryCard label={t('avgPerMonth')} totals={totals} multiplier={1} />
              <SummaryCard label={t('perYear')} totals={totals} multiplier={12} />
            </View>
            {subs.length > 0 && (
              <>
                <Text style={[styles.heading, { color: theme.textSecondary }]}>
                  {t('next12Months')}
                </Text>
                <MonthStrip months={months} selectedMonth={selected.key} onSelectMonth={setMonth} />
                <View style={styles.monthHeader}>
                  <View>
                    <Text style={[styles.monthTitle, { color: theme.text }]}>
                      {monthTitle(selected.key, { month: 'long', year: 'numeric' })}
                    </Text>
                    <Text style={[styles.caption, { color: theme.textSecondary }]}>
                      {t('allSubscriptions', {
                        active: activeCount,
                        total: subs.length,
                      })}
                    </Text>
                  </View>
                  <Text style={[styles.monthTotal, { color: theme.text }]}>
                    {formatTotals(selected.totals)}
                  </Text>
                </View>
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: theme.textSecondary }]}>{t('empty')}</Text>
        }
        renderItem={({ item: row }) => (
          <SubscriptionRow
            row={row}
            onToggle={(v) => setActive(row.sub, selected.key, v)}
            onDelete={() => remove(row.sub)}
          />
        )}
      />
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.two }]}>
        <Pressable
          onPress={() => router.push('/add')}
          style={[styles.addButton, { backgroundColor: theme.text }]}>
          <SymbolView
            name={{ ios: 'plus', android: 'add', web: 'add' }}
            size={18}
            tintColor={theme.background}
          />
          <Text style={[styles.addButtonText, { color: theme.background }]}>
            {t('addSubscription')}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

function SubscriptionRow({
  row,
  onToggle,
  onDelete,
}: {
  row: Row;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const { sub, status } = row;

  let caption: string;
  if (status === 'charged') {
    caption = `${t('chargeDays', { days: row.days.join(', ') })} · ${cycleName(sub.cycle)}`;
    if (row.estimated) caption += ` · ${t('estimatedDate')}`;
  } else if (status === 'paused') {
    caption = t('pausedThisMonth');
  } else {
    caption = t('noChargeThisMonth');
    if (row.nextMonth) {
      caption += ` · ${t('nextCharge', { month: monthName(row.nextMonth, { month: 'short' }) })}`;
    }
  }

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.backgroundElement, opacity: status === 'charged' ? 1 : 0.5 },
      ]}>
      <ServiceLogo domain={sub.domain} name={sub.name} />
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {sub.name}
        </Text>
        <Text style={[styles.caption, { color: theme.textSecondary }]} numberOfLines={2}>
          {caption}
        </Text>
      </View>
      <Text style={[styles.name, { color: theme.text }]}>
        {status === 'charged' ? (
          formatMoney(row.cents, sub.currency)
        ) : (
          <>
            {formatMoney(sub.priceCents, sub.currency)}
            <Text style={{ color: theme.textSecondary }}>{cycleShort(sub.cycle)}</Text>
          </>
        )}
      </Text>
      <Switch value={status !== 'paused'} onValueChange={onToggle} />
      <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel={`${t('delete')} ${sub.name}`}>
        <SymbolView
          name={{ ios: 'trash', android: 'delete', web: 'delete' }}
          size={20}
          tintColor="#E5484D"
        />
      </Pressable>
    </View>
  );
}

function SummaryCard({
  label,
  totals,
  multiplier,
}: {
  label: string;
  totals: { currency: string; cents: number }[];
  multiplier: number;
}) {
  const theme = useTheme();
  const values = totals.length ? totals : [{ currency: 'BRL', cents: 0 }];
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <Text style={[styles.caption, { color: theme.textSecondary }]}>{label}</Text>
      {values.map((x) => (
        <Text key={x.currency} style={[styles.total, { color: theme.text }]}>
          {formatMoney(x.cents * multiplier, x.currency)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.two },
  header: { gap: Spacing.two, marginBottom: Spacing.one },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  card: { flex: 1, minWidth: 140, borderRadius: 14, padding: Spacing.three, gap: Spacing.one },
  total: { fontSize: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  caption: { fontSize: 13 },
  heading: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: Spacing.three,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Spacing.three,
  },
  monthTitle: { fontSize: 20, fontWeight: '700' },
  monthTotal: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
    borderRadius: 14,
    padding: Spacing.three,
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '500', fontVariant: ['tabular-nums'] },
  empty: { textAlign: 'center', marginTop: Spacing.five },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three },
  addButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  addButtonText: { fontSize: 16, fontWeight: '600' },
});
