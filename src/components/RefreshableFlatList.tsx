// src/components/RefreshableFlatList.tsx
import React from 'react';
import { FlatList, FlatListProps, RefreshControl, View, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface RefreshableFlatListProps<T> extends FlatListProps<T> {
  refreshing: boolean;
  onRefresh: () => void;
  loadingText?: string;
  emptyText?: string;
  loading?: boolean;
}

export function RefreshableFlatList<T>({
  refreshing,
  onRefresh,
  loadingText = 'Loading...',
  emptyText = 'No content available',
  loading = false,
  ListEmptyComponent,
  ...props
}: RefreshableFlatListProps<T>) {
  const { colors } = useTheme();

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 14 }}>
            {loadingText}
          </Text>
        </View>
      );
    }
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: 16, textAlign: 'center' }}>
          {emptyText}
        </Text>
      </View>
    );
  };

  return (
    <FlatList<T>
      {...props}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.gold}
          colors={[colors.gold]}
          progressBackgroundColor={colors.surface}
        />
      }
      ListEmptyComponent={ListEmptyComponent || renderEmpty()}
    />
  );
}
