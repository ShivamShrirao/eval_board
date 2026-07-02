"use client";

import { useEffect, type ReactNode } from "react";
import useSWR from "swr";
import { ImageArtifactDTO } from "../../lib/types";
import { cn } from "../../lib/utils";
import { ArtifactImage } from "./artifact-image";

interface ImageDetailViewProps {
  artifact: ImageArtifactDTO;
  onClose: () => void;
  onNavigate: (direction: "up" | "down" | "left" | "right") => void;
}

const fetchImageDetail = async (url: string): Promise<{ item: ImageArtifactDTO }> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load image detail: ${await res.text()}`);
  }
  return res.json();
};

const formatPrompt = (prompt?: string | null) => {
  if (!prompt?.trim()) {
    return null;
  }

  try {
    return {
      value: JSON.stringify(JSON.parse(prompt), null, 2),
      isJson: true
    };
  } catch {
    return {
      value: prompt,
      isJson: false
    };
  }
};

const JSON_TOKEN_PATTERN =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\]:,])/g;

const renderJsonSyntax = (json: string): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of json.matchAll(JSON_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    const token = match[0];

    if (index > lastIndex) {
      nodes.push(json.slice(lastIndex, index));
    }

    const nextChar = json.slice(index + token.length).trimStart()[0];
    const className = token.startsWith("\"")
      ? nextChar === ":"
        ? "font-semibold text-sky-700"
        : "text-emerald-700"
      : token === "true" || token === "false" || token === "null"
        ? "font-semibold text-amber-700"
        : /^-?\d/.test(token)
          ? "text-violet-700"
          : "text-slate-500";

    nodes.push(
      <span key={`${index}-${token}`} className={className}>
        {token}
      </span>
    );
    lastIndex = index + token.length;
  }

  if (lastIndex < json.length) {
    nodes.push(json.slice(lastIndex));
  }

  return nodes;
};

const METADATA_FIELD_ORDER = [
  "model",
  "prompt_id",
  "edit_id",
  "input_id",
  "output_id",
  "edit_category",
  "data_type",
  "product_name",
  "caption",
  "short_description",
  "prompt_1",
  "prompt_2",
  "prompt_3",
  "structured_prompt",
  "edit_instruction",
  "seed",
  "steps",
  "guidance_scale",
  "cfg",
  "cfg_scale",
  "sampler",
  "scheduler",
  "is_product_edit",
  "is_significant_edit",
  "transformation_type",
  "significance_reason",
  "classification_reason",
  "is_complex_bg",
  "bg_type",
  "s3_bucket",
  "s3_key",
  "mask_bucket",
  "mask_key",
  "input_mask_bucket",
  "input_mask_key"
];

const METADATA_FIELD_RANK = new Map(METADATA_FIELD_ORDER.map((key, index) => [key, index]));

const sortMetadataEntries = ([keyA]: [string, unknown], [keyB]: [string, unknown]) => {
  const rankA = METADATA_FIELD_RANK.get(keyA);
  const rankB = METADATA_FIELD_RANK.get(keyB);

  if (rankA !== undefined || rankB !== undefined) {
    return (rankA ?? Number.MAX_SAFE_INTEGER) - (rankB ?? Number.MAX_SAFE_INTEGER);
  }

  return keyA.localeCompare(keyB, undefined, { numeric: true, sensitivity: "base" });
};

export function ImageDetailView({ artifact, onClose, onNavigate }: ImageDetailViewProps) {
  const shouldLoadDetail = !artifact.metadata;
  const { data: detail, isLoading: isLoadingDetail } = useSWR(
    shouldLoadDetail ? `/api/images/${artifact.id}` : null,
    fetchImageDetail,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false
    }
  );
  const displayArtifact = detail?.item ?? artifact;
  const prompt = formatPrompt(displayArtifact.prompt);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          onNavigate("left");
          break;
        case "ArrowRight":
          onNavigate("right");
          break;
        case "ArrowUp":
          onNavigate("up");
          break;
        case "ArrowDown":
          onNavigate("down");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNavigate]);

  // Lock body scroll
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Format metadata for display
  const metadataEntries = displayArtifact.metadata
    ? Object.entries(displayArtifact.metadata).sort(sortMetadataEntries).map(([key, value]) => ({
        key,
        value: typeof value === "object" ? JSON.stringify(value) : String(value),
      }))
    : [];

  return (
    <div className="fixed inset-0 z-[9999] flex h-full w-full items-stretch bg-slate-950/95 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-6 top-6 z-[10000] rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div className="flex h-full w-full overflow-hidden min-h-0">
        {/* Main Image Area */}
        <div className="flex-1 min-w-0 min-h-0 relative group overflow-hidden bg-black">

          {/* Navigation Arrows */}
          <button
            className="hidden absolute left-8 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/20 hover:bg-black/50 text-white/50 hover:text-white transition-all z-40 outline-none focus:bg-white/10 focus:text-white backdrop-blur-sm"
            onClick={(e) => { e.stopPropagation(); onNavigate("left"); }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>

          <button
            className="hidden absolute right-8 top-1/2 -translate-y-1/2 p-4 rounded-full bg-black/20 hover:bg-black/50 text-white/50 hover:text-white transition-all z-40 outline-none focus:bg-white/10 focus:text-white backdrop-blur-sm"
            onClick={(e) => { e.stopPropagation(); onNavigate("right"); }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>

          <ArtifactImage
            artifact={displayArtifact}
            className="absolute inset-0 h-full w-full object-contain shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Sidebar */}
        <div
          className="w-96 h-full border-l border-slate-200 flex flex-col overflow-hidden shrink-0 shadow-2xl z-40 relative bg-slate-100 text-slate-900"
          style={{ backgroundColor: "#f8fafc" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative z-10 flex-1 overflow-y-auto p-6">
            <h2 className="text-xl font-semibold text-slate-900 mb-4 break-words">
              {displayArtifact.filename}
            </h2>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-600">
                  Details
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-slate-900 bg-white p-3 rounded-lg border border-slate-200 [&>span]:min-w-0 [&>span]:break-words">
                  {displayArtifact.width && displayArtifact.height && (
                    <>
                      <span className="text-slate-600 text-xs">Dimensions</span>
                      <span>{displayArtifact.width} x {displayArtifact.height}</span>
                    </>
                  )}
                  <span className="text-slate-600 text-xs">Created</span>
                  <span>{new Date(displayArtifact.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Metadata */}
              {metadataEntries.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wider text-slate-600">
                    Metadata
                  </div>
                  <div className="space-y-2">
                    {metadataEntries.map((entry) => (
                      <div key={entry.key} className="flex flex-col gap-1 bg-white p-3 rounded-lg border border-slate-200 min-w-0">
                        <span className="text-xs text-slate-600 font-mono uppercase break-words">{entry.key}</span>
                        <span className="text-xs text-slate-900 font-mono whitespace-pre-wrap [overflow-wrap:anywhere]">
                          {entry.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-slate-600">
                  Prompt
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  {prompt ? (
                    <pre
                      className={cn(
                        "text-sm text-slate-900 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                        prompt.isJson && "font-mono text-xs"
                      )}
                    >
                      {prompt.isJson ? renderJsonSyntax(prompt.value) : prompt.value}
                    </pre>
                  ) : isLoadingDetail ? (
                    <span className="text-sm font-medium uppercase tracking-wide text-slate-500">
                      Loading METADATA
                    </span>
                  ) : (
                    <span className="text-sm italic text-slate-500">No prompt</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
