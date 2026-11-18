import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { Camera, Map as MapView, Marker } from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
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

function eventCoord(event: any): [number, number] | null {
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

export default function TeacherLocationPickerModal({
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
  const [address, setAddress] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const next: [number, number] = [
      valid(latitude, longitude) ? Number(longitude) : MAP_CONFIG.defaultCenter.longitude,
      valid(latitude, longitude) ? Number(latitude) : MAP_CONFIG.defaultCenter.latitude,
    ];

    setSelected(next);
    setSearch('');
    setAddress('');

    const timer = setTimeout(() => {
      cameraRef.current?.easeTo({
        center: next,
        zoom: valid(latitude, longitude) ? 16.5 : MAP_CONFIG.defaultZoom,
        duration: 250,
      });
    }, 120);

    return () => clearTimeout(timer);
  }, [visible, latitude, longitude]);

  async function reverse(lat: number, lng: number) {
    try {
      const rows = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });
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
    cameraRef.current?.easeTo({
      center: [lng, lat],
      zoom: 17,
      duration: 220,
    });
    await reverse(lat, lng);
  }

  async function currentLocation() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(isRTL ? 'صلاحية الموقع مطلوبة' : 'Location permission required');
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      await choose(current.coords.longitude, current.coords.latitude);
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر تحديد الموقع' : 'Location failed',
        error?.message ?? String(error)
      );
    }
  }

  async function searchPlace() {
    const term = search.trim();
    if (!term) return;

    setSearching(true);
    try {
      const result = await Location.geocodeAsync(term);
      if (!result.length) {
        Alert.alert(isRTL ? 'لم يتم العثور على الموقع' : 'Location not found');
        return;
      }
      await choose(result[0].longitude, result[0].latitude);
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر البحث' : 'Search failed',
        error?.message ?? String(error)
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={['top', 'bottom']}
        style={[styles.root, { backgroundColor: theme.colors.background }]}
      >
        <View
          style={[
            styles.header,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              flexDirection: direction,
            },
          ]}
        >
          <Pressable onPress={onClose} style={[styles.close, { backgroundColor: theme.colors.surface2 }]}>
            <Ionicons name="close" size={21} color={theme.colors.text} />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.colors.text, textAlign }]}>
              {isRTL ? 'تحديد موقع المعلم' : 'Teacher Location'}
            </Text>
            <Text style={[styles.sub, { color: theme.colors.textSecondary, textAlign }]}>
              {isRTL
                ? 'الموقع الحالي، البحث، أو اضغط بإصبعك مباشرة على أي مكان.'
                : 'Use current location, search, or tap anywhere on the map.'}
            </Text>
          </View>

          <Pressable onPress={() => void currentLocation()} style={styles.locate}>
            <Ionicons name="locate" size={20} color="#0A2D44" />
          </Pressable>
        </View>

        <View
          style={[
            styles.search,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              flexDirection: direction,
            },
          ]}
        >
          <Ionicons name="search" size={19} color="#8191A0" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => void searchPlace()}
            placeholder={isRTL ? 'ابحث عن منطقة أو شارع...' : 'Search area or street...'}
            placeholderTextColor="#8191A0"
            style={[styles.input, { color: theme.colors.text, textAlign }]}
          />
          {!!search && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={19} color="#8191A0" />
            </Pressable>
          )}
          <Pressable onPress={() => void searchPlace()} style={styles.searchButton}>
            {searching ? (
              <ActivityIndicator size="small" color="#0A2D44" />
            ) : (
              <Ionicons name="arrow-forward" size={18} color="#0A2D44" />
            )}
          </Pressable>
        </View>

        <View style={styles.mapWrap}>
          <MapView
            style={StyleSheet.absoluteFill}
            mapStyle={MAP_CONFIG.developmentStyle}
            attribution
            logo
            compass
            androidView="texture"
            onPress={(event: any) => {
              const coord = eventCoord(event);
              if (coord) void choose(coord[0], coord[1]);
            }}
          >
            <Camera
              ref={cameraRef}
              initialViewState={{
                center: selected,
                zoom: valid(latitude, longitude) ? 16.5 : MAP_CONFIG.defaultZoom,
              }}
              minZoom={3}
              maxZoom={20}
            />

            <Marker id="teacher-selected-location" lngLat={selected} anchor="bottom">
              <View style={styles.marker}>
                <Ionicons name="location" size={38} color="#D92D20" />
              </View>
            </Marker>
          </MapView>

          <View style={styles.coords}>
            <Ionicons name="location-outline" size={15} color="#F7B83A" />
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
            <Text style={styles.confirmText}>
              {isRTL ? 'اعتماد الموقع' : 'Use Location'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 94,
    paddingTop: 10,
    paddingHorizontal: 13,
    paddingBottom: 10,
    borderBottomWidth: 1,
    alignItems: 'center',
    gap: 9,
  },
  close: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  locate: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900' },
  sub: { marginTop: 2, fontSize: 8.5, lineHeight: 12, fontWeight: '600' },
  search: {
    height: 54,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 7,
  },
  input: { flex: 1, height: 52, fontSize: 10.5, fontWeight: '700' },
  searchButton: { width: 37, height: 37, borderRadius: 12, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  mapWrap: { flex: 1 },
  marker: { alignItems: 'center', justifyContent: 'center' },
  coords: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    minHeight: 34,
    borderRadius: 12,
    paddingHorizontal: 11,
    backgroundColor: 'rgba(10,45,68,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coordsText: { color: '#FFFFFF', fontSize: 8.3, fontWeight: '800' },
  footer: { borderTopWidth: 1, padding: 12, paddingBottom: 22 },
  address: { marginBottom: 7, fontSize: 8, fontWeight: '700' },
  confirm: { height: 52, borderRadius: 17, backgroundColor: '#F7B83A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  confirmText: { color: '#0A2D44', fontSize: 10.5, fontWeight: '900' },
});
