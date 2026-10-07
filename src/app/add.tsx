import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ServiceLogo } from '@/components/service-logo';
import { Spacing } from '@/constants/theme';
import catalog from '@/data/services.json';
import { useTheme } from '@/hooks/use-theme';
import {
  categoryName,
  cycleName,
  cycleShort,
  formatDate,
  formatPriceInput,
  pricePlaceholder,
  t,
} from '@/i18n';
import { PRICES_AS_OF } from '@/lib/db';
import { formatMoney } from '@/lib/money';
import { ensureReminderPermission } from '@/lib/reminders';
import { createSubscription, listPlans, listServices } from '@/lib/subscriptions';
import { CURRENCIES, CYCLES, type Cycle, type Plan, type Service } from '@/lib/types';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function HeaderButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={12}>
      <Text style={{ color: theme.text, fontSize: 17 }}>{label}</Text>
    </Pressable>
  );
}

// Category and service order as curated in the catalog file (most popular first)
const CATEGORY_ORDER = [...new Set(catalog.map((s) => s.category))];
const CATALOG_RANK = new Map(catalog.map((s, i) => [s.name, i]));
const byRank = (a: Service, b: Service) =>
  (CATALOG_RANK.get(a.name) ?? Infinity) - (CATALOG_RANK.get(b.name) ?? Infinity);

/** A catalog service, or a custom name the user typed (no catalog entry). */
type Selection = Pick<Service, 'name' | 'category' | 'domain'>;

export default function AddSubscriptionScreen() {
  const [selected, setSelected] = useState<Selection | null>(null);
  return selected ? (
    <SubscriptionForm service={selected} onChangeService={() => setSelected(null)} />
  ) : (
    <ServicePicker onSelect={setSelected} />
  );
}

function ServicePicker({ onSelect }: { onSelect: (s: Selection) => void }) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    listServices(db).then(setServices);
  }, [db]);

  const q = query.trim();
  const sections = useMemo(() => {
    if (q) {
      const lower = q.toLowerCase();
      const matches = services.filter((s) => s.name.toLowerCase().includes(lower));
      return [{ title: t('results'), data: matches }];
    }
    const popular = services.filter((s) => s.fromCents !== null).sort(byRank);
    return [
      { title: t('popular'), data: popular },
      ...CATEGORY_ORDER.map((category) => ({
        title: categoryName(category),
        data: services.filter((s) => s.category === category).sort(byRank),
      })),
    ];
  }, [q, services]);

  const hasExactMatch = services.some((s) => s.name.toLowerCase() === q.toLowerCase());

  return (
    <>
      <Stack.Screen
        options={{
          title: t('newSubscription'),
          headerLeft: () => <HeaderButton label={t('cancel')} onPress={close} />,
        }}
      />
      <SectionList
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        sections={sections}
        keyExtractor={(s, i) => `${s.id}-${i}`}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View style={{ gap: Spacing.two }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('searchServices', { count: catalog.length })}
              placeholderTextColor={theme.textSecondary}
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={[
                styles.input,
                { backgroundColor: theme.backgroundElement, color: theme.text },
              ]}
            />
            {q.length > 0 && !hasExactMatch && (
              <Pressable
                onPress={() => onSelect({ name: q, category: 'Other', domain: null })}
                style={[styles.serviceRow, { backgroundColor: theme.backgroundElement }]}>
                <ServiceLogo domain={null} name={q} />
                <View style={styles.flex}>
                  <Text style={[styles.serviceName, { color: theme.text }]}>
                    {t('addCustom', { name: q })}
                  </Text>
                  <Text style={[styles.small, { color: theme.textSecondary }]}>
                    {t('customSubscription')}
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        }
        renderSectionHeader={({ section }) =>
          section.data.length > 0 ? (
            <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
              {section.title}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            style={({ pressed }) => [
              styles.serviceRow,
              { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
            ]}>
            <ServiceLogo domain={item.domain} name={item.name} />
            <View style={styles.flex}>
              <Text style={[styles.serviceName, { color: theme.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.small, { color: theme.textSecondary }]} numberOfLines={1}>
                {categoryName(item.category)}
              </Text>
            </View>
            {item.fromCents !== null && item.fromCurrency && (
              <Text style={[styles.small, { color: theme.textSecondary }]}>
                {t('fromPrice', { price: formatMoney(item.fromCents, item.fromCurrency) })}
              </Text>
            )}
          </Pressable>
        )}
      />
    </>
  );
}

function SubscriptionForm({
  service,
  onChangeService,
}: {
  service: Selection;
  onChangeService: () => void;
}) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<string>('BRL');
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [hasRenewal, setHasRenewal] = useState(false);
  const [renewal, setRenewal] = useState(new Date());
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectPlan(plan: Plan) {
    setPlanId(plan.id);
    setPrice(formatPriceInput(plan.priceCents));
    setCurrency(plan.currency);
    setCycle(plan.cycle);
  }

  useEffect(() => {
    listPlans(db, service.name).then((p) => {
      setPlans(p);
      // Pre-fill with the cheapest monthly plan: the "from" price shown in the list
      if (p.length > 0) selectPlan(p[0]);
    });
  }, [db, service.name]);

  async function save() {
    const value = Number(price.replace(',', '.'));
    if (!price || !Number.isFinite(value) || value < 0) return setError(t('invalidPrice'));

    await createSubscription(db, {
      name: service.name,
      priceCents: Math.round(value * 100),
      currency,
      cycle,
      nextRenewal: hasRenewal ? renewal.toISOString().slice(0, 10) : null,
    });
    // Ask in context: the first time a renewal date is set, so reminders can be scheduled
    if (hasRenewal) await ensureReminderPermission();
    close();
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: service.name,
          headerLeft: () => <HeaderButton label={t('back')} onPress={onChangeService} />,
        }}
      />
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled">
        <View style={[styles.serviceRow, { backgroundColor: theme.backgroundElement }]}>
          <ServiceLogo domain={service.domain} name={service.name} />
          <View style={styles.flex}>
            <Text style={[styles.serviceName, { color: theme.text }]}>{service.name}</Text>
            <Text style={[styles.small, { color: theme.textSecondary }]}>
              {categoryName(service.category)}
            </Text>
          </View>
        </View>

        {plans.length > 0 && (
          <>
            <Label text={t('plan')} />
            <View style={styles.chips}>
              {plans.map((p) => {
                const isSelected = p.id === planId;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => selectPlan(p)}
                    style={[
                      styles.chip,
                      { backgroundColor: isSelected ? theme.text : theme.backgroundElement },
                    ]}>
                    <Text
                      style={{
                        color: isSelected ? theme.background : theme.text,
                        fontWeight: '500',
                      }}>
                      {p.name}
                    </Text>
                    <Text
                      style={{
                        color: isSelected ? theme.background : theme.textSecondary,
                        fontSize: 12,
                      }}>
                      {formatMoney(p.priceCents, p.currency)}
                      {cycleShort(p.cycle)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              {t('referencePrices', { date: formatDate(new Date(PRICES_AS_OF + 'T00:00')) })}
            </Text>
          </>
        )}

        <Label text={t('price')} />
        <TextInput
          value={price}
          onChangeText={(v) => {
            setPrice(v);
            setPlanId(null);
          }}
          placeholder={pricePlaceholder}
          placeholderTextColor={theme.textSecondary}
          keyboardType="decimal-pad"
          style={inputStyle}
        />

        <Label text={t('currency')} />
        <Segmented options={CURRENCIES} value={currency} onChange={setCurrency} />

        <Label text={t('billingCycle')} />
        <Segmented options={CYCLES} value={cycle} onChange={setCycle} label={cycleName} />

        <View style={styles.renewalRow}>
          <Text style={[styles.label, { color: theme.text, marginTop: 0 }]}>
            {t('nextRenewal')}
          </Text>
          <Switch value={hasRenewal} onValueChange={setHasRenewal} />
        </View>
        {hasRenewal &&
          (Platform.OS === 'ios' ? (
            <DateTimePicker
              value={renewal}
              mode="date"
              display="compact"
              onChange={(_, d) => d && setRenewal(d)}
              style={{ alignSelf: 'flex-start' }}
            />
          ) : (
            <>
              <Pressable onPress={() => setShowAndroidPicker(true)} style={inputStyle}>
                <Text style={{ color: theme.text }}>{formatDate(renewal)}</Text>
              </Pressable>
              {showAndroidPicker && (
                <DateTimePicker
                  value={renewal}
                  mode="date"
                  onChange={(_, d) => {
                    setShowAndroidPicker(false);
                    if (d) setRenewal(d);
                  }}
                />
              )}
            </>
          ))}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable onPress={save} style={[styles.save, { backgroundColor: theme.text }]}>
          <Text style={[styles.saveText, { color: theme.background }]}>{t('save')}</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

function Label({ text }: { text: string }) {
  const theme = useTheme();
  return <Text style={[styles.label, { color: theme.textSecondary }]}>{text}</Text>;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label = (o) => o,
}: {
  options: readonly T[];
  value: string;
  onChange: (v: T) => void;
  label?: (o: T) => string;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}>
      {options.map((o) => {
        const isSelected = o === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={[styles.segment, isSelected && { backgroundColor: theme.backgroundSelected }]}>
            <Text style={{ color: theme.text, fontWeight: isSelected ? '600' : '400' }}>
              {label(o)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { padding: Spacing.three, paddingBottom: Spacing.six, gap: Spacing.one },
  formContent: { padding: Spacing.three, paddingBottom: Spacing.six },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.two + Spacing.one,
  },
  serviceName: { fontSize: 16, fontWeight: '500' },
  small: { fontSize: 13 },
  label: { fontSize: 13, marginTop: Spacing.three, marginBottom: Spacing.one },
  input: {
    height: 44,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 2,
  },
  hint: { fontSize: 12, marginTop: Spacing.two },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two, borderRadius: 8 },
  renewalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  error: { color: '#E5484D', marginTop: Spacing.three },
  save: {
    marginTop: Spacing.four,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { fontSize: 16, fontWeight: '600' },
});
