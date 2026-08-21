import React from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';

const SeekIndicators = ({
  isLiveStream,
  leftSeekAmount,
  rightSeekAmount,
  leftSeekOpacity,
  rightSeekOpacity,
  leftArrowTranslate,
  rightArrowTranslate,
}) => {
  return (
    <>
      {!isLiveStream && leftSeekAmount !== 0 && (
        <Animated.View style={[styles.seekIndicatorLeft, { opacity: leftSeekOpacity }]} pointerEvents="none">
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.seekIndicatorContent}>
            <Animated.View style={{ transform: [{ translateX: leftArrowTranslate }] }}>
              <MaterialIcons name="chevron-left" size={28} color="white" />
            </Animated.View>
            <Text style={styles.seekIndicatorText}>{Math.abs(leftSeekAmount)}s</Text>
          </View>
        </Animated.View>
      )}
      {!isLiveStream && rightSeekAmount !== 0 && (
        <Animated.View style={[styles.seekIndicatorRight, { opacity: rightSeekOpacity }]} pointerEvents="none">
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.seekIndicatorContent}>
            <Text style={styles.seekIndicatorText}>{rightSeekAmount}s</Text>
            <Animated.View style={{ transform: [{ translateX: rightArrowTranslate }] }}>
              <MaterialIcons name="chevron-right" size={28} color="white" />
            </Animated.View>
          </View>
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  seekIndicatorLeft: {
    position: 'absolute',
    left: 60,
    top: '50%',
    transform: [{ translateY: -22 }],
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  seekIndicatorRight: {
    position: 'absolute',
    right: 60,
    top: '50%',
    transform: [{ translateY: -22 }],
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
  },
  seekIndicatorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekIndicatorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginHorizontal: 6,
  },
});

export default SeekIndicators;
