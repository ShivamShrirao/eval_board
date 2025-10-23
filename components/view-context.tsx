"use client";

import { createContext, useContext, useState } from "react";
import type { GridViewConfig, GridColumnConfig } from "../lib/types";
import { DEFAULT_GRID_VIEW } from "../lib/types";
import { nanoid } from "nanoid";

type Updater<T> = T | ((prev: T) => T);

interface ViewContextValue {
  viewId?: string;
  config: GridViewConfig;
  setConfig: (value: Updater<GridViewConfig>) => void;
  setColumns: (value: Updater<GridColumnConfig[]>) => void;
  addColumn: (modelId: string, label?: string) => void;
  updateColumn: (columnId: string, updater: Partial<GridColumnConfig>) => void;
  removeColumn: (columnId: string) => void;
  moveColumn: (columnId: string, direction: -1 | 1) => void;
  setDataset: (datasetId: string | null) => void;
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

  const addColumn = (modelId: string, label?: string) => {
    setColumns((columns) => [
      ...columns,
      {
        id: nanoid(10),
        modelId,
        label: label ?? undefined
      }
    ]);
  };

  const updateColumn = (columnId: string, updater: Partial<GridColumnConfig>) => {
    setColumns((columns) =>
      columns.map((column) => (column.id === columnId ? { ...column, ...updater } : column))
    );
  };

  const removeColumn = (columnId: string) => {
    setColumns((columns) => columns.filter((column) => column.id !== columnId));
  };

  const moveColumn = (columnId: string, direction: -1 | 1) => {
    setColumns((columns) => {
      const index = columns.findIndex((column) => column.id === columnId);
      if (index === -1) {
        return columns;
      }
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= columns.length) {
        return columns;
      }
      const next = [...columns];
      const [removed] = next.splice(index, 1);
      next.splice(targetIndex, 0, removed);
      return next;
    });
  };

  const setDataset = (datasetId: string | null) => {
    setConfig((prev) => ({
      ...prev,
      datasetId: datasetId ?? null
    }));
  };

  return (
    <ViewContext.Provider
      value={{
        viewId,
        config,
        setConfig,
        setColumns,
        addColumn,
        updateColumn,
        removeColumn,
        moveColumn,
        setDataset,
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
