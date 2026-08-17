import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
    <View style={styles.volumeSliderContainer}>
      <Ionicons name={icon} size={20} color="white" style={styles.volumeIcon} />
      <View
        ref={volumeSliderRef}
        style={styles.customVolumeSliderWrapper}
        {...(showControls ? volumePanResponder.panHandlers : {})}
      >
        <View style={styles.customVolumeTrack}>
          <View style={[styles.customVolumeFill, { height: `${volumeLevel * 100}%` }]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  volumeSliderContainer: {
    position: 'absolute',
    right: 20,
    top: '20%',
    bottom: '20%',
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  volumeIcon: {
    marginTop: 10,
  },
  customVolumeSliderWrapper: {
    width: 100,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  customVolumeTrack: {
    width: 4,
    height: 130,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  customVolumeFill: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
});

export default VolumeSlider;
