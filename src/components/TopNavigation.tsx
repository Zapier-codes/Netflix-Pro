// src/components/TopNavigation.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface TopNavigationProps {
  title?: string;
  showSearch?: boolean;
  showBell?: boolean;
  showFilter?: boolean;
  onSearchPress?: () => void;
  onBellPress?: () => void;
  onFilterPress?: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  title = 'Netflix Pro',
  showSearch = true,
  showBell = true,
  showFilter = true,
  onSearchPress,
  onBellPress,
  onFilterPress,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.gold }]}>{title}</Text>
      <View style={styles.actions}>
        {showSearch && (
          <TouchableOpacity onPress={onSearchPress} style={styles.actionButton}>
            <Ionicons name="search" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        {showFilter && (
          <TouchableOpacity onPress={onFilterPress} style={styles.actionButton}>
            <Ionicons name="options" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        {showBell && (
          <TouchableOpacity onPress={onBellPress} style={styles.actionButton}>
            <Ionicons name="notifications-outline" size={24} color={colors.text} />
            <View style={[styles.badge, { backgroundColor: colors.error }]} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default TopNavigation;
