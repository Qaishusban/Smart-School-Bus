import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Camera, Map as MapView, Marker } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { MAP_CONFIG } from '../../config/mapConfig';
import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';

type CameraHandle = React.ElementRef<typeof Camera>;

type Props = {
  visible: boolean;
  title: string;
  latitude?: number | null;
  longitude?: number | null;
  onClose: () => void;
  onConfirm: (latitude: number, longitude: number, label?: string) => void;
};

type Suggestion = {
  id: string;
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
};

function validCoordinate(lat: unknown, lng: unknown) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function addressLabel(address: Location.LocationGeocodedAddress | null | undefined) {
  if (!address) return '';
  return [address.name, address.street, address.district, address.city, address.region, address.country]
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .join('، ');
}

function extractCoordinates(event: any): [number, number] | null {
  const candidates = [
    event?.geometry?.coordinates,
    event?.coordinates,
    event?.nativeEvent?.geometry?.coordinates,
    event?.nativeEvent?.coordinates,
    event?.lngLat,
    event?.nativeEvent?.lngLat,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length >= 2) {
      const lng = Number(candidate[0]);
      const lat = Number(candidate[1]);
      if (validCoordinate(lat, lng)) return [lng, lat];
    }

    if (candidate && typeof candidate === 'object') {
      const lng = Number(candidate.lng ?? candidate.longitude ?? candidate.lon);
      const lat = Number(candidate.lat ?? candidate.latitude);
      if (validCoordinate(lat, lng)) return [lng, lat];
    }
  }

  const lng = Number(event?.longitude ?? event?.nativeEvent?.longitude);
  const lat = Number(event?.latitude ?? event?.nativeEvent?.latitude);
  if (validCoordinate(lat, lng)) return [lng, lat];

  return null;
}

export default function AdminLocationPickerPanel({
  visible,
  title,
  latitude,
  longitude,
  onClose,
  onConfirm,
}: Props) {
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();
  const cameraRef = useRef<CameraHandle>(null);
  const requestId = useRef(0);

  const initialCenter = useMemo<[number, number]>(() => {
    if (validCoordinate(latitude, longitude)) return [Number(longitude), Number(latitude)];
    return [MAP_CONFIG.defaultCenter.longitude, MAP_CONFIG.defaultCenter.latitude];
  }, [latitude, longitude]);

  const [selected, setSelected] = useState<[number, number]>(initialCenter);
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedLabel, setSelectedLabel] = useState('');

  useEffect(() => {
    if (!visible) return;
    setSelected(initialCenter);
    setSearch('');
    setSuggestions([]);
    setSelectedLabel('');
  }, [visible, initialCenter]);

  async function ensureGeocodePermission() {
    if (Platform.OS !== 'android') return true;
    const current = await Location.getForegroundPermissionsAsync();
    if (current.granted) return true;
    const requested = await Location.requestForegroundPermissionsAsync();
    return requested.granted;
  }

  useEffect(() => {
    if (!visible) return;
    const term = search.trim();
    if (term.length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          setSearching(true);
          if (!(await ensureGeocodePermission())) return;
          const results = (await Location.geocodeAsync(term)).slice(0, 5);
          const rows = await Promise.all(results.map(async (item, index) => {
            let label = term;
            try {
              const reverse = await Location.reverseGeocodeAsync({ latitude: item.latitude, longitude: item.longitude });
              label = addressLabel(reverse[0]) || term;
            } catch {}
            return {
              id: `${item.latitude}-${item.longitude}-${index}`,
              title: label,
              subtitle: `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`,
              latitude: item.latitude,
              longitude: item.longitude,
            };
          }));
          if (id === requestId.current) setSuggestions(rows);
        } catch {
          if (id === requestId.current) setSuggestions([]);
        } finally {
          if (id === requestId.current) setSearching(false);
        }
      })();
    }, 350);

    return () => clearTimeout(timer);
  }, [search, visible]);

  if (!visible) return null;

  function moveTo(lng: number, lat: number, zoom = 17) {
    setSelected([lng, lat]);
    cameraRef.current?.easeTo({ center: [lng, lat], zoom, duration: 400 });
  }

  async function labelSelected(lng: number, lat: number) {
    try {
      const reverse = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const label = addressLabel(reverse[0]);
      setSelectedLabel(label);
      if (label) setSearch(label);
    } catch {
      setSelectedLabel('');
    }
  }

  async function selectMapPoint(event: any) {
    const coords = extractCoordinates(event);
    if (!coords) return;
    const [lng, lat] = coords;
    moveTo(lng, lat);
    setSuggestions([]);
    await labelSelected(lng, lat);
  }

  async function useCurrentLocation() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(isRTL ? 'صلاحية الموقع مطلوبة' : 'Location Permission Required', isRTL ? 'يمكنك أيضاً تحديد الموقع مباشرة بلمس الخريطة.' : 'You can also select the location directly by tapping the map.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      moveTo(current.coords.longitude, current.coords.latitude);
      await labelSelected(current.coords.longitude, current.coords.latitude);
    } catch (error: any) {
      Alert.alert(isRTL ? 'تعذر تحديد الموقع' : 'Unable to Get Location', error?.message ?? String(error));
    }
  }

  function chooseSuggestion(item: Suggestion) {
    moveTo(item.longitude, item.latitude);
    setSelectedLabel(item.title);
    setSearch(item.title);
    setSuggestions([]);
  }

  return (
    <View style={styles.backdrop}>
      <View style={[styles.panel, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.topBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
          <Pressable onPress={onClose} style={[styles.iconButton, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}>
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={21} color={theme.colors.text} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.colors.text, textAlign }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary, textAlign }]}>{isRTL ? 'الموقع الحالي أو البحث أو اضغط مباشرة على أي نقطة بالخريطة.' : 'Use current location, search, or tap any point directly on the map.'}</Text>
          </View>
          <Pressable onPress={() => void useCurrentLocation()} style={styles.currentButton}><Ionicons name="locate" size={20} color="#0A2D44" /></Pressable>
        </View>

        <View style={[styles.searchWrap, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}>
          <Ionicons name="search-outline" size={19} color="#8191A0" />
          <TextInput value={search} onChangeText={setSearch} placeholder={isRTL ? 'ابحث عن منطقة أو شارع...' : 'Search area or street...'} placeholderTextColor="#8191A0" style={[styles.searchInput, { color: theme.colors.text, textAlign }]} />
          {!!search && <Pressable onPress={() => { setSearch(''); setSuggestions([]); }} style={styles.clearSearch}><Ionicons name="close" size={18} color="#0A2D44" /></Pressable>}
          {searching && <ActivityIndicator size="small" color="#F7B83A" />}
        </View>

        {!!suggestions.length && (
          <View style={[styles.suggestions, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {suggestions.map((item, index) => <Pressable key={item.id} onPress={() => chooseSuggestion(item)} style={[styles.suggestionRow, { borderBottomColor: theme.colors.border, flexDirection: direction }, index === suggestions.length - 1 && { borderBottomWidth: 0 }]}><View style={styles.suggestionIcon}><Ionicons name="location-outline" size={17} color="#0A2D44" /></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.suggestionTitle, { color: theme.colors.text, textAlign }]}>{item.title}</Text><Text style={[styles.suggestionSub, { color: theme.colors.textSecondary, textAlign }]}>{item.subtitle}</Text></View></Pressable>)}
            </ScrollView>
          </View>
        )}

        <View style={styles.mapWrap}>
          <MapView
            style={StyleSheet.absoluteFill}
            mapStyle={MAP_CONFIG.developmentStyle}
            attribution
            logo
            compass
            androidView="texture"
            onPress={(event: any) => void selectMapPoint(event)}
          >
            <Camera ref={cameraRef} initialViewState={{ center: initialCenter, zoom: validCoordinate(latitude, longitude) ? 16 : MAP_CONFIG.defaultZoom }} minZoom={3} maxZoom={20} />
            <Marker id="selected-location" lngLat={selected} anchor="bottom">
              <View style={styles.pin}><Ionicons name="location" size={34} color="#D94A4A" /></View>
            </Marker>
          </MapView>
          <View pointerEvents="none" style={styles.tapHint}><Ionicons name="finger-print-outline" size={15} color="#F7B83A" /><Text style={styles.tapHintText}>{isRTL ? 'المس أي نقطة لتحديدها' : 'Tap any point to select it'}</Text></View>
          <View pointerEvents="none" style={styles.coordinates}><Ionicons name="location-outline" size={14} color="#F7B83A" /><Text style={styles.coordinatesText}>{selected[1].toFixed(6)}, {selected[0].toFixed(6)}</Text></View>
        </View>

        <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {!!selectedLabel && <Text numberOfLines={1} style={[styles.placeLabel, { color: theme.colors.textSecondary, textAlign }]}>{selectedLabel}</Text>}
          <Pressable onPress={() => onConfirm(selected[1], selected[0], selectedLabel || undefined)} style={styles.confirmButton}><Ionicons name="checkmark-done" size={21} color="#0A2D44" /><Text style={styles.confirmText}>{isRTL ? 'اعتماد الموقع' : 'Use This Location'}</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, zIndex: 10000, elevation: 10000, backgroundColor: '#000' },
  panel: { flex: 1 },
  topBar: { minHeight: 78, borderBottomWidth: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 9, alignItems: 'center', gap: 9 },
  iconButton: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  currentButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '900' },
  subtitle: { marginTop: 3, fontSize: 8, lineHeight: 12, fontWeight: '600' },
  searchWrap: { position: 'absolute', zIndex: 30, top: 88, left: 12, right: 12, height: 54, borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 7 },
  searchInput: { flex: 1, height: 52, fontSize: 10.5, fontWeight: '700' },
  clearSearch: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  suggestions: { position: 'absolute', zIndex: 29, top: 148, left: 12, right: 12, maxHeight: 245, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  suggestionRow: { minHeight: 60, paddingHorizontal: 10, alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  suggestionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  suggestionTitle: { fontSize: 9.5, fontWeight: '900' },
  suggestionSub: { marginTop: 2, fontSize: 7.2, fontWeight: '700' },
  mapWrap: { flex: 1 },
  pin: { alignItems: 'center', justifyContent: 'center' },
  tapHint: { position: 'absolute', top: 82, alignSelf: 'center', minHeight: 32, paddingHorizontal: 10, borderRadius: 11, backgroundColor: 'rgba(10,45,68,0.92)', flexDirection: 'row', alignItems: 'center', gap: 5 },
  tapHintText: { color: '#FFFFFF', fontSize: 7.5, fontWeight: '800' },
  coordinates: { position: 'absolute', bottom: 12, alignSelf: 'center', minHeight: 34, borderRadius: 12, paddingHorizontal: 10, backgroundColor: 'rgba(10,45,68,0.94)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  coordinatesText: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '800' },
  footer: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 17 },
  placeLabel: { marginBottom: 6, fontSize: 8, fontWeight: '700' },
  confirmButton: { height: 52, borderRadius: 17, backgroundColor: '#F7B83A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmText: { color: '#0A2D44', fontSize: 11.5, fontWeight: '900' },
});
