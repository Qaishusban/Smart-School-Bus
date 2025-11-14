"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user) {
      setErrorMsg(error?.message ?? "خطأ في تسجيل الدخول");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    const role = (profile as any)?.role as string | undefined;

    if (role === "super_admin") router.push("/super-admin");
    else if (role === "school_admin") router.push("/school-admin");
    else if (role === "driver") router.push("/driver");
    else if (role === "teacher") router.push("/teacher");
    else if (role === "parent") router.push("/parent");
    else router.push("/");
  };

  return (
    <main>
      <form className="card" onSubmit={onSubmit}>
        <h1>تسجيل الدخول</h1>
        <label>
          البريد الإلكتروني
          <input
            className="input"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          كلمة المرور
          <input
            className="input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>
        {errorMsg && <p style={{ color: "#fca5a5" }}>{errorMsg}</p>}
        <button className="btn" type="submit">دخول</button>
      </form>
    </main>
  );
}
