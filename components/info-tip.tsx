"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { GLOSSARY, type GlossaryId } from "@/lib/glossary";
import { placeTip, type TipBox } from "@/lib/place-tip";

import { IconInfo } from "./icons";

const HOVER_DELAY_MS = 200;
const TIP_WIDTH = 256;

export function InfoTip({ id, label }: { id: GlossaryId; label?: string }) {
  const tip = GLOSSARY[id];
  const reactId = useId();
  const tipId = `tip-${reactId}`;
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<TipBox | null>(null);
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const tipNode = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const openedBy = useRef<"hover" | "focus" | "tap" | null>(null);
  const lastCoarseAt = useRef(0);

  function clearTimer() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function close() {
    clearTimer();
    openedBy.current = null;
    setOpen(false);
    setBox(null);
  }

  function openTip(reason: "hover" | "focus" | "tap") {
    clearTimer();
    openedBy.current = reason;
    setOpen(true);
  }

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (!open) return;
    function dismiss() {
      clearTimer();
      openedBy.current = null;
      setOpen(false);
      setBox(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) dismiss();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    function measure() {
      const anchor = button.current?.getBoundingClientRect();
      const node = tipNode.current;
      if (!anchor || !node) return;
      const width = Math.min(TIP_WIDTH, window.innerWidth - 16);
      node.style.width = `${width}px`;
      node.style.maxHeight = "none";
      const next = placeTip(
        { top: anchor.top, left: anchor.left, bottom: anchor.bottom },
        { width, height: node.scrollHeight },
        { width: window.innerWidth, height: window.innerHeight },
      );
      setBox((prev) =>
        prev &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.maxHeight === next.maxHeight
          ? prev
          : next,
      );
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  const text = label || `About ${tip.term}`;

  return (
    <span ref={root} className="relative inline-flex align-middle">
      <button
        ref={button}
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-pine"
        aria-label={text}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") lastCoarseAt.current = Date.now();
        }}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          if (Date.now() - lastCoarseAt.current < 700) return;
          if (open && openedBy.current === "focus") return;
          clearTimer();
          timer.current = window.setTimeout(() => openTip("hover"), HOVER_DELAY_MS);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== "mouse") return;
          clearTimer();
          if (openedBy.current === "hover") close();
        }}
        onFocus={(event) => {
          const target = event.currentTarget;
          window.requestAnimationFrame(() => {
            if (target.isConnected && target.matches(":focus-visible")) openTip("focus");
          });
        }}
        onBlur={() => {
          if (openedBy.current === "focus" || openedBy.current === "hover") close();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (Date.now() - lastCoarseAt.current >= 700) return;
          if (open && openedBy.current === "tap") close();
          else openTip("tap");
        }}
      >
        <IconInfo className="h-5 w-5" />
        <span className="sr-only">{text}</span>
      </button>
      {open
        ? createPortal(
            <span
              ref={tipNode}
              id={tipId}
              role="tooltip"
              style={{
                top: box?.top ?? 0,
                left: box?.left ?? 0,
                width: box?.width,
                maxHeight: box?.maxHeight,
                visibility: box ? "visible" : "hidden",
              }}
              className="fixed z-[80] overflow-auto rounded-2xl border border-line bg-paper p-3 text-left text-caption leading-4 text-ink shadow-sheet"
            >
              <span className="block font-semibold">{tip.term}</span>
              <span className="mt-1 block text-muted">{tip.body}</span>
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
