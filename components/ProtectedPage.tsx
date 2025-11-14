
"use client";

import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Props = {
  children: ReactNode;
  allowedRoles?: string[];
};

type Profile = {
  id: string;
  role: string;
};

export function ProtectedPage({ children, allowedRoles }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      if (!allowedRoles || allowedRoles.length === 0) {
        setAllowed(true);
        setChecking(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        // eslint-disable-next-line no-console
        console.error(error);
      }

      if (!profile) {
        router.push("/login");
        return;
      }

      if (allowedRoles.includes((profile as Profile).role)) {
        setAllowed(true);
      } else {
        router.push("/");
      }
      setChecking(false);
    };

    run();
  }, [router, allowedRoles]);

  if (checking) {
    return (
      <main>
        <div className="container">
          <div className="card">
            <p>جارٍ التحقق من الصلاحيات / Checking permissions…</p>
          </div>
        </div>
      </main>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
