import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPasswordAsync } from "@/lib/password";
import { setSession } from "@/lib/auth";
import { sisaTunggu, catatGagal, hapusCatatan } from "@/lib/batas";
import { rapikanNama, namaDepan } from "@/lib/nama";

const MAKS_PER_NAMA = 5;
const MAKS_PER_IP = 40;
const MAKS_CALON = 6; // batas akun bernama sama yang dicoba, supaya satu login tidak memicu banyak scrypt

export async function POST(req) {
  const { nama, password } = await req.json().catch(() => ({}));
  const n = rapikanNama(nama);
  if (!n || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Nama dan password wajib diisi." }, { status: 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "tanpa-ip";
  const kunciNama = `nama:${n}`;
  const kunciIp = `ip:${ip}`;
  const tunggu = Math.max(sisaTunggu(kunciNama, MAKS_PER_NAMA), sisaTunggu(kunciIp, MAKS_PER_IP));
  if (tunggu > 0) {
    return NextResponse.json(
      { error: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(tunggu / 60)} menit.` },
      { status: 429, headers: { "retry-after": String(tunggu) } }
    );
  }

  // Masuk pakai nama depan atau nama lengkap. Huruf besar dan tanda baca diabaikan,
  // jadi "adam araya" cocok dengan "Adam (Araya)".
  const calon = await prisma.user.findMany({
    where: { active: true, name: { contains: n.split(" ")[0], mode: "insensitive" } },
    select: { id: true, name: true, role: true, passwordHash: true },
  });
  const senama = calon
    .filter((u) => rapikanNama(u.name) === n || namaDepan(u.name) === n)
    .slice(0, MAKS_CALON);

  // Beberapa akun bisa bernama sama (dua "Ian"). Password dicocokkan ke tiap akun,
  // dan login hanya berhasil kalau persis satu yang cocok, supaya tidak salah orang.
  // Kalau tidak ada akun, tetap jalankan satu verifikasi supaya waktu jawabnya sama.
  const hasil = await Promise.all(
    (senama.length ? senama : [null]).map((u) => verifyPasswordAsync(password, u?.passwordHash))
  );
  const cocok = senama.filter((_, i) => hasil[i]);
  if (cocok.length !== 1) {
    catatGagal(kunciNama);
    catatGagal(kunciIp);
    return NextResponse.json({ error: "Nama atau password salah." }, { status: 401 });
  }

  const user = cocok[0];
  hapusCatatan(kunciNama);
  await setSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
