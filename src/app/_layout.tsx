import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense, useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { BrandTitle } from '@/components/brand-title';
import { t } from '@/i18n';
import { migrate } from '@/lib/db';

SplashScreen.preventAutoHideAsync();

// Keep the list underneath the add sheet even when /add is opened from a link
export const unstable_settings = { anchor: 'index' };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Suspense fallback={null}>
        <SQLiteProvider databaseName="subscriptions.db" onInit={migrate} useSuspense>
          <HideSplash />
          <Stack>
            <Stack.Screen name="index" options={{ title: t('appTitle'), headerTitle: () => <BrandTitle /> }} />
            <Stack.Screen
              name="add"
              options={{
                title: t('newSubscription'),
                presentation: 'formSheet',
                sheetAllowedDetents: [0.9],
              }}
            />
          </Stack>
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}

// Rendered only after the database is ready, so the splash covers the migration
function HideSplash() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return null;
}
