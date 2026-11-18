import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

type Row = Record<string, any>;

function text(v: any) { return String(v ?? '').trim(); }
function nullable(v: any) { const t = text(v); return t ? t : null; }
function boolValue(v: any, fallback = true) {
  const t = text(v).toLowerCase();
  if (!t) return fallback;
  return ['1','true','yes','y','نعم','فعال'].includes(t);
}
function splitList(v: any) {
  return text(v).split(/[;,|]/).map((x) => x.trim()).filter(Boolean);
}

export async function createAdminImportTemplate() {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    {
      StudentName: 'Example Student', BirthDate: '2015-05-10', GradeCode: 'G05', SectionCode: 'A',
      RouteName: '', HomeLat: '', HomeLng: '', Parent1Name: 'Example Father', Parent1Phone: '0790000000',
      Parent1Relation: 'father', Parent1Username: 'father001', Parent1PIN: '1234',
      Parent2Name: '', Parent2Phone: '', Parent2Relation: '', Parent2Username: '', Parent2PIN: ''
    }
  ]), 'Students');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { ParentName: 'Example Parent', Phone: '0790000000', Email: '', Relation: 'father', Username: 'father001', PIN: '1234', StudentNames: 'Example Student;Second Student' }
  ]), 'Parents');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { TeacherCode: 'TCH-000001', FullName: 'Example Teacher', Phone: '0790000000', Email: '', Subject: '', NationalId: '', Username: 'teacher001', PIN: '1234', RouteName: '', Active: 'true' }
  ]), 'Teachers');

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error('File system directory unavailable.');
  const uri = `${dir}smart-school-bus-import-template.xlsx`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return uri;
}

export function parseWorkbookBase64(base64: string) {
  const wb = XLSX.read(base64, { type: 'base64' });
  const sheet = (name: string) => {
    const ws = wb.Sheets[name];
    return ws ? XLSX.utils.sheet_to_json<Row>(ws, { defval: '' }) : [];
  };
  return { students: sheet('Students'), parents: sheet('Parents'), teachers: sheet('Teachers') };
}

async function findGrade(schoolId: string, row: Row) {
  const code = text(row.GradeCode);
  const name = text(row.GradeName);
  let query = supabase.from('school_grades').select('*').eq('school_id', schoolId);
  if (code) query = query.eq('code', code);
  else if (name) query = query.eq('name', name);
  else return null;
  const result = await query.limit(1);
  if (result.error) throw result.error;
  return result.data?.[0] ?? null;
}

async function findSection(schoolId: string, gradeId: string | null, row: Row) {
  if (!gradeId) return null;
  const code = text(row.SectionCode);
  const name = text(row.SectionName);
  let query = supabase.from('school_sections').select('*').eq('school_id', schoolId).eq('grade_id', gradeId);
  if (code) query = query.eq('code', code);
  else if (name) query = query.eq('name', name);
  else return null;
  const result = await query.limit(1);
  if (result.error) throw result.error;
  return result.data?.[0] ?? null;
}

async function findRoute(schoolId: string, routeName: any) {
  const name = text(routeName); if (!name) return null;
  const result = await supabase.from('routes').select('*').eq('school_id', schoolId).eq('name', name).limit(1);
  if (result.error) throw result.error;
  return result.data?.[0] ?? null;
}

async function ensureParent(schoolId: string, parent: Row) {
  const phone = text(parent.phone ?? parent.Phone ?? parent.ParentPhone);
  const username = text(parent.username ?? parent.Username ?? parent.ParentUsername);
  const email = text(parent.email ?? parent.Email);

  let existing: any[] = [];
  if (phone) {
    const r = await supabase.from('parents').select('*').eq('school_id', schoolId).eq('phone', phone).limit(1);
    if (!r.error) existing = r.data ?? [];
  }
  if (!existing.length && username) {
    const r = await supabase.from('parents').select('*').eq('school_id', schoolId).eq('username', username).limit(1);
    if (!r.error) existing = r.data ?? [];
  }
  if (!existing.length && email) {
    const r = await supabase.from('parents').select('*').eq('school_id', schoolId).eq('email', email).limit(1);
    if (!r.error) existing = r.data ?? [];
  }
  if (existing[0]) return existing[0];

  const fullName = text(parent.full_name ?? parent.ParentName ?? parent.Name);
  if (!fullName) return null;
  const payload: Row = {
    school_id: schoolId,
    full_name: fullName,
    phone: phone || null,
    email: email || null,
    relation: nullable(parent.relation ?? parent.Relation),
    username: username || null,
    pin_code: nullable(parent.pin_code ?? parent.PIN ?? parent.ParentPIN),
    is_active: true,
    can_login: true,
    can_receive_notifications: true,
  };
  const result = await supabase.from('parents').insert(payload).select('*').limit(1);
  if (result.error) throw result.error;
  return result.data?.[0] ?? null;
}

async function linkParentStudent(schoolId: string, parentId: string, studentId: string, relation?: string | null, academicYearId?: string | null) {
  const existing = await supabase.from('parent_students').select('id').eq('parent_id', parentId).eq('student_id', studentId).limit(1);
  if (existing.error) throw existing.error;
  if (existing.data?.length) return;
  const result = await supabase.from('parent_students').insert({
    school_id: schoolId,
    parent_id: parentId,
    student_id: studentId,
    relation: relation ?? null,
    is_primary: false,
    academic_year_id: academicYearId ?? null,
  });
  if (result.error) throw result.error;
}

export async function importAdminWorkbook(params: {
  schoolId: string;
  currentAcademicYearId?: string | null;
  students: Row[];
  parents: Row[];
  teachers: Row[];
}) {
  const { schoolId, currentAcademicYearId } = params;
  let studentsCount = 0, parentsCount = 0, teachersCount = 0, linksCount = 0;

  for (const row of params.students) {
    const name = text(row.StudentName ?? row.FullName);
    if (!name) continue;
    const grade = await findGrade(schoolId, row);
    const section = await findSection(schoolId, grade?.id ?? null, row);
    const route = await findRoute(schoolId, row.RouteName);

    const existing = await supabase.from('students').select('*').eq('school_id', schoolId).eq('full_name', name).limit(1);
    if (existing.error) throw existing.error;
    let student = existing.data?.[0] ?? null;
    const payload: Row = {
      school_id: schoolId,
      full_name: name,
      name,
      birth_date: nullable(row.BirthDate),
      grade_id: grade?.id ?? null,
      grade_name: grade?.name ?? nullable(row.GradeName),
      section_id: section?.id ?? null,
      section_name: section?.name ?? nullable(row.SectionName),
      route_id: route?.id ?? null,
      home_lat: text(row.HomeLat) ? Number(row.HomeLat) : null,
      home_lng: text(row.HomeLng) ? Number(row.HomeLng) : null,
      is_active: true,
    };
    if (student) {
      const r = await supabase.from('students').update(payload).eq('id', student.id).select('*').limit(1);
      if (r.error) throw r.error; student = r.data?.[0] ?? student;
    } else {
      const r = await supabase.from('students').insert(payload).select('*').limit(1);
      if (r.error) throw r.error; student = r.data?.[0] ?? null; studentsCount += 1;
    }
    if (!student) continue;

    for (const idx of [1,2,3]) {
      const pName = text(row[`Parent${idx}Name`]);
      const pPhone = text(row[`Parent${idx}Phone`]);
      if (!pName && !pPhone) continue;
      const parent = await ensureParent(schoolId, {
        ParentName: pName || pPhone,
        Phone: pPhone,
        Relation: row[`Parent${idx}Relation`],
        Username: row[`Parent${idx}Username`],
        PIN: row[`Parent${idx}PIN`],
      });
      if (!parent) continue;
      await linkParentStudent(schoolId, String(parent.id), String(student.id), nullable(row[`Parent${idx}Relation`]), currentAcademicYearId ?? null);
      linksCount += 1;
      if (!student.parent_phone && pPhone) {
        await supabase.from('students').update({ parent_phone: pPhone }).eq('id', student.id);
      }
    }
  }

  for (const row of params.parents) {
    const parent = await ensureParent(schoolId, row);
    if (!parent) continue;
    parentsCount += 1;
    const names = splitList(row.StudentNames);
    for (const studentName of names) {
      const r = await supabase.from('students').select('id').eq('school_id', schoolId).eq('full_name', studentName).limit(1);
      if (r.error) throw r.error;
      if (r.data?.[0]?.id) {
        await linkParentStudent(schoolId, String(parent.id), String(r.data[0].id), nullable(row.Relation), currentAcademicYearId ?? null);
        linksCount += 1;
      }
    }
  }

  for (const row of params.teachers) {
    const fullName = text(row.FullName); if (!fullName) continue;
    const username = text(row.Username);
    let existing: any[] = [];
    if (username) {
      const r = await supabase.from('teachers').select('*').eq('school_id', schoolId).eq('username', username).limit(1);
      if (!r.error) existing = r.data ?? [];
    }
    const route = await findRoute(schoolId, row.RouteName);
    const payload: Row = {
      school_id: schoolId,
      teacher_code: nullable(row.TeacherCode),
      full_name: fullName,
      phone: nullable(row.Phone),
      email: nullable(row.Email),
      subject: nullable(row.Subject),
      national_id: nullable(row.NationalId),
      username: username || null,
      pin_code: nullable(row.PIN),
      route_id: route?.id ?? null,
      is_active: boolValue(row.Active, true),
    };
    if (existing[0]) {
      const r = await supabase.from('teachers').update(payload).eq('id', existing[0].id);
      if (r.error) throw r.error;
    } else {
      const r = await supabase.from('teachers').insert(payload);
      if (r.error) throw r.error;
      teachersCount += 1;
    }
  }

  return { studentsCount, parentsCount, teachersCount, linksCount };
}
