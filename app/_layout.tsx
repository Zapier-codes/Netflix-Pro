import { Stack } from 'expo-router';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { AlertProvider } from '../src/contexts/AlertContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function AppContent() {
  const { isDark } = useTheme();
  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="movie/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="player/[id]" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AlertProvider>
        <AppContent />
      </AlertProvider>
    </ThemeProvider>
  );
}
