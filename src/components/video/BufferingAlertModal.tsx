import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { SPACING, RADIUS, TYPOGRAPHY } from '../../theme/tokens';
import { GlassPanel, GlassButton } from '../glass';

const BufferingAlertModal = ({ visible, onKeepBuffering, onRetryExtraction }) => {
  const { colors } = useTheme();

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      supportedOrientations={['landscape-left', 'landscape-right', 'landscape']}
      onRequestClose={onKeepBuffering}
    >
      <View style={styles.modalOverlay}>
        <GlassPanel style={styles.content} elevationLevel={4} radius={RADIUS.xl}>
          <Text style={[TYPOGRAPHY.h3, { color: colors.text, marginBottom: SPACING.md }]}>
            Still Buffering?
          </Text>
          <Text style={[TYPOGRAPHY.body, { color: colors.textSub, textAlign: 'center', marginBottom: SPACING.xl }]}>
            The video has been buffering for a while.
          </Text>
          <View style={styles.actions}>
            <GlassButton label="Keep Buffering" onPress={onKeepBuffering} style={styles.actionButton} />
            <GlassButton
              label="Try Re-Extract"
              onPress={onRetryExtraction}
              style={[styles.actionButton, { borderColor: 'rgba(229, 9, 20, 0.4)' }]}
            />
          </View>
        </GlassPanel>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  content: {
    width: '85%',
    maxWidth: 400,
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
  },
});

export default BufferingAlertModal;
