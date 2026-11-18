import React from 'react';
import AdminPremiumCrudScreen, {
  AdminPremiumCrudConfig,
} from '../../components/admin/AdminPremiumCrudScreen';

const config: AdminPremiumCrudConfig = {
  table: 'driver_incidents',
  titleAr: 'الحوادث والبلاغات',
  titleEn: 'Incidents',
  subtitleAr: 'بلاغات الحافلات والسائقين ومستوى الخطورة',
  subtitleEn: 'Bus and driver reports with severity level',
  icon: 'warning',
  titleKey: 'title',
  subtitleKeys: ['severity', 'bus_id', 'happened_at'],
  searchKeys: ['title', 'details', 'severity'],
  orderBy: 'happened_at',
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
      key: 'driver_profile_id',
      labelAr: 'السائق / المستخدم المبلّغ',
      labelEn: 'Driver / Reporting User',
      type: 'relation',
      relationTable: 'profiles',
      relationTitle: (row) => String(row.full_name ?? row.email ?? ''),
      relationSubtitle: (row) =>
        [row.job_title, row.role].filter(Boolean).join(' • '),
      icon: 'person-outline',
      required: true,
      allowClear: false,
    },
    {
      key: 'title',
      labelAr: 'عنوان البلاغ',
      labelEn: 'Incident Title',
      icon: 'warning-outline',
      required: true,
    },
    {
      key: 'details',
      labelAr: 'تفاصيل البلاغ',
      labelEn: 'Incident Details',
      type: 'multiline',
      icon: 'document-text-outline',
    },
    {
      key: 'severity',
      labelAr: 'درجة الخطورة',
      labelEn: 'Severity',
      type: 'choice',
      icon: 'alert-circle-outline',
      required: true,
      allowClear: false,
      defaultValue: 'medium',
      choices: [
        { value: 'low', labelAr: 'منخفضة', labelEn: 'Low' },
        { value: 'medium', labelAr: 'متوسطة', labelEn: 'Medium' },
        { value: 'high', labelAr: 'مرتفعة', labelEn: 'High' },
        { value: 'critical', labelAr: 'حرجة', labelEn: 'Critical' },
      ],
    },
    {
      key: 'happened_at',
      labelAr: 'وقت وقوع الحادث',
      labelEn: 'Occurred At',
      detailOnly: true,
      icon: 'time-outline',
    },
  ],
};

export default function AdminIncidentsScreen({ navigation }: any) {
  return <AdminPremiumCrudScreen config={config} navigation={navigation} />;
}
