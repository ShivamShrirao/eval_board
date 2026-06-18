"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";
import type { ImageArtifactDTO } from "../../lib/types";

export interface GridPosition {
  rowIndex: number;
  colIndex: number;
}

export interface NavigationContext {
  totalRows: number;
  totalCols: number;
  getImageAt: (row: number, col: number) => ImageArtifactDTO | null;
}

interface ImageLightboxProps {
  image: ImageArtifactDTO | null;
  position: GridPosition | null;
  navigation: NavigationContext | null;
  modelName?: string;
  onClose: () => void;
  onNavigate: (position: GridPosition, image: ImageArtifactDTO) => void;
}

export function ImageLightbox({
  image,
  position,
  navigation,
  modelName,
  onClose,
  onNavigate,
}: ImageLightboxProps) {
  const open = image !== null;

  const navigateToDirection = useCallback(
    (direction: "up" | "down" | "left" | "right") => {
      if (!position || !navigation) return;

      let newRow = position.rowIndex;
      let newCol = position.colIndex;

      switch (direction) {
        case "up":
          newRow = Math.max(0, position.rowIndex - 1);
          break;
        case "down":
          newRow = Math.min(navigation.totalRows - 1, position.rowIndex + 1);
          break;
        case "left":
          newCol = Math.max(0, position.colIndex - 1);
          break;
        case "right":
          newCol = Math.min(navigation.totalCols - 1, position.colIndex + 1);
          break;
      }

      if (newRow === position.rowIndex && newCol === position.colIndex) return;

      const newImage = navigation.getImageAt(newRow, newCol);
      if (newImage) {
        onNavigate({ rowIndex: newRow, colIndex: newCol }, newImage);
      }
    },
    [position, navigation, onNavigate]
  );

  useEffect(() => {
    if (!open) return;

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handler = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowUp":
          event.preventDefault();
          navigateToDirection("up");
          break;
        case "ArrowDown":
          event.preventDefault();
          navigateToDirection("down");
          break;
        case "ArrowLeft":
          event.preventDefault();
          navigateToDirection("left");
          break;
        case "ArrowRight":
          event.preventDefault();
          navigateToDirection("right");
          break;
      }
    };

    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose, navigateToDirection]);

  // Don't render until we can create a portal in the browser.
  if (typeof document === "undefined" || !image) {
    return null;
  }

  const formatDate = (dateStr: string | undefined | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const formatDimensions = () => {
    if (image.width && image.height) {
      return `${image.width} × ${image.height}`;
    }
    return null;
  };

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex transition-opacity duration-300",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      )}
    >
      {/* Heavily blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-2xl"
        onClick={onClose}
      />

      {/* Main content area */}
      <div className="relative z-10 flex h-full w-full">
        {/* Image container - takes remaining space */}
        <div className="flex flex-1 items-center justify-center p-8 pr-4">
          <div className="relative flex h-full w-full items-center justify-center">
            {/* Navigation hints */}
            {navigation && position && (
              <>
                {/* Up arrow indicator */}
                {position.rowIndex > 0 && navigation.getImageAt(position.rowIndex - 1, position.colIndex) && (
                  <button
                    onClick={() => navigateToDirection("up")}
                    className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full border border-white/20 bg-black/60 p-3 text-white/70 backdrop-blur-sm transition-all hover:border-white/40 hover:bg-black/80 hover:text-white"
                    title="Previous row (↑)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                )}

                {/* Down arrow indicator */}
                {position.rowIndex < navigation.totalRows - 1 && navigation.getImageAt(position.rowIndex + 1, position.colIndex) && (
                  <button
                    onClick={() => navigateToDirection("down")}
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/60 p-3 text-white/70 backdrop-blur-sm transition-all hover:border-white/40 hover:bg-black/80 hover:text-white"
                    title="Next row (↓)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                )}

                {/* Left arrow indicator */}
                {position.colIndex > 0 && navigation.getImageAt(position.rowIndex, position.colIndex - 1) && (
                  <button
                    onClick={() => navigateToDirection("left")}
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-3 text-white/70 backdrop-blur-sm transition-all hover:border-white/40 hover:bg-black/80 hover:text-white"
                    title="Previous column (←)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                )}

                {/* Right arrow indicator */}
                {position.colIndex < navigation.totalCols - 1 && navigation.getImageAt(position.rowIndex, position.colIndex + 1) && (
                  <button
                    onClick={() => navigateToDirection("right")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/60 p-3 text-white/70 backdrop-blur-sm transition-all hover:border-white/40 hover:bg-black/80 hover:text-white"
                    title="Next column (→)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )}
              </>
            )}

            {/* The image itself */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.sourceUrl}
              alt={image.prompt ?? image.filename}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl shadow-black/50"
              style={{ maxHeight: "calc(100vh - 4rem)" }}
            />
          </div>
        </div>

        {/* Metadata sidebar */}
        <aside className="relative flex h-full w-[380px] flex-shrink-0 flex-col border-l border-slate-700/70 bg-slate-900/90 backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-700/70 px-6 py-5">
            <h2 className="font-mono text-xs font-semibold uppercase tracking-widest text-slate-300">
              Image Details
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/70 text-slate-300 transition-all hover:border-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
              title="Close (Esc)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-6 p-6">
              {/* Filename */}
              <MetadataSection label="Filename">
                <p className="break-all font-mono text-sm text-slate-100">{image.filename}</p>
              </MetadataSection>

              {/* Model */}
              {modelName && (
                <MetadataSection label="Model">
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5">
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    <span className="text-sm font-medium text-cyan-300">{modelName}</span>
                  </div>
                </MetadataSection>
              )}

              {/* Grid position */}
              {position && (
                <MetadataSection label="Grid Position">
                  <div className="flex items-center gap-3 text-sm text-slate-200">
                    <span className="rounded border border-slate-600/60 bg-slate-800/60 px-2 py-1 font-mono">
                      Row {position.rowIndex + 1}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="rounded border border-slate-600/60 bg-slate-800/60 px-2 py-1 font-mono">
                      Col {position.colIndex + 1}
                    </span>
                  </div>
                </MetadataSection>
              )}

              {/* Prompt */}
              {image.prompt && (
                <MetadataSection label="Prompt">
                  <p className="text-sm leading-relaxed text-slate-200">{image.prompt}</p>
                </MetadataSection>
              )}

              {/* Dimensions */}
              {formatDimensions() && (
                <MetadataSection label="Dimensions">
                  <p className="font-mono text-sm text-slate-200">{formatDimensions()}</p>
                </MetadataSection>
              )}

              {/* Timestamps */}
              <div className="flex flex-col gap-4">
                {image.capturedAt && (
                  <MetadataSection label="Captured">
                    <p className="text-sm text-slate-300">{formatDate(image.capturedAt)}</p>
                  </MetadataSection>
                )}
                {image.createdAt && (
                  <MetadataSection label="Created">
                    <p className="text-sm text-slate-300">{formatDate(image.createdAt)}</p>
                  </MetadataSection>
                )}
              </div>

              {/* Additional metadata */}
              {image.metadata && Object.keys(image.metadata).length > 0 && (
                <MetadataSection label="Additional Metadata">
                  <div className="rounded-lg border border-slate-700/70 bg-slate-800/70 p-4">
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-slate-200">
                      {JSON.stringify(image.metadata, null, 2)}
                    </pre>
                  </div>
                </MetadataSection>
              )}
            </div>
          </div>

          {/* Navigation hint footer */}
          <div className="border-t border-slate-700/70 px-6 py-4">
            <div className="flex items-center justify-center gap-6 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-slate-600/60 bg-slate-800/60 px-1.5 py-0.5 font-mono">←</kbd>
                <kbd className="rounded border border-slate-600/60 bg-slate-800/60 px-1.5 py-0.5 font-mono">→</kbd>
                <span className="ml-1">columns</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-slate-600/60 bg-slate-800/60 px-1.5 py-0.5 font-mono">↑</kbd>
                <kbd className="rounded border border-slate-600/60 bg-slate-800/60 px-1.5 py-0.5 font-mono">↓</kbd>
                <span className="ml-1">rows</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-slate-600/60 bg-slate-800/60 px-1.5 py-0.5 font-mono">Esc</kbd>
                <span className="ml-1">close</span>
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>,
    document.body
  );
}

interface MetadataSectionProps {
  label: string;
  children: ReactNode;
}

function MetadataSection({ label, children }: MetadataSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </h3>
      {children}
    </div>
  );
}
