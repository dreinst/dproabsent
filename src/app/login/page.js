import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(isAdmin(user) ? "/admin" : "/");
  return (
    <div className="wrap">
      <div className="auth-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/logo-dpro.svg" alt="D'Production" style={{ height: 38 }} />
        <div className="tag">Absen crew: lokasi dan foto diambil saat absen</div>
      </div>
      <div className="card">
        <h2>Masuk</h2>
        <p className="sub">Pakai nomor HP dan password dari kantor.</p>
        <LoginForm />
      </div>
    </div>
  );
}
