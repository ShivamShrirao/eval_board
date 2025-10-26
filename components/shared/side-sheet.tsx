"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

interface SideSheetProps {
  open: boolean;
  title?: string | null;
  onClose: () => void;
  children: ReactNode;
}

export function SideSheet({ open, title, onClose, children }: SideSheetProps) {
  const isBrowser = typeof document !== "undefined";

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!isBrowser) {
    return null;
  }

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/75 backdrop-blur transition-opacity duration-200",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[680px] flex-col border-l border-slate-800/70 bg-slate-950/95 shadow-[0_28px_60px_-20px_rgba(2,6,23,0.75)] transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Details"}
      >
        <div className="flex items-center justify-between border-b border-slate-800/60 px-6 py-4">
          <h2 className="max-w-[75%] truncate text-lg font-semibold text-slate-100">{title ?? "Details"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </aside>
    </>,
    document.body
  );
}
