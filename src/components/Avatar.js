// Foto profil bulat, atau inisial nama kalau belum ada foto. Bisa dipakai di komponen server maupun klien.
// Gambar diambil dari /api/profil/<id>; parameter v berubah setiap foto diganti supaya cache browser ikut berganti.
export default function Avatar({ id, nama, avatar, ukuran = 40 }) {
  const gaya = { width: ukuran, height: ukuran, fontSize: Math.round(ukuran * 0.4) };
  if (avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="avatar" style={gaya} loading="lazy" alt={`Foto profil ${nama}`}
        src={`/api/profil/${id}?v=${encodeURIComponent(avatar.split("/").pop())}`}
      />
    );
  }
  const inisial = String(nama || "")
    .replace(/\(.*?\)/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((k) => k[0] || "")
    .join("")
    .toUpperCase();
  return <span className="avatar inisial" style={gaya} aria-hidden="true">{inisial || "?"}</span>;
}
