import webpush from "web-push";
import { prisma } from "./prisma";

const PUB = process.env.VAPID_PUBLIC || process.env.NEXT_PUBLIC_VAPID_PUBLIC;
const PRIV = process.env.VAPID_PRIVATE;

let ready = false;
function ensure() {
  if (ready) return true;
  if (!PUB || !PRIV) return false;
  webpush.setVapidDetails("mailto:asteinec@gmail.com", PUB, PRIV);
  ready = true;
  return true;
}

// Kirim ke semua perangkat satu user. Hapus langganan yang sudah mati (404/410).
export async function sendToUser(userId, payload) {
  if (!ensure()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
      }
    }
  }
  return sent;
}
