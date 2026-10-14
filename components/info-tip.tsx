"use client";

import { useEffect, useId, useRef, useState } from "react";

import { GLOSSARY, type GlossaryId } from "@/lib/glossary";

import { IconInfo } from "./icons";

export function InfoTip({ id, label }: { id: GlossaryId; label?: string }) {
  const tip = GLOSSARY[id];
  const reactId = useId();
  const tipId = `tip-${reactId}`;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex align-middle">
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-pine"
        aria-label={label || `About ${tip.term}`}
        aria-expanded={open}
        aria-describedby={open ? tipId : undefined}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <IconInfo className="h-5 w-5" />
      </button>
      {open ? (
        <span
          id={tipId}
          role="tooltip"
          className="absolute left-1/2 top-11 z-50 w-64 -translate-x-1/2 rounded-2xl border border-line bg-paper p-3 text-left text-caption leading-4 text-ink shadow-sheet"
        >
          <span className="block font-semibold">{tip.term}</span>
          <span className="mt-1 block text-muted">{tip.body}</span>
        </span>
      ) : null}
    </span>
  );
}
