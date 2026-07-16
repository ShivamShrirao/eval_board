import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBenchmarkDetail } from "../../../lib/server/model-service";
import { BenchmarkGallery } from "../../../components/benchmarks/benchmark-gallery";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface BenchmarkPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: BenchmarkPageProps): Promise<Metadata> {
  const { id } = await params;
  const benchmark = await getBenchmarkDetail(id);
  if (!benchmark) {
    return {
      title: "Benchmark not found • Eval Board"
    };
  }

  return {
    title: `${benchmark.name} • Benchmarks • Eval Board`,
    description: `Images contained in the ${benchmark.name} benchmark`
  };
}

export default async function BenchmarkDetailPage({ params }: BenchmarkPageProps) {
  const { id } = await params;
  const benchmark = await getBenchmarkDetail(id);

  if (!benchmark) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-col gap-6 rounded-2xl border border-slate-900 bg-black/70 p-6 shadow-xl shadow-black/40">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Benchmark</p>
            <h1 className="text-3xl font-semibold text-slate-100">{benchmark.name}</h1>
            <p className="mt-2 text-sm text-slate-500">Slug: {benchmark.slug}</p>
          </div>
          <Link
            href="/?tab=benchmarks"
            className="inline-flex items-center gap-2 rounded-full border border-slate-800/70 bg-slate-900/80 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
          >
            ← Back to benchmarks
          </Link>
        </div>
        <dl className="grid gap-4 text-sm text-slate-300 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-900/60 bg-black/40 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Models</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-100">{benchmark.modelCount}</dd>
          </div>
          <div className="rounded-xl border border-slate-900/60 bg-black/40 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Images</dt>
            <dd className="mt-1 text-lg font-semibold text-slate-100">{benchmark.imageCount}</dd>
          </div>
          <div className="rounded-xl border border-slate-900/60 bg-black/40 p-4">
            <dt className="text-xs uppercase tracking-wide text-slate-500">Created</dt>
            <dd className="mt-1 text-base text-slate-200">{new Date(benchmark.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-slate-900 bg-black/60 p-6 shadow-inner shadow-black/40">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Image gallery</h2>
          <p className="text-sm text-slate-500">{benchmark.imageCount} artifacts</p>
        </div>
        <BenchmarkGallery benchmarkId={benchmark.id} />
      </div>
    </div>
  );
}
