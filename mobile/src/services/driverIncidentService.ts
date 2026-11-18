import { supabase } from '../lib/supabase';

export type DriverIncidentSeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type DriverIncidentItem = {
  id: string;
  school_id: string;
  bus_id: string;
  driver_profile_id: string;
  title: string;
  details?: string | null;
  severity: DriverIncidentSeverity | string;
  happened_at: string;
  created_at: string;
};

export type CreateDriverIncidentInput = {
  schoolId: string;
  busId: string;
  driverId: string;
  title: string;
  details?: string | null;
  severity: DriverIncidentSeverity;
  happenedAt?: string;
};

type DriverIncidentRpcResult = {
  ok?: boolean;
  incident_id?: string;
  driver_id?: string;
  school_id?: string;
  bus_id?: string;
  error?: string;
  message?: string;
};

function uniqueStrings(
  values: Array<string | null | undefined>
) {
  return Array.from(
    new Set(
      values
        .map((value) =>
          String(value ?? '').trim()
        )
        .filter(Boolean)
    )
  );
}

function asRpcResult(
  value: unknown
): DriverIncidentRpcResult {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as DriverIncidentRpcResult;
  }

  return {};
}

function incidentErrorMessage(
  result: DriverIncidentRpcResult
) {
  switch (result.error) {
    case 'driver_required':
      return 'Driver is required.';

    case 'school_required':
      return 'School is required.';

    case 'title_required':
      return 'Incident title is required.';

    case 'driver_not_found':
      return 'Driver profile was not found.';

    case 'school_mismatch':
      return 'Driver does not belong to this school.';

    case 'bus_required':
      return 'Bus is required.';

    case 'bus_mismatch':
      return 'Driver is not assigned to this bus.';

    case 'incident_insert_failed':
      return (
        result.message ??
        'Unable to create incident.'
      );

    default:
      return (
        result.message ??
        result.error ??
        'Unable to create incident.'
      );
  }
}

async function resolveDriverProfileCandidates(
  driverId: string,
  busId: string
) {
  const candidates: string[] = [];

  if (busId) {
    const {
      data: bus,
      error: busError,
    } = await supabase
      .from('buses')
      .select(
        'id,driver_profile_id,main_driver_id,backup_driver_id'
      )
      .eq('id', busId)
      .maybeSingle();

    if (busError) {
      console.log(
        '[driverIncident] bus lookup:',
        busError
      );
    }

    candidates.push(
      ...uniqueStrings([
        bus?.driver_profile_id,
        bus?.main_driver_id,
        bus?.backup_driver_id,
      ])
    );
  }

  const lookupQueries = [
    supabase
      .from('drivers')
      .select('id')
      .eq('id', driverId)
      .maybeSingle(),

    supabase
      .from('drivers')
      .select('id')
      .eq('auth_user_id', driverId)
      .maybeSingle(),

    supabase
      .from('drivers')
      .select('id')
      .eq('user_id', driverId)
      .maybeSingle(),
  ];

  const results =
    await Promise.allSettled(
      lookupQueries
    );

  for (const result of results) {
    if (
      result.status === 'fulfilled' &&
      !result.value.error &&
      result.value.data?.id
    ) {
      candidates.push(
        String(
          result.value.data.id
        )
      );
    }
  }

  candidates.push(driverId);

  return uniqueStrings(
    candidates
  );
}

async function loadCreatedIncident(
  incidentId: string
): Promise<DriverIncidentItem | null> {
  const {
    data,
    error,
  } = await supabase
    .from('driver_incidents')
    .select('*')
    .eq('id', incidentId)
    .maybeSingle();

  if (error) {
    console.log(
      '[driverIncident] created incident lookup:',
      error
    );

    return null;
  }

  return (
    data as DriverIncidentItem | null
  );
}

export async function createDriverIncident(
  input: CreateDriverIncidentInput
): Promise<DriverIncidentItem> {
  const schoolId =
    String(
      input.schoolId ?? ''
    ).trim();

  const busId =
    String(
      input.busId ?? ''
    ).trim();

  const driverId =
    String(
      input.driverId ?? ''
    ).trim();

  const title =
    String(
      input.title ?? ''
    ).trim();

  const details =
    input.details?.trim() ||
    null;

  if (
    !schoolId ||
    !busId ||
    !driverId ||
    !title
  ) {
    throw new Error(
      'Missing required incident information.'
    );
  }

  const candidates =
    await resolveDriverProfileCandidates(
      driverId,
      busId
    );

  if (!candidates.length) {
    throw new Error(
      'Unable to resolve driver profile.'
    );
  }

  let lastResult:
    DriverIncidentRpcResult | null =
    null;

  let lastRpcError:
    unknown = null;

  for (
    const driverProfileId of
      candidates
  ) {
    const {
      data,
      error,
    } = await supabase.rpc(
      'driver_report_incident_v1',
      {
        p_driver_id:
          driverProfileId,

        p_school_id:
          schoolId,

        p_bus_id:
          busId,

        p_title:
          title,

        p_details:
          details,

        p_severity:
          input.severity ??
          'medium',
      }
    );

    if (error) {
      lastRpcError =
        error;

      console.log(
        '[driverIncident] rpc:',
        error
      );

      continue;
    }

    const result =
      asRpcResult(data);

    lastResult =
      result;

    if (
      result.ok === true &&
      result.incident_id
    ) {
      const created =
        await loadCreatedIncident(
          result.incident_id
        );

      if (created) {
        return created;
      }

      /*
       * The INSERT succeeded but RLS may intentionally prevent
       * a PIN session from directly reading driver_incidents.
       * Return the created row information already validated
       * and returned by the secure RPC.
       */
      return {
        id:
          result.incident_id,

        school_id:
          result.school_id ??
          schoolId,

        bus_id:
          result.bus_id ??
          busId,

        driver_profile_id:
          result.driver_id ??
          driverProfileId,

        title,

        details,

        severity:
          input.severity ??
          'medium',

        happened_at:
          input.happenedAt ??
          new Date()
            .toISOString(),

        created_at:
          new Date()
            .toISOString(),
      };
    }

    /*
     * These errors can mean that the current candidate is not
     * the real driver profile. Try the next resolved candidate.
     */
    if (
      result.error ===
        'driver_not_found' ||
      result.error ===
        'school_mismatch' ||
      result.error ===
        'bus_mismatch'
    ) {
      continue;
    }

    throw new Error(
      incidentErrorMessage(
        result
      )
    );
  }

  if (lastResult) {
    throw new Error(
      incidentErrorMessage(
        lastResult
      )
    );
  }

  if (lastRpcError) {
    throw lastRpcError;
  }

  throw new Error(
    'Unable to resolve driver profile.'
  );
}

export async function getDriverIncidents(
  args: {
    driverId: string;
    schoolId?: string | null;
    busId?: string | null;
    limit?: number;
  }
): Promise<DriverIncidentItem[]> {
  const {
    driverId,
    schoolId,
    busId,
    limit = 100,
  } = args;

  if (!driverId) {
    return [];
  }

  const candidates =
    await resolveDriverProfileCandidates(
      driverId,
      busId ?? ''
    );

  if (!candidates.length) {
    return [];
  }

  let query =
    supabase
      .from('driver_incidents')
      .select('*')
      .in(
        'driver_profile_id',
        candidates
      );

  if (schoolId) {
    query =
      query.eq(
        'school_id',
        schoolId
      );
  }

  if (busId) {
    query =
      query.eq(
        'bus_id',
        busId
      );
  }

  const {
    data,
    error,
  } = await query
    .order(
      'happened_at',
      {
        ascending: false,
      }
    )
    .limit(limit);

  if (error) {
    console.log(
      '[driverIncident] list:',
      error
    );

    throw error;
  }

  return (
    data ?? []
  ) as DriverIncidentItem[];
}