import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../hooks/useAuth';
import { useResolvedSchoolId } from '../../hooks/useResolvedSchoolId';
import { useAppTheme } from '../../theme/ThemeContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { supabase } from '../../lib/supabase';
import AdminBrandHeader from '../../components/admin/AdminBrandHeader';
import {
  createAdminImportTemplate,
  importAdminWorkbook,
  parseWorkbookBase64,
} from '../../services/adminImportService';

type Row = Record<string, any>;

export default function AdminImportScreen({ navigation }: any) {
  const { user } = useAuth();
  const { schoolId } = useResolvedSchoolId(user);
  const { theme } = useAppTheme();
  const { isRTL, direction, textAlign } = useLanguage();

  const [school, setSchool] = useState<Row | null>(null);
  const [currentYearId, setCurrentYearId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    const r = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .limit(1);
    if (!r.error && r.data?.[0]) {
      setSchool(r.data[0]);
      setCurrentYearId(r.data[0].current_academic_year_id ?? null);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  const chooseFile = async () => {
    if (!schoolId) {
      Alert.alert(isRTL ? 'المدرسة غير محددة' : 'School Not Resolved');
      return;
    }

    try {
      setBusy(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const workbook = parseWorkbookBase64(base64);
      const summary = await importAdminWorkbook({
        schoolId,
        currentAcademicYearId: currentYearId,
        ...workbook,
      });

      Alert.alert(
        isRTL ? 'تم الاستيراد' : 'Import Complete',
        isRTL
          ? `طلاب جدد: ${summary.studentsCount}\nأولياء أمور تمت معالجتهم: ${summary.parentsCount}\nمعلمون جدد: ${summary.teachersCount}\nروابط ولي أمر/طالب: ${summary.linksCount}`
          : `New students: ${summary.studentsCount}\nParents processed: ${summary.parentsCount}\nNew teachers: ${summary.teachersCount}\nParent/student links: ${summary.linksCount}`
      );
    } catch (error: any) {
      Alert.alert(
        isRTL ? 'تعذر الاستيراد' : 'Import Failed',
        error?.message ?? String(error)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <AdminBrandHeader
        title={isRTL ? 'استيراد البيانات' : 'Data Import'}
        subtitle={isRTL ? 'طلاب + أولياء أمور + معلمون من ملف Excel واحد' : 'Students + parents + teachers from one Excel workbook'}
        schoolName={String(school?.name ?? (isRTL ? 'المدرسة' : 'School'))}
        schoolLogoUrl={school?.logo_url ?? null}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <View style={styles.heroIcon}><Ionicons name="cloud-upload-outline" size={27} color="#0A2D44" /></View>
          <Text style={[styles.heroTitle, { color: theme.colors.text, textAlign }]}>
            {isRTL ? 'ملف استيراد موحد' : 'Unified Import Workbook'}
          </Text>
          <Text style={[styles.heroSub, { color: theme.colors.textSecondary, textAlign }]}>
            {isRTL
              ? 'في شيت Students تقدر تحط بيانات الطالب ومعه حتى 3 أولياء أمور بنفس السطر. إذا ولي الأمر موجود برقم الهاتف/اسم المستخدم يعاد استخدامه ويرتبط بالطالب الجديد بدل إنشاء نسخة مكررة.'
              : 'In the Students sheet you can include up to 3 guardians on the same row. Existing parents are reused by phone/username and linked to additional students instead of being duplicated.'}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Info icon="people-outline" title={isRTL ? 'أولياء الأمور متعددون' : 'Multiple Guardians'} text={isRTL ? 'الطالب الواحد يمكن ربطه بأكثر من ولي أمر، وولي الأمر الواحد يمكن ربطه بأكثر من طالب.' : 'One student can have multiple guardians and one guardian can link to multiple students.'} />
          <Info icon="school-outline" title={isRTL ? 'الصف والشعبة' : 'Grade & Section'} text={isRTL ? 'يتم الربط من الأكواد أو الأسماء الموجودة في Master Data.' : 'Resolved from the grade/section master data by code or name.'} />
          <Info icon="person-outline" title={isRTL ? 'المعلمون' : 'Teachers'} text={isRTL ? 'الشيت يدعم TeacherCode وبيانات الدخول والمسار.' : 'The workbook supports TeacherCode, login data and route assignment.'} />
        </View>

        <Pressable
          onPress={() => void createAdminImportTemplate()}
          style={[styles.secondary, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, flexDirection: direction }]}
        >
          <Ionicons name="download-outline" size={20} color="#F7B83A" />
          <Text style={[styles.secondaryText, { color: theme.colors.text }]}>{isRTL ? 'تحميل نموذج Excel' : 'Download Excel Template'}</Text>
        </Pressable>

        <Pressable disabled={busy} onPress={() => void chooseFile()} style={[styles.primary, { opacity: busy ? 0.7 : 1 }]}>
          {busy ? <ActivityIndicator color="#0A2D44" /> : <Ionicons name="document-attach-outline" size={21} color="#0A2D44" />}
          <Text style={styles.primaryText}>{busy ? (isRTL ? 'جاري الاستيراد...' : 'Importing...') : (isRTL ? 'اختيار ملف والاستيراد' : 'Choose File & Import')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );

  function Info({ icon, title, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; text: string }) {
    return (
      <View style={[styles.info, { flexDirection: direction, borderBottomColor: theme.colors.border }]}>
        <View style={styles.infoIcon}><Ionicons name={icon} size={19} color="#0A2D44" /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.infoTitle, { color: theme.colors.text, textAlign }]}>{title}</Text>
          <Text style={[styles.infoText, { color: theme.colors.textSecondary, textAlign }]}>{text}</Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 14, paddingBottom: 100 },
  hero: { borderWidth: 1, borderRadius: 24, padding: 16 },
  heroIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { marginTop: 10, fontSize: 14, fontWeight: '900' },
  heroSub: { marginTop: 6, fontSize: 8.6, lineHeight: 14, fontWeight: '600' },
  card: { marginTop: 10, borderWidth: 1, borderRadius: 22, paddingHorizontal: 12 },
  info: { minHeight: 82, alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  infoIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F7B83A', alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontSize: 10.5, fontWeight: '900' },
  infoText: { marginTop: 3, fontSize: 7.8, lineHeight: 12, fontWeight: '600' },
  secondary: { marginTop: 12, height: 51, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryText: { fontSize: 10, fontWeight: '900' },
  primary: { marginTop: 8, height: 54, borderRadius: 17, backgroundColor: '#F7B83A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryText: { color: '#0A2D44', fontSize: 10.5, fontWeight: '900' },
});
