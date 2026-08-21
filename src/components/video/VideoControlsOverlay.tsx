import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { VideoAirPlayButton } from 'expo-video';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import BrightnessSlider from './BrightnessSlider';
import VolumeSlider from './VolumeSlider';
import LiveIndicator from './LiveIndicator';
import { formatTime } from '../../utils/timeUtils';

const VideoControlsOverlay = ({
  showControls,
  opacityAnim,
  isPlaying,
  isMuted,
  isLiveStream,
  title,
  episodeTitle,
  mediaType,
  season,
  episode,
  position,
  duration,
  isSeeking,
  seekPreviewPosition,
  isAtLiveEdge,
  progressBarRef,
  progressPanResponder,
  onGoBack,
  onTogglePlayPause,
  onToggleMute,
  onSeekBackward,
  onSeekForward,
  onToggleEpisodes,
  onToggleSubtitles,
  subtitlesEnabled,
  selectedLanguage,
  isChangingSource,
  isInitialLoading,
  videoUrl,
  player,
  brightnessLevel,
  hasBrightnessPermission,
  brightnessSliderRef,
  brightnessPanResponder,
  volumeLevel,
  hasVolumePermission,
  volumeSliderRef,
  volumePanResponder,
}) => {
  const displayPosition = isSeeking && seekPreviewPosition !== null ? seekPreviewPosition : position;
  const actualPosition = position;
  const progressPercent = (displayPosition / Math.max(duration, 1)) * 100;
  const timeRemaining = duration - actualPosition;

  return (
    <>
      {/* Soft gradient scrims top/bottom instead of a single flat overlay —
          keeps the center of the screen clear for the video while the
          control clusters at top/bottom still read clearly. */}
      <Animated.View style={[styles.topScrim, { opacity: opacityAnim }]} pointerEvents="none">
        <LinearGradient colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View style={[styles.bottomScrim, { opacity: opacityAnim }]} pointerEvents="none">
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View style={[styles.controlsWrapper, { opacity: opacityAnim, pointerEvents: showControls ? 'box-none' : 'none' }]}>
        <SafeAreaView style={styles.controlsContainer}>
          <TouchableOpacity onPress={onGoBack} style={styles.iconGlassButton} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color="white" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
              {mediaType === 'tv' && episodeTitle ? ` · ${episodeTitle}` : ''}
              {mediaType === 'tv' && (
                <Text style={styles.seasonEpisodeText}>{`  S${season}:E${episode}`}</Text>
              )}
            </Text>
          </View>
          <View style={styles.topRightButtons}>
            {mediaType === 'tv' && !isLiveStream && (
              <TouchableOpacity onPress={onToggleEpisodes} style={styles.iconGlassButton} activeOpacity={0.7}>
                <Ionicons name="albums-outline" size={20} color="white" />
              </TouchableOpacity>
            )}
            {!isLiveStream && (
              <TouchableOpacity onPress={onToggleSubtitles} style={styles.iconGlassButton} activeOpacity={0.7}>
                <Ionicons
                  name="logo-closed-captioning"
                  size={20}
                  color={subtitlesEnabled && selectedLanguage ? '#E50914' : 'white'}
                />
              </TouchableOpacity>
            )}
            {Platform.OS === 'ios' && (
              <View style={styles.airPlayButtonContainer}>
                <VideoAirPlayButton
                  player={player}
                  tint="white"
                  prioritizeVideoDevices={true}
                  style={styles.airPlayButton}
                />
              </View>
            )}
          </View>
        </SafeAreaView>

        <BrightnessSlider
          brightnessLevel={brightnessLevel}
          hasBrightnessPermission={hasBrightnessPermission}
          brightnessSliderRef={brightnessSliderRef}
          brightnessPanResponder={brightnessPanResponder}
          showControls={showControls}
        />

        <VolumeSlider
          volumeLevel={volumeLevel}
          hasVolumePermission={hasVolumePermission}
          volumeSliderRef={volumeSliderRef}
          volumePanResponder={volumePanResponder}
          showControls={showControls}
        />

        {!isLiveStream && (
          <View style={styles.centerControls} pointerEvents={showControls ? 'box-none' : 'none'}>
            <TouchableOpacity style={styles.seekGlassButton} onPress={onSeekBackward} activeOpacity={0.75}>
              <MaterialIcons name="replay-10" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.playGlassButton} onPress={onTogglePlayPause} activeOpacity={0.8}>
              <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name={isPlaying ? "pause" : "play"} size={40} color="white" style={!isPlaying && styles.playIconOffset} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.seekGlassButton} onPress={onSeekForward} activeOpacity={0.75}>
              <MaterialIcons name="forward-10" size={30} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {isLiveStream && (
          <View style={styles.centerControls} pointerEvents={showControls ? 'box-none' : 'none'}>
            <TouchableOpacity style={styles.playGlassButton} onPress={onToggleMute} activeOpacity={0.8}>
              <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={36} color="white" />
            </TouchableOpacity>
          </View>
        )}

        <SafeAreaView style={styles.bottomControls} edges={['bottom']}>
          <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />
          {isLiveStream ? (
            <>
              <View style={styles.timeText} />
              <View style={styles.progressBar} ref={progressBarRef}>
                <View style={[styles.progressFill, { width: `${Math.min(progressPercent, 100)}%` }]} />
                <View style={[styles.progressThumb, { left: `${Math.min(progressPercent, 100)}%` }]} />
                <View style={styles.progressTouchArea} {...(showControls ? progressPanResponder.panHandlers : {})} />
              </View>
              <LiveIndicator isAtLiveEdge={isAtLiveEdge} />
            </>
          ) : (
            <>
              <View style={styles.progressBar} ref={progressBarRef}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                <View style={[styles.progressThumb, { left: `${progressPercent}%` }]} />
                <View style={styles.progressTouchArea} {...(showControls ? progressPanResponder.panHandlers : {})} />
              </View>
              <Text style={styles.timeText}>{formatTime(-timeRemaining, true)}</Text>
            </>
          )}
        </SafeAreaView>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    zIndex: 4,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 4,
  },
  controlsWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  controlsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
    justifyContent: 'center',
  },
  titleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  seasonEpisodeText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
    fontWeight: '400',
  },
  topRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconGlassButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  airPlayButtonContainer: {
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  airPlayButton: {
    width: 32,
    height: 32,
    color: 'white',
    borderColor: 'white',
  },
  centerControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 36,
  },
  playGlassButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  playIconOffset: {
    marginLeft: 4,
  },
  seekGlassButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 12,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  progressBar: {
    flex: 1,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    overflow: 'visible',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E50914',
    borderRadius: 3,
  },
  progressThumb: {
    position: 'absolute',
    top: -7,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#E50914',
    transform: [{ translateX: -10 }],
    zIndex: 3,
    shadowColor: '#E50914',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 5,
  },
  progressTouchArea: {
    position: 'absolute',
    height: 100,
    width: '100%',
    top: -23,
    backgroundColor: 'transparent',
    zIndex: 4,
  },
  timeText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    fontWeight: '500',
    minWidth: 45,
    textAlign: 'center',
  },
});

export default VideoControlsOverlay;
