import { redirect } from "next/navigation";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import LoginForm from "./LoginForm";
import BantuanWa from "@/components/BantuanWa";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(isAdmin(user) ? "/admin" : "/");
  // HP: hero di atas, form di bawahnya. Laptop: hero setinggi layar di kiri, form dan bantuan di kanan.
  return (
    <div className="masuk">
      <div className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-dpro.svg" alt="D'Production" />
        <div>
          <div className="mata">Absensi crew D&apos;Production</div>
          <h1>Silakan masuk<br />untuk absen.</h1>
        </div>
      </div>
      <div className="masuk-isi">
        <LoginForm />
        <div className="butuh-bantuan">
          <div className="judul-bantuan">Perlu bantuan?</div>
          <BantuanWa jenis={["belum", "password", "lain"]} />
        </div>
      </div>
    </div>
  );
}
