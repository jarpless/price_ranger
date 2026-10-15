"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { suggestFeedbackTitle, type FeedbackKind } from "@/lib/feedback/note";

import { captureAnnotated, deviceId, type DragBox } from "./capture-shot";
import { readConsoleErrors } from "./console-buffer";

type Phase = "off" | "armed" | "composing";

function boxFrom(origin: { x: number; y: number }, x: number, y: number): DragBox {
  return {
    x: Math.min(origin.x, x),
    y: Math.min(origin.y, y),
    w: Math.abs(x - origin.x),
    h: Math.abs(y - origin.y),
  };
}

function placePopover(box: DragBox, width: number, height: number): { left: number; top: number } {
  const gap = 12;
  let left = box.x + box.w + gap;
  let top = box.y;
  if (left + width > window.innerWidth - 8) left = box.x - width - gap;
  if (left < 8) left = Math.max(8, Math.min(box.x, window.innerWidth - width - 8));
  if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);
  return { left, top };
}

export function FeedbackMode() {
  const pathname = usePathname();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("off");
  const [narrow, setNarrow] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [drag, setDrag] = useState<DragBox | null>(null);
  const [shot, setShot] = useState<{ preview: string; blob: Blob } | null>(null);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [answerA, setAnswerA] = useState("");
  const [answerB, setAnswerB] = useState("");
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [spot, setSpot] = useState({ left: 16, top: 72 });
  const origin = useRef<{ x: number; y: number } | null>(null);
  const liveBox = useRef<DragBox | null>(null);
  const selectingRef = useRef(false);
  const popover = useRef<HTMLFormElement>(null);
  selectingRef.current = selecting;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const apply = () => setNarrow(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  function resetDraft() {
    setKind("bug");
    setAnswerA("");
    setAnswerB("");
    setTitle("");
    setTitleEdited(false);
    setStatus("");
    setShot(null);
    setDrag(null);
    setSelecting(false);
  }

  function exit() {
    resetDraft();
    setPhase("off");
  }

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target instanceof Element ? event.target.closest("[data-feedback-label]") : null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      resetDraft();
      setPhase("armed");
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (phase === "off") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        exit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  useEffect(() => {
    if (phase !== "armed") return;
    function onDown(event: PointerEvent) {
      if (event.button !== 0) return;
      if (event.target instanceof Element && event.target.closest("[data-feedback-chrome]")) return;
      const modifier = event.metaKey || event.ctrlKey;
      if (!selectingRef.current && !modifier) return;
      event.preventDefault();
      origin.current = { x: event.clientX, y: event.clientY };
      const next = { x: event.clientX, y: event.clientY, w: 0, h: 0 };
      liveBox.current = next;
      setDrag(next);
    }
    function onMove(event: PointerEvent) {
      if (!origin.current) return;
      const next = boxFrom(origin.current, event.clientX, event.clientY);
      liveBox.current = next;
      setDrag(next);
    }
    async function onUp() {
      const start = origin.current;
      origin.current = null;
      if (!start) return;
      const box = liveBox.current;
      if (!box || box.w < 8 || box.h < 8) {
        liveBox.current = null;
        setDrag(null);
        setPhase("armed");
        return;
      }
      setSelecting(false);
      setPhase("composing");
      try {
        const captured = await captureAnnotated(box);
        setShot(captured);
        setStatus("");
        const width = 352;
        const height = 420;
        setSpot(placePopover(box, width, height));
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not capture that area.");
        setPhase("armed");
      }
    }
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "composing" || !drag) return;
    const node = popover.current;
    if (!node) return;
    setSpot(placePopover(drag, node.offsetWidth, node.offsetHeight));
  }, [phase, drag, kind, shot]);

  const suggested = suggestFeedbackTitle(kind, answerA, pathname);
  const shownTitle = titleEdited ? title : suggested;
  const labelA = kind === "feature" ? "What do you want?" : "What happened?";
  const labelB = kind === "feature" ? "Why?" : "What did you expect to happen?";

  async function send() {
    if (!shot || !drag) return;
    if (answerA.trim().length < 2 && answerB.trim().length < 2) {
      setStatus("Add a note before sending.");
      return;
    }
    setBusy(true);
    setStatus("");
    const form = new FormData();
    form.set("kind", kind);
    form.set("title", shownTitle);
    form.set("answerA", answerA);
    form.set("answerB", answerB);
    form.set("selection", `${Math.round(drag.x)},${Math.round(drag.y)},${Math.round(drag.w)},${Math.round(drag.h)}`);
    form.set("url", window.location.href);
    form.set("route", pathname);
    form.set("source", narrow ? "mobile" : "desktop");
    form.set("viewport", `${window.innerWidth}x${window.innerHeight}`);
    form.set("userAgent", navigator.userAgent);
    form.set("consoleErrors", JSON.stringify(readConsoleErrors()));
    form.set("deviceId", deviceId());
    form.set("screenshot", shot.blob, "page.png");
    const response = await fetch("/api/feedback", { method: "POST", body: form });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; href?: string };
    setBusy(false);
    if (!response.ok || !payload.href) {
      setStatus(payload.error || "Could not save that note.");
      return;
    }
    const href = payload.href;
    exit();
    router.push(href);
    router.refresh();
  }

  if (phase === "off") return null;

  return (
    <>
      {phase === "armed" ? (
        <div
          data-feedback-chrome="true"
          data-feedback-toast="true"
          className="fixed left-1/2 top-3 z-[130] flex w-[min(40rem,calc(100%-1rem))] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full bg-[#1c1917] px-3 py-2 text-sm font-semibold text-cream shadow-card"
        >
          <p className="min-w-0 text-center leading-5">Feedback mode activated, hold ⌘ to highlight an area of the screen</p>
          {narrow ? (
            <button
              type="button"
              onClick={() => setSelecting((value) => !value)}
              aria-pressed={selecting}
              className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3 text-sm font-semibold ${selecting ? "bg-white text-ink" : "bg-white/15 text-cream"}`}
            >
              Select area
            </button>
          ) : null}
          <button type="button" onClick={exit} className="inline-flex h-8 items-center whitespace-nowrap rounded-full bg-[#e10600] px-3 text-sm font-semibold text-white">
            Stop
          </button>
        </div>
      ) : null}
      {drag && (phase === "armed" || phase === "composing") ? (
        <div
          data-feedback-chrome="true"
          data-feedback-box="true"
          className="pointer-events-none fixed z-[110] border-2 border-[#e10600]"
          style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }}
        />
      ) : null}
      {phase === "composing" && drag ? (
        <form
          ref={popover}
          data-feedback-chrome="true"
          data-feedback-popover="true"
          className="fixed z-[120] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl bg-[#1c1917] p-3 text-cream shadow-card"
          style={{ left: spot.left, top: spot.top, maxHeight: "min(34rem, calc(100dvh - 1rem))" }}
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shot.preview} alt="The page, with the selected area in red" className="max-h-28 w-full rounded-lg bg-black object-contain" />
          ) : (
            <p className="text-sm text-cream/70">Taking the screenshot.</p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-white/10 p-1" role="group" aria-label="Feedback type">
            {(["bug", "feature"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={kind === item}
                onClick={() => setKind(item)}
                className={`h-8 whitespace-nowrap rounded-full text-sm font-semibold ${kind === item ? "bg-white text-ink" : "text-cream"}`}
              >
                {item === "bug" ? "Bug" : "Feature request"}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-sm font-semibold">
            {labelA}
            <textarea
              value={answerA}
              onChange={(event) => setAnswerA(event.target.value)}
              className="mt-1 min-h-20 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-normal text-cream outline-none"
            />
          </label>
          <label className="mt-3 block text-sm font-semibold">
            {labelB}
            <textarea
              value={answerB}
              onChange={(event) => setAnswerB(event.target.value)}
              className="mt-1 min-h-16 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-normal text-cream outline-none"
            />
          </label>
          <label className="mt-3 block text-sm font-semibold">
            Short title
            <input
              value={shownTitle}
              placeholder="Short title (filled in for you)"
              onChange={(event) => {
                setTitleEdited(true);
                setTitle(event.target.value);
              }}
              className="mt-1 h-10 w-full rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-normal text-cream outline-none placeholder:text-cream/50"
            />
          </label>
          {status ? <p className="mt-2 text-sm text-[#ffb4a8]">{status}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setShot(null);
                setDrag(null);
                setStatus("");
                setPhase("armed");
              }}
              className="inline-flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-full border border-white/20 px-3 text-sm font-semibold"
            >
              Redo the box
            </button>
            <button
              disabled={busy || !shot}
              className="inline-flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-white px-3 text-sm font-semibold text-ink disabled:opacity-50"
            >
              {busy ? "Sending" : "Send"}
            </button>
          </div>
        </form>
      ) : null}
    </>
  );
}
