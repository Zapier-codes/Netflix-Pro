// src/components/video/LockScreenOverlay.tsx
import React from 'react';
import { StyleSheet, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassButton } from '../glass';

interface LockScreenOverlayProps {
  visible: boolean;
  showUnlockHint: boolean;
  hintOpacity: Animated.Value;
  onScreenTap: () => void;
  onUnlock: () => void;
}

const LockScreenOverlay: React.FC<LockScreenOverlayProps> = ({
  visible, showUnlockHint, hintOpacity, onScreenTap, onUnlock,
}) => {
  if (!visible) return null;

  return (
    <Pressable style={styles.overlay} onPress={onScreenTap}>
      {showUnlockHint && (
        <Animated.View style={[styles.unlockContainer, { opacity: hintOpacity }]} pointerEvents="box-none">
          <GlassButton
            icon={<Ionicons name="lock-closed" size={20} color="white" />}
            onPress={onUnlock}
            size={48}
            overrideTint="dark"
          />
        </Animated.View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  unlockContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    zIndex: 20,
  },
});

export default LockScreenOverlay;
