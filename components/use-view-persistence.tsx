"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { nanoid } from "nanoid";
import { useViewContext } from "./view-context";
import { stableStringify } from "../lib/stableStringify";
import { DEFAULT_GRID_VIEW } from "../lib/types";

const SAVE_DEBOUNCE = 600;
const EMPTY_SERIALIZED = stableStringify(DEFAULT_GRID_VIEW);
const VIEW_CACHE = new Map<string, string>();

export function useViewPersistence() {
  const { config, viewId, markSaved, isDirty, hydrateConfig } = useViewContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastSerializedRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingIdRef = useRef<string | null>(null);
  const loadingViewRef = useRef<string | null>(null);

  useEffect(() => {
    const serialized = stableStringify(config);
    const isEmpty = serialized === EMPTY_SERIALIZED;
    const params = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);
    const requestedView = params.get("view");

    if (viewId && !isDirty) {
      VIEW_CACHE.set(serialized, viewId);
      lastSerializedRef.current = serialized;
    }

    if (!isDirty) {
      if (isEmpty) {
        const shouldPreserveViewParam = Boolean(!viewId && requestedView);
        if (!shouldPreserveViewParam && params.has("view")) {
          params.delete("view");
          const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
        }
      }
      return;
    }

    if (isEmpty) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      pendingIdRef.current = null;
      VIEW_CACHE.delete(serialized);
      lastSerializedRef.current = serialized;
      markSaved(null);

      const clearedParams = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);
      if (clearedParams.has("view")) {
        clearedParams.delete("view");
        const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
        const query = clearedParams.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }
      return;
    }

    const cachedKey = VIEW_CACHE.get(serialized);
    if (cachedKey) {
      pendingIdRef.current = null;
      VIEW_CACHE.set(serialized, cachedKey);
      lastSerializedRef.current = serialized;
      markSaved(cachedKey);

      const nextParams = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);
      if (nextParams.get("view") !== cachedKey) {
        nextParams.set("view", cachedKey);
        const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
        router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false });
      }
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      const key = pendingIdRef.current ?? nanoid(10);
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
        VIEW_CACHE.set(serialized, key);
        markSaved(key);
        pendingIdRef.current = null;

        const nextParams = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);
        nextParams.set("view", key);
        const query = nextParams.toString();
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

  useEffect(() => {
    const params = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);
    const requestedView = params.get("view");
    if (!requestedView) {
      return;
    }

    if (requestedView === viewId) {
      return;
    }

    if (loadingViewRef.current === requestedView) {
      return;
    }

    loadingViewRef.current = requestedView;
    const controller = new AbortController();
    let cancelled = false;

    const fetchView = async () => {
      try {
        const res = await fetch(`/api/view?id=${encodeURIComponent(requestedView)}`, {
          signal: controller.signal
        });

        if (!res.ok) {
          if (res.status === 404) {
            console.warn(`View ${requestedView} not found`);
            const nextParams = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);
            if (nextParams.get("view") === requestedView) {
              nextParams.delete("view");
              const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
              const query = nextParams.toString();
              router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
            }
          } else {
            console.error("Failed to load view config", await res.text());
          }
          return;
        }

        const payload = await res.json();
        if (cancelled) {
          return;
        }
        hydrateConfig(payload.value, requestedView);
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
        console.error("Error fetching view config", error);
      } finally {
        loadingViewRef.current = null;
      }
    };

    fetchView();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [hydrateConfig, isDirty, router, searchParams, viewId]);
}
