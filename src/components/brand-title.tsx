import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function BrandTitle() {
  const theme = useTheme();
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel={APP_NAME}>
      <Image source={require('@/assets/images/logo.svg')} style={styles.logo} />
      <Text style={[styles.name, { color: theme.text }]}>{APP_NAME}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logo: { width: 28, height: 28 },
  name: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
});
