import React from 'react';
import AdminPremiumCrudScreen, {
  AdminPremiumCrudConfig,
} from '../../components/admin/AdminPremiumCrudScreen';

const config: AdminPremiumCrudConfig = {
  table: 'buses',
  titleAr: 'الحافلات',
  titleEn: 'Buses',
  subtitleAr: 'الحافلات والصورة والسائق الأساسي والاحتياطي',
  subtitleEn: 'Buses, photo, primary and backup drivers',
  icon: 'bus',
  titleKey: 'bus_number',
  subtitleKeys: ['plate_number', 'capacity', 'main_driver_id', 'is_active'],
  searchKeys: ['bus_number', 'plate_number', 'registration_number', 'driver_name'],
  orderBy: 'bus_number',
  ascending: true,
  fields: [
    {
      key: 'photo_url',
      labelAr: 'صورة الحافلة',
      labelEn: 'Bus Photo',
      type: 'image',
      imageEntity: 'buses',
      icon: 'image-outline',
    },
    {
      key: 'bus_number',
      labelAr: 'رقم الحافلة',
      labelEn: 'Bus Number',
      icon: 'bus-outline',
      required: true,
    },
    {
      key: 'plate_number',
      labelAr: 'رقم اللوحة',
      labelEn: 'Plate Number',
      icon: 'card-outline',
    },
    {
      key: 'capacity',
      labelAr: 'السعة',
      labelEn: 'Capacity',
      type: 'number',
      icon: 'people-outline',
    },
    {
      key: 'main_driver_id',
      labelAr: 'السائق الأساسي',
      labelEn: 'Main Driver',
      type: 'relation',
      relationTable: 'drivers',
      relationTitle: (row) => String(row.full_name ?? ''),
      relationSubtitle: (row) => String(row.phone ?? row.phone_number ?? ''),
      relationMeta: (row) => row.is_active === false ? 'Inactive' : 'Active',
      icon: 'person-outline',
    },
    {
      key: 'backup_driver_id',
      labelAr: 'السائق الاحتياطي',
      labelEn: 'Backup Driver',
      type: 'relation',
      relationTable: 'drivers',
      relationTitle: (row) => String(row.full_name ?? ''),
      relationSubtitle: (row) => String(row.phone ?? row.phone_number ?? ''),
      relationMeta: (row) => row.is_active === false ? 'Inactive' : 'Active',
      icon: 'people-outline',
    },
    {
      key: 'registration_number',
      labelAr: 'رقم التسجيل',
      labelEn: 'Registration Number',
      icon: 'document-outline',
    },
    {
      key: 'license_expiry',
      labelAr: 'انتهاء ترخيص الحافلة',
      labelEn: 'Bus License Expiry',
      type: 'date',
      icon: 'calendar-outline',
    },
    {
      key: 'is_active',
      labelAr: 'حالة الحافلة',
      labelEn: 'Bus Status',
      type: 'choice',
      icon: 'power-outline',
      defaultValue: 'true',
      choices: [
        { value: 'true', labelAr: 'فعالة', labelEn: 'Active' },
        { value: 'false', labelAr: 'غير فعالة', labelEn: 'Inactive' },
      ],
      transformOut: (value) => String(value) === 'true',
    },
    {
      key: 'notes',
      labelAr: 'ملاحظات',
      labelEn: 'Notes',
      type: 'multiline',
      icon: 'document-text-outline',
    },
  ],
  preparePayload: (payload) => {
    if (
      payload.main_driver_id &&
      payload.backup_driver_id &&
      String(payload.main_driver_id) === String(payload.backup_driver_id)
    ) {
      throw new Error('Main driver and backup driver must be different.');
    }

    return payload;
  },
};

export default function AdminBusesScreen({ navigation }: any) {
  return <AdminPremiumCrudScreen config={config} navigation={navigation} />;
}
