// src/components/video/PlaybackSpeedModal.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, RADIUS, TYPOGRAPHY, getGlassTokens } from '../../theme/tokens';
import { GlassPanel, GlassButton } from '../glass';
import { PLAYBACK_SPEEDS } from '../../hooks/usePlaybackSpeed';

interface PlaybackSpeedModalProps {
  visible: boolean;
  onClose: () => void;
  currentSpeed: number;
  onSelectSpeed: (speed: number) => void;
}

const speedLabel = (speed: number): string => {
  if (speed === 1.0) return 'Normal';
  return `${speed}x`;
};

const PlaybackSpeedModal: React.FC<PlaybackSpeedModalProps> = ({
  visible, onClose, currentSpeed, onSelectSpeed,
}) => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark, 'dark');

  const renderItem = ({ item }: { item: number }) => {
    const isSelected = item === currentSpeed;
    return (
      <TouchableOpacity
        style={[styles.speedOption, isSelected && { backgroundColor: 'rgba(229, 9, 20, 0.12)' }]}
        onPress={() => { onSelectSpeed(item); onClose(); }}
        activeOpacity={0.7}
      >
        <Text style={[TYPOGRAPHY.body, { color: colors.text }]}>{speedLabel(item)}</Text>
        {isSelected && <Ionicons name="checkmark-circle" size={20} color="#E50914" />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <GlassPanel style={styles.panel} overrideTint="dark">
            <View style={[styles.header, { borderBottomColor: glass.surfaceBorder }]}>
              <Text style={[TYPOGRAPHY.h3, { color: colors.text }]}>Playback Speed</Text>
              <GlassButton
                icon={<Ionicons name="close" size={18} color={colors.text} />}
                onPress={onClose}
                size={32}
                overrideTint="dark"
              />
            </View>
            <FlatList
              data={PLAYBACK_SPEEDS}
              renderItem={renderItem}
              keyExtractor={(item) => String(item)}
            />
          </GlassPanel>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    width: 320,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  speedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
});

export default PlaybackSpeedModal;
