import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../../theme/ThemeContext';
import { useLanguage } from '../../../i18n/LanguageContext';
import { AdminCrudRow } from '../../../services/adminCrudService';

type Props = {
  visible: boolean;
  titleAr: string;
  titleEn: string;
  rows: AdminCrudRow[];
  selectedId?: string | null;
  getTitle: (row: AdminCrudRow) => string;
  getSubtitle?: (row: AdminCrudRow) => string;
  onClose: () => void;
  onSelect: (row: AdminCrudRow | null) => void;
  allowClear?: boolean;
};

export default function EntityLookupModal({
  visible,
  titleAr,
  titleEn,
  rows,
  selectedId,
  getTitle,
  getSubtitle,
  onClose,
  onSelect,
  allowClear = true,
}: Props) {
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();
  const [search, setSearch] = useState('');

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return rows;

    return rows.filter((row) => {
      const blob = [
        getTitle(row),
        getSubtitle?.(row) ?? '',
        row.username,
        row.phone,
        row.phone_number,
        row.bus_number,
        row.plate_number,
        row.code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return blob.includes(term);
    });
  }, [rows, search, getTitle, getSubtitle]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <View
            style={[
              styles.header,
              {
                flexDirection: direction,
              },
            ]}
          >
            <View style={styles.headerIcon}>
              <Ionicons name="search" size={21} color="#0A2D44" />
            </View>

            <Text
              style={[
                styles.title,
                {
                  color: theme.colors.text,
                  textAlign,
                },
              ]}
            >
              {isRTL ? titleAr : titleEn}
            </Text>

            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </Pressable>
          </View>

          <View
            style={[
              styles.searchBox,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface2,
                flexDirection: direction,
              },
            ]}
          >
            <Ionicons name="search-outline" size={18} color={theme.colors.textSecondary} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={isRTL ? 'بحث...' : 'Search...'}
              placeholderTextColor={theme.colors.textSecondary}
              style={[
                styles.searchInput,
                {
                  color: theme.colors.text,
                  textAlign,
                },
              ]}
            />
          </View>

          {allowClear && (
            <Pressable
              onPress={() => {
                onSelect(null);
                onClose();
              }}
              style={[
                styles.clearRow,
                {
                  borderBottomColor: theme.colors.border,
                  flexDirection: direction,
                },
              ]}
            >
              <View style={styles.clearIcon}>
                <Ionicons name="close-circle-outline" size={20} color="#D92D20" />
              </View>
              <Text
                style={[
                  styles.clearText,
                  {
                    color: theme.colors.text,
                  },
                ]}
              >
                {isRTL ? 'بدون اختيار' : 'No selection'}
              </Text>
            </Pressable>
          )}

          <FlatList
            data={visibleRows}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const selected = String(item.id) === String(selectedId ?? '');

              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    onClose();
                  }}
                  style={[
                    styles.row,
                    {
                      borderBottomColor: theme.colors.border,
                      backgroundColor: selected ? '#FFF8E7' : 'transparent',
                      flexDirection: direction,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      {
                        backgroundColor: selected ? '#F7B83A' : theme.colors.surface2,
                      },
                    ]}
                  >
                    <Ionicons
                      name={selected ? 'checkmark' : 'person-outline'}
                      size={19}
                      color="#0A2D44"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.rowTitle,
                        {
                          color: theme.colors.text,
                          textAlign,
                        },
                      ]}
                    >
                      {getTitle(item)}
                    </Text>

                    {!!getSubtitle?.(item) && (
                      <Text
                        style={[
                          styles.rowSubtitle,
                          {
                            color: theme.colors.textSecondary,
                            textAlign,
                          },
                        ]}
                      >
                        {getSubtitle(item)}
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={36} color="#98A2B3" />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  {isRTL ? 'لا توجد نتائج' : 'No results'}
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sheet: {
    maxHeight: '80%',
    borderRadius: 24,
    overflow: 'hidden',
  },
  header: {
    minHeight: 66,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
  },
  searchBox: {
    marginHorizontal: 12,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 11,
    alignItems: 'center',
    gap: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 10,
    fontWeight: '600',
  },
  clearRow: {
    minHeight: 54,
    marginTop: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  clearIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FEF3F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontSize: 10,
    fontWeight: '800',
  },
  list: {
    paddingBottom: 10,
  },
  row: {
    minHeight: 66,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 11,
    fontWeight: '900',
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 8,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '700',
  },
});
