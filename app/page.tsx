import { Suspense } from "react";
import { ViewProvider } from "../components/view-context";
import { DEFAULT_GRID_VIEW } from "../lib/types";
import { getViewConfig } from "../lib/server/view-storage";
import { HomePage } from "../components/home-page";

interface PageProps {
  searchParams?: {
    view?: string;
    tab?: string;
  };
}

export default async function Home({ searchParams }: PageProps) {
  const viewId = searchParams?.view;
  const tabParam = searchParams?.tab;
  const initialTab = tabParam === "models" || tabParam === "datasets" ? tabParam : "grid";

  const initial = viewId ? await getViewConfig(viewId) : null;

  return (
    <ViewProvider initialViewId={viewId} initialConfig={initial?.config ?? DEFAULT_GRID_VIEW}>
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">Loading...</div>}>
        <HomePage initialTab={initialTab} />
      </Suspense>
    </ViewProvider>
  );
}
