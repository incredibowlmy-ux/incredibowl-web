/**
 * /driver 的 WhatsApp 顾客按钮 —— 点开就带好「约 10 分钟送到」的中英双语消息，
 * 司机出发后一键发送。纯函数、零依赖（会进客户端 bundle），dogfood 直接 import 测。
 */

/** 称呼按顾客名字来；没名字就只写 Hi，别出现「Hi 匿名」。 */
export function etaMessage(name: string): string {
    const hi = name.trim() ? `Hi ${name.trim()}` : 'Hi';
    // 署名 Wei Ting —— 老板 09-30 要求消息里带上她自己的名字
    return `${hi}！我是 Incredibowl 的 Wei Ting 🛵 您的餐点大约还有 10 分钟就送到了，请留意电话哦～\n\n`
        + `${hi}! Wei Ting from Incredibowl here 🛵 Your meal will arrive in about 10 minutes. Please keep your phone nearby. Thank you!`;
}

/**
 * 号码规则沿用原来的写法：去掉非数字，0 开头换成马来西亚区号 60。
 * （phoneUtils.normalizePhone 是去重用的，会把国家码剥掉，不适合拼 wa.me。）
 */
export function etaWhatsAppLink(phone: string, name: string): string {
    const digits = phone.replace(/[^0-9]/g, '').replace(/^0/, '60');
    return `https://wa.me/${digits}?text=${encodeURIComponent(etaMessage(name))}`;
}
