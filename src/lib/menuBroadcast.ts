/**
 * 每周 WhatsApp broadcast 文案生成（老板 2026-08-13 定稿模板，结构/emoji/语气照抄，
 * 只换菜单内容和日期）。纯函数：排期 + 菜目录进，文本出。
 *
 * 数据单一来源：菜名/价格/descEn = weeklyMenu 目录（含运行时价格覆盖）；
 * 加料价 = addOnsConfig.ADD_ON_PRICES；运费 = deliveryCopy 分档表。
 * 改模板结构请改这里，别在 dashboard 里手写第二份。
 */
import type { MenuItem, MenuWeek } from '@/data/weeklyMenu';
import { ADD_ON_PRICES } from '@/data/addOnsConfig';
import { DELIVERY_TIER_COPY, DELIVERY_TIER_COPY_FAR } from '@/lib/deliveryCopy';
import { properName } from '@/lib/waName';

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD_EN = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function addDays(ymd: string, n: number): Date {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n));
}
const dMon = (dt: Date) => `${dt.getUTCDate()} ${MONTH_EN[dt.getUTCMonth()]}`;
const rm = (n: number) => (Number.isInteger(n) ? `RM${n}` : `RM${n.toFixed(2)}`);

/** 菜品 emoji：按名字关键词，猜不到用 🍱。 */
export function dishEmoji(d: Pick<MenuItem, 'name' | 'nameEn'>): string {
    const s = `${d.name} ${d.nameEn}`.toLowerCase();
    if (/三文鱼|salmon/.test(s)) return '🐟';
    if (/鳗鱼|eel|鱼|fish/.test(s)) return '🐟';
    if (/虾|prawn|shrimp/.test(s)) return '🍤';
    if (/和牛|beef|wagyu/.test(s)) return '🥩';
    if (/猪|花肉|排骨|pork|belly|rib/.test(s)) return '🥓';
    if (/鸡|chicken/.test(s)) return '🍗';
    if (/纳豆|natto/.test(s)) return '🍚';
    if (/咖喱|curry/.test(s)) return '🍛';
    return '🍱';
}

/**
 * weekly_menu_v2（v1 同款变量）的三个变量：{{1}} 名字、{{2}} 日期段、{{3}} 亮点一句。
 * 模板正文是 Meta 审过的死文案，这里只产变量；新菜判定与 buildBroadcast 同一条规则。
 * {{3}} 在 v2 里独立成行（"✨ {{3}}"），所以首字母大写、不带句号；不能带换行（Meta 禁），也别太长。
 */
export function broadcastTemplateParams(input: Pick<BroadcastInput, 'monday' | 'week' | 'prevWeek' | 'menu' | 'forceNewIds'> & { name: string }): [string, string, string] {
    const { monday, week, prevWeek, menu, forceNewIds = [] } = input;
    const byId = new Map(menu.map(d => [d.id, d]));
    const ids = new Set<number>([...(week.daily ?? []), ...[1, 2, 3, 4, 5].flatMap(wd => week.days[wd] ?? [])]);
    const prevIds = new Set<number>(prevWeek ? [...(prevWeek.daily ?? []), ...[1, 2, 3, 4, 5].flatMap(wd => prevWeek.days[wd] ?? [])] : []);
    const newNames = [...ids]
        .filter(id => forceNewIds.includes(id) || (prevWeek ? !prevIds.has(id) : false))
        .map(id => byId.get(id)?.nameEn?.trim())
        .filter((s): s is string => !!s);
    const range = `${dMon(addDays(monday, 0))} – ${dMon(addDays(monday, 4))}`;
    // 菜名本身可能含 &（Surf & Turf），连接词就用 and，免得读成三道菜
    const joiner = newNames.some(n => n.includes('&')) ? ' and ' : ' & ';
    let newLine: string;
    if (!newNames.length) newLine = 'All your favourites are back on the menu';
    else if (newNames.length <= 2) newLine = `New this week: ${newNames.join(joiner)}`;
    else newLine = `New this week: ${newNames.slice(0, 2).join(', ')}${joiner}${newNames.length - 2} more`;
    return [properName(input.name), range, newLine.replace(/\s+/g, ' ').slice(0, 120)];
}

export interface BroadcastInput {
    monday: string;
    week: MenuWeek;
    /** 生效前一周的排期（判「新菜」用）；null = 不标新菜。 */
    prevWeek: MenuWeek | null;
    /** buildMenu(week) 的结果（含运行时价格）。 */
    menu: MenuItem[];
    customerName?: string;
    /** 额外强制标为新菜的 id（例：dashboard 从销量判断从未卖过）。 */
    forceNewIds?: number[];
}

export function buildBroadcast(input: BroadcastInput): string {
    const { monday, week, prevWeek, menu, forceNewIds = [] } = input;
    const byId = new Map(menu.map(d => [d.id, d]));
    const name = input.customerName?.trim() || '{name}';

    const scheduledIds = new Set<number>([...(week.daily ?? []), ...[1, 2, 3, 4, 5].flatMap(wd => week.days[wd] ?? [])]);
    const prevIds = new Set<number>(prevWeek ? [...(prevWeek.daily ?? []), ...[1, 2, 3, 4, 5].flatMap(wd => prevWeek.days[wd] ?? [])] : []);
    const newIds = [...scheduledIds].filter(id => forceNewIds.includes(id) || (prevWeek ? !prevIds.has(id) : false));

    const daysOf = (id: number): number[] => [1, 2, 3, 4, 5].filter(wd => (week.days[wd] ?? []).includes(id));
    const line = (id: number, tag = '') => {
        const d = byId.get(id);
        if (!d) return null;
        return `${dishEmoji(d)} ${d.nameEn} ${d.name}${tag} — ${rm(d.price)}`;
    };

    const out: string[] = [];
    out.push(`Hi ${name} 😊 I'm wei ting from Incredibowl.`);
    out.push('');
    out.push("🌿 Freshly cooked every morning. No MSG. Less oil, less salt — wholesome meals we're proud to serve our own family.");
    out.push('🌐 Order anytime at Incredibowl.my');
    out.push('');
    out.push(`Here's next week's menu (${dMon(addDays(monday, 0))} – ${dMon(addDays(monday, 4))}):`);
    out.push('');

    if (newIds.length) {
        out.push('🆕 NEW THIS WEEK');
        for (const id of newIds) {
            const d = byId.get(id);
            if (!d) continue;
            out.push(`${dishEmoji(d)} ${d.nameEn} ${d.name} ⭐NEW — ${rm(d.price)}`);
            if (d.descEn) out.push(d.descEn);
            const wds = daysOf(id);
            out.push((week.daily ?? []).includes(id)
                ? 'Available every day!'
                : `${wds.map(wd => WD_EN[wd]).join(' & ')} only!`);
            out.push('');
        }
    }

    out.push('🍚 Daily Staples (Available Every Day)');
    for (const id of week.daily ?? []) { const l = line(id); if (l) out.push(l); }
    out.push('');

    out.push('✨ Daily Specials');
    for (const wd of [1, 2, 3, 4, 5]) {
        const ids = week.days[wd] ?? [];
        if (!ids.length) continue;
        out.push(`${WD_EN[wd]} (${dMon(addDays(monday, wd - 1))})`);
        for (const id of ids) { const l = line(id); if (l) out.push(l); }
        out.push('');
    }

    const p = (k: string) => ADD_ON_PRICES[k];
    out.push('🍳 Add-ons');
    out.push([
        `Sunny side up egg +${rm(p('sunny-egg'))}`,
        `Onsen egg +${rm(p('onsen-egg'))}`,
        `Potato fried egg +${rm(p('potato-egg'))}`,
        `Extra rice +${rm(p('extra-rice'))}`,
        `Swap to brown rice +${rm(p('brown-rice'))}`,
        `Garlic broccoli & egg (family size, 4 pax) from ${rm(p('broccoli-egg'))}`,
    ].join(' / '));
    out.push('');
    out.push('📸 See all dish photos at Incredibowl.my');
    out.push('');

    out.push('🛵 Delivery (from Pearl Suria, next to Pearl Point, Old Klang Road)');
    const near = DELIVERY_TIER_COPY.map(t => `${t.rangeEn} ${rm(t.fee)}${t.freeOver !== null ? ` (FREE >${rm(t.freeOver)})` : ''}`);
    const far = DELIVERY_TIER_COPY_FAR.map(t => `${t.rangeEn} ${rm(t.fee)}`).join(' · ');
    out.push(`${near.join(' / ')} / ${far} (via Grab, flat rate)`);
    out.push('');
    out.push('⏰ Order before 6:00 AM for same-day delivery.');
    out.push('🍱 We prepare only a limited number of meals each day, so pre-order early to avoid disappointment.');
    out.push('');
    out.push('💬 Order directly at Incredibowl.my, or simply reply to this WhatsApp with your preferred day and quantity.');
    out.push('');
    out.push('🙏 One small favour: even a quick reply (an emoji 👍😊 or a single letter) really helps keep our broadcasts reaching you. Thank you for your support! 💛');
    out.push('');
    out.push("If you'd rather not receive our weekly menu, just reply STOP anytime.");
    return out.join('\n');
}
