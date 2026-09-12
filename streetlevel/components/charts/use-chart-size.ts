"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Measures a container and re-reports its width as it changes.
 *
 * The charts are drawn in real pixel coordinates rather than in a fixed
 * viewBox that the browser scales. Scaling a viewBox would stretch the text
 * and the stroke weights along with the geometry, so a chart that looked right
 * on a desktop would have hairline rules and six-pixel labels on a phone.
 * Measuring instead keeps type and strokes at their intended size at every
 * width, and lets tick density adapt to the space available.
 */
export function useChartSize<T extends HTMLElement>(fallbackWidth = 720) {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(fallbackWidth);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const apply = (next: number) => {
      // Sub-pixel churn from flex layout would otherwise re-render constantly.
      setWidth((current) => (Math.abs(current - next) > 0.5 ? next : current));
    };

    apply(element.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) apply(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width: Math.max(240, width) };
}
