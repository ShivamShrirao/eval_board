"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  description?: string | null;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  value?: string | null;
  onSelect: (value: string | null) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  selectedLabel?: string;
  placeholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  isLoading?: boolean;
  allowClear?: boolean;
  buttonClassName?: string;
  buttonStyle?: React.CSSProperties;
  labelClassName?: string;
  disabled?: boolean;
}

export function SearchableDropdown({
  options,
  value,
  onSelect,
  searchValue,
  onSearchChange,
  selectedLabel,
  placeholder = "Select...",
  emptyMessage = "No results",
  loadingMessage = "Loading...",
  isLoading = false,
  allowClear = false,
  buttonClassName,
  buttonStyle,
  labelClassName,
  disabled = false
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{
    left: number;
    width: number;
    top: number;
    maxHeight: number;
  }>({ left: 0, width: 240, top: 0, maxHeight: 256 });
  const isBrowser = typeof document !== "undefined";

  const activeSearch = searchValue ?? search;
  const setActiveSearch = useCallback(
    (next: string) => {
      if (onSearchChange) {
        onSearchChange(next);
      } else {
        setSearch(next);
      }
    },
    [onSearchChange]
  );

  const selected = useMemo(
    () =>
      options.find((option) => option.value === value) ??
      (value && selectedLabel ? { value, label: selectedLabel } : null),
    [options, selectedLabel, value]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (!popoverRef.current || !triggerRef.current) {
        return;
      }
      if (
        !popoverRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const updatePopoverPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    if (!rect) return;

    const minWidth = 260;
    const width = Math.max(rect.width, minWidth);
    const viewportWidth = window.innerWidth;
    const horizontalMargin = 16;

    let left = rect.left;
    if (left + width + horizontalMargin > viewportWidth) {
      left = Math.max(horizontalMargin, viewportWidth - width - horizontalMargin);
    } else {
      left = Math.max(horizontalMargin, left);
    }

    const maxHeight = Math.max(220, Math.min(360, window.innerHeight - rect.bottom - 24));
    setPosition({
      left,
      width,
      top: rect.bottom + 8,
      maxHeight
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, true);
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition, true);
    };
  }, [open, updatePopoverPosition]);

  const filtered = useMemo(
    () =>
      options.filter((option) =>
        option.label.toLowerCase().includes(activeSearch.toLowerCase().trim())
      ),
    [activeSearch, options]
  );

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() =>
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              setActiveSearch("");
            }
            return next;
          })
        }
        style={buttonStyle}
        className={cn(
          "group inline-flex items-center justify-between gap-3 rounded-full border border-slate-700/70 bg-[#1f1f24] px-4 py-2 text-sm font-medium shadow-[0_14px_30px_rgba(2,6,23,0.45)] transition hover:border-slate-500 hover:bg-[#26262c] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/60",
          open ? "border-slate-300 text-white shadow-[0_20px_46px_rgba(2,6,23,0.6)]" : "text-slate-200",
          disabled && "cursor-not-allowed opacity-50",
          buttonClassName
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={cn("min-w-0 flex-1 text-left break-words [overflow-wrap:anywhere]", !selected ? "text-slate-400" : "text-inherit", labelClassName)}
          title={selected ? selected.label : placeholder}
        >
          {selected ? selected.label : placeholder}
        </span>
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/70 text-[10px] font-semibold transition",
            open ? "rotate-180 text-slate-100" : "text-slate-400 group-hover:text-slate-200"
          )}
          aria-hidden
        >
          ▾
        </span>
      </button>

      {open && isBrowser
        ? createPortal(
            <div
              ref={popoverRef}
              style={{
                position: "fixed",
                zIndex: 90,
                width: position.width,
                left: position.left,
                top: position.top
              }}
              className="origin-top rounded-3xl border border-slate-800/60 bg-[#121216]/95 p-4 shadow-[0_32px_80px_rgba(2,6,23,0.65)] backdrop-blur-xl ring-1 ring-white/5"
            >
              <input
                autoFocus
                value={activeSearch}
                onChange={(event) => setActiveSearch(event.target.value)}
                placeholder="Search..."
                className="w-full rounded-full border border-slate-700/60 bg-slate-900/80 px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
              />
              <div
                className="mt-4 space-y-1.5 overflow-y-auto pr-1"
                role="listbox"
                style={{ maxHeight: position.maxHeight }}
              >
                {allowClear && selected ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(null);
                      setOpen(false);
                    }}
                    className="w-full rounded-2xl bg-slate-900/60 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:bg-slate-800/80 hover:text-white"
                  >
                    Clear selection
                  </button>
                ) : null}

                {isLoading ? (
                  <div className="px-3 py-6 text-center text-sm text-slate-500">{loadingMessage}</div>
                ) : filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-slate-500">{emptyMessage}</div>
                ) : (
                  filtered.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onSelect(option.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full rounded-2xl px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-slate-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/60",
                        option.value === value && "bg-slate-800/80 text-white ring-1 ring-slate-500/50"
                      )}
                    >
                      <div className="font-medium break-words [overflow-wrap:anywhere]">{option.label}</div>
                      {option.description ? (
                        <div className="text-xs text-slate-400 break-words [overflow-wrap:anywhere]">{option.description}</div>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
