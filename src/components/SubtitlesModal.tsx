import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLanguageFlag } from '../utils/languageUtils'; // Import the flag utility
import { useTheme } from '../contexts/ThemeContext';
import { SPACING, RADIUS, TYPOGRAPHY, getGlassTokens } from '../theme/tokens';
import { GlassPanel, GlassButton } from './glass';

const SubtitlesModal = ({
  visible,
  onClose,
  availableLanguages, // Expected format: [{ code: 'en', name: 'English' }, ...] or similar
  selectedLanguage,   // e.g., 'en' or null
  onSelectLanguage,
  loading,
}) => {
  const { colors, isDark } = useTheme();
  const glass = getGlassTokens(colors, isDark);

  const renderLanguageItem = ({ item }) => {
    const isSelected = item.code === selectedLanguage || (item.code === 'none' && selectedLanguage === null);
    const isImportAction = item.code === '__import_local__';
    const displayName = item.name; // item.name should already be 'None' or the language name
    const flagEmoji = item.code === 'none' || isImportAction ? '' : getLanguageFlag(item.code); // Get flag, empty for "None"/import row

    return (
      <TouchableOpacity
        style={[
          styles.languageOption,
          isSelected && { backgroundColor: 'rgba(229, 9, 20, 0.12)' },
          isImportAction && styles.importOption,
        ]}
        onPress={() => onSelectLanguage(item.code === 'none' ? null : item.code)}
        activeOpacity={0.7}
      >
        {isImportAction ? (
          <Ionicons name="folder-open-outline" size={20} color="#E50914" style={styles.importIcon} />
        ) : flagEmoji ? (
          <Text style={styles.flagText}>{flagEmoji}</Text>
        ) : (
          <View style={styles.flagPlaceholder} />
        )}
        <Text style={[TYPOGRAPHY.body, { color: colors.text, flex: 1 }, isImportAction && styles.importText]}>
          {displayName}
        </Text>
        {isSelected && !isImportAction && (
          <Ionicons name="checkmark-circle" size={20} color="#E50914" style={styles.checkmarkIcon} />
        )}
      </TouchableOpacity>
    );
  };

  // Add "None" option to the beginning of the list
  const languagesWithOptions = [
    { code: 'none', name: 'None' }, // Ensure 'None' is always an option
    ...(availableLanguages || []).filter(lang => lang && lang.code), // Filter out invalid entries
  ];

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <View style={styles.modalOverlay}>
        <GlassPanel style={styles.modalContent} elevationLevel={4} radius={RADIUS.xl} blurLevel="heavy">
          <View style={[styles.header, { borderBottomColor: glass.surfaceBorder }]}>
            <Text style={[TYPOGRAPHY.h3, { color: colors.text }]}>Subtitles</Text>
            <GlassButton
              icon={<Ionicons name="close" size={20} color={colors.text} />}
              onPress={onClose}
              size={36}
            />
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#E50914" style={styles.loader} />
          ) : (
            <FlatList
              data={languagesWithOptions}
              renderItem={renderLanguageItem}
              keyExtractor={(item) => item.code}
              style={styles.list}
              ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: glass.surfaceBorder }]} />}
              ListEmptyComponent={
                // Show empty only if no actual languages and not loading
                !loading && (!availableLanguages || availableLanguages.length === 0) ? (
                  <View style={styles.emptyContainer}>
                    <Text style={[TYPOGRAPHY.body, { color: colors.textMuted, textAlign: 'center' }]}>
                      No subtitles available for this video.
                    </Text>
                  </View>
                ) : null
              }
            />
          )}
        </GlassPanel>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '62%',
    maxWidth: 520,
    maxHeight: '72%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  list: {
    width: '100%',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SPACING.xl,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md + 2,
    paddingHorizontal: SPACING.xl,
  },
  importOption: {
    marginTop: 2,
  },
  importIcon: {
    marginRight: SPACING.md + 2,
    width: 24,
    textAlign: 'center',
  },
  importText: {
    color: '#E50914',
    fontWeight: '500',
  },
  flagText: {
    color: 'white',
    fontSize: 17,
    marginRight: SPACING.md + 2,
    minWidth: 24,
    textAlign: 'center',
  },
  flagPlaceholder: {
    width: 24,
    marginRight: SPACING.md + 2,
  },
  checkmarkIcon: {
    marginLeft: SPACING.sm + 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xxl + 4,
  },
});

export default SubtitlesModal;
