import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';

export type MultiSelectItem = {
  value: string;
  title: string;
  subtitle?: string;
  meta?: string;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  items: MultiSelectItem[];
  selectedValues: string[];
  onClose: () => void;
  onSave: (values: string[]) => void;
};

export default function AdminMultiSelectPanel({
  visible,
  title,
  subtitle,
  items,
  selectedValues,
  onClose,
  onSave,
}: Props) {
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();
  const [search, setSearch] = useState('');
  const selectedSignature = useMemo(
    () => selectedValues.map(String).sort().join('|'),
    [selectedValues]
  );

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectedValues.map(String))
  );

  useEffect(() => {
    if (!visible) return;

    setSearch('');
    setSelected(new Set(selectedSignature ? selectedSignature.split('|') : []));
  }, [visible, selectedSignature]);

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

  const toggle = (value: string) => {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }

      return next;
    });
  };

  return (
    <View style={styles.backdrop}>
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <View style={[styles.header, { flexDirection: direction }]}>
          <View style={styles.headerIcon}>
            <Ionicons name="people" size={21} color="#0A2D44" />
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
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </Pressable>
        </View>

        <View
          style={[
            styles.search,
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
            placeholder={isRTL ? 'ابحث عن طالب...' : 'Search students...'}
            placeholderTextColor="#8191A0"
            style={[
              styles.searchInput,
              {
                color: theme.colors.text,
                textAlign,
              },
            ]}
          />

          <View style={styles.counter}>
            <Text style={styles.counterText}>{selected.size}</Text>
          </View>
        </View>

        <FlatList
          data={rows}
          keyExtractor={(item) => item.value}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const active = selected.has(item.value);

            return (
              <Pressable
                onPress={() => toggle(item.value)}
                style={[
                  styles.row,
                  {
                    flexDirection: direction,
                    borderBottomColor: theme.colors.border,
                    backgroundColor: active
                      ? 'rgba(247,184,58,0.08)'
                      : 'transparent',
                  },
                ]}
              >
                <View
                  style={[
                    styles.check,
                    {
                      backgroundColor: active ? '#F7B83A' : theme.colors.surface2,
                      borderColor: active ? '#F7B83A' : theme.colors.border,
                    },
                  ]}
                >
                  {active && (
                    <Ionicons name="checkmark" size={18} color="#0A2D44" />
                  )}
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
                    {item.title}
                  </Text>

                  {!!item.subtitle && (
                    <Text
                      style={[
                        styles.rowSub,
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
                  <Text
                    style={[
                      styles.meta,
                      {
                        color: theme.colors.textSecondary,
                      },
                    ]}
                  >
                    {item.meta}
                  </Text>
                )}
              </Pressable>
            );
          }}
        />

        <View
          style={[
            styles.footer,
            {
              borderTopColor: theme.colors.border,
              flexDirection: direction,
            },
          ]}
        >
          <Pressable
            onPress={() => setSelected(new Set())}
            style={[
              styles.secondary,
              {
                backgroundColor: theme.colors.surface2,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.secondaryText, { color: theme.colors.text }]}>
              {isRTL ? 'إلغاء التحديد' : 'Clear'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => onSave(Array.from(selected))}
            style={styles.save}
          >
            <Ionicons name="checkmark-done" size={20} color="#0A2D44" />
            <Text style={styles.saveText}>
              {isRTL ? 'اعتماد الطلاب' : 'Save Students'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 12000,
    elevation: 12000,
    backgroundColor: 'rgba(5,20,32,0.62)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '92%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    minHeight: 70,
    paddingHorizontal: 15,
    alignItems: 'center',
    gap: 9,
  },
  headerIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 8,
    lineHeight: 12,
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
  search: {
    marginHorizontal: 15,
    height: 51,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 11,
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 49,
    fontSize: 10.5,
    fontWeight: '700',
  },
  counter: {
    minWidth: 31,
    height: 29,
    borderRadius: 10,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  counterText: {
    color: '#0A2D44',
    fontSize: 8.5,
    fontWeight: '900',
  },
  list: {
    paddingTop: 8,
    paddingBottom: 10,
  },
  row: {
    minHeight: 67,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  check: {
    width: 31,
    height: 31,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 10.5,
    fontWeight: '900',
  },
  rowSub: {
    marginTop: 3,
    fontSize: 8,
    fontWeight: '600',
  },
  meta: {
    fontSize: 7,
    fontWeight: '800',
  },
  footer: {
    minHeight: 72,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: 15,
    gap: 8,
  },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 9.5,
    fontWeight: '900',
  },
  save: {
    flex: 2,
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: '#F7B83A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveText: {
    color: '#0A2D44',
    fontSize: 10,
    fontWeight: '900',
  },
});
