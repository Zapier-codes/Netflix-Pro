import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const VolumeSlider = ({
  volumeLevel,
  hasVolumePermission,
  volumeSliderRef,
  volumePanResponder,
  showControls,
}) => {
  if (!hasVolumePermission) return null;

  const icon = volumeLevel === 0 ? 'volume-mute' : volumeLevel < 0.5 ? 'volume-low' : 'volume-high';

  return (
    // Same ref + panHandlers target as before — useVolume.ts calls
    // .measure() on this exact view to calibrate drag position, so its
    // identity/nesting must stay put even though it's now the glass
    // capsule itself rather than a bare wrapper.
    <View
      ref={volumeSliderRef}
      style={styles.capsule}
      {...(showControls ? volumePanResponder.panHandlers : {})}
    >
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.iconBadge}>
        <Ionicons name={icon} size={16} color="white" />
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { height: `${volumeLevel * 100}%` }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  capsule: {
    position: 'absolute',
    right: 20,
    top: '22%',
    bottom: '22%',
    width: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    paddingVertical: 14,
    justifyContent: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  iconBadge: {
    marginBottom: 12,
  },
  track: {
    flex: 1,
    width: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
});

export default VolumeSlider;
