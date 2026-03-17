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
                    // 🎨 品牌主色 (Incredibowl 活力暖橙)
                    '--chat--color-primary': '#FF7A00',
                    '--chat--color-primary-shade-50': '#E66E00',

                    // 🔤 字体 (与网站主字体保持一致)
                    '--chat--font-family': "'Plus Jakarta Sans', 'Noto Sans SC', sans-serif",

                    // 📐 窗口圆角 & 阴影 (柔和亲切 + 高级悬浮感)
                    '--chat--window--border-radius': '16px',
                    '--chat--window--box-shadow': '0 12px 48px rgba(0,0,0,0.15)',

                    // 💬 消息气泡圆角
                    '--chat--message--border-radius': '12px',

                    // 🤖 Bot 气泡 (暖灰底色，温暖不刺眼)
                    '--chat--message--bot--background': '#FFF5EB',
                    '--chat--message--bot--color': '#3D3126',

                    // 👤 用户气泡 (品牌橙，白字醒目)
                    '--chat--message--user--background': '#FF7A00',
                    '--chat--message--user--color': '#FFFFFF',

                    // 🔘 触发按钮 (品牌色统一)
                    '--chat--toggle--background': '#FF7A00',
                    '--chat--toggle--hover--background': '#E66E00',
                    '--chat--toggle--active--background': '#CC6200',

                    // ⌨️ 输入区域
                    '--chat--input--border': '1px solid #E8E0D8',
                    '--chat--input--border-radius': '12px',
                    '--chat--input--background': '#FFFCF9',

                    // 📤 发送按钮
                    '--chat--button--background': '#FF7A00',
                    '--chat--button--hover--background': '#E66E00',

                    // 🏷️ 头部区域
                    '--chat--header--background': '#FF7A00',
                    '--chat--header--color': '#FFFFFF',
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
