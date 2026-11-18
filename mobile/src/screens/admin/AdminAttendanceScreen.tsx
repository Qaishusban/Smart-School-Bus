import React from 'react';
import AdminPremiumCrudScreen, {
  AdminPremiumCrudConfig,
} from '../../components/admin/AdminPremiumCrudScreen';

const config: AdminPremiumCrudConfig = {
  table: 'bus_attendance',
  titleAr: 'حضور الرحلات',
  titleEn: 'Trip Attendance',
  subtitleAr: 'حالات صعود ووصول وغياب وتوصيل الطلاب',
  subtitleEn: 'Student boarded, arrived, absent and delivered states',
  icon: 'clipboard',
  titleKey: 'student_id',
  subtitleKeys: ['status', 'trip_period', 'bus_number', 'created_at'],
  orderBy: 'created_at',
  ascending: false,
  schoolScoped: true,
  includeSchoolIdInPayload: false,
  quickFilter: {
    key: 'trip_period',
    labelAr: 'فترة الحضور',
    labelEn: 'Attendance Period',
    allLabelAr: 'كل الفترات',
    allLabelEn: 'All Periods',
    choices: [
      { value: 'morning', labelAr: 'الفترة الصباحية', labelEn: 'Morning' },
      { value: 'afternoon', labelAr: 'الفترة المسائية', labelEn: 'Afternoon' },
    ],
  },
  fields: [
    {
      key: 'student_id',
      labelAr: 'الطالب',
      labelEn: 'Student',
      type: 'relation',
      relationTable: 'students',
      relationTitle: (row) => String(row.full_name ?? ''),
      relationSubtitle: (row) =>
        [row.grade_name ?? row.class_name, row.section_name].filter(Boolean).join(' • '),
      icon: 'person-outline',
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
      icon: 'car-outline',
      required: true,
      allowClear: false,
    },
    {
      key: 'bus_id',
      labelAr: 'الحافلة',
      labelEn: 'Bus',
      type: 'relation',
      relationTable: 'buses',
      relationTitle: (row) => `Bus ${String(row.bus_number ?? '')}`,
      relationSubtitle: (row) => String(row.plate_number ?? ''),
      icon: 'bus-outline',
    },
    {
      key: 'bus_number',
      labelAr: 'رقم الحافلة',
      labelEn: 'Bus Number',
      icon: 'bus-outline',
    },
    {
      key: 'trip_period',
      labelAr: 'الفترة',
      labelEn: 'Period',
      type: 'choice',
      icon: 'time-outline',
      required: true,
      allowClear: false,
      defaultValue: 'morning',
      choices: [
        { value: 'morning', labelAr: 'صباحية', labelEn: 'Morning' },
        { value: 'afternoon', labelAr: 'مسائية', labelEn: 'Afternoon' },
      ],
    },
    {
      key: 'status',
      labelAr: 'الحالة',
      labelEn: 'Status',
      type: 'choice',
      icon: 'checkmark-circle-outline',
      required: true,
      allowClear: false,
      choices: [
        {
          value: 'arrived',
          labelAr: 'وصل',
          labelEn: 'Arrived',
          subtitleAr: 'وصل السائق إلى موقع الطالب.',
          subtitleEn: 'Bus arrived at student location.',
        },
        {
          value: 'boarded',
          labelAr: 'صعد للحافلة',
          labelEn: 'Boarded',
          subtitleAr: 'تم صعود الطالب للحافلة.',
          subtitleEn: 'Student boarded the bus.',
        },
        {
          value: 'absent',
          labelAr: 'غائب',
          labelEn: 'Absent',
          subtitleAr: 'الطالب غير موجود للرحلة.',
          subtitleEn: 'Student is absent for the trip.',
        },
        {
          value: 'delivered',
          labelAr: 'تم التوصيل',
          labelEn: 'Delivered',
          subtitleAr: 'تم تسليم الطالب بنجاح.',
          subtitleEn: 'Student was delivered successfully.',
        },
      ],
    },
    {
      key: 'created_at',
      labelAr: 'وقت التسجيل',
      labelEn: 'Recorded At',
      detailOnly: true,
      icon: 'time-outline',
    },
  ],
};

export default function AdminAttendanceScreen({ navigation }: any) {
  return <AdminPremiumCrudScreen config={config} navigation={navigation} />;
}
