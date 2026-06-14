// Bottom sheet — the universal editor surface on mobile (spec rule:
// "bottom-sheet editors, never modals"). Header carries a × close button on
// the left so users have an explicit escape (swipe-down still works).
//
// Scroll-bleed fix: when the sheet is open we lock the documentElement's
// overflow and overscroll-behavior so touches inside a non-overflowing sheet
// don't bubble out and scroll the canvas underneath. The inner scroll
// container itself uses `overscroll-contain` + `touch-action: pan-y` so
// vertical pans stay inside the sheet boundary even when the content does
// overflow.

import { useEffect } from "react";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  rightAction?: ReactNode;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, rightAction, children }: Props) {
  // Escape key closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Body scroll lock while open — prevents the canvas underneath from scrolling
  // when the user pans inside the sheet.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevOverscroll = html.style.overscrollBehavior;
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prevOverflow;
      html.style.overscrollBehavior = prevOverscroll;
    };
  }, [open]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-[430px] rounded-t-2xl bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
      >
        <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-ink/20" />
        <div className="flex items-center justify-between gap-3 border-b border-ink/5 px-3 py-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-2xl leading-none text-muted hover:bg-ink/5"
          >
            ×
          </button>
          {title ? (
            <h2 className="min-w-0 flex-1 truncate text-base font-semibold">
              {title}
            </h2>
          ) : (
            <div className="flex-1" />
          )}
          {rightAction ? <div className="shrink-0">{rightAction}</div> : null}
        </div>
        <div
          className="max-h-[80vh] overflow-y-auto overscroll-contain px-5 py-4"
          style={{ touchAction: "pan-y" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="mb-4 block">
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
      {children}
    </label>
  );
}

export const inputClass =
  "block w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-ink/40";
