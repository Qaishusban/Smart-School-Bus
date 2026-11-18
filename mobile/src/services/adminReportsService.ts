import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

export type AdminReportType =
  | 'students'
  | 'routes'
  | 'attendance'
  | 'incidents'
  | 'trips'
  | 'teachers'
  | 'drivers'
  | 'buses'
  | 'alerts';

export type AdminReportFilters = {
  schoolId: string;
  routeId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  period?: 'all' | 'morning' | 'afternoon' | null;
};

export type AdminReportColumn = {
  key: string;
  labelAr: string;
  labelEn: string;
};

export type AdminReportResult = {
  titleAr: string;
  titleEn: string;
  columns: AdminReportColumn[];
  rows: Record<string, any>[];
};

export type SchoolReportHeader = {
  name?: string | null;
  email?: string | null;
  phone?: string | number | null;
  logo_url?: string | null;
};

function startIso(date?: string | null) { return date ? `${date}T00:00:00.000Z` : null; }
function endIso(date?: string | null) { return date ? `${date}T23:59:59.999Z` : null; }
function safeText(value: unknown) { return value === null || value === undefined || value === '' ? '—' : String(value); }
function escapeHtml(value: unknown) { return safeText(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fileSafe(value: string) { return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, ''); }

function reportDisplay(value: unknown, isRTL: boolean) {
  const text = safeText(value);
  const map: Record<string, [string, string]> = {
    morning: ['صباحية', 'Morning'],
    afternoon: ['مسائية', 'Afternoon'],
    both: ['صباحية ومسائية', 'Morning & Afternoon'],
    arrived: ['وصل', 'Arrived'],
    boarded: ['صعد للحافلة', 'Boarded'],
    absent: ['غائب', 'Absent'],
    delivered: ['تم التوصيل', 'Delivered'],
    low: ['منخفضة', 'Low'],
    medium: ['متوسطة', 'Medium'],
    high: ['مرتفعة', 'High'],
    critical: ['حرجة', 'Critical'],
    active: ['فعال', 'Active'],
    inactive: ['غير فعال', 'Inactive'],
    Active: ['فعال', 'Active'],
    Inactive: ['غير فعال', 'Inactive'],
    true: ['فعال', 'Active'],
    false: ['غير فعال', 'Inactive'],
    trip_started: ['بدأت الرحلة', 'Trip Started'],
    trip_ended: ['انتهت الرحلة', 'Trip Ended'],
    birthday: ['عيد ميلاد', 'Birthday'],
    driver_license: ['انتهاء رخصة سائق', 'Driver License Expiry'],
    bus_license: ['انتهاء ترخيص باص', 'Bus License Expiry'],
    pending: ['غير منجز', 'Pending'],
    completed: ['منجز', 'Completed'],
    queued: ['تم تجهيز الإرسال', 'Queued'],
    not_queued: ['لم يرسل بعد', 'Not sent yet'],
  };
  return map[text] ? (isRTL ? map[text][0] : map[text][1]) : text;
}

async function getRouteMap(schoolId: string) {
  const { data } = await supabase.from('routes').select('id,name,bus_id,teacher_id,direction,morning_start_time,morning_end_time,afternoon_start_time,afternoon_end_time,start_time,end_time').eq('school_id', schoolId);
  return new Map((data ?? []).map((row: any) => [String(row.id), row]));
}

export async function getAdminReport(type: AdminReportType, filters: AdminReportFilters): Promise<AdminReportResult> {
  const { schoolId, routeId, fromDate, toDate, period } = filters;

  if (type === 'students') {
    let query = supabase.from('students').select('*').eq('school_id', schoolId).order('full_name');
    if (routeId) query = query.eq('route_id', routeId);
    const { data, error } = await query;
    if (error) throw error;
    const routeMap = await getRouteMap(schoolId);
    return {
      titleAr: 'تقرير الطلاب', titleEn: 'Students Report',
      columns: [
        { key: 'name', labelAr: 'الطالب', labelEn: 'Student' },
        { key: 'grade', labelAr: 'الصف', labelEn: 'Grade' },
        { key: 'section', labelAr: 'الشعبة', labelEn: 'Section' },
        { key: 'route', labelAr: 'المسار', labelEn: 'Route' },
        { key: 'parent_phone', labelAr: 'هاتف ولي الأمر', labelEn: 'Parent Phone' },
        { key: 'birth_date', labelAr: 'تاريخ الميلاد', labelEn: 'Birth Date' },
        { key: 'status', labelAr: 'الحالة', labelEn: 'Status' },
      ],
      rows: (data ?? []).map((row: any) => ({
        name: row.full_name ?? row.name,
        grade: row.grade_name ?? row.grade ?? row.class_name,
        section: row.section_name ?? row.section,
        route: routeMap.get(String(row.route_id ?? ''))?.name ?? '—',
        parent_phone: row.parent_phone,
        birth_date: row.birth_date,
        status: row.is_active === false ? 'inactive' : 'active',
      })),
    };
  }

  if (type === 'teachers') {
    let query = supabase.from('teachers').select('*').eq('school_id', schoolId).order('full_name');
    if (routeId) query = query.eq('route_id', routeId);
    const { data, error } = await query;
    if (error) throw error;
    const routeMap = await getRouteMap(schoolId);
    return {
      titleAr: 'تقرير المعلمين والمشرفين', titleEn: 'Teachers & Supervisors Report',
      columns: [
        { key: 'name', labelAr: 'الاسم', labelEn: 'Name' },
        { key: 'teacher_code', labelAr: 'الكود', labelEn: 'Code' },
        { key: 'phone', labelAr: 'الهاتف', labelEn: 'Phone' },
        { key: 'email', labelAr: 'البريد', labelEn: 'Email' },
        { key: 'subject', labelAr: 'المادة / الوصف', labelEn: 'Subject' },
        { key: 'route', labelAr: 'المسار', labelEn: 'Route' },
        { key: 'username', labelAr: 'اسم المستخدم', labelEn: 'Username' },
        { key: 'status', labelAr: 'الحالة', labelEn: 'Status' },
      ],
      rows: (data ?? []).map((row: any) => ({ name: row.full_name, teacher_code: row.teacher_code, phone: row.phone, email: row.email, subject: row.subject, route: routeMap.get(String(row.route_id ?? ''))?.name ?? '—', username: row.username, status: row.is_active === false ? 'inactive' : 'active' })),
    };
  }

  if (type === 'drivers') {
    const { data, error } = await supabase.from('drivers').select('*').eq('school_id', schoolId).order('full_name');
    if (error) throw error;
    return {
      titleAr: 'تقرير السائقين', titleEn: 'Drivers Report',
      columns: [
        { key: 'name', labelAr: 'السائق', labelEn: 'Driver' },
        { key: 'phone', labelAr: 'الهاتف', labelEn: 'Phone' },
        { key: 'national_id', labelAr: 'الرقم الوطني', labelEn: 'National ID' },
        { key: 'license_no', labelAr: 'رقم الرخصة', labelEn: 'License No.' },
        { key: 'license_expiry', labelAr: 'انتهاء الرخصة', labelEn: 'License Expiry' },
        { key: 'username', labelAr: 'اسم المستخدم', labelEn: 'Username' },
        { key: 'status', labelAr: 'الحالة', labelEn: 'Status' },
      ],
      rows: (data ?? []).map((row: any) => ({ name: row.full_name, phone: row.phone ?? row.phone_number, national_id: row.national_id, license_no: row.driver_license_number, license_expiry: row.driver_license_expiry, username: row.username, status: row.is_active === false ? 'inactive' : 'active' })),
    };
  }

  if (type === 'buses') {
    const { data, error } = await supabase.from('buses').select('*').eq('school_id', schoolId).order('bus_number');
    if (error) throw error;
    const driverIds = Array.from(new Set((data ?? []).flatMap((row: any) => [row.main_driver_id, row.backup_driver_id]).filter(Boolean)));
    let drivers: any[] = [];
    if (driverIds.length) {
      const result = await supabase.from('drivers').select('id,full_name').in('id', driverIds);
      drivers = result.data ?? [];
    }
    const driverMap = new Map(drivers.map((row: any) => [String(row.id), row.full_name]));
    return {
      titleAr: 'تقرير الحافلات', titleEn: 'Buses Report',
      columns: [
        { key: 'bus_number', labelAr: 'رقم الحافلة', labelEn: 'Bus Number' },
        { key: 'plate_number', labelAr: 'رقم اللوحة', labelEn: 'Plate Number' },
        { key: 'capacity', labelAr: 'السعة', labelEn: 'Capacity' },
        { key: 'main_driver', labelAr: 'السائق الأساسي', labelEn: 'Main Driver' },
        { key: 'backup_driver', labelAr: 'السائق الاحتياطي', labelEn: 'Backup Driver' },
        { key: 'registration_number', labelAr: 'رقم التسجيل', labelEn: 'Registration Number' },
        { key: 'license_expiry', labelAr: 'انتهاء الترخيص', labelEn: 'License Expiry' },
        { key: 'status', labelAr: 'الحالة', labelEn: 'Status' },
      ],
      rows: (data ?? []).map((row: any) => ({ bus_number: row.bus_number, plate_number: row.plate_number, capacity: row.capacity, main_driver: driverMap.get(String(row.main_driver_id ?? '')) ?? row.driver_name ?? '—', backup_driver: driverMap.get(String(row.backup_driver_id ?? '')) ?? '—', registration_number: row.registration_number, license_expiry: row.license_expiry, status: row.is_active === false ? 'inactive' : 'active' })),
    };
  }

  if (type === 'routes') {
    const routeMap = await getRouteMap(schoolId);
    const routeRows = Array.from(routeMap.values()).filter((row: any) => routeId ? String(row.id) === String(routeId) : true);
    const [busesResult, teachersResult, studentsResult, schoolResult] = await Promise.all([
      supabase.from('buses').select('*').eq('school_id', schoolId),
      supabase.from('teachers').select('*').eq('school_id', schoolId),
      supabase.from('students').select('id,full_name').eq('school_id', schoolId),
      supabase.from('schools').select('current_academic_year_id').eq('id', schoolId).maybeSingle(),
    ]);
    const routeIds = routeRows.map((row: any) => row.id);
    let assignments: any[] = [];
    if (routeIds.length) {
      let aq = supabase.from('route_students').select('*').in('route_id', routeIds).order('order_index');
      const yearId = schoolResult.data?.current_academic_year_id ?? null;
      aq = yearId ? aq.eq('academic_year_id', yearId) : aq.is('academic_year_id', null);
      const result = await aq;
      assignments = result.data ?? [];
    }
    const busMap = new Map((busesResult.data ?? []).map((row: any) => [String(row.id), row]));
    const teacherMap = new Map((teachersResult.data ?? []).map((row: any) => [String(row.id), row]));
    const studentMap = new Map((studentsResult.data ?? []).map((row: any) => [String(row.id), row]));
    const rows: Record<string, any>[] = [];
    routeRows.forEach((route: any) => {
      const assigned = assignments.filter((item: any) => String(item.route_id) === String(route.id));
      const base = {
        route: route.name,
        direction: route.direction,
        bus: busMap.get(String(route.bus_id ?? ''))?.bus_number ?? '—',
        supervisor: teacherMap.get(String(route.teacher_id ?? ''))?.full_name ?? '—',
        morning: `${String(route.morning_start_time ?? route.start_time ?? '—').slice(0,5)} - ${String(route.morning_end_time ?? route.end_time ?? '—').slice(0,5)}`,
        afternoon: `${String(route.afternoon_start_time ?? '—').slice(0,5)} - ${String(route.afternoon_end_time ?? '—').slice(0,5)}`,
      };
      if (!assigned.length) rows.push({ ...base, order: '—', student: '—' });
      else assigned.forEach((item: any) => rows.push({ ...base, order: item.order_index, student: studentMap.get(String(item.student_id))?.full_name ?? '—' }));
    });
    return {
      titleAr: 'تقرير المسارات والطلاب', titleEn: 'Routes & Students Report',
      columns: [
        { key: 'route', labelAr: 'المسار', labelEn: 'Route' },
        { key: 'direction', labelAr: 'الاتجاه', labelEn: 'Direction' },
        { key: 'bus', labelAr: 'الباص', labelEn: 'Bus' },
        { key: 'supervisor', labelAr: 'المشرف', labelEn: 'Supervisor' },
        { key: 'morning', labelAr: 'وقت الصباحي', labelEn: 'Morning Time' },
        { key: 'afternoon', labelAr: 'وقت المسائي', labelEn: 'Afternoon Time' },
        { key: 'order', labelAr: 'الترتيب', labelEn: 'Order' },
        { key: 'student', labelAr: 'الطالب', labelEn: 'Student' },
      ], rows,
    };
  }

  if (type === 'attendance') {
    const studentsResult = await supabase.from('students').select('id,full_name,route_id').eq('school_id', schoolId);
    if (studentsResult.error) throw studentsResult.error;
    let allowed = studentsResult.data ?? [];
    if (routeId) allowed = allowed.filter((row: any) => String(row.route_id ?? '') === String(routeId));
    const ids = allowed.map((row: any) => row.id);
    const columns: AdminReportColumn[] = [
      { key: 'student', labelAr: 'الطالب', labelEn: 'Student' },
      { key: 'period', labelAr: 'الفترة', labelEn: 'Period' },
      { key: 'status', labelAr: 'الحالة', labelEn: 'Status' },
      { key: 'bus', labelAr: 'الباص', labelEn: 'Bus' },
      { key: 'date', labelAr: 'التاريخ', labelEn: 'Date' },
    ];
    if (!ids.length) return { titleAr: 'تقرير حضور الرحلات', titleEn: 'Trip Attendance Report', columns, rows: [] };
    let query = supabase.from('bus_attendance').select('*').in('student_id', ids).order('created_at', { ascending: false });
    const from = startIso(fromDate); const to = endIso(toDate);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (period && period !== 'all') query = query.eq('trip_period', period);
    const { data, error } = await query;
    if (error) throw error;
    const studentMap = new Map(allowed.map((row: any) => [String(row.id), row.full_name]));
    return { titleAr: 'تقرير حضور الرحلات', titleEn: 'Trip Attendance Report', columns, rows: (data ?? []).map((row: any) => ({ student: studentMap.get(String(row.student_id)) ?? '—', period: row.trip_period ?? '—', status: row.status, bus: row.bus_number ?? '—', date: row.created_at })) };
  }

  if (type === 'incidents') {
    let query = supabase.from('driver_incidents').select('*').eq('school_id', schoolId).order('happened_at', { ascending: false });
    const from = startIso(fromDate); const to = endIso(toDate);
    if (from) query = query.gte('happened_at', from);
    if (to) query = query.lte('happened_at', to);
    const { data, error } = await query; if (error) throw error;
    const busIds = Array.from(new Set((data ?? []).map((row: any) => row.bus_id).filter(Boolean)));
    let buses: any[] = [];
    if (busIds.length) buses = (await supabase.from('buses').select('id,bus_number').in('id', busIds)).data ?? [];
    const busMap = new Map(buses.map((row: any) => [String(row.id), row.bus_number]));
    return { titleAr: 'تقرير الحوادث والبلاغات', titleEn: 'Incidents Report', columns: [
      { key: 'title', labelAr: 'العنوان', labelEn: 'Title' }, { key: 'severity', labelAr: 'الخطورة', labelEn: 'Severity' }, { key: 'bus', labelAr: 'الباص', labelEn: 'Bus' }, { key: 'details', labelAr: 'التفاصيل', labelEn: 'Details' }, { key: 'date', labelAr: 'التاريخ', labelEn: 'Date' },
    ], rows: (data ?? []).map((row: any) => ({ title: row.title, severity: row.severity, bus: busMap.get(String(row.bus_id)) ?? '—', details: row.details, date: row.happened_at })) };
  }

  if (type === 'alerts') {
    let query = supabase
      .from('school_alert_events')
      .select('*')
      .eq('school_id', schoolId)
      .order('event_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (fromDate) query = query.gte('event_date', fromDate);
    if (toDate) query = query.lte('event_date', toDate);

    const { data, error } = await query;
    if (error) throw error;

    return {
      titleAr: 'تقرير التنبيهات والإشعارات',
      titleEn: 'Alerts & Notifications Report',
      columns: [
        { key: 'type', labelAr: 'نوع التنبيه', labelEn: 'Alert Type' },
        { key: 'title', labelAr: 'العنوان', labelEn: 'Title' },
        { key: 'details', labelAr: 'التفاصيل', labelEn: 'Details' },
        { key: 'event_date', labelAr: 'تاريخ الاستحقاق', labelEn: 'Due Date' },
        { key: 'status', labelAr: 'الحالة', labelEn: 'Status' },
        { key: 'push_status', labelAr: 'الإشعار الخارجي', labelEn: 'Push Status' },
      ],
      rows: (data ?? []).map((row: any) => ({
        type: row.event_type,
        title: row.title,
        details: row.body,
        event_date: row.event_date,
        status: row.status ?? 'pending',
        push_status: row.push_queued_at ? 'queued' : 'not_queued',
      })),
    };
  }

  let query = supabase.from('bus_trip_events').select('*').eq('school_id', schoolId).order('created_at', { ascending: false });
  if (routeId) query = query.eq('route_id', routeId);
  const from = startIso(fromDate); const to = endIso(toDate);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  const { data, error } = await query; if (error) throw error;
  const routeMap = await getRouteMap(schoolId);
  return { titleAr: 'تقرير أحداث الرحلات', titleEn: 'Trip Events Report', columns: [
    { key: 'route', labelAr: 'المسار', labelEn: 'Route' }, { key: 'type', labelAr: 'نوع الحدث', labelEn: 'Event' }, { key: 'title', labelAr: 'العنوان', labelEn: 'Title' }, { key: 'details', labelAr: 'التفاصيل', labelEn: 'Details' }, { key: 'date', labelAr: 'التاريخ', labelEn: 'Date' },
  ], rows: (data ?? []).map((row: any) => ({ route: routeMap.get(String(row.route_id ?? ''))?.name ?? '—', type: row.type, title: row.title, details: row.body, date: row.created_at })) };
}

function selectedColumns(report: AdminReportResult, keys?: string[]) {
  if (!keys?.length) return report.columns;
  const set = new Set(keys);
  return report.columns.filter((column) => set.has(column.key));
}

export async function exportAdminReportPdf(params: {
  report: AdminReportResult;
  isRTL: boolean;
  school: SchoolReportHeader;
  selectedColumnKeys?: string[];
}) {
  const { report, isRTL, school, selectedColumnKeys } = params;
  const title = isRTL ? report.titleAr : report.titleEn;
  const columns = selectedColumns(report, selectedColumnKeys);
  const schoolInfo = [school.email, school.phone]
    .filter(Boolean)
    .map((value) => escapeHtml(value))
    .join(' • ');

  const logo = school.logo_url
    ? `<img class="schoolLogo" src="${escapeHtml(school.logo_url)}" />`
    : `<div class="logoFallback">SSB</div>`;

  const headerCells = columns
    .map(
      (column) =>
        `<th class="columnHead">${escapeHtml(
          isRTL ? column.labelAr : column.labelEn
        )}</th>`
    )
    .join('');

  const body = report.rows.length
    ? report.rows
        .map(
          (row) =>
            `<tr>${columns
              .map(
                (column) =>
                  `<td>${escapeHtml(reportDisplay(row[column.key], isRTL))}</td>`
              )
              .join('')}</tr>`
        )
        .join('')
    : `<tr><td colspan="${Math.max(columns.length, 1)}" class="emptyCell">${
        isRTL ? 'لا توجد بيانات ضمن الفلاتر المحددة' : 'No data for the selected filters'
      }</td></tr>`;

  const html = `<!doctype html>
  <html dir="${isRTL ? 'rtl' : 'ltr'}">
    <head>
      <meta charset="UTF-8" />
      <style>
        @page {
          size: A4 portrait;
          margin: 9mm 8mm 10mm 8mm;
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: #fff;
          color: #0A2D44;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        }
        table.reportTable {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        thead {
          display: table-header-group;
        }
        tfoot {
          display: table-footer-group;
        }
        tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .reportHeaderCell {
          background: #fff;
          color: #0A2D44;
          border: 0;
          padding: 0 0 7px 0;
        }
        .reportHeader {
          min-height: 24mm;
          border: 1.3px solid #D8E2EA;
          border-radius: 12px;
          padding: 8px 10px;
          display: flex;
          direction: ltr;
          align-items: center;
          gap: 14px;
        }
        .reportTitleBox {
          flex: 1;
          text-align: left;
          min-width: 0;
        }
        .reportTitle {
          font-size: 23px;
          line-height: 1.1;
          font-weight: 900;
          color: #0A2D44;
        }
        .printedAt {
          margin-top: 5px;
          font-size: 7.5px;
          color: #8798A5;
        }
        .schoolBox {
          width: 47%;
          display: flex;
          flex-direction: row-reverse;
          align-items: center;
          gap: 9px;
          direction: rtl;
          text-align: right;
        }
        .schoolLogo, .logoFallback {
          width: 52px;
          height: 52px;
          border-radius: 10px;
          background: #fff;
          object-fit: contain;
          flex: 0 0 52px;
        }
        .logoFallback {
          border: 1px solid #E2E9EF;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          color: #0A2D44;
        }
        .schoolText { min-width: 0; flex: 1; }
        .schoolName { font-size: 14px; font-weight: 900; color: #0A2D44; }
        .schoolInfo { margin-top: 3px; font-size: 7.5px; line-height: 1.35; color: #687D8D; }
        .columnHead {
          background: #0A2D44;
          color: #fff;
          border: 1px solid #B9C8D4;
          padding: 6px 4px;
          font-size: 7.4px;
          font-weight: 900;
          text-align: center;
        }
        td {
          border: 1px solid #D7E1E8;
          padding: 5px 4px;
          font-size: 7.1px;
          line-height: 1.22;
          vertical-align: middle;
          overflow-wrap: anywhere;
        }
        tbody tr:nth-child(even) td { background: #F8FAFB; }
        .emptyCell { text-align: center; padding: 22px; color: #7D8F9D; }
        .footerCell {
          border: 0;
          padding: 6px 0 0 0;
          background: #fff;
        }
        .reportFooter {
          border-top: 1px solid #D8E2EA;
          padding-top: 4px;
          display: flex;
          direction: ltr;
          justify-content: space-between;
          align-items: center;
          color: #7B8E9D;
          font-size: 7px;
        }
        .pageNumber::after { content: counter(page); }
      </style>
    </head>
    <body>
      <table class="reportTable">
        <thead>
          <tr>
            <th class="reportHeaderCell" colspan="${Math.max(columns.length, 1)}">
              <div class="reportHeader">
                <div class="reportTitleBox">
                  <div class="reportTitle">${escapeHtml(title)}</div>
                  <div class="printedAt">${escapeHtml(
                    isRTL ? 'تاريخ الطباعة' : 'Printed'
                  )}: ${escapeHtml(
                    new Date().toLocaleString(isRTL ? 'ar-JO' : 'en-US')
                  )}</div>
                </div>
                <div class="schoolBox">
                  ${logo}
                  <div class="schoolText">
                    <div class="schoolName">${escapeHtml(school.name ?? '')}</div>
                    <div class="schoolInfo">${schoolInfo || '&nbsp;'}</div>
                  </div>
                </div>
              </div>
            </th>
          </tr>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>${body}</tbody>
        <tfoot>
          <tr>
            <td class="footerCell" colspan="${Math.max(columns.length, 1)}">
              <div class="reportFooter">
                <span>Smart School Bus • ${escapeHtml(school.name ?? '')}</span>
                <span>${isRTL ? 'صفحة' : 'Page'} <span class="pageNumber"></span></span>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </body>
  </html>`;

  const result = await Print.printToFileAsync({ html });
  return result.uri;
}

export async function exportAdminReportExcel(params: {
  report: AdminReportResult;
  isRTL: boolean;
  school: SchoolReportHeader;
  selectedColumnKeys?: string[];
}) {
  const { report, isRTL, school, selectedColumnKeys } = params;
  const title = isRTL ? report.titleAr : report.titleEn;
  const columns = selectedColumns(report, selectedColumnKeys);
  const rows = report.rows.map((row) => {
    const output: Record<string, any> = {};
    columns.forEach((column) => {
      output[isRTL ? column.labelAr : column.labelEn] = reportDisplay(
        row[column.key],
        isRTL
      );
    });
    return output;
  });

  const workbook = XLSX.utils.book_new();
  const meta = [
    [school.name ?? ''],
    [title],
    [[school.email, school.phone].filter(Boolean).join(' • ')],
    [isRTL ? 'تاريخ التصدير' : 'Exported', new Date().toLocaleString(isRTL ? 'ar-JO' : 'en-US')],
    [],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(meta);
  XLSX.utils.sheet_add_json(worksheet, rows, { origin: 'A6' });

  worksheet['!freeze'] = { xSplit: 0, ySplit: 6 } as any;
  worksheet['!cols'] = columns.map(() => ({ wch: 22 }));

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

  const base64 = XLSX.write(workbook, {
    type: 'base64',
    bookType: 'xlsx',
  });

  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) throw new Error('File system directory is unavailable.');

  const uri = `${directory}${fileSafe(title || 'report')}-${Date.now()}.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}
