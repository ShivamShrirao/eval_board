"use client";

import { useCallback, useMemo, useState } from "react";
import { useBenchmarks } from "../../lib/hooks/useBenchmarks";
import { useRouter } from "next/navigation";

export function BenchmarksPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { benchmarks, isLoading, refresh } = useBenchmarks(search);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const summaries = useMemo(() => benchmarks, [benchmarks]);

  const handleDelete = useCallback(
    async (benchmarkId: string, benchmarkName: string) => {
      if (!window.confirm(`Delete benchmark “${benchmarkName}”? This will remove all associated images.`)) {
        return;
      }

      try {
        setDeletingId(benchmarkId);
        const res = await fetch(`/api/benchmarks/${benchmarkId}`, {
          method: "DELETE"
        });

        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || "Failed to delete benchmark");
        }

        await refresh();
      } catch (error) {
        console.error("Error deleting benchmark", error);
        window.alert("Failed to delete benchmark. Check logs for details.");
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
          <h2 className="text-xl font-semibold text-slate-100">Benchmarks</h2>
          <p className="text-sm text-slate-500">Track which benchmarks are available for comparison.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search benchmarks..."
            className="w-full rounded-lg border border-slate-900 bg-black/70 px-3 py-2 text-sm text-slate-100 focus:border-slate-600 focus:outline-none md:w-64"
          />
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading benchmarks...</div>
      ) : summaries.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          No benchmarks found. Try a different search.
        </div>
      ) : (
        <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-3">
          {summaries.map((benchmark) => (
            <div
              key={benchmark.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/benchmarks/${benchmark.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(`/benchmarks/${benchmark.id}`);
                }
              }}
              className="group flex cursor-pointer flex-col gap-4 rounded-2xl border border-slate-900 bg-black/70 p-5 text-left shadow-lg shadow-black/30 transition hover:border-slate-600 hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">{benchmark.name}</h3>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{benchmark.slug}</p>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleDelete(benchmark.id, benchmark.name);
                  }}
                  disabled={deletingId === benchmark.id}
                  className="rounded-lg border border-red-900/50 bg-black/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-300 transition hover:border-red-500 hover:text-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === benchmark.id ? "Deleting…" : "Delete"}
                </button>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                <div>
                  <dt className="uppercase tracking-wide text-slate-500">Models</dt>
                  <dd className="text-slate-200">{benchmark.modelCount}</dd>
                </div>
                <div>
                  <dt className="uppercase tracking-wide text-slate-500">Images</dt>
                  <dd className="text-slate-200">{benchmark.imageCount}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="uppercase tracking-wide text-slate-500">Created</dt>
                  <dd className="text-slate-300">{new Date(benchmark.createdAt).toLocaleString()}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
