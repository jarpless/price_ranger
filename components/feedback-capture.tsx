"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import type { BuildStamp } from "@/lib/build-info";

import { readConsoleErrors } from "./console-buffer";

interface DragBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function FeedbackCapture({ stamp }: { stamp: BuildStamp }) {
  const pathname = usePathname();
  const [armed, setArmed] = useState(false);
  const [drag, setDrag] = useState<DragBox | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [kind, setKind] = useState<"bug" | "feature">("bug");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function capture(box: DragBox) {
    setArmed(false);
    setDrag(null);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(document.body, {
        pixelRatio: 1,
        cacheBust: true,
        filter: (node) => !(node instanceof HTMLElement && node.dataset.feedbackChrome === "true"),
      });
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const scaleX = image.width / window.innerWidth;
      const scaleY = image.height / window.innerHeight;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(box.w * scaleX));
      canvas.height = Math.max(1, Math.round(box.h * scaleY));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not crop the screenshot.");
      context.drawImage(
        image,
        box.x * scaleX,
        box.y * scaleY,
        box.w * scaleX,
        box.h * scaleY,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!png) throw new Error("Could not save the screenshot.");
      setBlob(png);
      setPreview(canvas.toDataURL("image/png"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not capture that area.");
    }
  }

  async function submit() {
    if (!blob) return;
    setBusy(true);
    setStatus("");
    const form = new FormData();
    form.set("kind", kind);
    form.set("body", body);
    form.set("route", pathname);
    form.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
    form.set("userAgent", navigator.userAgent);
    form.set("consoleErrors", JSON.stringify(readConsoleErrors()));
    form.set("screenshot", blob, "region.png");
    const response = await fetch("/api/feedback", { method: "POST", body: form });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      githubIssueUrl?: string | null;
      githubError?: string | null;
    };
    setBusy(false);
    if (!response.ok) {
      setStatus(payload.error || "Could not save that note.");
      return;
    }
    setStatus(payload.githubIssueUrl ? `Saved. GitHub issue: ${payload.githubIssueUrl}` : payload.githubError || "Saved to the inbox.");
    setBody("");
    setPreview("");
    setBlob(null);
  }

  return (
    <>
      {!armed && !preview ? (
        <button
          type="button"
          data-feedback-chrome="true"
          onClick={() => {
            setStatus("");
            setArmed(true);
          }}
          className="fixed bottom-24 left-4 z-40 h-11 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-pine shadow-md hover:border-pine lg:bottom-6 lg:left-64"
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
            void capture(box);
          }}
        >
          <div className="absolute inset-0 bg-pine-deep/25" />
          {drag ? (
            <div
              className="absolute border-2 border-gold bg-gold/10"
              style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }}
            />
          ) : null}
          <p className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-paper px-3 py-1 text-sm font-semibold text-ink">
            Drag a region. {stamp.label}
          </p>
        </div>
      ) : null}
      {preview ? (
        <form
          data-feedback-chrome="true"
          className="fixed inset-x-4 bottom-24 z-[90] mx-auto max-w-md space-y-3 rounded-3xl border border-line bg-paper p-4 shadow-2xl lg:bottom-6 lg:left-64 lg:right-auto"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected region" className="max-h-40 w-full rounded-2xl object-contain" />
          <p className="text-xs text-muted">
            {pathname} · {stamp.label} · {stamp.sha} · {stamp.env}
          </p>
          <label className="block text-sm font-medium">
            What is wrong, or what did you expect?
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
              className="mt-1 min-h-24 w-full rounded-2xl border border-line px-3 py-2"
            />
          </label>
          <div className="flex gap-3 text-sm font-semibold">
            <label className="flex items-center gap-2">
              <input type="radio" checked={kind === "bug"} onChange={() => setKind("bug")} /> Bug
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={kind === "feature"} onChange={() => setKind("feature")} /> Feature
            </label>
          </div>
          <div className="flex gap-2">
            <button disabled={busy} className="h-11 flex-1 rounded-2xl bg-pine text-sm font-semibold text-cream disabled:opacity-50">
              {busy ? "Saving" : "Save feedback"}
            </button>
            <button
              type="button"
              className="h-11 rounded-2xl px-3 text-sm font-semibold text-muted"
              onClick={() => {
                setPreview("");
                setBlob(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      {status ? (
        <p data-feedback-chrome="true" className="fixed bottom-40 left-4 z-40 max-w-xs rounded-2xl bg-paper px-3 py-2 text-sm shadow lg:bottom-20 lg:left-64">
          {status}
        </p>
      ) : null}
    </>
  );
}
