"use client";

import { useCallback, useMemo, useState } from "react";
import { useModels } from "../../lib/hooks/useModels";
import { useRouter } from "next/navigation";

export function ModelsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { models, isLoading, refresh } = useModels(search);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const summaries = useMemo(() => models, [models]);

  const handleDelete = useCallback(
    async (modelId: string, modelName: string) => {
      if (!window.confirm(`Delete model “${modelName}”? This will remove all associated images.`)) {
        return;
      }

      try {
        setDeletingId(modelId);
        const res = await fetch(`/api/models/${modelId}`, {
          method: "DELETE"
        });

        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || "Failed to delete model");
        }

        await refresh();
      } catch (error) {
        console.error("Error deleting model", error);
        window.alert("Failed to delete model. Check logs for details.");
      } finally {
        setDeletingId(null);
      }
    },
    [refresh]
  );

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
            <div
              key={model.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/models/${model.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(`/models/${model.id}`);
                }
              }}
              className="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-slate-900 bg-black/70 p-5 text-left shadow-lg shadow-black/30 transition hover:border-slate-600 hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{model.name}</h3>
                  {model.description ? (
                    <p className="mt-1 text-sm text-slate-400">{model.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDelete(model.id, model.name);
                  }}
                  disabled={deletingId === model.id}
                  className="rounded-lg border border-red-900/50 bg-black/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-300 transition hover:border-red-500 hover:text-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === model.id ? "Deleting…" : "Delete"}
                </button>
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
            </div>
          ))}
        </div>
      )}

    </section>
  );
}
