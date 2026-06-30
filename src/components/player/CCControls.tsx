// src/components/player/CCControls.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Modal,
  ScrollView,
  Switch,
  Slider,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

interface CCControlsProps {
  subtitlesEnabled: boolean;
  selectedLanguage: string;
  availableLanguages: string[];
  subtitleSize: number;
  onToggleSubtitles: () => void;
  onSelectLanguage: (language: string) => void;
  onSubtitleSizeChange: (size: number) => void;
  onSubtitleColorChange?: (color: string) => void;
  onSubtitleBackgroundChange?: (color: string) => void;
}

export const CCControls: React.FC<CCControlsProps> = ({
  subtitlesEnabled,
  selectedLanguage,
  availableLanguages,
  subtitleSize,
  onToggleSubtitles,
  onSelectLanguage,
  onSubtitleSizeChange,
  onSubtitleColorChange,
  onSubtitleBackgroundChange,
}) => {
  const { colors } = useTheme();
  const [showOverlay, setShowOverlay] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPress, setIsLongPress] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // ─────────────────────────────────────────────────────────────────────────
  // LONG PRESS HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handlePressIn = () => {
    setIsLongPress(false);
    const timer = setTimeout(() => {
      setIsLongPress(true);
      openOverlay();
    }, 500);
    setLongPressTimer(timer);
  };

  const handlePressOut = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    if (!isLongPress) {
      // Short press = toggle subtitles
      onToggleSubtitles();
    }
    setIsLongPress(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // OVERLAY ANIMATIONS
  // ─────────────────────────────────────────────────────────────────────────

  const openOverlay = () => {
    setShowOverlay(true);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeOverlay = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 0.9,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowOverlay(false);
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // COLORS
  // ─────────────────────────────────────────────────────────────────────────

  const [customColor, setCustomColor] = useState('#FFFFFF');
  const [customBackground, setCustomBackground] = useState('#000000');

  const colorOptions = [
    '#FFFFFF', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1',
    '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF69B4', '#00FF7F'
  ];

  const backgroundOptions = [
    '#000000', '#1A1A1A', '#333333', '#444444', '#555555',
    'transparent'
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* CC Button with Long Press */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.ccButton, { backgroundColor: colors.surfaceRaised }]}
      >
        <View style={styles.ccButtonContent}>
          <Ionicons
            name={subtitlesEnabled ? 'closed-captioning' : 'closed-captioning-outline'}
            size={22}
            color={subtitlesEnabled ? colors.gold : colors.textMuted}
          />
          <Text
            style={[
              styles.ccLabel,
              {
                color: subtitlesEnabled ? colors.gold : colors.textMuted,
              },
            ]}
          >
            CC
          </Text>
          {selectedLanguage && subtitlesEnabled && (
            <Text style={[styles.ccLang, { color: colors.textSub }]}>
              {selectedLanguage.toUpperCase()}
            </Text>
          )}
        </View>
        <Text style={[styles.ccHint, { color: colors.textMuted }]}>
          Tap to toggle • Long press for settings
        </Text>
      </TouchableOpacity>

      {/* CC Settings Overlay */}
      <Modal
        visible={showOverlay}
        transparent
        animationType="none"
        onRequestClose={closeOverlay}
      >
        <Animated.View
          style={[
            styles.overlay,
            {
              opacity: overlayOpacity,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.overlayBackground}
            activeOpacity={1}
            onPress={closeOverlay}
          />

          <Animated.View
            style={[
              styles.overlayContent,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Header */}
            <View style={styles.overlayHeader}>
              <Text style={[styles.overlayTitle, { color: colors.text }]}>
                Subtitles Settings
              </Text>
              <TouchableOpacity onPress={closeOverlay}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Toggle */}
              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="closed-captioning" size={20} color={colors.gold} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Subtitles
                  </Text>
                </View>
                <Switch
                  value={subtitlesEnabled}
                  onValueChange={onToggleSubtitles}
                  trackColor={{ false: colors.surfaceRaised, true: colors.gold }}
                  thumbColor="#fff"
                />
              </View>

              {/* Language */}
              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="language" size={20} color={colors.gold} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Language
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.languageScroll}
                >
                  {availableLanguages.map((lang) => (
                    <TouchableOpacity
                      key={lang}
                      style={[
                        styles.languageChip,
                        selectedLanguage === lang && { backgroundColor: colors.gold },
                        { borderColor: colors.border },
                      ]}
                      onPress={() => {
                        onSelectLanguage(lang);
                      }}
                    >
                      <Text
                        style={[
                          styles.languageChipText,
                          selectedLanguage === lang && { color: '#000' },
                          { color: colors.text },
                        ]}
                      >
                        {lang.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Size */}
              <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                <View style={styles.settingInfo}>
                  <Ionicons name="text" size={20} color={colors.gold} />
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Font Size
                  </Text>
                </View>
                <View style={styles.sizeControls}>
                  <TouchableOpacity
                    style={[styles.sizeButton, { borderColor: colors.border }]}
                    onPress={() => onSubtitleSizeChange(Math.max(75, subtitleSize - 10))}
                  >
                    <Text style={[styles.sizeButtonText, { color: colors.text }]}>A-</Text>
                  </TouchableOpacity>
                  <Text style={[styles.sizeValue, { color: colors.text }]}>
                    {subtitleSize}%
                  </Text>
                  <TouchableOpacity
                    style={[styles.sizeButton, { borderColor: colors.border }]}
                    onPress={() => onSubtitleSizeChange(Math.min(150, subtitleSize + 10))}
                  >
                    <Text style={[styles.sizeButtonText, { color: colors.text }]}>A+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Font Color */}
              {onSubtitleColorChange && (
                <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="color-palette" size={20} color={colors.gold} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      Font Color
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {colorOptions.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color },
                          customColor === color && styles.colorOptionActive,
                        ]}
                        onPress={() => {
                          setCustomColor(color);
                          if (onSubtitleColorChange) onSubtitleColorChange(color);
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Background Color */}
              {onSubtitleBackgroundChange && (
                <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.settingInfo}>
                    <Ionicons name="square-outline" size={20} color={colors.gold} />
                    <Text style={[styles.settingLabel, { color: colors.text }]}>
                      Background
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {backgroundOptions.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[
                          styles.colorOption,
                          { backgroundColor: color !== 'transparent' ? color : colors.surface },
                          customBackground === color && styles.colorOptionActive,
                          color === 'transparent' && styles.colorOptionBorder,
                        ]}
                        onPress={() => {
                          setCustomBackground(color);
                          if (onSubtitleBackgroundChange) onSubtitleBackgroundChange(color);
                        }}
                      >
                        {color === 'transparent' && (
                          <View style={styles.transparentIndicator} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  ccButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  ccButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ccLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 2,
  },
  ccLang: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 4,
  },
  ccHint: {
    fontSize: 9,
    marginTop: 2,
    opacity: 0.5,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  overlayContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 20,
    maxWidth: 400,
  },
  overlayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  overlayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  languageScroll: {
    flex: 1,
    marginLeft: 10,
  },
  languageChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  languageChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  sizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sizeButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  sizeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  sizeValue: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'center',
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionActive: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
  },
  colorOptionBorder: {
    borderColor: 'rgba(255,255,255,0.3)',
  },
  transparentIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});

export default CCControls;
