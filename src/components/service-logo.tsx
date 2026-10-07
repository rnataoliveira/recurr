import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function ServiceLogo({ domain, name }: { domain: string | null; name: string }) {
  const theme = useTheme();
  if (!domain) {
    return (
      <View style={[styles.logo, styles.fallback, { backgroundColor: theme.backgroundSelected }]}>
        <Text style={{ color: theme.text, fontWeight: '600' }}>{name[0]?.toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <Image
      source={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      style={[styles.logo, { backgroundColor: '#fff' }]}
      contentFit="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: { width: 36, height: 36, borderRadius: 8, padding: 4 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
