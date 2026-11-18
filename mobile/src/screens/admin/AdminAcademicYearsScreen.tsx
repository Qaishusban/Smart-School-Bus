import React from 'react';
import AdminPremiumCrudScreen, {
  AdminPremiumCrudConfig,
} from '../../components/admin/AdminPremiumCrudScreen';
import { setCurrentAcademicYear } from '../../services/adminPremiumService';

const config: AdminPremiumCrudConfig = {
  table: 'academic_years',
  titleAr: 'السنوات الدراسية',
  titleEn: 'Academic Years',
  subtitleAr: 'إدارة السنوات وتحديد السنة الحالية',
  subtitleEn: 'Manage years and current academic period',
  icon: 'calendar',
  titleKey: 'name',
  subtitleKeys: ['start_date', 'end_date', 'is_current'],
  searchKeys: ['name', 'start_date', 'end_date'],
  orderBy: 'start_date',
  ascending: false,
  fields: [
    {
      key: 'name',
      labelAr: 'اسم السنة الدراسية',
      labelEn: 'Academic Year Name',
      icon: 'school-outline',
      required: true,
      placeholderAr: 'مثال: 2026 / 2027',
      placeholderEn: 'Example: 2026 / 2027',
    },
    {
      key: 'start_date',
      labelAr: 'تاريخ البداية',
      labelEn: 'Start Date',
      type: 'date',
      icon: 'calendar-outline',
    },
    {
      key: 'end_date',
      labelAr: 'تاريخ النهاية',
      labelEn: 'End Date',
      type: 'date',
      icon: 'calendar-outline',
    },
    {
      key: 'is_current',
      labelAr: 'حالة السنة',
      labelEn: 'Year Status',
      type: 'choice',
      icon: 'star-outline',
      choices: [
        {
          value: 'true',
          labelAr: 'السنة الحالية',
          labelEn: 'Current Academic Year',
          subtitleAr: 'سيتم اعتمادها كالسنة النشطة للمدرسة.',
          subtitleEn: 'This will become the active school year.',
        },
        {
          value: 'false',
          labelAr: 'سنة غير حالية',
          labelEn: 'Not Current',
          subtitleAr: 'سنة سابقة أو مستقبلية.',
          subtitleEn: 'Historical or future year.',
        },
      ],
      defaultValue: 'false',
      transformOut: (value) => String(value) === 'true',
    },
  ],
  afterSave: async (saved, editing, context) => {
    if (!context.schoolId) return;

    if (saved.is_current === true) {
      await setCurrentAcademicYear(context.schoolId, String(saved.id));
      return;
    }

    if (editing?.is_current === true && saved.is_current !== true) {
      await setCurrentAcademicYear(context.schoolId, null);
    }
  },
};

export default function AdminAcademicYearsScreen({ navigation }: any) {
  return <AdminPremiumCrudScreen config={config} navigation={navigation} />;
}
