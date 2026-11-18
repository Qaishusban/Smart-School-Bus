import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';

export type AdminMapViewMode = 'all' | 'students' | 'buses' | 'route';

type Row = Record<string, any>;

type Props = {
  visible: boolean;
  mode: AdminMapViewMode;
  selectedRouteId: string | null;
  routes: Row[];
  onClose: () => void;
  onApply: (mode: AdminMapViewMode, routeId: string | null) => void;
};

export default function AdminMapFilterModal({
  visible,
  mode,
  selectedRouteId,
  routes,
  onClose,
  onApply,
}: Props) {
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const [draftMode, setDraftMode] = useState<AdminMapViewMode>(mode);
  const [draftRouteId, setDraftRouteId] = useState<string | null>(selectedRouteId);
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    if (!visible) return;
    setDraftMode(mode);
    setDraftRouteId(selectedRouteId);
    setSearch('');
  }, [visible, mode, selectedRouteId]);

  const filteredRoutes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return routes;
    return routes.filter((route) =>
      [route.name, route.direction]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [routes, search]);

  const options: Array<{
    value: AdminMapViewMode;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    ar: string;
    en: string;
    subAr: string;
    subEn: string;
  }> = [
    {
      value: 'all',
      icon: 'layers-outline',
      ar: 'الكل',
      en: 'All',
      subAr: 'الطلاب والباصات وكل المسارات',
      subEn: 'Students, buses and all routes',
    },
    {
      value: 'students',
      icon: 'people-outline',
      ar: 'الطلاب فقط',
      en: 'Students Only',
      subAr: 'عرض مواقع منازل الطلاب فقط',
      subEn: 'Show student home locations only',
    },
    {
      value: 'buses',
      icon: 'bus-outline',
      ar: 'الباصات فقط',
      en: 'Buses Only',
      subAr: 'عرض الباصات المباشرة فقط',
      subEn: 'Show live buses only',
    },
    {
      value: 'route',
      icon: 'git-branch-outline',
      ar: 'خط معين',
      en: 'Specific Route',
      subAr: 'عرض طلاب وباص مسار واحد',
      subEn: 'Show one route with its students and bus',
    },
  ];

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />

          <View style={[styles.header, { flexDirection: direction }]}>
            <View style={styles.headerIcon}>
              <Ionicons name="options-outline" size={21} color="#0A2D44" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.colors.text, textAlign }]}>
                {isRTL ? 'فلاتر الخريطة' : 'Map Filters'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary, textAlign }]}>
                {isRTL
                  ? 'اختر ماذا تريد أن يظهر على الخريطة، ثم اضغط تطبيق.'
                  : 'Choose what should appear on the map, then apply.'}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[
                styles.close,
                { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border },
              ]}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          <View style={styles.optionGrid}>
            {options.map((item) => {
              const active = draftMode === item.value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => {
                    setDraftMode(item.value);
                    if (item.value !== 'route') setDraftRouteId(null);
                  }}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: active ? '#F7B83A' : theme.colors.surface2,
                      borderColor: active ? '#F7B83A' : theme.colors.border,
                    },
                  ]}
                >
                  <View style={[styles.optionIcon, { backgroundColor: active ? '#FFFFFF' : theme.colors.surface }]}>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={active ? '#0A2D44' : theme.colors.textSecondary}
                    />
                  </View>
                  <Text style={[styles.optionTitle, { color: active ? '#0A2D44' : theme.colors.text, textAlign }]}>
                    {isRTL ? item.ar : item.en}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.optionSub,
                      {
                        color: active ? 'rgba(10,45,68,0.72)' : theme.colors.textSecondary,
                        textAlign,
                      },
                    ]}
                  >
                    {isRTL ? item.subAr : item.subEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {draftMode === 'route' && (
            <View style={styles.routeArea}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text, textAlign }]}>
                {isRTL ? 'اختر المسار' : 'Choose Route'}
              </Text>
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
                  placeholder={isRTL ? 'بحث باسم المسار...' : 'Search route name...'}
                  placeholderTextColor="#8191A0"
                  style={[styles.searchInput, { color: theme.colors.text, textAlign }]}
                />
              </View>

              <ScrollView style={styles.routeList} keyboardShouldPersistTaps="handled">
                {filteredRoutes.map((route) => {
                  const active = String(draftRouteId ?? '') === String(route.id);
                  return (
                    <Pressable
                      key={String(route.id)}
                      onPress={() => setDraftRouteId(String(route.id))}
                      style={[
                        styles.routeRow,
                        {
                          flexDirection: direction,
                          borderBottomColor: theme.colors.border,
                          backgroundColor: active ? 'rgba(247,184,58,0.10)' : 'transparent',
                        },
                      ]}
                    >
                      <View style={[styles.routeCheck, { backgroundColor: active ? '#F7B83A' : theme.colors.surface2 }]}>
                        <Ionicons
                          name={active ? 'checkmark' : 'map-outline'}
                          size={18}
                          color="#0A2D44"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.routeTitle, { color: theme.colors.text, textAlign }]}>
                          {String(route.name ?? '—')}
                        </Text>
                        <Text style={[styles.routeSub, { color: theme.colors.textSecondary, textAlign }]}>
                          {route.direction === 'morning'
                            ? isRTL ? 'صباحي' : 'Morning'
                            : route.direction === 'afternoon'
                            ? isRTL ? 'مسائي' : 'Afternoon'
                            : isRTL ? 'صباحي ومسائي' : 'Morning & Afternoon'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <Pressable
            disabled={draftMode === 'route' && !draftRouteId}
            onPress={() => onApply(draftMode, draftMode === 'route' ? draftRouteId : null)}
            style={[
              styles.apply,
              { opacity: draftMode === 'route' && !draftRouteId ? 0.45 : 1 },
            ]}
          >
            <Ionicons name="checkmark-done" size={21} color="#0A2D44" />
            <Text style={styles.applyText}>{isRTL ? 'تطبيق الفلاتر' : 'Apply Filters'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,20,32,0.58)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    padding: 14,
    paddingBottom: 24,
  },
  handle: { width: 46, height: 4, borderRadius: 3, alignSelf: 'center', marginBottom: 9 },
  header: { alignItems: 'center', gap: 9 },
  headerIcon: {
    width: 44, height: 44, borderRadius: 15, backgroundColor: '#F7B83A',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 15, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 8, lineHeight: 12, fontWeight: '600' },
  close: {
    width: 38, height: 38, borderRadius: 13, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  optionCard: { width: '48.7%', minHeight: 122, borderRadius: 20, borderWidth: 1, padding: 11 },
  optionIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { marginTop: 8, fontSize: 10.2, fontWeight: '900' },
  optionSub: { marginTop: 4, fontSize: 7.2, lineHeight: 11, fontWeight: '600' },
  routeArea: { marginTop: 14, maxHeight: 330 },
  sectionTitle: { marginBottom: 7, fontSize: 10.5, fontWeight: '900' },
  search: { height: 48, borderRadius: 15, borderWidth: 1, paddingHorizontal: 10, alignItems: 'center', gap: 7 },
  searchInput: { flex: 1, height: 46, fontSize: 10, fontWeight: '700' },
  routeList: { marginTop: 7, maxHeight: 230 },
  routeRow: { minHeight: 59, alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 3 },
  routeCheck: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  routeTitle: { fontSize: 9.7, fontWeight: '900' },
  routeSub: { marginTop: 2, fontSize: 7.2, fontWeight: '600' },
  apply: {
    height: 52, borderRadius: 17, backgroundColor: '#F7B83A', marginTop: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  applyText: { color: '#0A2D44', fontSize: 10.5, fontWeight: '900' },
});
