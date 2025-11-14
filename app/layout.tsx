import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Smart School Bus System",
  description: "Smart school bus with Supabase"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
