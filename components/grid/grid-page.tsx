"use client";

import { useCallback, useMemo, useRef, useState, useLayoutEffect } from "react";
import { useViewContext } from "../view-context";
import { useModels } from "../../lib/hooks/useModels";
import { useGridData } from "../../lib/hooks/useGridData";
import { SearchableDropdown } from "../ui/searchable-dropdown";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { ImageArtifactDTO } from "../../lib/types";
import { cn } from "../../lib/utils";
import { ImageDetailView } from "./image-detail-view";
import { ArtifactImage } from "./artifact-image";

export function GridPage() {
  const { config, updateColumn, removeColumn, moveColumn } = useViewContext();

  const datasetId = config.datasetId ?? null;
  const [modelSearchState, setModelSearchState] = useState<{ datasetId: string | null; value: string }>({
    datasetId: null,
    value: ""
  });
  const modelSearch = modelSearchState.datasetId === datasetId ? modelSearchState.value : "";
  const setModelSearch = useCallback(
    (value: string) => {
      setModelSearchState({ datasetId, value });
    },
    [datasetId]
  );
  const { models, isLoading: isModelsLoading } = useModels(modelSearch, {
    datasetId
  });
  const { rows, isLoading } = useGridData(config);

  const [selectedLocation, setSelectedLocation] = useState<{ rowIndex: number; colIndex: number } | null>(null);

  const handleNavigate = (direction: "up" | "down" | "left" | "right") => {
    if (!selectedLocation) return;
    const { rowIndex, colIndex } = selectedLocation;
    let nextRow = rowIndex;
    let nextCol = colIndex;

    // Helper to check if a cell has content
    const hasContent = (r: number, c: number) => !!rows[r]?.cells[c]?.artifact;

    if (direction === "up") {
      nextRow--;
      while (nextRow >= 0 && !hasContent(nextRow, colIndex)) nextRow--;
    }
    if (direction === "down") {
      nextRow++;
      while (nextRow < rows.length && !hasContent(nextRow, colIndex)) nextRow++;
    }
    if (direction === "left") {
      nextCol--;
      // Skip empty columns to find previous image in the same row
      while (nextCol >= 0 && !hasContent(nextRow, nextCol)) nextCol--;
    }
    if (direction === "right") {
      nextCol++;
      // Skip empty columns to find next image in the same row
      while (nextCol < config.columns.length && !hasContent(nextRow, nextCol)) nextCol++;
    }

    // Bounds check
    if (nextRow >= 0 && nextRow < rows.length && nextCol >= 0 && nextCol < config.columns.length) {
      if (hasContent(nextRow, nextCol)) {
        setSelectedLocation({ rowIndex: nextRow, colIndex: nextCol });
      }
    }
  };

  const modelOptions = useMemo(
    () =>
      models.map((model) => ({
        value: model.id,
        label: model.name,
        description: `${model.datasetCount} datasets • ${model.imageCount} images`
      })),
    [models]
  );

  const modelsMap = useMemo(() => new Map(modelOptions.map((option) => [option.value, option])), [modelOptions]);

  const gridContainerRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const updateScrollMargin = () => {
    if (!gridContainerRef.current) return;
    const rect = gridContainerRef.current.getBoundingClientRect();
    setScrollMargin(rect.top + window.scrollY);
  };

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => updateScrollMargin();
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useLayoutEffect(() => {
    updateScrollMargin();
  }, [config.columns.length, rows.length]);

  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 350,
    overscan: 16,
    scrollMargin
  });

  const columnAspects = useMemo(() => {
    return config.columns.map((_, colIdx) => {
      for (const row of rows) {
        const a = row.cells[colIdx]?.artifact;
        if (a?.width && a?.height) {
          return a.width / a.height;
        }
      }
      return 1;
    });
  }, [config.columns, rows]);

  const gridTemplateColumns = useMemo(() => {
    if (columnAspects.length === 0) return "";
    return columnAspects.map((a) => `minmax(0, ${a}fr)`).join(" ");
  }, [columnAspects]);

  const renderRow = (index: number) => {
    const row = rows[index];
    if (!row) return null;

    return (
      <div className="grid" style={{ gridTemplateColumns }}>
        {row.cells.map((cell, columnIndex) => (
          <GridCell
            key={`${row.key}-${columnIndex}`}
            artifact={cell.artifact}
            aspect={columnAspects[columnIndex] ?? 1}
            onClick={() => {
              if (cell.artifact) {
                setSelectedLocation({ rowIndex: index, colIndex: columnIndex });
              }
            }}
          />
        ))}
      </div>
    );
  };

  const hasSelectedModels = config.columns.some((column) => column.modelId);

  const columnGridTemplate =
    config.columns.length > 0
      ? { gridTemplateColumns }
      : undefined;

  return (
    <section className="flex h-full w-full flex-col">
      <div
        className="sticky z-30 border-b border-slate-900 bg-black/80 backdrop-blur-md"
        style={{ top: "var(--top-bar-h, 52px)" }}
      >
        <div>
          {config.columns.length > 0 ? (
            <div className="grid" style={columnGridTemplate}>
              {config.columns.map((column, index) => (
                <div
                  key={column.id}
                  className="flex min-w-0 flex-col gap-0 overflow-hidden py-0"
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                    <span>Col {index + 1}</span>
                    <div className="flex items-center text-slate-500">
                      <button
                        type="button"
                        onClick={() => moveColumn(column.id, -1)}
                        disabled={index === 0}
                        className={cn(
                          "px-4 py-0.5 text-[11px] hover:bg-slate-800/60 hover:text-slate-200",
                          index === 0 && "opacity-30"
                        )}
                        title="Move left"
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumn(column.id, 1)}
                        disabled={index === config.columns.length - 1}
                        className={cn(
                          "px-4 py-0.5 text-[11px] hover:bg-slate-800/60 hover:text-slate-200",
                          index === config.columns.length - 1 && "opacity-30"
                        )}
                        title="Move right"
                      >
                        →
                      </button>
                      <button
                        type="button"
                        onClick={() => removeColumn(column.id)}
                        className="px-4 py-0.5 text-[11px] text-red-400 hover:bg-red-900/30 hover:text-red-200"
                        title="Remove column"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <SearchableDropdown
                    options={modelOptions}
                    value={column.modelId ?? null}
                    selectedLabel={column.label}
                    searchValue={modelSearch}
                    onSearchChange={setModelSearch}
                    onSelect={(value) => {
                      const meta = value ? modelsMap.get(value) : undefined;
                      updateColumn(column.id, {
                        modelId: value ?? null,
                        label: meta?.label
                      });
                    }}
                    placeholder="Select model"
                    emptyMessage={config.datasetId ? "No models found for this dataset" : "No models found"}
                    isLoading={isModelsLoading}
                    allowClear
                    buttonClassName="w-full justify-between bg-black/60 hover:bg-black/80 !py-0 text-xs leading-tight"
                    buttonStyle={{ color: "white" }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[80px] items-center justify-center text-sm text-slate-500">
              Use the + button to add model columns for comparison.
            </div>
          )}
        </div>
      </div>

      <div ref={gridContainerRef} className="flex-1 bg-transparent">
        {config.columns.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Add at least one model column to start comparing outputs.
          </div>
        ) : !hasSelectedModels ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Assign a model to each column to populate the grid.
          </div>
        ) : isLoading && rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading grid data...</div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No images found for the current selection.
          </div>
        ) : (
          <div>
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
                >
                  {renderRow(virtualRow.index)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedLocation && rows[selectedLocation.rowIndex]?.cells[selectedLocation.colIndex]?.artifact && (
        <ImageDetailView
          artifact={rows[selectedLocation.rowIndex].cells[selectedLocation.colIndex].artifact!}
          onClose={() => setSelectedLocation(null)}
          onNavigate={handleNavigate}
        />
      )}
    </section>
  );
}

interface GridCellProps {
  artifact: ImageArtifactDTO | null;
  aspect: number;
  onClick?: () => void;
}

function GridCell({ artifact, aspect, onClick }: GridCellProps) {
  return artifact ? (
    <div
      onClick={onClick}
      className="relative w-full overflow-hidden bg-black cursor-pointer"
      style={{ aspectRatio: String(aspect) }}
    >
      <ArtifactImage
        artifact={artifact}
        className="absolute inset-0 h-full w-full object-contain"
      />
    </div>
  ) : (
    <div
      className="flex w-full items-center justify-center bg-black/60 text-xs text-slate-600"
      style={{ aspectRatio: String(aspect) }}
    >
      —
    </div>
  );
}
