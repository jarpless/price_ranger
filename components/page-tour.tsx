"use client";

import { useEffect, useId, useState } from "react";

import { runTourAction, visibleSpotlight } from "@/lib/assistant/perform";
import type { TourStep } from "@/lib/assistant/tours";

type Box = { top: number; left: number; width: number; height: number };

function measure(selector: string): Box | null {
  const node = visibleSpotlight(selector);
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  return {
    top: Math.max(8, rect.top - 8),
    left: Math.max(8, rect.left - 8),
    width: rect.width + 16,
    height: rect.height + 16,
  };
}

function cardStyle(box: Box | null): { top: number; left: number; width: number } {
  const margin = 16;
  const width = Math.min(360, window.innerWidth - margin * 2);
  if (!box) {
    return { top: Math.max(margin, window.innerHeight * 0.2), left: Math.max(margin, (window.innerWidth - width) / 2), width };
  }
  let top = box.top + box.height + 12;
  let left = Math.min(Math.max(margin, box.left), window.innerWidth - width - margin);
  if (top + 230 > window.innerHeight) top = Math.max(margin, box.top - 230);
  const dock = document.getElementById("assistant-dock")?.getBoundingClientRect();
  if (dock && dock.width > 40 && left + width > dock.left - 12) {
    left = Math.max(margin, dock.left - width - 12);
  }
  return { top, left, width };
}

export function PageTour({
  steps,
  onFinish,
  onNote,
}: {
  steps: TourStep[];
  onFinish: (reason: "done" | "skipped") => void;
  onNote: (text: string) => void;
}) {
  const titleId = useId();
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const step = steps[index];
  const placed = typeof window === "undefined" ? { top: 16, left: 16, width: 320 } : cardStyle(box);

  useEffect(() => {
    if (!step) return;
    const update = () => setBox(measure(step.spotlight));
    update();
    const id = window.setInterval(update, 200);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  useEffect(() => {
    if (!step) return;
    const node = visibleSpotlight(step.spotlight);
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ block: "center", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [step]);

  useEffect(() => {
    setConfirming(false);
    setError("");
  }, [index]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onFinish("skipped");
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onFinish]);

  if (!step) return null;

  const last = index === steps.length - 1;

  function go(next: number) {
    if (next >= steps.length) {
      onFinish("done");
      return;
    }
    setIndex(Math.max(0, next));
  }

  function perform() {
    if (!step?.action) return;
    const reason = runTourAction(step.action);
    if (reason) {
      setError(reason);
      setConfirming(false);
      return;
    }
    onNote(step.action.done);
    setConfirming(false);
    go(index + 1);
  }

  const hole = box;

  return (
    <>
      {hole ? (
        <>
          <div className="fixed inset-x-0 top-0 z-[64] bg-pine-deep/45" style={{ height: hole.top }} />
          <div className="fixed inset-x-0 bottom-0 z-[64] bg-pine-deep/45" style={{ top: hole.top + hole.height }} />
          <div className="fixed z-[64] bg-pine-deep/45" style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }} />
          <div className="fixed z-[64] bg-pine-deep/45" style={{ top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height }} />
          <div
            className="pointer-events-none fixed z-[65] rounded-2xl ring-4 ring-gold"
            style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
          />
        </>
      ) : (
        <div className="fixed inset-0 z-[64] bg-pine-deep/45" />
      )}
      <div
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        className="fixed z-[66] rounded-3xl bg-paper p-4 text-ink shadow-2xl"
        style={placed}
      >
        <p className="text-caption font-semibold uppercase tracking-wide text-pine">
          Step {index + 1} of {steps.length}
        </p>
        <h2 id={titleId} className="mt-1 font-serif text-2xl leading-tight">
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-6">{box ? step.body : step.missing}</p>
        {error ? (
          <p className="mt-2 text-sm leading-6 text-danger" role="status">
            {error}
          </p>
        ) : null}
        {confirming && step.action ? (
          <div className="mt-3">
            <p className="text-sm leading-6">{step.action.confirm}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="h-11 rounded-full bg-pine px-4 text-sm font-semibold text-cream" onClick={perform}>
                Do it
              </button>
              <button type="button" className="h-11 rounded-full px-4 text-sm font-semibold text-muted" onClick={() => setConfirming(false)}>
                Not now
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="h-11 rounded-full px-3 text-sm font-semibold text-muted" onClick={() => onFinish("skipped")}>
              Skip
            </button>
            {index > 0 ? (
              <button type="button" className="h-11 rounded-full px-3 text-sm font-semibold text-ink" onClick={() => go(index - 1)}>
                Back
              </button>
            ) : null}
            {step.action && box ? (
              <button
                type="button"
                className="h-11 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ink"
                onClick={() => {
                  setError("");
                  setConfirming(true);
                }}
              >
                Do it for me
              </button>
            ) : null}
            <button type="button" className="ml-auto h-11 rounded-full bg-pine px-4 text-sm font-semibold text-cream" onClick={() => go(index + 1)}>
              {last ? "Done" : "Next"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
