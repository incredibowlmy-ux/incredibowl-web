"use client";

import { useEffect } from 'react';

export default function N8nChatbot() {
    useEffect(() => {
        // 避免重复挂载
        if (document.getElementById('n8n-chat-style')) return;

        // ============================
        // 1) 注入品牌 CSS 变量覆盖
        //    直接覆盖 :root 的 n8n chat 默认变量
        //    这比 createChat({ style }) 更可靠
        // ============================
        const brandCSS = document.createElement('style');
        brandCSS.id = 'n8n-chat-brand-override';
        brandCSS.textContent = `
            :root {
                /* 🎨 品牌主色 — 触发按钮 & 强调色 */
                --chat--color--primary: #FF7A00 !important;
                --chat--color--primary-shade-50: #E66E00 !important;
                --chat--color--primary--shade-100: #CC6200 !important;

                /* 🎨 次要色 — 用户气泡 & 发送按钮 */
                --chat--color--secondary: #FF7A00 !important;
                --chat--color-secondary-shade-50: #E66E00 !important;

                /* 🔤 字体 */
                --chat--font-family: 'Plus Jakarta Sans', 'Noto Sans SC', sans-serif !important;

                /* 📐 通用圆角 */
                --chat--border-radius: 12px !important;

                /* 🪟 窗口样式 */
                --chat--window--border-radius: 16px !important;

                /* 💬 消息气泡圆角 */
                --chat--message--border-radius: 12px !important;

                /* 🤖 Bot 气泡 (暖奶白底色) */
                --chat--message--bot--background: #FFF5EB !important;
                --chat--message--bot--color: #3D3126 !important;
                --chat--message--bot--border: none !important;

                /* 👤 用户气泡 (品牌橙底 + 白字) */
                --chat--message--user--background: #FF7A00 !important;
                --chat--message--user--color: #FFFFFF !important;
                --chat--message--user--border: none !important;

                /* 🏷️ 头部区域 (深色底 + 白字) */
                --chat--header--background: #1F1A15 !important;
                --chat--header--color: #FFFFFF !important;

                /* 🔘 触发按钮 (品牌色) */
                --chat--toggle--background: #FF7A00 !important;
                --chat--toggle--hover--background: #E66E00 !important;
                --chat--toggle--active--background: #CC6200 !important;
                --chat--toggle--color: #FFFFFF !important;

                /* ⌨️ 输入区域 */
                --chat--input--background: #FFFCF9 !important;
                --chat--input--text-color: #3D3126 !important;

                /* 📤 发送按钮 */
                --chat--input--send--button--color: #FF7A00 !important;
                --chat--input--send--button--background-hover: #FFF0E0 !important;
                --chat--input--send--button--color-hover: #E66E00 !important;

                /* 🎯 欢迎屏按钮 */
                --chat--button--background--primary: #FF7A00 !important;
                --chat--button--background--primary--hover: #E66E00 !important;
                --chat--button--color--primary: #FFFFFF !important;
                --chat--button--color--primary--hover: #FFFFFF !important;

                /* 🌤️ 聊天区域背景 */
                --chat--body--background: #FFF8F0 !important;
                --chat--footer--background: #FFF8F0 !important;
                --chat--color-light: #FFF8F0 !important;
            }
        `;
        document.head.appendChild(brandCSS);

        // ============================
        // 2) 加载 n8n Chat CSS（在品牌覆盖之后）
        // ============================
        const link = document.createElement('link');
        link.id = 'n8n-chat-style';
        link.href = 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        // ============================
        // 3) 加载并执行 JS Module
        // ============================
        const script = document.createElement('script');
        script.id = 'n8n-chat-script';
        script.type = 'module';
        script.innerHTML = `
            import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/chat.bundle.es.js';

            createChat({
                webhookUrl: 'https://n8n-e8dc.srv1458700.hstgr.cloud/webhook/f796e1e8-86db-46c3-b90f-8d2e60bf194e/chat',
                showWelcomeScreen: true,
                initialMessages: [
                    'Hi！ 我是你的专属私厨 碗妈 BowlMama👋',
                    '很高兴在 Incredibowl 遇见你!',
                    '请问有什么可以帮到您？'
                ],
                i18n: {
                    en: {
                        title: 'Incredibowl AI',
                        subtitle: 'Bowl妈在线 · 暖心私厨',
                        placeholder: '请输入您的问题...',
                        sendButtonText: '发送'
                    }
                }
            });
        `;
        document.body.appendChild(script);

        return () => {
            // 聊天插件全局驻留，无需销毁
        };
    }, []);

    return null;
}
