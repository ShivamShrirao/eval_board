"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { useViewContext } from "./view-context";
import { stableStringify } from "../lib/stableStringify";

const SAVE_DEBOUNCE = 600;

export function useViewPersistence() {
  const { config, viewId, markSaved, isDirty } = useViewContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastSerializedRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingIdRef = useRef<string | null>(null);

  useEffect(() => {
    const serialized = stableStringify(config);

    if (lastSerializedRef.current === serialized || !isDirty) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      const key = viewId ?? pendingIdRef.current ?? nanoid(10);
      pendingIdRef.current = key;

      try {
        const res = await fetch("/api/view", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ key, value: config })
        });

        if (!res.ok) {
          console.error("Failed to persist view", await res.text());
          return;
        }

        lastSerializedRef.current = serialized;
        markSaved(key);

        const params = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);
        params.set("view", key);
        const query = params.toString();
        const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      } catch (error) {
        console.error("Error persisting view", error);
      }
    }, SAVE_DEBOUNCE);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [config, isDirty, markSaved, router, searchParams, viewId]);
}
