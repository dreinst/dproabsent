import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import LoginForm from "./LoginForm";
import BantuanWa from "@/components/BantuanWa";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(isAdmin(user) ? "/admin" : "/");
  return (
    <div className="masuk">
      <div className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-dpro.svg" alt="D'Production" />
        <div>
          <div className="mata">Absen crew D&apos;Production</div>
          <h1>Masuk dulu,<br />lalu absen.</h1>
        </div>
      </div>
      <LoginForm />
      <div className="butuh-bantuan">
        <div className="judul-bantuan">Butuh bantuan?</div>
        <BantuanWa jenis={["belum", "password", "lain"]} />
      </div>
    </div>
  );
}
