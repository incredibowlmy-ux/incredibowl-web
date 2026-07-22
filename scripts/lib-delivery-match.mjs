// Shared library: match Accounting deliveries.csv (Grab / private-driver receipts)
// against Firestore orders. Used by:
//   - match-deliveries-to-orders.mjs  (read-only report)
//   - backfill-delivery-method.mjs    (one-off backfill)
//   - sync-grab-receipts.mjs          (weekly incremental sync)
import fs from 'node:fs';

export const CSV = 'C:/Users/User/Desktop/Incredibowl Services/Accounting/evidence/Grab-deliveries/deliveries.csv';
export const KEY = 'C:/Users/User/Desktop/Incredibowl Services/Firebase/incredibowl-1eedd-firebase-adminsdk-fbsvc-f78b077e14.json';

// receipt-name → order userName aliases (each verified against real orders)
export const ALIASES = {
    py: 'py玉',
    elynwong: 'ewong',
    darylkoh: 'darrylkoh',
    shirley: 'thangshirley',
    chungee: 'chungeetan',
    karencham: 'karenhome',   // 06-23 收据地址 Jalan Bk 1/13 = Karen Home（真 Karen Cham 在 Bangsar，精确名优先所以不冲突）
    gwen: 'zhiyuen',          // 老板 07-23 确认：Gwen = Zhi Yuen / ZY
};

// receipt-specific overrides (booking-id tail-6 → order doc-id tail-6) for orders
// placed under "Guest" where address/phone identifies the person
export const OVERRIDES = {
    '9LPE55': 'BXPBD9',  // Shirley 07-16 → Guest 0122785765（Thang Shirley 的电话, Jalan Morib）
    'TSDVB5': '7BOJ5E',  // Chen fung chiun 07-17 → Guest 同街 jalan impian indah 1
    'UBBGR1': '4UKGVB',  // Racheel 07-14 → Guest 0163628625 Midfields（老板 07-23 确认）
    'JESH21': '0GWQ4X',  // Racheel 07-15 → Guest 0163628625 Midfields（老板 07-23 确认）
};

export function parseCsv(text) {
    const rows = [];
    let field = '', row = [], inQ = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQ) {
            if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
            else field += c;
        } else if (c === '"') inQ = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(field); field = '';
            if (row.some(f => f !== '')) rows.push(row);
            row = [];
        } else field += c;
    }
    if (field !== '' || row.length) { row.push(field); if (row.some(f => f !== '')) rows.push(row); }
    return rows;
}

// → deduped DELIVERY receipts [{date, client, area, km, fee, vehicle, booking, note, file}]
export function loadReceipts() {
    const raw = parseCsv(fs.readFileSync(CSV, 'utf-8'));
    const header = raw[0];
    const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
    const rows = raw.slice(1).map(r => ({
        date: r[col.date]?.trim(),
        client: r[col.client]?.trim(),
        area: r[col.area]?.trim(),
        km: r[col.distance_km]?.trim(),
        fee: r[col.fee_rm]?.trim(),
        vehicle: r[col.vehicle]?.trim(),
        type: r[col.type]?.trim(),
        booking: r[col.booking_id]?.trim(),
        note: r[col.note]?.trim(),
        file: r[col.file]?.trim(),
    })).filter(r => r.type === 'DELIVERY');
    const seen = new Set();
    const receipts = [];
    for (const r of rows) {
        const key = r.booking && r.booking !== '-' ? r.booking : `${r.date}|${r.client}|${r.fee}`;
        if (seen.has(key)) continue;
        seen.add(key);
        receipts.push(r);
    }
    return receipts;
}

export function orderDateStr(o) {
    const d = o.deliveryDate;
    if (typeof d === 'string') return d.slice(0, 10);
    if (d?.toDate) return d.toDate().toISOString().slice(0, 10);
    return '';
}

// → simplified in-memory orders (non-cancelled, from 2026-05-11)
export async function loadOrders(db) {
    const snap = await db.collection('orders').get();
    return snap.docs.map(d => {
        const o = d.data();
        return {
            id: d.id,
            shortId: (d.id || '').slice(-6).toUpperCase(),
            name: o.userName || '',
            phone: o.userPhone || '',
            userId: o.userId || '',
            date: orderDateStr(o),
            status: o.status,
            zone: o.deliveryZone,
            km: o.deliveryDistanceKm,
            fee: o.deliveryFee || 0,
            total: o.total || 0,
            costActual: o.deliveryCostActual,
            method: o.deliveryMethod,
            addr: (o.userAddress || '').slice(0, 40),
        };
    }).filter(o => o.status !== 'cancelled' && o.date >= '2026-05-11');
}

const norm = (s) => (s || '').toLowerCase().replace(/[\s_\-.•]/g, '');
const dashName = (r) => {
    const m = /dashboard_name=([^;]*)/.exec(r.note || '');
    return m ? m[1].trim() : '';
};

// score: 3 = exact original name, 2 = exact alias, 1 = substring — so a receipt
// for the REAL "Karen Cham" prefers the Karen Cham order over the karenhome alias.
export function nameScore(csvRow, orderName) {
    const o = norm(orderName);
    if (!o) return 0;
    const candidates = [csvRow.client, dashName(csvRow)].map(norm).filter(Boolean);
    let best = 0;
    for (const c of candidates) {
        if (c === o) best = Math.max(best, 3);
        else if (ALIASES[c] && ALIASES[c] === o) best = Math.max(best, 2);
        else if (c.length >= 3 && (o.includes(c) || c.includes(o))) best = Math.max(best, 1);
    }
    return best;
}

// Two passes: ALL receipts try exact-date first, only leftovers get ±1 day —
// prevents a ±1 greedy match stealing another receipt's exact-date order.
export function matchReceipts(orders, receipts) {
    const matchedPairs = [];
    const usedOrderIds = new Set();
    let pending = [...receipts];
    for (const offsets of [[0], [-1, 1]]) {
        const still = [];
        for (const r of pending) {
            let hit = null, offUsed = 0;
            const bookTail = (r.booking || '').slice(-6).toUpperCase();
            if (OVERRIDES[bookTail]) {
                const target = orders.find(o => o.shortId === OVERRIDES[bookTail] && !usedOrderIds.has(o.id));
                if (target) { usedOrderIds.add(target.id); matchedPairs.push({ r, o: target, off: 0 }); continue; }
            }
            for (const off of offsets) {
                const d = new Date(r.date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + off);
                const ds = d.toISOString().slice(0, 10);
                const cands = orders
                    .map(o => ({ o, s: (o.date === ds && !usedOrderIds.has(o.id)) ? nameScore(r, o.name) : 0 }))
                    .filter(x => x.s > 0)
                    .sort((a, b) => b.s - a.s);
                if (cands.length) { hit = cands[0].o; offUsed = off; break; }
            }
            if (hit) { usedOrderIds.add(hit.id); matchedPairs.push({ r, o: hit, off: offUsed }); }
            else still.push(r);
        }
        pending = still;
    }
    return { matchedPairs, unmatchedReceipts: pending, usedOrderIds };
}
