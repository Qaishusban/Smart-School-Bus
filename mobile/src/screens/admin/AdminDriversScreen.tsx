import React from 'react';
import AdminPremiumCrudScreen, {
  AdminPremiumCrudConfig,
} from '../../components/admin/AdminPremiumCrudScreen';

const config: AdminPremiumCrudConfig = {
  table: 'drivers',
  titleAr: 'السائقون',
  titleEn: 'Drivers',
  subtitleAr: 'ملفات السائقين والصور والرخص وحسابات الدخول',
  subtitleEn: 'Driver profiles, photos, licenses and login accounts',
  icon: 'car',
  titleKey: 'full_name',
  subtitleKeys: ['phone', 'driver_license_expiry', 'is_active'],
  searchKeys: ['full_name', 'phone', 'national_id', 'username', 'driver_license_number'],
  orderBy: 'full_name',
  ascending: true,
  fields: [
    {
      key: 'photo_url',
      labelAr: 'صورة السائق',
      labelEn: 'Driver Photo',
      type: 'image',
      imageEntity: 'drivers',
      icon: 'image-outline',
    },
    {
      key: 'full_name',
      labelAr: 'الاسم الكامل',
      labelEn: 'Full Name',
      icon: 'person-outline',
      required: true,
    },
    {
      key: 'phone',
      labelAr: 'رقم الهاتف',
      labelEn: 'Phone Number',
      type: 'phone',
      icon: 'call-outline',
    },
    {
      key: 'national_id',
      labelAr: 'الرقم الوطني',
      labelEn: 'National ID',
      icon: 'card-outline',
    },
    {
      key: 'driver_license_number',
      labelAr: 'رقم رخصة القيادة',
      labelEn: 'Driver License Number',
      icon: 'document-text-outline',
    },
    {
      key: 'driver_license_expiry',
      labelAr: 'انتهاء رخصة القيادة',
      labelEn: 'Driver License Expiry',
      type: 'date',
      icon: 'calendar-outline',
    },
    {
      key: 'username',
      labelAr: 'اسم المستخدم',
      labelEn: 'Username',
      icon: 'person-circle-outline',
    },
    {
      key: 'pin_code',
      labelAr: 'رمز الدخول PIN',
      labelEn: 'Login PIN',
      type: 'password',
      icon: 'key-outline',
      blankOnEdit: true,
      omitEmptyOnEdit: true,
      renderDetail: () => '••••',
    },
    {
      key: 'is_active',
      labelAr: 'حالة السائق',
      labelEn: 'Driver Status',
      type: 'choice',
      icon: 'power-outline',
      defaultValue: 'true',
      choices: [
        { value: 'true', labelAr: 'فعال', labelEn: 'Active' },
        { value: 'false', labelAr: 'غير فعال', labelEn: 'Inactive' },
      ],
      transformOut: (value) => String(value) === 'true',
    },
  ],
  preparePayload: (payload) => {
    if (payload.phone !== undefined) {
      payload.phone_number = payload.phone;
    }

    if (payload.pin_code && !/^[0-9]{4,6}$/.test(String(payload.pin_code))) {
      throw new Error('PIN must contain 4 to 6 digits.');
    }

    return payload;
  },
};

export default function AdminDriversScreen({ navigation }: any) {
  return <AdminPremiumCrudScreen config={config} navigation={navigation} />;
}
