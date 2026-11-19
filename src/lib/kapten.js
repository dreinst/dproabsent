import { prisma } from "./prisma";

// Aturan kapten acara di satu tempat. Kapten adalah crew yang ditunjuk owner atau superadmin (tabel KaptenAcara)
// untuk mengesahkan absen crew di acara itu. Owner dan superadmin tidak memakai aturan ini karena boleh mengubah semuanya.

// Peta eventId -> Set userId kapten, untuk acara yang diminta.
export async function petaKapten(eventIds) {
  const peta = new Map(eventIds.map((id) => [id, new Set()]));
  if (eventIds.length === 0) return peta;
  const rows = await prisma.kaptenAcara.findMany({
    where: { eventId: { in: eventIds } },
    select: { eventId: true, userId: true },
  });
  for (const r of rows) peta.get(r.eventId)?.add(r.userId);
  return peta;
}

// Hak kapten (sayaId) atas satu absen, tanpa query, supaya API dan tampilan memakai aturan yang sama.
// absen berisi userId, verifiedAt, verifiedById, dan user.role. kapten adalah Set userId kapten di acara absen itu.
// Hasilnya { putus, batal, alasan }:
//   putus  = boleh Sahkan dan Tolak,
//   batal  = boleh Batalkan pengesahan,
//   alasan = penjelasan kalau absen ini sama sekali bukan wewenang kapten tersebut.
export function hakKapten(sayaId, absen, kapten = new Set()) {
  let alasan = null;
  if (!kapten.has(sayaId)) alasan = "Anda bukan kapten di acara ini.";
  else if (absen.userId === sayaId) alasan = "Absen Anda sendiri disahkan oleh owner atau superadmin.";
  else if (kapten.has(absen.userId)) alasan = "Absen kapten disahkan oleh owner atau superadmin.";
  else if (absen.user?.role !== "CREW") alasan = "Absen owner dan superadmin disahkan oleh owner atau superadmin.";
  if (alasan) return { putus: false, batal: false, alasan };

  // Kapten tidak menimpa keputusan orang lain. Sahkan dan Tolak hanya untuk absen yang belum diputuskan
  // atau yang diputuskan kapten itu sendiri, dan pembatalan hanya untuk pengesahan yang ia buat sendiri.
  const buatanSendiri = absen.verifiedById === sayaId;
  return { putus: !absen.verifiedAt || buatanSendiri, batal: Boolean(absen.verifiedAt) && buatanSendiri, alasan: null };
}

// Kapten boleh melihat foto absen di sesi milik acara yang ia pegang.
export async function kaptenDiSesi(userId, sessionId) {
  const ada = await prisma.kaptenAcara.findFirst({
    where: { userId, event: { sessions: { some: { id: sessionId } } } },
    select: { eventId: true },
  });
  return Boolean(ada);
}

// Kapten boleh melihat foto profil user yang punya absen di acara yang ia pegang.
export async function kaptenBolehLihatProfil(userId, targetId) {
  const ada = await prisma.absensi.findFirst({
    where: { userId: targetId, session: { event: { kapten: { some: { userId } } } } },
    select: { id: true },
  });
  return Boolean(ada);
}
