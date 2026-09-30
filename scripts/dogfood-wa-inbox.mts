/**
 * dogfood-wa-inbox.mts —— 收件箱列表行的纯函数验证（不碰 Firestore、不发网络）。
 *
 * 为什么要单测：这一行决定老板看不看得到一个客户。排序键算错 = 对话沉底没人回；
 * 未读算错 = 角标和提示音都不响。
 *
 * 跑法：npx tsx scripts/dogfood-wa-inbox.mts
 */
import { leadRow, inboxRows } from '@/lib/waInbox';

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail: unknown = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label} —— ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); }
}

const NOW = Date.parse('2026-09-30T15:00:00Z');
const M = 60 * 1000, H = 60 * M;
const t = (role: string, text: string, ago: number, extra: Record<string, unknown> = {}) => ({ role, text, ts: NOW - ago, ...extra });

console.log('\n=== 1. 最后活动时间（排序键）===');
{
  // 真实形态：客户发了图片，lastMsgMs 还停在两天前（只有 n8n 文字路线的 touch 会更新它）
  const img = leadRow('60111', { lastMsgMs: NOW - 48 * H, turns: [t('in', '旧消息', 48 * H), t('in', '[图片]', 5 * M)] }, NOW);
  check('客户发图片：按图片那条的时间排，不是两天前', img.activityMs === NOW - 5 * M, img.activityMs - NOW);
  check('lastMsgMs 同步给出（旧版 dashboard 读这个名字）', img.lastMsgMs === img.activityMs);

  const noField = leadRow('60112', { turns: [t('in', '[语音]', 8 * H)] }, NOW);
  check('文档完全没有 lastMsgMs → 仍然有活动时间（旧查询会直接漏掉它）', noField.activityMs === NOW - 8 * H, noField.activityMs);

  const sysLast = leadRow('60113', { lastMsgMs: NOW - 3 * H, turns: [t('in', '要订两份', 3 * H), t('sys', '老板在 dashboard 接管 120 分钟，bot 静音', 1 * M)] }, NOW);
  check('系统行不算活动：点一下「接管」不该把对话顶到最前', sysLast.activityMs === NOW - 3 * H, sysLast.activityMs - NOW);
  check('预览跳过系统行，显示客户那句', sysLast.lastMsg?.text === '要订两份', sysLast.lastMsg);

  const onlySys = leadRow('60114', { turns: [t('sys', '老板标记成交，停止追单', 1 * M)] }, NOW);
  check('只有系统行：预览退回系统行，但不算有活动', onlySys.lastMsg?.role === 'sys' && onlySys.activityMs === 0, onlySys);

  const newer = leadRow('60115', { lastMsgMs: NOW - 2 * M, turns: [t('in', 'hi', 10 * M)] }, NOW);
  check('lastMsgMs 比 turns 新（老板刚发过）→ 取较新的', newer.activityMs === NOW - 2 * M);
}

console.log('\n=== 2. 未读 / 最后一条客户消息 ===');
{
  const r = leadRow('60121', { bossReadAtMs: NOW - 20 * M, turns: [t('in', 'a', 30 * M), t('out', 'b', 29 * M), t('in', 'c', 4 * M), t('in', 'd', 3 * M), t('out', 'e', 2 * M)] }, NOW);
  check('未读 = bossReadAtMs 之后的客户消息条数', r.unread === 2, r.unread);
  check('lastInMs = 最后一条客户消息（不是最后一条消息）', r.lastInMs === NOW - 3 * M, r.lastInMs - NOW);
  const none = leadRow('60122', { turns: [t('out', '群发菜单', 5 * M)] }, NOW);
  check('从没来过消息 → lastInMs 0、未读 0', none.lastInMs === 0 && none.unread === 0);
  check('客户 24h 内来过消息 → 窗口开着', r.windowRemainingMs > 23 * H && r.windowRemainingMs <= 24 * H, r.windowRemainingMs);
}

console.log('\n=== 3. 其它字段 / 容错 ===');
{
  const r = leadRow('60131', { name: '', profile: { nickname: '阿 May', tags: ['常客'] }, status: '', humanUntil: NOW + 5 * M, clickedAtMs: 1, nudgeOff: true, turns: [t('in', 'x'.repeat(300), 1 * M)] }, NOW);
  check('名字退回备注里的称呼', r.name === '阿 May');
  check('status 空 → engaged', r.status === 'engaged');
  check('人工接管中 / 点过链接 / 追单已停', r.human && r.clicked && r.nudgeOff);
  check('预览截到 120 字', r.lastMsg?.text.length === 120);
  const bad = leadRow('60132', { turns: [null, 'oops', { role: 'in', text: 'ok', ts: NOW - M }] } as any, NOW);
  check('turns 里混了脏数据不抛错', bad.unread === 1 && bad.lastMsg?.text === 'ok', bad);
  check('turns 不是数组不抛错', leadRow('60133', { turns: 'boom' } as any, NOW).activityMs === 0);
}

console.log('\n=== 4. 整份列表 ===');
{
  const docs = [
    { id: 'old', data: { lastMsgMs: NOW - 5 * H, turns: [t('in', 'old', 5 * H)] } },
    { id: 'img', data: { lastMsgMs: NOW - 48 * H, turns: [t('in', '[图片]', 5 * M)] } },
    { id: 'boss-own-number', data: { lastInboundAtMs: NOW - M, seenMsgIds: ['x'] } },   // 老板自己号码：只有去重记录，没有对话
    { id: 'mid', data: { turns: [t('in', 'mid', 1 * H)] } },
  ];
  const rows = inboxRows(docs, NOW);
  check('按最后活动倒序：img → mid → old', rows.map(r => r.phone).join(',') === 'img,mid,old', rows.map(r => r.phone).join(','));
  check('没有任何对话的文档不出现', !rows.some(r => r.phone === 'boss-own-number'));
  check('limit 生效', inboxRows(docs, NOW, 2).length === 2);
}

console.log(`\n${'─'.repeat(52)}`);
console.log(`通过 ${pass} · 失败 ${fail}`);
if (fail > 0) process.exit(1);
