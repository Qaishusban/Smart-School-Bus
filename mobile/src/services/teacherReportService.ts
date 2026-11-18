import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';

import { supabase } from '../lib/supabase';
import {
  AnyRow,
  TeacherContextData,
  TripPeriod,
  attendancePeriod,
  getTeacherContext,
  normalizeAttendanceStatus,
  rowName,
} from './teacherService';

export type TeacherReportColumn = {
  key: string;
  ar: string;
  en: string;
};

export const TEACHER_REPORT_COLUMNS: TeacherReportColumn[] = [
  { key: 'student_name', ar: 'الطالب', en: 'Student' },
  { key: 'grade_name', ar: 'الصف', en: 'Grade' },
  { key: 'section_name', ar: 'الشعبة', en: 'Section' },
  { key: 'trip_period', ar: 'الفترة', en: 'Period' },
  { key: 'status', ar: 'الحالة', en: 'Status' },
  { key: 'bus_number', ar: 'الباص', en: 'Bus' },
  { key: 'created_at', ar: 'التاريخ', en: 'Date' },
];

export type TeacherReportPayload = {
  context: TeacherContextData;
  rows: AnyRow[];
};

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function rowDateKey(row: AnyRow) {
  const value =
    row.for_date ??
    row.date_key ??
    row.trip_date ??
    row.instruction_date ??
    row.request_date ??
    row.created_at;

  if (!value) return null;

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text.slice(0, 10);

  return localDateKey(date);
}

function meansAbsent(row: AnyRow) {
  const text = [
    row.status,
    row.type,
    row.instruction_type,
    row.request_type,
    row.title,
    row.instruction,
    row.message,
    row.details,
    row.reason,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    text.includes('absent') ||
    text.includes('absence') ||
    text.includes('excused') ||
    text.includes('leave') ||
    text.includes('sick') ||
    text.includes('medical') ||
    text.includes('no_bus') ||
    text.includes('not_riding') ||
    text.includes('غياب') ||
    text.includes('إجاز') ||
    text.includes('اجاز') ||
    text.includes('معذور') ||
    text.includes('مرض')
  );
}

function periods(row: AnyRow): TripPeriod[] {
  const value = normalizeAttendanceStatus(
    row.trip_mode ?? row.trip_period ?? row.period ?? row.shift
  );

  if (['morning', 'am', 'to_school'].includes(value)) return ['morning'];
  if (['afternoon', 'evening', 'pm', 'to_home'].includes(value)) {
    return ['afternoon'];
  }

  return ['morning', 'afternoon'];
}

async function parentAbsences(args: {
  studentIds: string[];
  startDate: string;
  endDate: string;
}) {
  const rows: AnyRow[] = [];

  const inspect = async (
    table: 'parent_daily_instructions' | 'parent_requests'
  ) => {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .in('student_id', args.studentIds)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) {
      console.log(`[teacher report] ${table}:`, error.message);
      return;
    }

    (data ?? []).forEach((row: AnyRow) => {
      const date = rowDateKey(row);

      if (
        !date ||
        date < args.startDate ||
        date > args.endDate ||
        !meansAbsent(row)
      ) {
        return;
      }

      periods(row).forEach((period) => {
        rows.push({
          id: `parent-absence:${table}:${row.id}:${period}`,
          student_id: row.student_id,
          status: 'absent',
          trip_period: period,
          date_key: date,
          created_at:
            row.created_at ??
            row.instruction_date ??
            row.request_date ??
            `${date}T00:00:00`,
          source: table,
          is_virtual: true,
        });
      });
    });
  };

  await Promise.all([
    inspect('parent_daily_instructions'),
    inspect('parent_requests'),
  ]);

  return rows;
}

function identity(row: AnyRow) {
  return `${row.student_id}:${rowDateKey(row)}:${row.trip_period ?? attendancePeriod(row)}`;
}

export async function loadTeacherReportData(args: {
  teacherId: string;
  username?: string | null;
  schoolId?: string | null;
  startDate: string;
  endDate: string;
  period: 'all' | TripPeriod;
  studentId?: string | null;
}): Promise<TeacherReportPayload> {
  const context = await getTeacherContext({
    teacherId: args.teacherId,
    username: args.username ?? null,
    schoolId: args.schoolId ?? null,
  });

  const studentMap = new Map(
    context.students.map((item) => [
      String(item.student.id),
      item.student,
    ])
  );

  let ids = Array.from(studentMap.keys());

  if (args.studentId) {
    ids = ids.filter((id) => id === String(args.studentId));
  }

  if (!ids.length) return { context, rows: [] };

  const [attendance, absenceRows] = await Promise.all([
    supabase
      .from('bus_attendance')
      .select('*')
      .in('student_id', ids)
      .gte('created_at', `${args.startDate}T00:00:00`)
      .lte('created_at', `${args.endDate}T23:59:59`)
      .order('created_at', { ascending: false }),

    parentAbsences({
      studentIds: ids,
      startDate: args.startDate,
      endDate: args.endDate,
    }),
  ]);

  if (attendance.error) throw attendance.error;

  const effective = new Map<string, AnyRow>();

  (attendance.data ?? []).forEach((row: AnyRow) => {
    const normalized = {
      ...row,
      trip_period: attendancePeriod(row),
    };

    const key = identity(normalized);
    if (!effective.has(key)) effective.set(key, normalized);
  });

  // Parent absence/excuse wins for same student/date/period.
  absenceRows.forEach((row) => effective.set(identity(row), row));

  const busNo =
    context.bus?.bus_number ??
    context.bus?.number ??
    context.bus?.plate_number ??
    '';

  const rows: AnyRow[] = Array.from(effective.values())
    .map((row: AnyRow): AnyRow => {
      const student = studentMap.get(String(row.student_id));

      return {
        ...row,
        student_name: rowName(student),
        grade_name: student?.grade_name ?? student?.grade ?? '',
        section_name: student?.section_name ?? student?.section ?? '',
        bus_number: row.bus_number ?? busNo,
      };
    })
    .filter(
      (row) =>
        args.period === 'all' || row.trip_period === args.period
    )
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
    );

  return { context, rows };
}

function statusText(value: unknown, isRTL: boolean) {
  const status = normalizeAttendanceStatus(value);

  const map: Record<string, [string, string]> = {
    boarded: ['صعد للحافلة', 'Boarded'],
    arrived: ['وصل المدرسة', 'Arrived'],
    delivered: ['تم التوصيل', 'Delivered'],
    absent: ['غائب / معذور', 'Absent / Excused'],
  };

  return map[status]
    ? isRTL
      ? map[status][0]
      : map[status][1]
    : String(value ?? '');
}

function formatDate(value: unknown, isRTL: boolean) {
  if (!value) return '';

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString(isRTL ? 'ar-JO' : 'en-US');
}

function valueFor(row: AnyRow, key: string, isRTL: boolean) {
  if (key === 'status') return statusText(row.status, isRTL);
  if (key === 'created_at') return formatDate(row.created_at, isRTL);

  if (key === 'trip_period') {
    return row.trip_period === 'morning'
      ? isRTL
        ? 'صباحية'
        : 'Morning'
      : isRTL
      ? 'مسائية'
      : 'Afternoon';
  }

  return row[key] ?? '';
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function imageAsDataUri(url: unknown) {
  const source = String(url ?? '').trim();
  if (!source) return '';
  if (source.startsWith('data:image/')) return source;

  try {
    const extMatch = source.match(/\.(png|jpe?g|webp)(?:\?|$)/i);
    const ext = (extMatch?.[1] ?? 'png').toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    const local = `${FileSystem.cacheDirectory}teacher-school-logo-${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`;
    const downloaded = await FileSystem.downloadAsync(source, local);
    const base64 = await FileSystem.readAsStringAsync(downloaded.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:${mime};base64,${base64}`;
  } catch (error) {
    console.log('[teacher report] school logo:', error);
    return '';
  }
}

function reportPeriodText(period: 'all' | TripPeriod, isRTL: boolean) {
  if (period === 'morning') return isRTL ? 'الفترة الصباحية' : 'Morning';
  if (period === 'afternoon') return isRTL ? 'الفترة المسائية' : 'Afternoon';
  return isRTL ? 'جميع الفترات' : 'All periods';
}

function simpleDate(value: string, isRTL: boolean) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(isRTL ? 'ar-JO' : 'en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

export async function createTeacherReportPdf(args: {
  payload: TeacherReportPayload;
  columns: string[];
  isRTL: boolean;
  title: string;
  startDate: string;
  endDate: string;
  period: 'all' | TripPeriod;
}) {
  const selected = TEACHER_REPORT_COLUMNS.filter((col) => args.columns.includes(col.key));
  const { context, rows } = args.payload;
  const school = context.school ?? {};
  const teacher = context.teacher ?? {};
  const route = context.route ?? {};
  const bus = context.bus ?? {};
  const academicYear = context.academicYear ?? {};

  const schoolName = school.name ?? school.name_ar ?? school.name_en ?? '';
  const teacherName = rowName(teacher) || '—';
  const routeTitle = route.name ?? route.route_name ?? route.title ?? '—';
  const busNo = bus.bus_number ?? bus.number ?? bus.plate_number ?? '—';
  const yearName = academicYear.name ?? academicYear.title ?? academicYear.year_name ?? '—';
  const logoUrl = school.logo_url ?? school.logo ?? school.logoUrl ?? school.image_url ?? '';
  const logo = await imageAsDataUri(logoUrl);
  const generated = new Date().toLocaleString(args.isRTL ? 'ar-JO' : 'en-GB');

  const count = (status: string) => rows.filter((r) => normalizeAttendanceStatus(r.status) === status).length;
  const boarded = count('boarded');
  const arrived = count('arrived');
  const delivered = count('delivered');
  const absent = count('absent');

  const html = `<!DOCTYPE html>
<html dir="${args.isRTL ? 'rtl' : 'ltr'}" lang="${args.isRTL ? 'ar' : 'en'}">
<head>
<meta charset="utf-8" />
<style>
  @page { size:A4 landscape; margin:10mm 8mm 12mm; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif; color:#102A43; font-size:9px; background:#fff; }
  .header { border:1px solid #DCE5EC; border-top:5px solid #0A2D44; border-radius:12px; padding:12px 14px; margin-bottom:9px; }
  .header-grid { width:100%; border-collapse:collapse; }
  .header-grid td { border:0; padding:0; vertical-align:middle; }
  .logo-cell { width:92px; text-align:center; }
  .logo { width:72px; height:72px; object-fit:contain; }
  .logo-fallback { width:68px; height:68px; margin:auto; border-radius:16px; background:#0A2D44; color:#F4B942; display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:900; }
  .brand { color:#B77C12; font-size:8px; font-weight:800; letter-spacing:1.4px; margin-bottom:3px; }
  h1 { margin:0; color:#0A2D44; font-size:20px; line-height:1.2; }
  .school { margin-top:4px; color:#536B7C; font-size:11px; font-weight:700; }
  .docbox { width:160px; border:1px solid #E1E8EE; background:#F8FAFC; border-radius:9px; padding:8px 10px; }
  .doclabel { color:#7A8D9C; font-size:7px; font-weight:700; text-transform:uppercase; }
  .docvalue { color:#0A2D44; font-size:9px; font-weight:800; margin-top:2px; }
  .meta { width:100%; border-collapse:separate; border-spacing:5px 0; margin:0 0 9px; }
  .meta td { width:20%; border:1px solid #E1E8EE; background:#F8FAFC; border-radius:8px; padding:7px 8px; }
  .meta-label { color:#7A8D9C; font-size:7px; font-weight:700; }
  .meta-value { color:#0A2D44; font-size:9px; font-weight:800; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .summary { width:100%; border-collapse:separate; border-spacing:5px 0; margin-bottom:9px; }
  .summary td { text-align:center; border:1px solid #E1E8EE; border-radius:8px; padding:6px; }
  .summary-num { font-size:15px; font-weight:900; color:#0A2D44; }
  .summary-label { margin-top:1px; color:#6B7F8E; font-size:7px; font-weight:700; }
  .gold { color:#B77C12; }
  .report-table { width:100%; border-collapse:collapse; table-layout:fixed; }
  .report-table thead { display:table-header-group; }
  .report-table tr { page-break-inside:avoid; }
  .report-table th { background:#0A2D44; color:#fff; border:1px solid #173F59; padding:7px 4px; font-size:8px; font-weight:800; }
  .report-table td { border:1px solid #DDE5EB; padding:6px 4px; text-align:center; vertical-align:middle; word-break:break-word; }
  .report-table tbody tr:nth-child(even) td { background:#F8FAFC; }
  .empty { padding:30px; text-align:center; color:#7A8D9C; border:1px solid #E1E8EE; }
  .footer { margin-top:9px; padding-top:7px; border-top:1px solid #DCE5EC; color:#8092A0; font-size:7px; display:flex; justify-content:space-between; }
  .footer strong { color:#0A2D44; }
</style>
</head>
<body>
  <div class="header">
    <table class="header-grid"><tr>
      <td class="logo-cell">${logo ? `<img class="logo" src="${logo}" />` : `<div class="logo-fallback">SB</div>`}</td>
      <td>
        <div class="brand">SMART SCHOOL BUS</div>
        <h1>${esc(args.title)}</h1>
        <div class="school">${esc(schoolName)}</div>
      </td>
      <td style="width:175px">
        <div class="docbox">
          <div class="doclabel">${args.isRTL ? 'نوع المستند' : 'DOCUMENT TYPE'}</div>
          <div class="docvalue">${args.isRTL ? 'تقرير رسمي' : 'OFFICIAL REPORT'}</div>
          <div class="doclabel" style="margin-top:6px">${args.isRTL ? 'تاريخ الإصدار' : 'ISSUED'}</div>
          <div class="docvalue">${esc(generated)}</div>
        </div>
      </td>
    </tr></table>
  </div>

  <table class="meta"><tr>
    <td><div class="meta-label">${args.isRTL ? 'المعلم / المشرف' : 'Teacher / Supervisor'}</div><div class="meta-value">${esc(teacherName)}</div></td>
    <td><div class="meta-label">${args.isRTL ? 'المسار' : 'Route'}</div><div class="meta-value">${esc(routeTitle)}</div></td>
    <td><div class="meta-label">${args.isRTL ? 'الباص' : 'Bus'}</div><div class="meta-value">${esc(busNo)}</div></td>
    <td><div class="meta-label">${args.isRTL ? 'السنة الدراسية' : 'Academic Year'}</div><div class="meta-value">${esc(yearName)}</div></td>
    <td><div class="meta-label">${args.isRTL ? 'الفترة' : 'Period'}</div><div class="meta-value">${esc(reportPeriodText(args.period,args.isRTL))}</div></td>
  </tr></table>

  <table class="meta"><tr>
    <td style="width:50%"><div class="meta-label">${args.isRTL ? 'من تاريخ' : 'From'}</div><div class="meta-value">${esc(simpleDate(args.startDate,args.isRTL))}</div></td>
    <td style="width:50%"><div class="meta-label">${args.isRTL ? 'إلى تاريخ' : 'To'}</div><div class="meta-value">${esc(simpleDate(args.endDate,args.isRTL))}</div></td>
  </tr></table>

  <table class="summary"><tr>
    <td><div class="summary-num gold">${rows.length}</div><div class="summary-label">${args.isRTL ? 'إجمالي الحركات' : 'Total Records'}</div></td>
    <td><div class="summary-num">${boarded}</div><div class="summary-label">${args.isRTL ? 'استلام' : 'Boarded'}</div></td>
    <td><div class="summary-num">${arrived}</div><div class="summary-label">${args.isRTL ? 'وصل المدرسة' : 'Arrived'}</div></td>
    <td><div class="summary-num">${delivered}</div><div class="summary-label">${args.isRTL ? 'تم التوصيل' : 'Delivered'}</div></td>
    <td><div class="summary-num">${absent}</div><div class="summary-label">${args.isRTL ? 'غائب / معذور' : 'Absent / Excused'}</div></td>
  </tr></table>

  ${rows.length ? `<table class="report-table"><thead><tr>${selected.map((c)=>`<th>${esc(args.isRTL?c.ar:c.en)}</th>`).join('')}</tr></thead><tbody>${rows.map((row)=>`<tr>${selected.map((c)=>`<td>${esc(valueFor(row,c.key,args.isRTL))}</td>`).join('')}</tr>`).join('')}</tbody></table>` : `<div class="empty">${args.isRTL ? 'لا توجد بيانات ضمن الفترة المحددة' : 'No data found for the selected period'}</div>`}

  <div class="footer">
    <span><strong>Smart School Bus</strong> · ${esc(schoolName)}</span>
    <span>${args.isRTL ? 'تم إنشاء التقرير إلكترونياً من نظام النقل المدرسي' : 'Generated electronically by the school transportation system'}</span>
  </div>
</body></html>`;

  const result = await Print.printToFileAsync({ html });
  const target = `${FileSystem.cacheDirectory}teacher-report-${Date.now()}.pdf`;
  await FileSystem.copyAsync({ from: result.uri, to: target });
  return target;
}

export async function createTeacherReportExcel(args: {
  payload: TeacherReportPayload;
  columns: string[];
  isRTL: boolean;
  title: string;
  startDate: string;
  endDate: string;
  period: 'all' | TripPeriod;
}) {
  const selected = TEACHER_REPORT_COLUMNS.filter((col) => args.columns.includes(col.key));
  const { context, rows } = args.payload;
  const school = context.school ?? {};
  const teacher = context.teacher ?? {};
  const route = context.route ?? {};
  const bus = context.bus ?? {};

  const sheet = XLSX.utils.aoa_to_sheet([
    [args.title],
    [school.name ?? school.name_ar ?? school.name_en ?? ''],
    [args.isRTL ? 'المعلم / المشرف' : 'Teacher / Supervisor', rowName(teacher) || '—'],
    [args.isRTL ? 'المسار' : 'Route', route.name ?? route.route_name ?? route.title ?? '—'],
    [args.isRTL ? 'الباص' : 'Bus', bus.bus_number ?? bus.number ?? bus.plate_number ?? '—'],
    [args.isRTL ? 'الفترة' : 'Period', reportPeriodText(args.period,args.isRTL)],
    [args.isRTL ? 'من' : 'From', args.startDate, args.isRTL ? 'إلى' : 'To', args.endDate],
    [],
    selected.map((col) => (args.isRTL ? col.ar : col.en)),
    ...rows.map((row) => selected.map((col) => valueFor(row, col.key, args.isRTL))),
  ]);

  sheet['!cols'] = selected.map((col) => ({ wch: col.key === 'student_name' ? 28 : col.key === 'created_at' ? 22 : 16 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Teacher Report');
  const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  const target = `${FileSystem.cacheDirectory}teacher-report-${Date.now()}.xlsx`;
  await FileSystem.writeAsStringAsync(target, base64, { encoding: FileSystem.EncodingType.Base64 });
  return target;
}

export async function shareTeacherReportFile(uri: string, kind: 'pdf' | 'excel', title: string) {
  if (!(await Sharing.isAvailableAsync())) return;
  await Sharing.shareAsync(uri, {
    dialogTitle: title,
    mimeType: kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
