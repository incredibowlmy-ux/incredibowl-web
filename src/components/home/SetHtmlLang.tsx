"use client";

import { useEffect } from 'react';

// EN server 页专用：App Router 嵌套 layout 改不了根 <html lang>（root 定死
// zh-MY），这里把 en/page.tsx 的 client 端翻牌技巧封装成组件——挂载即把
// documentElement.lang 换成 en-MY。卸载不回滚（跨页跳转由目标页自己负责）。
export default function SetHtmlLang({ lang = 'en-MY' }: { lang?: string }) {
    useEffect(() => {
        document.documentElement.lang = lang;
    }, [lang]);
    return null;
}
