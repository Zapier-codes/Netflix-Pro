// src/components/RefreshableScrollView.tsx
import React from 'react';
import { RefreshControl, ScrollView, ScrollViewProps, ActivityIndicator, View, Text } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface RefreshableScrollViewProps extends ScrollViewProps {
  refreshing: boolean;
  onRefresh: () => void;
  loadingText?: string;
  emptyText?: string;
  empty?: boolean;
}

export const RefreshableScrollView: React.FC<RefreshableScrollViewProps> = ({
  refreshing,
  onRefresh,
  loadingText = 'Loading...',
  emptyText = 'No content available',
  empty = false,
  children,
  ...props
}) => {
  const { colors } = useTheme();

  if (empty) {
    return (
      <ScrollView
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
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, minHeight: 400 }}>
          <Text style={{ color: colors.textMuted, fontSize: 16, textAlign: 'center' }}>
            {emptyText}
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
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
    >
      {children}
    </ScrollView>
  );
};
