import { ViewProvider } from "../components/view-context";
import { GridPage } from "../components/grid/grid-page";
import { DEFAULT_GRID_VIEW } from "../lib/types";
import { getViewConfig } from "../lib/server/view-storage";

interface PageProps {
  searchParams?: {
    view?: string;
  };
}

export default async function Home({ searchParams }: PageProps) {
  const viewId = searchParams?.view;

  const initial = viewId ? await getViewConfig(viewId) : null;

  return (
    <ViewProvider initialViewId={viewId} initialConfig={initial?.config ?? DEFAULT_GRID_VIEW}>
      <GridPage />
    </ViewProvider>
  );
}
