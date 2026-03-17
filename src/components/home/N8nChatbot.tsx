"use client";

import { useEffect } from 'react';

export default function N8nChatbot() {
    useEffect(() => {
        // 避免重复挂载
        if (document.getElementById('n8n-chat-style')) return;

        // ============================
        // 1) 注入品牌 CSS 变量 + 高级视觉增强
        // ============================
        const brandCSS = document.createElement('style');
        brandCSS.id = 'n8n-chat-brand-override';
        brandCSS.textContent = `
            :root {
                /* ═══════════════════════════════════
                   🎨 品牌色系
                   ═══════════════════════════════════ */
                --chat--color--primary: #FF7A00 !important;
                --chat--color--primary-shade-50: #E66E00 !important;
                --chat--color--primary--shade-100: #CC6200 !important;
                --chat--color--secondary: #FF7A00 !important;
                --chat--color-secondary-shade-50: #E66E00 !important;

                /* ═══════════════════════════════════
                   🔤 字体 & 排版
                   ═══════════════════════════════════ */
                --chat--font-family: 'Plus Jakarta Sans', 'Noto Sans SC', sans-serif !important;
                --chat--heading--font-size: 1.5em !important;
                --chat--subtitle--font-size: 0.85em !important;
                --chat--subtitle--line-height: 1.6 !important;
                --chat--message--font-size: 0.925rem !important;
                --chat--message-line-height: 1.6 !important;

                /* ═══════════════════════════════════
                   📐 圆角 & 间距
                   ═══════════════════════════════════ */
                --chat--border-radius: 12px !important;
                --chat--spacing: 1rem !important;

                /* ═══════════════════════════════════
                   🪟 窗口尺寸 & 样式
                   ═══════════════════════════════════ */
                --chat--window--width: 380px !important;
                --chat--window--height: 580px !important;
                --chat--window--border-radius: 20px !important;
                --chat--window--border: none !important;

                /* ═══════════════════════════════════
                   🏷️ 头部 (渐变深色底)
                   ═══════════════════════════════════ */
                --chat--header--background: linear-gradient(135deg, #1F1A15 0%, #2C2419 50%, #1F1A15 100%) !important;
                --chat--header--color: #FFFFFF !important;
                --chat--header--padding: 1.25rem 1.5rem !important;
                --chat--header--border-bottom: 1px solid rgba(255, 122, 0, 0.15) !important;

                /* ═══════════════════════════════════
                   💬 消息气泡
                   ═══════════════════════════════════ */
                --chat--message--border-radius: 16px !important;
                --chat--message--padding: 0.75rem 1rem !important;
                --chat--message--margin-bottom: 0.35rem !important;

                --chat--message--bot--background: #FFFFFF !important;
                --chat--message--bot--color: #3D3126 !important;
                --chat--message--bot--border: 1px solid rgba(0,0,0,0.04) !important;

                --chat--message--user--background: #FF7A00 !important;
                --chat--message--user--color: #FFFFFF !important;
                --chat--message--user--border: none !important;

                /* ═══════════════════════════════════
                   🔘 浮动按钮 (橙色 + 呼吸光晕)
                   ═══════════════════════════════════ */
                --chat--toggle--background: #FF7A00 !important;
                --chat--toggle--hover--background: #E66E00 !important;
                --chat--toggle--active--background: #CC6200 !important;
                --chat--toggle--color: #FFFFFF !important;
                --chat--toggle--size: 60px !important;

                /* ═══════════════════════════════════
                   ⌨️ 输入区域
                   ═══════════════════════════════════ */
                --chat--input--background: #FFFFFF !important;
                --chat--input--text-color: #3D3126 !important;
                --chat--input--border: 1px solid rgba(255,122,0,0.2) !important;
                --chat--input--border-active: 1px solid rgba(255,122,0,0.5) !important;

                /* 📤 发送按钮 */
                --chat--input--send--button--color: #FF7A00 !important;
                --chat--input--send--button--background: transparent !important;
                --chat--input--send--button--background-hover: rgba(255,122,0,0.08) !important;
                --chat--input--send--button--color-hover: #E66E00 !important;

                /* ═══════════════════════════════════
                   🎯 欢迎屏按钮
                   ═══════════════════════════════════ */
                --chat--button--background--primary: #FF7A00 !important;
                --chat--button--background--primary--hover: #E66E00 !important;
                --chat--button--color--primary: #FFFFFF !important;
                --chat--button--color--primary--hover: #FFFFFF !important;
                --chat--button--border-radius: 12px !important;

                /* ═══════════════════════════════════
                   🌤️ 背景 & 底部
                   ═══════════════════════════════════ */
                --chat--body--background: #FFF8F0 !important;
                --chat--footer--background: #FFFAF5 !important;
                --chat--footer--border-top: 1px solid rgba(0,0,0,0.06) !important;
                --chat--color-light: #FFF8F0 !important;

                /* ═══════════════════════════════════
                   🔄 过渡动画
                   ═══════════════════════════════════ */
                --chat--transition-duration: 0.2s !important;
            }

            /* ══════════════════════════════════════════
               🎨 高级视觉增强 (非变量部分)
               ══════════════════════════════════════════ */

            /* 🌟 窗口阴影 — 悬浮卡片效果 */
            .chat-window-wrapper .chat-window {
                box-shadow:
                    0 8px 32px rgba(31, 26, 21, 0.18),
                    0 2px 8px rgba(31, 26, 21, 0.08) !important;
                border: 1px solid rgba(255, 122, 0, 0.08) !important;
            }

            /* 🏷️ 头部：底部橙色渐变线 + 标题微调 */
            .chat-layout .chat-header {
                position: relative;
                gap: 0.3em !important;
            }
            .chat-layout .chat-header::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, #FF7A00 0%, #FFB366 50%, #FF7A00 100%);
                opacity: 0.6;
            }
            .chat-layout .chat-header h1 {
                font-weight: 700 !important;
                letter-spacing: -0.01em !important;
            }
            .chat-layout .chat-header p {
                opacity: 0.75;
                font-weight: 400 !important;
            }

            /* 💬 Bot 气泡：柔和阴影 */
            .chat-message.chat-message-from-bot:not(.chat-message-transparent) {
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04) !important;
            }

            /* 👤 用户气泡：渐变背景 + 微妙光泽阴影 */
            .chat-message.chat-message-from-user:not(.chat-message-transparent) {
                background: linear-gradient(135deg, #FF8A1A 0%, #FF6B00 100%) !important;
                color: #FFFFFF !important;
                box-shadow: 0 2px 8px rgba(255, 122, 0, 0.25) !important;
            }
            .chat-message.chat-message-from-user p,
            .chat-message.chat-message-from-user span,
            .chat-message.chat-message-from-user .chat-message-markdown {
                color: #FFFFFF !important;
            }

            /* 🔘 浮动按钮：光晕 + 呼吸动画 + 渐变 */
            .chat-window-wrapper .chat-window-toggle {
                background: linear-gradient(135deg, #FF8A1A 0%, #FF6B00 100%) !important;
                box-shadow:
                    0 4px 16px rgba(255, 122, 0, 0.35),
                    0 1px 4px rgba(255, 122, 0, 0.2) !important;
                animation: togglePulse 3s ease-in-out infinite !important;
                border: 2px solid rgba(255, 255, 255, 0.2) !important;
            }
            .chat-window-wrapper .chat-window-toggle:hover {
                background: linear-gradient(135deg, #FF9933 0%, #E66E00 100%) !important;
                box-shadow:
                    0 6px 24px rgba(255, 122, 0, 0.45),
                    0 2px 8px rgba(255, 122, 0, 0.3) !important;
                animation: none !important;
            }

            /* 🎯 欢迎屏/通用主按钮渐变 */
            .chat-button-primary {
                background: linear-gradient(135deg, #FF8A1A 0%, #FF6B00 100%) !important;
                border: none !important;
            }
            .chat-button-primary:hover {
                background: linear-gradient(135deg, #FF9933 0%, #E66E00 100%) !important;
            }

            @keyframes togglePulse {
                0%, 100% {
                    box-shadow:
                        0 4px 16px rgba(255, 122, 0, 0.35),
                        0 1px 4px rgba(255, 122, 0, 0.2);
                }
                50% {
                    box-shadow:
                        0 4px 24px rgba(255, 122, 0, 0.5),
                        0 1px 8px rgba(255, 122, 0, 0.3);
                }
            }

            /* ⌨️ 输入容器：温暖边框 */
            .chat-inputs {
                border: 1px solid rgba(255, 122, 0, 0.15) !important;
                border-radius: 20px !important;
                background: #FFFFFF !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04) inset !important;
                transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
            }
            .chat-inputs:focus-within {
                border-color: rgba(255, 122, 0, 0.4) !important;
                box-shadow:
                    0 0 0 3px rgba(255, 122, 0, 0.08),
                    0 1px 3px rgba(0, 0, 0, 0.04) inset !important;
            }

            /* 📤 发送按钮微调 */
            .chat-input-send-button {
                border-radius: 50% !important;
                transition: all 0.2s ease !important;
            }
            .chat-input-send-button:hover:not([disabled]) {
                transform: scale(1.1) !important;
            }

            /* 📜 自定义滚动条 (Webkit) */
            .chat-messages-list::-webkit-scrollbar {
                width: 5px;
            }
            .chat-messages-list::-webkit-scrollbar-track {
                background: transparent;
            }
            .chat-messages-list::-webkit-scrollbar-thumb {
                background: rgba(255, 122, 0, 0.2);
                border-radius: 10px;
            }
            .chat-messages-list::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 122, 0, 0.35);
            }

            /* 🎞️ 窗口弹出动画增强 */
            .chat-window-transition-enter-active {
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                            opacity 0.2s ease !important;
            }
            .chat-window-transition-leave-active {
                transition: transform 0.2s ease,
                            opacity 0.15s ease !important;
            }
            .chat-window-transition-enter-from {
                opacity: 0 !important;
                transform: scale(0.85) translateY(10px) !important;
            }

            /* 🎵 打字动画：改为品牌色 */
            .chat-message-typing .chat-message-typing-circle {
                background-color: #FF7A00 !important;
            }

            /* 📱 移动端适配微调 */
            @media (max-width: 480px) {
                :root {
                    --chat--window--width: 100vw !important;
                    --chat--window--height: 70vh !important;
                    --chat--window--bottom: 0px !important;
                    --chat--window--right: 0px !important;
                    --chat--window--border-radius: 20px 20px 0 0 !important;
                }
            }
        `;
        document.head.appendChild(brandCSS);

        // ============================
        // 2) 加载 n8n Chat CSS
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
                    'Hi！ 我是你的专属私厨 碗妈 BowlMama 🍜',
                    '很高兴在 Incredibowl 遇见你！',
                    '想了解今日菜单、营养资讯、还是下单？随时问我 😊'
                ],
                i18n: {
                    en: {
                        title: '🍲 Incredibowl AI',
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
