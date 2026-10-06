import "./globals.css";

export const metadata = {
  title: "DPro Absen",
  description: "Absensi crew D'Production berbasis lokasi dan foto",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0f1420",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
