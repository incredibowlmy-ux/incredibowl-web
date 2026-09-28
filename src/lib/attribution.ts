/**
 * 广告归因：把落地时的 utm_* / fbclid 存下来，下单时写进订单文档
 * ---------------------------------------------------------------
 * 2026-09-29 新增。在这之前订单上没有任何来源字段，所以只能算全店
 * 混合 MER —— 「哪条素材赚钱」永远答不出来，只能信 Meta 自己上报的
 * 数字（而那个数字因为餐券漏报已经失真）。
 *
 * 为什么不用 fbclid 就够：`_fbc` cookie 里只有点击时间 + fbclid，
 * **没有广告 id**，Meta 也不开放反查。所以光存 fbclid 只能回答
 * 「这单来自 FB/IG 广告点击」，回答不了「来自哪条素材」。要做到素材级，
 * 必须用我们自己控制的 URL 参数：在 Ads Manager 给每条广告的落地网址
 * 挂上 `utm_content={{ad.name}}`，Meta 会替换成真实素材名。
 *
 * 为什么走 cookie 不走 localStorage：cookie 会自动跟着请求头上来，
 * 服务端 route 直接读得到，不用改任何下单的前端代码，所有下单路径
 * （购物车、多日单、FPX 回跳）自动都带上。localStorage 得每个调用方
 * 手动塞进 body，漏一个就静默丢数据。
 *
 * 口径：**末次触点**（last-touch）。带着新的 utm 再进站会覆盖旧值；
 * 没带参数的自然访问不覆盖，所以点过广告的人隔几天直接打开网站下单，
 * 依然归给那条广告 —— 与 Meta 自己的点击归因窗口逻辑一致。
 */

/** Cookie 名。客户端脚本与服务端解析必须用同一个。 */
export const ATTRIBUTION_COOKIE = 'ib_attr';

/** 90 天 —— 对齐 Meta `_fbc` 的存活期。 */
export const ATTRIBUTION_TTL_DAYS = 90;

export interface Attribution {
  /** utm_source, 例 'fb' */
  src?: string;
  /** utm_medium, 例 'paid' */
  med?: string;
  /** utm_campaign —— Ads Manager 的 {{campaign.name}} */
  cmp?: string;
  /** utm_content —— Ads Manager 的 {{ad.name}}，这是素材级归因的关键 */
  cnt?: string;
  /** utm_term —— Ads Manager 的 {{adset.name}} */
  trm?: string;
  /** Meta 点击 id 原文（`_fbc` 是 pixel 自己加工过的版本） */
  fbclid?: string;
  /** Google 点击 id，留着以后投 Google 用 */
  gclid?: string;
  /** 落地时刻 ISO 字符串 */
  landedAt?: string;
  /** 落地页 path（不含 query，避免把参数重复存一遍） */
  landingPath?: string;
}

/** 允许写进订单的字段白名单 + 每个字段的长度上限（挡脏 URL / 注入）。 */
const FIELD_LIMITS: Record<keyof Attribution, number> = {
  src: 64, med: 64, cmp: 200, cnt: 200, trm: 200,
  fbclid: 512, gclid: 512, landedAt: 32, landingPath: 200,
};

/**
 * 从请求的 Cookie 头里解出归因。永不抛错 —— 归因是加分项，
 * 解析失败不能挡下单。拿不到就返回 null，订单照常写，只是没有来源。
 */
export function parseAttributionCookie(req: Request): Attribution | null {
  try {
    const header = req.headers.get('cookie');
    if (!header) return null;
    let raw: string | undefined;
    for (const part of header.split(/;\s*/)) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      if (part.slice(0, eq).trim() !== ATTRIBUTION_COOKIE) continue;
      raw = part.slice(eq + 1).trim();
      break;
    }
    if (!raw) return null;

    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const out: Attribution = {};
    for (const [k, limit] of Object.entries(FIELD_LIMITS) as Array<[keyof Attribution, number]>) {
      const v = (parsed as Record<string, unknown>)[k];
      if (typeof v !== 'string') continue;
      const trimmed = v.trim();
      if (!trimmed) continue;
      out[k] = trimmed.slice(0, limit);
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

/**
 * 落地页上跑的捕获脚本（内联进 layout.tsx 的 <Script>）。
 * 写成字符串是为了跟 pixel / clarity / ga4 那几段保持一致的做法，
 * 也免得为这 20 行单独加一个 client component。
 *
 * 只在 URL 真的带参数时才写 cookie —— 自然访问不覆盖已有的末次触点。
 */
export const ATTRIBUTION_CAPTURE_SCRIPT = `
(function(){
  try {
    var q = new URLSearchParams(window.location.search);
    var map = {
      src: 'utm_source', med: 'utm_medium', cmp: 'utm_campaign',
      cnt: 'utm_content', trm: 'utm_term', fbclid: 'fbclid', gclid: 'gclid'
    };
    var out = {}, found = false;
    for (var k in map) {
      var v = q.get(map[k]);
      if (v) { out[k] = String(v).slice(0, 512); found = true; }
    }
    if (!found) return;               // 自然访问：保留上一次的归因
    out.landedAt = new Date().toISOString();
    out.landingPath = window.location.pathname.slice(0, 200);
    var val = encodeURIComponent(JSON.stringify(out));
    var exp = new Date(Date.now() + ${ATTRIBUTION_TTL_DAYS} * 864e5).toUTCString();
    document.cookie = '${ATTRIBUTION_COOKIE}=' + val + ';expires=' + exp + ';path=/;SameSite=Lax';
  } catch (e) { /* 追踪是加分项，绝不影响页面 */ }
})();
`;
