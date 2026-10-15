"use client";

import { useEffect, useState } from "react";

export function Spotlight({
  selector,
  caption,
  onStop,
}: {
  selector: string;
  caption: string;
  onStop: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const measure = () => {
      const nodes = [...document.querySelectorAll<HTMLElement>(`[data-spotlight="${CSS.escape(selector)}"]`)];
      const visible = nodes.find((node) => node.getClientRects().length > 0);
      setRect(visible ? visible.getBoundingClientRect() : null);
    };
    measure();
    const id = window.setInterval(measure, 200);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [selector]);

  return (
    <div className="fixed inset-0 z-[55]">
      <div className="absolute inset-0 bg-pine-deep/45" />
      {rect ? (
        <div
          className="absolute rounded-2xl ring-4 ring-gold"
          style={{
            top: Math.max(8, rect.top - 8),
            left: Math.max(8, rect.left - 8),
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: "0 0 0 9999px rgba(19, 46, 36, 0.45)",
          }}
        />
      ) : null}
      <div className="absolute inset-x-4 bottom-24 z-[56] mx-auto max-w-lg rounded-3xl bg-paper p-4 text-ink shadow-2xl lg:bottom-8">
        <p className="text-caption font-semibold uppercase tracking-wide text-pine">Price Ranger</p>
        <p className="mt-1 text-sm leading-relaxed">{caption}</p>
        <button
          type="button"
          onClick={onStop}
          className="mt-3 h-11 rounded-2xl bg-[#8d3b32] px-4 text-sm font-semibold text-cream"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
