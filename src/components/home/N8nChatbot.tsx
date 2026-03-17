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
                    'Hi there!👋我是 Incredibowl 的碗妈BowlMama 🥣',
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
                    '--chat--color--primary': '#FF5722',
                    '--chat--color--primary-shade-50': '#E64A19',
                    '--chat--border-radius': '20px',
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
