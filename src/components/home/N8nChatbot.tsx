"use client";

import { useEffect } from 'react';

export default function N8nChatbot() {
    useEffect(() => {
        // 避免重复挂载
        if (document.getElementById('n8n-chat-style')) return;

        // 加载 CSS
        const link = document.createElement('link');
        link.id = 'n8n-chat-style';
        link.href = 'https://cdn.jsdelivr.net/npm/@n8n/chat/dist/style.css';
        link.rel = 'stylesheet';
        document.head.appendChild(link);

        // 加载并执行 JS Module
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
                },
                style: {
                    // 🎨 品牌主色 — 触发按钮 & 强调色 (源码: --chat--color--primary)
                    '--chat--color--primary': '#FF7A00',
                    '--chat--color--primary-shade-50': '#E66E00',
                    '--chat--color--primary--shade-100': '#CC6200',

                    // 🎨 次要色 — 用户气泡 & 发送按钮 (源码: --chat--color--secondary)
                    '--chat--color--secondary': '#FF7A00',
                    '--chat--color-secondary-shade-50': '#E66E00',

                    // 🔤 字体 (与网站主字体保持一致)
                    '--chat--font-family': "'Plus Jakarta Sans', 'Noto Sans SC', sans-serif",

                    // 📐 通用圆角
                    '--chat--border-radius': '12px',

                    // 🪟 窗口样式
                    '--chat--window--border-radius': '16px',

                    // 💬 消息气泡圆角
                    '--chat--message--border-radius': '12px',

                    // 🤖 Bot 气泡 (暖奶白底色，温暖不刺眼)
                    '--chat--message--bot--background': '#FFF5EB',
                    '--chat--message--bot--color': '#3D3126',
                    '--chat--message--bot--border': 'none',

                    // 👤 用户气泡 (品牌橙底，白字)
                    '--chat--message--user--background': '#FF7A00',
                    '--chat--message--user--color': '#FFFFFF',
                    '--chat--message--user--border': 'none',

                    // 🏷️ 头部区域 (深色底 + 浅字)
                    '--chat--header--background': '#1F1A15',
                    '--chat--header--color': '#FFFFFF',

                    // 🔘 触发按钮 (品牌色)
                    '--chat--toggle--background': '#FF7A00',
                    '--chat--toggle--hover--background': '#E66E00',
                    '--chat--toggle--active--background': '#CC6200',
                    '--chat--toggle--color': '#FFFFFF',

                    // ⌨️ 输入区域
                    '--chat--input--background': '#FFFCF9',
                    '--chat--input--text-color': '#3D3126',

                    // 📤 发送按钮
                    '--chat--input--send--button--color': '#FF7A00',
                    '--chat--input--send--button--background-hover': '#FFF0E0',
                    '--chat--input--send--button--color-hover': '#E66E00',

                    // 🎯 欢迎屏按钮 (主要按钮)
                    '--chat--button--background--primary': '#FF7A00',
                    '--chat--button--background--primary--hover': '#E66E00',
                    '--chat--button--color--primary': '#FFFFFF',
                    '--chat--button--color--primary--hover': '#FFFFFF',

                    // 🌤️ 聊天区域背景
                    '--chat--body--background': '#FFF8F0',
                    '--chat--color-light': '#FFF8F0',
                }
            });
        `;
        document.body.appendChild(script);

        return () => {
            // 清理脚本和样式（如果需要完整卸载的话，但通常聊天插件全局驻留即可，无需销毁）
        };
    }, []);

    return null;
}
