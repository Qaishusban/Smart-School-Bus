import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Camera, Map as MapView, Marker } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';

import { MAP_CONFIG } from '../../config/mapConfig';
import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';

type CameraHandle = React.ElementRef<typeof Camera>;

type Props = {
  visible: boolean;
  latitude?: number | null;
  longitude?: number | null;
  onClose: () => void;
  onConfirm: (lat: number, lng: number, address?: string) => void;
};

function coordFromEvent(event: any): [number, number] | null {
  const candidates = [
    event?.geometry?.coordinates,
    event?.coordinates,
    event?.lngLat,
    event?.nativeEvent?.geometry?.coordinates,
    event?.nativeEvent?.coordinates,
    event?.nativeEvent?.lngLat,
    event?.nativeEvent?.coordinate
      ? [event.nativeEvent.coordinate.longitude, event.nativeEvent.coordinate.latitude]
      : null,
  ];

  for (const value of candidates) {
    if (Array.isArray(value) && value.length >= 2) {
      const lng = Number(value[0]);
      const lat = Number(value[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return [lng, lat];
    }
  }

  return null;
}

function valid(lat: unknown, lng: unknown) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));
}

export default function TeacherLocationPickerPanel({
  visible,
  latitude,
  longitude,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();
  const cameraRef = useRef<CameraHandle>(null);

  const [selected, setSelected] = useState<[number, number]>([
    valid(latitude, longitude) ? Number(longitude) : MAP_CONFIG.defaultCenter.longitude,
    valid(latitude, longitude) ? Number(latitude) : MAP_CONFIG.defaultCenter.latitude,
  ]);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (!visible) return;

    const next: [number, number] = [
      valid(latitude, longitude) ? Number(longitude) : MAP_CONFIG.defaultCenter.longitude,
      valid(latitude, longitude) ? Number(latitude) : MAP_CONFIG.defaultCenter.latitude,
    ];

    setSelected(next);
    setSearch('');
    setAddress('');

    setTimeout(() => {
      cameraRef.current?.easeTo({
        center: next,
        zoom: valid(latitude, longitude) ? 16 : MAP_CONFIG.defaultZoom,
        duration: 300,
      });
    }, 100);
  }, [visible, latitude, longitude]);

  if (!visible) return null;

  async function reverse(lat: number, lng: number) {
    try {
      const rows = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const row = rows[0];
      const label = [
        row?.name,
        row?.street,
        row?.district,
        row?.city,
        row?.region,
      ].filter(Boolean).join('، ');

      setAddress(label);
      return label;
    } catch {
      setAddress('');
      return '';
    }
  }

  async function choose(lng: number, lat: number) {
    setSelected([lng, lat]);
    cameraRef.current?.easeTo({ center: [lng, lat], zoom: 17, duration: 300 });
    await reverse(lat, lng);
  }

  async function useCurrent() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(isRTL ? 'صلاحية الموقع مطلوبة' : 'Location Permission Required');
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await choose(current.coords.longitude, current.coords.latitude);
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر تحديد الموقع' : 'Location Failed', error?.message ?? String(error));
    }
  }

  async function searchPlace() {
    const term = search.trim();
    if (!term) return;

    setSearching(true);

    try {
      const result = await Location.geocodeAsync(term);

      if (!result.length) {
        Alert.alert(isRTL ? 'لم يتم العثور على الموقع' : 'Location Not Found');
        return;
      }

      await choose(result[0].longitude, result[0].latitude);
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر البحث' : 'Search Failed', error?.message ?? String(error));
    } finally {
      setSearching(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
        <Pressable onPress={onClose} style={[styles.smallButton, { backgroundColor: theme.colors.surface2 }]}>
          <Ionicons name="close" size={20} color={theme.colors.text} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.colors.text, textAlign }]}>
            {isRTL ? 'تحديد موقع المعلم' : 'Teacher Location'}
          </Text>
          <Text style={[styles.sub, { color: theme.colors.textSecondary, textAlign }]}>
            {isRTL ? 'اضغط على أي مكان في الخريطة أو استخدم الموقع الحالي أو البحث.' : 'Tap anywhere on the map, use current location, or search.'}
          </Text>
        </View>

        <Pressable onPress={() => void useCurrent()} style={styles.locateButton}>
          <Ionicons name="locate" size={19} color="#0A2D44" />
        </Pressable>
      </View>

      <View style={[styles.search, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
        <Ionicons name="search" size={18} color="#8191A0" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => void searchPlace()}
          placeholder={isRTL ? 'ابحث عن منطقة أو شارع...' : 'Search area or street...'}
          placeholderTextColor="#8191A0"
          style={[styles.searchInput, { color: theme.colors.text, textAlign }]}
        />
        {!!search && (
          <Pressable onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#8191A0" />
          </Pressable>
        )}
        <Pressable onPress={() => void searchPlace()} style={styles.searchButton}>
          {searching ? <ActivityIndicator size="small" color="#0A2D44" /> : <Ionicons name="arrow-forward" size={17} color="#0A2D44" />}
        </Pressable>
      </View>

      <View style={styles.map}>
        <MapView
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_CONFIG.developmentStyle}
          attribution
          logo
          compass
          androidView="texture"
          onPress={(event: any) => {
            const coord = coordFromEvent(event);
            if (coord) void choose(coord[0], coord[1]);
          }}
        >
          <Camera
            ref={cameraRef}
            initialViewState={{
              center: selected,
              zoom: valid(latitude, longitude) ? 16 : MAP_CONFIG.defaultZoom,
            }}
            minZoom={3}
            maxZoom={20}
          />

          <Marker id="teacher-location-selected" lngLat={selected} anchor="bottom">
            <View style={styles.pinWrap}>
              <Ionicons name="location" size={35} color="#D92D20" />
            </View>
          </Marker>
        </MapView>

        <View style={styles.coords}>
          <Ionicons name="location-outline" size={14} color="#F7B83A" />
          <Text style={styles.coordsText}>
            {selected[1].toFixed(6)}, {selected[0].toFixed(6)}
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        {!!address && (
          <Text numberOfLines={1} style={[styles.address, { color: theme.colors.textSecondary, textAlign }]}>
            {address}
          </Text>
        )}

        <Pressable
          onPress={() => onConfirm(selected[1], selected[0], address || undefined)}
          style={styles.confirm}
        >
          <Ionicons name="checkmark-done" size={20} color="#0A2D44" />
          <Text style={styles.confirmText}>{isRTL ? 'اعتماد الموقع' : 'Use Location'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 1000, backgroundColor: '#FFFFFF' },
  header: { minHeight: 74, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, alignItems: 'center', gap: 9 },
  smallButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  locateButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '900' },
  sub: { marginTop: 2, fontSize: 7.5, lineHeight: 11, fontWeight: '600' },
  search: { height: 52, margin: 10, borderWidth: 1, borderRadius: 17, paddingHorizontal: 10, alignItems: 'center', gap: 7 },
  searchInput: { flex: 1, height: 50, fontSize: 10, fontWeight: '700' },
  searchButton: { width: 35, height: 35, borderRadius: 12, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  map: { flex: 1 },
  pinWrap: { alignItems: 'center', justifyContent: 'center' },
  coords: { position: 'absolute', bottom: 12, alignSelf: 'center', minHeight: 33, borderRadius: 12, paddingHorizontal: 10, backgroundColor: 'rgba(10,45,68,0.95)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  coordsText: { color: '#FFFFFF', fontSize: 8, fontWeight: '800' },
  footer: { borderTopWidth: 1, padding: 12, paddingBottom: 18 },
  address: { marginBottom: 7, fontSize: 8, fontWeight: '700' },
  confirm: { height: 50, borderRadius: 16, backgroundColor: '#F7B83A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  confirmText: { color: '#0A2D44', fontSize: 10.5, fontWeight: '900' },
});
