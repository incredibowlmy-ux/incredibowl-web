// READ-ONLY: print all non-cancelled orders on given dates (name/phone/zone/fee)
// to resolve receipt-name vs order-name mismatches.
// Usage: node scripts/peek-orders-on-dates.mjs 2026-07-14 2026-07-16 ...
import admin from 'firebase-admin';
import fs from 'node:fs';

const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(KEY, 'utf-8'))) });
const db = admin.firestore();

const dates = process.argv.slice(2);
for (const date of dates) {
    const snap = await db.collection('orders').where('deliveryDate', '==', date).get();
    console.log(`\n=== ${date} (${snap.size} docs) ===`);
    snap.docs.forEach(d => {
        const o = d.data();
        if (o.status === 'cancelled') return;
        console.log(`  ${d.id.slice(-6).toUpperCase()}  ${String(o.userName || '(无名)').padEnd(22)} ${String(o.userPhone || '').padEnd(13)} zone=${String(o.deliveryZone)} fee=${o.deliveryFee || 0} total=${o.total} ${(o.userAddress || '').slice(0, 45)}`);
    });
}
await admin.app().delete();
