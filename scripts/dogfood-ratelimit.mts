/** Dogfood: checkBurst 内存桶（Firestore 那层 fail-open，靠线上日志观察）。 */
import { checkBurst } from '../src/lib/rateLimit.ts';

let pass = 0, fail = 0;
const t = (label: string, cond: boolean) => { cond ? pass++ : fail++; console.log(`  ${cond ? '✓' : '✗'} ${label}`); };

const OPT = { max: 3, windowMs: 200 };

// 前 3 次放行，第 4 次拒
t('第1次放行', checkBurst('k1', OPT).ok);
t('第2次放行', checkBurst('k1', OPT).ok);
t('第3次放行', checkBurst('k1', OPT).ok);
const blocked = checkBurst('k1', OPT);
t('第4次拒绝', !blocked.ok);
t('拒绝时给出 Retry-After ≥1s', blocked.retryAfterSec >= 1);

// 不同 key 互不影响（uid A 打满不能影响 uid B）
t('另一个 key 不受影响', checkBurst('k2', OPT).ok);

// 窗口过后重置
await new Promise(r => setTimeout(r, 250));
t('窗口过后恢复放行', checkBurst('k1', OPT).ok);

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail === 0 ? 0 : 1);
