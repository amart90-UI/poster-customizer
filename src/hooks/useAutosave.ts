import { useEffect, useRef } from "react";
import { useEditor } from "@/store/store";
import { QuotaError, saveProject } from "@/store/persistence";
import { useToasts } from "@/store/toasts";

/**
 * Debounced autosave. Persists the current project to localStorage a short
 * moment after the last change, so refreshes and accidental closes don't lose
 * work. Surfaces a one-time warning if storage is full.
 */
export function useAutosave() {
  const push = useToasts((s) => s.push);
  const timer = useRef<number | null>(null);
  const warnedQuota = useRef(false);

  useEffect(() => {
    const unsub = useEditor.subscribe((state, prev) => {
      if (state.project === prev.project) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        try {
          saveProject(useEditor.getState().project);
        } catch (err) {
          if (err instanceof QuotaError && !warnedQuota.current) {
            warnedQuota.current = true;
            push(err.message, "error", 6000);
          }
        }
      }, 600);
    });
    return () => {
      unsub();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [push]);
}
