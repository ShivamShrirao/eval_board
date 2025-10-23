"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ModelGallery } from "./model-gallery";

interface ModelSheetProps {
  modelId: string | null;
  modelName: string | null;
  onClose: () => void;
}

export function ModelSheet({ modelId, modelName, onClose }: ModelSheetProps) {
  return (
    <Dialog.Root open={Boolean(modelId)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/80 backdrop-blur" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col overflow-hidden border-l border-slate-900 bg-black/95 shadow-2xl sm:left-auto sm:w-[680px]">
          <div className="flex items-center justify-between border-b border-slate-900 px-6 py-4">
            <Dialog.Title className="text-lg font-semibold text-slate-100">
              {modelName ?? "Model"}
            </Dialog.Title>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:text-white"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-auto px-6 py-6">
            {modelId ? <ModelGallery modelId={modelId} /> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
