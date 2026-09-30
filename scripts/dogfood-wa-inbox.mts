/**
 * dogfood-wa-inbox.mts —— 收件箱列表行的纯函数验证（不碰 Firestore、不发网络）。
 *
 * 为什么要单测：这一行决定老板看不看得到一个客户。排序键算错 = 对话沉底没人回；
 * 未读算错 = 角标和提示音都不响。
 *
 * 跑法：npx tsx scripts/dogfood-wa-inbox.mts
 */
import { leadRow, inboxRows, needsReplyWhy, isSosKind, effectiveStatus } from '@/lib/waInbox';

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

console.log('\n=== 5. 待回复（等老板本人，不是等 bot）===');
{
  const why = (x: Record<string, any>) => needsReplyWhy(x, NOW);
  const img = { msgId: 'm', media: { kind: 'image', id: '123456' } };
  check('人工接管中 + 客户说了最后一句 → human', why({ humanUntil: NOW + H, turns: [t('boss', '午餐还是晚餐', 9 * M), t('in', '晚餐', 3 * M)] }) === 'human');
  check('人工接管中但老板说了最后一句 → 不算', why({ humanUntil: NOW + H, turns: [t('in', '晚餐', 9 * M), t('boss', '好的', 3 * M)] }) === '');
  check('接管后只多了一条系统行，最后一句仍是客户 → human', why({ humanUntil: NOW + H, turns: [t('in', '在吗', 5 * M), t('sys', '老板在 dashboard 接管 120 分钟，bot 静音', 1 * M)] }) === 'human');
  check('接管已过期 → 不再按 human 算', why({ humanUntil: NOW - M, turns: [t('in', '晚餐', 3 * M)] }) === '');
  check('bot 接待中、客户说了最后一句文字 → 不算（bot 的开场白等没记进 turns，会误报）', why({ turns: [t('in', 'hi', 3 * M)] }) === '');

  check('bot 求救（escalate）之后老板没说过话 → sos', why({ alertAtMs: NOW - 10 * M, alertKind: 'escalate', turns: [t('in', '可以换菜吗', 11 * M), t('out', '我帮你问一下碗妈', 10 * M)] }) === 'sos');
  check('AI 挂了（ai_down）→ sos', why({ alertAtMs: NOW - 10 * M, alertKind: 'ai_down', turns: [t('in', 'hi', 11 * M)] }) === 'sos');
  check('求救之后老板回过了 → 清掉', why({ alertAtMs: NOW - 10 * M, alertKind: 'escalate', turns: [t('in', '可以换菜吗', 11 * M), t('boss', '可以', 5 * M)] }) === '');
  check('求救超过 48 小时 → 不再置顶', why({ alertAtMs: NOW - 49 * H, alertKind: 'escalate', turns: [t('in', 'x', 49 * H)] }) === '');
  check('kind=human / image 的警报不算求救', why({ alertAtMs: NOW - M, alertKind: 'human', turns: [t('in', 'x', 2 * M), t('out', 'y', M)] }) === '' && why({ alertAtMs: NOW - M, alertKind: 'image', turns: [t('out', 'y', M)] }) === '');

  check('客户最后发的是图片、老板没回过 → media', why({ turns: [t('in', '我转账了', 6 * M), t('in', '[图片]', 5 * M, img)] }) === 'media');
  check('图片之后 bot 自动回了一句，老板仍没回 → 还是 media', why({ turns: [t('in', '[图片]', 5 * M, img), t('out', '收到图片，碗妈会看', 4 * M)] }) === 'media');
  check('图片之后老板回了 → 清掉', why({ turns: [t('in', '[图片]', 5 * M, img), t('boss', '收到', 4 * M)] }) === '');
  check('发完截图紧跟一句「已转账」→ 仍然 media（不能被后面那句文字冲掉）', why({ turns: [t('in', '[图片]', 5 * M, img), t('in', '已转账', 4 * M)] }) === 'media');
  check('老板回过之后客户只发了文字 → 不算（截图那件事老板已经接手）', why({ turns: [t('in', '[图片]', 9 * M, img), t('boss', '收到', 6 * M), t('in', '谢谢', 4 * M)] }) === '');
  check('老板回过之后客户又发了一张图 → 重新算', why({ turns: [t('in', '[图片]', 9 * M, img), t('boss', '收到', 6 * M), t('in', '[图片]', 4 * M, img)] }) === 'media');
  check('求救类 kind 才留记号：escalate / ai_down 是，pin / image / human 不是', isSosKind('escalate') && isSosKind('ai_down') && !isSosKind('pin') && !isSosKind('image') && !isSosKind('human') && !isSosKind(undefined));
  check('两天前的图片 → 不再算', why({ turns: [t('in', '[图片]', 49 * H, img)] }) === '');

  check('客户发图之后订单确认了（已成交）→ 了结，不算', why({ status: 'ordered', closedAtMs: NOW - 2 * M, turns: [t('in', '[图片]', 5 * M, img)] }) === '');
  check('已成交之后客户又发图 → 重新算', why({ status: 'ordered', closedAtMs: NOW - 10 * M, turns: [t('in', '[图片]', 5 * M, img)] }) === 'media');
  check('老板关闭之后 → 不算', why({ status: 'closed', closedAtMs: NOW - M, humanUntil: NOW + H, turns: [t('in', '不要了', 5 * M)] }) === '');

  const row = leadRow('60141', { alertAtMs: NOW - 10 * M, alertKind: 'escalate', turns: [t('in', 'x', 11 * M)] }, NOW);
  check('列表行带上 needsReply / needsWhy / sos', row.needsReply === true && row.needsWhy === 'sos' && row.sos === true, row);
  const plain = leadRow('60142', { turns: [t('in', 'hi', 3 * M), t('out', '你好', 2 * M)] }, NOW);
  check('普通对话 → 三个都是空', plain.needsReply === false && plain.needsWhy === '' && plain.sos === false);
}

console.log('\n=== 6. 已关闭之后客户又来消息 → 显示为进行中 ===');
{
  // 库里的 status 只有 n8n 文字路线会改回 engaged；图片 / 语音 / 人工接管期间的消息不会
  check('关闭后客户发来图片 → 进行中', effectiveStatus({ status: 'closed', closedAtMs: NOW - 10 * M, turns: [t('in', '不要了', 20 * M), t('in', '[图片]', 5 * M)] }) === 'engaged');
  check('关闭后没有新消息 → 仍是已关闭', effectiveStatus({ status: 'closed', closedAtMs: NOW - 10 * M, turns: [t('in', '不要了', 20 * M), t('out', '好的', 19 * M)] }) === 'closed');
  check('关闭后只有 bot / 老板的消息 → 仍是已关闭', effectiveStatus({ status: 'closed', closedAtMs: NOW - 10 * M, turns: [t('in', '不要了', 20 * M), t('boss', '下次再来', 5 * M)] }) === 'closed');
  check('旧数据没记关闭时间 → 不猜，保持已关闭', effectiveStatus({ status: 'closed', turns: [t('in', 'hi', 5 * M)] }) === 'closed');
  check('已成交不受影响（它有自己的 24h 保护期）', effectiveStatus({ status: 'ordered', closedAtMs: NOW - 10 * M, turns: [t('in', '谢谢', 5 * M)] }) === 'ordered');
  check('status 空 → engaged', effectiveStatus({}) === 'engaged');
  const row = leadRow('60151', { status: 'closed', closedAtMs: NOW - 10 * M, humanUntil: NOW + H, turns: [t('in', '还是要一份', 5 * M)] }, NOW);
  check('列表行：状态显示进行中，且算待回复（人工接管中）', row.status === 'engaged' && row.needsWhy === 'human', row);
}

console.log(`\n${'─'.repeat(52)}`);
console.log(`通过 ${pass} · 失败 ${fail}`);
if (fail > 0) process.exit(1);
