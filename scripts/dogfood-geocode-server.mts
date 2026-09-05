/**
 * Dogfood: 服务端正向地理编码（lib/geocodeServer.geocodeForward）。
 *
 * 守的是 2026-09-05 A2：/api/geocode 与 /api/save-address 共用这一份 Google 调用 +
 * 25km 拒绝 + 结果整形。注入假 fetch，不打 Google。
 */
import { geocodeForward } from '../src/lib/geocodeServer.ts';
import { PEARL_POINT_LAT, PEARL_POINT_LNG, MAX_DELIVERY_KM } from '../src/lib/deliveryUtils.ts';

let pass = 0, fail = 0;
const t = (label: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`  ${cond ? '✓' : '✗'} ${label}`); };

const fake = (payload: unknown) => (async () => ({ json: async () => payload })) as unknown as typeof fetch;
const KEY = 'fake-key';

// ── 正常：厨房门口 → within2km，距离 0.00 ─────────────────────────────
{
  const r = await geocodeForward('Pearl Suria', KEY, fake({
    status: 'OK',
    results: [{ geometry: { location: { lat: PEARL_POINT_LAT, lng: PEARL_POINT_LNG } }, formatted_address: 'Pearl Suria, KL' }],
  }));
  t('OK → ok:true', r.ok);
  if (r.ok) {
    t('距离两位小数且为 0', r.result.distanceKm === 0);
    t('zone=within2km', r.result.zone === 'within2km');
    t('formattedAddress 原样', r.result.formattedAddress === 'Pearl Suria, KL');
    t('partialMatch 默认 false', r.result.partialMatch === false);
  }
}

// ── partial_match 透传 ───────────────────────────────────────────────
{
  const r = await geocodeForward('somewhere vague', KEY, fake({
    status: 'OK',
    results: [{ geometry: { location: { lat: PEARL_POINT_LAT + 0.03, lng: PEARL_POINT_LNG } }, formatted_address: 'X', partial_match: true }],
  }));
  t('partial_match → partialMatch:true', r.ok && r.result.partialMatch === true);
  t('约 3.3km → outside2km', r.ok && r.result.zone === 'outside2km' && r.result.distanceKm > 3 && r.result.distanceKm < 4);
}

// ── 超出 25km → 422 + beyondRange ────────────────────────────────────
{
  const r = await geocodeForward('Ipoh', KEY, fake({
    status: 'OK',
    results: [{ geometry: { location: { lat: 4.6, lng: 101.07 } }, formatted_address: 'Ipoh' }],
  }));
  t('超范围 → ok:false 422', !r.ok && r.status === 422);
  t('超范围 → beyondRange:true 且带距离', !r.ok && r.beyondRange === true && (r.distanceKm ?? 0) > MAX_DELIVERY_KM);
  t('超范围文案含上限公里数', !r.ok && r.error.includes(`${MAX_DELIVERY_KM}km`));
}

// ── ZERO_RESULTS → 404 ───────────────────────────────────────────────
{
  const r = await geocodeForward('asdfghjkl', KEY, fake({ status: 'ZERO_RESULTS', results: [] }));
  t('ZERO_RESULTS → 404', !r.ok && r.status === 404);
}

// ── REQUEST_DENIED → 502 + googleStatus 透出 ─────────────────────────
{
  const r = await geocodeForward('Pearl Suria', KEY, fake({ status: 'REQUEST_DENIED', error_message: 'API key invalid' }));
  t('REQUEST_DENIED → 502', !r.ok && r.status === 502);
  t('googleStatus / googleMessage 透出', !r.ok && r.googleStatus === 'REQUEST_DENIED' && r.googleMessage === 'API key invalid');
  t('文案带 Google 原话', !r.ok && r.error.includes('API key invalid'));
}

// ── OK 但 results 为空 → 502 ─────────────────────────────────────────
{
  const r = await geocodeForward('x', KEY, fake({ status: 'OK', results: [] }));
  t('OK+空结果 → 502', !r.ok && r.status === 502);
}

// ── 网络异常 → 503 ───────────────────────────────────────────────────
{
  const boom = (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
  const r = await geocodeForward('Pearl Suria', KEY, boom);
  t('fetch 抛错 → 503', !r.ok && r.status === 503);
}

// ── 请求参数：地址 / 马来西亚偏置 / key 都在 URL 里 ─────────────────
{
  let url = '';
  const spy = (async (u: string) => { url = u; return { json: async () => ({ status: 'ZERO_RESULTS' }) }; }) as unknown as typeof fetch;
  await geocodeForward('Jalan Klang Lama', KEY, spy);
  const p = new URL(url).searchParams;
  t('URL 带 address', p.get('address') === 'Jalan Klang Lama');
  t('URL 带 country:MY 偏置', p.get('components') === 'country:MY' && p.get('region') === 'my');
  t('URL 带 Pearl Point bounds', (p.get('bounds') || '').startsWith('3.04,101.62'));
  t('URL 带 key', p.get('key') === KEY);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail === 0 ? 0 : 1);
