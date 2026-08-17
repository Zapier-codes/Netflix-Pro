/**
 * AdvancedFilters - Advanced search filters component
 * Features: Language, Certification, Year Range, Rating Range
 * All filters as scrollable pill rows
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

// Filter options
const LANGUAGE_OPTIONS: { label: string; code: string }[] = [
  { label: 'All', code: '' },
  { label: 'English', code: 'en' },
  { label: 'Hindi', code: 'hi' },
  { label: 'Korean', code: 'ko' },
  { label: 'Japanese', code: 'ja' },
  { label: 'Chinese', code: 'zh' },
  { label: 'Spanish', code: 'es' },
  { label: 'French', code: 'fr' },
  { label: 'German', code: 'de' },
  { label: 'Italian', code: 'it' },
  { label: 'Portuguese', code: 'pt' },
  { label: 'Russian', code: 'ru' },
  { label: 'Arabic', code: 'ar' },
  { label: 'Turkish', code: 'tr' },
  { label: 'Thai', code: 'th' },
  { label: 'Vietnamese', code: 'vi' },
];

const CERTIFICATION_OPTIONS: { label: string; code: string }[] = [
  { label: 'All', code: '' },
  { label: 'G', code: 'G' },
  { label: 'PG', code: 'PG' },
  { label: 'PG-13', code: 'PG-13' },
  { label: 'R', code: 'R' },
  { label: 'NC-17', code: 'NC-17' },
  { label: 'TV-Y', code: 'TV-Y' },
  { label: 'TV-Y7', code: 'TV-Y7' },
  { label: 'TV-PG', code: 'TV-PG' },
  { label: 'TV-14', code: 'TV-14' },
  { label: 'TV-MA', code: 'TV-MA' },
];

const YEAR_RANGE_OPTIONS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: '2020-2024', value: '2020-2024' },
  { label: '2010-2019', value: '2010-2019' },
  { label: '2000-2009', value: '2000-2009' },
  { label: '1990-1999', value: '1990-1999' },
  { label: 'Pre-1990', value: 'Pre-1990' },
];

const RATING_OPTIONS: { label: string; value: number }[] = [
  { label: 'Any', value: 0 },
  { label: '7+', value: 7 },
  { label: '8+', value: 8 },
  { label: '9+', value: 9 },
];

export interface AdvancedFiltersState {
  language: string;
  certification: string;
  yearRange: string;
  minRating: number;
}

interface AdvancedFiltersProps {
  filters: AdvancedFiltersState;
  onFilterChange: (filters: AdvancedFiltersState) => void;
  onReset: () => void;
  visible: boolean;
  onClose: () => void;
}

export function AdvancedFilters({
  filters,
  onFilterChange,
  onReset,
  visible,
  onClose,
}: AdvancedFiltersProps) {
  const { colors, isDark } = useTheme();
  const [localFilters, setLocalFilters] = useState<AdvancedFiltersState>(filters);

  const pillBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const pillBorder = (active: boolean) => 
    active ? colors.gold : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');
  const pillText = (active: boolean) => 
    active ? colors.gold : colors.textMuted;

  const renderPillRow = (
    label: string,
    items: { label: string; value: string | number; active: boolean }[],
    onPress: (value: string | number) => void
  ) => (
    <View style={styles.filterRow}>
      <Text style={[styles.filterLabel, { color: colors.textMuted }]}>
        {label}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillScrollContent}
      >
        {items.map((item, index) => (
          <TouchableOpacity
            key={`${label}-${index}`}
            style={[
              styles.pill,
              { backgroundColor: pillBg, borderColor: pillBorder(item.active) },
            ]}
            onPress={() => onPress(item.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, { color: pillText(item.active) }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const handleApply = () => {
    onFilterChange(localFilters);
    onClose();
  };

  const handleReset = () => {
    const defaultFilters: AdvancedFiltersState = {
      language: '',
      certification: '',
      yearRange: '',
      minRating: 0,
    };
    setLocalFilters(defaultFilters);
    onReset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Advanced Filters
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderPillRow(
              'Language',
              LANGUAGE_OPTIONS.map(opt => ({
                label: opt.label,
                value: opt.code,
                active: localFilters.language === opt.code,
              })),
              (value) => setLocalFilters(prev => ({ ...prev, language: value as string }))
            )}

            {renderPillRow(
              'Certification',
              CERTIFICATION_OPTIONS.map(opt => ({
                label: opt.label,
                value: opt.code,
                active: localFilters.certification === opt.code,
              })),
              (value) => setLocalFilters(prev => ({ ...prev, certification: value as string }))
            )}

            {renderPillRow(
              'Year Range',
              YEAR_RANGE_OPTIONS.map(opt => ({
                label: opt.label,
                value: opt.value,
                active: localFilters.yearRange === opt.value,
              })),
              (value) => setLocalFilters(prev => ({ ...prev, yearRange: value as string }))
            )}

            {renderPillRow(
              'Minimum Rating',
              RATING_OPTIONS.map(opt => ({
                label: opt.label,
                value: opt.value,
                active: localFilters.minRating === opt.value,
              })),
              (value) => setLocalFilters(prev => ({ ...prev, minRating: value as number }))
            )}

            {/* Active Filters Summary */}
            {Object.values(localFilters).some(v => v !== '' && v !== 0) && (
              <View style={styles.activeFiltersContainer}>
                <Text style={[styles.activeFiltersLabel, { color: colors.textMuted }]}>
                  Active Filters:
                </Text>
                <View style={styles.activeFiltersRow}>
                  {localFilters.language && (
                    <View style={[styles.activeFilterTag, { borderColor: colors.gold }]}>
                      <Text style={[styles.activeFilterText, { color: colors.text }]}>
                        {LANGUAGE_OPTIONS.find(o => o.code === localFilters.language)?.label}
                      </Text>
                    </View>
                  )}
                  {localFilters.certification && (
                    <View style={[styles.activeFilterTag, { borderColor: colors.gold }]}>
                      <Text style={[styles.activeFilterText, { color: colors.text }]}>
                        {CERTIFICATION_OPTIONS.find(o => o.code === localFilters.certification)?.label}
                      </Text>
                    </View>
                  )}
                  {localFilters.yearRange && (
                    <View style={[styles.activeFilterTag, { borderColor: colors.gold }]}>
                      <Text style={[styles.activeFilterText, { color: colors.text }]}>
                        {YEAR_RANGE_OPTIONS.find(o => o.value === localFilters.yearRange)?.label}
                      </Text>
                    </View>
                  )}
                  {localFilters.minRating > 0 && (
                    <View style={[styles.activeFilterTag, { borderColor: colors.gold }]}>
                      <Text style={[styles.activeFilterText, { color: colors.text }]}>
                        {localFilters.minRating}+
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: colors.textMuted }]}
              onPress={handleReset}
            >
              <Text style={[styles.actionButtonText, { color: colors.textMuted }]}>
                Reset All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.applyButton, { backgroundColor: colors.gold }]}
              onPress={handleApply}
            >
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>
                Apply Filters
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  pillScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    marginRight: 4,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
  },
  activeFiltersContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  activeFiltersLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  activeFilterTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButton: {
    borderWidth: 0,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default AdvancedFilters;