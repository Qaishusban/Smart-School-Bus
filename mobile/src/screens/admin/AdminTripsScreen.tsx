import React from 'react';
import AdminPremiumCrudScreen, {
  AdminPremiumCrudConfig,
} from '../../components/admin/AdminPremiumCrudScreen';

const config: AdminPremiumCrudConfig = {
  table: 'bus_trip_events',
  titleAr: 'سجل الرحلات',
  titleEn: 'Trip Events',
  subtitleAr: 'أحداث الرحلات المسجلة من الحافلات والسائقين',
  subtitleEn: 'Recorded bus and driver trip events',
  icon: 'navigate',
  titleKey: 'title',
  subtitleKeys: ['type', 'bus_id', 'route_id', 'created_at'],
  searchKeys: ['title', 'type', 'body'],
  orderBy: 'created_at',
  ascending: false,
  fields: [
    {
      key: 'bus_id',
      labelAr: 'الحافلة',
      labelEn: 'Bus',
      type: 'relation',
      relationTable: 'buses',
      relationTitle: (row) => `Bus ${String(row.bus_number ?? '')}`,
      relationSubtitle: (row) => String(row.plate_number ?? ''),
      icon: 'bus-outline',
      required: true,
      allowClear: false,
    },
    {
      key: 'driver_id',
      labelAr: 'السائق',
      labelEn: 'Driver',
      type: 'relation',
      relationTable: 'drivers',
      relationTitle: (row) => String(row.full_name ?? ''),
      relationSubtitle: (row) => String(row.phone ?? ''),
      icon: 'person-outline',
    },
    {
      key: 'route_id',
      labelAr: 'المسار',
      labelEn: 'Route',
      type: 'relation',
      relationTable: 'routes',
      relationTitle: (row) => String(row.name ?? ''),
      relationSubtitle: (row) => String(row.direction ?? ''),
      icon: 'map-outline',
    },
    {
      key: 'type',
      labelAr: 'نوع الحدث',
      labelEn: 'Event Type',
      icon: 'flash-outline',
      required: true,
    },
    {
      key: 'title',
      labelAr: 'العنوان',
      labelEn: 'Title',
      icon: 'text-outline',
    },
    {
      key: 'body',
      labelAr: 'التفاصيل',
      labelEn: 'Details',
      type: 'multiline',
      icon: 'document-text-outline',
    },
    {
      key: 'lat',
      labelAr: 'خط العرض',
      labelEn: 'Latitude',
      type: 'number',
      icon: 'location-outline',
    },
    {
      key: 'lng',
      labelAr: 'خط الطول',
      labelEn: 'Longitude',
      type: 'number',
      icon: 'location-outline',
    },
    {
      key: 'created_at',
      labelAr: 'تاريخ التسجيل',
      labelEn: 'Recorded At',
      detailOnly: true,
      icon: 'time-outline',
    },
  ],
};

export default function AdminTripsScreen({ navigation }: any) {
  return <AdminPremiumCrudScreen config={config} navigation={navigation} />;
}
