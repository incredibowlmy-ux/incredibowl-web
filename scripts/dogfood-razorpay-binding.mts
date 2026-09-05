/**
 * Dogfood: Razorpay 订单绑定判定（lib/razorpayBinding）。
 *
 * 守的是 2026-09-05 修的那个洞：双标签页结账时 create-order 覆盖 razorpayOrderId，
 * 顾客付掉前一笔就再也确认不了 = 收了钱订单没了。改成数组累加后，这里必须同时
 * 证明两件事：① 老单（只有单值字段）照常认；② 跨订单重放依然拒。
 */
import { isBoundTo, allBoundTo, isHeldBy, allHeldBy } from '../src/lib/razorpayBinding.ts';

let pass = 0, fail = 0;
const t = (label: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`  ${cond ? '✓' : '✗'} ${label}`); };

const R1 = 'order_R1aaaaaaaaaaaa';
const R2 = 'order_R2bbbbbbbbbbbb';
const R3 = 'order_R3cccccccccccc';

// ── 老单：只有单值字段（本次改动前建的在途单，不能被误杀）────────────
const legacy = { razorpayOrderId: R1 };
t('老单 单值字段匹配 → 认', isBoundTo(legacy, R1));
t('老单 单值字段不匹配 → 拒', !isBoundTo(legacy, R2));

// ── 新单：双标签页各结一次账，两个绑定都在数组里 ──────────────────
const dualTab = { razorpayOrderId: R2, razorpayOrderIds: [R1, R2] };
t('新单 付掉第一个标签页的 R1 → 认（这就是修的洞）', isBoundTo(dualTab, R1));
t('新单 付掉第二个标签页的 R2 → 认', isBoundTo(dualTab, R2));
t('新单 拿第三方的 R3 → 拒（跨订单重放依然挡住）', !isBoundTo(dualTab, R3));

// ── 数组为空 / 缺字段：不能因为「两边都没有」就判成匹配 ────────────
t('订单无任何绑定 + 空 rzpOrderId → 拒', !isBoundTo({}, ''));
t('订单无任何绑定 + 有 rzpOrderId → 拒', !isBoundTo({}, R1));
t('订单有绑定 + rzpOrderId 为空串 → 拒', !isBoundTo(dualTab, ''));
t('订单有绑定 + rzpOrderId 为 undefined → 拒', !isBoundTo(dualTab, undefined));
t('订单有绑定 + rzpOrderId 为 null → 拒', !isBoundTo(dualTab, null));
t('两边都是 undefined → 拒（绝不能算匹配）', !isBoundTo({ razorpayOrderId: undefined }, undefined));
t('null 订单 → 拒', !isBoundTo(null, R1));
t('razorpayOrderIds 为 null 时退回单值字段', isBoundTo({ razorpayOrderId: R1, razorpayOrderIds: null }, R1));

// ── allBoundTo：多日拆单必须**全部**绑到同一笔付款 ────────────────
t('多单全绑同一笔 → 认', allBoundTo([{ razorpayOrderIds: [R1] }, { razorpayOrderId: R1 }], R1));
t('多单里有一单没绑上 → 拒', !allBoundTo([{ razorpayOrderIds: [R1] }, { razorpayOrderId: R2 }], R1));
t('空数组 → 拒（没有订单不等于全部通过）', !allBoundTo([], R1));
t('数组含 null 成员 → 拒', !allBoundTo([{ razorpayOrderIds: [R1] }, null], R1));

// ── 持有凭证：无 session 取消 pending 单的放行条件 ────────────────────
// 守的是「知道 orderId 就能烧掉别人的库存和餐券」那个洞。
const TK1 = 'trk_aaaaaaaaaaaa';
const TK2 = 'trk_bbbbbbbbbbbb';
const orderA = { trackToken: TK1, razorpayOrderId: R1, razorpayOrderIds: [R1] };
const orderB = { trackToken: TK2, razorpayOrderId: R1, razorpayOrderIds: [R1] };

t('拿自己的 trackToken → 认', isHeldBy(orderA, [TK1]));
t('拿别人的 trackToken → 拒', !isHeldBy(orderA, [TK2]));
t('拿绑定的 razorpayOrderId → 认（成功回跳带 URL 参数那条路）', isHeldBy(orderA, [R1]));
t('拿没绑定的 razorpayOrderId → 拒', !isHeldBy(orderA, [R2]));
t('空凭证数组 → 拒（这就是修的洞：光有 orderId 不算数）', !isHeldBy(orderA, []));
t('凭证全是空串/undefined → 拒', !isHeldBy(orderA, ['', undefined, null]));
t('订单没有 trackToken 且凭证也是 undefined → 拒', !isHeldBy({ trackToken: undefined }, [undefined]));
t('凭证不是数组 → 拒', !isHeldBy(orderA, 'not-an-array' as unknown as unknown[]));

t('多日拆单：两张各自的 token 都带上 → 认', allHeldBy([orderA, orderB], [TK1, TK2]));
t('多日拆单：只带一张的 token → 拒（不能顺手取消另一张）', !allHeldBy([orderA, orderB], [TK1]));
t('多日拆单：共同的 razorpayOrderId → 认', allHeldBy([orderA, orderB], [R1]));
t('空订单列表 → 拒', !allHeldBy([], [TK1]));

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail === 0 ? 0 : 1);
