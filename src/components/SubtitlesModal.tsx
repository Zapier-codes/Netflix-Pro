import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { getLanguageFlag } from '../utils/languageUtils'; // Import the flag utility

const SubtitlesModal = ({
visible,
onClose,
availableLanguages, // Expected format: [{ code: 'en', name: 'English' }, ...] or similar
selectedLanguage,   // e.g., 'en' or null
onSelectLanguage,
loading,
}) => {
const renderLanguageItem = ({ item }) => {
const isSelected = item.code === selectedLanguage || (item.code === 'none' && selectedLanguage === null);
const isImportAction = item.code === '__import_local__';
const displayName = item.name; // item.name should already be 'None' or the language name
const flagEmoji = item.code === 'none' || isImportAction ? '' : getLanguageFlag(item.code); // Get flag, empty for "None"/import row

return (
  <TouchableOpacity
    style={[
      styles.languageOption,
      isSelected && styles.languageOptionSelected,
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
    <Text style={[styles.languageText, isImportAction && styles.importText]}>{displayName}</Text>
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
    <BlurView intensity={40} tint="dark" style={styles.modalContent}>
      <View style={styles.header}>
        <Text style={styles.modalTitle}>Subtitles</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButtonIcon} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#E50914" style={styles.loader} />
      ) : (
        <FlatList
          data={languagesWithOptions}
          renderItem={renderLanguageItem}
          keyExtractor={(item) => item.code}
          style={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            // Show empty only if no actual languages and not loading
            !loading && (!availableLanguages || availableLanguages.length === 0) ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No subtitles available for this video.</Text>
              </View>
            ) : null
          }
        />
      )}
    </BlurView>
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
borderRadius: 20,
paddingVertical: 0,
paddingHorizontal: 0,
shadowColor: '#000',
shadowOffset: { width: 0, height: 10 },
shadowOpacity: 0.5,
shadowRadius: 25,
elevation: 30,
overflow: 'hidden',
borderWidth: 1,
borderColor: 'rgba(255, 255, 255, 0.08)',
},
header: {
flexDirection: 'row',
justifyContent: 'space-between',
alignItems: 'center',
paddingHorizontal: 22,
paddingVertical: 18,
borderBottomWidth: StyleSheet.hairlineWidth,
borderBottomColor: 'rgba(255, 255, 255, 0.15)',
},
modalTitle: {
color: 'white',
fontSize: 18,
fontWeight: '600',
letterSpacing: 0.2,
},
closeButtonIcon: {
padding: 4,
borderRadius: 999,
backgroundColor: 'rgba(255, 255, 255, 0.08)',
},
loader: {
flex: 1,
justifyContent: 'center',
alignItems: 'center',
paddingVertical: 28,
},
list: {
width: '100%',
},
separator: {
height: StyleSheet.hairlineWidth,
backgroundColor: 'rgba(255, 255, 255, 0.08)',
marginLeft: 20,
},
languageOption: {
flexDirection: 'row',
alignItems: 'center',
paddingVertical: 14,
paddingHorizontal: 20,
},
languageOptionSelected: {
backgroundColor: 'rgba(229, 9, 20, 0.12)',
},
importOption: {
marginTop: 2,
},
importIcon: {
marginRight: 14,
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
marginRight: 14,
minWidth: 24,
textAlign: 'center',
},
flagPlaceholder: {
  width: 24,
  marginRight: 14,
},
languageText: {
  color: 'rgba(255, 255, 255, 0.92)',
  fontSize: 15.5,
  flex: 1,
},
checkmarkIcon: {
  marginLeft: 10,
},
emptyContainer: {
flex: 1,
justifyContent: 'center',
alignItems: 'center',
padding: 28,
},
emptyText: {
color: 'rgba(255, 255, 255, 0.5)',
textAlign: 'center',
fontSize: 15,
},
});

export default SubtitlesModal;

export default SubtitlesModal;