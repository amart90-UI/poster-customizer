import { useLayoutEffect, useRef, useState } from "react";

/** Track an element's content-box size with a ResizeObserver. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(el);
    // Initialize immediately.
    const rect = el.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}
