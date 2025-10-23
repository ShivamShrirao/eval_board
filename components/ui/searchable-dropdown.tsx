"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  placeholder?: string;
  emptyMessage?: string;
  allowClear?: boolean;
  buttonClassName?: string;
  disabled?: boolean;
}

export function SearchableDropdown({
  options,
  value,
  onSelect,
  placeholder = "Select...",
  emptyMessage = "No results",
  allowClear = false,
  buttonClassName,
  disabled = false
}: SearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);

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
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  const filtered = useMemo(
    () =>
      options.filter((option) =>
        option.label.toLowerCase().includes(search.toLowerCase().trim())
      ),
    [options, search]
  );

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex min-w-[220px] items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40",
          disabled && "opacity-60",
          buttonClassName
        )}
      >
        <span className={cn(!selected && "text-slate-500")}>{selected ? selected.label : placeholder}</span>
        <span className="text-slate-600">▾</span>
      </button>

      {open ? (
        <div
          ref={popoverRef}
          className="absolute z-50 mt-2 w-80 rounded-xl border border-slate-800 bg-slate-950/95 p-2 shadow-2xl backdrop-blur"
        >
          <input
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none"
          />
          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
            {allowClear && selected ? (
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-xs uppercase tracking-wide text-slate-400 hover:bg-slate-900"
              >
                Clear selection
              </button>
            ) : null}

            {filtered.length === 0 ? (
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
                    "w-full rounded-md px-3 py-2 text-left text-sm transition hover:bg-slate-900",
                    option.value === value && "bg-slate-900 text-slate-100"
                  )}
                >
                  <div className="font-medium text-slate-100">{option.label}</div>
                  {option.description ? (
                    <div className="text-xs text-slate-400">{option.description}</div>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
