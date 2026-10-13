"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { captureShot, type DragBox } from "./capture-shot";
import { FeedbackComposer } from "./feedback-composer";

export function FeedbackCapture() {
  const pathname = usePathname();
  const [desktop, setDesktop] = useState(false);
  const [armed, setArmed] = useState(false);
  const [drag, setDrag] = useState<DragBox | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [shot, setShot] = useState<{ preview: string; blob: Blob } | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const apply = () => setDesktop(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  async function finish(box: DragBox) {
    setArmed(false);
    setDrag(null);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
      setShot(await captureShot(box));
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not capture that area.");
    }
  }

  if (!desktop && !shot) return null;

  return (
    <>
      {desktop && !armed && !shot ? (
        <button
          type="button"
          data-feedback-chrome="true"
          onClick={() => {
            setStatus("");
            setArmed(true);
          }}
          className="fixed bottom-6 left-4 z-40 hidden h-12 items-center whitespace-nowrap rounded-2xl border border-line bg-paper px-4 text-base font-semibold text-pine shadow-card lg:left-64 lg:inline-flex"
        >
          Feedback
        </button>
      ) : null}
      {armed ? (
        <div
          data-feedback-chrome="true"
          className="fixed inset-0 z-[90] cursor-crosshair"
          onMouseDown={(event) => {
            origin.current = { x: event.clientX, y: event.clientY };
            setDrag({ x: event.clientX, y: event.clientY, w: 0, h: 0 });
          }}
          onMouseMove={(event) => {
            if (!origin.current) return;
            const x = Math.min(origin.current.x, event.clientX);
            const y = Math.min(origin.current.y, event.clientY);
            setDrag({
              x,
              y,
              w: Math.abs(event.clientX - origin.current.x),
              h: Math.abs(event.clientY - origin.current.y),
            });
          }}
          onMouseUp={() => {
            const box = drag;
            origin.current = null;
            if (!box || box.w < 12 || box.h < 12) {
              setArmed(false);
              setDrag(null);
              return;
            }
            void finish(box);
          }}
        >
          <div className="absolute inset-0 bg-pine-deep/25" />
          {drag ? (
            <div className="absolute border-2 border-pine bg-pine/10" style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }} />
          ) : null}
          <p className="absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-2xl bg-paper px-4 py-2 text-body font-semibold">
            Drag a region
          </p>
        </div>
      ) : null}
      {shot ? (
        <FeedbackComposer
          preview={shot.preview}
          blob={shot.blob}
          source="desktop"
          route={pathname}
          onClose={() => setShot(null)}
        />
      ) : null}
      {status ? (
        <p data-feedback-chrome="true" className="fixed bottom-24 left-4 z-40 hidden max-w-xs rounded-2xl bg-paper px-4 py-3 text-body shadow-card lg:left-64 lg:block">
          {status}
        </p>
      ) : null}
    </>
  );
}
