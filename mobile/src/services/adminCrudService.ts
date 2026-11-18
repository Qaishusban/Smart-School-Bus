import { supabase } from '../lib/supabase';

export type AdminCrudRow = Record<string, any>;

function cleanText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

export async function listSchoolRows(
  table: string,
  schoolId?: string | null,
  options?: {
    orderBy?: string;
    ascending?: boolean;
    limit?: number;
  }
) {
  let query = supabase.from(table).select('*');

  if (schoolId) {
    query = query.eq('school_id', schoolId);
  }

  if (options?.orderBy) {
    query = query.order(options.orderBy, {
      ascending: options.ascending ?? false,
    });
  }

  const { data, error } = await query.limit(options?.limit ?? 500);

  if (error) throw error;
  return (data ?? []) as unknown as AdminCrudRow[];
}

export async function createAcademicYear(args: {
  schoolId: string;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  isCurrent?: boolean;
}) {
  if (args.isCurrent) {
    const { error: clearError } = await supabase
      .from('academic_years')
      .update({ is_current: false })
      .eq('school_id', args.schoolId)
      .eq('is_current', true);

    if (clearError) throw clearError;
  }

  const { data, error } = await supabase
    .from('academic_years')
    .insert({
      school_id: args.schoolId,
      name: args.name.trim(),
      start_date: cleanText(args.startDate),
      end_date: cleanText(args.endDate),
      is_current: Boolean(args.isCurrent),
    })
    .select('*')
    .single();

  if (error) throw error;

  if (args.isCurrent && data?.id) {
    const { error: schoolError } = await supabase
      .from('schools')
      .update({ current_academic_year_id: data.id })
      .eq('id', args.schoolId);

    if (schoolError) throw schoolError;
  }

  return data as AdminCrudRow;
}

export async function updateAcademicYear(
  id: string,
  args: {
    schoolId: string;
    name: string;
    startDate?: string | null;
    endDate?: string | null;
    isCurrent?: boolean;
  }
) {
  if (args.isCurrent) {
    const { error: clearError } = await supabase
      .from('academic_years')
      .update({ is_current: false })
      .eq('school_id', args.schoolId)
      .neq('id', id)
      .eq('is_current', true);

    if (clearError) throw clearError;
  }

  const { data, error } = await supabase
    .from('academic_years')
    .update({
      name: args.name.trim(),
      start_date: cleanText(args.startDate),
      end_date: cleanText(args.endDate),
      is_current: Boolean(args.isCurrent),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;

  if (args.isCurrent && data?.id) {
    const { error: schoolError } = await supabase
      .from('schools')
      .update({ current_academic_year_id: data.id })
      .eq('id', args.schoolId);

    if (schoolError) throw schoolError;
  } else {
    const { data: school } = await supabase
      .from('schools')
      .select('current_academic_year_id')
      .eq('id', args.schoolId)
      .maybeSingle();

    if (school?.current_academic_year_id === id) {
      const { error: clearSchoolError } = await supabase
        .from('schools')
        .update({ current_academic_year_id: null })
        .eq('id', args.schoolId);

      if (clearSchoolError) throw clearSchoolError;
    }
  }

  return data as AdminCrudRow;
}

export async function deleteAcademicYear(id: string) {
  const { error } = await supabase
    .from('academic_years')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function createDriver(args: {
  schoolId: string;
  fullName: string;
  phone?: string | null;
  nationalId?: string | null;
  driverLicenseNumber?: string | null;
  driverLicenseExpiry?: string | null;
  busLicenseNumber?: string | null;
  busLicenseExpiry?: string | null;
  username?: string | null;
  pinCode?: string | null;
  isActive?: boolean;
}) {
  const payload: Record<string, any> = {
    school_id: args.schoolId,
    full_name: args.fullName.trim(),
    phone: cleanText(args.phone),
    phone_number: cleanText(args.phone),
    national_id: cleanText(args.nationalId),
    driver_license_number: cleanText(args.driverLicenseNumber),
    driver_license_expiry: cleanText(args.driverLicenseExpiry),
    bus_license_number: cleanText(args.busLicenseNumber),
    bus_license_expiry: cleanText(args.busLicenseExpiry),
    username: cleanText(args.username),
    pin_code: cleanText(args.pinCode),
    is_active: args.isActive ?? true,
  };

  const { data, error } = await supabase
    .from('drivers')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as AdminCrudRow;
}

export async function updateDriver(
  id: string,
  args: {
    fullName: string;
    phone?: string | null;
    nationalId?: string | null;
    driverLicenseNumber?: string | null;
    driverLicenseExpiry?: string | null;
    busLicenseNumber?: string | null;
    busLicenseExpiry?: string | null;
    username?: string | null;
    pinCode?: string | null;
    isActive?: boolean;
  }
) {
  const payload: Record<string, any> = {
    full_name: args.fullName.trim(),
    phone: cleanText(args.phone),
    phone_number: cleanText(args.phone),
    national_id: cleanText(args.nationalId),
    driver_license_number: cleanText(args.driverLicenseNumber),
    driver_license_expiry: cleanText(args.driverLicenseExpiry),
    bus_license_number: cleanText(args.busLicenseNumber),
    bus_license_expiry: cleanText(args.busLicenseExpiry),
    username: cleanText(args.username),
    is_active: args.isActive ?? true,
  };

  if (args.pinCode !== undefined) {
    payload.pin_code = cleanText(args.pinCode);
  }

  const { data, error } = await supabase
    .from('drivers')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as AdminCrudRow;
}

export async function deleteDriver(id: string) {
  const { error } = await supabase
    .from('drivers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function createBus(args: {
  schoolId: string;
  busNumber: string;
  plateNumber?: string | null;
  capacity?: number | null;
  mainDriverId?: string | null;
  backupDriverId?: string | null;
  registrationNumber?: string | null;
  licenseExpiry?: string | null;
  notes?: string | null;
  isActive?: boolean;
}) {
  const { data, error } = await supabase
    .from('buses')
    .insert({
      school_id: args.schoolId,
      bus_number: args.busNumber.trim(),
      plate_number: cleanText(args.plateNumber),
      capacity: args.capacity ?? null,
      main_driver_id: cleanText(args.mainDriverId),
      backup_driver_id: cleanText(args.backupDriverId),
      registration_number: cleanText(args.registrationNumber),
      license_expiry: cleanText(args.licenseExpiry),
      notes: cleanText(args.notes),
      is_active: args.isActive ?? true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as AdminCrudRow;
}

export async function updateBus(
  id: string,
  args: {
    busNumber: string;
    plateNumber?: string | null;
    capacity?: number | null;
    mainDriverId?: string | null;
    backupDriverId?: string | null;
    registrationNumber?: string | null;
    licenseExpiry?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }
) {
  const { data, error } = await supabase
    .from('buses')
    .update({
      bus_number: args.busNumber.trim(),
      plate_number: cleanText(args.plateNumber),
      capacity: args.capacity ?? null,
      main_driver_id: cleanText(args.mainDriverId),
      backup_driver_id: cleanText(args.backupDriverId),
      registration_number: cleanText(args.registrationNumber),
      license_expiry: cleanText(args.licenseExpiry),
      notes: cleanText(args.notes),
      is_active: args.isActive ?? true,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as AdminCrudRow;
}

export async function deleteBus(id: string) {
  const { error } = await supabase
    .from('buses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getDriversForLookup(schoolId?: string | null) {
  return listSchoolRows('drivers', schoolId, {
    orderBy: 'full_name',
    ascending: true,
    limit: 500,
  });
}
