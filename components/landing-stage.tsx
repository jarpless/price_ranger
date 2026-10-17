"use client";

import { useEffect, useState, type KeyboardEvent } from "react";

import { IconCamera } from "@/components/icons";
import { LandingArt } from "@/components/landing-art";
import { LANDING_EXAMPLES } from "@/lib/landing-examples";

const ROTATE_MS = 5600;

export function LandingStage() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [announce, setAnnounce] = useState("");
  const example = LANDING_EXAMPLES[index];

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduce(motion.matches);
    apply();
    motion.addEventListener("change", apply);
    return () => motion.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (reduce || paused || hidden) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % LANDING_EXAMPLES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduce, paused, hidden]);

  function choose(next: number) {
    const item = LANDING_EXAMPLES[next];
    setIndex(next);
    setAnnounce(`${item.photoLabel}. ${item.price}. Sold range ${item.range}. ${item.confidence}.`);
  }

  function onTabsKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const next = (index + direction + LANDING_EXAMPLES.length) % LANDING_EXAMPLES.length;
    choose(next);
    document.getElementById(`landing-example-${LANDING_EXAMPLES[next].id}`)?.focus();
  }

  return (
    <section
      aria-label="Photo to sold range"
      className="w-full"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setPaused(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setPaused(false);
      }}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div role="tabpanel" id="landing-example-panel" aria-labelledby={`landing-example-${example.id}`}>
        <figure
          className="relative overflow-hidden rounded-3xl border border-line bg-[radial-gradient(120%_90%_at_50%_40%,#fffdf8_0%,#efe8db_100%)] shadow-card"
          aria-label={example.photoLabel}
        >
          <div className="relative h-56 sm:h-64 lg:h-72">
            {LANDING_EXAMPLES.map((item, itemIndex) => (
              <div
                key={item.id}
                className={`landing-art absolute inset-0 p-3 sm:p-4 ${itemIndex === index ? "opacity-100" : "pointer-events-none opacity-0"}`}
                aria-hidden={itemIndex !== index}
              >
                <LandingArt id={item.id} />
              </div>
            ))}
          </div>
          <div aria-hidden="true">
            <span className="pointer-events-none absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-pine/55" />
            <span className="pointer-events-none absolute right-3 top-3 h-5 w-5 border-r-2 border-t-2 border-pine/55" />
            <span className="pointer-events-none absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-pine/55" />
            <span className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-pine/55" />
          </div>
        </figure>
        <div className="flex items-center gap-3 px-1 py-3 text-caption font-semibold text-pine">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <IconCamera className="h-4 w-4" />
            Snap a photo
          </span>
          <svg viewBox="0 0 80 8" className="h-2 min-w-6 flex-1" aria-hidden="true">
            <path d="M1 4h72M67 1l5 3-5 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="whitespace-nowrap">Sold range</span>
        </div>
        <div className="rounded-3xl border border-line bg-paper p-6 shadow-card">
          <p className="text-caption font-semibold text-muted">Sold range · {example.condition}</p>
          <p className="mt-2 font-serif text-price text-pine tabular-nums">{example.price}</p>
          <p className="mt-1 text-body text-pretty text-muted">
            {example.range} · {example.name}
          </p>
          <p className="mt-4 text-caption font-semibold text-pine">{example.confidence}</p>
        </div>
      </div>
      <div role="tablist" aria-label="Example items" className="mt-2 flex items-center justify-center" onKeyDown={onTabsKeyDown}>
        {LANDING_EXAMPLES.map((item, itemIndex) => {
          const selected = itemIndex === index;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`landing-example-${item.id}`}
              aria-selected={selected}
              aria-controls="landing-example-panel"
              tabIndex={selected ? 0 : -1}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full"
              aria-label={`${item.name}, ${item.price}, sold range ${item.range}`}
              onClick={() => choose(itemIndex)}
            >
              <span className={`landing-dot block h-2 rounded-full ${selected ? "w-6 bg-pine" : "w-2 bg-[#d9d0c3]"}`} />
            </button>
          );
        })}
      </div>
    </section>
  );
}
