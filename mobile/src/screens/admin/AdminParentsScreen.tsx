import React from 'react';
import AdminPremiumCrudScreen, {
  AdminPremiumCrudConfig,
} from '../../components/admin/AdminPremiumCrudScreen';

const config: AdminPremiumCrudConfig = {
  table: 'parents',
  titleAr: 'أولياء الأمور',
  titleEn: 'Parents',
  subtitleAr: 'بيانات ولي الأمر وربط طالب أو أكثر وحساب الدخول',
  subtitleEn: 'Parent profile, linked students and login account',
  icon: 'person',
  titleKey: 'full_name',
  subtitleKeys: ['phone', 'relation', 'is_active'],
  searchKeys: ['full_name', 'phone', 'email', 'relation', 'username'],
  orderBy: 'full_name',
  ascending: true,
  fields: [
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
      key: 'relation',
      labelAr: 'صلة القرابة',
      labelEn: 'Relation',
      type: 'choice',
      icon: 'people-outline',
      choices: [
        { value: 'father', labelAr: 'الأب', labelEn: 'Father' },
        { value: 'mother', labelAr: 'الأم', labelEn: 'Mother' },
        { value: 'guardian', labelAr: 'ولي أمر', labelEn: 'Guardian' },
        { value: 'other', labelAr: 'أخرى', labelEn: 'Other' },
      ],
    },
    {
      key: 'student_ids',
      labelAr: 'الطلاب المرتبطون',
      labelEn: 'Linked Students',
      type: 'multiRelation',
      relationTable: 'students',
      relationTitle: (row) => String(row.full_name ?? ''),
      relationSubtitle: (row) =>
        [row.grade_name ?? row.class_name, row.section_name].filter(Boolean).join(' • '),
      joinTable: 'parent_students',
      joinThisColumn: 'parent_id',
      joinOtherColumn: 'student_id',
      joinSchoolColumn: 'school_id',
      joinAcademicYearColumn: 'academic_year_id',
      mirrorPrimaryColumn: 'student_id',
      icon: 'school-outline',
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
      key: 'can_login',
      labelAr: 'السماح بتسجيل الدخول',
      labelEn: 'Login Access',
      type: 'choice',
      icon: 'log-in-outline',
      defaultValue: 'true',
      choices: [
        { value: 'true', labelAr: 'مسموح', labelEn: 'Allowed' },
        { value: 'false', labelAr: 'غير مسموح', labelEn: 'Blocked' },
      ],
      transformOut: (value) => String(value) === 'true',
    },
    {
      key: 'can_receive_notifications',
      labelAr: 'استقبال الإشعارات',
      labelEn: 'Receive Notifications',
      type: 'choice',
      icon: 'notifications-outline',
      defaultValue: 'true',
      choices: [
        { value: 'true', labelAr: 'مفعل', labelEn: 'Enabled' },
        { value: 'false', labelAr: 'متوقف', labelEn: 'Disabled' },
      ],
      transformOut: (value) => String(value) === 'true',
    },
    {
      key: 'is_active',
      labelAr: 'حالة الحساب',
      labelEn: 'Account Status',
      type: 'choice',
      icon: 'power-outline',
      defaultValue: 'true',
      choices: [
        { value: 'true', labelAr: 'فعال', labelEn: 'Active' },
        { value: 'false', labelAr: 'غير فعال', labelEn: 'Inactive' },
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
};

export default function AdminParentsScreen({ navigation }: any) {
  return <AdminPremiumCrudScreen config={config} navigation={navigation} />;
}
