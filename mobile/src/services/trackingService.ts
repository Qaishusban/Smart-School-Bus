import { supabase } from '../lib/supabase';

export interface BusLiveLocation {
  id?: string;
  bus_id: string;
  school_id?: string | null;

  lat: number;
  lng: number;

  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;

  updated_at?: string | null;
  created_at?: string | null;
}

export interface BusTrackingPoint {
  id?: string;
  bus_id: string;
  school_id?: string | null;
  driver_id?: string | null;

  lat: number;
  lng: number;

  speed?: number | null;
  heading?: number | null;

  recorded_at?: string | null;
  created_at?: string | null;
}

export async function getLatestBusLocation(
  busId: string
): Promise<BusLiveLocation | null> {
  if (!busId) return null;

  const { data, error } = await supabase
    .from('bus_live_locations')
    .select('*')
    .eq('bus_id', busId)
    .order('updated_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.log(
      'getLatestBusLocation error:',
      error
    );
    throw error;
  }

  return data as BusLiveLocation | null;
}

export async function getBusTrackingPoints(
  busId: string,
  limit = 200
): Promise<BusTrackingPoint[]> {
  if (!busId) return [];

  const { data, error } = await supabase
    .from('bus_tracking_points')
    .select('*')
    .eq('bus_id', busId)
    .order('recorded_at', {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    console.log(
      'getBusTrackingPoints error:',
      error
    );
    throw error;
  }

  return (
    (data ?? []) as BusTrackingPoint[]
  ).reverse();
}

export function subscribeToBusLocation(
  busId: string,
  callback: (
    location: BusLiveLocation
  ) => void
) {
  const channel = supabase.channel(
    `bus-live-${busId}-${Date.now()}`
  );

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bus_live_locations',
        filter: `bus_id=eq.${busId}`,
      },
      (payload) => {
        if (!payload.new) return;

        callback(
          payload.new as BusLiveLocation
        );
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToTrackingPoints(
  busId: string,
  callback: (
    point: BusTrackingPoint
  ) => void
) {
  const channel = supabase.channel(
    `bus-points-${busId}-${Date.now()}`
  );

  channel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bus_tracking_points',
        filter: `bus_id=eq.${busId}`,
      },
      (payload) => {
        if (!payload.new) return;

        callback(
          payload.new as BusTrackingPoint
        );
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}