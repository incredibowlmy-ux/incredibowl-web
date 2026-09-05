/**
 * paymentCopy.ts —— 付款方式文案的单一来源。
 *
 * 之前这份清单只活在 n8n 提示词里（v1 有、v3 漏了），网站结账页各写各的。
 * 现在 /api/n8n/menu 直接吐这两个字段，chatbot 提示词只做转述。
 * 改付款方式只改这里。
 */
export const PAYMENT_METHODS: readonly string[] = [
  'DuitNow QR',
  'Touch \'n Go eWallet',
  'Boost',
  'GrabPay',
  'FPX 网上银行',
  'Visa / Mastercard',
  '银行转账',
];

export const PAYMENT_METHODS_EN: readonly string[] = [
  'DuitNow QR',
  'Touch \'n Go eWallet',
  'Boost',
  'GrabPay',
  'FPX online banking',
  'Visa / Mastercard',
  'Bank transfer',
];

/** 明确不接受的方式（bot 被问到要斩钉截铁）。 */
export const PAYMENT_NOT_ACCEPTED_ZH = '不接受货到付款（COD）。';
export const PAYMENT_NOT_ACCEPTED_EN = 'No cash on delivery (COD).';

export const PAYMENT_TEXT_ZH =
  `可用付款方式：${PAYMENT_METHODS.join('、')}。${PAYMENT_NOT_ACCEPTED_ZH}` +
  '网站下单链接付款走 FPX / 卡；WhatsApp 内下单走 DuitNow QR 扫码（也可用 TnG / Boost / GrabPay 扫同一个码），付完把转账截图发到这里核对。';

export const PAYMENT_TEXT_EN =
  `Payment methods: ${PAYMENT_METHODS_EN.join(', ')}. ${PAYMENT_NOT_ACCEPTED_EN} ` +
  'The order link pays by FPX / card; ordering inside WhatsApp uses a DuitNow QR (TnG / Boost / GrabPay can scan the same QR) — send the transfer screenshot here after paying.';
