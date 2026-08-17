// src/components/MediaRow.tsx
import React from 'react';
import { View, Text, FlatList, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import MediaCard from './MediaCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MediaRowProps {
  title: string;
  data: any[];
  onItemPress: (item: any) => void;
  onInfoPress?: (item: any) => void;
  onRemovePress?: (item: any) => void;
  isContinueWatching?: boolean;
  isLiveStream?: boolean;
  watchedIds?: Set<number | string>;
  cardWidth?: number;
  cardHeight?: number;
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
  cardWidth: customCardWidth,
  cardHeight: customCardHeight,
}) => {
  const { colors, isDark } = useTheme();

  if (!data || data.length === 0) {
    return null;
  }

  // Default card sizes (search screen style)
  const defaultCardWidth = (SCREEN_WIDTH - 16 * 2 - 8 * 3) / 4;
  const defaultCardHeight = defaultCardWidth * 1.5;

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
            width={isContinueWatching ? 140 : (customCardWidth || defaultCardWidth)}
            height={isContinueWatching ? 210 : (customCardHeight || defaultCardHeight)}
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