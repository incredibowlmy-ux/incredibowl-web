"use client";

import { useEffect, useRef } from 'react';

/**
 * 弹窗的键盘 / 读屏基本盘：Escape 关闭、锁背景滚动、焦点关进面板里、关掉后把
 * 焦点还给打开它的那个元素。
 *
 * 为什么抽出来（2026-09-05）：这套东西 `SubscribeModal` 早就写对了，而下单链路
 * 上的四个弹窗（AddOnModal / CartDrawer / AuthModal / FeedbackSection 的两个）
 * 一个都没有 —— 按 Escape 关不掉、Tab 会走到后面的页面上去、开着弹窗背景还能滚。
 * 与其在四个地方各抄一遍（迟早漂），不如只留一份实现。
 *
 * ⚠️ `document.body.style.overflow` 必须**恢复成打开前的值**，不能一律写回 ''。
 * 购物车抽屉可以从 AddOnModal 之上打开，后关的那个把 overflow 清成 '' 会让背景
 * 在前一个弹窗还开着时就能滚。
 *
 * 用法：
 *   const panelRef = useRef<HTMLDivElement>(null);
 *   useModalA11y({ open: isOpen, onClose: handleClose, panelRef });
 *   <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
 */
export function useModalA11y({
  open,
  onClose,
  panelRef,
  closeOnEscape = true,
}: {
  open: boolean;
  onClose: () => void;
  panelRef: React.RefObject<HTMLElement | null>;
  /** 极少数弹窗不该被 Escape 关掉（例如支付进行中）。默认可以。 */
  closeOnEscape?: boolean;
}) {
  // onClose 每次渲染都是新函数；放进 ref 才不会让 effect 反复重挂、
  // 也不用逼调用方去 useCallback。
  // ⚠️ 同步动作必须在 effect 里做，不能在渲染期直接写 `ref.current = onClose`
  // （React 19 的 react-hooks/refs 会报错）：并发渲染下这次渲染可能被丢弃，
  // 而 ref 的写入已经发生，键盘事件就会调到一个从没提交过的闭包。
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // 打开后把焦点移进面板，否则 Tab 第一下会落到页面顶部
    const focusFirst = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first || panel).focus({ preventScroll: true });
    };
    const raf = requestAnimationFrame(focusFirst);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      // 焦点已经跑到面板外（上一次渲染时元素被移除等）→ 拉回来
      if (active && !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
      // 焦点还回去，否则关掉弹窗后 Tab 从页面开头重来
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, closeOnEscape, panelRef]);
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
