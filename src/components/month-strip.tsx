import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BRAND_COLOR } from '@/constants/app';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { monthTitle, type MonthKey } from '@/lib/months';
import type { MonthSummary } from '@/lib/schedule';

const BAR_MAX_HEIGHT = 56;

/** Horizontal month picker; each bar shows how much is charged in that month. */
export function MonthStrip({
  months,
  selectedMonth,
  onSelectMonth,
}: {
  months: MonthSummary[];
  selectedMonth: MonthKey;
  onSelectMonth: (month: MonthKey) => void;
}) {
  const theme = useTheme();

  // Bars are scaled by the main currency (the first one charged, usually BRL)
  const mainCurrency = months.flatMap((m) => m.totals)[0]?.currency;
  const amountOf = (m: MonthSummary) =>
    m.totals.find((t) => t.currency === mainCurrency)?.cents ?? 0;
  const max = Math.max(1, ...months.map(amountOf));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}>
      {months.map((m, i) => {
        const isSelected = m.key === selectedMonth;
        const height = Math.max(4, (amountOf(m) / max) * BAR_MAX_HEIGHT);
        return (
          <Pressable
            key={m.key}
            onPress={() => onSelectMonth(m.key)}
            style={[
              styles.monthChip,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: isSelected ? BRAND_COLOR : 'transparent',
              },
            ]}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  { height, backgroundColor: isSelected ? BRAND_COLOR : theme.textSecondary },
                ]}
              />
            </View>
            <Text style={[styles.monthName, { color: theme.text }]}>
              {monthTitle(m.key, { month: 'short' })}
            </Text>
            <Text style={[styles.year, { color: theme.textSecondary }]}>
              {m.month === 0 || i === 0 ? m.year : ' '}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: Spacing.two },
  monthChip: {
    width: 56,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  barTrack: { height: BAR_MAX_HEIGHT, justifyContent: 'flex-end', marginBottom: Spacing.one },
  bar: { width: 12, borderRadius: 4 },
  monthName: { fontSize: 14, fontWeight: '600' },
  year: { fontSize: 12 },
});
