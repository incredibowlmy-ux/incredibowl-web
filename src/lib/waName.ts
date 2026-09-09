/**
 * WhatsApp 模板里的称呼：users.displayName / waLeads.name 是客户自己填的，常见 "ebby cheong"、
 * "TAN AH KOW"。发出去的信开头是 "Hi ebby cheong" 很掉价，这里统一成每个词首字母大写；
 * 中文/其他非拉丁字符原样。不取「名」不取「姓」——马来西亚华人名第一段常是姓，猜不准。
 */
export function properName(raw: unknown, fallback = 'there'): string {
    const s = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!s) return fallback;
    return s.split(' ').map(w => w.split('-').map(p => (/^[a-z]/i.test(p) ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p)).join('-')).join(' ');
}
