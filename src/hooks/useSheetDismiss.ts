import { useRef, useCallback, type CSSProperties, type TouchEventHandler } from 'react';

const DISMISS_THRESHOLD = 80; // px dragged down to trigger dismiss
const RESISTANCE = 0.5; // dampen drag beyond threshold

/**
 * Adds a swipe-down-to-dismiss gesture for mobile bottom-sheet dialogs.
 * Only activates when the sheet content is scrolled to the top.
 */
export function useSheetDismiss(onDismiss: (() => void) | undefined) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);
  const currentY = useRef(0);
  const dragging = useRef(false);

  const applyTransform = (dy: number) => {
    const el = sheetRef.current;
    if (!el) return;
    if (dy <= 0) {
      el.style.transform = '';
      el.style.opacity = '';
      return;
    }
    const clamped =
      dy > DISMISS_THRESHOLD ? DISMISS_THRESHOLD + (dy - DISMISS_THRESHOLD) * RESISTANCE : dy;
    el.style.transform = `translateY(${clamped}px)`;
    el.style.opacity = String(Math.max(0.5, 1 - clamped / 400));
  };

  const onTouchStart: TouchEventHandler = useCallback(
    (e) => {
      if (!onDismiss) return;
      const el = sheetRef.current;
      if (!el) return;
      // Don't activate swipe-dismiss when touch starts on a draggable element
      const target = e.target;
      if (target instanceof Element && target.closest('[data-no-sheet-swipe]')) return;
      // Only begin if content is scrolled to top
      if (el.scrollTop > 0) return;
      startY.current = e.touches[0]!.clientY;
      currentY.current = startY.current;
      dragging.current = false;
      // Remove transition during active drag
      el.style.transition = 'none';
    },
    [onDismiss],
  );

  const onTouchMove: TouchEventHandler = useCallback(
    (e) => {
      if (!onDismiss || startY.current === null) return;
      const el = sheetRef.current;
      if (!el) return;

      currentY.current = e.touches[0]!.clientY;
      const dy = currentY.current - startY.current!;

      if (!dragging.current) {
        // Need a clear downward intent before activating
        if (dy < 6) return;
        // If user scrolled up or content now has scroll offset, abort
        if (el.scrollTop > 0) {
          startY.current = null;
          return;
        }
        dragging.current = true;
      }

      applyTransform(dy);
    },
    [onDismiss],
  );

  const onTouchEnd: TouchEventHandler = useCallback(() => {
    if (!onDismiss) return;
    const el = sheetRef.current;
    const dy = currentY.current - (startY.current ?? 0);
    startY.current = null;

    if (!dragging.current || !el) {
      if (el) {
        el.style.transition = '';
        el.style.transform = '';
        el.style.opacity = '';
      }
      dragging.current = false;
      return;
    }
    dragging.current = false;

    if (dy >= DISMISS_THRESHOLD) {
      // Animate out then dismiss
      el.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
      el.style.transform = 'translateY(100%)';
      el.style.opacity = '0';
      setTimeout(() => onDismiss(), 180);
    } else {
      // Snap back
      el.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
      el.style.transform = '';
      el.style.opacity = '';
    }
  }, [onDismiss]);

  const onTouchCancel: TouchEventHandler = useCallback(() => {
    const el = sheetRef.current;
    startY.current = null;
    dragging.current = false;
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
    }
  }, []);

  const dragHandleStyle: CSSProperties = {
    width: 36,
    height: 4,
    borderRadius: 2,
    background: 'rgba(255,255,255,0.2)',
    margin: '0 auto 12px',
  };

  return {
    sheetRef,
    touchHandlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
    dragHandleStyle,
  };
}
