// Synthetic CAPI smoke test — fires one InitiateCheckout to verify
// the access token works before touching the real checkout flow.
// Run: node scripts/test-capi.mjs

import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';

// Tiny .env.local parser (avoid pulling in dotenv just for this)
const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const PIXEL_ID = env.META_PIXEL_ID;
const TOKEN = env.META_CAPI_ACCESS_TOKEN;
const TEST_CODE = env.META_CAPI_TEST_EVENT_CODE;

if (!PIXEL_ID || !TOKEN) {
  console.error('❌ Missing META_PIXEL_ID or META_CAPI_ACCESS_TOKEN in .env.local');
  process.exit(1);
}

const sha = (v) => crypto.createHash('sha256').update(v.trim().toLowerCase()).digest('hex');
const eventId = `smoke_test_${Date.now()}`;

const payload = {
  data: [{
    event_name: 'InitiateCheckout',
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: 'https://www.incredibowl.my/',
    user_data: {
      em: [sha('test@incredibowl.my')],
      ph: [sha('60103370197')],
      client_ip_address: '1.2.3.4',
      client_user_agent: 'Mozilla/5.0 (CAPI smoke test)',
    },
    custom_data: {
      currency: 'MYR',
      value: 18.50,
      num_items: 1,
    },
  }],
  access_token: TOKEN,
  ...(TEST_CODE ? { test_event_code: TEST_CODE } : {}),
};

console.log(`→ Pixel ID:     ${PIXEL_ID}`);
console.log(`→ Test code:    ${TEST_CODE || '(none — would hit production)'}`);
console.log(`→ Event ID:     ${eventId}`);
console.log(`→ Token prefix: ${TOKEN.slice(0, 20)}…`);
console.log('');

const url = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;
const res = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const json = await res.json();

if (res.ok) {
  console.log(`✅ Meta accepted the event (HTTP ${res.status})`);
  console.log(JSON.stringify(json, null, 2));
  console.log('');
  console.log(`Now check business.facebook.com/events_manager2 → your Pixel`);
  console.log(`→ Test Events tab → enter code "${TEST_CODE}"`);
  console.log(`→ You should see InitiateCheckout from Server within 30 seconds.`);
} else {
  console.error(`❌ Meta rejected the event (HTTP ${res.status})`);
  console.error(JSON.stringify(json, null, 2));
  process.exit(1);
}
