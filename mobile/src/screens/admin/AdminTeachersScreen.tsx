import React from 'react';
import AdminPremiumCrudScreen, {
  AdminPremiumCrudConfig,
} from '../../components/admin/AdminPremiumCrudScreen';

const config: AdminPremiumCrudConfig = {
  table: 'teachers',
  titleAr: 'المعلمون والمشرفون',
  titleEn: 'Teachers & Supervisors',
  subtitleAr: 'بيانات المشرف والحساب والموقع والصورة',
  subtitleEn: 'Supervisor profile, login, location and photo',
  icon: 'school',
  titleKey: 'full_name',
  subtitleKeys: ['phone', 'subject', 'route_id', 'is_active'],
  searchKeys: ['full_name', 'phone', 'email', 'subject', 'national_id', 'username'],
  orderBy: 'full_name',
  ascending: true,
  fields: [
    {
      key: 'photo_url',
      labelAr: 'صورة المعلم / المشرف',
      labelEn: 'Teacher / Supervisor Photo',
      type: 'image',
      imageEntity: 'teachers',
      icon: 'image-outline',
    },
    {
      key: 'teacher_code',
      labelAr: 'كود المعلم / المشرف',
      labelEn: 'Teacher Code',
      icon: 'barcode-outline',
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
      key: 'email',
      labelAr: 'البريد الإلكتروني',
      labelEn: 'Email',
      type: 'email',
      icon: 'mail-outline',
    },
    {
      key: 'subject',
      labelAr: 'المادة / الوصف',
      labelEn: 'Subject / Description',
      icon: 'book-outline',
    },
    {
      key: 'national_id',
      labelAr: 'الرقم الوطني',
      labelEn: 'National ID',
      icon: 'card-outline',
    },
    {
      key: 'route_id',
      labelAr: 'المسار المسؤول عنه',
      labelEn: 'Assigned Route',
      type: 'relation',
      relationTable: 'routes',
      relationTitle: (row) => String(row.name ?? ''),
      relationSubtitle: (row) => String(row.direction ?? ''),
      icon: 'map-outline',
    },
    {
      key: 'home_address',
      labelAr: 'عنوان المنزل',
      labelEn: 'Home Address',
      icon: 'home-outline',
    },
    {
      key: 'home_location',
      labelAr: 'موقع المنزل',
      labelEn: 'Home Location',
      type: 'location',
      latKey: 'home_lat',
      lngKey: 'home_lng',
      icon: 'location-outline',
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
      labelAr: 'الحالة',
      labelEn: 'Status',
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
};

export default function AdminTeachersScreen({ navigation }: any) {
  return <AdminPremiumCrudScreen config={config} navigation={navigation} />;
}
