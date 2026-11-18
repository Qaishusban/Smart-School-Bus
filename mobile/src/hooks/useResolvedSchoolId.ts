import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type UserLike = {
  id?: string | null;
  school_id?: string | null;
  email?: string | null;
} | null | undefined;

export function useResolvedSchoolId(user: UserLike) {
  const direct = user?.school_id ? String(user.school_id) : null;
  const [resolved, setResolved] = useState<string | null>(direct);
  const [loading, setLoading] = useState(!direct && !!user?.id);

  useEffect(() => {
    let active = true;

    if (direct) {
      setResolved(direct);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    if (!user?.id) {
      setResolved(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);

    void (async () => {
      try {
        const byId = await supabase
          .from('profiles')
          .select('school_id')
          .eq('id', user.id)
          .limit(1);

        if (byId.error) throw byId.error;

        let schoolId = byId.data?.[0]?.school_id
          ? String(byId.data[0].school_id)
          : null;

        if (!schoolId && user.email) {
          const byEmail = await supabase
            .from('profiles')
            .select('school_id')
            .eq('email', user.email)
            .limit(1);

          if (!byEmail.error && byEmail.data?.[0]?.school_id) {
            schoolId = String(byEmail.data[0].school_id);
          }
        }

        if (active) setResolved(schoolId);
      } catch (error) {
        console.log('[admin] resolve school id failed:', error);
        if (active) setResolved(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [direct, user?.id, user?.email]);

  return useMemo(
    () => ({ schoolId: direct ?? resolved, loading }),
    [direct, resolved, loading]
  );
}
