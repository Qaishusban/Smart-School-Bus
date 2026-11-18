import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { uploadAdminImage } from '../../services/adminMediaService';

type Props = {
  label: string;
  value?: string | null;
  schoolId: string | null;
  entity: string;
  required?: boolean;
  onChange: (url: string) => void;
};

export default function AdminImagePickerField({
  label,
  value,
  schoolId,
  entity,
  required,
  onChange,
}: Props) {
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();
  const [uploading, setUploading] = useState(false);

  const pick = async () => {
    if (!schoolId) {
      Alert.alert(
        isRTL ? 'المدرسة غير محددة' : 'School Not Set',
        isRTL
          ? 'لا يمكن رفع صورة قبل تحديد المدرسة.'
          : 'A school must be selected before uploading an image.'
      );
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          isRTL ? 'صلاحية الصور مطلوبة' : 'Photos Permission Required',
          isRTL
            ? 'لن نفتح صور الجهاز بدون موافقتك. يمكنك السماح بالوصول من إعدادات الجهاز.'
            : 'Photos will not be accessed without your permission. You can allow access from device settings.',
          [
            {
              text: isRTL ? 'إلغاء' : 'Cancel',
              style: 'cancel',
            },
            {
              text: isRTL ? 'فتح الإعدادات' : 'Open Settings',
              onPress: () => void Linking.openSettings(),
            },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.88,
        exif: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploading(true);

      const uploaded = await uploadAdminImage({
        schoolId,
        entity,
        localUri: result.assets[0].uri,
      });

      onChange(uploaded.url);
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر اختيار الصورة' : 'Unable to Select Image',
        error?.message ?? String(error)
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.group}>
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.textSecondary,
            textAlign,
          },
        ]}
      >
        {label}
        {required ? ' *' : ''}
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface2,
            borderColor: theme.colors.border,
            flexDirection: direction,
          },
        ]}
      >
        <View
          style={[
            styles.preview,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {value ? (
            <Image
              source={{ uri: value }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="image-outline" size={25} color="#8191A0" />
          )}
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
            {value
              ? isRTL
                ? 'تم اختيار صورة'
                : 'Image selected'
              : isRTL
              ? 'اختيار صورة من الجهاز'
              : 'Choose image from device'}
          </Text>

          <Text
            style={[
              styles.subtitle,
              {
                color: theme.colors.textSecondary,
                textAlign,
              },
            ]}
          >
            {isRTL
              ? 'سيطلب التطبيق صلاحية الصور قبل فتح المكتبة.'
              : 'The app asks for photo permission before opening the library.'}
          </Text>
        </View>

        <Pressable
          disabled={uploading}
          onPress={() => void pick()}
          style={styles.pickButton}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#0A2D44" />
          ) : (
            <Ionicons name="images" size={19} color="#0A2D44" />
          )}
        </Pressable>
      </View>

      {!!value && (
        <Pressable
          disabled={uploading}
          onPress={() => onChange('')}
          style={[
            styles.remove,
            {
              alignSelf: isRTL ? 'flex-start' : 'flex-end',
            },
          ]}
        >
          <Ionicons name="trash-outline" size={14} color="#D94A4A" />
          <Text style={styles.removeText}>
            {isRTL ? 'إزالة الصورة' : 'Remove image'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginTop: 12,
  },
  label: {
    marginBottom: 7,
    fontSize: 10,
    fontWeight: '800',
  },
  card: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 18,
    padding: 9,
    alignItems: 'center',
    gap: 9,
  },
  preview: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 10.5,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 3,
    fontSize: 7.7,
    lineHeight: 11.5,
    fontWeight: '600',
  },
  pickButton: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: '#F7B83A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  removeText: {
    color: '#D94A4A',
    fontSize: 8,
    fontWeight: '800',
  },
});
