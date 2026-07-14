// 全站共享的语言类型。历史原因 member/dict.ts 自带一份同名类型（不动它，
// 避免翻旧文件）；所有新增 dict 一律从这里导入。
export type Locale = 'zh' | 'en';
