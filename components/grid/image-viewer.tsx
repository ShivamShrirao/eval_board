"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { ImageArtifactDTO } from "../../lib/types";
import { cn } from "../../lib/utils";

interface ImageViewerProps {
  open: boolean;
  artifact: ImageArtifactDTO | null;
  onOpenChange: (open: boolean) => void;
  onNavigate: (direction: "left" | "right" | "up" | "down") => void;
}

export function ImageViewer({ open, artifact, onOpenChange, onNavigate }: ImageViewerProps) {
  useHotkeys(
    "left",
    () => onNavigate("left"),
    { enabled: open },
    [open, onNavigate]
  );
  useHotkeys(
    "right",
    () => onNavigate("right"),
    { enabled: open },
    [open, onNavigate]
  );
  useHotkeys(
    "up",
    () => onNavigate("up"),
    { enabled: open },
    [open, onNavigate]
  );
  useHotkeys(
    "down",
    () => onNavigate("down"),
    { enabled: open },
    [open, onNavigate]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
          <div className="flex w-full max-w-6xl flex-col gap-6 rounded-2xl border border-slate-700/70 bg-slate-900/95 p-6 shadow-2xl">
            <header className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold text-slate-100">
                  {artifact?.filename ?? "Preview"}
                </Dialog.Title>
                {artifact?.prompt ? (
                  <p className="mt-1 text-sm text-slate-400">{artifact.prompt}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-full border border-slate-600 px-3 py-1 text-sm text-slate-300 transition hover:border-slate-400 hover:text-white"
              >
                Close
              </button>
            </header>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="flex min-h-[320px] items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
                {artifact ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={artifact.sourceUrl}
                    alt={artifact.prompt ?? artifact.filename}
                    className="max-h-[70vh] max-w-full object-contain"
                  />
                ) : (
                  <div className="text-sm text-slate-500">No image available</div>
                )}
              </div>

              <aside className="max-h-[70vh] overflow-y-auto pr-1 text-sm text-slate-200">
                {artifact ? (
                  <MetaSection artifact={artifact} />
                ) : (
                  <div className="text-slate-400">Select an image to inspect metadata.</div>
                )}
              </aside>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MetaSection({ artifact }: { artifact: ImageArtifactDTO }) {
  const keyValues: Array<[string, string | number | null | undefined]> = [
    ["Model ID", artifact.modelId],
    ["Dataset ID", artifact.datasetId],
    ["Filename", artifact.filename],
    ["Prompt", artifact.prompt],
    ["Source URL", artifact.sourceUrl],
    ["Thumbnail", artifact.thumbnailUrl],
    ["Dimensions", artifact.width && artifact.height ? `${artifact.width}×${artifact.height}` : null],
    ["Captured At", artifact.capturedAt],
    ["Created At", artifact.createdAt]
  ];

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Details</h3>
        <dl className="mt-2 space-y-2">
          {keyValues.map(([key, value]) =>
            value ? (
              <div key={key} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 text-xs text-slate-300">
                <dt className="text-slate-500">{key}</dt>
                <dd className="break-words text-slate-200">{value}</dd>
              </div>
            ) : null
          )}
        </dl>
      </section>

      {artifact.metadata && Object.keys(artifact.metadata).length ? (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Metadata</h3>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950/70 p-4 text-xs text-slate-300">
            {JSON.stringify(artifact.metadata, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
