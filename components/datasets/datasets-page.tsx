"use client";

import { useMemo, useState } from "react";
import { useDatasets } from "../../lib/hooks/useDatasets";
import { DatasetSheet } from "./dataset-sheet";

export function DatasetsPage() {
  const [search, setSearch] = useState("");
  const { datasets, isLoading } = useDatasets(search);
  const [sheetState, setSheetState] = useState<{ id: string; name: string } | null>(null);

  const summaries = useMemo(() => datasets, [datasets]);

  return (
    <section className="flex h-full w-full flex-col gap-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Datasets</h2>
          <p className="text-sm text-slate-500">Track which datasets are available for comparison.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search datasets..."
            className="w-full rounded-lg border border-slate-900 bg-black/70 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none md:w-64"
          />
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading datasets...</div>
      ) : summaries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          No datasets found. Try a different search.
        </div>
      ) : (
        <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaries.map((dataset) => (
            <button
              key={dataset.id}
              type="button"
              onClick={() => setSheetState({ id: dataset.id, name: dataset.name })}
              className="flex flex-col gap-3 rounded-2xl border border-slate-900 bg-black/70 p-5 text-left shadow-lg shadow-black/30 transition hover:border-slate-600"
            >
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{dataset.name}</h3>
                <p className="text-xs uppercase tracking-wide text-slate-500">{dataset.slug}</p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div>
                  <dt className="uppercase tracking-wide text-slate-500">Models</dt>
                  <dd className="text-slate-200">{dataset.modelCount}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-slate-500">Images</dt>
                  <dd className="text-slate-200">{dataset.imageCount}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="uppercase tracking-wide text-slate-500">Created</dt>
                  <dd className="text-slate-300">{new Date(dataset.createdAt).toLocaleString()}</dd>
                </div>
              </dl>
            </button>
          ))}
        </div>
      )}

      <DatasetSheet
        datasetId={sheetState?.id ?? null}
        datasetName={sheetState?.name ?? null}
        onClose={() => setSheetState(null)}
      />
    </section>
  );
}
