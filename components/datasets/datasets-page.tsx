"use client";

import { useCallback, useMemo, useState } from "react";
import { useDatasets } from "../../lib/hooks/useDatasets";
import { useRouter } from "next/navigation";

export function DatasetsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { datasets, isLoading, refresh } = useDatasets(search);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const summaries = useMemo(() => datasets, [datasets]);

  const handleDelete = useCallback(
    async (datasetId: string, datasetName: string) => {
      if (!window.confirm(`Delete dataset “${datasetName}”? This will remove all associated images.`)) {
        return;
      }

      try {
        setDeletingId(datasetId);
        const res = await fetch(`/api/datasets/${datasetId}`, {
          method: "DELETE"
        });

        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || "Failed to delete dataset");
        }

        await refresh();
      } catch (error) {
        console.error("Error deleting dataset", error);
        window.alert("Failed to delete dataset. Check logs for details.");
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
            <div
              key={dataset.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/datasets/${dataset.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(`/datasets/${dataset.id}`);
                }
              }}
              className="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-slate-900 bg-black/70 p-5 text-left shadow-lg shadow-black/30 transition hover:border-slate-600 hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{dataset.name}</h3>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{dataset.slug}</p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDelete(dataset.id, dataset.name);
                  }}
                  disabled={deletingId === dataset.id}
                  className="rounded-lg border border-red-900/50 bg-black/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-300 transition hover:border-red-500 hover:text-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === dataset.id ? "Deleting…" : "Delete"}
                </button>
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
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
