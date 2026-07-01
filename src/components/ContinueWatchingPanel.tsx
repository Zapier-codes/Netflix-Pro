// src/components/ContinueWatchingPanel.tsx
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useContinueWatching } from '../store/zustand';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = SCREEN_WIDTH * 0.85;
const PANEL_OFFSET = SCREEN_WIDTH - 80;

interface ContinueWatchingPanelProps {
  onItemPress?: (item: any) => void;
  visible: boolean;
  onClose: () => void;
}

export const ContinueWatchingPanel: React.FC<ContinueWatchingPanelProps> = ({
  onItemPress,
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const { items } = useContinueWatching();
  const [isOpen, setIsOpen] = useState(false);
  const translateX = useRef(new Animated.Value(PANEL_OFFSET)).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const newX = PANEL_OFFSET + gestureState.dx;
        if (newX >= 0 && newX <= PANEL_OFFSET) {
          translateX.setValue(newX);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const shouldOpen = gestureState.dx < -50;
        const shouldClose = gestureState.dx > 50;
        
        if (shouldOpen) {
          openPanel();
        } else if (shouldClose) {
          closePanel();
        } else if (isOpen) {
          openPanel();
        } else {
          closePanel();
        }
      },
    })
  ).current;

  const openPanel = () => {
    setIsOpen(true);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  };

  const closePanel = () => {
    setIsOpen(false);
    Animated.spring(translateX, {
      toValue: PANEL_OFFSET,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
    onClose();
  };

  const handleItemPress = (item: any) => {
    if (onItemPress) {
      onItemPress(item);
    }
    closePanel();
  };

  // If no items or not visible, render nothing
  if (!visible || items.length === 0) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateX }],
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Handle */}
      <View style={[styles.handle, { backgroundColor: colors.border }]} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Continue Watching
        </Text>
        <TouchableOpacity onPress={closePanel} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Live Viewer Count */}
      <View style={[styles.liveCounter, { backgroundColor: colors.surfaceRaised }]}>
        <View style={styles.liveDot} />
        <Text style={[styles.liveText, { color: colors.textSub }]}>
          {items.length} {items.length === 1 ? 'item' : 'items'} in queue
        </Text>
      </View>

      {/* Items List */}
      {items.map((item, index) => (
        <TouchableOpacity
          key={item.id}
          style={[
            styles.panelItem,
            index < items.length - 1 && { borderBottomColor: colors.border },
          ]}
          onPress={() => handleItemPress(item)}
        >
          <Image
            source={{ uri: item.posterPath || 'https://via.placeholder.com/80x120' }}
            style={styles.panelThumbnail}
          />
          <View style={styles.panelItemInfo}>
            <Text style={[styles.panelItemTitle, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            {item.episodeTitle && (
              <Text style={[styles.panelItemEpisode, { color: colors.textSub }]}>
                {item.episodeTitle}
              </Text>
            )}
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: colors.surfaceRaised }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: colors.gold, width: ${item.progress || 0}% },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textMuted }]}>
                {Math.round(item.progress || 0)}%
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      ))}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          Swipe right to close • Tap to continue
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: PANEL_WIDTH,
    height: '100%',
    paddingTop: 48,
    paddingHorizontal: 16,
    borderLeftWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
    zIndex: 100,
  },
  handle: {
    position: 'absolute',
    top: 16,
    left: '50%',
    transform: [{ translateX: -20 }],
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  liveCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E50914',
    marginRight: 8,
  },
  liveText: {
    fontSize: 13,
  },
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  panelThumbnail: {
    width: 50,
    height: 70,
    borderRadius: 4,
    marginRight: 12,
  },
  panelItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  panelItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  panelItemEpisode: {
    fontSize: 12,
    marginBottom: 4,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 11,
    width: 32,
    textAlign: 'right',
  },
  footer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#222',
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default ContinueWatchingPanel;
