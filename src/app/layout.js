import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "DPro Absen",
  description: "Absensi crew D'Production berbasis lokasi dan foto",
  manifest: "/manifest.webmanifest",
  // Lambang D dari logo ringkas D'Pro: SVG untuk browser modern, ICO untuk yang lama, PNG untuk layar utama iPhone.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "DPro Absen" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b2144",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.variable}>
      <body>
        {children}
        {/* Kaki navy seperti landing dpro.events, logo dibuat putih lewat CSS. */}
        <footer className="kaki">
          <span>
            Made by{" "}
            <a href="https://www.instagram.com/dreiinst/" target="_blank" rel="noopener noreferrer">
              dreinst
            </a>
          </span>
          <span className="kaki-garis" aria-hidden="true" />
          <span className="kaki-org">
            Organized by
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG statis, tanpa optimasi */}
            <img src="/logo-dpro-ringkas.svg?v=2" alt="D'PRO" />
          </span>
        </footer>
      </body>
    </html>
  );
}
