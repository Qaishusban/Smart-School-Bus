
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";

export function Navbar() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    router.push("/login");
  };

  return (
    <header style={{
      borderBottom: "1px solid rgba(148,163,184,0.35)",
      background: "rgba(15,23,42,0.95)",
      backdropFilter: "blur(10px)"
    }}>
      <div className="container" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: "0.75rem",
        paddingBottom: "0.75rem"
      }}>
        <Link href="/" style={{ fontWeight: 700, letterSpacing: "0.06em", fontSize: "0.9rem" }}>
          SMART SCHOOL BUS
        </Link>
        <nav style={{ display: "flex", gap: "0.75rem", alignItems: "center", fontSize: "0.85rem" }}>
          <Link href="/super-admin">Super Admin</Link>
          <Link href="/school-admin">School Admin</Link>
          <Link href="/driver">Driver</Link>
          <Link href="/teacher">Teacher</Link>
          <Link href="/parent">Parent</Link>
          <button
            className="btn"
            style={{ paddingInline: "0.9rem", fontSize: "0.8rem" }}
            onClick={handleLogout}
            disabled={loading}
          >
            {loading ? "Logging out..." : "Logout"}
          </button>
        </nav>
      </div>
    </header>
  );
}
