"use client";

import { useMemo } from "react";
import { useViewContext } from "../view-context";

export function GridPage() {
  const { config } = useViewContext();

  const emptyState = useMemo(
    () =>
      !config.columns.length ? (
        <div className="rounded-xl bg-slate-900/70 p-8 text-slate-300">
          <h2 className="text-lg font-semibold text-slate-100">Build a comparison grid</h2>
          <p className="mt-2 text-sm text-slate-400">
            Add one or more model columns to start comparing outputs. Select a dataset to align rows by filename or
            prompt metadata. Saved configurations generate shareable URLs automatically.
          </p>
          <div className="mt-4 text-sm">
            Head to the prototype controls (coming soon) to add your first model column.
          </div>
        </div>
      ) : null,
    [config.columns.length]
  );

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-100">Eval Board</h1>
        <p className="text-sm text-slate-400">
          Compare diffusion model checkpoints across datasets. UI scaffolding is in place; hook up data sources next.
        </p>
      </header>

      {emptyState}

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
        <p className="font-semibold text-slate-200">Developer Notes</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Dataset selector, column management, and virtualization will mount here.</li>
          <li>Keyboard navigation and metadata drawer will reuse Radix primitives per the architecture doc.</li>
        </ul>
      </div>
    </section>
  );
}
