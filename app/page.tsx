import Link from "next/link";

export default function Home() {
  return (
    <main>
      <div className="card">
        <h1>نظام النقل المدرسي الذكي</h1>
        <p>نسخة نظيفة مرتبطة بـ Supabase (بدون Prisma ولا SQLite).</p>
        <Link className="btn" href="/login">دخول النظام</Link>
      </div>
    </main>
  );
}
