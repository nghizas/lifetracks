// Pointer-events hook: one pointer pans, two pointers pinch-zoom.
// `touch-action: none` on the target element is REQUIRED — without it Safari
// will hijack pinch as page zoom and one-finger drag as page scroll.

import { useEffect, useRef, type RefObject } from "react";
import type { ViewState } from "@/state";
import { clampPxPerDay } from "./coords";

interface Options {
  /** Anchor zoom uses the midpoint between fingers / cursor; this is the canvas's left x. */
  getCanvasLeft?: () => number;
}

export function useTouchPanZoom(
  ref: RefObject<HTMLElement>,
  view: ViewState,
  setView: (v: Partial<ViewState>) => void,
  options: Options = {},
): void {
  // Latest view in a ref so listeners stay stable.
  const viewRef = useRef(view);
  viewRef.current = view;
  const setViewRef = useRef(setView);
  setViewRef.current = setView;
  const getLeftRef = useRef(options.getCanvasLeft);
  getLeftRef.current = options.getCanvasLeft;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const pointers = new Map<number, { x: number; y: number }>();
    // Pinch gesture base values, captured at gesture start.
    let pinchStartPxPerDay = 0;
    let pinchStartScrollX = 0;
    let pinchStartMidWorld = 0;
    let pinchStartDist = 0;

    function canvasLeft(): number {
      return getLeftRef.current?.() ?? el!.getBoundingClientRect().left;
    }

    function beginPinch(): void {
      const pts = Array.from(pointers.values());
      const a = pts[0];
      const b = pts[1];
      if (!a || !b) return;
      const midX = (a.x + b.x) / 2 - canvasLeft();
      pinchStartPxPerDay = viewRef.current.pxPerDay;
      pinchStartScrollX = viewRef.current.scrollX;
      pinchStartMidWorld = midX + pinchStartScrollX;
      pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
    }

    function onPointerDown(e: PointerEvent): void {
      el!.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) beginPinch();
    }

    function onPointerMove(e: PointerEvent): void {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1) {
        const dx = e.clientX - prev.x;
        const dy = e.clientY - prev.y;
        setViewRef.current({ scrollX: viewRef.current.scrollX - dx });
        // Vertical scroll on the canvas element itself — touch-action: none
        // blocks native handling, so we mirror it here.
        if (dy !== 0) {
          el!.scrollTop -= dy;
        }
      } else if (pointers.size === 2 && pinchStartDist > 0) {
        const pts = Array.from(pointers.values());
        const a = pts[0];
        const b = pts[1];
        if (!a || !b) return;
        const midX = (a.x + b.x) / 2 - canvasLeft();
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const newPxPerDay = clampPxPerDay(pinchStartPxPerDay * (dist / pinchStartDist));
        const newWorld = pinchStartMidWorld * (newPxPerDay / pinchStartPxPerDay);
        setViewRef.current({ pxPerDay: newPxPerDay, scrollX: newWorld - midX });
      }
    }

    function onPointerEnd(e: PointerEvent): void {
      pointers.delete(e.pointerId);
      try {
        el!.releasePointerCapture(e.pointerId);
      } catch {
        // No capture held — ignore.
      }
      if (pointers.size === 2) beginPinch();
    }

    function onWheel(e: WheelEvent): void {
      const left = canvasLeft();
      if (e.ctrlKey || e.metaKey) {
        // Anchor-at-cursor zoom (trackpad pinch on macOS sends ctrlKey).
        e.preventDefault();
        const anchorScreenX = e.clientX - left;
        const factor = Math.exp(-e.deltaY * 0.01);
        const startPxPerDay = viewRef.current.pxPerDay;
        const newPxPerDay = clampPxPerDay(startPxPerDay * factor);
        const anchorWorld = anchorScreenX + viewRef.current.scrollX;
        const newWorld = anchorWorld * (newPxPerDay / startPxPerDay);
        setViewRef.current({ pxPerDay: newPxPerDay, scrollX: newWorld - anchorScreenX });
        return;
      }
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Horizontal pan
        e.preventDefault();
        const delta = e.shiftKey ? e.deltaY : e.deltaX;
        setViewRef.current({ scrollX: viewRef.current.scrollX + delta });
        return;
      }
      // Vertical wheel passes through — native scroll on the canvas element.
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerEnd);
    el.addEventListener("pointercancel", onPointerEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerEnd);
      el.removeEventListener("pointercancel", onPointerEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [ref]);
}
