import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata = {
  title: "DPro Absen",
  description: "Absensi crew D'Production berbasis lokasi dan foto",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "DPro Absen" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2563eb",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={`${inter.variable} ${jakarta.variable}`}>
        {children}
        <footer style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "20px 16px 24px", fontSize: 11, color: "var(--muted)", fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
          <span>Made by dreinst</span>
          <span aria-hidden="true" style={{ width: 1, height: 14, background: "var(--line)" }} />
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            Organized by
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG statis, tanpa optimasi */}
            <img src="/logo-dpro-ringkas.svg?v=2" alt="D'PRO" style={{ height: 16, width: "auto", opacity: 0.7 }} />
          </span>
        </footer>
      </body>
    </html>
  );
}
