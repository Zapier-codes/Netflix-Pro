// src/contexts/ThemeContext.tsx
import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useAppStore } from '../store/zustand/store';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceHigh: string;
  text: string;
  textSub: string;
  textMuted: string;
  textInverse: string;
  gold: string;
  goldDim: string;
  goldFill: string;
  goldFillStrong: string;
  border: string;
  borderGold: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  playerBackground: string;
  playerGradientStart: string;
  playerGradientMiddle: string;
  playerGradientEnd: string;
  sliderTrack: string;
  sliderThumb: string;
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
  watermarkOpacity: number;
}

const DARK_THEME: ThemeColors = {
  background: '#000000',
  surface: '#0D0D0D',
  surfaceRaised: '#161616',
  surfaceHigh: '#1F1F1F',
  text: '#FFFFFF',
  textSub: '#888888',
  textMuted: '#4A4A4A',
  textInverse: '#000000',
  gold: '#D4AF37',
  goldDim: 'rgba(212, 175, 55, 0.4)',
  goldFill: 'rgba(212, 175, 55, 0.1)',
  goldFillStrong: 'rgba(212, 175, 55, 0.15)',
  border: 'rgba(255, 255, 255, 0.07)',
  borderGold: 'rgba(212, 175, 55, 0.22)',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  playerBackground: '#000000',
  playerGradientStart: '#1A1A1A',
  playerGradientMiddle: '#0D0D0D',
  playerGradientEnd: '#000000',
  sliderTrack: 'rgba(255, 255, 255, 0.25)',
  sliderThumb: '#D4AF37',
  tabBarBackground: '#0D0D0D',
  tabBarActive: '#D4AF37',
  tabBarInactive: '#888888',
  watermarkOpacity: 0.08,
};

const LIGHT_THEME: ThemeColors = {
  background: '#E8F0F8',
  surface: '#FFFFFF',
  surfaceRaised: '#F8FAFE',
  surfaceHigh: '#F0F4FA',
  text: '#1A2A3A',
  textSub: '#4A5568',
  textMuted: '#718096',
  textInverse: '#FFFFFF',
  gold: '#B8860B',
  goldDim: 'rgba(184, 134, 11, 0.4)',
  goldFill: 'rgba(184, 134, 11, 0.12)',
  goldFillStrong: 'rgba(184, 134, 11, 0.18)',
  border: 'rgba(0, 0, 0, 0.08)',
  borderGold: 'rgba(184, 134, 11, 0.25)',
  success: '#059669',
  error: '#DC2626',
  warning: '#D97706',
  info: '#3B82F6',
  playerBackground: '#F0F4F8',
  playerGradientStart: '#F5E6D3',
  playerGradientMiddle: '#E8D5C8',
  playerGradientEnd: '#D4C4B0',
  sliderTrack: 'rgba(0, 0, 0, 0.12)',
  sliderThumb: '#B8860B',
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#B8860B',
  tabBarInactive: '#718096',
  watermarkOpacity: 0.04,
};

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const deviceTheme = useColorScheme();
  const { theme: mode, setTheme, toggleTheme } = useAppStore();

  const colors = useMemo(() => {
    if (mode === 'system') {
      return deviceTheme === 'dark' ? DARK_THEME : LIGHT_THEME;
    }
    return mode === 'dark' ? DARK_THEME : LIGHT_THEME;
  }, [mode, deviceTheme]);

  const isDark = useMemo(() => {
    if (mode === 'system') return deviceTheme === 'dark';
    return mode === 'dark';
  }, [mode, deviceTheme]);

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark, setMode: setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback to dark theme if context not available
    return {
      mode: 'dark',
      colors: DARK_THEME,
      isDark: true,
      setMode: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
};

export const useThemeColors = (): ThemeColors => {
  const { colors } = useTheme();
  return colors;
};

export const useIsDark = (): boolean => {
  const { isDark } = useTheme();
  return isDark;
};
