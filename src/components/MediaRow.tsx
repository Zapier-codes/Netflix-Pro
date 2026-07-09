// src/components/MediaRow.tsx - already fine, just ensure no background
import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import MediaCard from './MediaCard';

interface MediaRowProps {
  title: string;
  data: any[];
  onItemPress: (item: any) => void;
  onInfoPress?: (item: any) => void;
  onRemovePress?: (item: any) => void;
  isContinueWatching?: boolean;
  isLiveStream?: boolean;
  watchedIds?: Set<number | string>;
}

const MediaRow: React.FC<MediaRowProps> = ({
  title,
  data,
  onItemPress,
  onInfoPress,
  onRemovePress,
  isContinueWatching = false,
  isLiveStream = false,
  watchedIds,
}) => {
  const { colors, isDark } = useTheme();

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <FlatList
        horizontal
        data={data}
        keyExtractor={(item, index) => `${item.id || index}-${index}`}
        renderItem={({ item }) => (
          <MediaCard
            item={item}
            onPress={onItemPress}
            onInfoPress={onInfoPress}
            onRemovePress={onRemovePress}
            width={isContinueWatching ? 140 : isLiveStream ? 240 : 100}
            height={isContinueWatching ? 210 : isLiveStream ? 135 : 150}
            isContinueWatching={isContinueWatching}
            isLiveStream={isLiveStream}
            hasWatched={watchedIds ? watchedIds.has(item.id) : false}
          />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    // No backgroundColor here - let the gradient show through
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    marginLeft: 10,
  },
  listContainer: {
    paddingHorizontal: 6,
  },
});

export default MediaRow;