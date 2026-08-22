// src/components/video/SubtitleSettingsModal.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, RADIUS, TYPOGRAPHY, getGlassTokens } from '../../theme/tokens';
import { GlassPanel, GlassButton } from '../glass';
import { SubtitleStylePrefs } from '../../utils/storage';

interface SubtitleSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  prefs: SubtitleStylePrefs;
  onChange: (prefs: SubtitleStylePrefs) => void;
  onReset: () => void;
}

const FONT_SCALE_STEPS = [0.8, 1.0, 1.2, 1.4, 1.6];
const FONT_SCALE_LABELS: Record<number, string> = {
  0.8: 'Small', 1.0: 'Medium', 1.2: 'Large', 1.4: 'X-Large', 1.6: 'XX-Large',
};

const SubtitleSettingsModal: React.FC<SubtitleSettingsModalProps> = ({
  visible, onClose, prefs, onChange, onReset,
}) => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark, 'dark');

  const adjustDelay = (deltaSeconds: number) => {
    const next = Math.round((prefs.delaySeconds + deltaSeconds) * 10) / 10;
    onChange({ ...prefs, delaySeconds: next });
  };

  const setFontScale = (scale: number) => {
    onChange({ ...prefs, fontScale: scale });
  };

  const cycleBackgroundOpacity = () => {
    const steps = [0, 0.35, 0.65, 1.0];
    const currentIdx = steps.findIndex((s) => Math.abs(s - prefs.backgroundOpacity) < 0.05);
    const next = steps[(currentIdx + 1) % steps.length];
    onChange({ ...prefs, backgroundOpacity: next });
  };

  const backgroundLabel = () => {
    if (prefs.backgroundOpacity <= 0.05) return 'None';
    if (prefs.backgroundOpacity <= 0.4) return 'Light';
    if (prefs.backgroundOpacity <= 0.7) return 'Medium';
    return 'Solid';
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
              <Text style={[TYPOGRAPHY.h3, { color: colors.text }]}>Subtitle Settings</Text>
              <GlassButton
                icon={<Ionicons name="close" size={18} color={colors.text} />}
                onPress={onClose}
                size={32}
                overrideTint="dark"
              />
            </View>

            <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: SPACING.lg }}>
              <Text style={[TYPOGRAPHY.overline, { color: colors.textMuted, marginTop: SPACING.lg }]}>Font Size</Text>
              <View style={styles.rowWrap}>
                {FONT_SCALE_STEPS.map((scale) => {
                  const selected = Math.abs(scale - prefs.fontScale) < 0.05;
                  return (
                    <GlassButton
                      key={scale}
                      label={FONT_SCALE_LABELS[scale]}
                      onPress={() => setFontScale(scale)}
                      overrideTint="dark"
                      style={selected ? { borderColor: '#E50914' } : undefined}
                    />
                  );
                })}
              </View>

              <Text style={[TYPOGRAPHY.overline, { color: colors.textMuted, marginTop: SPACING.xl }]}>Sync (Delay)</Text>
              <View style={styles.delayRow}>
                <GlassButton icon={<Ionicons name="remove" size={18} color={colors.text} />} onPress={() => adjustDelay(-0.5)} overrideTint="dark" />
                <Text style={[TYPOGRAPHY.h2, { color: colors.text, minWidth: 70, textAlign: 'center' }]}>
                  {prefs.delaySeconds > 0 ? '+' : ''}{prefs.delaySeconds.toFixed(1)}s
                </Text>
                <GlassButton icon={<Ionicons name="add" size={18} color={colors.text} />} onPress={() => adjustDelay(0.5)} overrideTint="dark" />
              </View>
              <Text style={[TYPOGRAPHY.caption, { color: colors.textMuted, textAlign: 'center', marginTop: SPACING.sm }]}>
                Negative = subtitles appear earlier. Positive = later.
              </Text>

              <Text style={[TYPOGRAPHY.overline, { color: colors.textMuted, marginTop: SPACING.xl }]}>Background</Text>
              <GlassButton label={backgroundLabel()} onPress={cycleBackgroundOpacity} overrideTint="dark" style={styles.bgButton} />

              <TouchableOpacity style={styles.resetButton} onPress={onReset}>
                <Ionicons name="refresh" size={16} color="#E50914" />
                <Text style={[TYPOGRAPHY.body, { color: '#E50914', marginLeft: SPACING.sm }]}>Reset to defaults</Text>
              </TouchableOpacity>
            </ScrollView>
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
    width: 400,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  body: { paddingHorizontal: SPACING.lg },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: SPACING.sm },
  delayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xl, marginTop: SPACING.sm },
  bgButton: { alignSelf: 'flex-start', marginTop: SPACING.sm },
  resetButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: SPACING.xxl, padding: SPACING.sm },
});

export default SubtitleSettingsModal;
