"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "../lib/utils";
import { GridPage } from "./grid/grid-page";
import { ModelsPage } from "./models/models-page";
import { BenchmarksPage } from "./benchmarks/benchmarks-page";
import { useViewPersistence } from "./use-view-persistence";
import { useViewContext } from "./view-context";
import { useBenchmarks } from "../lib/hooks/useBenchmarks";
import { SearchableDropdown } from "./ui/searchable-dropdown";

interface HomePageProps {
  initialTab: "grid" | "models" | "benchmarks";
}

const tabs: Array<{ id: "grid" | "models" | "benchmarks"; label: string }> = [
  { id: "grid", label: "Grid" },
  { id: "models", label: "Models" },
  { id: "benchmarks", label: "Benchmarks" }
];

export function HomePage({ initialTab }: HomePageProps) {
  useViewPersistence();

  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<HomePageProps["initialTab"]>(initialTab);
  const { config, setBenchmark, addColumn } = useViewContext();
  const { benchmarks } = useBenchmarks("");

  const benchmarkOptions = useMemo(
    () =>
      benchmarks.map((benchmark) => ({
        value: benchmark.id,
        label: benchmark.name,
        description: `${benchmark.modelCount} models • ${benchmark.imageCount} images`
      })),
    [benchmarks]
  );

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const headerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (typeof window === "undefined" || !headerRef.current) return;
    const update = () => {
      if (headerRef.current) {
        document.documentElement.style.setProperty("--top-bar-h", `${headerRef.current.offsetHeight}px`);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  const content = useMemo(() => {
    if (activeTab === "models") return <ModelsPage />;
    if (activeTab === "benchmarks") return <BenchmarksPage />;
    return <GridPage />;
  }, [activeTab]);

  const handleTabChange = (tab: "grid" | "models" | "benchmarks") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);
    params.set("tab", tab);
    const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex min-h-screen flex-col bg-black text-slate-100">
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-slate-900/70 bg-black/80 backdrop-blur">
        <div className="flex w-full items-center gap-4 px-4">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Eval Board</span>
          <nav className="flex items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "rounded-full px-3 py-0 text-xs font-medium leading-tight transition",
                  activeTab === tab.id
                    ? "bg-slate-100 text-slate-900"
                    : "bg-black/40 text-slate-400 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          {activeTab === "grid" && (
            <div className="ml-4 flex flex-1 items-center gap-3">
              <SearchableDropdown
                options={benchmarkOptions}
                value={config.benchmarkId ?? null}
                onSelect={(value) => setBenchmark(value)}
                placeholder="Select benchmark"
                allowClear
                buttonClassName="min-w-[240px] max-w-[360px] bg-black/60 hover:bg-black/80 !py-0 text-xs leading-tight"
                buttonStyle={{ color: "white" }}
                labelClassName="truncate whitespace-nowrap"
              />
              <button
                type="button"
                onClick={() => addColumn(null)}
                className="ml-auto flex items-center gap-1.5 rounded-full border border-slate-700/70 bg-slate-900/85 px-3 py-0 text-xs font-semibold leading-tight text-slate-200 transition hover:border-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40"
                title="Add model column"
              >
                <span className="text-base leading-none">+</span>
                <span className="uppercase tracking-wide">Add column</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <div className="flex w-full flex-col">
          {content}
        </div>
      </main>
    </div>
  );
}
