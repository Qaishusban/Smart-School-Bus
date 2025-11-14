"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ParentPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return router.push("/login");
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (!profile || (profile as any).role !== "parent")
        return router.push("/login");
      setOk(true);
    };
    check();
  }, [router]);

  if (!ok) return null;

  return (
    <main>
      <div className="card">
        <h1>واجهة ولي الأمر (Parent)</h1>
        <p>هذه صفحة جاهزة للتوسعة حسب مواصفات المشروع.</p>
      </div>
    </main>
  );
}
