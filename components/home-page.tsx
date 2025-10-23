"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "../lib/utils";
import { GridPage } from "./grid/grid-page";
import { ModelsPage } from "./models/models-page";
import { DatasetsPage } from "./datasets/datasets-page";
import { useViewPersistence } from "./use-view-persistence";

interface HomePageProps {
  initialTab: "grid" | "models" | "datasets";
}

const tabs: Array<{ id: "grid" | "models" | "datasets"; label: string }> = [
  { id: "grid", label: "Grid" },
  { id: "models", label: "Models" },
  { id: "datasets", label: "Datasets" }
];

export function HomePage({ initialTab }: HomePageProps) {
  useViewPersistence();

  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<HomePageProps["initialTab"]>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const content = useMemo(() => {
    if (activeTab === "models") return <ModelsPage />;
    if (activeTab === "datasets") return <DatasetsPage />;
    return <GridPage />;
  }, [activeTab]);

  const handleTabChange = (tab: "grid" | "models" | "datasets") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);
    params.set("tab", tab);
    const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex min-h-screen flex-col bg-black text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-900/70 bg-black/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Eval Board</span>
            <span className="hidden text-xs text-slate-500 sm:inline">Diffusion comparison console</span>
          </div>
          <nav className="flex items-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  activeTab === tab.id
                    ? "bg-slate-100 text-slate-900"
                    : "bg-black/40 text-slate-400 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
          {content}
        </div>
      </main>
    </div>
  );
}
