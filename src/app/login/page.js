import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(isAdmin(user) ? "/admin" : "/");
  return (
    <div className="wrap">
      <div className="topbar">
        <h1>DPro Absen</h1>
      </div>
      <div className="card">
        <h2>Masuk</h2>
        <p className="sub">Pakai nomor HP dan password dari kantor.</p>
        <LoginForm />
      </div>
      <p className="meta">Absensi crew D'Production. Lokasi dan foto diambil saat absen.</p>
    </div>
  );
}
