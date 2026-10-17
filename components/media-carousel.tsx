"use client";

import { useEffect, useRef, useState, type UIEvent } from "react";
import { createPortal } from "react-dom";

import type { CarouselSlide } from "@/lib/guide/media-slides";

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      {direction === "left" ? <path d="M14.5 6 8.5 12l6 6" /> : <path d="M9.5 6l6 6-6 6" />}
    </svg>
  );
}

function slideIndex(el: HTMLElement, count: number): number {
  const width = el.clientWidth || 1;
  return Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / width)));
}

function Slide({
  slide,
  active,
  eager,
  onOpen,
}: {
  slide: CarouselSlide;
  active: boolean;
  eager: boolean;
  onOpen: () => void;
}) {
  if (slide.kind === "video") {
    return (
      <div className="relative h-full w-full bg-ink">
        <video
          poster={slide.poster || undefined}
          controls
          playsInline
          preload={active ? "metadata" : "none"}
          src={eager ? slide.src : undefined}
          className="h-full w-full object-contain"
          aria-label={slide.alt}
        />
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink/75 px-2.5 py-1 text-caption text-cream">
          Video
        </span>
        <button
          type="button"
          aria-label="Full screen"
          onClick={onOpen}
          className="absolute right-3 top-3 inline-flex h-11 items-center rounded-full bg-paper/95 px-3 text-sm font-semibold text-ink"
        >
          Full screen
        </button>
      </div>
    );
  }
  return (
    <button type="button" onClick={onOpen} aria-label={`View ${slide.alt} full screen`} className="block h-full w-full bg-paper">
      {/* Stored quote photos are served from our own routes, including a data URL fallback on older shares. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.src}
        alt={slide.alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "low"}
        className="h-full w-full object-contain"
      />
    </button>
  );
}

export function MediaCarousel({
  slides,
  density = "hero",
  onRemove,
}: {
  slides: CarouselSlide[];
  density?: "hero" | "strip";
  onRemove?: (id: string) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const lightbox = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const count = useRef(slides.length);
  const wasOpen = useRef(false);
  const current = slides[index] || slides[0];

  useEffect(() => {
    if (slides.length > count.current && scroller.current) {
      const next = slides.length - 1;
      scroller.current.scrollTo({ left: next * scroller.current.clientWidth, behavior: "auto" });
      setIndex(next);
    }
    if (index > slides.length - 1) setIndex(Math.max(0, slides.length - 1));
    count.current = slides.length;
  }, [slides.length, index]);

  useEffect(() => {
    if (wasOpen.current && !open && scroller.current) {
      scroller.current.scrollTo({ left: index * scroller.current.clientWidth, behavior: "auto" });
    }
    wasOpen.current = open;
  }, [open, index]);

  useEffect(() => {
    if (!open) return;
    const frame = lightbox.current;
    if (frame) frame.scrollTo({ left: index * frame.clientWidth, behavior: "auto" });
    closeButton.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
    // Scroll the lightbox to the photo that was tapped. Later swipes update index on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!slides.length || !current) return null;

  function go(next: number) {
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    const frame = open ? lightbox.current : scroller.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    frame?.scrollTo({
      left: clamped * (frame.clientWidth || 0),
      behavior: reduce ? "auto" : "smooth",
    });
    setIndex(clamped);
  }

  function onScroll(event: UIEvent<HTMLDivElement>) {
    setIndex(slideIndex(event.currentTarget, slides.length));
  }

  const frameClass = density === "strip" ? "h-36" : "aspect-[4/3] max-h-80";
  const many = slides.length > 1;
  const dots = slides.map((slide, dotIndex) => (
    <button
      key={slide.id}
      type="button"
      aria-label={`Show ${slide.kind === "video" ? "video" : "photo"} ${dotIndex + 1}`}
      aria-current={dotIndex === index ? "true" : undefined}
      onClick={() => go(dotIndex)}
      className="inline-flex h-11 w-8 items-center justify-center"
    >
      <span className={dotIndex === index ? "h-2 w-6 rounded-full bg-pine" : "h-2 w-2 rounded-full bg-line"} />
    </button>
  ));

  return (
    <div data-media-carousel="" data-media-count={slides.length}>
      <section
        aria-roledescription="carousel"
        aria-label="Photos and videos"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          const tag = (event.target as HTMLElement).tagName;
          if (tag === "INPUT" || tag === "TEXTAREA" || tag === "VIDEO") return;
          event.preventDefault();
          go(event.key === "ArrowRight" ? index + 1 : index - 1);
        }}
        className="relative rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-pine"
      >
        <p className="sr-only" aria-live="polite">
          {current.alt}. {index + 1} of {slides.length}
        </p>
        <div
          ref={scroller}
          onScroll={onScroll}
          className={`flex snap-x snap-mandatory overflow-x-auto rounded-2xl border border-line motion-safe:scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${frameClass}`}
        >
          {slides.map((slide, slideIndex) => (
            <div key={slide.id} className="h-full w-full shrink-0 snap-start snap-always">
              <Slide
                slide={slide}
                active={slideIndex === index}
                eager={Math.abs(slideIndex - index) <= 1}
                onOpen={() => {
                  setIndex(slideIndex);
                  setOpen(true);
                }}
              />
            </div>
          ))}
        </div>
        {many ? (
          <p className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-ink/75 px-2.5 py-1 text-caption text-cream lg:hidden">
            {index + 1} of {slides.length}
          </p>
        ) : null}
        {onRemove && current ? (
          <button
            type="button"
            aria-label={current.kind === "video" ? "Remove video" : "Remove photo"}
            onClick={() => onRemove(current.id)}
            className={`absolute z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-paper/95 text-lg font-semibold text-ink ${current.kind === "video" ? "bottom-3 right-3" : "right-3 top-3"}`}
          >
            ×
          </button>
        ) : null}
        {many && density === "strip" ? (
          <div className="absolute inset-x-0 bottom-2 hidden justify-center lg:flex">
            <div className="flex rounded-full bg-paper/90 px-1">{dots}</div>
          </div>
        ) : null}
        {many ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              disabled={index === 0}
              onClick={() => go(index - 1)}
              className="absolute left-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper/95 text-ink shadow-card disabled:opacity-40 lg:inline-flex"
            >
              <Chevron direction="left" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              disabled={index === slides.length - 1}
              onClick={() => go(index + 1)}
              className="absolute right-3 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper/95 text-ink shadow-card disabled:opacity-40 lg:inline-flex"
            >
              <Chevron direction="right" />
            </button>
          </>
        ) : null}
      </section>
      {many && density !== "strip" ? <div className="mt-1 hidden justify-center lg:flex">{dots}</div> : null}
      {open
        ? createPortal(
        <div role="dialog" aria-modal="true" aria-label={current.alt} className="fixed inset-0 z-[80] flex flex-col bg-pine-deep text-cream">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-caption text-cream/80">{many ? `${index + 1} of ${slides.length}` : ""}</p>
            <button
              ref={closeButton}
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-12 items-center rounded-full bg-paper px-4 text-base font-semibold text-ink"
            >
              Close
            </button>
          </div>
          <div
            ref={lightbox}
            onScroll={onScroll}
            className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto motion-safe:scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {slides.map((slide) => (
              <div key={slide.id} className="flex h-full w-full shrink-0 snap-start snap-always items-center justify-center px-4 pb-6">
                {slide.kind === "video" ? (
                  <video
                    poster={slide.poster || undefined}
                    src={slide.src}
                    controls
                    playsInline
                    autoPlay={slide.id === current.id}
                    preload="metadata"
                    className="max-h-full max-w-full"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={slide.src} alt={slide.alt} className="max-h-full max-w-full object-contain" />
                )}
              </div>
            ))}
          </div>
          {many ? (
            <div className="hidden justify-center gap-3 px-4 pb-6 lg:flex">
              <button
                type="button"
                aria-label="Previous photo"
                disabled={index === 0}
                onClick={() => go(index - 1)}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-cream/40 disabled:opacity-40"
              >
                <Chevron direction="left" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                disabled={index === slides.length - 1}
                onClick={() => go(index + 1)}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-cream/40 disabled:opacity-40"
              >
                <Chevron direction="right" />
              </button>
            </div>
          ) : null}
        </div>,
          document.body,
        )
        : null}
    </div>
  );
}
