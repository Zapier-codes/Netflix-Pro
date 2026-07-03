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
  // Set of media IDs the current user has already watched, used to
  // suppress the recency badge on cards in this row. Optional — rows
  // that don't care about the badge (e.g. Live Streams) can omit it.
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

  // ─── If no data, don't render ───
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* ─── Title ─── */}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

      {/* ─── Horizontal FlatList ─── */}
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