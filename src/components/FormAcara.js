import { simpanAcara } from "@/app/admin/actions";
import { keInput } from "@/lib/waktu";
import KoordinatInput from "@/components/KoordinatInput";

export default function FormAcara({ acara }) {
  return (
    <form action={simpanAcara}>
      {acara && <input type="hidden" name="id" value={acara.id} />}
      <label>Nama acara</label>
      <input type="text" name="name" defaultValue={acara?.name} required />
      <label>Klien (boleh kosong)</label>
      <input type="text" name="client" defaultValue={acara?.client || ""} />
      <label>Titik lokasi (lintang, bujur)</label>
      <KoordinatInput defaultValue={acara ? `${acara.lat}, ${acara.lng}` : ""} />
      <label>Radius absen (meter)</label>
      <input type="number" name="radiusM" min="10" max="100000" defaultValue={acara?.radiusM ?? 150} required />
      <div className="dua">
        <div>
          <label>Mulai (WIB)</label>
          <input type="datetime-local" name="startAt" defaultValue={keInput(acara?.startAt)} required />
        </div>
        <div>
          <label>Selesai (WIB, boleh kosong)</label>
          <input type="datetime-local" name="endAt" defaultValue={keInput(acara?.endAt)} />
        </div>
      </div>
      <label className="pilihan">
        <div className="grow"><b>Acara aktif</b><span>Sesinya muncul di halaman absen crew.</span></div>
        <input type="checkbox" className="sakelar" name="active" defaultChecked={acara ? acara.active : true} />
      </label>
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn-primary" style={{ width: "auto" }}>{acara ? "Simpan acara" : "Buat acara"}</button>
      </div>
    </form>
  );
}
