"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useViewContext } from "../view-context";
import { useModels } from "../../lib/hooks/useModels";
import { useDatasets } from "../../lib/hooks/useDatasets";
import { useGridData } from "../../lib/hooks/useGridData";
import { SearchableDropdown } from "../ui/searchable-dropdown";
import { ImageViewer } from "./image-viewer";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ImageArtifactDTO } from "../../lib/types";
import { cn } from "../../lib/utils";

export function GridPage() {
  const { config, addColumn, updateColumn, removeColumn, moveColumn, setDataset } = useViewContext();

  const { datasets } = useDatasets("");
  const { models } = useModels("");
  const { rows, isLoading } = useGridData(config);

  const [pendingAddModel, setPendingAddModel] = useState<string | null>(null);

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

  const handleAddColumn = (modelId: string | null) => {
    if (!modelId) return;
    const meta = modelsMap.get(modelId);
    addColumn(modelId, meta?.label);
    setPendingAddModel(null);
  };

  const [viewerState, setViewerState] = useState<{ rowIndex: number; columnIndex: number } | null>(null);

  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 260,
    overscan: 8
  });

  const [listHeight, setListHeight] = useState(640);
  useEffect(() => {
    const handler = () => setListHeight(Math.max(360, window.innerHeight - 320));
    handler();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (!viewerState) return;
    const row = rows[viewerState.rowIndex];
    if (!row || !row.cells[viewerState.columnIndex]?.artifact) {
      setViewerState(null);
    }
  }, [rows, viewerState]);

  const openCell = useCallback(
    (rowIndex: number, columnIndex: number) => {
      const row = rows[rowIndex];
      const artifact = row?.cells[columnIndex]?.artifact;
      if (!artifact) return;
      setViewerState({ rowIndex, columnIndex });
    },
    [rows]
  );

  const navigateViewer = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      if (!viewerState) return;
      const { rowIndex, columnIndex } = viewerState;
      const columnCount = config.columns.length;

      const attempt = (nextRow: number, nextCol: number) => {
        if (nextRow < 0 || nextRow >= rows.length) return false;
        if (nextCol < 0 || nextCol >= columnCount) return false;
        const cell = rows[nextRow].cells[nextCol];
        if (cell?.artifact) {
          setViewerState({ rowIndex: nextRow, columnIndex: nextCol });
          return true;
        }
        return false;
      };

      if (direction === "left" || direction === "right") {
        const delta = direction === "left" ? -1 : 1;
        for (let col = columnIndex + delta; col >= 0 && col < columnCount; col += delta) {
          if (attempt(rowIndex, col)) return;
        }
      }

      if (direction === "up" || direction === "down") {
        const delta = direction === "up" ? -1 : 1;
        for (let row = rowIndex + delta; row >= 0 && row < rows.length; row += delta) {
          if (attempt(row, columnIndex)) return;
        }
      }
    },
    [config.columns.length, rows, viewerState]
  );

  const selectedArtifact = viewerState
    ? rows[viewerState.rowIndex]?.cells[viewerState.columnIndex]?.artifact ?? null
    : null;

  const renderRow = (index: number) => {
    const row = rows[index];
    if (!row) return null;
    const columnCount = config.columns.length;
    const templateColumns = `220px repeat(${columnCount}, minmax(240px, 1fr))`;

    return (
      <div className="border-b border-slate-900/60">
        <div className="grid gap-4 px-4 py-3" style={{ gridTemplateColumns: templateColumns }}>
          <div className="self-start rounded-lg bg-black/60 px-3 py-2 text-xs text-slate-300">
            <div className="font-medium text-slate-100">{row.label}</div>
            {row.prompt && row.prompt !== row.label ? (
              <div className="mt-1 text-[11px] text-slate-500">{row.prompt}</div>
            ) : null}
          </div>
          {row.cells.map((cell, columnIndex) => (
            <GridCell key={`${row.key}-${columnIndex}`} artifact={cell.artifact} onOpen={() => openCell(index, columnIndex)} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="flex h-full w-full flex-col gap-6">
      <div className="rounded-2xl border border-slate-900 bg-black/70 p-5 shadow-lg shadow-black/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <SearchableDropdown
              options={datasetOptions}
              value={config.datasetId ?? null}
              onSelect={(value) => setDataset(value)}
              placeholder="Select dataset"
              allowClear
              buttonClassName="min-w-[240px] bg-black/80"
            />
            <span className="hidden text-xs uppercase tracking-wide text-slate-500 sm:inline">
              {config.datasetId ? "Dataset selected" : "Choose a dataset"}
            </span>
          </div>

          <SearchableDropdown
            key={config.columns.length}
            options={modelOptions}
            value={pendingAddModel}
            onSelect={(value) => {
              setPendingAddModel(value);
              handleAddColumn(value);
            }}
            placeholder="➕ Add model column"
            buttonClassName="min-w-[200px] border-indigo-700/60 bg-indigo-600/20 text-indigo-200 hover:border-indigo-400 hover:text-indigo-100"
          />
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
          {config.columns.map((column, index) => (
            <div key={column.id} className="flex min-w-[260px] flex-col gap-3 rounded-xl border border-slate-900 bg-black/75 p-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
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
                value={column.modelId}
                onSelect={(value) => {
                  if (!value) return;
                  const meta = modelsMap.get(value);
                  updateColumn(column.id, { modelId: value, label: meta?.label });
                }}
                placeholder="Select model"
                buttonClassName="bg-black/80"
              />
            </div>
          ))}
          {config.columns.length === 0 ? (
            <div className="flex min-h-[140px] min-w-[260px] items-center justify-center rounded-xl border border-dashed border-slate-800/70 bg-black/60 text-sm text-slate-500">
              Use the ➕ Add model column button to build your comparison.
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-900 bg-black/50">
        {!config.datasetId ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Select a dataset to populate the grid.
          </div>
        ) : config.columns.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Add at least one model column to start comparing outputs.
          </div>
        ) : isLoading && rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading grid data...</div>
        ) : rows.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No images found for the current selection.
          </div>
        ) : (
          <div ref={scrollParentRef} className="h-full w-full overflow-auto" style={{ maxHeight: listHeight }}>
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
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  {renderRow(virtualRow.index)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ImageViewer
        open={Boolean(viewerState)}
        artifact={selectedArtifact}
        onOpenChange={(open) => {
          if (!open) setViewerState(null);
        }}
        onNavigate={navigateViewer}
      />
    </section>
  );
}

interface GridCellProps {
  artifact: ImageArtifactDTO | null;
  onOpen: () => void;
}

function GridCell({ artifact, onOpen }: GridCellProps) {
  return artifact ? (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col gap-3 rounded-xl border border-slate-900 bg-black/80 p-3 text-left transition hover:border-slate-600"
    >
      <div className="flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={artifact.sourceUrl}
          alt={artifact.prompt ?? artifact.filename}
          loading="lazy"
          className="h-full max-h-52 w-full object-contain"
        />
      </div>
      <div className="text-xs text-slate-300">
        <div className="font-medium text-slate-100">{artifact.filename}</div>
        {artifact.prompt ? <div className="mt-1 text-slate-500">{artifact.prompt}</div> : null}
      </div>
    </button>
  ) : (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-black/60 p-3 text-xs text-slate-500">
      No image
    </div>
  );
}
