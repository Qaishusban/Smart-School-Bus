import React from 'react';
import AdminPremiumCrudScreen, {
  AdminPremiumCrudConfig,
} from '../../components/admin/AdminPremiumCrudScreen';

const config: AdminPremiumCrudConfig = {
  table: 'route_students',
  titleAr: 'طلاب المسارات',
  titleEn: 'Route Students',
  subtitleAr: 'توزيع الطلاب وترتيب الوقوف لكل سنة دراسية',
  subtitleEn: 'Assign students and stop order by academic year',
  icon: 'git-branch',
  titleKey: 'student_id',
  subtitleKeys: ['route_id', 'academic_year_id', 'order_index'],
  orderBy: 'order_index',
  ascending: true,
  schoolScoped: true,
  includeSchoolIdInPayload: false,
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
      key: 'route_id',
      labelAr: 'المسار',
      labelEn: 'Route',
      type: 'relation',
      relationTable: 'routes',
      relationTitle: (row) => String(row.name ?? ''),
      relationSubtitle: (row) => String(row.direction ?? ''),
      icon: 'map-outline',
      required: true,
      allowClear: false,
    },
    {
      key: 'academic_year_id',
      labelAr: 'السنة الدراسية',
      labelEn: 'Academic Year',
      type: 'relation',
      relationTable: 'academic_years',
      relationTitle: (row) => String(row.name ?? ''),
      relationSubtitle: (row) => row.is_current === true ? 'Current' : '',
      icon: 'calendar-outline',
    },
    {
      key: 'order_index',
      labelAr: 'ترتيب الطالب على المسار',
      labelEn: 'Route Order',
      type: 'number',
      icon: 'list-outline',
      required: true,
    },
    {
      key: 'pickup_time',
      labelAr: 'وقت الاستلام',
      labelEn: 'Pickup Time',
      type: 'time',
      icon: 'time-outline',
    },
    {
      key: 'dropoff_time',
      labelAr: 'وقت التوصيل',
      labelEn: 'Drop-off Time',
      type: 'time',
      icon: 'time-outline',
    },
    {
      key: 'notes',
      labelAr: 'ملاحظات',
      labelEn: 'Notes',
      type: 'multiline',
      icon: 'document-text-outline',
    },
  ],
};

export default function AdminRouteStudentsScreen({ navigation }: any) {
  return <AdminPremiumCrudScreen config={config} navigation={navigation} />;
}
