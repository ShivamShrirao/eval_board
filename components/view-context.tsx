"use client";

import { createContext, useContext, useState } from "react";
import type { GridViewConfig, GridColumnConfig } from "../lib/types";
import { DEFAULT_GRID_VIEW } from "../lib/types";

type Updater<T> = T | ((prev: T) => T);

interface ViewContextValue {
  viewId?: string;
  config: GridViewConfig;
  setConfig: (value: Updater<GridViewConfig>) => void;
  setColumns: (value: Updater<GridColumnConfig[]>) => void;
  markSaved: (viewId: string) => void;
  markDirty: () => void;
  isDirty: boolean;
}

const ViewContext = createContext<ViewContextValue | null>(null);

export interface ViewProviderProps {
  initialViewId?: string;
  initialConfig?: GridViewConfig | null;
  children: React.ReactNode;
}

export function ViewProvider({ initialViewId, initialConfig, children }: ViewProviderProps) {
  const [config, setConfigState] = useState<GridViewConfig>(() => initialConfig ?? DEFAULT_GRID_VIEW);
  const [viewId, setViewId] = useState<string | undefined>(initialViewId);
  const [isDirty, setDirtyFlag] = useState<boolean>(false);

  const setConfig = (value: Updater<GridViewConfig>) => {
    setConfigState((prev) => {
      const next = typeof value === "function" ? (value as (p: GridViewConfig) => GridViewConfig)(prev) : value;
      if (next !== prev) {
        setDirtyFlag(true);
      }
      return next;
    });
  };

  const setColumns = (value: Updater<GridColumnConfig[]>) => {
    setConfigState((prev) => {
      const nextColumns =
        typeof value === "function" ? (value as (p: GridColumnConfig[]) => GridColumnConfig[])(prev.columns) : value;
      if (nextColumns !== prev.columns) {
        setDirtyFlag(true);
      }
      return {
        ...prev,
        columns: nextColumns
      };
    });
  };

  const markSaved = (nextViewId: string) => {
    setViewId(nextViewId);
    setDirtyFlag(false);
  };

  const markDirty = () => setDirtyFlag(true);

  return (
    <ViewContext.Provider
      value={{
        viewId,
        config,
        setConfig,
        setColumns,
        markSaved,
        markDirty,
        isDirty
      }}
    >
      {children}
    </ViewContext.Provider>
  );
}

export const useViewContext = () => {
  const ctx = useContext(ViewContext);
  if (!ctx) {
    throw new Error("useViewContext must be used within a ViewProvider");
  }
  return ctx;
};
