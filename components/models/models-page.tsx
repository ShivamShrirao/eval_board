"use client";

import { useMemo, useState } from "react";
import { useModels } from "../../lib/hooks/useModels";
import { ModelSheet } from "./model-sheet";

export function ModelsPage() {
  const [search, setSearch] = useState("");
  const { models, isLoading } = useModels(search);
  const [sheetState, setSheetState] = useState<{ id: string; name: string } | null>(null);

  const summaries = useMemo(() => models, [models]);

  return (
    <section className="flex h-full w-full flex-col gap-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Models</h2>
          <p className="text-sm text-slate-500">Browse available checkpoints and their dataset coverage.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search models..."
            className="w-full rounded-lg border border-slate-900 bg-black/70 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none md:w-64"
          />
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading models...</div>
      ) : summaries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          No models found. Try adjusting your search.
        </div>
      ) : (
        <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaries.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => setSheetState({ id: model.id, name: model.name })}
              className="flex flex-col gap-3 rounded-2xl border border-slate-900 bg-black/70 p-5 text-left shadow-lg shadow-black/30 transition hover:border-slate-600"
            >
              <div>
                <h3 className="text-lg font-semibold text-slate-100">{model.name}</h3>
                {model.description ? (
                  <p className="mt-1 text-sm text-slate-400">{model.description}</p>
                ) : null}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div>
                  <dt className="uppercase tracking-wide text-slate-500">Datasets</dt>
                  <dd className="text-slate-200">{model.datasetCount}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-slate-500">Images</dt>
                  <dd className="text-slate-200">{model.imageCount}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="uppercase tracking-wide text-slate-500">Created</dt>
                  <dd className="text-slate-300">{new Date(model.createdAt).toLocaleString()}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="uppercase tracking-wide text-slate-500">Slug</dt>
                  <dd className="text-slate-300">{model.slug}</dd>
                </div>
              </dl>
            </button>
          ))}
        </div>
      )}

      <ModelSheet
        modelId={sheetState?.id ?? null}
        modelName={sheetState?.name ?? null}
        onClose={() => setSheetState(null)}
      />
    </section>
  );
}
