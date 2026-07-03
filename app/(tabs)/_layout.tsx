// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  const getBottomPadding = () => {
    if (Platform.OS === 'ios') {
      return insets.bottom > 0 ? insets.bottom + 10 : 10;
    }
    return insets.bottom > 0 ? insets.bottom + 12 : 14;
  };

  const getTabBarBackground = () => {
    if (isDark) {
      return 'rgba(8, 8, 8, 0.8)';
    }
    return 'rgba(255, 255, 255, 0.8)';
  };

  const getBorderColor = () => {
    if (isDark) {
      return 'rgba(255, 255, 255, 0.08)';
    }
    return 'rgba(0, 0, 0, 0.08)';
  };

  const getShadowColor = () => {
    if (isDark) {
      return '#000';
    }
    return 'rgba(0, 0, 0, 0.12)';
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 36 : 32,
          left: 48,
          right: 48,
          backgroundColor: getTabBarBackground(),
          borderRadius: 28,
          height: Platform.OS === 'ios' ? 60 : 54,
          paddingBottom: getBottomPadding(),
          paddingTop: 8,
          paddingHorizontal: 14,
          borderTopWidth: 0,
          ...(Platform.OS === 'ios' && {
            backdropFilter: 'blur(24px)',
          }),
          shadowColor: getShadowColor(),
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: isDark ? 0.35 : 0.12,
          shadowRadius: 16,
          elevation: 10,
          borderWidth: 0.5,
          borderColor: getBorderColor(),
        },
        tabBarActiveTintColor: colors.gold || '#D4AF37',
        tabBarInactiveTintColor: colors.textMuted || (isDark ? '#888888' : '#AAAAAA'),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
          marginTop: 2,
          letterSpacing: 0.3,
        },
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 4,
          paddingVertical: 4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string = 'home';
          const iconSize = focused ? size + 2 : size;
          if (route.name === 'index') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'library') {
            iconName = focused ? 'library' : 'library-outline';
          } else if (route.name === 'settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }
          return <Ionicons name={iconName as any} size={iconSize} color={color} />;
        },
      })}
    >
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home',
        }} 
      />
      <Tabs.Screen 
        name="library" 
        options={{ 
          title: 'Library',
        }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{ 
          title: 'Settings',
        }} 
      />
    </Tabs>
  );
}