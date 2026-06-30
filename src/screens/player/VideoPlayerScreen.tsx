// src/screens/player/VideoPlayerScreen.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

const VideoPlayerScreen = () => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.playerBackground }]}>
      <View style={styles.player}>
        <Text style={[styles.placeholder, { color: colors.textMuted }]}>🎬 Video Player</Text>
        <Text style={[styles.subtext, { color: colors.textSub }]}>Player controls will appear here</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  player: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholder: { fontSize: 48, marginBottom: 16 },
  subtext: { fontSize: 16 },
});

export default VideoPlayerScreen;
