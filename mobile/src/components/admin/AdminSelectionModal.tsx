import React, { useEffect, useMemo, useState } from 'react';
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

import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';

export type SelectionItem = {
  value: string;
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  raw?: Record<string, any>;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  items: SelectionItem[];
  selectedValue?: string | null;
  allowClear?: boolean;
  clearLabel?: string;
  embedded?: boolean;
  onClose: () => void;
  onSelect: (value: string | null, item?: SelectionItem | null) => void;
};

export default function AdminSelectionModal({
  visible,
  title,
  subtitle,
  items,
  selectedValue,
  allowClear = true,
  clearLabel,
  embedded = false,
  onClose,
  onSelect,
}: Props) {
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (visible) {
      setSearch('');
    }
  }, [visible, title]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;

    return items.filter((item) =>
      [item.title, item.subtitle, item.meta]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [items, search]);

  if (!visible) return null;

  const content = (
    <View style={embedded ? styles.embeddedBackdrop : styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          embedded && styles.embeddedSheet,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />

        <View style={[styles.header, { flexDirection: direction }]}>
          <View style={styles.iconBox}>
            <Ionicons name="search" size={20} color="#0A2D44" />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.title,
                {
                  color: theme.colors.text,
                  textAlign,
                },
              ]}
            >
              {title}
            </Text>

            {!!subtitle && (
              <Text
                style={[
                  styles.subtitle,
                  {
                    color: theme.colors.textSecondary,
                    textAlign,
                  },
                ]}
              >
                {subtitle}
              </Text>
            )}
          </View>

          <Pressable
            onPress={onClose}
            style={[
              styles.close,
              {
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Ionicons name="close" size={21} color={theme.colors.text} />
          </Pressable>
        </View>

        <View
          style={[
            styles.searchBox,
            {
              flexDirection: direction,
              backgroundColor: theme.colors.surface2,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Ionicons name="search-outline" size={18} color="#8191A0" />

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={isRTL ? 'ابحث بالاسم أو الرقم...' : 'Search by name or number...'}
            placeholderTextColor="#8191A0"
            style={[
              styles.searchInput,
              {
                color: theme.colors.text,
                textAlign,
              },
            ]}
          />

          {!!search && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={19} color="#8191A0" />
            </Pressable>
          )}
        </View>

        {allowClear && (
          <Pressable
            onPress={() => {
              onSelect(null, null);
              onClose();
            }}
            style={[
              styles.clearRow,
              {
                flexDirection: direction,
                borderBottomColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.clearIcon}>
              <Ionicons name="remove-circle-outline" size={20} color="#D94A4A" />
            </View>

            <Text
              style={[
                styles.clearText,
                {
                  color: theme.colors.text,
                  textAlign,
                },
              ]}
            >
              {clearLabel ?? (isRTL ? 'بدون اختيار' : 'No selection')}
            </Text>
          </Pressable>
        )}

        <FlatList
          data={rows}
          keyExtractor={(item) => item.value}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const selected = String(selectedValue ?? '') === String(item.value);

            return (
              <Pressable
                onPress={() => {
                  onSelect(item.value, item);
                  onClose();
                }}
                style={[
                  styles.row,
                  {
                    flexDirection: direction,
                    backgroundColor: selected
                      ? 'rgba(247,184,58,0.10)'
                      : 'transparent',
                    borderBottomColor: theme.colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    {
                      backgroundColor: selected
                        ? '#F7B83A'
                        : theme.colors.surface2,
                    },
                  ]}
                >
                  <Ionicons
                    name={selected ? 'checkmark' : item.icon ?? 'ellipse-outline'}
                    size={19}
                    color="#0A2D44"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.rowTitle,
                      {
                        color: theme.colors.text,
                        textAlign,
                      },
                    ]}
                  >
                    {item.title}
                  </Text>

                  {!!item.subtitle && (
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.rowSubtitle,
                        {
                          color: theme.colors.textSecondary,
                          textAlign,
                        },
                      ]}
                    >
                      {item.subtitle}
                    </Text>
                  )}
                </View>

                {!!item.meta && (
                  <View
                    style={[
                      styles.metaBadge,
                      {
                        backgroundColor: theme.colors.surface2,
                        borderColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                      {item.meta}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="search-outline" size={28} color="#8191A0" />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {isRTL ? 'لا توجد نتائج' : 'No results'}
              </Text>
              <Text style={[styles.emptySub, { color: theme.colors.textSecondary }]}>
                {isRTL ? 'جرّب كلمة بحث مختلفة.' : 'Try a different search term.'}
              </Text>
            </View>
          }
        />
      </View>
    </View>
  );

  if (embedded) {
    return content;
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,20,32,0.50)',
    justifyContent: 'flex-end',
  },
  embeddedBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    backgroundColor: 'rgba(5,20,32,0.58)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '86%',
    minHeight: '58%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    paddingTop: 8,
    overflow: 'hidden',
  },
  embeddedSheet: {
    maxHeight: '92%',
  },
  handle: {
    width: 46,
    height: 4,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    minHeight: 62,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 8.5,
    fontWeight: '600',
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    height: 50,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 11,
    fontWeight: '700',
  },
  clearRow: {
    minHeight: 56,
    marginTop: 8,
    paddingHorizontal: 17,
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  clearIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(217,74,74,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '800',
  },
  list: {
    paddingBottom: 34,
  },
  row: {
    minHeight: 68,
    paddingHorizontal: 17,
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 11,
    fontWeight: '900',
  },
  rowSubtitle: {
    marginTop: 3,
    fontSize: 8.5,
    fontWeight: '600',
  },
  metaBadge: {
    minHeight: 28,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaText: {
    fontSize: 7.5,
    fontWeight: '800',
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: 'rgba(129,145,160,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '900',
  },
  emptySub: {
    marginTop: 4,
    fontSize: 9,
    fontWeight: '600',
  },
});
