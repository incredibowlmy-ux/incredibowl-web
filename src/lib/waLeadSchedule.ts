/**
 * WhatsApp lead 追单排程 —— 纯函数，无 IO，可单测。
 *
 * 为什么单独抽一个文件：追单时点是**唯一**会直接骚扰到客户的逻辑，算错的代价
 * 是凌晨给人发广告。它必须能在不碰 Firestore、不碰 n8n 的前提下被反复验证。
 *
 * 老板 2026-08-16 定的规矩（2026-09-06 把第 1 次从 35 分钟改成 1 小时）：
 *   · 第 1 次：客户最后一条消息 + 60 分钟（无成交、无回应才追；点了链接没付款仍追）
 *   · 第 2 次：**当晚 21:00**（⛔ 明确否决了 05:15「截单前提醒」——太早、扰民）
 *   · 每个 lead 最多 2 次，客户一下单/明确拒绝立刻停
 *
 * 硬约束（不是偏好，是 Meta 的规则）：所有主动消息必须落在客户最后一条消息后的
 * **24 小时客服窗口**内，否则要用审核过的 template。本项目第一阶段不上 template，
 * 所以算出来超窗的那一次**直接放弃**——宁可少发，不为发一条去买 template。
 *
 * 时区：全程 MYT（UTC+8）。机器时钟是 UTC，所有「几点」判断都要过 mytClock/mytHour，
 * 绝不能直接用 Date#getHours（服务器在 UTC 上跑，会整整差 8 小时）。
 */

export const MYT_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Meta 客服窗口：客户最后一条消息起 24 小时内可自由发消息。 */
export const WINDOW_MS = 24 * 60 * 60 * 1000;
/** 第 1 次追单延迟（老板 2026-09-06 定：1 小时）。 */
export const NUDGE1_DELAY_MS = 60 * 60 * 1000;
/** 静默时段 [22:00, 09:00) —— 落在里面的第 1 次追单顺延到 09:00。 */
export const QUIET_FROM_H = 22;
export const QUIET_TO_H = 9;
/** 第 2 次追单的钟点（老板指定，只能这个点）。 */
export const NUDGE2_HOUR = 21;
/** 两次追单之间的最小间隔——傍晚才来的客户不该 35 分钟后又被戳一次。 */
export const MIN_GAP_MS = 3 * 60 * 60 * 1000;
/** 每个 lead 的追单上限。 */
export const MAX_NUDGES = 2;

/** ms → MYT 墙上时钟的小时（0-23）。 */
export function mytHour(ms: number): number {
  return new Date(ms + MYT_OFFSET_MS).getUTCHours();
}

/** ms → MYT 日期 YYYY-MM-DD。 */
export function mytYmd(ms: number): string {
  return new Date(ms + MYT_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 取「ms 所在 MYT 日期（可 ±dayDelta 天）的 hour:minute」对应的 epoch ms。
 * 用 UTC getter/setter 操作一个已经 +8h 偏移过的 Date，等价于在 MYT 墙上时钟上操作。
 */
export function mytClock(ms: number, hour: number, minute = 0, dayDelta = 0): number {
  const d = new Date(ms + MYT_OFFSET_MS);
  d.setUTCDate(d.getUTCDate() + dayDelta);
  d.setUTCHours(hour, minute, 0, 0);
  return d.getTime() - MYT_OFFSET_MS;
}

/** 落在静默时段的时刻顺推到最近的 09:00；其余原样返回。 */
export function shiftOutOfQuietHours(ms: number): number {
  const h = mytHour(ms);
  if (h >= QUIET_FROM_H) return mytClock(ms, QUIET_TO_H, 0, 1); // 22:00 之后 → 次日 09:00
  if (h < QUIET_TO_H) return mytClock(ms, QUIET_TO_H, 0, 0);     // 00:00–08:59 → 当天 09:00
  return ms;
}

export interface NudgePlanInput {
  /** 客户最后一条**入站**消息的时间（24h 窗口的锚点）。 */
  lastMsgMs: number;
  /** 已经发过几次追单。 */
  nudgeCount: number;
  /** 上一次追单发出的时间（没发过传 0/undefined）。 */
  lastNudgeMs?: number;
}

/**
 * 算下一次追单的时刻。返回 null = 不再追（追满 2 次 / 算出来超出 24h 窗口）。
 *
 * 注意 lastMsgMs 每次客户来消息都会刷新 → 窗口跟着后移、排程重算，
 * 所以「聊到一半的客户」不会被中途的旧排程戳到。
 */
export function computeNextNudge({ lastMsgMs, nudgeCount, lastNudgeMs = 0 }: NudgePlanInput): number | null {
  if (!Number.isFinite(lastMsgMs) || lastMsgMs <= 0) return null;
  if (nudgeCount >= MAX_NUDGES) return null;

  const windowEnd = lastMsgMs + WINDOW_MS;

  // ── 第 1 次：+60 分钟，避开静默时段 ──────────────────
  if (nudgeCount === 0) {
    const t = shiftOutOfQuietHours(lastMsgMs + NUDGE1_DELAY_MS);
    return t <= windowEnd ? t : null;
  }

  // ── 第 2 次：当晚 21:00 ──────────────────────────────
  let t = mytClock(lastMsgMs, NUDGE2_HOUR, 0, 0);
  // 客户本来就是 21:00 之后来的 → 今晚这班车已经开走，改明晚
  if (t <= lastMsgMs) t = mytClock(lastMsgMs, NUDGE2_HOUR, 0, 1);
  // 距第 1 次不足 3 小时（傍晚来的客户）→ 顺延到下一个 21:00
  if (lastNudgeMs > 0 && t < lastNudgeMs + MIN_GAP_MS) t = mytClock(t, NUDGE2_HOUR, 0, 1);
  return t <= windowEnd ? t : null;
}

/** 客户最后消息起是否仍在 24h 客服窗口内（决定能不能自由发消息）。 */
export function isWithinWindow(lastMsgMs: number, nowMs: number): boolean {
  return nowMs < lastMsgMs + WINDOW_MS;
}
