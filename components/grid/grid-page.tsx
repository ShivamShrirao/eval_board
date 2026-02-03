"use client";

import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { useViewContext } from "../view-context";
import { useModels } from "../../lib/hooks/useModels";
import { useDatasets } from "../../lib/hooks/useDatasets";
import { useGridData } from "../../lib/hooks/useGridData";
import { SearchableDropdown } from "../ui/searchable-dropdown";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type { ImageArtifactDTO } from "../../lib/types";
import { cn } from "../../lib/utils";
import { ImageDetailView } from "./image-detail-view";

export function GridPage() {
  const { config, addColumn, updateColumn, removeColumn, moveColumn, setDataset } = useViewContext();

  const { datasets } = useDatasets("");
  const { models } = useModels("");
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

  const datasetOptions = useMemo(
    () =>
      datasets.map((dataset) => ({
        value: dataset.id,
        label: dataset.name,
        description: `${dataset.modelCount} models • ${dataset.imageCount} images`
      })),
    [datasets]
  );

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

  const handleAddColumn = () => {
    addColumn(null);
  };

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
    overscan: 8,
    scrollMargin
  });

  const renderRow = (index: number) => {
    const row = rows[index];
    if (!row) return null;
    const columnCount = config.columns.length;
    const templateColumns = `repeat(${columnCount}, minmax(240px, 1fr))`;

    return (
      <div className="border-b border-slate-900/60">
        <div className="grid gap-4 py-3" style={{ gridTemplateColumns: templateColumns }}>
          {row.cells.map((cell, columnIndex) => (
            <GridCell
              key={`${row.key}-${columnIndex}`}
              artifact={cell.artifact}
              onClick={() => {
                if (cell.artifact) {
                  setSelectedLocation({ rowIndex: index, colIndex: columnIndex });
                }
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  const hasSelectedModels = config.columns.some((column) => column.modelId);

  const columnGridTemplate =
    config.columns.length > 0
      ? {
          gridTemplateColumns: `repeat(${config.columns.length}, minmax(220px, 1fr))`
        }
      : undefined;

  return (
    <section className="flex h-full w-full flex-col gap-6">
      <div className="sticky top-[53px] z-30 -mx-1 -mt-1 rounded-2xl border border-slate-900 bg-black/80 px-5 py-5 shadow-lg shadow-black/40 backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <SearchableDropdown
              options={datasetOptions}
              value={config.datasetId ?? null}
              onSelect={(value) => setDataset(value)}
              placeholder="Select dataset"
              allowClear
              buttonClassName="min-w-[240px] bg-black/60 hover:bg-black/80"
              buttonStyle={{ color: "white" }}
            />
            <span className="hidden text-xs uppercase tracking-wide text-slate-500 sm:inline">
              {config.datasetId ? "Dataset selected" : "Choose a dataset"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleAddColumn}
            className="ml-auto flex items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/85 px-4 py-2 text-sm font-semibold text-slate-200 shadow-[0_12px_28px_rgba(8,15,31,0.35)] transition hover:border-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40"
            title="Add model column"
          >
            <span className="text-lg leading-none">+</span>
            <span className="uppercase tracking-wide">Add column</span>
          </button>
        </div>

        <div className="mt-5">
          {config.columns.length > 0 ? (
            <div className="grid gap-3" style={columnGridTemplate}>
              {config.columns.map((column, index) => (
                <div
                  key={column.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-900 bg-black/75 p-4 shadow-inner shadow-black/20"
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-300">
                    <span>Column {index + 1}</span>
                    <div className="flex items-center gap-1 text-slate-400">
                      <button
                        type="button"
                        onClick={() => moveColumn(column.id, -1)}
                        disabled={index === 0}
                        className={cn(
                          "rounded-md border border-slate-800 px-2 py-1 text-[11px] hover:border-slate-500",
                          index === 0 && "opacity-40"
                        )}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColumn(column.id, 1)}
                        disabled={index === config.columns.length - 1}
                        className={cn(
                          "rounded-md border border-slate-800 px-2 py-1 text-[11px] hover:border-slate-500",
                          index === config.columns.length - 1 && "opacity-40"
                        )}
                      >
                        →
                      </button>
                      <button
                        type="button"
                        onClick={() => removeColumn(column.id)}
                        className="rounded-md border border-red-900/60 px-2 py-1 text-[11px] text-red-300 transition hover:border-red-500 hover:text-red-100"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <SearchableDropdown
                    options={modelOptions}
                    value={column.modelId ?? null}
                    onSelect={(value) => {
                      const meta = value ? modelsMap.get(value) : undefined;
                      updateColumn(column.id, {
                        modelId: value ?? null,
                        label: meta?.label
                      });
                    }}
                    placeholder="Select model"
                    allowClear
                    buttonClassName="w-full justify-between bg-black/60 hover:bg-black/80"
                    buttonStyle={{ color: "white" }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[140px] items-center justify-center rounded-xl border border-dashed border-slate-800/70 bg-black/60 text-sm text-slate-500">
              Use the + button to add model columns for comparison.
            </div>
          )}
        </div>
      </div>

      <div ref={gridContainerRef} className="flex-1 rounded-2xl border border-slate-900 bg-transparent">
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
          <div className="px-5">
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                width: "100%",
                position: "relative"
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
  onClick?: () => void;
}

function GridCell({ artifact, onClick }: GridCellProps) {
  return artifact ? (
    <div 
      onClick={onClick}
      className="flex h-full flex-col rounded-xl border border-slate-900 bg-black/80 p-3 text-left cursor-pointer transition hover:border-slate-700 hover:bg-black/90"
    >
      <div className="relative flex h-72 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-950">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artifact.sourceUrl}
          alt={artifact.prompt ?? artifact.filename}
          loading="lazy"
          className="h-full w-full object-contain"
        />
      </div>
    </div>
  ) : (
    <div className="flex h-72 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-black/60 p-3 text-xs text-slate-500">
      No image
    </div>
  );
}
